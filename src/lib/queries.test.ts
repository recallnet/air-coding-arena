/**
 * Tests for database query functions.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockDeep, mockReset } from 'vitest-mock-extended'

import { db } from '@/db/client'
import { createMockIssue, createMockAttempt } from '@/test-utils/factories'
import type { Attempt, Issue, IssueWithAttemptData } from '@/types/database'

import {
  getAgentStats,
  getIssues,
  getIssueById,
  getAttemptsByIssue,
  getAttemptsByAgent,
  getTemporalStats,
  getAgentTemporalStats,
  getRecentActivity,
  getIssuesWithAgents,
  getAgentScores,
  getAgentScore,
  getAgentScoreHistory,
} from './queries'

// Mock the db client before importing queries
vi.mock('@/db/client', () => ({
  db: mockDeep(),
}))

// Get typed mock
const mockDb = vi.mocked(db)

// Test constants to avoid duplication
const MOCK_ISSUE_ID = 'issue-1'
const MOCK_AGENT_NAME = 'cursor'
const MOCK_REPO = 'repo1'
const MOCK_STATUS_OPEN = 'open'
const MOCK_STATUS_IN_PROGRESS = 'In Progress'
const MOCK_DATE_1 = new Date('2024-01-01')
const MOCK_DATE_2 = new Date('2024-01-02')
const MOCK_DATE_3 = new Date('2024-01-03')
const MOCK_PR_URL = 'https://github.com/pr/1'
const MOCK_PR_URL_2 = 'https://github.com/pr/2'
const MOCK_BRANCH = 'fix/issue-1'
// eslint-disable-next-line sonarjs/no-duplicate-string -- Constant definition for reuse
const MOCK_LINEAR_URL = 'https://linear.app/1'
const MOCK_LINEAR_URL_2 = 'https://linear.app/2'
const EMPTY_ARRAY_MESSAGE = 'should return empty array'
const PROPAGATE_ERROR_MESSAGE = 'should propagate the error'
const DB_QUERY_FAILS_DESCRIPTION = 'when database query fails'
const MOCK_ISSUE_TITLE_1 = 'Fix bug in dashboard'
const MOCK_ISSUE_TITLE_2 = 'Add new feature'

describe('getAgentStats', () => {
  beforeEach(() => {
    mockReset(mockDb)
  })

  describe('when agent stats exist', () => {
    it('should fetch and transform agent stats from view', async () => {
      const mockStats = [
        {
          agent_name: MOCK_AGENT_NAME,
          attempts: 10,
          wins: 8,
          acceptance_pct: 80.0,
        },
        {
          agent_name: 'engine',
          attempts: 5,
          wins: 3,
          acceptance_pct: 60.0,
        },
      ]

      mockDb.execute.mockResolvedValue(mockStats as never)

      const result = await getAgentStats()

      expect(result).toEqual([
        {
          agentName: MOCK_AGENT_NAME,
          attempts: 10,
          wins: 8,
          acceptancePct: 80.0,
        },
        {
          agentName: 'engine',
          attempts: 5,
          wins: 3,
          acceptancePct: 60.0,
        },
      ])

      expect(mockDb.execute).toHaveBeenCalledTimes(1)
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          queryChunks: expect.any(Array),
        })
      )
    })
  })

  describe('when no agent stats exist', () => {
    it(EMPTY_ARRAY_MESSAGE, async () => {
      mockDb.execute.mockResolvedValue([] as never)

      const result = await getAgentStats()

      expect(result).toEqual([])
    })
  })

  describe(DB_QUERY_FAILS_DESCRIPTION, () => {
    it(PROPAGATE_ERROR_MESSAGE, async () => {
      const errorMessage = 'Database connection failed'
      const error = new Error(errorMessage)
      mockDb.execute.mockRejectedValue(error)

      await expect(getAgentStats()).rejects.toThrow(errorMessage)
    })
  })
})

describe('getIssues', () => {
  beforeEach(() => {
    mockReset(mockDb)
  })

  describe('when issues exist', () => {
    it('should fetch all issues with attempt counts and winner info ordered by arenaReadyLabeledAt DESC', async () => {
      const mockDbResult = [
        {
          id: '1',
          linear_id: 'linear-1',
          linear_key: 'ISSUE-1',
          title: 'Issue 1',
          url: MOCK_LINEAR_URL,
          repo: MOCK_REPO,
          status: MOCK_STATUS_IN_PROGRESS,
          description: null,
          description_markdown: null,
          estimate: null,
          priority: null,
          labels_json: null,
          assignee_id: null,
          assignee_name: null,
          assignee_email: null,
          creator_id: null,
          creator_name: null,
          creator_email: null,
          project_id: null,
          project_name: null,
          cycle_id: null,
          cycle_name: null,
          cycle_number: null,
          due_date: null,
          linear_created_at: null,
          linear_updated_at: null,
          parent_id: null,
          arena_ready_labeled_at: MOCK_DATE_2,
          winner_attempt_id: null,
          created_at: MOCK_DATE_1,
          attempt_count: 3,
          winner_agent_name: null,
        },
        {
          id: '2',
          linear_id: 'linear-2',
          linear_key: 'ISSUE-2',
          title: 'Issue 2',
          url: MOCK_LINEAR_URL_2,
          repo: 'repo2',
          status: 'Done',
          description: null,
          description_markdown: null,
          estimate: null,
          priority: null,
          labels_json: null,
          assignee_id: null,
          assignee_name: null,
          assignee_email: null,
          creator_id: null,
          creator_name: null,
          creator_email: null,
          project_id: null,
          project_name: null,
          cycle_id: null,
          cycle_name: null,
          cycle_number: null,
          due_date: null,
          linear_created_at: null,
          linear_updated_at: null,
          parent_id: null,
          arena_ready_labeled_at: MOCK_DATE_1,
          winner_attempt_id: 'attempt-1',
          created_at: MOCK_DATE_1,
          attempt_count: 5,
          winner_agent_name: MOCK_AGENT_NAME,
        },
      ]

      const EXPECTED_ISSUE_ID = '1'
      const EXPECTED_LINEAR_ID = 'linear-1'

      const expectedResult: IssueWithAttemptData[] = [
        {
          ...createMockIssue({
            id: EXPECTED_ISSUE_ID,
            linearId: EXPECTED_LINEAR_ID,
            linearKey: 'ISSUE-1',
            title: 'Issue 1',
            url: MOCK_LINEAR_URL,
            repo: MOCK_REPO,
            status: MOCK_STATUS_IN_PROGRESS,
            arenaReadyLabeledAt: MOCK_DATE_2,
            createdAt: MOCK_DATE_1,
          }),
          attemptCount: 3,
          winnerAgentName: null,
        },
        {
          ...createMockIssue({
            id: '2',
            linearId: 'linear-2',
            linearKey: 'ISSUE-2',
            title: 'Issue 2',
            url: MOCK_LINEAR_URL_2,
            repo: 'repo2',
            status: 'Done',
            arenaReadyLabeledAt: MOCK_DATE_1,
            winnerAttemptId: 'attempt-1',
            createdAt: MOCK_DATE_1,
          }),
          attemptCount: 5,
          winnerAgentName: MOCK_AGENT_NAME,
        },
      ]

      mockDb.execute.mockResolvedValue(mockDbResult as never)

      const result = await getIssues()

      expect(result).toEqual(expectedResult)
      expect(mockDb.execute).toHaveBeenCalledTimes(1)
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          queryChunks: expect.any(Array),
        })
      )
    })
  })

  describe('when no issues exist', () => {
    it(EMPTY_ARRAY_MESSAGE, async () => {
      mockDb.execute.mockResolvedValue([] as never)

      const result = await getIssues()

      expect(result).toEqual([])
    })
  })

  describe(DB_QUERY_FAILS_DESCRIPTION, () => {
    it(PROPAGATE_ERROR_MESSAGE, async () => {
      const errorMessage = 'Query failed'
      const error = new Error(errorMessage)

      mockDb.execute.mockRejectedValue(error)

      await expect(getIssues()).rejects.toThrow(errorMessage)
    })
  })
})

describe('getIssueById', () => {
  beforeEach(() => {
    mockReset(mockDb)
  })

  describe('when issue exists', () => {
    it('should fetch issue with attempts', async () => {
      const mockIssue: Issue = createMockIssue({
        id: '1',
        linearId: 'linear-1',
        linearKey: 'ISSUE-1',
        title: 'Issue 1',
        url: 'https://linear.app/1',
        repo: MOCK_REPO,
        status: 'In Progress',
        arenaReadyLabeledAt: MOCK_DATE_1,
        createdAt: MOCK_DATE_1,
      })

      const mockAttempts: Attempt[] = [
        createMockAttempt({
          id: 'attempt-1',
          issueId: '1',
          agentName: MOCK_AGENT_NAME,
          repo: MOCK_REPO,
          prNumber: 1,
          prUrl: MOCK_PR_URL,
          branch: MOCK_BRANCH,
          openedAt: MOCK_DATE_2,
          status: MOCK_STATUS_OPEN,
          commitCount: 3,
          lastCommitSha: 'abc123',
        }),
      ]

      const mockIssueSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockIssue]),
      }

      const mockAttemptsSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockAttempts),
      }

      const mockAgentsSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      }

      mockDb.select
        .mockReturnValueOnce(mockIssueSelect as never)
        .mockReturnValueOnce(mockAttemptsSelect as never)
        .mockReturnValueOnce(mockAgentsSelect as never)

      const result = await getIssueById('1')

      expect(result).toEqual({
        ...mockIssue,
        attempts: mockAttempts,
        agents: [],
      })
    })

    it('should handle issue with no attempts', async () => {
      const mockIssue: Issue = createMockIssue({
        id: '1',
        linearId: 'linear-1',
        linearKey: 'ISSUE-1',
        title: 'Issue 1',
        url: 'https://linear.app/1',
        repo: MOCK_REPO,
        status: 'Backlog',
        arenaReadyLabeledAt: MOCK_DATE_1,
        createdAt: MOCK_DATE_1,
      })

      const mockIssueSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockIssue]),
      }

      const mockAttemptsSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      }

      const mockAgentsSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      }

      mockDb.select
        .mockReturnValueOnce(mockIssueSelect as never)
        .mockReturnValueOnce(mockAttemptsSelect as never)
        .mockReturnValueOnce(mockAgentsSelect as never)

      const result = await getIssueById('1')

      expect(result).toEqual({
        ...mockIssue,
        attempts: [],
        agents: [],
      })
    })
  })

  describe('when issue does not exist', () => {
    it('should return null', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      }

      mockDb.select.mockReturnValue(mockSelect as never)

      const result = await getIssueById('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe(DB_QUERY_FAILS_DESCRIPTION, () => {
    it(PROPAGATE_ERROR_MESSAGE, async () => {
      const errorMessage = 'Database error'
      const error = new Error(errorMessage)
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockRejectedValue(error),
      }

      mockDb.select.mockReturnValue(mockSelect as never)

      await expect(getIssueById('1')).rejects.toThrow(errorMessage)
    })
  })
})

describe('getAttemptsByIssue', () => {
  beforeEach(() => {
    mockReset(mockDb)
  })

  describe('when attempts exist', () => {
    it('should fetch attempts for issue ordered by openedAt DESC', async () => {
      const mockAttempts: Attempt[] = [
        {
          id: 'attempt-1',
          issueId: MOCK_ISSUE_ID,
          agentName: MOCK_AGENT_NAME,
          repo: MOCK_REPO,
          prNumber: 1,
          prUrl: MOCK_PR_URL,
          branch: MOCK_BRANCH,
          openedAt: MOCK_DATE_2,
          mergedAt: null,
          closedAt: null,
          status: MOCK_STATUS_OPEN,
          commitCount: 3,
          lastCommitSha: 'abc123',
          ciStatus: null,
          ciLastCheckedAt: null,
          sourceAttachmentId: null,
          sourceAttachmentUrl: null,
        },
        {
          id: 'attempt-2',
          issueId: MOCK_ISSUE_ID,
          agentName: 'engine',
          repo: MOCK_REPO,
          prNumber: 2,
          prUrl: MOCK_PR_URL_2,
          branch: 'fix/issue-1-engine',
          openedAt: MOCK_DATE_1,
          mergedAt: null,
          closedAt: null,
          status: MOCK_STATUS_OPEN,
          commitCount: 2,
          lastCommitSha: 'def456',
          ciStatus: null,
          ciLastCheckedAt: null,
          sourceAttachmentId: null,
          sourceAttachmentUrl: null,
        },
      ]

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockAttempts),
      }

      mockDb.select.mockReturnValue(mockSelect as never)

      const result = await getAttemptsByIssue(MOCK_ISSUE_ID)

      expect(result).toEqual(mockAttempts)
    })
  })

  describe('when no attempts exist', () => {
    it(EMPTY_ARRAY_MESSAGE, async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      }

      mockDb.select.mockReturnValue(mockSelect as never)

      const result = await getAttemptsByIssue(MOCK_ISSUE_ID)

      expect(result).toEqual([])
    })
  })

  describe(DB_QUERY_FAILS_DESCRIPTION, () => {
    it(PROPAGATE_ERROR_MESSAGE, async () => {
      const errorMessage = 'Query error'
      const error = new Error(errorMessage)
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockRejectedValue(error),
      }

      mockDb.select.mockReturnValue(mockSelect as never)

      await expect(getAttemptsByIssue(MOCK_ISSUE_ID)).rejects.toThrow(
        errorMessage
      )
    })
  })
})

describe('getAttemptsByAgent', () => {
  beforeEach(() => {
    mockReset(mockDb)
  })

  describe('when attempts exist', () => {
    it('should fetch attempts by agent with issue linear keys ordered by openedAt DESC', async () => {
      const mockDbResult = [
        {
          id: 'attempt-1',
          issue_id: MOCK_ISSUE_ID,
          agent_name: MOCK_AGENT_NAME,
          repo: MOCK_REPO,
          pr_number: 1,
          pr_url: MOCK_PR_URL,
          branch: MOCK_BRANCH,
          opened_at: MOCK_DATE_2,
          merged_at: null,
          closed_at: null,
          status: MOCK_STATUS_OPEN,
          commit_count: 3,
          last_commit_sha: 'abc123',
          ci_status: null,
          ci_last_checked_at: null,
          source_attachment_id: null,
          source_attachment_url: null,
          issue_linear_key: 'ISSUE-1',
        },
        {
          id: 'attempt-2',
          issue_id: 'issue-2',
          agent_name: MOCK_AGENT_NAME,
          repo: MOCK_REPO,
          pr_number: 3,
          pr_url: 'https://github.com/pr/3',
          branch: 'fix/issue-2',
          opened_at: MOCK_DATE_1,
          merged_at: MOCK_DATE_3,
          closed_at: MOCK_DATE_3,
          status: 'merged',
          commit_count: 5,
          last_commit_sha: 'ghi789',
          ci_status: null,
          ci_last_checked_at: null,
          source_attachment_id: null,
          source_attachment_url: null,
          issue_linear_key: 'ISSUE-2',
        },
      ]

      const expectedResult = [
        {
          id: 'attempt-1',
          issueId: MOCK_ISSUE_ID,
          agentName: MOCK_AGENT_NAME,
          repo: MOCK_REPO,
          prNumber: 1,
          prUrl: MOCK_PR_URL,
          branch: MOCK_BRANCH,
          openedAt: MOCK_DATE_2,
          mergedAt: null,
          closedAt: null,
          status: MOCK_STATUS_OPEN,
          commitCount: 3,
          lastCommitSha: 'abc123',
          ciStatus: null,
          ciLastCheckedAt: null,
          sourceAttachmentId: null,
          sourceAttachmentUrl: null,
          issueLinearKey: 'ISSUE-1',
        },
        {
          id: 'attempt-2',
          issueId: 'issue-2',
          agentName: MOCK_AGENT_NAME,
          repo: MOCK_REPO,
          prNumber: 3,
          prUrl: 'https://github.com/pr/3',
          branch: 'fix/issue-2',
          openedAt: MOCK_DATE_1,
          mergedAt: MOCK_DATE_3,
          closedAt: MOCK_DATE_3,
          status: 'merged',
          commitCount: 5,
          lastCommitSha: 'ghi789',
          ciStatus: null,
          ciLastCheckedAt: null,
          sourceAttachmentId: null,
          sourceAttachmentUrl: null,
          issueLinearKey: 'ISSUE-2',
        },
      ]

      mockDb.execute.mockResolvedValue(mockDbResult as never)

      const result = await getAttemptsByAgent(MOCK_AGENT_NAME)

      expect(result).toEqual(expectedResult)
      expect(mockDb.execute).toHaveBeenCalledTimes(1)
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          queryChunks: expect.any(Array),
        })
      )
    })
  })

  describe('when no attempts exist', () => {
    it(EMPTY_ARRAY_MESSAGE, async () => {
      mockDb.execute.mockResolvedValue([] as never)

      const result = await getAttemptsByAgent('nonexistent')

      expect(result).toEqual([])
    })
  })

  describe(DB_QUERY_FAILS_DESCRIPTION, () => {
    it(PROPAGATE_ERROR_MESSAGE, async () => {
      const errorMessage = 'Connection error'
      const error = new Error(errorMessage)

      mockDb.execute.mockRejectedValue(error as never)

      await expect(getAttemptsByAgent(MOCK_AGENT_NAME)).rejects.toThrow(
        errorMessage
      )
    })
  })
})

// Test constants for getTemporalStats tests
const MOCK_DATE_2024_01_01 = '2024-01-01'
const MOCK_DATE_2024_01_02 = '2024-01-02'
const MOCK_DATE_2024_01_03 = '2024-01-03'
const MOCK_DATE_2024_01_07 = '2024-01-07'
const MOCK_DATE_2024_01_08 = '2024-01-08'

describe('getTemporalStats', () => {
  beforeEach(() => {
    mockReset(mockDb)
  })

  describe('when temporal stats exist', () => {
    it('should fetch and transform temporal stats with default 30 days', async () => {
      const mockDbResult = [
        {
          date: MOCK_DATE_2024_01_03,
          attempts: 5,
          wins: 3,
          failures: 1,
        },
        {
          date: MOCK_DATE_2024_01_02,
          attempts: 3,
          wins: 2,
          failures: 0,
        },
        {
          date: MOCK_DATE_2024_01_01,
          attempts: 0,
          wins: 0,
          failures: 2,
        },
      ]

      mockDb.execute.mockResolvedValue(mockDbResult as never)

      const result = await getTemporalStats()

      expect(result).toEqual([
        {
          date: MOCK_DATE_2024_01_03,
          attempts: 5,
          wins: 3,
          failures: 1,
        },
        {
          date: MOCK_DATE_2024_01_02,
          attempts: 3,
          wins: 2,
          failures: 0,
        },
        {
          date: MOCK_DATE_2024_01_01,
          attempts: 0,
          wins: 0,
          failures: 2,
        },
      ])

      expect(mockDb.execute).toHaveBeenCalledTimes(1)
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          queryChunks: expect.any(Array),
        })
      )
    })

    it('should accept custom number of days', async () => {
      const mockDbResult = [
        {
          date: MOCK_DATE_2024_01_08,
          attempts: 2,
          wins: 1,
          failures: 0,
        },
        {
          date: MOCK_DATE_2024_01_07,
          attempts: 4,
          wins: 2,
          failures: 1,
        },
      ]

      mockDb.execute.mockResolvedValue(mockDbResult as never)

      const result = await getTemporalStats(7)

      expect(result).toEqual([
        {
          date: MOCK_DATE_2024_01_08,
          attempts: 2,
          wins: 1,
          failures: 0,
        },
        {
          date: MOCK_DATE_2024_01_07,
          attempts: 4,
          wins: 2,
          failures: 1,
        },
      ])

      expect(mockDb.execute).toHaveBeenCalledTimes(1)
    })

    it('should handle days with zero activity', async () => {
      const mockDbResult = [
        {
          date: MOCK_DATE_2024_01_03,
          attempts: 0,
          wins: 0,
          failures: 0,
        },
        {
          date: MOCK_DATE_2024_01_02,
          attempts: 0,
          wins: 0,
          failures: 0,
        },
        {
          date: MOCK_DATE_2024_01_01,
          attempts: 5,
          wins: 3,
          failures: 1,
        },
      ]

      mockDb.execute.mockResolvedValue(mockDbResult as never)

      const result = await getTemporalStats(3)

      expect(result).toEqual([
        {
          date: MOCK_DATE_2024_01_03,
          attempts: 0,
          wins: 0,
          failures: 0,
        },
        {
          date: MOCK_DATE_2024_01_02,
          attempts: 0,
          wins: 0,
          failures: 0,
        },
        {
          date: MOCK_DATE_2024_01_01,
          attempts: 5,
          wins: 3,
          failures: 1,
        },
      ])
    })

    it('should handle mixed activity with some metrics zero', async () => {
      const mockDbResult = [
        {
          date: MOCK_DATE_2024_01_02,
          attempts: 5,
          wins: 0,
          failures: 0,
        },
        {
          date: MOCK_DATE_2024_01_01,
          attempts: 0,
          wins: 0,
          failures: 3,
        },
      ]

      mockDb.execute.mockResolvedValue(mockDbResult as never)

      const result = await getTemporalStats(2)

      expect(result).toEqual([
        {
          date: MOCK_DATE_2024_01_02,
          attempts: 5,
          wins: 0,
          failures: 0,
        },
        {
          date: MOCK_DATE_2024_01_01,
          attempts: 0,
          wins: 0,
          failures: 3,
        },
      ])
    })
  })

  describe('when no temporal stats exist', () => {
    it(EMPTY_ARRAY_MESSAGE, async () => {
      mockDb.execute.mockResolvedValue([] as never)

      const result = await getTemporalStats()

      expect(result).toEqual([])
    })
  })

  describe(DB_QUERY_FAILS_DESCRIPTION, () => {
    it(PROPAGATE_ERROR_MESSAGE, async () => {
      const errorMessage = 'Temporal query failed'
      const error = new Error(errorMessage)

      mockDb.execute.mockRejectedValue(error as never)

      await expect(getTemporalStats()).rejects.toThrow(errorMessage)
    })
  })
})

describe('getAgentTemporalStats', () => {
  beforeEach(() => {
    mockReset(mockDb)
  })

  describe('when agent temporal stats exist', () => {
    it('should fetch and transform cumulative stats per agent', async () => {
      const mockDbResult = [
        {
          date: MOCK_DATE_2024_01_03,
          agent_name: MOCK_AGENT_NAME,
          cumulative_attempts: 10,
          cumulative_wins: 8,
          cumulative_failures: 2,
        },
        {
          date: MOCK_DATE_2024_01_03,
          agent_name: 'engine',
          cumulative_attempts: 5,
          cumulative_wins: 3,
          cumulative_failures: 2,
        },
        {
          date: MOCK_DATE_2024_01_02,
          agent_name: MOCK_AGENT_NAME,
          cumulative_attempts: 5,
          cumulative_wins: 4,
          cumulative_failures: 1,
        },
        {
          date: MOCK_DATE_2024_01_02,
          agent_name: 'engine',
          cumulative_attempts: 3,
          cumulative_wins: 2,
          cumulative_failures: 1,
        },
      ]

      mockDb.execute.mockResolvedValue(mockDbResult as never)

      const result = await getAgentTemporalStats()

      expect(result).toEqual([
        {
          date: MOCK_DATE_2024_01_03,
          agentName: MOCK_AGENT_NAME,
          cumulativeAttempts: 10,
          cumulativeWins: 8,
          cumulativeFailures: 2,
        },
        {
          date: MOCK_DATE_2024_01_03,
          agentName: 'engine',
          cumulativeAttempts: 5,
          cumulativeWins: 3,
          cumulativeFailures: 2,
        },
        {
          date: MOCK_DATE_2024_01_02,
          agentName: MOCK_AGENT_NAME,
          cumulativeAttempts: 5,
          cumulativeWins: 4,
          cumulativeFailures: 1,
        },
        {
          date: MOCK_DATE_2024_01_02,
          agentName: 'engine',
          cumulativeAttempts: 3,
          cumulativeWins: 2,
          cumulativeFailures: 1,
        },
      ])

      expect(mockDb.execute).toHaveBeenCalledTimes(1)
    })

    it('should accept custom number of days', async () => {
      const mockDbResult = [
        {
          date: MOCK_DATE_2024_01_07,
          agent_name: MOCK_AGENT_NAME,
          cumulative_attempts: 15,
          cumulative_wins: 10,
          cumulative_failures: 5,
        },
      ]

      mockDb.execute.mockResolvedValue(mockDbResult as never)

      const result = await getAgentTemporalStats(7)

      expect(result).toEqual([
        {
          date: MOCK_DATE_2024_01_07,
          agentName: MOCK_AGENT_NAME,
          cumulativeAttempts: 15,
          cumulativeWins: 10,
          cumulativeFailures: 5,
        },
      ])

      expect(mockDb.execute).toHaveBeenCalledTimes(1)
    })
  })

  describe('when no agent temporal stats exist', () => {
    it(EMPTY_ARRAY_MESSAGE, async () => {
      mockDb.execute.mockResolvedValue([] as never)

      const result = await getAgentTemporalStats()

      expect(result).toEqual([])
    })
  })

  describe(DB_QUERY_FAILS_DESCRIPTION, () => {
    it(PROPAGATE_ERROR_MESSAGE, async () => {
      const errorMessage = 'Agent temporal query failed'
      const error = new Error(errorMessage)

      mockDb.execute.mockRejectedValue(error as never)

      await expect(getAgentTemporalStats()).rejects.toThrow(errorMessage)
    })
  })
})

describe('getRecentActivity', () => {
  beforeEach(() => {
    mockReset(mockDb)
  })

  describe('when activity exists', () => {
    it('should fetch and transform recent activity with issue details', async () => {
      const mockDbResult = [
        {
          id: 'attempt-1',
          agent_name: MOCK_AGENT_NAME,
          issue_id: MOCK_ISSUE_ID,
          issue_title: MOCK_ISSUE_TITLE_1,
          issue_linear_key: 'ISSUE-1',
          pr_url: MOCK_PR_URL,
          pr_number: 1,
          status: 'merged',
          opened_at: MOCK_DATE_2,
        },
        {
          id: 'attempt-2',
          agent_name: 'engine',
          issue_id: 'issue-2',
          issue_title: MOCK_ISSUE_TITLE_2,
          issue_linear_key: 'ISSUE-2',
          pr_url: MOCK_PR_URL_2,
          pr_number: 2,
          status: MOCK_STATUS_OPEN,
          opened_at: MOCK_DATE_1,
        },
      ]

      mockDb.execute.mockResolvedValue(mockDbResult as never)

      const result = await getRecentActivity()

      expect(result).toEqual([
        {
          id: 'attempt-1',
          agentName: MOCK_AGENT_NAME,
          issueId: MOCK_ISSUE_ID,
          issueTitle: MOCK_ISSUE_TITLE_1,
          issueLinearKey: 'ISSUE-1',
          prUrl: MOCK_PR_URL,
          prNumber: 1,
          status: 'merged',
          openedAt: MOCK_DATE_2.toISOString(),
        },
        {
          id: 'attempt-2',
          agentName: 'engine',
          issueId: 'issue-2',
          issueTitle: MOCK_ISSUE_TITLE_2,
          issueLinearKey: 'ISSUE-2',
          prUrl: 'https://github.com/pr/2',
          prNumber: 2,
          status: MOCK_STATUS_OPEN,
          openedAt: MOCK_DATE_1.toISOString(),
        },
      ])

      expect(mockDb.execute).toHaveBeenCalledTimes(1)
    })

    it('should accept custom limit', async () => {
      const mockDbResult = [
        {
          id: 'attempt-1',
          agent_name: MOCK_AGENT_NAME,
          issue_id: MOCK_ISSUE_ID,
          issue_title: 'Fix bug',
          issue_linear_key: 'ISSUE-1',
          pr_url: MOCK_PR_URL,
          pr_number: 1,
          status: 'merged',
          opened_at: MOCK_DATE_1,
        },
      ]

      mockDb.execute.mockResolvedValue(mockDbResult as never)

      const result = await getRecentActivity(10)

      expect(result).toHaveLength(1)
      expect(mockDb.execute).toHaveBeenCalledTimes(1)
    })

    it('should handle opened_at as string (not instanceof Date)', async () => {
      const mockDbResult = [
        {
          id: 'attempt-1',
          agent_name: MOCK_AGENT_NAME,
          issue_id: MOCK_ISSUE_ID,
          issue_title: 'Fix bug',
          issue_linear_key: 'ISSUE-1',
          pr_url: MOCK_PR_URL,
          pr_number: 1,
          status: 'merged',
          opened_at: '2024-01-02T00:00:00Z',
        },
      ]

      mockDb.execute.mockResolvedValue(mockDbResult as never)

      const result = await getRecentActivity()

      expect(result[0]?.openedAt).toBe('2024-01-02T00:00:00Z')
    })
  })

  describe('when no activity exists', () => {
    it(EMPTY_ARRAY_MESSAGE, async () => {
      mockDb.execute.mockResolvedValue([] as never)

      const result = await getRecentActivity()

      expect(result).toEqual([])
    })
  })

  describe(DB_QUERY_FAILS_DESCRIPTION, () => {
    it(PROPAGATE_ERROR_MESSAGE, async () => {
      const errorMessage = 'Recent activity query failed'
      const error = new Error(errorMessage)

      mockDb.execute.mockRejectedValue(error as never)

      await expect(getRecentActivity()).rejects.toThrow(errorMessage)
    })
  })
})

describe('getIssuesWithAgents', () => {
  beforeEach(() => {
    mockReset(mockDb)
  })

  describe('when issues with agents exist', () => {
    it('should fetch and transform issues grouped with agent data', async () => {
      const mockDbResult = [
        {
          id: 'issue-1',
          linear_key: 'ISSUE-1',
          title: MOCK_ISSUE_TITLE_1,
          status: MOCK_STATUS_IN_PROGRESS,
          url: MOCK_LINEAR_URL,
          arena_ready_labeled_at: MOCK_DATE_1,
          last_activity_at: MOCK_DATE_3,
          open_pr_count: 2,
          merged_pr_count: 0,
          agents: [
            {
              agent_name: MOCK_AGENT_NAME,
              status: 'submitted',
            },
            {
              agent_name: 'engine',
              status: 'pending',
            },
          ],
        },
        {
          id: 'issue-2',
          linear_key: 'ISSUE-2',
          title: MOCK_ISSUE_TITLE_2,
          status: 'Done',
          url: MOCK_LINEAR_URL_2,
          arena_ready_labeled_at: MOCK_DATE_1,
          last_activity_at: MOCK_DATE_2,
          open_pr_count: 0,
          merged_pr_count: 1,
          agents: [
            {
              agent_name: 'cyrus',
              status: 'accepted',
            },
          ],
        },
      ]

      mockDb.execute.mockResolvedValue(mockDbResult as never)

      const result = await getIssuesWithAgents()

      expect(result).toEqual([
        {
          id: 'issue-1',
          linearKey: 'ISSUE-1',
          title: MOCK_ISSUE_TITLE_1,
          status: MOCK_STATUS_IN_PROGRESS,
          url: MOCK_LINEAR_URL,
          arenaReadyLabeledAt: MOCK_DATE_1,
          lastActivityAt: MOCK_DATE_3,
          openPRCount: 2,
          mergedPRCount: 0,
          agents: [
            {
              agentName: MOCK_AGENT_NAME,
              status: 'submitted',
            },
            {
              agentName: 'engine',
              status: 'pending',
            },
          ],
        },
        {
          id: 'issue-2',
          linearKey: 'ISSUE-2',
          title: MOCK_ISSUE_TITLE_2,
          status: 'Done',
          url: MOCK_LINEAR_URL_2,
          arenaReadyLabeledAt: MOCK_DATE_1,
          lastActivityAt: MOCK_DATE_2,
          openPRCount: 0,
          mergedPRCount: 1,
          agents: [
            {
              agentName: 'cyrus',
              status: 'accepted',
            },
          ],
        },
      ])

      expect(mockDb.execute).toHaveBeenCalledTimes(1)
    })

    it('should handle issue with no agents', async () => {
      const mockDbResult = [
        {
          id: 'issue-1',
          linear_key: 'ISSUE-1',
          title: 'Unassigned issue',
          status: 'Todo',
          url: MOCK_LINEAR_URL,
          arena_ready_labeled_at: MOCK_DATE_1,
          last_activity_at: MOCK_DATE_1,
          open_pr_count: 0,
          merged_pr_count: 0,
          agents: [],
        },
      ]

      mockDb.execute.mockResolvedValue(mockDbResult as never)

      const result = await getIssuesWithAgents()

      expect(result).toEqual([
        {
          id: 'issue-1',
          linearKey: 'ISSUE-1',
          title: 'Unassigned issue',
          status: 'Todo',
          url: MOCK_LINEAR_URL,
          arenaReadyLabeledAt: MOCK_DATE_1,
          lastActivityAt: MOCK_DATE_1,
          openPRCount: 0,
          mergedPRCount: 0,
          agents: [],
        },
      ])
    })

    it('should accept custom limit', async () => {
      const mockDbResult = [
        {
          id: 'issue-1',
          linear_key: 'ISSUE-1',
          title: 'Issue 1',
          status: 'Todo',
          url: MOCK_LINEAR_URL,
          arena_ready_labeled_at: MOCK_DATE_1,
          last_activity_at: MOCK_DATE_1,
          open_pr_count: 0,
          merged_pr_count: 0,
          agents: [],
        },
      ]

      mockDb.execute.mockResolvedValue(mockDbResult as never)

      const result = await getIssuesWithAgents(10)

      expect(result).toHaveLength(1)
      expect(mockDb.execute).toHaveBeenCalledTimes(1)
    })

    it('should order by most recent activity', async () => {
      const mockDbResult = [
        {
          id: 'issue-2',
          linear_key: 'ISSUE-2',
          title: 'Recent issue',
          status: 'Todo',
          url: MOCK_LINEAR_URL_2,
          arena_ready_labeled_at: MOCK_DATE_1,
          last_activity_at: MOCK_DATE_3,
          open_pr_count: 0,
          merged_pr_count: 0,
          agents: [],
        },
        {
          id: 'issue-1',
          linear_key: 'ISSUE-1',
          title: 'Old issue',
          status: 'Todo',
          url: MOCK_LINEAR_URL,
          arena_ready_labeled_at: MOCK_DATE_1,
          last_activity_at: MOCK_DATE_2,
          open_pr_count: 0,
          merged_pr_count: 0,
          agents: [],
        },
      ]

      mockDb.execute.mockResolvedValue(mockDbResult as never)

      const result = await getIssuesWithAgents()

      expect(result[0]?.linearKey).toBe('ISSUE-2')
      expect(result[1]?.linearKey).toBe('ISSUE-1')
    })
  })

  describe('when no issues exist', () => {
    it(EMPTY_ARRAY_MESSAGE, async () => {
      mockDb.execute.mockResolvedValue([] as never)

      const result = await getIssuesWithAgents()

      expect(result).toEqual([])
    })
  })

  describe(DB_QUERY_FAILS_DESCRIPTION, () => {
    it(PROPAGATE_ERROR_MESSAGE, async () => {
      const errorMessage = 'Issues with agents query failed'
      const error = new Error(errorMessage)

      mockDb.execute.mockRejectedValue(error as never)

      await expect(getIssuesWithAgents()).rejects.toThrow(errorMessage)
    })
  })
})

describe('agent rating queries', () => {
  beforeEach(() => {
    mockReset(mockDb)
  })

  describe('getAgentScores', () => {
    it('should return all agent scores ordered by ordinal DESC', async () => {
      const mockDbResult = [
        {
          id: 'score-1',
          agentName: MOCK_AGENT_NAME,
          mu: 26.5,
          sigma: 7.8,
          ordinal: 1320.5,
          gamesPlayed: 5,
          lastUpdatedAt: MOCK_DATE_1,
          createdAt: MOCK_DATE_1,
        },
        {
          id: 'score-2',
          agentName: 'engine',
          mu: 25.2,
          sigma: 8.0,
          ordinal: 1300.2,
          gamesPlayed: 3,
          lastUpdatedAt: MOCK_DATE_1,
          createdAt: MOCK_DATE_1,
        },
      ]

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockDbResult),
      }

      mockDb.select.mockReturnValue(mockSelect as never)

      const result = await getAgentScores()

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(2)
      if (result.length > 1) {
        // Verify descending order by ordinal
        expect(result[0]!.ordinal).toBeGreaterThanOrEqual(result[1]!.ordinal)
      }
    })

    it('should include all rating fields', async () => {
      const mockDbResult = [
        {
          id: 'score-1',
          agentName: MOCK_AGENT_NAME,
          mu: 26.5,
          sigma: 7.8,
          ordinal: 1320.5,
          gamesPlayed: 5,
          lastUpdatedAt: MOCK_DATE_1,
          createdAt: MOCK_DATE_1,
        },
      ]

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockDbResult),
      }

      mockDb.select.mockReturnValue(mockSelect as never)

      const result = await getAgentScores()

      if (result.length > 0) {
        const firstScore = result[0]!
        expect(firstScore).toHaveProperty('agentName')
        expect(firstScore).toHaveProperty('mu')
        expect(firstScore).toHaveProperty('sigma')
        expect(firstScore).toHaveProperty('ordinal')
        expect(firstScore).toHaveProperty('gamesPlayed')
      }
    })

    it(EMPTY_ARRAY_MESSAGE, async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      }

      mockDb.select.mockReturnValue(mockSelect as never)

      const result = await getAgentScores()

      expect(result).toEqual([])
    })
  })

  describe('getAgentScore', () => {
    it('should return score for specific agent', async () => {
      const mockDbResult = [
        {
          id: 'score-1',
          agentName: MOCK_AGENT_NAME,
          mu: 26.5,
          sigma: 7.8,
          ordinal: 1320.5,
          gamesPlayed: 5,
          lastUpdatedAt: MOCK_DATE_1,
          createdAt: MOCK_DATE_1,
        },
      ]

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockDbResult),
      }

      mockDb.select.mockReturnValue(mockSelect as never)

      const result = await getAgentScore(MOCK_AGENT_NAME)

      expect(result).toBeDefined()
      expect(result?.agentName).toBe(MOCK_AGENT_NAME)
      expect(result?.mu).toBeGreaterThan(0)
    })

    it('should return null for non-existent agent', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      }

      mockDb.select.mockReturnValue(mockSelect as never)

      const result = await getAgentScore('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('getAgentScoreHistory', () => {
    it('should return history for agent ordered by completedAt DESC', async () => {
      const mockDbResult = [
        {
          id: 'history-1',
          agentName: MOCK_AGENT_NAME,
          issueId: 'issue-1',
          mu: 27.0,
          sigma: 7.5,
          ordinal: 1330.0,
          rank: 1,
          completedAt: MOCK_DATE_3,
          createdAt: MOCK_DATE_3,
        },
        {
          id: 'history-2',
          agentName: MOCK_AGENT_NAME,
          issueId: 'issue-2',
          mu: 26.5,
          sigma: 7.8,
          ordinal: 1320.5,
          rank: 2,
          completedAt: MOCK_DATE_2,
          createdAt: MOCK_DATE_2,
        },
      ]

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockDbResult),
      }

      mockDb.select.mockReturnValue(mockSelect as never)

      const result = await getAgentScoreHistory(MOCK_AGENT_NAME)

      expect(Array.isArray(result)).toBe(true)
      if (result.length > 1) {
        // Verify descending order by date
        expect(result[0]!.completedAt.getTime()).toBeGreaterThanOrEqual(
          result[1]!.completedAt.getTime()
        )
      }
    })

    it(EMPTY_ARRAY_MESSAGE, async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      }

      mockDb.select.mockReturnValue(mockSelect as never)

      const result = await getAgentScoreHistory('nonexistent')

      expect(result).toEqual([])
    })
  })
})
