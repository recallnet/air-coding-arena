import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockDeep, mockReset } from 'vitest-mock-extended'

import { db } from '@/db/client'

import * as openskillModule from './openskill'
import { updateRatingsForIssue } from './update-ratings'

// Mock the db client
vi.mock('@/db/client', () => ({
  db: mockDeep(),
}))

// Get typed mock
const mockDb = vi.mocked(db)

// Test constants
const MOCK_STATUS_DONE = 'Done'
const MOCK_STATUS_MERGED = 'merged'
const MOCK_STATUS_CLOSED = 'closed'
const MOCK_STATUS_OPEN = 'open'
const MOCK_LINEAR_KEY = 'TEST-1'
const MOCK_REPO = 'test/repo'
const MOCK_BASE_TIME = '2024-01-01T10:00:00Z'
const MOCK_ISSUE_ID = 'issue-1'
const MOCK_AGENT_CURSOR = 'cursor'
const MOCK_AGENT_ENGINE = 'engine'
const MOCK_AGENT_CYRUS = 'cyrus'
const MOCK_PR_BASE_URL = 'https://github.com/test/repo/pull'
const MOCK_FIX_BASE_BRANCH = 'fix/test'
const MOCK_TIME_BASE = '2024-01-01T1'
const MOCK_FIX_TEST_BRANCH = MOCK_FIX_BASE_BRANCH
const MOCK_PR_URL_1 = `${MOCK_PR_BASE_URL}/1`
const MOCK_PR_URL_2 = `${MOCK_PR_BASE_URL}/2`
const MOCK_PR_URL_3 = `${MOCK_PR_BASE_URL}/3`
const MOCK_COMMIT_SHA_ABC123 = 'abc123'
const MOCK_COMMIT_SHA_DEF456 = 'def456'
const MOCK_FIX_TEST_2_BRANCH = `${MOCK_FIX_BASE_BRANCH}-2`
const MOCK_FIX_TEST_3_BRANCH = `${MOCK_FIX_BASE_BRANCH}-3`
const MOCK_MERGED_TIME = `${MOCK_TIME_BASE}1:00:00Z`
const MOCK_CLOSED_TIME = `${MOCK_TIME_BASE}2:00:00Z`
const MOCK_CLOSED_TIME_2 = `${MOCK_TIME_BASE}3:00:00Z`

