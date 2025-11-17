/**
 * Integration tests for updateWinner function.
 * Tests race condition handling, idempotency, and correct winner selection.
 */

import { eq } from 'drizzle-orm'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { db } from '@/db/client'
import { issues, issueAgents, attempts } from '@/db/schema'

import { updateWinner } from './update-winner'

/**
 * Check if we're using a real database for integration tests.
 * Skip these tests if we're using the dummy test URL.
 */
const isRealDatabase = process.env['IS_TEST_DB_URL'] !== 'true'
const SKIP_MESSAGE = 'Skipping: dummy database'

describe('updateWinner', () => {
  let testIssueId: string

  beforeEach(async () => {
    if (!isRealDatabase) return

    // Create test issue
    const issue = await db
      .insert(issues)
      .values({
        linearId: 'TEST-RACE',
        linearKey: 'TEST-RACE',
        title: 'Race Condition Test',
        url: 'https://linear.app/test/TEST-RACE',
        status: 'in_progress',
      })
      .returning()

    const issueId = issue[0]?.id

    if (!issueId) {
      throw new Error('Failed to create test issue')
    }

    testIssueId = issueId

    // Create 2 agents
    await db.insert(issueAgents).values([
      { issueId: testIssueId, agentName: 'agent1', status: 'submitted' },
      { issueId: testIssueId, agentName: 'agent2', status: 'submitted' },
    ])

    // Both agents have merged PRs (race condition scenario)
    await db.insert(attempts).values([
      {
        issueId: testIssueId,
        agentName: 'agent1',
        prNumber: 1,
        repo: 'owner/repo',
        prUrl: 'https://github.com/owner/repo/pull/1',
        status: 'merged',
        openedAt: new Date('2024-01-01T10:00:00Z'),
        mergedAt: new Date('2024-01-01T11:00:00Z'),
        commitCount: 5,
      },
      {
        issueId: testIssueId,
        agentName: 'agent2',
        prNumber: 2,
        repo: 'owner/repo',
        prUrl: 'https://github.com/owner/repo/pull/2',
        status: 'merged',
        openedAt: new Date('2024-01-01T10:05:00Z'),
        mergedAt: new Date('2024-01-01T11:01:00Z'), // Merged 1 minute later
        commitCount: 5,
      },
    ])
  })

  afterEach(async () => {
    if (!isRealDatabase) return

    // Clean up
    await db.delete(attempts).where(eq(attempts.issueId, testIssueId))
    await db.delete(issueAgents).where(eq(issueAgents.issueId, testIssueId))
    await db.delete(issues).where(eq(issues.id, testIssueId))
  })

  it('should handle concurrent updateWinner calls with row locking', async () => {
    if (!isRealDatabase) {
      console.log(SKIP_MESSAGE)
      return
    }

    // Simulate race condition: two webhooks arrive simultaneously
    const [result1, result2] = await Promise.all([
      updateWinner(testIssueId),
      updateWinner(testIssueId),
    ])

    // Both should succeed (idempotent)
    expect(result1).toBeUndefined() // updateWinner returns void
    expect(result2).toBeUndefined()

    // Check final state
    const issue = await db
      .select()
      .from(issues)
      .where(eq(issues.id, testIssueId))

    const winnerAttemptId = issue[0]?.winnerAttemptId

    expect(winnerAttemptId).toBeDefined()

    // Only ONE winner should be set
    const agents = await db
      .select()
      .from(issueAgents)
      .where(eq(issueAgents.issueId, testIssueId))
    const acceptedAgents = agents.filter((a) => a.status === 'accepted')
    const rejectedAgents = agents.filter((a) => a.status === 'rejected')

    expect(acceptedAgents).toHaveLength(1)
    expect(rejectedAgents).toHaveLength(1)

    // Winner should be agent1 (merged first)
    const winnerAgent = acceptedAgents[0]
    if (!winnerAgent) {
      throw new Error('No accepted agent found')
    }
    expect(winnerAgent.agentName).toBe('agent1')
  })

  it('should be idempotent - second call does nothing', async () => {
    if (!isRealDatabase) {
      console.log(SKIP_MESSAGE)
      return
    }

    // First call
    await updateWinner(testIssueId)

    const firstIssue = await db
      .select()
      .from(issues)
      .where(eq(issues.id, testIssueId))
    const firstWinnerId = firstIssue[0]?.winnerAttemptId

    // Second call
    await updateWinner(testIssueId)

    const secondIssue = await db
      .select()
      .from(issues)
      .where(eq(issues.id, testIssueId))

    // Winner should not change
    const secondWinnerId = secondIssue[0]?.winnerAttemptId
    expect(secondWinnerId).toBe(firstWinnerId)

    // Agents status should not change
    const agents = await db
      .select()
      .from(issueAgents)
      .where(eq(issueAgents.issueId, testIssueId))
    expect(agents.filter((a) => a.status === 'accepted')).toHaveLength(1)
    expect(agents.filter((a) => a.status === 'rejected')).toHaveLength(1)
  })

  it('should select earliest merged PR as winner when multiple PRs merged', async () => {
    if (!isRealDatabase) {
      console.log(SKIP_MESSAGE)
      return
    }

    await updateWinner(testIssueId)

    const issue = await db
      .select()
      .from(issues)
      .where(eq(issues.id, testIssueId))

    const winnerAttemptId = issue[0]?.winnerAttemptId

    if (!winnerAttemptId) {
      throw new Error('Winner attempt ID not set')
    }

    const winnerAttempt = await db
      .select()
      .from(attempts)
      .where(eq(attempts.id, winnerAttemptId))

    const winner = winnerAttempt[0]

    if (!winner) {
      throw new Error('Winner attempt not found')
    }

    // agent1 merged first (11:00 vs 11:01)
    expect(winner.agentName).toBe('agent1')
    expect(winner.prNumber).toBe(1)
  })
})
