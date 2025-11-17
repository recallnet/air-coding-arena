import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockDeep, mockReset } from 'vitest-mock-extended'

import { db } from '@/db/client'

import * as openskillModule from './openskill'
import { updateRatingsForIssue, determineRanking } from './update-ratings'

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
const MOCK_AGENT_WINNER = 'agent-winner'
const MOCK_AGENT_LOSER = 'agent-loser'
const MOCK_AGENT_LOSER_CLOSED_EARLY = 'agent-loser-closed-early'
const MOCK_AGENT_LOSER_CLOSED_LATE = 'agent-loser-closed-late'
const MOCK_AGENT_DNF = 'agent-dnf'
const MOCK_TIME_12PM = '2024-01-01T12:00:00Z'

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
      // ranking is now string[][], so flatten and iterate
      for (const [groupIndex, group] of ranking.entries()) {
        for (const agentName of group) {
          const currentRating = currentRatings[agentName]
          if (currentRating) {
            // Winner gets +2 mu, losers get -2 mu / rank
            const muChange = groupIndex === 0 ? 2 : -2 / (groupIndex + 1)
            result[agentName] = {
              mu: currentRating.mu + muChange,
              sigma: currentRating.sigma - 0.5, // Reduce uncertainty
            }
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

  // Helper to create idempotency check mock (returns no existing history)
  const mockIdempotencyCheck = () => ({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]), // Empty array = no existing history
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

    mockDb.select
      .mockReturnValueOnce(mockIdempotencyCheck() as never) // Idempotency check returns empty
      .mockReturnValueOnce(mockSelect as never)

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
      .mockReturnValueOnce(mockIdempotencyCheck() as never) // Idempotency check returns empty
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
        closedAt: null,
        status: MOCK_STATUS_OPEN, // Open with < 2 commits = DNF
        commitCount: 1,
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
      .mockReturnValueOnce(mockIdempotencyCheck() as never) // Idempotency check returns empty
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
      .mockReturnValueOnce(mockIdempotencyCheck() as never) // Idempotency check returns empty
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
      [[MOCK_AGENT_CURSOR], [MOCK_AGENT_ENGINE]] // Grouped ranking
    )
  })

  it('should detect DNF for low-effort open PRs (< 2 commits)', async () => {
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
        status: MOCK_STATUS_OPEN, // Open with < 2 commits = DNF
        commitCount: 1,
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
      .mockReturnValueOnce(mockIdempotencyCheck() as never) // Idempotency check returns empty
      .mockReturnValueOnce(mockIssueSelect as never)
      .mockReturnValueOnce(mockAttemptsSelect as never)
      .mockReturnValueOnce(mockScoresSelect as never)

    mockDb.insert.mockReturnValue(mockInsert as never)

    await updateRatingsForIssue(MOCK_ISSUE_ID)

    // Only cursor should be updated (engine DNF'd - open PR with < 2 commits)
    expect(mockDb.insert).toHaveBeenCalled()

    // Verify only cursor was passed to openskill (engine filtered out)
    expect(openskillModule.updateRatingsForCompletedIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: expect.objectContaining({ mu: 25 }),
      }),
      [[MOCK_AGENT_CURSOR]] // Only cursor, engine DNF'd
    )
  })

  it('should include all agents with sufficient commits (win/loss model)', async () => {
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
        closedAt: shortCloseTime, // Short lifespan but sufficient commits
        status: MOCK_STATUS_CLOSED,
        commitCount: 5, // Sufficient commits = valid loser
        lastCommitSha: MOCK_COMMIT_SHA_DEF456,
        ciStatus: null,
        ciLastCheckedAt: null,
        sourceAttachmentId: null,
        sourceAttachmentUrl: null,
      },
    ]

    const mockCurrentScores = [
      createMockScore(MOCK_AGENT_CURSOR),
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
      .mockReturnValueOnce(mockIdempotencyCheck() as never) // Idempotency check returns empty
      .mockReturnValueOnce(mockIssueSelect as never)
      .mockReturnValueOnce(mockAttemptsSelect as never)
      .mockReturnValueOnce(mockScoresSelect as never)

    mockDb.insert.mockReturnValue(mockInsert as never)

    await updateRatingsForIssue(MOCK_ISSUE_ID)

    // Both agents should be updated (win/loss model: only commit count matters)
    expect(mockDb.insert).toHaveBeenCalled()

    // Verify cursor winner, cyrus loser (no lifespan check in win/loss model)
    expect(openskillModule.updateRatingsForCompletedIssue).toHaveBeenCalledWith(
      expect.any(Object),
      [[MOCK_AGENT_CURSOR], [MOCK_AGENT_CYRUS]]
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
      .mockReturnValueOnce(mockIdempotencyCheck() as never) // Idempotency check returns empty
      .mockReturnValueOnce(mockIssueSelect as never)
      .mockReturnValueOnce(mockAttemptsSelect as never)
      .mockReturnValueOnce(mockScoresSelect as never)

    mockDb.insert.mockReturnValue(mockInsert as never)

    await updateRatingsForIssue(MOCK_ISSUE_ID)

    // All three agents should be updated with proper ranking
    expect(mockDb.insert).toHaveBeenCalled()

    // Verify ranking: cursor (merged) first, engine and cyrus tied for second
    expect(openskillModule.updateRatingsForCompletedIssue).toHaveBeenCalledWith(
      expect.any(Object),
      expect.arrayContaining([
        [MOCK_AGENT_CURSOR],
        expect.arrayContaining([MOCK_AGENT_ENGINE, MOCK_AGENT_CYRUS]),
      ])
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
      .mockReturnValueOnce(mockIdempotencyCheck() as never) // Idempotency check returns empty
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
      .mockReturnValueOnce(mockIdempotencyCheck() as never) // Idempotency check returns empty
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
      [[MOCK_AGENT_CURSOR]]
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
        closedAt: new Date(MOCK_TIME_12PM),
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
      .mockReturnValueOnce(mockIdempotencyCheck() as never) // Idempotency check returns empty
      .mockReturnValueOnce(mockIssueSelect as never)
      .mockReturnValueOnce(mockAttemptsSelect as never)
      .mockReturnValueOnce(mockScoresSelect as never)

    mockDb.insert.mockReturnValue(mockInsert as never)

    await updateRatingsForIssue(MOCK_ISSUE_ID)

    // All 5 agents should be updated
    expect(mockDb.insert).toHaveBeenCalled()

    // Verify all 5 in ranking (winner first, all losers tied)
    expect(openskillModule.updateRatingsForCompletedIssue).toHaveBeenCalledWith(
      expect.any(Object),
      expect.arrayContaining([
        [MOCK_AGENT_CURSOR],
        expect.arrayContaining([
          MOCK_AGENT_ENGINE,
          MOCK_AGENT_CYRUS,
          'aider',
          'windsurf',
        ]),
      ])
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
      .mockReturnValueOnce(mockIdempotencyCheck() as never) // Idempotency check returns empty
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
      .mockReturnValueOnce(mockIdempotencyCheck() as never) // Idempotency check returns empty
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
      [[MOCK_AGENT_CURSOR]] // Only cursor, engine excluded (open PR)
    )
  })

  it('should handle tie scenarios with same close time', async () => {
    const mockIssue = createMockIssue()
    const baseTime = new Date(MOCK_BASE_TIME)
    const mergedTime = new Date(MOCK_MERGED_TIME)
    const sameCloseTime = new Date(MOCK_TIME_12PM)

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
      .mockReturnValueOnce(mockIdempotencyCheck() as never) // Idempotency check returns empty
      .mockReturnValueOnce(mockIssueSelect as never)
      .mockReturnValueOnce(mockAttemptsSelect as never)
      .mockReturnValueOnce(mockScoresSelect as never)

    mockDb.insert.mockReturnValue(mockInsert as never)

    await updateRatingsForIssue(MOCK_ISSUE_ID)

    // All three should be processed
    expect(mockDb.insert).toHaveBeenCalled()

    // Verify cursor first (merged), then engine and cyrus tied for second
    expect(openskillModule.updateRatingsForCompletedIssue).toHaveBeenCalledWith(
      expect.any(Object),
      expect.arrayContaining([
        [MOCK_AGENT_CURSOR],
        expect.arrayContaining([MOCK_AGENT_ENGINE, MOCK_AGENT_CYRUS]),
      ])
    )
  })
})