describe('updateRatingsForIssue - Unit Tests', () => {
  beforeEach(() => {
    mockReset(mockDb)
    vi.clearAllMocks()

    // Spy on openskill functions with default implementations
    vi.spyOn(
      openskillModule,
      'updateRatingsForCompletedIssue'
    ).mockImplementation((currentRatings, ranking) => {
      // Mock implementation: winners get higher mu, losers get lower mu
      const result: Record<string, { mu: number; sigma: number }> = {}
      for (const [index, agentName] of ranking.entries()) {
        const currentRating = currentRatings[agentName]
        if (currentRating) {
          // Winner gets +2 mu, losers get -2 mu / rank
          const muChange = index === 0 ? 2 : -2 / (index + 1)
          result[agentName] = {
            mu: currentRating.mu + muChange,
            sigma: currentRating.sigma - 0.5, // Reduce uncertainty
          }
        }
      }
      return result
    })

    vi.spyOn(openskillModule, 'calculateOrdinal').mockImplementation(
      (rating) => {
        return 1500 + (rating.mu - 3 * rating.sigma)
      }
    )

    vi.spyOn(openskillModule, 'initializeAgentRating').mockReturnValue({
      mu: 25,
      sigma: 8.333,
    })
  })

  const createMockIssue = () => ({
    id: MOCK_ISSUE_ID,
    linearId: 'linear-1',
    linearKey: MOCK_LINEAR_KEY,
    title: 'Test Issue',
    url: 'https://linear.app/1',
    repo: null,
    status: MOCK_STATUS_DONE,
    description: null,
    descriptionMarkdown: null,
    estimate: null,
    priority: null,
    labelsJson: null,
    assigneeId: null,
    assigneeName: null,
    assigneeEmail: null,
    creatorId: null,
    creatorName: null,
    creatorEmail: null,
    projectId: null,
    projectName: null,
    cycleId: null,
    cycleName: null,
    cycleNumber: null,
    dueDate: null,
    linearCreatedAt: null,
    linearUpdatedAt: null,
    parentId: null,
    arenaReadyLabeledAt: new Date(),
    winnerAttemptId: null,
    createdAt: new Date(),
  })

  const createMockScore = (agentName: string) => ({
    id: `score-${agentName}`,
    agentName,
    mu: 25,
    sigma: 8.333,
    ordinal: 1500,
    gamesPlayed: 0,
    lastUpdatedAt: new Date(),
    createdAt: new Date(),
  })

  it('should throw error for missing issue', async () => {
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    }

    mockDb.select.mockReturnValue(mockSelect as never)

    await expect(updateRatingsForIssue('nonexistent-issue-id')).rejects.toThrow(
      'Issue nonexistent-issue-id not found'
    )
  })

  it('should handle issue with no attempts', async () => {
    const consoleSpy = vi.spyOn(globalThis.console, 'log')
    const mockIssue = createMockIssue()

    const mockIssueSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockIssue]),
    }

    const mockAttemptsSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    }

    mockDb.select
      .mockReturnValueOnce(mockIssueSelect as never)
      .mockReturnValueOnce(mockAttemptsSelect as never)

    await updateRatingsForIssue(MOCK_ISSUE_ID)

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(`No attempts for issue ${MOCK_LINEAR_KEY}`)
    )

    consoleSpy.mockRestore()
  })

  it('should handle all DNF attempts (no finishers)', async () => {
    const consoleSpy = vi.spyOn(globalThis.console, 'log')
    const mockIssue = createMockIssue()
    const baseTime = new Date(MOCK_BASE_TIME)
    const shortCloseTime = new Date('2024-01-01T10:02:00Z') // 2 minutes

    const mockAttempts = [
      {
        id: 'attempt-1',
        issueId: MOCK_ISSUE_ID,
        agentName: MOCK_AGENT_CURSOR,
        repo: MOCK_REPO,
        prNumber: 1,
        prUrl: MOCK_PR_URL_1,
        branch: MOCK_FIX_TEST_BRANCH,
        openedAt: baseTime,
        mergedAt: null,
        closedAt: shortCloseTime,
        status: MOCK_STATUS_CLOSED,
        commitCount: 1, // DNF: too few commits
        lastCommitSha: MOCK_COMMIT_SHA_ABC123,
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
    ]

    const mockIssueSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockIssue]),
    }

    const mockAttemptsSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockAttempts),
    }

    mockDb.select
      .mockReturnValueOnce(mockIssueSelect as never)
      .mockReturnValueOnce(mockAttemptsSelect as never)

    await updateRatingsForIssue(MOCK_ISSUE_ID)

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(`No finishers for issue ${MOCK_LINEAR_KEY}`)
    )

    consoleSpy.mockRestore()
  })

  it('should update ratings for completed issue with merged PR', async () => {
    const mockIssue = createMockIssue()
    const baseTime = new Date(MOCK_BASE_TIME)
    const mergedTime = new Date(MOCK_MERGED_TIME)
    const closedTime = new Date(MOCK_CLOSED_TIME)

    const mockAttempts = [
      {
        id: 'attempt-1',
        issueId: MOCK_ISSUE_ID,
        agentName: MOCK_AGENT_CURSOR,
        repo: MOCK_REPO,
        prNumber: 1,
        prUrl: MOCK_PR_URL_1,
        branch: MOCK_FIX_TEST_BRANCH,
        openedAt: baseTime,
        mergedAt: mergedTime,
        closedAt: null,
        status: MOCK_STATUS_MERGED,
        commitCount: 5,
        lastCommitSha: MOCK_COMMIT_SHA_ABC123,
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
      {
        id: 'attempt-2',
        issueId: MOCK_ISSUE_ID,
        agentName: MOCK_AGENT_ENGINE,
        repo: MOCK_REPO,
        prNumber: 2,
        prUrl: MOCK_PR_URL_2,
        branch: MOCK_FIX_TEST_2_BRANCH,
        openedAt: baseTime,
        mergedAt: null,
        closedAt: closedTime,
        status: MOCK_STATUS_CLOSED,
        commitCount: 3,
        lastCommitSha: MOCK_COMMIT_SHA_DEF456,
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
    ]

    const mockCurrentScores = [
      createMockScore(MOCK_AGENT_CURSOR),
      createMockScore(MOCK_AGENT_ENGINE),
    ]

    const mockIssueSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockIssue]),
    }

    const mockAttemptsSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockAttempts),
    }

    const mockScoresSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockCurrentScores),
    }

    const mockInsert = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockResolvedValue([]),
    }

    mockDb.select
      .mockReturnValueOnce(mockIssueSelect as never)
      .mockReturnValueOnce(mockAttemptsSelect as never)
      .mockReturnValueOnce(mockScoresSelect as never)

    mockDb.insert.mockReturnValue(mockInsert as never)

    await updateRatingsForIssue(MOCK_ISSUE_ID)

    // Verify insert was called for both agent_scores and history
    expect(mockDb.insert).toHaveBeenCalled()
    expect(mockInsert.values).toHaveBeenCalled()

    // Verify openskill functions were called
    expect(openskillModule.updateRatingsForCompletedIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: expect.objectContaining({ mu: 25, sigma: 8.333 }),
        engine: expect.objectContaining({ mu: 25, sigma: 8.333 }),
      }),
      [MOCK_AGENT_CURSOR, MOCK_AGENT_ENGINE] // Ranking
    )
  })

  it('should detect DNF for low-effort PRs (< 2 commits)', async () => {
    const mockIssue = createMockIssue()
    const baseTime = new Date(MOCK_BASE_TIME)
    const mergedTime = new Date(MOCK_MERGED_TIME)
    const closedTime = new Date(MOCK_CLOSED_TIME)

    const mockAttempts = [
      {
        id: 'attempt-1',
        issueId: MOCK_ISSUE_ID,
        agentName: MOCK_AGENT_CURSOR,
        repo: MOCK_REPO,
        prNumber: 1,
        prUrl: MOCK_PR_URL_1,
        branch: MOCK_FIX_TEST_BRANCH,
        openedAt: baseTime,
        mergedAt: mergedTime,
        closedAt: null,
        status: MOCK_STATUS_MERGED,
        commitCount: 5,
        lastCommitSha: MOCK_COMMIT_SHA_ABC123,
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
      {
        id: 'attempt-2',
        issueId: MOCK_ISSUE_ID,
        agentName: MOCK_AGENT_ENGINE,
        repo: MOCK_REPO,
        prNumber: 2,
        prUrl: MOCK_PR_URL_2,
        branch: MOCK_FIX_TEST_2_BRANCH,
        openedAt: baseTime,
        mergedAt: null,
        closedAt: closedTime,
        status: MOCK_STATUS_CLOSED,
        commitCount: 1, // DNF: too few commits
        lastCommitSha: MOCK_COMMIT_SHA_DEF456,
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
    ]

    const mockCurrentScores = [createMockScore(MOCK_AGENT_CURSOR)]

    const mockIssueSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockIssue]),
    }

    const mockAttemptsSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockAttempts),
    }

    const mockScoresSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockCurrentScores),
    }

    const mockInsert = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockResolvedValue([]),
    }

    mockDb.select
      .mockReturnValueOnce(mockIssueSelect as never)
      .mockReturnValueOnce(mockAttemptsSelect as never)
      .mockReturnValueOnce(mockScoresSelect as never)

    mockDb.insert.mockReturnValue(mockInsert as never)

    await updateRatingsForIssue(MOCK_ISSUE_ID)

    // Only cursor should be updated (engine DNF'd)
    expect(mockDb.insert).toHaveBeenCalled()

    // Verify only cursor was passed to openskill (engine filtered out)
    expect(openskillModule.updateRatingsForCompletedIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: expect.objectContaining({ mu: 25 }),
      }),
      [MOCK_AGENT_CURSOR] // Only cursor, engine DNF'd
    )
  })

  it('should detect DNF for short lifespan PRs (< 5 minutes)', async () => {
    const mockIssue = createMockIssue()
    const baseTime = new Date(MOCK_BASE_TIME)
    const mergedTime = new Date(MOCK_MERGED_TIME)
    const shortCloseTime = new Date('2024-01-01T10:03:00Z') // 3 minutes

    const mockAttempts = [
      {
        id: 'attempt-1',
        issueId: MOCK_ISSUE_ID,
        agentName: MOCK_AGENT_CURSOR,
        repo: MOCK_REPO,
        prNumber: 1,
        prUrl: MOCK_PR_URL_1,
        branch: MOCK_FIX_TEST_BRANCH,
        openedAt: baseTime,
        mergedAt: mergedTime,
        closedAt: null,
        status: MOCK_STATUS_MERGED,
        commitCount: 5,
        lastCommitSha: MOCK_COMMIT_SHA_ABC123,
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
      {
        id: 'attempt-2',
        issueId: MOCK_ISSUE_ID,
        agentName: MOCK_AGENT_CYRUS,
        repo: MOCK_REPO,
        prNumber: 2,
        prUrl: MOCK_PR_URL_2,
        branch: MOCK_FIX_TEST_2_BRANCH,
        openedAt: baseTime,
        mergedAt: null,
        closedAt: shortCloseTime, // DNF: closed within 5 minutes
        status: MOCK_STATUS_CLOSED,
        commitCount: 5, // Even with good commits, short lifespan = DNF
        lastCommitSha: MOCK_COMMIT_SHA_DEF456,
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
    ]

    const mockCurrentScores = [createMockScore(MOCK_AGENT_CURSOR)]

    const mockIssueSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockIssue]),
    }

    const mockAttemptsSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockAttempts),
    }

    const mockScoresSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockCurrentScores),
    }

    const mockInsert = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockResolvedValue([]),
    }

    mockDb.select
      .mockReturnValueOnce(mockIssueSelect as never)
      .mockReturnValueOnce(mockAttemptsSelect as never)
      .mockReturnValueOnce(mockScoresSelect as never)

    mockDb.insert.mockReturnValue(mockInsert as never)

    await updateRatingsForIssue(MOCK_ISSUE_ID)

    // Only cursor should be updated (cyrus DNF'd)
    expect(mockDb.insert).toHaveBeenCalled()

    // Verify only cursor in ranking
    expect(openskillModule.updateRatingsForCompletedIssue).toHaveBeenCalledWith(
      expect.any(Object),
      [MOCK_AGENT_CURSOR] // Only cursor, cyrus DNF'd
    )
  })

  it('should handle multiple agents with proper ranking', async () => {
    const mockIssue = createMockIssue()
    const baseTime = new Date(MOCK_BASE_TIME)
    const mergedTime = new Date(MOCK_MERGED_TIME)
    const closedTime1 = new Date(MOCK_CLOSED_TIME)
    const closedTime2 = new Date(MOCK_CLOSED_TIME_2)

    const mockAttempts = [
      {
        id: 'attempt-1',
        issueId: MOCK_ISSUE_ID,
        agentName: MOCK_AGENT_CURSOR,
        repo: MOCK_REPO,
        prNumber: 1,
        prUrl: MOCK_PR_URL_1,
        branch: MOCK_FIX_TEST_BRANCH,
        openedAt: baseTime,
        mergedAt: mergedTime,
        closedAt: null,
        status: MOCK_STATUS_MERGED,
        commitCount: 5,
        lastCommitSha: MOCK_COMMIT_SHA_ABC123,
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
      {
        id: 'attempt-2',
        issueId: MOCK_ISSUE_ID,
        agentName: MOCK_AGENT_ENGINE,
        repo: MOCK_REPO,
        prNumber: 2,
        prUrl: MOCK_PR_URL_2,
        branch: MOCK_FIX_TEST_2_BRANCH,
        openedAt: baseTime,
        mergedAt: null,
        closedAt: closedTime1,
        status: MOCK_STATUS_CLOSED,
        commitCount: 3,
        lastCommitSha: MOCK_COMMIT_SHA_DEF456,
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
      {
        id: 'attempt-3',
        issueId: MOCK_ISSUE_ID,
        agentName: MOCK_AGENT_CYRUS,
        repo: MOCK_REPO,
        prNumber: 3,
        prUrl: MOCK_PR_URL_3,
        branch: MOCK_FIX_TEST_3_BRANCH,
        openedAt: baseTime,
        mergedAt: null,
        closedAt: closedTime2,
        status: MOCK_STATUS_CLOSED,
        commitCount: 4,
        lastCommitSha: 'ghi789',
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
    ]

    const mockCurrentScores = [
      createMockScore(MOCK_AGENT_CURSOR),
      createMockScore(MOCK_AGENT_ENGINE),
      createMockScore(MOCK_AGENT_CYRUS),
    ]

    const mockIssueSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockIssue]),
    }

    const mockAttemptsSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockAttempts),
    }

    const mockScoresSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockCurrentScores),
    }

    const mockInsert = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockResolvedValue([]),
    }

    mockDb.select
      .mockReturnValueOnce(mockIssueSelect as never)
      .mockReturnValueOnce(mockAttemptsSelect as never)
      .mockReturnValueOnce(mockScoresSelect as never)

    mockDb.insert.mockReturnValue(mockInsert as never)

    await updateRatingsForIssue(MOCK_ISSUE_ID)

    // All three agents should be updated with proper ranking
    expect(mockDb.insert).toHaveBeenCalled()

    // Verify ranking: cursor (merged) first, engine (closed earlier) second, cyrus (closed later) third
    expect(openskillModule.updateRatingsForCompletedIssue).toHaveBeenCalledWith(
      expect.any(Object),
      [MOCK_AGENT_CURSOR, MOCK_AGENT_ENGINE, MOCK_AGENT_CYRUS]
    )
  })

  it('should handle new agent without existing score', async () => {
    const mockIssue = createMockIssue()
    const baseTime = new Date(MOCK_BASE_TIME)
    const mergedTime = new Date(MOCK_MERGED_TIME)
    const closedTime = new Date(MOCK_CLOSED_TIME)

    const mockAttempts = [
      {
        id: 'attempt-1',
        issueId: MOCK_ISSUE_ID,
        agentName: 'newagent', // New agent not in scores
        repo: MOCK_REPO,
        prNumber: 1,
        prUrl: MOCK_PR_URL_1,
        branch: MOCK_FIX_TEST_BRANCH,
        openedAt: baseTime,
        mergedAt: mergedTime,
        closedAt: null,
        status: MOCK_STATUS_MERGED,
        commitCount: 5,
        lastCommitSha: MOCK_COMMIT_SHA_ABC123,
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
      {
        id: 'attempt-2',
        issueId: MOCK_ISSUE_ID,
        agentName: MOCK_AGENT_CURSOR,
        repo: MOCK_REPO,
        prNumber: 2,
        prUrl: MOCK_PR_URL_2,
        branch: MOCK_FIX_TEST_2_BRANCH,
        openedAt: baseTime,
        mergedAt: null,
        closedAt: closedTime,
        status: MOCK_STATUS_CLOSED,
        commitCount: 3,
        lastCommitSha: MOCK_COMMIT_SHA_DEF456,
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
    ]

    const mockCurrentScores = [
      createMockScore(MOCK_AGENT_CURSOR),
      // newagent not in scores - will use default
    ]

    const mockIssueSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockIssue]),
    }

    const mockAttemptsSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockAttempts),
    }

    const mockScoresSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockCurrentScores),
    }

    const mockInsert = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockResolvedValue([]),
    }

    mockDb.select
      .mockReturnValueOnce(mockIssueSelect as never)
      .mockReturnValueOnce(mockAttemptsSelect as never)
      .mockReturnValueOnce(mockScoresSelect as never)

    mockDb.insert.mockReturnValue(mockInsert as never)

    await updateRatingsForIssue(MOCK_ISSUE_ID)

    // Both agents should be updated (newagent uses default rating)
    expect(mockDb.insert).toHaveBeenCalled()

    // Verify initializeAgentRating was called for newagent
    expect(openskillModule.initializeAgentRating).toHaveBeenCalled()
  })

  it('should handle single agent (no competition)', async () => {
    const mockIssue = createMockIssue()
    const baseTime = new Date(MOCK_BASE_TIME)
    const mergedTime = new Date(MOCK_MERGED_TIME)

    const mockAttempts = [
      {
        id: 'attempt-1',
        issueId: MOCK_ISSUE_ID,
        agentName: MOCK_AGENT_CURSOR,
        repo: MOCK_REPO,
        prNumber: 1,
        prUrl: MOCK_PR_URL_1,
        branch: MOCK_FIX_TEST_BRANCH,
        openedAt: baseTime,
        mergedAt: mergedTime,
        closedAt: null,
        status: MOCK_STATUS_MERGED,
        commitCount: 5,
        lastCommitSha: MOCK_COMMIT_SHA_ABC123,
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
    ]

    const mockCurrentScores = [createMockScore(MOCK_AGENT_CURSOR)]

    const mockIssueSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockIssue]),
    }

    const mockAttemptsSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockAttempts),
    }

    const mockScoresSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockCurrentScores),
    }

    const mockInsert = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockResolvedValue([]),
    }

    mockDb.select
      .mockReturnValueOnce(mockIssueSelect as never)
      .mockReturnValueOnce(mockAttemptsSelect as never)
      .mockReturnValueOnce(mockScoresSelect as never)

    mockDb.insert.mockReturnValue(mockInsert as never)

    await updateRatingsForIssue(MOCK_ISSUE_ID)

    // Single agent should still be updated
    expect(mockDb.insert).toHaveBeenCalled()

    // Verify ranking has single agent
    expect(openskillModule.updateRatingsForCompletedIssue).toHaveBeenCalledWith(
      expect.any(Object),
      [MOCK_AGENT_CURSOR]
    )
  })

  it('should handle large number of agents', async () => {
    const mockIssue = createMockIssue()
    const baseTime = new Date(MOCK_BASE_TIME)

    // Create 5 agents
    const mockAttempts = [
      {
        id: 'attempt-1',
        issueId: MOCK_ISSUE_ID,
        agentName: MOCK_AGENT_CURSOR,
        repo: MOCK_REPO,
        prNumber: 1,
        prUrl: MOCK_PR_URL_1,
        branch: 'fix/test-1',
        openedAt: baseTime,
        mergedAt: new Date('2024-01-01T11:00:00Z'),
        closedAt: null,
        status: MOCK_STATUS_MERGED,
        commitCount: 5,
        lastCommitSha: MOCK_COMMIT_SHA_ABC123,
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
      {
        id: 'attempt-2',
        issueId: MOCK_ISSUE_ID,
        agentName: MOCK_AGENT_ENGINE,
        repo: MOCK_REPO,
        prNumber: 2,
        prUrl: MOCK_PR_URL_2,
        branch: MOCK_FIX_TEST_2_BRANCH,
        openedAt: baseTime,
        mergedAt: null,
        closedAt: new Date('2024-01-01T12:00:00Z'),
        status: MOCK_STATUS_CLOSED,
        commitCount: 4,
        lastCommitSha: MOCK_COMMIT_SHA_DEF456,
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
      {
        id: 'attempt-3',
        issueId: MOCK_ISSUE_ID,
        agentName: MOCK_AGENT_CYRUS,
        repo: MOCK_REPO,
        prNumber: 3,
        prUrl: MOCK_PR_URL_3,
        branch: MOCK_FIX_TEST_3_BRANCH,
        openedAt: baseTime,
        mergedAt: null,
        closedAt: new Date('2024-01-01T13:00:00Z'),
        status: MOCK_STATUS_CLOSED,
        commitCount: 3,
        lastCommitSha: 'ghi789',
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
      {
        id: 'attempt-4',
        issueId: MOCK_ISSUE_ID,
        agentName: 'aider',
        repo: MOCK_REPO,
        prNumber: 4,
        prUrl: 'https://github.com/test/repo/pull/4',
        branch: 'fix/test-4',
        openedAt: baseTime,
        mergedAt: null,
        closedAt: new Date('2024-01-01T14:00:00Z'),
        status: MOCK_STATUS_CLOSED,
        commitCount: 3,
        lastCommitSha: 'jkl012',
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
      {
        id: 'attempt-5',
        issueId: MOCK_ISSUE_ID,
        agentName: 'windsurf',
        repo: MOCK_REPO,
        prNumber: 5,
        prUrl: 'https://github.com/test/repo/pull/5',
        branch: 'fix/test-5',
        openedAt: baseTime,
        mergedAt: null,
        closedAt: new Date('2024-01-01T15:00:00Z'),
        status: MOCK_STATUS_CLOSED,
        commitCount: 2,
        lastCommitSha: 'mno345',
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
    ]

    const mockCurrentScores = mockAttempts.map((attempt) =>
      createMockScore(attempt.agentName)
    )

    const mockIssueSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockIssue]),
    }

    const mockAttemptsSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockAttempts),
    }

    const mockScoresSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockCurrentScores),
    }

    const mockInsert = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockResolvedValue([]),
    }

    mockDb.select
      .mockReturnValueOnce(mockIssueSelect as never)
      .mockReturnValueOnce(mockAttemptsSelect as never)
      .mockReturnValueOnce(mockScoresSelect as never)

    mockDb.insert.mockReturnValue(mockInsert as never)

    await updateRatingsForIssue(MOCK_ISSUE_ID)

    // All 5 agents should be updated
    expect(mockDb.insert).toHaveBeenCalled()

    // Verify all 5 in ranking
    expect(openskillModule.updateRatingsForCompletedIssue).toHaveBeenCalledWith(
      expect.any(Object),
      [
        MOCK_AGENT_CURSOR,
        MOCK_AGENT_ENGINE,
        MOCK_AGENT_CYRUS,
        'aider',
        'windsurf',
      ]
    )
  })

  it('should use mergedAt for completedAt timestamp', async () => {
    const mockIssue = createMockIssue()
    const baseTime = new Date(MOCK_BASE_TIME)
    const mergedTime = new Date(MOCK_MERGED_TIME)

    const mockAttempts = [
      {
        id: 'attempt-1',
        issueId: MOCK_ISSUE_ID,
        agentName: MOCK_AGENT_CURSOR,
        repo: MOCK_REPO,
        prNumber: 1,
        prUrl: MOCK_PR_URL_1,
        branch: MOCK_FIX_TEST_BRANCH,
        openedAt: baseTime,
        mergedAt: mergedTime,
        closedAt: null,
        status: MOCK_STATUS_MERGED,
        commitCount: 5,
        lastCommitSha: MOCK_COMMIT_SHA_ABC123,
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
    ]

    const mockCurrentScores = [createMockScore(MOCK_AGENT_CURSOR)]

    const mockIssueSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockIssue]),
    }

    const mockAttemptsSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockAttempts),
    }

    const mockScoresSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockCurrentScores),
    }

    const mockInsert = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockResolvedValue([]),
    }

    mockDb.select
      .mockReturnValueOnce(mockIssueSelect as never)
      .mockReturnValueOnce(mockAttemptsSelect as never)
      .mockReturnValueOnce(mockScoresSelect as never)

    mockDb.insert.mockReturnValue(mockInsert as never)

    await updateRatingsForIssue(MOCK_ISSUE_ID)

    // Verify completedAt is set to mergedAt
    expect(mockDb.insert).toHaveBeenCalled()
    expect(mockInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        completedAt: mergedTime,
      })
    )
  })

  it('should exclude open PRs that are not merged or closed', async () => {
    const mockIssue = createMockIssue()
    const baseTime = new Date(MOCK_BASE_TIME)
    const mergedTime = new Date(MOCK_MERGED_TIME)

    const mockAttempts = [
      {
        id: 'attempt-1',
        issueId: MOCK_ISSUE_ID,
        agentName: MOCK_AGENT_CURSOR,
        repo: MOCK_REPO,
        prNumber: 1,
        prUrl: MOCK_PR_URL_1,
        branch: MOCK_FIX_TEST_BRANCH,
        openedAt: baseTime,
        mergedAt: mergedTime,
        closedAt: null,
        status: MOCK_STATUS_MERGED,
        commitCount: 5,
        lastCommitSha: MOCK_COMMIT_SHA_ABC123,
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
      {
        id: 'attempt-2',
        issueId: MOCK_ISSUE_ID,
        agentName: MOCK_AGENT_ENGINE,
        repo: MOCK_REPO,
        prNumber: 2,
        prUrl: MOCK_PR_URL_2,
        branch: MOCK_FIX_TEST_2_BRANCH,
        openedAt: baseTime,
        mergedAt: null,
        closedAt: null,
        status: MOCK_STATUS_OPEN, // Open PR - should be excluded
        commitCount: 3,
        lastCommitSha: MOCK_COMMIT_SHA_DEF456,
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
    ]

    const mockCurrentScores = [createMockScore(MOCK_AGENT_CURSOR)]

    const mockIssueSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockIssue]),
    }

    const mockAttemptsSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockAttempts),
    }

    const mockScoresSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockCurrentScores),
    }

    const mockInsert = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockResolvedValue([]),
    }

    mockDb.select
      .mockReturnValueOnce(mockIssueSelect as never)
      .mockReturnValueOnce(mockAttemptsSelect as never)
      .mockReturnValueOnce(mockScoresSelect as never)

    mockDb.insert.mockReturnValue(mockInsert as never)

    await updateRatingsForIssue(MOCK_ISSUE_ID)

    // Only cursor should be updated (engine is still open)
    expect(mockDb.insert).toHaveBeenCalled()

    // Verify only cursor in ranking
    expect(openskillModule.updateRatingsForCompletedIssue).toHaveBeenCalledWith(
      expect.any(Object),
      [MOCK_AGENT_CURSOR] // Only cursor, engine excluded (open PR)
    )
  })

  it('should handle tie scenarios with same close time', async () => {
    const mockIssue = createMockIssue()
    const baseTime = new Date(MOCK_BASE_TIME)
    const mergedTime = new Date(MOCK_MERGED_TIME)
    const sameCloseTime = new Date('2024-01-01T12:00:00Z')

    const mockAttempts = [
      {
        id: 'attempt-1',
        issueId: MOCK_ISSUE_ID,
        agentName: MOCK_AGENT_CURSOR,
        repo: MOCK_REPO,
        prNumber: 1,
        prUrl: MOCK_PR_URL_1,
        branch: MOCK_FIX_TEST_BRANCH,
        openedAt: baseTime,
        mergedAt: mergedTime,
        closedAt: null,
        status: MOCK_STATUS_MERGED,
        commitCount: 5,
        lastCommitSha: MOCK_COMMIT_SHA_ABC123,
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
      {
        id: 'attempt-2',
        issueId: MOCK_ISSUE_ID,
        agentName: MOCK_AGENT_ENGINE,
        repo: MOCK_REPO,
        prNumber: 2,
        prUrl: MOCK_PR_URL_2,
        branch: MOCK_FIX_TEST_2_BRANCH,
        openedAt: baseTime,
        mergedAt: null,
        closedAt: sameCloseTime,
        status: MOCK_STATUS_CLOSED,
        commitCount: 3,
        lastCommitSha: MOCK_COMMIT_SHA_DEF456,
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
      {
        id: 'attempt-3',
        issueId: MOCK_ISSUE_ID,
        agentName: MOCK_AGENT_CYRUS,
        repo: MOCK_REPO,
        prNumber: 3,
        prUrl: MOCK_PR_URL_3,
        branch: MOCK_FIX_TEST_3_BRANCH,
        openedAt: baseTime,
        mergedAt: null,
        closedAt: sameCloseTime,
        status: MOCK_STATUS_CLOSED,
        commitCount: 4,
        lastCommitSha: 'ghi789',
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
    ]

    const mockCurrentScores = [
      createMockScore(MOCK_AGENT_CURSOR),
      createMockScore(MOCK_AGENT_ENGINE),
      createMockScore(MOCK_AGENT_CYRUS),
    ]

    const mockIssueSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockIssue]),
    }

    const mockAttemptsSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockAttempts),
    }

    const mockScoresSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockCurrentScores),
    }

    const mockInsert = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockResolvedValue([]),
    }

    mockDb.select
      .mockReturnValueOnce(mockIssueSelect as never)
      .mockReturnValueOnce(mockAttemptsSelect as never)
      .mockReturnValueOnce(mockScoresSelect as never)

    mockDb.insert.mockReturnValue(mockInsert as never)

    await updateRatingsForIssue(MOCK_ISSUE_ID)

    // All three should be processed
    expect(mockDb.insert).toHaveBeenCalled()

    // Verify cursor first (merged), then engine and cyrus (tied on close time)
    const rankingCall = vi.mocked(
      openskillModule.updateRatingsForCompletedIssue
    ).mock.calls[0]
    if (rankingCall?.[1]) {
      expect(rankingCall[1][0]).toBe(MOCK_AGENT_CURSOR) // Winner first
      expect(rankingCall[1]).toContain(MOCK_AGENT_ENGINE)
      expect(rankingCall[1]).toContain(MOCK_AGENT_CYRUS)
    }
  })

  it('should handle no winner, only closed PRs for completedAt', async () => {
    const mockIssue = createMockIssue()
    const baseTime = new Date(MOCK_BASE_TIME)
    const closedTime1 = new Date(MOCK_CLOSED_TIME)
    const closedTime2 = new Date(MOCK_CLOSED_TIME_2)

    const mockAttempts = [
      {
        id: 'attempt-1',
        issueId: MOCK_ISSUE_ID,
        agentName: MOCK_AGENT_ENGINE,
        repo: MOCK_REPO,
        prNumber: 1,
        prUrl: MOCK_PR_URL_1,
        branch: MOCK_FIX_TEST_BRANCH,
        openedAt: baseTime,
        mergedAt: null,
        closedAt: closedTime1,
        status: MOCK_STATUS_CLOSED,
        commitCount: 3,
        lastCommitSha: MOCK_COMMIT_SHA_ABC123,
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
      {
        id: 'attempt-2',
        issueId: MOCK_ISSUE_ID,
        agentName: MOCK_AGENT_CYRUS,
        repo: MOCK_REPO,
        prNumber: 2,
        prUrl: MOCK_PR_URL_2,
        branch: MOCK_FIX_TEST_2_BRANCH,
        openedAt: baseTime,
        mergedAt: null,
        closedAt: closedTime2,
        status: MOCK_STATUS_CLOSED,
        commitCount: 4,
        lastCommitSha: MOCK_COMMIT_SHA_DEF456,
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
    ]

    const mockCurrentScores = [
      createMockScore(MOCK_AGENT_ENGINE),
      createMockScore(MOCK_AGENT_CYRUS),
    ]

    const mockIssueSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockIssue]),
    }

    const mockAttemptsSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockAttempts),
    }

    const mockScoresSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockCurrentScores),
    }

    const mockInsert = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockResolvedValue([]),
    }

    mockDb.select
      .mockReturnValueOnce(mockIssueSelect as never)
      .mockReturnValueOnce(mockAttemptsSelect as never)
      .mockReturnValueOnce(mockScoresSelect as never)

    mockDb.insert.mockReturnValue(mockInsert as never)

    await updateRatingsForIssue(MOCK_ISSUE_ID)

    // Both agents should be updated
    expect(mockDb.insert).toHaveBeenCalled()

    // Verify completedAt uses latest closedAt (closedTime2)
    expect(mockInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        completedAt: closedTime2,
      })
    )
  })
})
