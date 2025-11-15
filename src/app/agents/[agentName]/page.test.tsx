/**
 * Tests for Agent detail page.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import AgentPage from './page'

// Mock the query functions
vi.mock('@/lib/queries', () => ({
  getAgentBySlugOrName: vi.fn(),
  getAttemptsByAgent: vi.fn(),
  getAgentStats: vi.fn(),
  getAgentScore: vi.fn(),
  getAgentScoreHistory: vi.fn(),
}))

// Mock Next.js Link component
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }): React.ReactElement => <a href={href}>{children}</a>,
}))

// Mock Next.js notFound function
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('notFound')
  }),
}))

// Import after mocking to get the mocked version
// eslint-disable-next-line import/order -- Must import after mock
import {
  getAgentBySlugOrName,
  getAttemptsByAgent,
  getAgentStats,
  getAgentScore,
  getAgentScoreHistory,
} from '@/lib/queries'
// eslint-disable-next-line import/order -- Must import after mock
import { notFound } from 'next/navigation'

const mockGetAgentBySlugOrName = vi.mocked(getAgentBySlugOrName)
const mockGetAttemptsByAgent = vi.mocked(getAttemptsByAgent)
const mockGetAgentStats = vi.mocked(getAgentStats)
const mockGetAgentScore = vi.mocked(getAgentScore)
const mockGetAgentScoreHistory = vi.mocked(getAgentScoreHistory)
const mockNotFound = vi.mocked(notFound)

// Test constants to avoid duplication
const MOCK_AGENT_CURSOR = 'cursor'
const MOCK_AGENT_ENGINE = 'engine'
const MOCK_ISSUE_ID = '123e4567-e89b-12d3-a456-426614174000'
const MOCK_LINEAR_KEY = 'ENG-101'
const MOCK_REPO = 'org/repo'
const MOCK_PR_URL = 'https://github.com/org/repo/pull/123'
const MOCK_BRANCH = 'feature/fix'
const MOCK_OPENED_DATE = new Date('2025-01-16T10:00:00Z')
const MOCK_MERGED_DATE = new Date('2025-01-17T10:00:00Z')
const MOCK_COMMIT_SHA = 'abc123'
const MOCK_STATUS_MERGED = 'merged'
const MOCK_STATUS_OPEN = 'open'
const MOCK_STATUS_CLOSED = 'closed'
const MOCK_ATTEMPT_ID_1 = '456e4567-e89b-12d3-a456-426614174001'
const MOCK_ATTEMPT_ID_2 = '456e4567-e89b-12d3-a456-426614174002'
const UI_TEXT_TOP_PERFORMER = 'Top Performer'
const UI_TEXT_ACTIVE = 'Active'
const MOCK_DATE_DISCOVERED = '2025-01-01T00:00:00Z'
const MOCK_DATE_LAST_SEEN = '2025-01-02T00:00:00Z'
const MOCK_LINEAR_USER_ID = 'linear-user-1'

describe('AgentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set default mock return values
    mockGetAgentBySlugOrName.mockResolvedValue({
      id: MOCK_ISSUE_ID,
      name: MOCK_AGENT_CURSOR,
      slug: MOCK_AGENT_CURSOR,
      displayName: 'Cursor',
      linearUserId: MOCK_LINEAR_USER_ID,
      email: 'cursor@example.com',
      avatarUrl: null,
      isActive: true,
      isEnabled: true,
      discoveredAt: new Date(MOCK_DATE_DISCOVERED),
      lastSeenAt: new Date(MOCK_DATE_LAST_SEEN),
      createdAt: new Date(MOCK_DATE_DISCOVERED),
      updatedAt: new Date(MOCK_DATE_LAST_SEEN),
    })
    mockGetAgentScore.mockResolvedValue(null)
    mockGetAgentScoreHistory.mockResolvedValue([])
  })

  describe('when agent has no attempts', () => {
    it('should call notFound() when agent does not exist', async () => {
      mockGetAgentBySlugOrName.mockResolvedValue(null)
      mockGetAttemptsByAgent.mockResolvedValue([])
      mockGetAgentStats.mockResolvedValue([])

      await expect(async () => {
        await AgentPage({ params: { agentName: 'nonexistent' } })
      }).rejects.toThrow('notFound')

      expect(mockNotFound).toHaveBeenCalled()
    })

    it('should call getAttemptsByAgent with correct agent name', async () => {
      mockGetAgentBySlugOrName.mockResolvedValue({
        id: MOCK_ISSUE_ID,
        name: MOCK_AGENT_ENGINE,
        slug: MOCK_AGENT_ENGINE,
        displayName: 'Engine',
        linearUserId: 'linear-user-2',
        email: 'engine@example.com',
        avatarUrl: null,
        isActive: true,
        isEnabled: true,
        discoveredAt: new Date(MOCK_DATE_DISCOVERED),
        lastSeenAt: new Date(MOCK_DATE_LAST_SEEN),
        createdAt: new Date(MOCK_DATE_DISCOVERED),
        updatedAt: new Date(MOCK_DATE_LAST_SEEN),
      })
      mockGetAttemptsByAgent.mockResolvedValue([])
      mockGetAgentStats.mockResolvedValue([])

      await AgentPage({ params: { agentName: MOCK_AGENT_ENGINE } })

      expect(mockGetAttemptsByAgent).toHaveBeenCalledWith(MOCK_AGENT_ENGINE)
    })
  })

  describe('when agent has attempts', () => {
    it('should display page title and subtitle', async () => {
      mockGetAttemptsByAgent.mockResolvedValue([
        {
          id: MOCK_ATTEMPT_ID_1,
          issueId: MOCK_ISSUE_ID,
          agentName: MOCK_AGENT_CURSOR,
          repo: MOCK_REPO,
          prNumber: 123,
          prUrl: MOCK_PR_URL,
          branch: MOCK_BRANCH,
          openedAt: MOCK_OPENED_DATE,
          mergedAt: MOCK_MERGED_DATE,
          closedAt: null,
          status: MOCK_STATUS_MERGED,
          commitCount: 5,
          lastCommitSha: MOCK_COMMIT_SHA,
          ciStatus: null,
          ciLastCheckedAt: null,
          sourceAttachmentId: null,
          sourceAttachmentUrl: null,
          issueLinearKey: MOCK_LINEAR_KEY,
        },
      ])

      mockGetAgentStats.mockResolvedValue([
        {
          agentName: MOCK_AGENT_CURSOR,
          issues: 8,
          prs: 10,
          dnf: 2,
          attempts: 1,
          wins: 1,
          acceptancePct: 100.0,
          ordinal: 1500,
          gamesPlayed: 1,
        },
      ])

      render(await AgentPage({ params: { agentName: MOCK_AGENT_CURSOR } }))

      expect(
        screen.getByRole('heading', { name: 'Agent Details' })
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          `Performance metrics and attempt history for ${MOCK_AGENT_CURSOR}`
        )
      ).toBeInTheDocument()
    })

    it('should display agent name as heading', async () => {
      mockGetAttemptsByAgent.mockResolvedValue([
        {
          id: MOCK_ATTEMPT_ID_1,
          issueId: MOCK_ISSUE_ID,
          agentName: MOCK_AGENT_CURSOR,
          repo: MOCK_REPO,
          prNumber: 123,
          prUrl: MOCK_PR_URL,
          branch: MOCK_BRANCH,
          openedAt: MOCK_OPENED_DATE,
          mergedAt: null,
          closedAt: null,
          status: MOCK_STATUS_OPEN,
          commitCount: 3,
          lastCommitSha: MOCK_COMMIT_SHA,
          ciStatus: null,
          ciLastCheckedAt: null,
          sourceAttachmentId: null,
          sourceAttachmentUrl: null,
          issueLinearKey: MOCK_LINEAR_KEY,
        },
      ])

      mockGetAgentStats.mockResolvedValue([
        {
          agentName: MOCK_AGENT_CURSOR,
          issues: 8,
          prs: 10,
          dnf: 2,
          attempts: 1,
          wins: 0,
          acceptancePct: 0.0,
          ordinal: 1500,
          gamesPlayed: 1,
        },
      ])

      render(await AgentPage({ params: { agentName: MOCK_AGENT_CURSOR } }))

      expect(screen.getByText(MOCK_AGENT_CURSOR)).toBeInTheDocument()
    })

    describe('agent stats', () => {
      it('should display total attempts count', async () => {
        mockGetAttemptsByAgent.mockResolvedValue([
          {
            id: MOCK_ATTEMPT_ID_1,
            issueId: MOCK_ISSUE_ID,
            agentName: MOCK_AGENT_CURSOR,
            repo: MOCK_REPO,
            prNumber: 123,
            prUrl: MOCK_PR_URL,
            branch: MOCK_BRANCH,
            openedAt: MOCK_OPENED_DATE,
            mergedAt: null,
            closedAt: null,
            status: MOCK_STATUS_OPEN,
            commitCount: 3,
            lastCommitSha: MOCK_COMMIT_SHA,
            ciStatus: null,
            ciLastCheckedAt: null,
            sourceAttachmentId: null,
            sourceAttachmentUrl: null,
            issueLinearKey: MOCK_LINEAR_KEY,
          },
        ])

        mockGetAgentStats.mockResolvedValue([
          {
            agentName: MOCK_AGENT_CURSOR,
            issues: 8,
            prs: 10,
            dnf: 2,
            attempts: 5,
            wins: 3,
            acceptancePct: 60.0,
            ordinal: 1500,
            gamesPlayed: 5,
          },
        ])

        render(await AgentPage({ params: { agentName: MOCK_AGENT_CURSOR } }))

        expect(screen.getByText('Total Attempts')).toBeInTheDocument()
        expect(screen.getByText('5')).toBeInTheDocument()
      })

      it('should display wins count', async () => {
        mockGetAttemptsByAgent.mockResolvedValue([
          {
            id: MOCK_ATTEMPT_ID_1,
            issueId: MOCK_ISSUE_ID,
            agentName: MOCK_AGENT_CURSOR,
            repo: MOCK_REPO,
            prNumber: 123,
            prUrl: MOCK_PR_URL,
            branch: MOCK_BRANCH,
            openedAt: MOCK_OPENED_DATE,
            mergedAt: MOCK_MERGED_DATE,
            closedAt: null,
            status: MOCK_STATUS_MERGED,
            commitCount: 5,
            lastCommitSha: MOCK_COMMIT_SHA,
            ciStatus: null,
            ciLastCheckedAt: null,
            sourceAttachmentId: null,
            sourceAttachmentUrl: null,
            issueLinearKey: MOCK_LINEAR_KEY,
          },
        ])

        mockGetAgentStats.mockResolvedValue([
          {
            agentName: MOCK_AGENT_CURSOR,
            issues: 8,
            prs: 10,
            dnf: 2,
            attempts: 5,
            wins: 3,
            acceptancePct: 60.0,
            ordinal: 1500,
            gamesPlayed: 5,
          },
        ])

        render(await AgentPage({ params: { agentName: MOCK_AGENT_CURSOR } }))

        expect(screen.getByText('Wins (Merged PRs)')).toBeInTheDocument()
        expect(screen.getByText('3')).toBeInTheDocument()
      })

      it('should display issues count', async () => {
        mockGetAttemptsByAgent.mockResolvedValue([
          {
            id: MOCK_ATTEMPT_ID_1,
            issueId: MOCK_ISSUE_ID,
            agentName: MOCK_AGENT_CURSOR,
            repo: MOCK_REPO,
            prNumber: 123,
            prUrl: MOCK_PR_URL,
            branch: MOCK_BRANCH,
            openedAt: MOCK_OPENED_DATE,
            mergedAt: MOCK_MERGED_DATE,
            closedAt: null,
            status: MOCK_STATUS_MERGED,
            commitCount: 5,
            lastCommitSha: MOCK_COMMIT_SHA,
            ciStatus: null,
            ciLastCheckedAt: null,
            sourceAttachmentId: null,
            sourceAttachmentUrl: null,
            issueLinearKey: MOCK_LINEAR_KEY,
          },
        ])

        mockGetAgentStats.mockResolvedValue([
          {
            agentName: MOCK_AGENT_CURSOR,
            issues: 7,
            prs: 10,
            dnf: 2,
            attempts: 10,
            wins: 8,
            acceptancePct: 80.5,
            ordinal: 1600,
            gamesPlayed: 10,
          },
        ])

        render(await AgentPage({ params: { agentName: MOCK_AGENT_CURSOR } }))

        expect(screen.getByText('Issues')).toBeInTheDocument()
        expect(screen.getByText('7')).toBeInTheDocument()
      })

      it('should display PRs count', async () => {
        mockGetAttemptsByAgent.mockResolvedValue([
          {
            id: MOCK_ATTEMPT_ID_1,
            issueId: MOCK_ISSUE_ID,
            agentName: MOCK_AGENT_CURSOR,
            repo: MOCK_REPO,
            prNumber: 123,
            prUrl: MOCK_PR_URL,
            branch: MOCK_BRANCH,
            openedAt: MOCK_OPENED_DATE,
            mergedAt: MOCK_MERGED_DATE,
            closedAt: null,
            status: MOCK_STATUS_MERGED,
            commitCount: 5,
            lastCommitSha: MOCK_COMMIT_SHA,
            ciStatus: null,
            ciLastCheckedAt: null,
            sourceAttachmentId: null,
            sourceAttachmentUrl: null,
            issueLinearKey: MOCK_LINEAR_KEY,
          },
        ])

        mockGetAgentStats.mockResolvedValue([
          {
            agentName: MOCK_AGENT_CURSOR,
            issues: 6,
            prs: 9,
            dnf: 2,
            attempts: 10,
            wins: 7,
            acceptancePct: 70.0,
            ordinal: 1600,
            gamesPlayed: 10,
          },
        ])

        render(await AgentPage({ params: { agentName: MOCK_AGENT_CURSOR } }))

        expect(screen.getByText('PRs')).toBeInTheDocument()
        expect(screen.getByText('9')).toBeInTheDocument()
      })

      it('should display DNF count', async () => {
        mockGetAttemptsByAgent.mockResolvedValue([
          {
            id: MOCK_ATTEMPT_ID_1,
            issueId: MOCK_ISSUE_ID,
            agentName: MOCK_AGENT_CURSOR,
            repo: MOCK_REPO,
            prNumber: 123,
            prUrl: MOCK_PR_URL,
            branch: MOCK_BRANCH,
            openedAt: MOCK_OPENED_DATE,
            mergedAt: MOCK_MERGED_DATE,
            closedAt: null,
            status: MOCK_STATUS_MERGED,
            commitCount: 5,
            lastCommitSha: MOCK_COMMIT_SHA,
            ciStatus: null,
            ciLastCheckedAt: null,
            sourceAttachmentId: null,
            sourceAttachmentUrl: null,
            issueLinearKey: MOCK_LINEAR_KEY,
          },
        ])

        mockGetAgentStats.mockResolvedValue([
          {
            agentName: MOCK_AGENT_CURSOR,
            issues: 8,
            prs: 10,
            dnf: 2,
            attempts: 10,
            wins: 8,
            acceptancePct: 80.5,
            ordinal: 1600,
            gamesPlayed: 10,
          },
        ])

        render(await AgentPage({ params: { agentName: MOCK_AGENT_CURSOR } }))

        expect(screen.getByText('DNF')).toBeInTheDocument()
        expect(screen.getByText('2')).toBeInTheDocument()
      })

      it('should handle agent stats not found in stats array', async () => {
        mockGetAttemptsByAgent.mockResolvedValue([
          {
            id: MOCK_ATTEMPT_ID_1,
            issueId: MOCK_ISSUE_ID,
            agentName: MOCK_AGENT_CURSOR,
            repo: MOCK_REPO,
            prNumber: 123,
            prUrl: MOCK_PR_URL,
            branch: MOCK_BRANCH,
            openedAt: MOCK_OPENED_DATE,
            mergedAt: null,
            closedAt: null,
            status: MOCK_STATUS_OPEN,
            commitCount: 3,
            lastCommitSha: MOCK_COMMIT_SHA,
            ciStatus: null,
            ciLastCheckedAt: null,
            sourceAttachmentId: null,
            sourceAttachmentUrl: null,
            issueLinearKey: MOCK_LINEAR_KEY,
          },
        ])

        // Agent stats don't include this agent
        mockGetAgentStats.mockResolvedValue([
          {
            agentName: MOCK_AGENT_ENGINE,
            issues: 8,
            prs: 10,
            dnf: 2,
            attempts: 5,
            wins: 3,
            acceptancePct: 60.0,
            ordinal: 1500,
            gamesPlayed: 5,
          },
        ])

        render(await AgentPage({ params: { agentName: MOCK_AGENT_CURSOR } }))

        // Should display attempt count from actual attempts
        expect(screen.getByText('Total Attempts')).toBeInTheDocument()
        expect(screen.getByText('1')).toBeInTheDocument()
        // Should display 0 for all stats when not found
        const zeros = screen.getAllByText('0')
        expect(zeros.length).toBeGreaterThanOrEqual(4) // wins, issues, prs, dnf
      })
    })

    describe('performance badge', () => {
      it('should display "Top Performer" badge when acceptance rate > 75%', async () => {
        mockGetAttemptsByAgent.mockResolvedValue([
          {
            id: MOCK_ATTEMPT_ID_1,
            issueId: MOCK_ISSUE_ID,
            agentName: MOCK_AGENT_CURSOR,
            repo: MOCK_REPO,
            prNumber: 123,
            prUrl: MOCK_PR_URL,
            branch: MOCK_BRANCH,
            openedAt: MOCK_OPENED_DATE,
            mergedAt: MOCK_MERGED_DATE,
            closedAt: null,
            status: MOCK_STATUS_MERGED,
            commitCount: 5,
            lastCommitSha: MOCK_COMMIT_SHA,
            ciStatus: null,
            ciLastCheckedAt: null,
            sourceAttachmentId: null,
            sourceAttachmentUrl: null,
            issueLinearKey: MOCK_LINEAR_KEY,
          },
        ])

        mockGetAgentStats.mockResolvedValue([
          {
            agentName: MOCK_AGENT_CURSOR,
            issues: 8,
            prs: 10,
            dnf: 2,
            attempts: 10,
            wins: 9,
            acceptancePct: 90.0,
            ordinal: 1650,
            gamesPlayed: 10,
          },
        ])

        render(await AgentPage({ params: { agentName: MOCK_AGENT_CURSOR } }))

        expect(screen.getByText(UI_TEXT_TOP_PERFORMER)).toBeInTheDocument()
        expect(screen.queryByText(UI_TEXT_ACTIVE)).not.toBeInTheDocument()
      })

      it('should display "Active" badge when acceptance rate <= 75%', async () => {
        mockGetAttemptsByAgent.mockResolvedValue([
          {
            id: MOCK_ATTEMPT_ID_1,
            issueId: MOCK_ISSUE_ID,
            agentName: MOCK_AGENT_CURSOR,
            repo: MOCK_REPO,
            prNumber: 123,
            prUrl: MOCK_PR_URL,
            branch: MOCK_BRANCH,
            openedAt: MOCK_OPENED_DATE,
            mergedAt: null,
            closedAt: null,
            status: MOCK_STATUS_OPEN,
            commitCount: 3,
            lastCommitSha: MOCK_COMMIT_SHA,
            ciStatus: null,
            ciLastCheckedAt: null,
            sourceAttachmentId: null,
            sourceAttachmentUrl: null,
            issueLinearKey: MOCK_LINEAR_KEY,
          },
        ])

        mockGetAgentStats.mockResolvedValue([
          {
            agentName: MOCK_AGENT_CURSOR,
            issues: 8,
            prs: 10,
            dnf: 2,
            attempts: 10,
            wins: 6,
            acceptancePct: 60.0,
            ordinal: 1500,
            gamesPlayed: 10,
          },
        ])

        render(await AgentPage({ params: { agentName: MOCK_AGENT_CURSOR } }))

        expect(screen.getByText(UI_TEXT_ACTIVE)).toBeInTheDocument()
        expect(
          screen.queryByText(UI_TEXT_TOP_PERFORMER)
        ).not.toBeInTheDocument()
      })

      it('should display "Active" badge when acceptance rate is exactly 75%', async () => {
        mockGetAttemptsByAgent.mockResolvedValue([
          {
            id: MOCK_ATTEMPT_ID_1,
            issueId: MOCK_ISSUE_ID,
            agentName: MOCK_AGENT_CURSOR,
            repo: MOCK_REPO,
            prNumber: 123,
            prUrl: MOCK_PR_URL,
            branch: MOCK_BRANCH,
            openedAt: MOCK_OPENED_DATE,
            mergedAt: MOCK_MERGED_DATE,
            closedAt: null,
            status: MOCK_STATUS_MERGED,
            commitCount: 5,
            lastCommitSha: MOCK_COMMIT_SHA,
            ciStatus: null,
            ciLastCheckedAt: null,
            sourceAttachmentId: null,
            sourceAttachmentUrl: null,
            issueLinearKey: MOCK_LINEAR_KEY,
          },
        ])

        mockGetAgentStats.mockResolvedValue([
          {
            agentName: MOCK_AGENT_CURSOR,
            issues: 8,
            prs: 10,
            dnf: 2,
            attempts: 4,
            wins: 3,
            acceptancePct: 75.0,
            ordinal: 1550,
            gamesPlayed: 4,
          },
        ])

        render(await AgentPage({ params: { agentName: MOCK_AGENT_CURSOR } }))

        expect(screen.getByText(UI_TEXT_ACTIVE)).toBeInTheDocument()
        expect(
          screen.queryByText(UI_TEXT_TOP_PERFORMER)
        ).not.toBeInTheDocument()
      })
    })

    describe('attempts table', () => {
      it('should display attempts card header', async () => {
        mockGetAttemptsByAgent.mockResolvedValue([
          {
            id: MOCK_ATTEMPT_ID_1,
            issueId: MOCK_ISSUE_ID,
            agentName: MOCK_AGENT_CURSOR,
            repo: MOCK_REPO,
            prNumber: 123,
            prUrl: MOCK_PR_URL,
            branch: MOCK_BRANCH,
            openedAt: MOCK_OPENED_DATE,
            mergedAt: null,
            closedAt: null,
            status: MOCK_STATUS_OPEN,
            commitCount: 3,
            lastCommitSha: MOCK_COMMIT_SHA,
            ciStatus: null,
            ciLastCheckedAt: null,
            sourceAttachmentId: null,
            sourceAttachmentUrl: null,
            issueLinearKey: MOCK_LINEAR_KEY,
          },
        ])

        mockGetAgentStats.mockResolvedValue([
          {
            agentName: MOCK_AGENT_CURSOR,
            issues: 8,
            prs: 10,
            dnf: 2,
            attempts: 1,
            wins: 0,
            acceptancePct: 0.0,
            ordinal: 1500,
            gamesPlayed: 1,
          },
        ])

        render(await AgentPage({ params: { agentName: MOCK_AGENT_CURSOR } }))

        expect(screen.getByText('Attempts')).toBeInTheDocument()
        expect(
          screen.getByText(`All pull request attempts by ${MOCK_AGENT_CURSOR}`)
        ).toBeInTheDocument()
      })

      it('should display table headers', async () => {
        mockGetAttemptsByAgent.mockResolvedValue([
          {
            id: MOCK_ATTEMPT_ID_1,
            issueId: MOCK_ISSUE_ID,
            agentName: MOCK_AGENT_CURSOR,
            repo: MOCK_REPO,
            prNumber: 123,
            prUrl: MOCK_PR_URL,
            branch: MOCK_BRANCH,
            openedAt: MOCK_OPENED_DATE,
            mergedAt: null,
            closedAt: null,
            status: MOCK_STATUS_OPEN,
            commitCount: 3,
            lastCommitSha: MOCK_COMMIT_SHA,
            ciStatus: null,
            ciLastCheckedAt: null,
            sourceAttachmentId: null,
            sourceAttachmentUrl: null,
            issueLinearKey: MOCK_LINEAR_KEY,
          },
        ])

        mockGetAgentStats.mockResolvedValue([
          {
            agentName: MOCK_AGENT_CURSOR,
            issues: 8,
            prs: 10,
            dnf: 2,
            attempts: 1,
            wins: 0,
            acceptancePct: 0.0,
            ordinal: 1500,
            gamesPlayed: 1,
          },
        ])

        render(await AgentPage({ params: { agentName: MOCK_AGENT_CURSOR } }))

        expect(screen.getByText('Issue')).toBeInTheDocument()
        expect(screen.getByText('PR Number')).toBeInTheDocument()
        expect(screen.getByText('Status')).toBeInTheDocument()
        expect(screen.getByText('Opened Date')).toBeInTheDocument()
        expect(screen.getByText('Merged Date')).toBeInTheDocument()
        expect(screen.getByText('Commit Count')).toBeInTheDocument()
      })

      it('should display attempt data in table rows', async () => {
        mockGetAttemptsByAgent.mockResolvedValue([
          {
            id: MOCK_ATTEMPT_ID_1,
            issueId: MOCK_ISSUE_ID,
            agentName: MOCK_AGENT_CURSOR,
            repo: MOCK_REPO,
            prNumber: 123,
            prUrl: MOCK_PR_URL,
            branch: MOCK_BRANCH,
            openedAt: MOCK_OPENED_DATE,
            mergedAt: MOCK_MERGED_DATE,
            closedAt: null,
            status: MOCK_STATUS_MERGED,
            commitCount: 5,
            lastCommitSha: MOCK_COMMIT_SHA,
            ciStatus: null,
            ciLastCheckedAt: null,
            sourceAttachmentId: null,
            sourceAttachmentUrl: null,
            issueLinearKey: MOCK_LINEAR_KEY,
          },
        ])

        mockGetAgentStats.mockResolvedValue([
          {
            agentName: MOCK_AGENT_CURSOR,
            issues: 8,
            prs: 10,
            dnf: 2,
            attempts: 1,
            wins: 1,
            acceptancePct: 100.0,
            ordinal: 1550,
            gamesPlayed: 1,
          },
        ])

        render(await AgentPage({ params: { agentName: MOCK_AGENT_CURSOR } }))

        expect(screen.getByText(MOCK_LINEAR_KEY)).toBeInTheDocument()
        expect(screen.getByText('#123')).toBeInTheDocument()
        expect(screen.getByText('merged')).toBeInTheDocument()
        expect(screen.getByText('Jan 16, 2025')).toBeInTheDocument()
        expect(screen.getByText('Jan 17, 2025')).toBeInTheDocument()
        expect(screen.getByText('5')).toBeInTheDocument()
      })

      it('should link issue linear key to issue page', async () => {
        mockGetAttemptsByAgent.mockResolvedValue([
          {
            id: MOCK_ATTEMPT_ID_1,
            issueId: MOCK_ISSUE_ID,
            agentName: MOCK_AGENT_CURSOR,
            repo: MOCK_REPO,
            prNumber: 123,
            prUrl: MOCK_PR_URL,
            branch: MOCK_BRANCH,
            openedAt: MOCK_OPENED_DATE,
            mergedAt: null,
            closedAt: null,
            status: MOCK_STATUS_OPEN,
            commitCount: 3,
            lastCommitSha: MOCK_COMMIT_SHA,
            ciStatus: null,
            ciLastCheckedAt: null,
            sourceAttachmentId: null,
            sourceAttachmentUrl: null,
            issueLinearKey: MOCK_LINEAR_KEY,
          },
        ])

        mockGetAgentStats.mockResolvedValue([
          {
            agentName: MOCK_AGENT_CURSOR,
            issues: 8,
            prs: 10,
            dnf: 2,
            attempts: 1,
            wins: 0,
            acceptancePct: 0.0,
            ordinal: 1500,
            gamesPlayed: 1,
          },
        ])

        render(await AgentPage({ params: { agentName: MOCK_AGENT_CURSOR } }))

        const issueLink = screen.getByText(MOCK_LINEAR_KEY).closest('a')
        expect(issueLink).toHaveAttribute('href', `/issues/${MOCK_ISSUE_ID}`)
      })

      it('should link PR number to PR URL', async () => {
        mockGetAttemptsByAgent.mockResolvedValue([
          {
            id: MOCK_ATTEMPT_ID_1,
            issueId: MOCK_ISSUE_ID,
            agentName: MOCK_AGENT_CURSOR,
            repo: MOCK_REPO,
            prNumber: 123,
            prUrl: MOCK_PR_URL,
            branch: MOCK_BRANCH,
            openedAt: MOCK_OPENED_DATE,
            mergedAt: null,
            closedAt: null,
            status: MOCK_STATUS_OPEN,
            commitCount: 3,
            lastCommitSha: MOCK_COMMIT_SHA,
            ciStatus: null,
            ciLastCheckedAt: null,
            sourceAttachmentId: null,
            sourceAttachmentUrl: null,
            issueLinearKey: MOCK_LINEAR_KEY,
          },
        ])

        mockGetAgentStats.mockResolvedValue([
          {
            agentName: MOCK_AGENT_CURSOR,
            issues: 8,
            prs: 10,
            dnf: 2,
            attempts: 1,
            wins: 0,
            acceptancePct: 0.0,
            ordinal: 1500,
            gamesPlayed: 1,
          },
        ])

        render(await AgentPage({ params: { agentName: MOCK_AGENT_CURSOR } }))

        const prLink = screen.getByText('#123').closest('a')
        expect(prLink).toHaveAttribute('href', MOCK_PR_URL)
        expect(prLink).toHaveAttribute('target', '_blank')
        expect(prLink).toHaveAttribute('rel', 'noopener noreferrer')
      })

      it('should display "-" for null merged date', async () => {
        mockGetAttemptsByAgent.mockResolvedValue([
          {
            id: MOCK_ATTEMPT_ID_1,
            issueId: MOCK_ISSUE_ID,
            agentName: MOCK_AGENT_CURSOR,
            repo: MOCK_REPO,
            prNumber: 123,
            prUrl: MOCK_PR_URL,
            branch: MOCK_BRANCH,
            openedAt: MOCK_OPENED_DATE,
            mergedAt: null,
            closedAt: null,
            status: MOCK_STATUS_OPEN,
            commitCount: 3,
            lastCommitSha: MOCK_COMMIT_SHA,
            ciStatus: null,
            ciLastCheckedAt: null,
            sourceAttachmentId: null,
            sourceAttachmentUrl: null,
            issueLinearKey: MOCK_LINEAR_KEY,
          },
        ])

        mockGetAgentStats.mockResolvedValue([
          {
            agentName: MOCK_AGENT_CURSOR,
            issues: 8,
            prs: 10,
            dnf: 2,
            attempts: 1,
            wins: 0,
            acceptancePct: 0.0,
            ordinal: 1500,
            gamesPlayed: 1,
          },
        ])

        render(await AgentPage({ params: { agentName: MOCK_AGENT_CURSOR } }))

        // The merged date column should show "-"
        const tableCells = screen.getAllByRole('cell')
        const mergedDateCell = tableCells.find((cell) => {
          const cellText = cell.textContent
          return (
            cellText === '-' &&
            cell.previousElementSibling?.textContent?.includes('Jan')
          )
        })
        expect(mergedDateCell).toBeInTheDocument()
      })

      it('should display multiple attempts correctly', async () => {
        mockGetAttemptsByAgent.mockResolvedValue([
          {
            id: MOCK_ATTEMPT_ID_1,
            issueId: MOCK_ISSUE_ID,
            agentName: MOCK_AGENT_CURSOR,
            repo: MOCK_REPO,
            prNumber: 123,
            prUrl: MOCK_PR_URL,
            branch: MOCK_BRANCH,
            openedAt: MOCK_OPENED_DATE,
            mergedAt: MOCK_MERGED_DATE,
            closedAt: null,
            status: MOCK_STATUS_MERGED,
            commitCount: 5,
            lastCommitSha: MOCK_COMMIT_SHA,
            ciStatus: null,
            ciLastCheckedAt: null,
            sourceAttachmentId: null,
            sourceAttachmentUrl: null,
            issueLinearKey: MOCK_LINEAR_KEY,
          },
          {
            id: MOCK_ATTEMPT_ID_2,
            issueId: '456e4567-e89b-12d3-a456-426614174003',
            agentName: MOCK_AGENT_CURSOR,
            repo: MOCK_REPO,
            prNumber: 124,
            prUrl: 'https://github.com/org/repo/pull/124',
            branch: 'feature/fix-2',
            openedAt: new Date('2025-01-18T10:00:00Z'),
            mergedAt: null,
            closedAt: new Date('2025-01-19T10:00:00Z'),
            status: MOCK_STATUS_CLOSED,
            commitCount: 2,
            lastCommitSha: 'def456',
            ciStatus: null,
            ciLastCheckedAt: null,
            sourceAttachmentId: null,
            sourceAttachmentUrl: null,
            issueLinearKey: 'ENG-102',
          },
        ])

        mockGetAgentStats.mockResolvedValue([
          {
            agentName: MOCK_AGENT_CURSOR,
            issues: 8,
            prs: 10,
            dnf: 2,
            attempts: 2,
            wins: 1,
            acceptancePct: 50.0,
            ordinal: 1500,
            gamesPlayed: 2,
          },
        ])

        render(await AgentPage({ params: { agentName: MOCK_AGENT_CURSOR } }))

        expect(screen.getByText('ENG-101')).toBeInTheDocument()
        expect(screen.getByText('ENG-102')).toBeInTheDocument()
        expect(screen.getByText('#123')).toBeInTheDocument()
        expect(screen.getByText('#124')).toBeInTheDocument()
        expect(screen.getByText('merged')).toBeInTheDocument()
        expect(screen.getByText('closed')).toBeInTheDocument()
      })

      describe('attempt status badges', () => {
        it('should display default variant for merged status', async () => {
          mockGetAttemptsByAgent.mockResolvedValue([
            {
              id: MOCK_ATTEMPT_ID_1,
              issueId: MOCK_ISSUE_ID,
              agentName: MOCK_AGENT_CURSOR,
              repo: MOCK_REPO,
              prNumber: 123,
              prUrl: MOCK_PR_URL,
              branch: MOCK_BRANCH,
              openedAt: MOCK_OPENED_DATE,
              mergedAt: MOCK_MERGED_DATE,
              closedAt: null,
              status: MOCK_STATUS_MERGED,
              commitCount: 5,
              lastCommitSha: MOCK_COMMIT_SHA,
              ciStatus: null,
              ciLastCheckedAt: null,
              sourceAttachmentId: null,
              sourceAttachmentUrl: null,
              issueLinearKey: MOCK_LINEAR_KEY,
            },
          ])

          mockGetAgentStats.mockResolvedValue([
            {
              agentName: MOCK_AGENT_CURSOR,
              issues: 8,
              prs: 10,
              dnf: 2,
              attempts: 1,
              wins: 1,
              acceptancePct: 100.0,
              ordinal: 1550,
              gamesPlayed: 1,
            },
          ])

          render(await AgentPage({ params: { agentName: MOCK_AGENT_CURSOR } }))

          expect(screen.getByText('merged')).toBeInTheDocument()
        })

        it('should display secondary variant for open status', async () => {
          mockGetAttemptsByAgent.mockResolvedValue([
            {
              id: MOCK_ATTEMPT_ID_1,
              issueId: MOCK_ISSUE_ID,
              agentName: MOCK_AGENT_CURSOR,
              repo: MOCK_REPO,
              prNumber: 123,
              prUrl: MOCK_PR_URL,
              branch: MOCK_BRANCH,
              openedAt: MOCK_OPENED_DATE,
              mergedAt: null,
              closedAt: null,
              status: MOCK_STATUS_OPEN,
              commitCount: 3,
              lastCommitSha: MOCK_COMMIT_SHA,
              ciStatus: null,
              ciLastCheckedAt: null,
              sourceAttachmentId: null,
              sourceAttachmentUrl: null,
              issueLinearKey: MOCK_LINEAR_KEY,
            },
          ])

          mockGetAgentStats.mockResolvedValue([
            {
              agentName: MOCK_AGENT_CURSOR,
              issues: 8,
              prs: 10,
              dnf: 2,
              attempts: 1,
              wins: 0,
              acceptancePct: 0.0,
              ordinal: 1500,
              gamesPlayed: 1,
            },
          ])

          render(await AgentPage({ params: { agentName: MOCK_AGENT_CURSOR } }))

          expect(screen.getByText('open')).toBeInTheDocument()
        })

        it('should display destructive variant for closed status', async () => {
          mockGetAttemptsByAgent.mockResolvedValue([
            {
              id: MOCK_ATTEMPT_ID_1,
              issueId: MOCK_ISSUE_ID,
              agentName: MOCK_AGENT_CURSOR,
              repo: MOCK_REPO,
              prNumber: 123,
              prUrl: MOCK_PR_URL,
              branch: MOCK_BRANCH,
              openedAt: MOCK_OPENED_DATE,
              mergedAt: null,
              closedAt: new Date('2025-01-18T10:00:00Z'),
              status: MOCK_STATUS_CLOSED,
              commitCount: 3,
              lastCommitSha: MOCK_COMMIT_SHA,
              ciStatus: null,
              ciLastCheckedAt: null,
              sourceAttachmentId: null,
              sourceAttachmentUrl: null,
              issueLinearKey: MOCK_LINEAR_KEY,
            },
          ])

          mockGetAgentStats.mockResolvedValue([
            {
              agentName: MOCK_AGENT_CURSOR,
              issues: 8,
              prs: 10,
              dnf: 2,
              attempts: 1,
              wins: 0,
              acceptancePct: 0.0,
              ordinal: 1500,
              gamesPlayed: 1,
            },
          ])

          render(await AgentPage({ params: { agentName: MOCK_AGENT_CURSOR } }))

          expect(screen.getByText('closed')).toBeInTheDocument()
        })

        it('should display secondary variant for invalid status', async () => {
          mockGetAttemptsByAgent.mockResolvedValue([
            {
              id: MOCK_ATTEMPT_ID_1,
              issueId: MOCK_ISSUE_ID,
              agentName: MOCK_AGENT_CURSOR,
              repo: MOCK_REPO,
              prNumber: 123,
              prUrl: MOCK_PR_URL,
              branch: MOCK_BRANCH,
              openedAt: MOCK_OPENED_DATE,
              mergedAt: null,
              closedAt: null,
              status: 'invalid-status' as 'open', // Type assertion to test invalid status
              commitCount: 3,
              lastCommitSha: MOCK_COMMIT_SHA,
              ciStatus: null,
              ciLastCheckedAt: null,
              sourceAttachmentId: null,
              sourceAttachmentUrl: null,
              issueLinearKey: MOCK_LINEAR_KEY,
            },
          ])

          mockGetAgentStats.mockResolvedValue([
            {
              agentName: MOCK_AGENT_CURSOR,
              issues: 8,
              prs: 10,
              dnf: 2,
              attempts: 1,
              wins: 0,
              acceptancePct: 0.0,
              ordinal: 1500,
              gamesPlayed: 1,
            },
          ])

          render(await AgentPage({ params: { agentName: MOCK_AGENT_CURSOR } }))

          expect(screen.getByText('invalid-status')).toBeInTheDocument()
        })
      })
    })
  })
})
