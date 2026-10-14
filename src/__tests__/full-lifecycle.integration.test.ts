/**
 * Full E2E lifecycle integration test
 *
 * Tests complete flow: Linear sync → PR attributes → GitHub webhook → winner selection → ratings
 * Uses mocked Linear API responses but real database operations.
 *
 * This test verifies the integration between all major systems:
 * 1. Linear sync extracts agents and PRs from comments
 * 2. GitHub webhook updates PR status
 * 3. Winner selection logic chooses correct winner
 * 4. Ratings are calculated correctly
 */

import { LinearClient } from '@linear/sdk'
import { eq } from 'drizzle-orm'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/db/client'
import {
  agents as registeredAgents,
  agentScoreHistory,
  agentScores,
  attempts,
  issueAgents,
  issues,
} from '@/db/schema'
import { syncIssueFromLinear } from '@/lib/linear-sync'
import { updateRatingsForIssue } from '@/lib/update-ratings'
import { updateWinner } from '@/lib/update-winner'

// Mock Linear SDK
vi.mock('@linear/sdk', () => ({
  LinearClient: vi.fn(),
}))

// Mock agent-dispatch to avoid complex query mocking
vi.mock('@/lib/agent-dispatch', () => ({
  dispatchMissingAgents: vi.fn().mockResolvedValue(0),
}))

/**
 * Check if we're using a real database for integration tests.
 * Skip these tests if we're using the dummy test URL.
 */
const isRealDatabase = process.env['IS_TEST_DB_URL'] !== 'true'

