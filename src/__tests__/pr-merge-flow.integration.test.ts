/**
 * Integration test for PR merge → winner selection → rating update flow
 *
 * NOTE: This test requires a real database connection and will modify data.
 * It is skipped when:
 * - No DATABASE_URL is set (no database available)
 * - IS_TEST_DB_URL === 'true' (test database is not properly configured for integration tests)
 *
 * To run locally, set DATABASE_URL to a development/staging database.
 */
import { eq, inArray } from 'drizzle-orm'
import { describe, it, expect, beforeEach } from 'vitest'

import { db } from '@/db/client'
import {
  issues,
  attempts,
  issueAgents,
  agentScores,
  agentScoreHistory,
} from '@/db/schema'

describe.skipIf(
  !process.env['DATABASE_URL'] || process.env['IS_TEST_DB_URL'] === 'true'
)('PR Merge Flow Integration', () => {
  const TEST_REPO = 'test/repo'
  const WINNER_AGENT = 'winner-agent'
  const LOSER_AGENT = 'loser-agent'
  const IGNORED_AGENT = 'ignored-agent'
  const WINNER = 'winner'
  const DNF_AGENT = 'dnf-agent'

  beforeEach(async () => {
    // Clean up test data
    await db.delete(agentScoreHistory)
    await db.delete(agentScores)
    await db.delete(attempts)
    await db.delete(issueAgents)
    await db.delete(issues)
  })

  it('should complete full flow: PR merge → winner selected → agents updated → ratings calculated', async () => {
    // 1. Create issue in 'in_progress' state
    const [issue] = await db
      .insert(issues)
      .values({
        linearId: 'test-issue-1',
        linearKey: 'TEST-1',
        title: 'Test Issue',
        url: 'https://linear.app/test/TEST-1',
        status: 'in_progress',
        arenaReadyLabeledAt: new Date(),
      })
      .returning()

    if (!issue) throw new Error('Failed to create issue')

    // 2. Create agents: 2 submitted PRs, 1 never submitted
    await db.insert(issueAgents).values([
      {
        issueId: issue.id,
        agentName: WINNER_AGENT,
        status: 'submitted',
        triggeredAt: new Date(),
      },
      {
        issueId: issue.id,
        agentName: LOSER_AGENT,
        status: 'submitted',
        triggeredAt: new Date(),
      },
      {
        issueId: issue.id,
        agentName: IGNORED_AGENT,
        status: 'pending',
        triggeredAt: new Date(),
      },
    ])

    // 3. Create attempts: winner merged, loser closed
    const [winnerAttempt] = await db
      .insert(attempts)
      .values({
        issueId: issue.id,
        agentName: WINNER_AGENT,
        prNumber: 1,
        repo: TEST_REPO,
        prUrl: `https://github.com/${TEST_REPO}/pull/1`,
        status: 'merged',
        mergedAt: new Date('2024-01-01T12:00:00Z'),
        openedAt: new Date('2024-01-01T10:00:00Z'),
        commitCount: 10,
      })
      .returning()

    if (!winnerAttempt) throw new Error('Failed to create winner attempt')

    await db.insert(attempts).values({
      issueId: issue.id,
      agentName: LOSER_AGENT,
      prNumber: 2,
      repo: TEST_REPO,
      prUrl: `https://github.com/${TEST_REPO}/pull/2`,
      status: 'closed',
      closedAt: new Date('2024-01-01T13:00:00Z'),
      openedAt: new Date('2024-01-01T10:00:00Z'),
      commitCount: 5,
    })

    // 4. Simulate Linear webhook calling updateWinner
    const { updateWinner } = await import('@/app/api/linear/webhook/route')
    await updateWinner(issue.id)

    // VERIFY: Issue status is 'completed'
    const [updatedIssue] = await db
      .select()
      .from(issues)
      .where(eq(issues.id, issue.id))
    if (!updatedIssue) throw new Error('Failed to fetch updated issue')
    expect(updatedIssue.status).toBe('completed')
    expect(updatedIssue.winnerAttemptId).toBe(winnerAttempt.id)

    // VERIFY: Agent statuses updated correctly
    const agents = await db
      .select()
      .from(issueAgents)
      .where(eq(issueAgents.issueId, issue.id))
    const winner = agents.find((a) => a.agentName === WINNER_AGENT)
    const loser = agents.find((a) => a.agentName === LOSER_AGENT)
    const ignored = agents.find((a) => a.agentName === IGNORED_AGENT)

    expect(winner?.status).toBe('accepted')
    expect(loser?.status).toBe('rejected')
    expect(ignored?.status).toBe('ignored')

    // VERIFY: Losing attempt closed
    const [loserAttempt] = await db
      .select()
      .from(attempts)
      .where(eq(attempts.agentName, LOSER_AGENT))
    if (!loserAttempt) throw new Error('Failed to fetch loser attempt')
    expect(loserAttempt.status).toBe('closed')
    expect(loserAttempt.closedAt).toBeTruthy()

    // VERIFY: Ratings calculated for winner and loser (not ignored agent)
    const scores = await db
      .select()
      .from(agentScores)
      .where(
        inArray(agentScores.agentName, [
          WINNER_AGENT,
          LOSER_AGENT,
          IGNORED_AGENT,
        ])
      )

    expect(scores).toHaveLength(2) // Only winner and loser

    const winnerScore = scores.find((s) => s.agentName === WINNER_AGENT)
    const loserScore = scores.find((s) => s.agentName === LOSER_AGENT)

    if (!winnerScore) throw new Error('Winner score not found')
    if (!loserScore) throw new Error('Loser score not found')
    expect(winnerScore.mu).toBeGreaterThan(25) // Winner rating increased
    expect(loserScore.mu).toBeLessThan(25) // Loser rating decreased

    // VERIFY: Score history recorded with correct ranks
    const history = await db
      .select()
      .from(agentScoreHistory)
      .where(eq(agentScoreHistory.issueId, issue.id))

    expect(history).toHaveLength(2)

    const winnerHistory = history.find((h) => h.agentName === WINNER_AGENT)
    const loserHistory = history.find((h) => h.agentName === LOSER_AGENT)

    expect(winnerHistory?.rank).toBe(1)
    expect(loserHistory?.rank).toBe(2)
  })

  it('should handle DNF agents correctly (< 2 commits excluded from ratings)', async () => {
    // Create issue
    const [issue] = await db
      .insert(issues)
      .values({
        linearId: 'test-issue-2',
        linearKey: 'TEST-2',
        title: 'DNF Test',
        url: 'https://linear.app/test/TEST-2',
        status: 'in_progress',
        arenaReadyLabeledAt: new Date(),
      })
      .returning()

    if (!issue) throw new Error('Failed to create issue')

    // Create agents
    await db.insert(issueAgents).values([
      {
        issueId: issue.id,
        agentName: WINNER,
        status: 'submitted',
        triggeredAt: new Date(),
      },
      {
        issueId: issue.id,
        agentName: DNF_AGENT,
        status: 'submitted',
        triggeredAt: new Date(),
      },
    ])

    // Create attempts: winner merged, DNF closed with 1 commit
    await db.insert(attempts).values([
      {
        issueId: issue.id,
        agentName: WINNER,
        prNumber: 1,
        repo: TEST_REPO,
        prUrl: `https://github.com/${TEST_REPO}/pull/1`,
        status: 'merged',
        mergedAt: new Date(),
        openedAt: new Date(),
        commitCount: 10,
      },
      {
        issueId: issue.id,
        agentName: DNF_AGENT,
        prNumber: 2,
        repo: TEST_REPO,
        prUrl: `https://github.com/${TEST_REPO}/pull/2`,
        status: 'closed',
        closedAt: new Date(),
        openedAt: new Date(),
        commitCount: 1, // DNF threshold
      },
    ])

    // Trigger updateWinner
    const { updateWinner } = await import('@/app/api/linear/webhook/route')
    await updateWinner(issue.id)

    // VERIFY: Only winner gets rating (DNF excluded)
    const scores = await db.select().from(agentScores)

    expect(scores).toHaveLength(1)
    if (!scores[0]) throw new Error('No scores found')
    expect(scores[0].agentName).toBe(WINNER)

    // VERIFY: DNF agent still marked as rejected (not ignored)
    const agents = await db
      .select()
      .from(issueAgents)
      .where(eq(issueAgents.issueId, issue.id))

    const dnfAgent = agents.find((a) => a.agentName === DNF_AGENT)
    expect(dnfAgent?.status).toBe('rejected')
  })
})
