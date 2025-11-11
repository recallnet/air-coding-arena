/**
 * Tests for database query functions.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockDeep, mockReset } from 'vitest-mock-extended'

import { db } from '@/db/client'
import type { Attempt, Issue, IssueWithAttemptData } from '@/types/database'

import {
  getAgentStats,
  getIssues,
  getIssueById,
  getAttemptsByIssue,
  getAttemptsByAgent,
  getTemporalStats,
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
const MOCK_BRANCH = 'fix/issue-1'
// eslint-disable-next-line sonarjs/no-duplicate-string -- Constant definition for reuse
const MOCK_LINEAR_URL = 'https://linear.app/1'
const MOCK_LINEAR_URL_2 = 'https://linear.app/2'
const EMPTY_ARRAY_MESSAGE = 'should return empty array'
const PROPAGATE_ERROR_MESSAGE = 'should propagate the error'
const DB_QUERY_FAILS_DESCRIPTION = 'when database query fails'

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
          id: EXPECTED_ISSUE_ID,
          linearId: EXPECTED_LINEAR_ID,
          linearKey: 'ISSUE-1',
          title: 'Issue 1',
          url: MOCK_LINEAR_URL,
          repo: MOCK_REPO,
          status: MOCK_STATUS_IN_PROGRESS,
          arenaReadyLabeledAt: MOCK_DATE_2,
          winnerAttemptId: null,
          createdAt: MOCK_DATE_1,
          attemptCount: 3,
          winnerAgentName: null,
        },
        {
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
      const mockIssue: Issue = {
        id: '1',
        linearId: 'linear-1',
        linearKey: 'ISSUE-1',
        title: 'Issue 1',
        url: 'https://linear.app/1',
        repo: MOCK_REPO,
        status: 'In Progress',
        arenaReadyLabeledAt: MOCK_DATE_1,
        winnerAttemptId: null,
        createdAt: MOCK_DATE_1,
      }

      const mockAttempts: Attempt[] = [
        {
          id: 'attempt-1',
          issueId: '1',
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
        },
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

      mockDb.select
        .mockReturnValueOnce(mockIssueSelect as never)
        .mockReturnValueOnce(mockAttemptsSelect as never)

      const result = await getIssueById('1')

      expect(result).toEqual({
        ...mockIssue,
        attempts: mockAttempts,
      })
    })

    it('should handle issue with no attempts', async () => {
      const mockIssue: Issue = {
        id: '1',
        linearId: 'linear-1',
        linearKey: 'ISSUE-1',
        title: 'Issue 1',
        url: 'https://linear.app/1',
        repo: MOCK_REPO,
        status: 'Backlog',
        arenaReadyLabeledAt: MOCK_DATE_1,
        winnerAttemptId: null,
        createdAt: MOCK_DATE_1,
      }

      const mockIssueSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockIssue]),
      }

      const mockAttemptsSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      }

      mockDb.select
        .mockReturnValueOnce(mockIssueSelect as never)
        .mockReturnValueOnce(mockAttemptsSelect as never)

      const result = await getIssueById('1')

      expect(result).toEqual({
        ...mockIssue,
        attempts: [],
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
        },
        {
          id: 'attempt-2',
          issueId: MOCK_ISSUE_ID,
          agentName: 'engine',
          repo: MOCK_REPO,
          prNumber: 2,
          prUrl: 'https://github.com/pr/2',
          branch: 'fix/issue-1-engine',
          openedAt: MOCK_DATE_1,
          mergedAt: null,
          closedAt: null,
          status: MOCK_STATUS_OPEN,
          commitCount: 2,
          lastCommitSha: 'def456',
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
