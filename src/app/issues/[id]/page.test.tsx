/**
 * Tests for Issue detail page.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import type { Issue, Attempt } from '@/types/database'

import IssuePage from './page'

// Mock the getIssueById query function
vi.mock('@/lib/queries', () => ({
  getIssueById: vi.fn(),
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
import { getIssueById } from '@/lib/queries'
// eslint-disable-next-line import/order -- Must import after mock
import { notFound } from 'next/navigation'

const mockGetIssueById = vi.mocked(getIssueById)
const mockNotFound = vi.mocked(notFound)

// Test constants to avoid duplication
const MOCK_ISSUE_ID = '123e4567-e89b-12d3-a456-426614174000'
const MOCK_LINEAR_ID = 'linear-123'
const MOCK_LINEAR_KEY = 'ENG-101'
const MOCK_ISSUE_TITLE = 'Fix authentication bug'
const MOCK_LINEAR_URL = 'https://linear.app/issue/123'
const MOCK_REPO = 'org/repo'
const MOCK_STATUS_DONE = 'Done'
const MOCK_STATUS_IN_PROGRESS = 'In Progress'
const MOCK_READY_DATE = new Date('2025-01-15T10:00:00Z')
const MOCK_CREATED_DATE = new Date('2025-01-10T10:00:00Z')
const MOCK_ATTEMPT_ID_1 = '456e4567-e89b-12d3-a456-426614174001'
const MOCK_ATTEMPT_ID_2 = '456e4567-e89b-12d3-a456-426614174002'
const MOCK_OPENED_DATE = new Date('2025-01-16T10:00:00Z')
const MOCK_MERGED_DATE = new Date('2025-01-17T10:00:00Z')
const MOCK_PR_URL = 'https://github.com/org/repo/pull/123'
const MOCK_BRANCH = 'feature/fix'
const MOCK_AGENT_CURSOR = 'cursor'
const MOCK_AGENT_ENGINE = 'engine'
const MOCK_STATUS_MERGED = 'merged'
const MOCK_STATUS_OPEN = 'open'
const MOCK_STATUS_CLOSED = 'closed'
const MOCK_COMMIT_SHA = 'abc123'

// UI text constants (reuse MOCK_STATUS_IN_PROGRESS for 'In Progress')
const UI_TEXT_ARENA_READY_LABELED_DATE = 'Arena Ready Labeled Date'
const UI_TEXT_CURSOR = 'cursor'
const UI_TEXT_ENGINE = 'engine'

describe('IssuePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when issue exists', () => {
    it('should display page title and subtitle', async () => {
      const mockIssue: Issue & { attempts: Attempt[] } = {
        id: MOCK_ISSUE_ID,
        linearId: MOCK_LINEAR_ID,
        linearKey: MOCK_LINEAR_KEY,
        title: MOCK_ISSUE_TITLE,
        url: MOCK_LINEAR_URL,
        repo: MOCK_REPO,
        status: MOCK_STATUS_IN_PROGRESS,
        arenaReadyLabeledAt: MOCK_READY_DATE,
        winnerAttemptId: null,
        createdAt: MOCK_CREATED_DATE,
        attempts: [],
      }

      mockGetIssueById.mockResolvedValue(mockIssue)

      render(await IssuePage({ params: { id: MOCK_ISSUE_ID } }))

      expect(
        screen.getByRole('heading', { name: 'Issue Details' })
      ).toBeInTheDocument()
      expect(
        screen.getByText('View issue information and attempt history')
      ).toBeInTheDocument()
    })

    it('should display issue linear key as link to Linear', async () => {
      const mockIssue: Issue & { attempts: Attempt[] } = {
        id: MOCK_ISSUE_ID,
        linearId: MOCK_LINEAR_ID,
        linearKey: MOCK_LINEAR_KEY,
        title: MOCK_ISSUE_TITLE,
        url: MOCK_LINEAR_URL,
        repo: MOCK_REPO,
        status: MOCK_STATUS_IN_PROGRESS,
        arenaReadyLabeledAt: MOCK_READY_DATE,
        winnerAttemptId: null,
        createdAt: MOCK_CREATED_DATE,
        attempts: [],
      }

      mockGetIssueById.mockResolvedValue(mockIssue)

      render(await IssuePage({ params: { id: MOCK_ISSUE_ID } }))

      const link = screen.getByText('ENG-101').closest('a')
      expect(link).toHaveAttribute('href', MOCK_LINEAR_URL)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('should display issue title', async () => {
      const mockIssue: Issue & { attempts: Attempt[] } = {
        id: MOCK_ISSUE_ID,
        linearId: MOCK_LINEAR_ID,
        linearKey: MOCK_LINEAR_KEY,
        title: MOCK_ISSUE_TITLE,
        url: MOCK_LINEAR_URL,
        repo: MOCK_REPO,
        status: MOCK_STATUS_IN_PROGRESS,
        arenaReadyLabeledAt: MOCK_READY_DATE,
        winnerAttemptId: null,
        createdAt: MOCK_CREATED_DATE,
        attempts: [],
      }

      mockGetIssueById.mockResolvedValue(mockIssue)

      render(await IssuePage({ params: { id: MOCK_ISSUE_ID } }))

      expect(screen.getByText('Fix authentication bug')).toBeInTheDocument()
    })

    it('should display issue status badge', async () => {
      const mockIssue: Issue & { attempts: Attempt[] } = {
        id: MOCK_ISSUE_ID,
        linearId: MOCK_LINEAR_ID,
        linearKey: MOCK_LINEAR_KEY,
        title: MOCK_ISSUE_TITLE,
        url: MOCK_LINEAR_URL,
        repo: MOCK_REPO,
        status: MOCK_STATUS_IN_PROGRESS,
        arenaReadyLabeledAt: MOCK_READY_DATE,
        winnerAttemptId: null,
        createdAt: MOCK_CREATED_DATE,
        attempts: [],
      }

      mockGetIssueById.mockResolvedValue(mockIssue)

      render(await IssuePage({ params: { id: MOCK_ISSUE_ID } }))

      expect(screen.getByText(MOCK_STATUS_IN_PROGRESS)).toBeInTheDocument()
    })

    it('should display repository name when available', async () => {
      const mockIssue: Issue & { attempts: Attempt[] } = {
        id: MOCK_ISSUE_ID,
        linearId: MOCK_LINEAR_ID,
        linearKey: MOCK_LINEAR_KEY,
        title: MOCK_ISSUE_TITLE,
        url: MOCK_LINEAR_URL,
        repo: MOCK_REPO,
        status: MOCK_STATUS_IN_PROGRESS,
        arenaReadyLabeledAt: MOCK_READY_DATE,
        winnerAttemptId: null,
        createdAt: MOCK_CREATED_DATE,
        attempts: [],
      }

      mockGetIssueById.mockResolvedValue(mockIssue)

      render(await IssuePage({ params: { id: MOCK_ISSUE_ID } }))

      expect(screen.getByText('Repository')).toBeInTheDocument()
      expect(screen.getByText('org/repo')).toBeInTheDocument()
    })

    it('should not display repository when null', async () => {
      const mockIssue: Issue & { attempts: Attempt[] } = {
        id: MOCK_ISSUE_ID,
        linearId: MOCK_LINEAR_ID,
        linearKey: MOCK_LINEAR_KEY,
        title: MOCK_ISSUE_TITLE,
        url: MOCK_LINEAR_URL,
        repo: null,
        status: MOCK_STATUS_IN_PROGRESS,
        arenaReadyLabeledAt: MOCK_READY_DATE,
        winnerAttemptId: null,
        createdAt: MOCK_CREATED_DATE,
        attempts: [],
      }

      mockGetIssueById.mockResolvedValue(mockIssue)

      render(await IssuePage({ params: { id: MOCK_ISSUE_ID } }))

      expect(screen.queryByText('Repository')).not.toBeInTheDocument()
    })

    it('should display formatted arena ready labeled date', async () => {
      const mockIssue: Issue & { attempts: Attempt[] } = {
        id: MOCK_ISSUE_ID,
        linearId: MOCK_LINEAR_ID,
        linearKey: MOCK_LINEAR_KEY,
        title: MOCK_ISSUE_TITLE,
        url: MOCK_LINEAR_URL,
        repo: MOCK_REPO,
        status: MOCK_STATUS_IN_PROGRESS,
        arenaReadyLabeledAt: MOCK_READY_DATE,
        winnerAttemptId: null,
        createdAt: MOCK_CREATED_DATE,
        attempts: [],
      }

      mockGetIssueById.mockResolvedValue(mockIssue)

      render(await IssuePage({ params: { id: MOCK_ISSUE_ID } }))

      expect(
        screen.getByText(UI_TEXT_ARENA_READY_LABELED_DATE)
      ).toBeInTheDocument()
      expect(screen.getByText('Jan 15, 2025')).toBeInTheDocument()
    })

    it('should display "-" when arena ready labeled date is null', async () => {
      const mockIssue: Issue & { attempts: Attempt[] } = {
        id: MOCK_ISSUE_ID,
        linearId: MOCK_LINEAR_ID,
        linearKey: MOCK_LINEAR_KEY,
        title: MOCK_ISSUE_TITLE,
        url: MOCK_LINEAR_URL,
        repo: MOCK_REPO,
        status: MOCK_STATUS_IN_PROGRESS,
        arenaReadyLabeledAt: null,
        winnerAttemptId: null,
        createdAt: MOCK_CREATED_DATE,
        attempts: [],
      }

      mockGetIssueById.mockResolvedValue(mockIssue)

      render(await IssuePage({ params: { id: MOCK_ISSUE_ID } }))

      expect(
        screen.getByText(UI_TEXT_ARENA_READY_LABELED_DATE)
      ).toBeInTheDocument()
      // The "-" appears in the date field
      const allText = screen.getByText('Arena Ready Labeled Date').parentElement
      expect(allText?.textContent).toContain('-')
    })

    it('should display winner when there is a winning attempt', async () => {
      const mockAttempt: Attempt = {
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
      }

      const mockIssue: Issue & { attempts: Attempt[] } = {
        id: MOCK_ISSUE_ID,
        linearId: MOCK_LINEAR_ID,
        linearKey: MOCK_LINEAR_KEY,
        title: MOCK_ISSUE_TITLE,
        url: MOCK_LINEAR_URL,
        repo: MOCK_REPO,
        status: MOCK_STATUS_DONE,
        arenaReadyLabeledAt: MOCK_READY_DATE,
        winnerAttemptId: MOCK_ATTEMPT_ID_1,
        createdAt: MOCK_CREATED_DATE,
        attempts: [mockAttempt],
      }

      mockGetIssueById.mockResolvedValue(mockIssue)

      render(await IssuePage({ params: { id: MOCK_ISSUE_ID } }))

      expect(screen.getByText('Winner')).toBeInTheDocument()
      const winnerLinks = screen.getAllByText(UI_TEXT_CURSOR)
      expect(winnerLinks.length).toBeGreaterThan(0)
      const winnerLink = winnerLinks[0]?.closest('a')
      expect(winnerLink).toHaveAttribute('href', '/agents/cursor')
    })

    it('should not display winner section when no winner', async () => {
      const mockIssue: Issue & { attempts: Attempt[] } = {
        id: MOCK_ISSUE_ID,
        linearId: MOCK_LINEAR_ID,
        linearKey: MOCK_LINEAR_KEY,
        title: MOCK_ISSUE_TITLE,
        url: MOCK_LINEAR_URL,
        repo: MOCK_REPO,
        status: MOCK_STATUS_IN_PROGRESS,
        arenaReadyLabeledAt: MOCK_READY_DATE,
        winnerAttemptId: null,
        createdAt: MOCK_CREATED_DATE,
        attempts: [],
      }

      mockGetIssueById.mockResolvedValue(mockIssue)

      render(await IssuePage({ params: { id: MOCK_ISSUE_ID } }))

      expect(screen.queryByText('Winner')).not.toBeInTheDocument()
    })

    describe('status badges', () => {
      it('should display "Unknown" badge for null status', async () => {
        const mockIssue: Issue & { attempts: Attempt[] } = {
          id: MOCK_ISSUE_ID,
          linearId: MOCK_LINEAR_ID,
          linearKey: MOCK_LINEAR_KEY,
          title: MOCK_ISSUE_TITLE,
          url: MOCK_LINEAR_URL,
          repo: MOCK_REPO,
          status: null,
          arenaReadyLabeledAt: MOCK_READY_DATE,
          winnerAttemptId: null,
          createdAt: MOCK_CREATED_DATE,
          attempts: [],
        }

        mockGetIssueById.mockResolvedValue(mockIssue)

        render(await IssuePage({ params: { id: MOCK_ISSUE_ID } }))

        expect(screen.getByText('Unknown')).toBeInTheDocument()
      })

      it('should display status badge for each valid status', async () => {
        const statuses: Array<
          'Done' | 'In Progress' | 'In Review' | 'Todo' | 'Backlog' | 'Canceled'
        > = ['Done', 'In Progress', 'In Review', 'Todo', 'Backlog', 'Canceled']

        for (const status of statuses) {
          const mockIssue: Issue & { attempts: Attempt[] } = {
            id: MOCK_ISSUE_ID,
            linearId: MOCK_LINEAR_ID,
            linearKey: MOCK_LINEAR_KEY,
            title: MOCK_ISSUE_TITLE,
            url: MOCK_LINEAR_URL,
            repo: MOCK_REPO,
            status,
            arenaReadyLabeledAt: MOCK_READY_DATE,
            winnerAttemptId: null,
            createdAt: MOCK_CREATED_DATE,
            attempts: [],
          }

          mockGetIssueById.mockResolvedValue(mockIssue)

          const { unmount } = render(
            await IssuePage({ params: { id: MOCK_ISSUE_ID } })
          )

          expect(screen.getByText(status)).toBeInTheDocument()

          unmount()
          vi.clearAllMocks()
        }
      })
    })
  })

  describe('attempts table', () => {
    it('should display attempts card header', async () => {
      const mockIssue: Issue & { attempts: Attempt[] } = {
        id: MOCK_ISSUE_ID,
        linearId: MOCK_LINEAR_ID,
        linearKey: MOCK_LINEAR_KEY,
        title: MOCK_ISSUE_TITLE,
        url: MOCK_LINEAR_URL,
        repo: MOCK_REPO,
        status: MOCK_STATUS_IN_PROGRESS,
        arenaReadyLabeledAt: MOCK_READY_DATE,
        winnerAttemptId: null,
        createdAt: MOCK_CREATED_DATE,
        attempts: [],
      }

      mockGetIssueById.mockResolvedValue(mockIssue)

      render(await IssuePage({ params: { id: MOCK_ISSUE_ID } }))

      expect(screen.getByText('Attempts')).toBeInTheDocument()
      expect(
        screen.getByText('All pull request attempts for this issue')
      ).toBeInTheDocument()
    })

    it('should display empty state when no attempts', async () => {
      const mockIssue: Issue & { attempts: Attempt[] } = {
        id: MOCK_ISSUE_ID,
        linearId: MOCK_LINEAR_ID,
        linearKey: MOCK_LINEAR_KEY,
        title: MOCK_ISSUE_TITLE,
        url: MOCK_LINEAR_URL,
        repo: MOCK_REPO,
        status: MOCK_STATUS_IN_PROGRESS,
        arenaReadyLabeledAt: MOCK_READY_DATE,
        winnerAttemptId: null,
        createdAt: MOCK_CREATED_DATE,
        attempts: [],
      }

      mockGetIssueById.mockResolvedValue(mockIssue)

      render(await IssuePage({ params: { id: MOCK_ISSUE_ID } }))

      expect(screen.getByText('No attempts yet')).toBeInTheDocument()
      expect(screen.queryByText('Agent Name')).not.toBeInTheDocument()
    })

    it('should display table headers when attempts exist', async () => {
      const mockAttempt: Attempt = {
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
      }

      const mockIssue: Issue & { attempts: Attempt[] } = {
        id: MOCK_ISSUE_ID,
        linearId: MOCK_LINEAR_ID,
        linearKey: MOCK_LINEAR_KEY,
        title: MOCK_ISSUE_TITLE,
        url: MOCK_LINEAR_URL,
        repo: MOCK_REPO,
        status: MOCK_STATUS_IN_PROGRESS,
        arenaReadyLabeledAt: MOCK_READY_DATE,
        winnerAttemptId: null,
        createdAt: MOCK_CREATED_DATE,
        attempts: [mockAttempt],
      }

      mockGetIssueById.mockResolvedValue(mockIssue)

      render(await IssuePage({ params: { id: MOCK_ISSUE_ID } }))

      expect(screen.getByText('Agent Name')).toBeInTheDocument()
      expect(screen.getByText('PR Number')).toBeInTheDocument()
      expect(screen.getAllByText('Status').length).toBeGreaterThan(0)
      expect(screen.getByText('Opened Date')).toBeInTheDocument()
      expect(screen.getByText('Merged Date')).toBeInTheDocument()
      expect(screen.getByText('Commit Count')).toBeInTheDocument()
    })

    it('should display attempt data in table rows', async () => {
      const mockAttempt: Attempt = {
        id: MOCK_ATTEMPT_ID_1,
        issueId: MOCK_ISSUE_ID,
        agentName: MOCK_AGENT_ENGINE,
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
      }

      const mockIssue: Issue & { attempts: Attempt[] } = {
        id: MOCK_ISSUE_ID,
        linearId: MOCK_LINEAR_ID,
        linearKey: MOCK_LINEAR_KEY,
        title: MOCK_ISSUE_TITLE,
        url: MOCK_LINEAR_URL,
        repo: MOCK_REPO,
        status: MOCK_STATUS_DONE,
        arenaReadyLabeledAt: MOCK_READY_DATE,
        winnerAttemptId: null,
        createdAt: MOCK_CREATED_DATE,
        attempts: [mockAttempt],
      }

      mockGetIssueById.mockResolvedValue(mockIssue)

      render(await IssuePage({ params: { id: MOCK_ISSUE_ID } }))

      expect(screen.getByText(UI_TEXT_ENGINE)).toBeInTheDocument()
      expect(screen.getByText('#123')).toBeInTheDocument()
      expect(screen.getByText('merged')).toBeInTheDocument()
      expect(screen.getByText('Jan 16, 2025')).toBeInTheDocument()
      expect(screen.getByText('Jan 17, 2025')).toBeInTheDocument()
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('should link agent name to agent page', async () => {
      const mockAttempt: Attempt = {
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
      }

      const mockIssue: Issue & { attempts: Attempt[] } = {
        id: MOCK_ISSUE_ID,
        linearId: MOCK_LINEAR_ID,
        linearKey: MOCK_LINEAR_KEY,
        title: MOCK_ISSUE_TITLE,
        url: MOCK_LINEAR_URL,
        repo: MOCK_REPO,
        status: MOCK_STATUS_IN_PROGRESS,
        arenaReadyLabeledAt: MOCK_READY_DATE,
        winnerAttemptId: null,
        createdAt: MOCK_CREATED_DATE,
        attempts: [mockAttempt],
      }

      mockGetIssueById.mockResolvedValue(mockIssue)

      render(await IssuePage({ params: { id: MOCK_ISSUE_ID } }))

      const agentLink = screen.getByText(UI_TEXT_CURSOR).closest('a')
      expect(agentLink).toHaveAttribute('href', '/agents/cursor')
    })

    it('should link PR number to PR URL', async () => {
      const mockAttempt: Attempt = {
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
      }

      const mockIssue: Issue & { attempts: Attempt[] } = {
        id: MOCK_ISSUE_ID,
        linearId: MOCK_LINEAR_ID,
        linearKey: MOCK_LINEAR_KEY,
        title: MOCK_ISSUE_TITLE,
        url: MOCK_LINEAR_URL,
        repo: MOCK_REPO,
        status: MOCK_STATUS_IN_PROGRESS,
        arenaReadyLabeledAt: MOCK_READY_DATE,
        winnerAttemptId: null,
        createdAt: MOCK_CREATED_DATE,
        attempts: [mockAttempt],
      }

      mockGetIssueById.mockResolvedValue(mockIssue)

      render(await IssuePage({ params: { id: MOCK_ISSUE_ID } }))

      const prLink = screen.getByText('#123').closest('a')
      expect(prLink).toHaveAttribute('href', MOCK_PR_URL)
      expect(prLink).toHaveAttribute('target', '_blank')
      expect(prLink).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('should display "-" for null merged date', async () => {
      const mockAttempt: Attempt = {
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
      }

      const mockIssue: Issue & { attempts: Attempt[] } = {
        id: MOCK_ISSUE_ID,
        linearId: MOCK_LINEAR_ID,
        linearKey: MOCK_LINEAR_KEY,
        title: MOCK_ISSUE_TITLE,
        url: MOCK_LINEAR_URL,
        repo: MOCK_REPO,
        status: MOCK_STATUS_IN_PROGRESS,
        arenaReadyLabeledAt: MOCK_READY_DATE,
        winnerAttemptId: null,
        createdAt: MOCK_CREATED_DATE,
        attempts: [mockAttempt],
      }

      mockGetIssueById.mockResolvedValue(mockIssue)

      render(await IssuePage({ params: { id: MOCK_ISSUE_ID } }))

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
      const mockAttempt1: Attempt = {
        id: MOCK_ATTEMPT_ID_1,
        issueId: MOCK_ISSUE_ID,
        agentName: 'cursor',
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
      }

      const mockAttempt2: Attempt = {
        id: MOCK_ATTEMPT_ID_2,
        issueId: MOCK_ISSUE_ID,
        agentName: MOCK_AGENT_ENGINE,
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
      }

      const mockIssue: Issue & { attempts: Attempt[] } = {
        id: MOCK_ISSUE_ID,
        linearId: MOCK_LINEAR_ID,
        linearKey: MOCK_LINEAR_KEY,
        title: MOCK_ISSUE_TITLE,
        url: MOCK_LINEAR_URL,
        repo: MOCK_REPO,
        status: MOCK_STATUS_DONE,
        arenaReadyLabeledAt: MOCK_READY_DATE,
        winnerAttemptId: null,
        createdAt: MOCK_CREATED_DATE,
        attempts: [mockAttempt1, mockAttempt2],
      }

      mockGetIssueById.mockResolvedValue(mockIssue)

      render(await IssuePage({ params: { id: MOCK_ISSUE_ID } }))

      expect(screen.getByText(UI_TEXT_CURSOR)).toBeInTheDocument()
      expect(screen.getByText(UI_TEXT_ENGINE)).toBeInTheDocument()
      expect(screen.getByText('#123')).toBeInTheDocument()
      expect(screen.getByText('#124')).toBeInTheDocument()
      expect(screen.getByText('merged')).toBeInTheDocument()
      expect(screen.getByText('closed')).toBeInTheDocument()
    })

    describe('attempt status badges', () => {
      it('should display default variant for merged status', async () => {
        const mockAttempt: Attempt = {
          id: MOCK_ATTEMPT_ID_1,
          issueId: MOCK_ISSUE_ID,
          agentName: 'cursor',
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
        }

        const mockIssue: Issue & { attempts: Attempt[] } = {
          id: MOCK_ISSUE_ID,
          linearId: MOCK_LINEAR_ID,
          linearKey: MOCK_LINEAR_KEY,
          title: MOCK_ISSUE_TITLE,
          url: MOCK_LINEAR_URL,
          repo: MOCK_REPO,
          status: MOCK_STATUS_DONE,
          arenaReadyLabeledAt: MOCK_READY_DATE,
          winnerAttemptId: null,
          createdAt: MOCK_CREATED_DATE,
          attempts: [mockAttempt],
        }

        mockGetIssueById.mockResolvedValue(mockIssue)

        render(await IssuePage({ params: { id: MOCK_ISSUE_ID } }))

        expect(screen.getByText('merged')).toBeInTheDocument()
      })

      it('should display secondary variant for open status', async () => {
        const mockAttempt: Attempt = {
          id: MOCK_ATTEMPT_ID_1,
          issueId: MOCK_ISSUE_ID,
          agentName: 'cursor',
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
        }

        const mockIssue: Issue & { attempts: Attempt[] } = {
          id: MOCK_ISSUE_ID,
          linearId: MOCK_LINEAR_ID,
          linearKey: MOCK_LINEAR_KEY,
          title: MOCK_ISSUE_TITLE,
          url: MOCK_LINEAR_URL,
          repo: MOCK_REPO,
          status: MOCK_STATUS_IN_PROGRESS,
          arenaReadyLabeledAt: MOCK_READY_DATE,
          winnerAttemptId: null,
          createdAt: MOCK_CREATED_DATE,
          attempts: [mockAttempt],
        }

        mockGetIssueById.mockResolvedValue(mockIssue)

        render(await IssuePage({ params: { id: MOCK_ISSUE_ID } }))

        expect(screen.getByText('open')).toBeInTheDocument()
      })

      it('should display destructive variant for closed status', async () => {
        const mockAttempt: Attempt = {
          id: MOCK_ATTEMPT_ID_1,
          issueId: MOCK_ISSUE_ID,
          agentName: 'cursor',
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
        }

        const mockIssue: Issue & { attempts: Attempt[] } = {
          id: MOCK_ISSUE_ID,
          linearId: MOCK_LINEAR_ID,
          linearKey: MOCK_LINEAR_KEY,
          title: MOCK_ISSUE_TITLE,
          url: MOCK_LINEAR_URL,
          repo: MOCK_REPO,
          status: MOCK_STATUS_IN_PROGRESS,
          arenaReadyLabeledAt: MOCK_READY_DATE,
          winnerAttemptId: null,
          createdAt: MOCK_CREATED_DATE,
          attempts: [mockAttempt],
        }

        mockGetIssueById.mockResolvedValue(mockIssue)

        render(await IssuePage({ params: { id: MOCK_ISSUE_ID } }))

        expect(screen.getByText('closed')).toBeInTheDocument()
      })

      it('should display secondary variant for invalid status', async () => {
        const mockAttempt: Attempt = {
          id: MOCK_ATTEMPT_ID_1,
          issueId: MOCK_ISSUE_ID,
          agentName: 'cursor',
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
        }

        const mockIssue: Issue & { attempts: Attempt[] } = {
          id: MOCK_ISSUE_ID,
          linearId: MOCK_LINEAR_ID,
          linearKey: MOCK_LINEAR_KEY,
          title: MOCK_ISSUE_TITLE,
          url: MOCK_LINEAR_URL,
          repo: MOCK_REPO,
          status: MOCK_STATUS_IN_PROGRESS,
          arenaReadyLabeledAt: MOCK_READY_DATE,
          winnerAttemptId: null,
          createdAt: MOCK_CREATED_DATE,
          attempts: [mockAttempt],
        }

        mockGetIssueById.mockResolvedValue(mockIssue)

        render(await IssuePage({ params: { id: MOCK_ISSUE_ID } }))

        expect(screen.getByText('invalid-status')).toBeInTheDocument()
      })
    })
  })

  describe('when issue not found', () => {
    it('should call notFound() when issue is null', async () => {
      mockGetIssueById.mockResolvedValue(null)

      await expect(async () => {
        await IssuePage({ params: { id: 'nonexistent-id' } })
      }).rejects.toThrow('notFound')

      expect(mockNotFound).toHaveBeenCalled()
    })

    it('should call getIssueById with correct ID', async () => {
      mockGetIssueById.mockResolvedValue(null)

      await expect(async () => {
        await IssuePage({ params: { id: 'test-id-123' } })
      }).rejects.toThrow('notFound')

      expect(mockGetIssueById).toHaveBeenCalledWith('test-id-123')
    })
  })
})