describe('determineRanking - win/loss model', () => {
  it('should rank winner first, all losers tied for second (no close time sorting)', () => {
    const attempts = [
      {
        agentName: MOCK_AGENT_WINNER,
        status: MOCK_STATUS_MERGED,
        mergedAt: new Date(MOCK_TIME_12PM),
        closedAt: null,
        openedAt: new Date(MOCK_BASE_TIME),
        commitCount: 5,
      },
      {
        agentName: MOCK_AGENT_LOSER_CLOSED_EARLY,
        status: MOCK_STATUS_CLOSED,
        mergedAt: null,
        closedAt: new Date('2024-01-01T11:00:00Z'), // Closed BEFORE winner merged
        openedAt: new Date(MOCK_BASE_TIME),
        commitCount: 3,
      },
      {
        agentName: MOCK_AGENT_LOSER_CLOSED_LATE,
        status: MOCK_STATUS_CLOSED,
        mergedAt: null,
        closedAt: new Date('2024-01-01T14:00:00Z'), // Closed AFTER winner merged
        openedAt: new Date(MOCK_BASE_TIME),
        commitCount: 4,
      },
    ]

    const ranking = determineRanking(attempts)

    // Winner should be position 1 (index 0)
    expect(ranking[0]).toEqual([MOCK_AGENT_WINNER])

    // ALL losers should be position 2 (index 1) - order within doesn't matter
    expect(ranking[1]).toHaveLength(2)
    expect(ranking[1]).toContain(MOCK_AGENT_LOSER_CLOSED_EARLY)
    expect(ranking[1]).toContain(MOCK_AGENT_LOSER_CLOSED_LATE)
  })

  it('should exclude DNF agents (open PRs with < 2 commits) from all ranking positions', () => {
    const attempts = [
      {
        agentName: MOCK_AGENT_WINNER,
        status: MOCK_STATUS_MERGED,
        mergedAt: new Date(),
        closedAt: null,
        openedAt: new Date(),
        commitCount: 5,
      },
      {
        agentName: MOCK_AGENT_LOSER,
        status: MOCK_STATUS_CLOSED,
        mergedAt: null,
        closedAt: new Date(),
        openedAt: new Date(),
        commitCount: 3,
      },
      {
        agentName: MOCK_AGENT_DNF,
        status: MOCK_STATUS_OPEN, // Open PR with < 2 commits = DNF
        mergedAt: null,
        closedAt: null,
        openedAt: new Date(),
        commitCount: 1,
      },
    ]

    const ranking = determineRanking(attempts)

    expect(ranking).toHaveLength(2) // Only 2 positions: [winner], [loser]
    expect(ranking[0]).toEqual([MOCK_AGENT_WINNER])
    expect(ranking[1]).toEqual([MOCK_AGENT_LOSER])
  })

  it('should count closed PRs as losses regardless of commit count', () => {
    const attempts = [
      {
        agentName: MOCK_AGENT_WINNER,
        status: MOCK_STATUS_MERGED,
        mergedAt: new Date(),
        closedAt: null,
        openedAt: new Date(),
        commitCount: 5,
      },
      {
        agentName: 'loser-1-commit',
        status: MOCK_STATUS_CLOSED,
        mergedAt: null,
        closedAt: new Date(),
        openedAt: new Date(),
        commitCount: 1, // Closed PR = loss, even with 1 commit
      },
      {
        agentName: 'loser-many-commits',
        status: MOCK_STATUS_CLOSED,
        mergedAt: null,
        closedAt: new Date(),
        openedAt: new Date(),
        commitCount: 10,
      },
    ]

    const ranking = determineRanking(attempts)

    expect(ranking).toHaveLength(2) // [winner], [losers]
    expect(ranking[0]).toEqual([MOCK_AGENT_WINNER])
    expect(ranking[1]).toHaveLength(2)
    expect(ranking[1]).toContain('loser-1-commit')
    expect(ranking[1]).toContain('loser-many-commits')
  })
})