describe.skipIf(!isRealDatabase)('Full E2E Lifecycle Integration', () => {
  const TEST_ISSUE_LINEAR_ID = 'e2e-test-linear-123'
  const TEST_ISSUE_KEY = 'E2E-123'
  const TEST_REPO = 'owner/repo'
  const TIMESTAMP_9AM = '2024-01-01T09:00:00Z'
  const TIMESTAMP_10AM = '2024-01-01T10:00:00Z'
  const TIMESTAMP_11AM = '2024-01-01T11:00:00Z'

  afterEach(() => vi.unstubAllEnvs())

  beforeEach(async () => {
    vi.stubEnv('LINEAR_API_KEY', 'test-sdk-credential')
    await db.delete(registeredAgents)
    await db.insert(registeredAgents).values([
      {
        name: 'cursor',
        slug: 'cursor',
        displayName: 'Cursor',
        linearUserId: 'e2e-cursor',
        isEnabled: true,
        isActive: true,
      },
      {
        name: 'engine',
        slug: 'engine',
        displayName: 'Engine',
        linearUserId: 'e2e-engine',
        isEnabled: true,
        isActive: true,
      },
    ])
    // Clean up test data for main E2E test
    const existingIssue = await db
      .select()
      .from(issues)
      .where(eq(issues.linearKey, TEST_ISSUE_KEY))
      .limit(1)

    if (existingIssue[0]) {
      const issueId = existingIssue[0].id
      await db.delete(attempts).where(eq(attempts.issueId, issueId))
      await db.delete(issueAgents).where(eq(issueAgents.issueId, issueId))
      await db
        .delete(agentScoreHistory)
        .where(eq(agentScoreHistory.issueId, issueId))
      await db.delete(issues).where(eq(issues.id, issueId))
    }

    // Clean up test data for idempotency test
    const existingIdempotentIssue = await db
      .select()
      .from(issues)
      .where(eq(issues.linearKey, 'IDEM-1'))
      .limit(1)

    if (existingIdempotentIssue[0]) {
      const issueId = existingIdempotentIssue[0].id
      await db.delete(attempts).where(eq(attempts.issueId, issueId))
      await db.delete(issueAgents).where(eq(issueAgents.issueId, issueId))
      await db
        .delete(agentScoreHistory)
        .where(eq(agentScoreHistory.issueId, issueId))
      await db.delete(issues).where(eq(issues.id, issueId))
    }

    // Clean up test agent scores
    await db.delete(agentScores).where(eq(agentScores.agentName, 'cursor'))
    await db.delete(agentScores).where(eq(agentScores.agentName, 'engine'))

    vi.clearAllMocks()
  })

  it('should handle full lifecycle: Linear sync → PR merge → winner selection → rating update', async () => {
    // ========================================
    // STEP 1: Set up Linear API mock response
    // ========================================
    const mockComments = {
      nodes: [
        {
          id: 'comment-1',
          body: '@cursor please work on this',
          createdAt: new Date(TIMESTAMP_9AM),
          parent: Promise.resolve(null),
        },
        {
          id: 'comment-2',
          body: 'Done! https://github.com/owner/repo/pull/100',
          createdAt: new Date(TIMESTAMP_10AM),
          parent: Promise.resolve({ id: 'comment-1' }),
        },
        {
          id: 'comment-3',
          body: '@engine also working on this',
          createdAt: new Date('2024-01-01T09:30:00Z'),
          parent: Promise.resolve(null),
        },
        {
          id: 'comment-4',
          body: 'Here: https://github.com/owner/repo/pull/101',
          createdAt: new Date(TIMESTAMP_11AM),
          parent: Promise.resolve({ id: 'comment-3' }),
        },
      ],
      pageInfo: { hasNextPage: false },
    }

    const mockIssue = {
      id: TEST_ISSUE_LINEAR_ID,
      identifier: TEST_ISSUE_KEY,
      title: 'E2E Test Issue',
      description: 'Test description',
      url: `https://linear.app/test/${TEST_ISSUE_KEY}`,
      estimate: null,
      priority: null,
      dueDate: null,
      createdAt: new Date('2024-01-01T08:00:00Z'),
      updatedAt: new Date('2024-01-01T12:00:00Z'),
      comments: vi.fn().mockResolvedValue(mockComments),
      attachments: vi.fn().mockResolvedValue({ nodes: [] }),
      labels: vi.fn().mockResolvedValue({ nodes: [] }),
      assignee: Promise.resolve(null),
      creator: Promise.resolve(null),
      project: Promise.resolve(null),
      cycle: Promise.resolve(null),
      parent: Promise.resolve(null),
      team: Promise.resolve({
        id: 'team-1',
        key: 'TEST',
        name: 'Test Team',
      }),
      state: Promise.resolve({
        id: 'state-1',
        name: 'In Progress',
        type: 'started',
      }),
    }

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(function () {
      return mockClient as never
    })

    // Create issue in database first (syncIssueFromLinear expects it to exist)
    const [createdIssue] = await db
      .insert(issues)
      .values({
        linearId: TEST_ISSUE_LINEAR_ID,
        linearKey: TEST_ISSUE_KEY,
        title: 'E2E Test Issue',
        url: `https://linear.app/test/${TEST_ISSUE_KEY}`,
        status: 'in_progress',
      })
      .returning()

    if (!createdIssue) {
      throw new Error('Failed to create test issue')
    }

    // ========================================
    // STEP 2: Sync from Linear
    // ========================================
    await syncIssueFromLinear(TEST_ISSUE_LINEAR_ID)

    // Verify issue and agents created
    const issue = await db
      .select()
      .from(issues)
      .where(eq(issues.linearKey, TEST_ISSUE_KEY))
      .limit(1)

    expect(issue).toHaveLength(1)
    if (!issue[0]) throw new Error('Issue not found')
    expect(issue[0].linearKey).toBe(TEST_ISSUE_KEY)

    const agents = await db
      .select()
      .from(issueAgents)
      .where(eq(issueAgents.issueId, createdIssue.id))

    expect(agents).toHaveLength(2)
    const agentNames = agents.map((a) => a.agentName).sort()
    expect(agentNames).toEqual(['cursor', 'engine'])

    // Verify both agents have 'submitted' status (PRs were posted)
    expect(agents.every((a) => a.status === 'submitted')).toBe(true)

    const issueAttempts = await db
      .select()
      .from(attempts)
      .where(eq(attempts.issueId, createdIssue.id))

    expect(issueAttempts).toHaveLength(2)
    const prNumbers = issueAttempts.map((a) => a.prNumber).sort()
    expect(prNumbers).toEqual([100, 101])

    // Verify PR attribution
    const cursorAttempt = issueAttempts.find((a) => a.prNumber === 100)
    const engineAttempt = issueAttempts.find((a) => a.prNumber === 101)
    if (!cursorAttempt) throw new Error('Cursor attempt not found')
    if (!engineAttempt) throw new Error('Engine attempt not found')
    expect(cursorAttempt.agentName).toBe('cursor')
    expect(engineAttempt.agentName).toBe('engine')

    // ========================================
    // STEP 3: Simulate GitHub webhook - cursor's PR merges
    // ========================================
    await db
      .update(attempts)
      .set({
        status: 'merged',
        mergedAt: new Date('2024-01-01T12:00:00Z'),
        commitCount: 5,
      })
      .where(eq(attempts.prNumber, 100))

    // ========================================
    // STEP 4: Winner selection
    // ========================================
    await updateWinner(createdIssue.id)

    // Verify winner is cursor
    const updatedIssue = await db
      .select()
      .from(issues)
      .where(eq(issues.id, createdIssue.id))
      .limit(1)

    if (!updatedIssue[0]) throw new Error('Updated issue not found')
    expect(updatedIssue[0].winnerAttemptId).toBeDefined()
    if (!updatedIssue[0].winnerAttemptId)
      throw new Error('Winner attempt ID not set')

    const winnerAttempt = await db
      .select()
      .from(attempts)
      .where(eq(attempts.id, updatedIssue[0].winnerAttemptId))
      .limit(1)

    if (!winnerAttempt[0]) throw new Error('Winner attempt not found')
    expect(winnerAttempt[0].agentName).toBe('cursor')
    expect(winnerAttempt[0].prNumber).toBe(100)

    // Verify engine's PR closed
    const engineAttemptAfter = await db
      .select()
      .from(attempts)
      .where(eq(attempts.prNumber, 101))
      .limit(1)

    if (!engineAttemptAfter[0]) throw new Error('Engine attempt not found')
    expect(engineAttemptAfter[0].status).toBe('closed')

    // Verify agent statuses
    const updatedAgents = await db
      .select()
      .from(issueAgents)
      .where(eq(issueAgents.issueId, createdIssue.id))

    const cursorAgent = updatedAgents.find((a) => a.agentName === 'cursor')
    const engineAgent = updatedAgents.find((a) => a.agentName === 'engine')

    if (!cursorAgent) throw new Error('Cursor agent not found')
    if (!engineAgent) throw new Error('Engine agent not found')
    expect(cursorAgent.status).toBe('accepted')
    expect(engineAgent.status).toBe('rejected')

    // ========================================
    // STEP 5: Rating update
    // ========================================
    await updateRatingsForIssue(createdIssue.id)

    // Verify ratings calculated
    const cursorRating = await db
      .select()
      .from(agentScores)
      .where(eq(agentScores.agentName, 'cursor'))
      .limit(1)

    const engineRating = await db
      .select()
      .from(agentScores)
      .where(eq(agentScores.agentName, 'engine'))
      .limit(1)

    expect(cursorRating).toHaveLength(1)
    expect(engineRating).toHaveLength(1)

    if (!cursorRating[0]) throw new Error('Cursor rating not found')
    if (!engineRating[0]) throw new Error('Engine rating not found')

    // Winner should have higher rating (above initial 25)
    expect(cursorRating[0].mu).toBeGreaterThan(25)
    // Loser should have lower rating (below initial 25)
    expect(engineRating[0].mu).toBeLessThan(25)

    // Verify both agents have ordinal calculated
    expect(cursorRating[0].ordinal).toBeGreaterThan(1500)
    expect(engineRating[0].ordinal).toBeLessThan(1500)

    // Verify games played incremented
    expect(cursorRating[0].gamesPlayed).toBe(1)
    expect(engineRating[0].gamesPlayed).toBe(1)

    // Verify history entries
    const history = await db
      .select()
      .from(agentScoreHistory)
      .where(eq(agentScoreHistory.issueId, createdIssue.id))

    expect(history).toHaveLength(2)

    const cursorHistory = history.find((h) => h.agentName === 'cursor')
    const engineHistory = history.find((h) => h.agentName === 'engine')

    if (!cursorHistory) throw new Error('Cursor history not found')
    if (!engineHistory) throw new Error('Engine history not found')

    expect(cursorHistory.rank).toBe(1)
    expect(engineHistory.rank).toBe(2)

    // Verify history captures mu/sigma at time of completion
    expect(cursorHistory.mu).toBe(cursorRating[0].mu)
    expect(cursorHistory.sigma).toBe(cursorRating[0].sigma)
    expect(engineHistory.mu).toBe(engineRating[0].mu)
    expect(engineHistory.sigma).toBe(engineRating[0].sigma)
  })

  it('should handle idempotency - running updateWinner and updateRatingsForIssue twice does not corrupt data', async () => {
    // Create issue with attempts
    const [issue] = await db
      .insert(issues)
      .values({
        linearId: 'idempotent-test-linear',
        linearKey: 'IDEM-1',
        title: 'Idempotency Test',
        url: 'https://linear.app/test/IDEM-1',
        status: 'in_progress',
      })
      .returning()

    if (!issue) {
      throw new Error('Failed to create test issue')
    }

    await db.insert(issueAgents).values([
      { issueId: issue.id, agentName: 'cursor', status: 'submitted' },
      { issueId: issue.id, agentName: 'engine', status: 'submitted' },
    ])

    await db.insert(attempts).values([
      {
        issueId: issue.id,
        agentName: 'cursor',
        prNumber: 200,
        repo: TEST_REPO,
        prUrl: `https://github.com/${TEST_REPO}/pull/200`,
        status: 'merged',
        openedAt: new Date(TIMESTAMP_10AM),
        mergedAt: new Date(TIMESTAMP_11AM),
        commitCount: 5,
      },
      {
        issueId: issue.id,
        agentName: 'engine',
        prNumber: 201,
        repo: TEST_REPO,
        prUrl: `https://github.com/${TEST_REPO}/pull/201`,
        status: 'open',
        openedAt: new Date(TIMESTAMP_10AM),
        commitCount: 3,
      },
    ])

    // First call - should update everything
    await updateWinner(issue.id)

    const firstWinner = await db
      .select()
      .from(issues)
      .where(eq(issues.id, issue.id))
      .limit(1)

    const firstHistory = await db
      .select()
      .from(agentScoreHistory)
      .where(eq(agentScoreHistory.issueId, issue.id))

    const firstCursorScore = await db
      .select()
      .from(agentScores)
      .where(eq(agentScores.agentName, 'cursor'))
      .limit(1)

    if (!firstWinner[0]) throw new Error('First winner not found')
    if (!firstCursorScore[0]) throw new Error('First cursor score not found')

    expect(firstWinner[0].winnerAttemptId).toBeDefined()
    expect(firstHistory).toHaveLength(2)
    expect(firstCursorScore[0].gamesPlayed).toBe(1)

    // Second call - should be idempotent
    await updateWinner(issue.id)
    await updateRatingsForIssue(issue.id)

    const secondWinner = await db
      .select()
      .from(issues)
      .where(eq(issues.id, issue.id))
      .limit(1)

    const secondHistory = await db
      .select()
      .from(agentScoreHistory)
      .where(eq(agentScoreHistory.issueId, issue.id))

    const secondCursorScore = await db
      .select()
      .from(agentScores)
      .where(eq(agentScores.agentName, 'cursor'))
      .limit(1)

    if (!secondWinner[0]) throw new Error('Second winner not found')
    if (!secondCursorScore[0]) throw new Error('Second cursor score not found')

    // Winner should not change
    expect(secondWinner[0].winnerAttemptId).toBe(firstWinner[0].winnerAttemptId)

    // History should not duplicate
    expect(secondHistory).toHaveLength(2)

    // Games played should not double-increment
    expect(secondCursorScore[0].gamesPlayed).toBe(1)

    // Cleanup
    await db.delete(attempts).where(eq(attempts.issueId, issue.id))
    await db.delete(issueAgents).where(eq(issueAgents.issueId, issue.id))
    await db
      .delete(agentScoreHistory)
      .where(eq(agentScoreHistory.issueId, issue.id))
    await db.delete(issues).where(eq(issues.id, issue.id))
  })
})
