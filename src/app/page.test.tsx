/**
 * Tests for Dashboard home page.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import type { AgentStats } from '@/types/database'

import Home from './page'

// Mock the query functions
vi.mock('@/lib/queries', () => ({
  getAgentStats: vi.fn(),
  getAgentTemporalStats: vi.fn(),
  getIssuesWithAgents: vi.fn(),
}))

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

// No Next.js cache mocks needed - Server Components cached by Full Route Cache

// Import after mocking to get the mocked version
// eslint-disable-next-line import/order -- Must import after mock
import {
  getAgentStats,
  getAgentTemporalStats,
  getIssuesWithAgents,
} from '@/lib/queries'

const mockGetAgentStats = vi.mocked(getAgentStats)
const mockGetAgentTemporalStats = vi.mocked(getAgentTemporalStats)
const mockGetIssuesWithAgents = vi.mocked(getIssuesWithAgents)

// Test constants to avoid duplication
const TOP_PERFORMER_TEXT = 'Top Performer'
const ACTIVITY_TIMELINE_TEXT = 'Activity Timeline'
const MOCK_AGENT_CURSOR = 'cursor'
const AGENT_LEADERBOARD_TEXT = 'Agent Leaderboard'

describe('Home', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock for all queries
    mockGetAgentTemporalStats.mockResolvedValue([])
    mockGetIssuesWithAgents.mockResolvedValue([])
  })

  describe('when agent stats are available', () => {
    it('should display the page title and subtitle', async () => {
      const mockStats: AgentStats[] = [
        {
          agentName: MOCK_AGENT_CURSOR,
          issues: 5,
          prs: 10,
          wins: 8,
          dnf: 2,
          attempts: 10,
          acceptancePct: 80.0,
          ordinal: 20.0,
          gamesPlayed: 10,
        },
      ]

      mockGetAgentStats.mockResolvedValue(mockStats)

      render(await Home())

      expect(
        screen.getByRole('heading', { name: 'Air Coding Arena' })
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'Track and compare AI coding agent performance across challenges'
        )
      ).toBeInTheDocument()
    })

    it('should display the leaderboard card with title and description', async () => {
      const mockStats: AgentStats[] = [
        {
          agentName: MOCK_AGENT_CURSOR,
          issues: 5,
          prs: 10,
          wins: 8,
          dnf: 2,
          attempts: 10,
          acceptancePct: 80.0,
          ordinal: 20.0,
          gamesPlayed: 10,
        },
      ]

      mockGetAgentStats.mockResolvedValue(mockStats)

      render(await Home())

      expect(screen.getByText(AGENT_LEADERBOARD_TEXT)).toBeInTheDocument()
      expect(
        screen.getByText('Performance rankings based on merged pull requests')
      ).toBeInTheDocument()
    })

    it('should display table headers', async () => {
      const mockStats: AgentStats[] = [
        {
          agentName: MOCK_AGENT_CURSOR,
          issues: 5,
          prs: 10,
          wins: 8,
          dnf: 2,
          attempts: 10,
          acceptancePct: 80.0,
          ordinal: 20.0,
          gamesPlayed: 10,
        },
      ]

      mockGetAgentStats.mockResolvedValue(mockStats)

      render(await Home())

      // New headers should exist
      expect(screen.getByText('Agent Name')).toBeInTheDocument()
      expect(screen.getByText('Rating')).toBeInTheDocument()
      expect(screen.getByText('Issues')).toBeInTheDocument()
      expect(screen.getByText('PRs')).toBeInTheDocument()
      expect(screen.getByText('Wins')).toBeInTheDocument()
      expect(screen.getByText('DNF')).toBeInTheDocument()

      // Old headers should NOT exist
      expect(screen.queryByText('Acceptance Rate')).not.toBeInTheDocument()
      expect(screen.queryByText('Attempts')).not.toBeInTheDocument()
      expect(screen.queryByText('Games')).not.toBeInTheDocument()
    })

    it('should display agent stats in table rows', async () => {
      const mockStats: AgentStats[] = [
        {
          agentName: 'cursor',
          issues: 8,
          prs: 10,
          wins: 7,
          dnf: 2,
          attempts: 10,
          acceptancePct: 80.0,
          ordinal: 20.0,
          gamesPlayed: 12,
        },
        {
          agentName: 'engine',
          issues: 4,
          prs: 5,
          wins: 3,
          dnf: 1,
          attempts: 5,
          acceptancePct: 60.0,
          ordinal: 15.0,
          gamesPlayed: 7,
        },
      ]

      mockGetAgentStats.mockResolvedValue(mockStats)

      render(await Home())

      // Verify agent names are displayed
      expect(screen.getByText('cursor')).toBeInTheDocument()
      expect(screen.getByText('engine')).toBeInTheDocument()

      // Check cursor row has correct values: 8 issues, 10 PRs, 7 wins, 2 DNF
      const cursorRow = screen.getByText('cursor').closest('tr')
      expect(cursorRow).toBeTruthy()
      expect(cursorRow?.textContent).toContain('8')
      expect(cursorRow?.textContent).toContain('10')
      expect(cursorRow?.textContent).toContain('7')
      expect(cursorRow?.textContent).toContain('2')

      // Check engine row has correct values: 4 issues, 5 PRs, 3 wins, 1 DNF
      const engineRow = screen.getByText('engine').closest('tr')
      expect(engineRow).toBeTruthy()
      expect(engineRow?.textContent).toContain('4')
      expect(engineRow?.textContent).toContain('5')
      expect(engineRow?.textContent).toContain('3')
      expect(engineRow?.textContent).toContain('1')
    })

    it('should display new columns with correct data', async () => {
      const mockStats: AgentStats[] = [
        {
          agentName: 'cursor',
          issues: 7,
          prs: 10,
          wins: 8,
          dnf: 2,
          attempts: 10,
          acceptancePct: 80.12345,
          ordinal: 20.0,
          gamesPlayed: 10,
        },
      ]

      mockGetAgentStats.mockResolvedValue(mockStats)

      render(await Home())

      expect(screen.getByText('7')).toBeInTheDocument()
      expect(screen.getByText('10')).toBeInTheDocument()
      expect(screen.getByText('8')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('should display Top Performer badge for agent with highest acceptance rate', async () => {
      const mockStats: AgentStats[] = [
        {
          agentName: 'cursor',
          issues: 8,
          prs: 10,
          wins: 8,
          dnf: 2,
          attempts: 10,
          acceptancePct: 80.0,
          ordinal: 20.0,
          gamesPlayed: 10,
        },
        {
          agentName: 'engine',
          issues: 4,
          prs: 5,
          wins: 3,
          dnf: 1,
          attempts: 5,
          acceptancePct: 60.0,
          ordinal: 15.0,
          gamesPlayed: 5,
        },
        {
          agentName: 'cyrus',
          issues: 7,
          prs: 8,
          wins: 7,
          dnf: 1,
          attempts: 8,
          acceptancePct: 87.5,
          ordinal: 25.0,
          gamesPlayed: 8,
        },
      ]

      mockGetAgentStats.mockResolvedValue(mockStats)

      render(await Home())

      // Should have exactly one Top Performer badge
      const badges = screen.getAllByText(TOP_PERFORMER_TEXT)
      expect(badges).toHaveLength(1)

      // The badge should be in the same row as 'cyrus'
      const cyrusRow = screen.getByText('cyrus').closest('tr')
      expect(cyrusRow).toBeInTheDocument()
      if (cyrusRow) {
        expect(cyrusRow.textContent).toContain(TOP_PERFORMER_TEXT)
      }
    })

    it('should handle single agent as top performer', async () => {
      const mockStats: AgentStats[] = [
        {
          agentName: 'cursor',
          issues: 8,
          prs: 10,
          wins: 8,
          dnf: 2,
          attempts: 10,
          acceptancePct: 80.0,
          ordinal: 20.0,
          gamesPlayed: 10,
        },
      ]

      mockGetAgentStats.mockResolvedValue(mockStats)

      render(await Home())

      expect(screen.getByText(TOP_PERFORMER_TEXT)).toBeInTheDocument()
    })

    it('should display Top Performer badge for first agent when there is a tie', async () => {
      const mockStats: AgentStats[] = [
        {
          agentName: 'cursor',
          issues: 8,
          prs: 10,
          wins: 8,
          dnf: 2,
          attempts: 10,
          acceptancePct: 80.0,
          ordinal: 20.0,
          gamesPlayed: 10,
        },
        {
          agentName: 'engine',
          issues: 4,
          prs: 5,
          wins: 4,
          dnf: 1,
          attempts: 5,
          acceptancePct: 80.0,
          ordinal: 20.0,
          gamesPlayed: 5,
        },
      ]

      mockGetAgentStats.mockResolvedValue(mockStats)

      render(await Home())

      // Should have exactly one Top Performer badge (reduce picks first one in case of tie)
      const badges = screen.getAllByText(TOP_PERFORMER_TEXT)
      expect(badges).toHaveLength(1)

      // The badge should be in the same row as 'cursor' (first in array)
      const cursorRow = screen.getByText('cursor').closest('tr')
      expect(cursorRow).toBeInTheDocument()
      if (cursorRow) {
        expect(cursorRow.textContent).toContain(TOP_PERFORMER_TEXT)
      }
    })
  })

  describe('when temporal stats are available', () => {
    it('should display the temporal leaderboard', async () => {
      const mockAgentStats: AgentStats[] = [
        {
          agentName: 'cursor',
          issues: 8,
          prs: 10,
          wins: 8,
          dnf: 2,
          attempts: 10,
          acceptancePct: 80.0,
          ordinal: 20.0,
          gamesPlayed: 10,
        },
      ]

      mockGetAgentStats.mockResolvedValue(mockAgentStats)
      mockGetAgentTemporalStats.mockResolvedValue([])

      render(await Home())

      expect(screen.getByText(ACTIVITY_TIMELINE_TEXT)).toBeInTheDocument()
      expect(
        screen.getByText(
          'Agent ratings (left axis) and cumulative attempts, wins, failures (right axis) over the last 30 days'
        )
      ).toBeInTheDocument()
    })

    it('should display temporal leaderboard before agent stats table', async () => {
      const mockAgentStats: AgentStats[] = [
        {
          agentName: 'cursor',
          issues: 8,
          prs: 10,
          wins: 8,
          dnf: 2,
          attempts: 10,
          acceptancePct: 80.0,
          ordinal: 20.0,
          gamesPlayed: 10,
        },
      ]

      mockGetAgentStats.mockResolvedValue(mockAgentStats)
      mockGetAgentTemporalStats.mockResolvedValue([])

      render(await Home())

      const temporalTitle = screen.getByText(ACTIVITY_TIMELINE_TEXT)
      const agentLeaderboardTitle = screen.getByText(AGENT_LEADERBOARD_TEXT)

      // Check that temporal leaderboard appears before agent leaderboard in DOM
      expect(temporalTitle.compareDocumentPosition(agentLeaderboardTitle)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      )
    })
  })

  describe('when no agent stats are available', () => {
    it('should display empty state message', async () => {
      mockGetAgentStats.mockResolvedValue([])

      render(await Home())

      expect(
        screen.getByText('No agent statistics available yet')
      ).toBeInTheDocument()
    })

    it('should not display table headers when empty', async () => {
      mockGetAgentStats.mockResolvedValue([])

      render(await Home())

      expect(screen.queryByText('Agent Name')).not.toBeInTheDocument()
      expect(screen.queryByText('Attempts')).not.toBeInTheDocument()
      expect(screen.queryByText('Wins')).not.toBeInTheDocument()
      expect(screen.queryByText('Acceptance Rate')).not.toBeInTheDocument()
    })

    it('should not display Top Performer badge when empty', async () => {
      mockGetAgentStats.mockResolvedValue([])

      render(await Home())

      expect(screen.queryByText(TOP_PERFORMER_TEXT)).not.toBeInTheDocument()
    })

    it('should still display page title and subtitle when empty', async () => {
      mockGetAgentStats.mockResolvedValue([])

      render(await Home())

      expect(
        screen.getByRole('heading', { name: 'Air Coding Arena' })
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'Track and compare AI coding agent performance across challenges'
        )
      ).toBeInTheDocument()
    })

    it('should still display leaderboard card header when empty', async () => {
      mockGetAgentStats.mockResolvedValue([])

      render(await Home())

      expect(screen.getByText(AGENT_LEADERBOARD_TEXT)).toBeInTheDocument()
      expect(
        screen.getByText('Performance rankings based on merged pull requests')
      ).toBeInTheDocument()
    })
  })
})
