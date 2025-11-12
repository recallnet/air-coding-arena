/**
 * Tests for ActivityLog component.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { RecentActivity } from '@/lib/queries'

import { ActivityLog } from './ActivityLog'

// Test constants
const EMPTY_STATE_MESSAGE = 'No activity data available yet'
const RECENT_ACTIVITY_TITLE = 'Recent Activity'
const MOCK_DATE_1 = '2024-01-01T10:00:00Z'
const MOCK_DATE_2 = '2024-01-02T15:30:00Z'
const MOCK_ISSUE_ID_1 = 'issue-1'
const MOCK_ISSUE_TITLE_FIX_BUG = 'Fix bug'
const MOCK_ISSUE_LINEAR_KEY_1 = 'ISSUE-1'
const MOCK_PR_URL_1 = 'https://github.com/pr/1'
const MOCK_AGENT_CURSOR = 'cursor'
const MOCK_ACTIVITY_ID_1 = 'activity-1'

describe('ActivityLog', () => {
  describe('when activities are available', () => {
    it('should display the card title and description', () => {
      const mockActivities: RecentActivity[] = [
        {
          id: MOCK_ACTIVITY_ID_1,
          agentName: 'cursor',
          issueId: 'issue-1',
          issueTitle: 'Fix bug in dashboard',
          issueLinearKey: 'ISSUE-1',
          prUrl: 'https://github.com/pr/1',
          prNumber: 1,
          status: 'merged',
          openedAt: MOCK_DATE_1,
        },
      ]

      render(<ActivityLog activities={mockActivities} />)

      expect(screen.getByText(RECENT_ACTIVITY_TITLE)).toBeInTheDocument()
      expect(
        screen.getByText('Latest pull request attempts across all agents')
      ).toBeInTheDocument()
    })

    it('should display table headers', () => {
      const mockActivities: RecentActivity[] = [
        {
          id: MOCK_ACTIVITY_ID_1,
          agentName: MOCK_AGENT_CURSOR,
          issueId: MOCK_ISSUE_ID_1,
          issueTitle: MOCK_ISSUE_TITLE_FIX_BUG,
          issueLinearKey: MOCK_ISSUE_LINEAR_KEY_1,
          prUrl: MOCK_PR_URL_1,
          prNumber: 1,
          status: 'open',
          openedAt: MOCK_DATE_1,
        },
      ]

      render(<ActivityLog activities={mockActivities} />)

      expect(screen.getByText('Time')).toBeInTheDocument()
      expect(screen.getByText('Agent')).toBeInTheDocument()
      expect(screen.getByText('Issue')).toBeInTheDocument()
      expect(screen.getByText('PR')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
    })

    it('should display activity data with formatted time', () => {
      const mockActivities: RecentActivity[] = [
        {
          id: MOCK_ACTIVITY_ID_1,
          agentName: MOCK_AGENT_CURSOR,
          issueId: MOCK_ISSUE_ID_1,
          issueTitle: 'Fix bug in dashboard',
          issueLinearKey: MOCK_ISSUE_LINEAR_KEY_1,
          prUrl: MOCK_PR_URL_1,
          prNumber: 1,
          status: 'merged',
          openedAt: MOCK_DATE_1,
        },
      ]

      render(<ActivityLog activities={mockActivities} />)

      expect(screen.getByText(MOCK_AGENT_CURSOR)).toBeInTheDocument()
      expect(
        screen.getByText('ISSUE-1: Fix bug in dashboard')
      ).toBeInTheDocument()
      expect(screen.getByText('#1')).toBeInTheDocument()
      expect(screen.getByText('Merged')).toBeInTheDocument()
    })

    it('should display multiple activities', () => {
      const mockActivities: RecentActivity[] = [
        {
          id: MOCK_ACTIVITY_ID_1,
          agentName: MOCK_AGENT_CURSOR,
          issueId: MOCK_ISSUE_ID_1,
          issueTitle: MOCK_ISSUE_TITLE_FIX_BUG,
          issueLinearKey: MOCK_ISSUE_LINEAR_KEY_1,
          prUrl: MOCK_PR_URL_1,
          prNumber: 1,
          status: 'merged',
          openedAt: MOCK_DATE_2,
        },
        {
          id: 'activity-2',
          agentName: 'engine',
          issueId: 'issue-2',
          issueTitle: 'Add feature',
          issueLinearKey: 'ISSUE-2',
          prUrl: 'https://github.com/pr/2',
          prNumber: 2,
          status: 'open',
          openedAt: MOCK_DATE_1,
        },
      ]

      render(<ActivityLog activities={mockActivities} />)

      expect(screen.getByText(MOCK_AGENT_CURSOR)).toBeInTheDocument()
      expect(screen.getByText('engine')).toBeInTheDocument()
      expect(
        screen.getByText(
          `${MOCK_ISSUE_LINEAR_KEY_1}: ${MOCK_ISSUE_TITLE_FIX_BUG}`
        )
      ).toBeInTheDocument()
      expect(screen.getByText('ISSUE-2: Add feature')).toBeInTheDocument()
      expect(screen.getByText('#1')).toBeInTheDocument()
      expect(screen.getByText('#2')).toBeInTheDocument()
    })

    it('should render agent links with correct href', () => {
      const mockActivities: RecentActivity[] = [
        {
          id: MOCK_ACTIVITY_ID_1,
          agentName: MOCK_AGENT_CURSOR,
          issueId: MOCK_ISSUE_ID_1,
          issueTitle: MOCK_ISSUE_TITLE_FIX_BUG,
          issueLinearKey: MOCK_ISSUE_LINEAR_KEY_1,
          prUrl: MOCK_PR_URL_1,
          prNumber: 1,
          status: 'open',
          openedAt: MOCK_DATE_1,
        },
      ]

      render(<ActivityLog activities={mockActivities} />)

      const agentLink = screen.getByText(MOCK_AGENT_CURSOR)
      expect(agentLink).toHaveAttribute('href', `/agents/${MOCK_AGENT_CURSOR}`)
    })

    it('should render issue links with correct href', () => {
      const mockIssueId = 'issue-123'
      const mockActivities: RecentActivity[] = [
        {
          id: MOCK_ACTIVITY_ID_1,
          agentName: MOCK_AGENT_CURSOR,
          issueId: mockIssueId,
          issueTitle: MOCK_ISSUE_TITLE_FIX_BUG,
          issueLinearKey: MOCK_ISSUE_LINEAR_KEY_1,
          prUrl: MOCK_PR_URL_1,
          prNumber: 1,
          status: 'open',
          openedAt: MOCK_DATE_1,
        },
      ]

      render(<ActivityLog activities={mockActivities} />)

      const issueLink = screen.getByText(
        `${MOCK_ISSUE_LINEAR_KEY_1}: ${MOCK_ISSUE_TITLE_FIX_BUG}`
      )
      expect(issueLink).toHaveAttribute('href', `/issues/${mockIssueId}`)
    })

    it('should render PR links with correct href and target', () => {
      const mockActivities: RecentActivity[] = [
        {
          id: MOCK_ACTIVITY_ID_1,
          agentName: 'cursor',
          issueId: 'issue-1',
          issueTitle: 'Fix bug',
          issueLinearKey: 'ISSUE-1',
          prUrl: 'https://github.com/owner/repo/pull/42',
          prNumber: 42,
          status: 'open',
          openedAt: MOCK_DATE_1,
        },
      ]

      render(<ActivityLog activities={mockActivities} />)

      const prLink = screen.getByText('#42')
      expect(prLink).toHaveAttribute(
        'href',
        'https://github.com/owner/repo/pull/42'
      )
      expect(prLink).toHaveAttribute('target', '_blank')
      expect(prLink).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('should display merged status with success badge', () => {
      const mockActivities: RecentActivity[] = [
        {
          id: MOCK_ACTIVITY_ID_1,
          agentName: MOCK_AGENT_CURSOR,
          issueId: MOCK_ISSUE_ID_1,
          issueTitle: MOCK_ISSUE_TITLE_FIX_BUG,
          issueLinearKey: MOCK_ISSUE_LINEAR_KEY_1,
          prUrl: MOCK_PR_URL_1,
          prNumber: 1,
          status: 'merged',
          openedAt: MOCK_DATE_1,
        },
      ]

      render(<ActivityLog activities={mockActivities} />)

      const badge = screen.getByText('Merged')
      expect(badge).toBeInTheDocument()
    })

    it('should display closed status with error badge', () => {
      const mockActivities: RecentActivity[] = [
        {
          id: MOCK_ACTIVITY_ID_1,
          agentName: MOCK_AGENT_CURSOR,
          issueId: MOCK_ISSUE_ID_1,
          issueTitle: MOCK_ISSUE_TITLE_FIX_BUG,
          issueLinearKey: MOCK_ISSUE_LINEAR_KEY_1,
          prUrl: MOCK_PR_URL_1,
          prNumber: 1,
          status: 'closed',
          openedAt: MOCK_DATE_1,
        },
      ]

      render(<ActivityLog activities={mockActivities} />)

      const badge = screen.getByText('Closed')
      expect(badge).toBeInTheDocument()
    })

    it('should display open status with default badge', () => {
      const mockActivities: RecentActivity[] = [
        {
          id: MOCK_ACTIVITY_ID_1,
          agentName: MOCK_AGENT_CURSOR,
          issueId: MOCK_ISSUE_ID_1,
          issueTitle: MOCK_ISSUE_TITLE_FIX_BUG,
          issueLinearKey: MOCK_ISSUE_LINEAR_KEY_1,
          prUrl: MOCK_PR_URL_1,
          prNumber: 1,
          status: 'open',
          openedAt: MOCK_DATE_1,
        },
      ]

      render(<ActivityLog activities={mockActivities} />)

      const badge = screen.getByText('Open')
      expect(badge).toBeInTheDocument()
    })
  })

  describe('when no activities are available', () => {
    it('should display empty state message', () => {
      render(<ActivityLog activities={[]} />)

      expect(screen.getByText(EMPTY_STATE_MESSAGE)).toBeInTheDocument()
    })

    it('should not display table when empty', () => {
      render(<ActivityLog activities={[]} />)

      expect(screen.queryByText('Time')).not.toBeInTheDocument()
      expect(screen.queryByText('Agent')).not.toBeInTheDocument()
    })

    it('should still display card title and description when empty', () => {
      render(<ActivityLog activities={[]} />)

      expect(screen.getByText(RECENT_ACTIVITY_TITLE)).toBeInTheDocument()
      expect(
        screen.getByText('Latest pull request attempts across all agents')
      ).toBeInTheDocument()
    })
  })

  describe('time formatting', () => {
    it('should display "Just now" for times less than 1 minute ago', () => {
      const now = new Date()
      const lessThanMinuteAgo = new Date(now.getTime() - 30000) // 30 seconds ago

      const mockActivities: RecentActivity[] = [
        {
          id: MOCK_ACTIVITY_ID_1,
          agentName: MOCK_AGENT_CURSOR,
          issueId: MOCK_ISSUE_ID_1,
          issueTitle: MOCK_ISSUE_TITLE_FIX_BUG,
          issueLinearKey: MOCK_ISSUE_LINEAR_KEY_1,
          prUrl: MOCK_PR_URL_1,
          prNumber: 1,
          status: 'open',
          openedAt: lessThanMinuteAgo.toISOString(),
        },
      ]

      render(<ActivityLog activities={mockActivities} />)

      expect(screen.getByText('Just now')).toBeInTheDocument()
    })

    it('should display minutes for times between 1 and 60 minutes ago', () => {
      const now = new Date()
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000)

      const mockActivities: RecentActivity[] = [
        {
          id: MOCK_ACTIVITY_ID_1,
          agentName: MOCK_AGENT_CURSOR,
          issueId: MOCK_ISSUE_ID_1,
          issueTitle: MOCK_ISSUE_TITLE_FIX_BUG,
          issueLinearKey: MOCK_ISSUE_LINEAR_KEY_1,
          prUrl: MOCK_PR_URL_1,
          prNumber: 1,
          status: 'open',
          openedAt: fiveMinutesAgo.toISOString(),
        },
      ]

      render(<ActivityLog activities={mockActivities} />)

      expect(screen.getByText('5 minutes ago')).toBeInTheDocument()
    })

    it('should display singular "minute" for 1 minute ago', () => {
      const now = new Date()
      const oneMinuteAgo = new Date(now.getTime() - 60000)

      const mockActivities: RecentActivity[] = [
        {
          id: MOCK_ACTIVITY_ID_1,
          agentName: MOCK_AGENT_CURSOR,
          issueId: MOCK_ISSUE_ID_1,
          issueTitle: MOCK_ISSUE_TITLE_FIX_BUG,
          issueLinearKey: MOCK_ISSUE_LINEAR_KEY_1,
          prUrl: MOCK_PR_URL_1,
          prNumber: 1,
          status: 'open',
          openedAt: oneMinuteAgo.toISOString(),
        },
      ]

      render(<ActivityLog activities={mockActivities} />)

      expect(screen.getByText('1 minute ago')).toBeInTheDocument()
    })

    it('should display hours for times between 1 and 24 hours ago', () => {
      const now = new Date()
      const threeHoursAgo = new Date(now.getTime() - 3 * 3600000)

      const mockActivities: RecentActivity[] = [
        {
          id: MOCK_ACTIVITY_ID_1,
          agentName: MOCK_AGENT_CURSOR,
          issueId: MOCK_ISSUE_ID_1,
          issueTitle: MOCK_ISSUE_TITLE_FIX_BUG,
          issueLinearKey: MOCK_ISSUE_LINEAR_KEY_1,
          prUrl: MOCK_PR_URL_1,
          prNumber: 1,
          status: 'open',
          openedAt: threeHoursAgo.toISOString(),
        },
      ]

      render(<ActivityLog activities={mockActivities} />)

      expect(screen.getByText('3 hours ago')).toBeInTheDocument()
    })

    it('should display singular "hour" for 1 hour ago', () => {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 3600000)

      const mockActivities: RecentActivity[] = [
        {
          id: MOCK_ACTIVITY_ID_1,
          agentName: MOCK_AGENT_CURSOR,
          issueId: MOCK_ISSUE_ID_1,
          issueTitle: MOCK_ISSUE_TITLE_FIX_BUG,
          issueLinearKey: MOCK_ISSUE_LINEAR_KEY_1,
          prUrl: MOCK_PR_URL_1,
          prNumber: 1,
          status: 'open',
          openedAt: oneHourAgo.toISOString(),
        },
      ]

      render(<ActivityLog activities={mockActivities} />)

      expect(screen.getByText('1 hour ago')).toBeInTheDocument()
    })

    it('should display days for times between 1 and 7 days ago', () => {
      const now = new Date()
      const threeDaysAgo = new Date(now.getTime() - 3 * 86400000)

      const mockActivities: RecentActivity[] = [
        {
          id: MOCK_ACTIVITY_ID_1,
          agentName: MOCK_AGENT_CURSOR,
          issueId: MOCK_ISSUE_ID_1,
          issueTitle: MOCK_ISSUE_TITLE_FIX_BUG,
          issueLinearKey: MOCK_ISSUE_LINEAR_KEY_1,
          prUrl: MOCK_PR_URL_1,
          prNumber: 1,
          status: 'open',
          openedAt: threeDaysAgo.toISOString(),
        },
      ]

      render(<ActivityLog activities={mockActivities} />)

      expect(screen.getByText('3 days ago')).toBeInTheDocument()
    })

    it('should display singular "day" for 1 day ago', () => {
      const now = new Date()
      const oneDayAgo = new Date(now.getTime() - 86400000)

      const mockActivities: RecentActivity[] = [
        {
          id: MOCK_ACTIVITY_ID_1,
          agentName: MOCK_AGENT_CURSOR,
          issueId: MOCK_ISSUE_ID_1,
          issueTitle: MOCK_ISSUE_TITLE_FIX_BUG,
          issueLinearKey: MOCK_ISSUE_LINEAR_KEY_1,
          prUrl: MOCK_PR_URL_1,
          prNumber: 1,
          status: 'open',
          openedAt: oneDayAgo.toISOString(),
        },
      ]

      render(<ActivityLog activities={mockActivities} />)

      expect(screen.getByText('1 day ago')).toBeInTheDocument()
    })

    it('should display formatted date for times more than 7 days ago', () => {
      const now = new Date()
      const tenDaysAgo = new Date(now.getTime() - 10 * 86400000)

      const mockActivities: RecentActivity[] = [
        {
          id: MOCK_ACTIVITY_ID_1,
          agentName: MOCK_AGENT_CURSOR,
          issueId: MOCK_ISSUE_ID_1,
          issueTitle: MOCK_ISSUE_TITLE_FIX_BUG,
          issueLinearKey: MOCK_ISSUE_LINEAR_KEY_1,
          prUrl: MOCK_PR_URL_1,
          prNumber: 1,
          status: 'open',
          openedAt: tenDaysAgo.toISOString(),
        },
      ]

      render(<ActivityLog activities={mockActivities} />)

      const formattedDate = tenDaysAgo.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year:
          tenDaysAgo.getFullYear() !== now.getFullYear()
            ? 'numeric'
            : undefined,
      })

      expect(screen.getByText(formattedDate)).toBeInTheDocument()
    })
  })
})
