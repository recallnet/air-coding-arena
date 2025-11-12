/**
 * Tests for Issues list page.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { createMockIssue } from '@/test-utils/factories'
import type { IssueWithAttemptData } from '@/types/database'

import IssuesPage from './page'

// Mock the getIssues query function
vi.mock('@/lib/queries', () => ({
  getIssues: vi.fn(),
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

// Import after mocking to get the mocked version
// eslint-disable-next-line import/order -- Must import after mock
import { getIssues } from '@/lib/queries'

const mockGetIssues = vi.mocked(getIssues)

// Test constants to avoid duplication
const MOCK_ISSUE_ID = '123e4567-e89b-12d3-a456-426614174000'
const MOCK_LINEAR_ID = 'linear-123'
const MOCK_LINEAR_KEY = 'ENG-101'
const MOCK_ISSUE_TITLE = 'Fix authentication bug'
const MOCK_LINEAR_URL = 'https://linear.app/issue/123'
const MOCK_REPO = 'org/repo'
const MOCK_STATUS_IN_PROGRESS = 'In Progress'
const MOCK_READY_DATE = new Date('2025-01-15T10:00:00Z')
const MOCK_CREATED_DATE = new Date('2025-01-10T10:00:00Z')

describe('IssuesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when issues are available', () => {
    it('should display the page title and subtitle', async () => {
      const mockIssues: IssueWithAttemptData[] = [
        {
          ...createMockIssue({
            id: MOCK_ISSUE_ID,
            linearId: MOCK_LINEAR_ID,
            linearKey: MOCK_LINEAR_KEY,
            title: MOCK_ISSUE_TITLE,
            url: MOCK_LINEAR_URL,
            repo: MOCK_REPO,
            status: MOCK_STATUS_IN_PROGRESS,
            arenaReadyLabeledAt: MOCK_READY_DATE,
            createdAt: MOCK_CREATED_DATE,
          }),
          attemptCount: 2,
          winnerAgentName: null,
        },
      ]

      mockGetIssues.mockResolvedValue(mockIssues)

      render(await IssuesPage())

      expect(
        screen.getByRole('heading', { name: 'Arena Issues' })
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'All issues labeled as arena-ready for agent challenges'
        )
      ).toBeInTheDocument()
    })

    it('should display the card title and description', async () => {
      const mockIssues: IssueWithAttemptData[] = [
        {
          ...createMockIssue({
            id: MOCK_ISSUE_ID,
            linearId: MOCK_LINEAR_ID,
            linearKey: MOCK_LINEAR_KEY,
            title: MOCK_ISSUE_TITLE,
            url: MOCK_LINEAR_URL,
            repo: MOCK_REPO,
            status: MOCK_STATUS_IN_PROGRESS,
            arenaReadyLabeledAt: MOCK_READY_DATE,
            createdAt: MOCK_CREATED_DATE,
          }),
          attemptCount: 2,
          winnerAgentName: null,
        },
      ]

      mockGetIssues.mockResolvedValue(mockIssues)

      render(await IssuesPage())

      expect(screen.getByText('Issues')).toBeInTheDocument()
      expect(
        screen.getByText('Track issue progress, attempts, and winners')
      ).toBeInTheDocument()
    })

    it('should display table headers', async () => {
      const mockIssues: IssueWithAttemptData[] = [
        {
          ...createMockIssue({
            id: MOCK_ISSUE_ID,
            linearId: MOCK_LINEAR_ID,
            linearKey: MOCK_LINEAR_KEY,
            title: MOCK_ISSUE_TITLE,
            url: MOCK_LINEAR_URL,
            repo: MOCK_REPO,
            status: MOCK_STATUS_IN_PROGRESS,
            arenaReadyLabeledAt: MOCK_READY_DATE,
            createdAt: MOCK_CREATED_DATE,
          }),
          attemptCount: 2,
          winnerAgentName: null,
        },
      ]

      mockGetIssues.mockResolvedValue(mockIssues)

      render(await IssuesPage())

      expect(screen.getByText('Linear Key')).toBeInTheDocument()
      expect(screen.getByText('Title')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Attempts')).toBeInTheDocument()
      expect(screen.getByText('Winner')).toBeInTheDocument()
      expect(screen.getByText('Labeled Date')).toBeInTheDocument()
    })

    it('should display issue data in table rows', async () => {
      const mockIssues: IssueWithAttemptData[] = [
        {
          ...createMockIssue({
            id: MOCK_ISSUE_ID,
            linearId: MOCK_LINEAR_ID,
            linearKey: MOCK_LINEAR_KEY,
            title: MOCK_ISSUE_TITLE,
            url: MOCK_LINEAR_URL,
            repo: MOCK_REPO,
            status: MOCK_STATUS_IN_PROGRESS,
            arenaReadyLabeledAt: MOCK_READY_DATE,
            createdAt: MOCK_CREATED_DATE,
          }),
          attemptCount: 2,
          winnerAgentName: null,
        },
        {
          ...createMockIssue({
            id: '223e4567-e89b-12d3-a456-426614174001',
            linearId: 'linear-456',
            linearKey: 'ENG-102',
            title: 'Add new feature',
            url: 'https://linear.app/issue/456',
            repo: MOCK_REPO,
            status: 'Done',
            arenaReadyLabeledAt: new Date('2025-01-20T10:00:00Z'),
            winnerAttemptId: 'winner-123',
            createdAt: new Date('2025-01-15T10:00:00Z'),
          }),
          attemptCount: 3,
          winnerAgentName: 'cursor',
        },
      ]

      mockGetIssues.mockResolvedValue(mockIssues)

      render(await IssuesPage())

      expect(screen.getByText('ENG-101')).toBeInTheDocument()
      expect(screen.getByText('ENG-102')).toBeInTheDocument()
      expect(screen.getByText('Fix authentication bug')).toBeInTheDocument()
      expect(screen.getByText('Add new feature')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('should create links to issue detail pages with correct href', async () => {
      const mockIssues: IssueWithAttemptData[] = [
        {
          ...createMockIssue({
            id: MOCK_ISSUE_ID,
            linearId: MOCK_LINEAR_ID,
            linearKey: MOCK_LINEAR_KEY,
            title: MOCK_ISSUE_TITLE,
            url: MOCK_LINEAR_URL,
            repo: MOCK_REPO,
            status: MOCK_STATUS_IN_PROGRESS,
            arenaReadyLabeledAt: MOCK_READY_DATE,
            createdAt: MOCK_CREATED_DATE,
          }),
          attemptCount: 2,
          winnerAgentName: null,
        },
      ]

      mockGetIssues.mockResolvedValue(mockIssues)

      render(await IssuesPage())

      const link = screen.getByText('ENG-101').closest('a')
      expect(link).toHaveAttribute(
        'href',
        '/issues/123e4567-e89b-12d3-a456-426614174000'
      )
    })

    it('should display formatted dates correctly', async () => {
      const mockIssues: IssueWithAttemptData[] = [
        {
          ...createMockIssue({
            id: MOCK_ISSUE_ID,
            linearId: MOCK_LINEAR_ID,
            linearKey: MOCK_LINEAR_KEY,
            title: MOCK_ISSUE_TITLE,
            url: MOCK_LINEAR_URL,
            repo: MOCK_REPO,
            status: MOCK_STATUS_IN_PROGRESS,
            arenaReadyLabeledAt: MOCK_READY_DATE,
            createdAt: MOCK_CREATED_DATE,
          }),
          attemptCount: 2,
          winnerAgentName: null,
        },
      ]

      mockGetIssues.mockResolvedValue(mockIssues)

      render(await IssuesPage())

      expect(screen.getByText('Jan 15, 2025')).toBeInTheDocument()
    })

    it('should display "-" when labeled date is null', async () => {
      const mockIssues: IssueWithAttemptData[] = [
        {
          ...createMockIssue({
            id: MOCK_ISSUE_ID,
            linearId: MOCK_LINEAR_ID,
            linearKey: MOCK_LINEAR_KEY,
            title: MOCK_ISSUE_TITLE,
            url: MOCK_LINEAR_URL,
            repo: MOCK_REPO,
            status: MOCK_STATUS_IN_PROGRESS,
            arenaReadyLabeledAt: null,
            createdAt: MOCK_CREATED_DATE,
          }),
          attemptCount: 2,
          winnerAgentName: null,
        },
      ]

      mockGetIssues.mockResolvedValue(mockIssues)

      render(await IssuesPage())

      // Find the table cells in the labeled date column
      const tableCells = screen.getAllByRole('cell')
      const labeledDateCell = tableCells.find((cell) =>
        cell.textContent?.includes('-')
      )
      expect(labeledDateCell).toBeInTheDocument()
    })

    it('should display winner agent name when available', async () => {
      const mockIssues: IssueWithAttemptData[] = [
        {
          ...createMockIssue({
            id: MOCK_ISSUE_ID,
            linearId: MOCK_LINEAR_ID,
            linearKey: MOCK_LINEAR_KEY,
            title: MOCK_ISSUE_TITLE,
            url: MOCK_LINEAR_URL,
            repo: MOCK_REPO,
            status: 'Done',
            arenaReadyLabeledAt: MOCK_READY_DATE,
            winnerAttemptId: 'winner-123',
            createdAt: MOCK_CREATED_DATE,
          }),
          attemptCount: 3,
          winnerAgentName: 'cursor',
        },
      ]

      mockGetIssues.mockResolvedValue(mockIssues)

      render(await IssuesPage())

      expect(screen.getByText('cursor')).toBeInTheDocument()
    })

    it('should display "-" when no winner exists', async () => {
      const mockIssues: IssueWithAttemptData[] = [
        {
          ...createMockIssue({
            id: MOCK_ISSUE_ID,
            linearId: MOCK_LINEAR_ID,
            linearKey: MOCK_LINEAR_KEY,
            title: MOCK_ISSUE_TITLE,
            url: MOCK_LINEAR_URL,
            repo: MOCK_REPO,
            status: MOCK_STATUS_IN_PROGRESS,
            arenaReadyLabeledAt: MOCK_READY_DATE,
            createdAt: MOCK_CREATED_DATE,
          }),
          attemptCount: 2,
          winnerAgentName: null,
        },
      ]

      mockGetIssues.mockResolvedValue(mockIssues)

      render(await IssuesPage())

      // Find the table cells in the winner column
      const tableCells = screen.getAllByRole('cell')
      const winnerCell = tableCells.find(
        (cell) => cell.textContent === '-' && cell.previousSibling
      )
      expect(winnerCell).toBeInTheDocument()
    })

    describe('status badge colors', () => {
      it('should display default variant for Done status', async () => {
        const mockIssues: IssueWithAttemptData[] = [
          {
            ...createMockIssue({
              id: MOCK_ISSUE_ID,
              linearId: MOCK_LINEAR_ID,
              linearKey: MOCK_LINEAR_KEY,
              title: MOCK_ISSUE_TITLE,
              url: MOCK_LINEAR_URL,
              repo: MOCK_REPO,
              status: 'Done',
              arenaReadyLabeledAt: MOCK_READY_DATE,
              createdAt: MOCK_CREATED_DATE,
            }),
            attemptCount: 2,
            winnerAgentName: null,
          },
        ]

        mockGetIssues.mockResolvedValue(mockIssues)

        render(await IssuesPage())

        const badge = screen.getByText('Done')
        expect(badge).toBeInTheDocument()
      })

      it('should display secondary variant for In Progress status', async () => {
        const mockIssues: IssueWithAttemptData[] = [
          {
            ...createMockIssue({
              id: MOCK_ISSUE_ID,
              linearId: MOCK_LINEAR_ID,
              linearKey: MOCK_LINEAR_KEY,
              title: MOCK_ISSUE_TITLE,
              url: MOCK_LINEAR_URL,
              repo: MOCK_REPO,
              status: MOCK_STATUS_IN_PROGRESS,
              arenaReadyLabeledAt: MOCK_READY_DATE,
              createdAt: MOCK_CREATED_DATE,
            }),
            attemptCount: 2,
            winnerAgentName: null,
          },
        ]

        mockGetIssues.mockResolvedValue(mockIssues)

        render(await IssuesPage())

        const badge = screen.getByText('In Progress')
        expect(badge).toBeInTheDocument()
      })

      it('should display secondary variant for In Review status', async () => {
        const mockIssues: IssueWithAttemptData[] = [
          {
            ...createMockIssue({
              id: MOCK_ISSUE_ID,
              linearId: MOCK_LINEAR_ID,
              linearKey: MOCK_LINEAR_KEY,
              title: MOCK_ISSUE_TITLE,
              url: MOCK_LINEAR_URL,
              repo: MOCK_REPO,
              status: 'In Review',
              arenaReadyLabeledAt: MOCK_READY_DATE,
              createdAt: MOCK_CREATED_DATE,
            }),
            attemptCount: 2,
            winnerAgentName: null,
          },
        ]

        mockGetIssues.mockResolvedValue(mockIssues)

        render(await IssuesPage())

        const badge = screen.getByText('In Review')
        expect(badge).toBeInTheDocument()
      })

      it('should display outline variant for Todo status', async () => {
        const mockIssues: IssueWithAttemptData[] = [
          {
            ...createMockIssue({
              id: MOCK_ISSUE_ID,
              linearId: MOCK_LINEAR_ID,
              linearKey: MOCK_LINEAR_KEY,
              title: MOCK_ISSUE_TITLE,
              url: MOCK_LINEAR_URL,
              repo: MOCK_REPO,
              status: 'Todo',
              arenaReadyLabeledAt: MOCK_READY_DATE,
              createdAt: MOCK_CREATED_DATE,
            }),
            attemptCount: 2,
            winnerAgentName: null,
          },
        ]

        mockGetIssues.mockResolvedValue(mockIssues)

        render(await IssuesPage())

        const badge = screen.getByText('Todo')
        expect(badge).toBeInTheDocument()
      })

      it('should display outline variant for Backlog status', async () => {
        const mockIssues: IssueWithAttemptData[] = [
          {
            ...createMockIssue({
              id: MOCK_ISSUE_ID,
              linearId: MOCK_LINEAR_ID,
              linearKey: MOCK_LINEAR_KEY,
              title: MOCK_ISSUE_TITLE,
              url: MOCK_LINEAR_URL,
              repo: MOCK_REPO,
              status: 'Backlog',
              arenaReadyLabeledAt: MOCK_READY_DATE,
              createdAt: MOCK_CREATED_DATE,
            }),
            attemptCount: 2,
            winnerAgentName: null,
          },
        ]

        mockGetIssues.mockResolvedValue(mockIssues)

        render(await IssuesPage())

        const badge = screen.getByText('Backlog')
        expect(badge).toBeInTheDocument()
      })

      it('should display destructive variant for Canceled status', async () => {
        const mockIssues: IssueWithAttemptData[] = [
          {
            ...createMockIssue({
              id: MOCK_ISSUE_ID,
              linearId: MOCK_LINEAR_ID,
              linearKey: MOCK_LINEAR_KEY,
              title: MOCK_ISSUE_TITLE,
              url: MOCK_LINEAR_URL,
              repo: MOCK_REPO,
              status: 'Canceled',
              arenaReadyLabeledAt: MOCK_READY_DATE,
              createdAt: MOCK_CREATED_DATE,
            }),
            attemptCount: 2,
            winnerAgentName: null,
          },
        ]

        mockGetIssues.mockResolvedValue(mockIssues)

        render(await IssuesPage())

        const badge = screen.getByText('Canceled')
        expect(badge).toBeInTheDocument()
      })

      it('should display outline variant and "Unknown" for null status', async () => {
        const mockIssues: IssueWithAttemptData[] = [
          {
            ...createMockIssue({
              id: MOCK_ISSUE_ID,
              linearId: MOCK_LINEAR_ID,
              linearKey: MOCK_LINEAR_KEY,
              title: MOCK_ISSUE_TITLE,
              url: MOCK_LINEAR_URL,
              repo: MOCK_REPO,
              status: null,
              arenaReadyLabeledAt: MOCK_READY_DATE,
              createdAt: MOCK_CREATED_DATE,
            }),
            attemptCount: 2,
            winnerAgentName: null,
          },
        ]

        mockGetIssues.mockResolvedValue(mockIssues)

        render(await IssuesPage())

        const badge = screen.getByText('Unknown')
        expect(badge).toBeInTheDocument()
      })
    })

    it('should display attempt count correctly', async () => {
      const mockIssues: IssueWithAttemptData[] = [
        {
          ...createMockIssue({
            id: MOCK_ISSUE_ID,
            linearId: MOCK_LINEAR_ID,
            linearKey: MOCK_LINEAR_KEY,
            title: MOCK_ISSUE_TITLE,
            url: MOCK_LINEAR_URL,
            repo: MOCK_REPO,
            status: MOCK_STATUS_IN_PROGRESS,
            arenaReadyLabeledAt: MOCK_READY_DATE,
            createdAt: MOCK_CREATED_DATE,
          }),
          attemptCount: 5,
          winnerAgentName: null,
        },
      ]

      mockGetIssues.mockResolvedValue(mockIssues)

      render(await IssuesPage())

      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('should display zero attempts correctly', async () => {
      const mockIssues: IssueWithAttemptData[] = [
        {
          ...createMockIssue({
            id: MOCK_ISSUE_ID,
            linearId: MOCK_LINEAR_ID,
            linearKey: MOCK_LINEAR_KEY,
            title: MOCK_ISSUE_TITLE,
            url: MOCK_LINEAR_URL,
            repo: MOCK_REPO,
            status: 'Todo',
            arenaReadyLabeledAt: MOCK_READY_DATE,
            createdAt: MOCK_CREATED_DATE,
          }),
          attemptCount: 0,
          winnerAgentName: null,
        },
      ]

      mockGetIssues.mockResolvedValue(mockIssues)

      render(await IssuesPage())

      expect(screen.getByText('0')).toBeInTheDocument()
    })
  })

  describe('when no issues are available', () => {
    it('should display empty state message', async () => {
      mockGetIssues.mockResolvedValue([])

      render(await IssuesPage())

      expect(
        screen.getByText('No arena-ready issues found')
      ).toBeInTheDocument()
    })

    it('should not display table headers when empty', async () => {
      mockGetIssues.mockResolvedValue([])

      render(await IssuesPage())

      expect(screen.queryByText('Linear Key')).not.toBeInTheDocument()
      expect(screen.queryByText('Title')).not.toBeInTheDocument()
      expect(screen.queryByText('Status')).not.toBeInTheDocument()
      expect(screen.queryByText('Attempts')).not.toBeInTheDocument()
      expect(screen.queryByText('Winner')).not.toBeInTheDocument()
      expect(screen.queryByText('Labeled Date')).not.toBeInTheDocument()
    })

    it('should still display page title and subtitle when empty', async () => {
      mockGetIssues.mockResolvedValue([])

      render(await IssuesPage())

      expect(
        screen.getByRole('heading', { name: 'Arena Issues' })
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'All issues labeled as arena-ready for agent challenges'
        )
      ).toBeInTheDocument()
    })

    it('should still display card header when empty', async () => {
      mockGetIssues.mockResolvedValue([])

      render(await IssuesPage())

      expect(screen.getByText('Issues')).toBeInTheDocument()
      expect(
        screen.getByText('Track issue progress, attempts, and winners')
      ).toBeInTheDocument()
    })
  })
})
