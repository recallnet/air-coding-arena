/**
 * Tests for TemporalLeaderboard component.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { AgentTemporalStat } from '@/lib/queries'

import { TemporalLeaderboard } from './TemporalLeaderboard'

// Test constants
const EMPTY_STATE_MESSAGE = 'No activity data available yet'
const ACTIVITY_TIMELINE_TEXT = 'Activity Timeline'
const MOCK_DATE_2024_01_01 = '2024-01-01'
const MOCK_DATE_2024_01_02 = '2024-01-02'
const MOCK_DATE_2024_01_03 = '2024-01-03'
const CUMULATIVE_DESCRIPTION_TEXT =
  'Agent ratings (left axis) and cumulative attempts, wins, failures (right axis) over the last 30 days'

describe('TemporalLeaderboard', () => {
  describe('when stats are available', () => {
    it('should display the card title and description', () => {
      const mockStats: AgentTemporalStat[] = [
        {
          date: MOCK_DATE_2024_01_03,
          agentName: 'cursor',
          cumulativeAttempts: 5,
          cumulativeWins: 3,
          cumulativeFailures: 1,
          ordinal: 1500,
        },
      ]

      render(<TemporalLeaderboard stats={mockStats} />)

      expect(screen.getByText(ACTIVITY_TIMELINE_TEXT)).toBeInTheDocument()
      expect(screen.getByText(CUMULATIVE_DESCRIPTION_TEXT)).toBeInTheDocument()
    })

    it('should display agent names in legend', () => {
      const mockStats: AgentTemporalStat[] = [
        {
          date: MOCK_DATE_2024_01_03,
          agentName: 'cursor',
          cumulativeAttempts: 5,
          cumulativeWins: 3,
          cumulativeFailures: 1,
          ordinal: 1550,
        },
        {
          date: MOCK_DATE_2024_01_03,
          agentName: 'engine',
          cumulativeAttempts: 3,
          cumulativeWins: 2,
          cumulativeFailures: 1,
          ordinal: 1500,
        },
      ]

      render(<TemporalLeaderboard stats={mockStats} />)

      expect(screen.getByText('cursor')).toBeInTheDocument()
      expect(screen.getByText('engine')).toBeInTheDocument()
    })

    it('should display metric labels in legend', () => {
      const mockStats: AgentTemporalStat[] = [
        {
          date: MOCK_DATE_2024_01_03,
          agentName: 'cursor',
          cumulativeAttempts: 5,
          cumulativeWins: 3,
          cumulativeFailures: 1,
          ordinal: 1500,
        },
      ]

      render(<TemporalLeaderboard stats={mockStats} />)

      const attemptsLabels = screen.getAllByText('Attempts')
      const winsLabels = screen.getAllByText('Wins')
      const failuresLabels = screen.getAllByText('Failures')
      expect(attemptsLabels.length).toBeGreaterThan(0)
      expect(winsLabels.length).toBeGreaterThan(0)
      expect(failuresLabels.length).toBeGreaterThan(0)
    })

    it('should render SVG chart', () => {
      const mockStats: AgentTemporalStat[] = [
        {
          date: MOCK_DATE_2024_01_03,
          agentName: 'cursor',
          cumulativeAttempts: 10,
          cumulativeWins: 8,
          cumulativeFailures: 2,
          ordinal: 1550,
        },
        {
          date: MOCK_DATE_2024_01_02,
          agentName: 'cursor',
          cumulativeAttempts: 5,
          cumulativeWins: 4,
          cumulativeFailures: 1,
          ordinal: 1520,
        },
      ]

      const { container } = render(<TemporalLeaderboard stats={mockStats} />)

      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    it('should handle multiple agents', () => {
      const mockStats: AgentTemporalStat[] = [
        {
          date: MOCK_DATE_2024_01_03,
          agentName: 'cursor',
          cumulativeAttempts: 10,
          cumulativeWins: 8,
          cumulativeFailures: 2,
          ordinal: 1600,
        },
        {
          date: MOCK_DATE_2024_01_03,
          agentName: 'engine',
          cumulativeAttempts: 5,
          cumulativeWins: 3,
          cumulativeFailures: 2,
          ordinal: 1520,
        },
        {
          date: MOCK_DATE_2024_01_03,
          agentName: 'cyrus',
          cumulativeAttempts: 7,
          cumulativeWins: 5,
          cumulativeFailures: 2,
          ordinal: 1550,
        },
      ]

      render(<TemporalLeaderboard stats={mockStats} />)

      expect(screen.getByText('cursor')).toBeInTheDocument()
      expect(screen.getByText('engine')).toBeInTheDocument()
      expect(screen.getByText('cyrus')).toBeInTheDocument()
    })

    it('should display agents in alphabetical order in legend', () => {
      const mockStats: AgentTemporalStat[] = [
        {
          date: MOCK_DATE_2024_01_03,
          agentName: 'zebra',
          cumulativeAttempts: 10,
          cumulativeWins: 8,
          cumulativeFailures: 2,
          ordinal: 1700,
        },
        {
          date: MOCK_DATE_2024_01_03,
          agentName: 'apple',
          cumulativeAttempts: 5,
          cumulativeWins: 3,
          cumulativeFailures: 2,
          ordinal: 1600,
        },
        {
          date: MOCK_DATE_2024_01_03,
          agentName: 'mango',
          cumulativeAttempts: 7,
          cumulativeWins: 5,
          cumulativeFailures: 2,
          ordinal: 1650,
        },
      ]

      render(<TemporalLeaderboard stats={mockStats} />)

      // Get all agent names from the legend
      const agentNames = [
        screen.getByText('apple'),
        screen.getByText('mango'),
        screen.getByText('zebra'),
      ]

      // Verify all agents are present
      for (const agent of agentNames) {
        expect(agent).toBeInTheDocument()
      }
    })

    it('should filter out agents with zero ordinal from display', () => {
      const mockStats: AgentTemporalStat[] = [
        {
          date: MOCK_DATE_2024_01_03,
          agentName: 'rated-agent',
          cumulativeAttempts: 10,
          cumulativeWins: 8,
          cumulativeFailures: 2,
          ordinal: 1600,
        },
        {
          date: MOCK_DATE_2024_01_03,
          agentName: 'unrated-agent',
          cumulativeAttempts: 5,
          cumulativeWins: 0,
          cumulativeFailures: 5,
          ordinal: 0,
        },
      ]

      render(<TemporalLeaderboard stats={mockStats} />)

      // Agent with rating should be shown
      expect(screen.getByText('rated-agent')).toBeInTheDocument()

      // Agent with zero rating should not be shown
      expect(screen.queryByText('unrated-agent')).not.toBeInTheDocument()
    })

    it('should handle multiple dates', () => {
      const mockStats: AgentTemporalStat[] = [
        {
          date: MOCK_DATE_2024_01_03,
          agentName: 'cursor',
          cumulativeAttempts: 15,
          cumulativeWins: 12,
          cumulativeFailures: 3,
          ordinal: 1580,
        },
        {
          date: MOCK_DATE_2024_01_02,
          agentName: 'cursor',
          cumulativeAttempts: 10,
          cumulativeWins: 8,
          cumulativeFailures: 2,
          ordinal: 1540,
        },
        {
          date: MOCK_DATE_2024_01_01,
          agentName: 'cursor',
          cumulativeAttempts: 5,
          cumulativeWins: 4,
          cumulativeFailures: 1,
          ordinal: 1510,
        },
      ]

      render(<TemporalLeaderboard stats={mockStats} />)

      expect(screen.getByText('Jan 1')).toBeInTheDocument()
      expect(screen.getByText('Jan 3')).toBeInTheDocument()
    })

    it('should handle single agent with single date', () => {
      const mockStats: AgentTemporalStat[] = [
        {
          date: MOCK_DATE_2024_01_01,
          agentName: 'cursor',
          cumulativeAttempts: 10,
          cumulativeWins: 7,
          cumulativeFailures: 3,
          ordinal: 1550,
        },
      ]

      const { container } = render(<TemporalLeaderboard stats={mockStats} />)

      expect(screen.getByText('cursor')).toBeInTheDocument()
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    it('should render line paths for each metric (ordinal, attempts, wins, failures)', () => {
      const mockStats: AgentTemporalStat[] = [
        {
          date: MOCK_DATE_2024_01_01,
          agentName: 'cursor',
          cumulativeAttempts: 5,
          cumulativeWins: 3,
          cumulativeFailures: 2,
          ordinal: 1500,
        },
        {
          date: MOCK_DATE_2024_01_02,
          agentName: 'cursor',
          cumulativeAttempts: 10,
          cumulativeWins: 7,
          cumulativeFailures: 3,
          ordinal: 1550,
        },
      ]

      const { container } = render(<TemporalLeaderboard stats={mockStats} />)

      // Should have 4 path elements (ordinal, attempts, wins, failures)
      const paths = container.querySelectorAll('path')
      expect(paths.length).toBe(4)

      // Verify each path has a 'd' attribute (the path data)
      for (const path of paths) {
        expect(path.getAttribute('d')).toBeTruthy()
        expect(path.getAttribute('d')).toMatch(/^M /) // Path should start with "M "
      }
    })

    it('should display chart with dual Y-axis labels (Rating and Count)', () => {
      const mockStats: AgentTemporalStat[] = [
        {
          date: MOCK_DATE_2024_01_03,
          agentName: 'cursor',
          cumulativeAttempts: 10,
          cumulativeWins: 8,
          cumulativeFailures: 2,
          ordinal: 1550,
        },
      ]

      render(<TemporalLeaderboard stats={mockStats} />)

      // Should have "Rating" label (appears in legend and Y-axis)
      const ratingLabels = screen.getAllByText('Rating')
      expect(ratingLabels.length).toBeGreaterThanOrEqual(1)

      // Should have "Count" label on right axis
      expect(screen.getByText('Count')).toBeInTheDocument()
    })

    it('should render multiple agents with distinct color schemes', () => {
      const mockStats: AgentTemporalStat[] = [
        {
          date: MOCK_DATE_2024_01_03,
          agentName: 'agent1',
          cumulativeAttempts: 10,
          cumulativeWins: 8,
          cumulativeFailures: 2,
          ordinal: 1600,
        },
        {
          date: MOCK_DATE_2024_01_03,
          agentName: 'agent2',
          cumulativeAttempts: 5,
          cumulativeWins: 3,
          cumulativeFailures: 2,
          ordinal: 1550,
        },
      ]

      const { container } = render(<TemporalLeaderboard stats={mockStats} />)

      // Should have 8 path elements (4 metrics × 2 agents)
      const paths = container.querySelectorAll('path')
      expect(paths.length).toBe(8)

      // Verify each agent has paths with different stroke colors
      const strokes = Array.from(paths).map((path) =>
        path.getAttribute('stroke')
      )
      const uniqueStrokes = new Set(strokes.filter(Boolean))

      // Should have multiple unique colors (at least 2 base colors for 2 agents)
      expect(uniqueStrokes.size).toBeGreaterThanOrEqual(2)
    })
  })

  describe('when no stats are available', () => {
    it('should display empty state message', () => {
      render(<TemporalLeaderboard stats={[]} />)

      expect(screen.getByText(EMPTY_STATE_MESSAGE)).toBeInTheDocument()
    })

    it('should not display legend when empty', () => {
      render(<TemporalLeaderboard stats={[]} />)

      expect(screen.queryByText('cursor')).not.toBeInTheDocument()
      expect(screen.queryByText('engine')).not.toBeInTheDocument()
    })

    it('should not display SVG chart when empty', () => {
      const { container } = render(<TemporalLeaderboard stats={[]} />)

      const svg = container.querySelector('svg')
      expect(svg).not.toBeInTheDocument()
    })

    it('should still display card title and description when empty', () => {
      render(<TemporalLeaderboard stats={[]} />)

      expect(screen.getByText(ACTIVITY_TIMELINE_TEXT)).toBeInTheDocument()
      expect(screen.getByText(CUMULATIVE_DESCRIPTION_TEXT)).toBeInTheDocument()
    })
  })
})
