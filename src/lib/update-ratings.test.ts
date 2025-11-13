import { eq } from 'drizzle-orm'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'

import { db } from '@/db/client'
import { issues, attempts, agentScores, agentScoreHistory } from '@/db/schema'

import { updateRatingsForIssue } from './update-ratings'

describe.skipIf(
  !process.env['DATABASE_URL'] || process.env['IS_TEST_DB_URL'] === 'true'
)('updateRatingsForIssue', () => {
  const testPrefix = 'test-ratings-' + Date.now()
  const TEST_REPO = 'test/repo'

  afterAll(async () => {
    // Clean up all test data
    await db.delete(agentScoreHistory)
    await db.delete(attempts)
    await db.delete(issues).where(eq(issues.linearId, testPrefix + '-1'))
    await db.delete(issues).where(eq(issues.linearId, testPrefix + '-2'))
    await db.delete(issues).where(eq(issues.linearId, testPrefix + '-3'))
  })
  beforeEach(async () => {
    // Clean test data
    await db.delete(agentScoreHistory)
    await db.delete(attempts)

    // Reset agent scores to defaults
    await db.delete(agentScores)
    await db.insert(agentScores).values([
      { agentName: 'cursor', mu: 25, sigma: 8.333, ordinal: 0, gamesPlayed: 0 },
      { agentName: 'engine', mu: 25, sigma: 8.333, ordinal: 0, gamesPlayed: 0 },
      { agentName: 'cyrus', mu: 25, sigma: 8.333, ordinal: 0, gamesPlayed: 0 },
    ])
  })

  it('should update ratings for completed issue with merged PR', async () => {
    // Create test issue
    const [issue] = await db
      .insert(issues)
      .values({
        linearId: testPrefix + '-1',
        linearKey: 'TEST-1',
        title: 'Test Issue',
        url: 'https://linear.app/test/1',
        status: 'Done',
        arenaReadyLabeledAt: new Date(),
      })
      .returning()

    // Create attempts: cursor wins, engine loses, cyrus DNF
    if (!issue) return
    await db.insert(attempts).values([
      {
        issueId: issue.id,
        agentName: 'cursor',
        repo: TEST_REPO,
        prNumber: 1,
        prUrl: 'https://github.com/test/repo/pull/1',
        openedAt: new Date(),
        mergedAt: new Date(), // Winner
        status: 'merged',
        commitCount: 5,
      },
      {
        issueId: issue.id,
        agentName: 'engine',
        repo: TEST_REPO,
        prNumber: 2,
        prUrl: 'https://github.com/test/repo/pull/2',
        openedAt: new Date(),
        closedAt: new Date(), // Finished but lost
        status: 'closed',
        commitCount: 3,
      },
      {
        issueId: issue.id,
        agentName: 'cyrus',
        repo: TEST_REPO,
        prNumber: 3,
        prUrl: 'https://github.com/test/repo/pull/3',
        openedAt: new Date(),
        closedAt: new Date(), // DNF
        status: 'closed',
        commitCount: 1,
      },
    ])

    await updateRatingsForIssue(issue.id)

    // Verify agent_scores updated
    const scores = await db.select().from(agentScores)
    const cursorScore = scores.find((s) => s.agentName === 'cursor')
    const engineScore = scores.find((s) => s.agentName === 'engine')
    const cyrusScore = scores.find((s) => s.agentName === 'cyrus')

    // Winner should have higher mu
    if (cursorScore) {
      expect(cursorScore.mu).toBeGreaterThan(25)
      expect(cursorScore.gamesPlayed).toBe(1)
    }

    // Loser should have lower mu
    if (engineScore) {
      expect(engineScore.mu).toBeLessThan(25)
      expect(engineScore.gamesPlayed).toBe(1)
    }

    // DNF should not change (no merged or valid attempt)
    if (cyrusScore) {
      expect(cyrusScore.mu).toBe(25)
      expect(cyrusScore.gamesPlayed).toBe(0)
    }

    // Verify history entries created
    const history = await db.select().from(agentScoreHistory)
    expect(history).toHaveLength(2) // Only cursor and engine (not cyrus)

    const cursorHistory = history.find((h) => h.agentName === 'cursor')
    if (cursorHistory) {
      expect(cursorHistory.rank).toBe(1) // Winner
    }

    const engineHistory = history.find((h) => h.agentName === 'engine')
    if (engineHistory) {
      expect(engineHistory.rank).toBe(2) // Second place
    }
  })

  it('should not update ratings if no attempts', async () => {
    const [issue] = await db
      .insert(issues)
      .values({
        linearId: testPrefix + '-2',
        linearKey: 'TEST-2',
        title: 'Test Issue No Attempts',
        url: 'https://linear.app/test/2',
        status: 'Done',
        arenaReadyLabeledAt: new Date(),
      })
      .returning()

    if (!issue) return
    await updateRatingsForIssue(issue.id)

    // No attempts = no rating changes
    const scores = await db.select().from(agentScores)
    const cursorScore = scores.find((s) => s.agentName === 'cursor')
    if (cursorScore) {
      expect(cursorScore.mu).toBe(25) // Unchanged
      expect(cursorScore.gamesPlayed).toBe(0)
    }
  })

  it('should handle issue with only one agent', async () => {
    const [issue] = await db
      .insert(issues)
      .values({
        linearId: testPrefix + '-3',
        linearKey: 'TEST-3',
        title: 'Test Issue Single Agent',
        url: 'https://linear.app/test/3',
        status: 'Done',
        arenaReadyLabeledAt: new Date(),
      })
      .returning()

    if (!issue) return
    await db.insert(attempts).values({
      issueId: issue.id,
      agentName: 'cursor',
      repo: TEST_REPO,
      prNumber: 10,
      prUrl: 'https://github.com/test/repo/pull/10',
      openedAt: new Date(),
      mergedAt: new Date(),
      status: 'merged',
      commitCount: 5,
    })

    await updateRatingsForIssue(issue.id)

    // Single agent: rating should update but not dramatically
    const scores = await db.select().from(agentScores)
    const cursorScore = scores.find((s) => s.agentName === 'cursor')
    if (cursorScore) {
      expect(cursorScore.gamesPlayed).toBe(1)
      expect(cursorScore.mu).toBeGreaterThan(24) // Small increase
    }
  })
})
