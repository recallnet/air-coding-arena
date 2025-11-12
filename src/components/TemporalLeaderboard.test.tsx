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
  'Cumulative attempts, wins, and failures per agent over the last 30 days'

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
        },
        {
          date: MOCK_DATE_2024_01_03,
          agentName: 'engine',
          cumulativeAttempts: 3,
          cumulativeWins: 2,
          cumulativeFailures: 1,
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
        },
        {
          date: MOCK_DATE_2024_01_02,
          agentName: 'cursor',
          cumulativeAttempts: 5,
          cumulativeWins: 4,
          cumulativeFailures: 1,
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
        },
        {
          date: MOCK_DATE_2024_01_03,
          agentName: 'engine',
          cumulativeAttempts: 5,
          cumulativeWins: 3,
          cumulativeFailures: 2,
        },
        {
          date: MOCK_DATE_2024_01_03,
          agentName: 'cyrus',
          cumulativeAttempts: 7,
          cumulativeWins: 5,
          cumulativeFailures: 2,
        },
      ]

      render(<TemporalLeaderboard stats={mockStats} />)

      expect(screen.getByText('cursor')).toBeInTheDocument()
      expect(screen.getByText('engine')).toBeInTheDocument()
      expect(screen.getByText('cyrus')).toBeInTheDocument()
    })

    it('should handle multiple dates', () => {
      const mockStats: AgentTemporalStat[] = [
        {
          date: MOCK_DATE_2024_01_03,
          agentName: 'cursor',
          cumulativeAttempts: 15,
          cumulativeWins: 12,
          cumulativeFailures: 3,
        },
        {
          date: MOCK_DATE_2024_01_02,
          agentName: 'cursor',
          cumulativeAttempts: 10,
          cumulativeWins: 8,
          cumulativeFailures: 2,
        },
        {
          date: MOCK_DATE_2024_01_01,
          agentName: 'cursor',
          cumulativeAttempts: 5,
          cumulativeWins: 4,
          cumulativeFailures: 1,
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
        },
      ]

      const { container } = render(<TemporalLeaderboard stats={mockStats} />)

      expect(screen.getByText('cursor')).toBeInTheDocument()
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
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
