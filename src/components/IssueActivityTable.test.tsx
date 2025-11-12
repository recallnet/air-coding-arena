/**
 * Tests for IssueActivityTable component.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { IssueWithAgents } from '@/lib/queries'

import { IssueActivityTable } from './IssueActivityTable'

describe('IssueActivityTable', () => {
  const IN_PROGRESS_STATUS = 'In Progress'
  const IN_PROGRESS_FILTER_LABEL = 'In Progress'

  const mockIssue: IssueWithAgents = {
    id: '1',
    linearKey: 'ENG-320',
    title: 'Test issue',
    status: IN_PROGRESS_STATUS,
    url: 'https://linear.app/test/issue/ENG-320',
    arenaReadyLabeledAt: new Date('2025-11-10'),
    agents: [{ agentName: 'cursor', status: 'submitted' as const }],
    lastActivityAt: new Date('2025-11-12'),
    openPRCount: 1,
    mergedPRCount: 0,
  }

  describe('rendering issues', () => {
    it('should render issue rows', () => {
      render(<IssueActivityTable issues={[mockIssue]} />)
      expect(screen.getByText('ENG-320')).toBeInTheDocument()
      expect(screen.getByText('Test issue')).toBeInTheDocument()
      expect(screen.getByText('C')).toBeInTheDocument() // Avatar initial
    })

    it('should render multiple issues', () => {
      const issues: IssueWithAgents[] = [
        mockIssue,
        {
          ...mockIssue,
          id: '2',
          linearKey: 'ENG-321',
          title: 'Another issue',
        },
      ]
      render(<IssueActivityTable issues={issues} />)
      expect(screen.getByText('ENG-320')).toBeInTheDocument()
      expect(screen.getByText('ENG-321')).toBeInTheDocument()
    })

    it('should render status badge', () => {
      const { container } = render(<IssueActivityTable issues={[mockIssue]} />)
      // Check that the badge (not the filter button) contains "In Progress"
      const badge = container.querySelector('.bg-amber-100')
      expect(badge).toHaveTextContent(IN_PROGRESS_STATUS)
    })

    it('should render agent avatars', () => {
      const issueWithMultipleAgents: IssueWithAgents = {
        ...mockIssue,
        agents: [
          { agentName: 'cursor', status: 'submitted' },
          { agentName: 'engine', status: 'accepted' },
        ],
      }
      render(<IssueActivityTable issues={[issueWithMultipleAgents]} />)
      expect(screen.getByText('C')).toBeInTheDocument()
      expect(screen.getByText('E')).toBeInTheDocument()
    })

    it('should render PR counts when present', () => {
      const issueWithPRs: IssueWithAgents = {
        ...mockIssue,
        openPRCount: 2,
        mergedPRCount: 1,
      }
      render(<IssueActivityTable issues={[issueWithPRs]} />)
      expect(screen.getByText('2 open PRs')).toBeInTheDocument()
      expect(screen.getByText('1 merged')).toBeInTheDocument()
    })

    it('should render singular PR text when count is 1', () => {
      const issueWithOnePR: IssueWithAgents = {
        ...mockIssue,
        openPRCount: 1,
        mergedPRCount: 0,
      }
      render(<IssueActivityTable issues={[issueWithOnePR]} />)
      expect(screen.getByText('1 open PR')).toBeInTheDocument()
    })

    it('should not render PR counts when zero', () => {
      const issueNoPRs: IssueWithAgents = {
        ...mockIssue,
        openPRCount: 0,
        mergedPRCount: 0,
      }
      render(<IssueActivityTable issues={[issueNoPRs]} />)
      expect(screen.queryByText(/open PR/)).not.toBeInTheDocument()
      expect(screen.queryByText(/merged/)).not.toBeInTheDocument()
    })

    it('should render relative time', () => {
      const issueToday: IssueWithAgents = {
        ...mockIssue,
        lastActivityAt: new Date(),
      }
      render(<IssueActivityTable issues={[issueToday]} />)
      expect(screen.getByText('Today')).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('should render empty state when no issues', () => {
      render(<IssueActivityTable issues={[]} />)
      expect(screen.getByText('No active issues')).toBeInTheDocument()
    })

    it('should not render table when empty', () => {
      const { container } = render(<IssueActivityTable issues={[]} />)
      const borders = container.querySelectorAll('.divide-y')
      expect(borders).toHaveLength(0)
    })
  })

  describe('filtering', () => {
    const openIssue: IssueWithAgents = {
      ...mockIssue,
      id: '1',
      linearKey: 'ENG-1',
      title: 'Open issue',
      status: 'Todo',
    }

    const backlogIssue: IssueWithAgents = {
      ...mockIssue,
      id: '2',
      linearKey: 'ENG-2',
      title: 'Backlog issue',
      status: 'Backlog',
    }

    const inProgressIssue: IssueWithAgents = {
      ...mockIssue,
      id: '3',
      linearKey: 'ENG-3',
      title: 'In progress issue',
      status: IN_PROGRESS_STATUS,
    }

    const inReviewIssue: IssueWithAgents = {
      ...mockIssue,
      id: '4',
      linearKey: 'ENG-4',
      title: 'In review issue',
      status: 'In Review',
    }

    const completedIssue: IssueWithAgents = {
      ...mockIssue,
      id: '5',
      linearKey: 'ENG-5',
      title: 'Completed issue',
      status: 'Done',
    }

    const cancelledIssue: IssueWithAgents = {
      ...mockIssue,
      id: '6',
      linearKey: 'ENG-6',
      title: 'Cancelled issue',
      status: 'Canceled',
    }

    const allIssues = [
      openIssue,
      backlogIssue,
      inProgressIssue,
      inReviewIssue,
      completedIssue,
      cancelledIssue,
    ]

    it('should show all issues by default', () => {
      render(<IssueActivityTable issues={allIssues} />)
      expect(screen.getByText('ENG-1')).toBeInTheDocument()
      expect(screen.getByText('ENG-2')).toBeInTheDocument()
      expect(screen.getByText('ENG-3')).toBeInTheDocument()
      expect(screen.getByText('ENG-4')).toBeInTheDocument()
      expect(screen.getByText('ENG-5')).toBeInTheDocument()
      expect(screen.getByText('ENG-6')).toBeInTheDocument()
    })

    it('should filter by open status (Todo and Backlog)', async () => {
      const user = userEvent.setup()
      render(<IssueActivityTable issues={allIssues} />)

      await user.click(screen.getByRole('button', { name: 'Open' }))

      expect(screen.getByText('ENG-1')).toBeInTheDocument()
      expect(screen.getByText('ENG-2')).toBeInTheDocument()
      expect(screen.queryByText('ENG-3')).not.toBeInTheDocument()
      expect(screen.queryByText('ENG-4')).not.toBeInTheDocument()
      expect(screen.queryByText('ENG-5')).not.toBeInTheDocument()
      expect(screen.queryByText('ENG-6')).not.toBeInTheDocument()
    })

    it('should filter by in_progress status (In Progress and In Review)', async () => {
      const user = userEvent.setup()
      render(<IssueActivityTable issues={allIssues} />)

      await user.click(
        screen.getByRole('button', { name: IN_PROGRESS_FILTER_LABEL })
      )

      expect(screen.queryByText('ENG-1')).not.toBeInTheDocument()
      expect(screen.queryByText('ENG-2')).not.toBeInTheDocument()
      expect(screen.getByText('ENG-3')).toBeInTheDocument()
      expect(screen.getByText('ENG-4')).toBeInTheDocument()
      expect(screen.queryByText('ENG-5')).not.toBeInTheDocument()
      expect(screen.queryByText('ENG-6')).not.toBeInTheDocument()
    })

    it('should filter by completed status (Done)', async () => {
      const user = userEvent.setup()
      render(<IssueActivityTable issues={allIssues} />)

      await user.click(screen.getByRole('button', { name: 'Completed' }))

      expect(screen.queryByText('ENG-1')).not.toBeInTheDocument()
      expect(screen.queryByText('ENG-2')).not.toBeInTheDocument()
      expect(screen.queryByText('ENG-3')).not.toBeInTheDocument()
      expect(screen.queryByText('ENG-4')).not.toBeInTheDocument()
      expect(screen.getByText('ENG-5')).toBeInTheDocument()
      expect(screen.queryByText('ENG-6')).not.toBeInTheDocument()
    })

    it('should filter by cancelled status (Canceled)', async () => {
      const user = userEvent.setup()
      render(<IssueActivityTable issues={allIssues} />)

      await user.click(screen.getByRole('button', { name: 'Cancelled' }))

      expect(screen.queryByText('ENG-1')).not.toBeInTheDocument()
      expect(screen.queryByText('ENG-2')).not.toBeInTheDocument()
      expect(screen.queryByText('ENG-3')).not.toBeInTheDocument()
      expect(screen.queryByText('ENG-4')).not.toBeInTheDocument()
      expect(screen.queryByText('ENG-5')).not.toBeInTheDocument()
      expect(screen.getByText('ENG-6')).toBeInTheDocument()
    })

    it('should return to all issues when All filter clicked', async () => {
      const user = userEvent.setup()
      render(<IssueActivityTable issues={allIssues} />)

      // Filter first
      await user.click(screen.getByRole('button', { name: 'Open' }))
      expect(screen.queryByText('ENG-3')).not.toBeInTheDocument()

      // Then show all
      await user.click(screen.getByRole('button', { name: 'All' }))
      expect(screen.getByText('ENG-1')).toBeInTheDocument()
      expect(screen.getByText('ENG-2')).toBeInTheDocument()
      expect(screen.getByText('ENG-3')).toBeInTheDocument()
      expect(screen.getByText('ENG-4')).toBeInTheDocument()
      expect(screen.getByText('ENG-5')).toBeInTheDocument()
      expect(screen.getByText('ENG-6')).toBeInTheDocument()
    })

    it('should show empty state when filter results in no matches', async () => {
      const user = userEvent.setup()
      render(<IssueActivityTable issues={[openIssue]} />)

      await user.click(screen.getByRole('button', { name: 'Completed' }))
      expect(screen.getByText('No active issues')).toBeInTheDocument()
    })

    it('should handle null status as not matching any filter', () => {
      const issueNoStatus: IssueWithAgents = {
        ...mockIssue,
        status: null,
        linearKey: 'ENG-NULL',
      }
      render(<IssueActivityTable issues={[issueNoStatus, openIssue]} />)

      // All filter should show both
      expect(screen.getByText('ENG-NULL')).toBeInTheDocument()
      expect(screen.getByText('ENG-1')).toBeInTheDocument()
    })
  })

  describe('filter component integration', () => {
    it('should render IssueStatusFilter component', () => {
      render(<IssueActivityTable issues={[mockIssue]} />)
      expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: IN_PROGRESS_FILTER_LABEL })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Completed' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Cancelled' })
      ).toBeInTheDocument()
    })

    it('should highlight active filter', async () => {
      const user = userEvent.setup()
      render(<IssueActivityTable issues={[mockIssue]} />)

      const openButton = screen.getByRole('button', { name: 'Open' })
      await user.click(openButton)

      expect(openButton).toHaveClass('bg-blue-600')
    })
  })

  describe('layout and styling', () => {
    it('should use GitHub-style list layout (not traditional table)', () => {
      const { container } = render(<IssueActivityTable issues={[mockIssue]} />)

      // Should have divs with borders, not table elements
      expect(container.querySelector('table')).not.toBeInTheDocument()
      expect(
        container.querySelector('.divide-y.divide-border')
      ).toBeInTheDocument()
    })

    it('should have hover state class', () => {
      const { container } = render(<IssueActivityTable issues={[mockIssue]} />)

      const issueRow = container.querySelector(
        '.hover\\:bg-background-secondary'
      )
      expect(issueRow).toBeInTheDocument()
    })

    it('should render agent avatars on the right side', () => {
      const { container } = render(<IssueActivityTable issues={[mockIssue]} />)

      // The avatar group should be in a flex-shrink-0 container (right side)
      const avatarContainer = container.querySelector('.flex-shrink-0')
      expect(avatarContainer).toBeInTheDocument()
      expect(
        avatarContainer?.querySelector('[role="group"]')
      ).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should have accessible links', () => {
      render(<IssueActivityTable issues={[mockIssue]} />)
      const link = screen.getByRole('link', { name: 'ENG-320' })
      expect(link).toHaveAttribute('href', '/issues/1')
    })

    it('should have proper filter button roles', () => {
      render(<IssueActivityTable issues={[mockIssue]} />)
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })
  })
})
