/**
 * Rating update service for processing completed issues.
 * Updates agent scores based on issue outcomes using OpenSkill.
 *
 * @packageDocumentation
 */

import { eq, inArray, sql } from 'drizzle-orm'
import { rating } from 'openskill'
import type { Rating } from 'openskill'

import { db } from '@/db/client'
import { issues, attempts, agentScores, agentScoreHistory } from '@/db/schema'

import {
  updateRatingsForCompletedIssue,
  calculateOrdinal,
  initializeAgentRating,
} from './openskill'

/**
 * Determines ranking of agents based on attempt outcomes.
 * Winner (merged PR) ranks first. Other closed PRs rank by closedAt time (earlier = better).
 * DNF (closed without trying) are excluded from ranking.
 *
 * @param issueAttempts - All attempts for the issue
 * @returns Sorted array of agent names (1st place = winner, last = worst finisher)
 */
function determineRanking(
  issueAttempts: Array<{
    agentName: string
    status: string
    mergedAt: Date | null
    closedAt: Date | null
    openedAt: Date
    commitCount: number
  }>
): string[] {
  // Filter to only agents who finished (merged or closed with effort)
  // Exclude DNF: closed PRs with minimal effort (< 2 commits) or very short lifespan (< 5 minutes)
  const finishers = issueAttempts.filter((attempt) => {
    if (attempt.status === 'merged') return true
    if (attempt.status === 'closed' && attempt.closedAt) {
      // Check for DNF indicators: minimal commits or very short lifespan
      const lifespanMs = attempt.closedAt.getTime() - attempt.openedAt.getTime()
      const lifespanMinutes = lifespanMs / (1000 * 60)

      // DNF if: low commit count (< 2 = minimal effort) OR closed within 5 minutes
      if (attempt.commitCount < 2 || lifespanMinutes < 5) {
        return false // Exclude from finishers
      }

      // Otherwise, closed PRs with effort are considered "finished" (competed but lost)
      return true
    }
    return false
  })

  // Sort: merged first, then by closedAt/mergedAt (earlier = better)
  finishers.sort((a, b) => {
    // Merged PRs always rank first
    if (a.status === 'merged' && b.status !== 'merged') return -1
    if (b.status === 'merged' && a.status !== 'merged') return 1

    // Both merged or both closed: sort by completion time
    const aTime = (a.mergedAt ?? a.closedAt ?? a.openedAt).getTime()
    const bTime = (b.mergedAt ?? b.closedAt ?? b.openedAt).getTime()
    return aTime - bTime
  })

  return finishers.map((f) => f.agentName)
}

/**
 * Updates agent ratings after an issue is completed.
 * Fetches current ratings, calculates new ratings, updates database.
 *
 * @param issueId - UUID of the completed issue
 * @throws Error if issue not found or database update fails
 */
export async function updateRatingsForIssue(issueId: string): Promise<void> {
  // Fetch issue to verify it exists
  const [issue] = await db
    .select()
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1)

  if (!issue) {
    throw new Error(`Issue ${issueId} not found`)
  }

  // Fetch all attempts for this issue
  const issueAttempts = await db
    .select()
    .from(attempts)
    .where(eq(attempts.issueId, issueId))

  if (issueAttempts.length === 0) {
    globalThis.console.log(
      `No attempts for issue ${issue.linearKey}, skipping rating update`
    )
    return
  }

  // Determine ranking (winner first, losers by finish time, DNF excluded)
  const ranking = determineRanking(issueAttempts)

  if (ranking.length === 0) {
    globalThis.console.log(
      `No finishers for issue ${issue.linearKey}, skipping rating update`
    )
    return
  }

  // Fetch current ratings for all participating agents
  const currentScores = await db
    .select()
    .from(agentScores)
    .where(inArray(agentScores.agentName, ranking))

  // Build currentRatings map
  const currentRatings: Record<string, Rating> = {}
  for (const agentName of ranking) {
    const score = currentScores.find((s) => s.agentName === agentName)
    if (score) {
      currentRatings[agentName] = rating({ mu: score.mu, sigma: score.sigma })
    } else {
      // Agent not in database yet, use default rating
      currentRatings[agentName] = initializeAgentRating()
    }
  }

  // Calculate new ratings using OpenSkill
  const updatedRatings = updateRatingsForCompletedIssue(currentRatings, ranking)

  // Determine completedAt timestamp (use mergedAt of winner or latest closedAt)
  const winner = issueAttempts.find((a) => a.status === 'merged')
  const closedAttempts = issueAttempts
    .filter((a) => a.closedAt !== null)
    .sort((a, b) => {
      if (!a.closedAt || !b.closedAt) return 0
      return b.closedAt.getTime() - a.closedAt.getTime()
    })
  const completedAt =
    winner?.mergedAt ?? closedAttempts[0]?.closedAt ?? new Date()

  // Update database: agent_scores and agent_score_history
  for (let i = 0; i < ranking.length; i++) {
    const agentName = ranking[i]
    if (!agentName) continue

    const newRating = updatedRatings[agentName]
    if (!newRating) continue

    const newOrdinal = calculateOrdinal(newRating)

    // Update agent_scores (upsert)
    await db
      .insert(agentScores)
      .values({
        agentName,
        mu: newRating.mu,
        sigma: newRating.sigma,
        ordinal: newOrdinal,
        gamesPlayed: 1, // Will be incremented by ON CONFLICT
        lastUpdatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: agentScores.agentName,
        set: {
          mu: newRating.mu,
          sigma: newRating.sigma,
          ordinal: newOrdinal,
          gamesPlayed: sql`${agentScores.gamesPlayed} + 1`,
          lastUpdatedAt: new Date(),
        },
      })

    // Insert agent_score_history
    await db.insert(agentScoreHistory).values({
      agentName,
      issueId,
      mu: newRating.mu,
      sigma: newRating.sigma,
      ordinal: newOrdinal,
      rank: i + 1, // 1-indexed rank
      completedAt,
    })
  }

  globalThis.console.log(
    `Updated ratings for ${ranking.length} agents on issue ${issue.linearKey}`
  )
}
