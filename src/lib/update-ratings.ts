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
 * Returns grouped ranking: [[winners], [losers]]
 *
 * Winner = agent whose PR was merged
 * Losers = agents with closed PRs (participated but lost, regardless of commit count)
 * Excluded = agents with open PRs (competition not over yet)
 *
 * @param issueAttempts - All attempts for the issue
 * @returns Array of arrays: [[winner], [loser1, loser2, ...]]
 */
export function determineRanking(
  issueAttempts: Array<{
    agentName: string
    status: string
    mergedAt: Date | null
    closedAt: Date | null
    openedAt: Date
    commitCount: number
  }>
): string[][] {
  // Find winner (merged PR)
  const winner = issueAttempts.find((a) => a.status === 'merged')

  // Find losers (non-merged PRs with sufficient effort)
  const losers = issueAttempts.filter((attempt) => {
    // Skip winner
    if (attempt.status === 'merged') return false

    // Closed PRs are always losses (regardless of commit count)
    // The competition is over for them - they participated and lost
    if (attempt.status === 'closed') return true

    // Open PRs are excluded - competition not over yet
    return false
  })

  // Build grouped ranking
  const ranking: string[][] = []

  if (winner) {
    ranking.push([winner.agentName]) // Position 1: winner
  }

  if (losers.length > 0) {
    ranking.push(losers.map((l) => l.agentName)) // Position 2: all losers tied
  }

  return ranking
}

/**
 * Updates agent ratings after an issue is completed.
 * Fetches current ratings, calculates new ratings, updates database.
 *
 * @param issueId - UUID of the completed issue
 * @throws Error if issue not found or database update fails
 */
export async function updateRatingsForIssue(issueId: string): Promise<void> {
  // Idempotency check: skip if ratings already calculated
  const existingHistory = await db
    .select({ id: agentScoreHistory.id })
    .from(agentScoreHistory)
    .where(eq(agentScoreHistory.issueId, issueId))
    .limit(1)

  if (existingHistory.length > 0) {
    globalThis.console.log(
      `[updateRatingsForIssue] Ratings already exist for issue ${issueId}, skipping`
    )
    return
  }

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

  // Determine ranking (winner first, losers tied for second, DNF excluded)
  const ranking = determineRanking(issueAttempts)

  if (ranking.length === 0) {
    globalThis.console.log(
      `No finishers for issue ${issue.linearKey}, skipping rating update`
    )
    return
  }

  // Flatten ranking to get all participating agents
  const allAgents = ranking.flat()

  // Fetch current ratings for all participating agents
  const currentScores = await db
    .select()
    .from(agentScores)
    .where(inArray(agentScores.agentName, allAgents))

  // Build currentRatings map
  const currentRatings: Record<string, Rating> = {}
  for (const agentName of allAgents) {
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

  // Determine completedAt timestamp (use mergedAt of winner)
  const winner = issueAttempts.find((a) => a.status === 'merged')
  const completedAt = winner?.mergedAt ?? new Date()

  // Update database: agent_scores and agent_score_history
  // Calculate rank based on position in grouped ranking
  let currentRank = 0
  for (const group of ranking) {
    currentRank++ // Increment rank for this group (1 = winner, 2 = all losers)

    for (const agentName of group) {
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
          gamesPlayed: 1,
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
        rank: currentRank, // All losers get rank 2
        completedAt,
      })
    }
  }

  globalThis.console.log(
    `Updated ratings for ${allAgents.length} agents on issue ${issue.linearKey}`
  )
}
