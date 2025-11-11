/**
 * Tests for TemporalLeaderboard component.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { TemporalStat } from '@/lib/queries'

import { TemporalLeaderboard } from './TemporalLeaderboard'

// Test constants
const EMPTY_STATE_MESSAGE = 'No activity data available yet'
const TOTAL_ATTEMPTS_LABEL = 'Total Attempts'
const TOTAL_WINS_LABEL = 'Total Wins'
const TOTAL_FAILURES_LABEL = 'Total Failures'
const ACTIVITY_TIMELINE_TEXT = 'Activity Timeline'
const MOCK_DATE_2024_01_01 = '2024-01-01'
const MOCK_DATE_2024_01_03 = '2024-01-03'
const DAILY_DESCRIPTION_TEXT =
  'Daily attempts, wins, and failures over the last 30 days'

describe('TemporalLeaderboard', () => {
  describe('when stats are available', () => {
    it('should display the card title and description', () => {
      const mockStats: TemporalStat[] = [
        {
          date: MOCK_DATE_2024_01_03,
          attempts: 5,
          wins: 3,
          failures: 1,
        },
      ]

      render(<TemporalLeaderboard stats={mockStats} />)

      expect(screen.getByText(ACTIVITY_TIMELINE_TEXT)).toBeInTheDocument()
      expect(screen.getByText(DAILY_DESCRIPTION_TEXT)).toBeInTheDocument()
    })

    it('should display the legend', () => {
      const mockStats: TemporalStat[] = [
        {
          date: MOCK_DATE_2024_01_03,
          attempts: 5,
          wins: 3,
          failures: 1,
        },
      ]

      render(<TemporalLeaderboard stats={mockStats} />)

      expect(screen.getByText('Attempts')).toBeInTheDocument()
      expect(screen.getByText('Wins')).toBeInTheDocument()
      expect(screen.getByText('Failures')).toBeInTheDocument()
    })

    it('should display formatted dates', () => {
      const mockStats: TemporalStat[] = [
        {
          date: '2024-01-15',
          attempts: 5,
          wins: 3,
          failures: 1,
        },
        {
          date: '2024-01-16',
          attempts: 3,
          wins: 2,
          failures: 0,
        },
      ]

      render(<TemporalLeaderboard stats={mockStats} />)

      expect(screen.getByText('Jan 15')).toBeInTheDocument()
      expect(screen.getByText('Jan 16')).toBeInTheDocument()
    })

    it('should display summary statistics', () => {
      const mockStats: TemporalStat[] = [
        {
          date: MOCK_DATE_2024_01_03,
          attempts: 5,
          wins: 3,
          failures: 1,
        },
        {
          date: '2024-01-02',
          attempts: 3,
          wins: 2,
          failures: 0,
        },
        {
          date: MOCK_DATE_2024_01_01,
          attempts: 2,
          wins: 1,
          failures: 2,
        },
      ]

      render(<TemporalLeaderboard stats={mockStats} />)

      // Total attempts: 5 + 3 + 2 = 10
      expect(screen.getByText('10')).toBeInTheDocument()
      expect(screen.getByText(TOTAL_ATTEMPTS_LABEL)).toBeInTheDocument()

      // Total wins: 3 + 2 + 1 = 6
      expect(screen.getByText('6')).toBeInTheDocument()
      expect(screen.getByText(TOTAL_WINS_LABEL)).toBeInTheDocument()

      // Total failures: 1 + 0 + 2 = 3
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText(TOTAL_FAILURES_LABEL)).toBeInTheDocument()
    })

    it('should handle single day of stats', () => {
      const mockStats: TemporalStat[] = [
        {
          date: '2024-01-01',
          attempts: 10,
          wins: 7,
          failures: 3,
        },
      ]

      render(<TemporalLeaderboard stats={mockStats} />)

      expect(screen.getByText('10')).toBeInTheDocument()
      expect(screen.getByText('7')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('should handle days with zero values', () => {
      const mockStats: TemporalStat[] = [
        {
          date: MOCK_DATE_2024_01_03,
          attempts: 0,
          wins: 0,
          failures: 0,
        },
        {
          date: '2024-01-02',
          attempts: 5,
          wins: 3,
          failures: 1,
        },
      ]

      render(<TemporalLeaderboard stats={mockStats} />)

      // Should still display totals
      expect(screen.getByText('5')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('should handle stats with only attempts', () => {
      const mockStats: TemporalStat[] = [
        {
          date: MOCK_DATE_2024_01_01,
          attempts: 10,
          wins: 0,
          failures: 0,
        },
      ]

      render(<TemporalLeaderboard stats={mockStats} />)

      expect(screen.getByText('10')).toBeInTheDocument()
      const zeroElements = screen.getAllByText('0')
      expect(zeroElements.length).toBeGreaterThanOrEqual(2)
    })

    it('should handle stats with only failures', () => {
      const mockStats: TemporalStat[] = [
        {
          date: MOCK_DATE_2024_01_01,
          attempts: 0,
          wins: 0,
          failures: 5,
        },
      ]

      render(<TemporalLeaderboard stats={mockStats} />)

      expect(screen.getByText('5')).toBeInTheDocument()
      expect(screen.getByText(TOTAL_FAILURES_LABEL)).toBeInTheDocument()
    })

    it('should handle stats with only wins', () => {
      const mockStats: TemporalStat[] = [
        {
          date: MOCK_DATE_2024_01_01,
          attempts: 0,
          wins: 8,
          failures: 0,
        },
      ]

      render(<TemporalLeaderboard stats={mockStats} />)

      expect(screen.getByText('8')).toBeInTheDocument()
      expect(screen.getByText(TOTAL_WINS_LABEL)).toBeInTheDocument()
    })

    it('should display multiple days correctly', () => {
      const mockStats: TemporalStat[] = [
        {
          date: '2024-01-05',
          attempts: 8,
          wins: 5,
          failures: 2,
        },
        {
          date: '2024-01-04',
          attempts: 6,
          wins: 4,
          failures: 1,
        },
        {
          date: '2024-01-03',
          attempts: 4,
          wins: 2,
          failures: 3,
        },
      ]

      render(<TemporalLeaderboard stats={mockStats} />)

      // Check dates are displayed
      expect(screen.getByText('Jan 3')).toBeInTheDocument()
      expect(screen.getByText('Jan 4')).toBeInTheDocument()
      expect(screen.getByText('Jan 5')).toBeInTheDocument()

      // Check totals: attempts=18, wins=11, failures=6
      expect(screen.getByText('18')).toBeInTheDocument()
      expect(screen.getByText('11')).toBeInTheDocument()
      expect(screen.getByText('6')).toBeInTheDocument()
    })
  })

  describe('when no stats are available', () => {
    it('should display empty state message', () => {
      render(<TemporalLeaderboard stats={[]} />)

      expect(screen.getByText(EMPTY_STATE_MESSAGE)).toBeInTheDocument()
    })

    it('should not display legend when empty', () => {
      render(<TemporalLeaderboard stats={[]} />)

      expect(screen.queryByText('Attempts')).not.toBeInTheDocument()
      expect(screen.queryByText('Wins')).not.toBeInTheDocument()
      expect(screen.queryByText('Failures')).not.toBeInTheDocument()
    })

    it('should not display summary stats when empty', () => {
      render(<TemporalLeaderboard stats={[]} />)

      expect(screen.queryByText(TOTAL_ATTEMPTS_LABEL)).not.toBeInTheDocument()
      expect(screen.queryByText(TOTAL_WINS_LABEL)).not.toBeInTheDocument()
      expect(screen.queryByText(TOTAL_FAILURES_LABEL)).not.toBeInTheDocument()
    })

    it('should still display card title and description when empty', () => {
      render(<TemporalLeaderboard stats={[]} />)

      expect(screen.getByText(ACTIVITY_TIMELINE_TEXT)).toBeInTheDocument()
      expect(screen.getByText(DAILY_DESCRIPTION_TEXT)).toBeInTheDocument()
    })
  })

  describe('date formatting', () => {
    it('should format dates across different months', () => {
      const mockStats: TemporalStat[] = [
        {
          date: '2024-01-31',
          attempts: 1,
          wins: 1,
          failures: 0,
        },
        {
          date: '2024-02-01',
          attempts: 2,
          wins: 1,
          failures: 0,
        },
      ]

      render(<TemporalLeaderboard stats={mockStats} />)

      expect(screen.getByText('Jan 31')).toBeInTheDocument()
      expect(screen.getByText('Feb 1')).toBeInTheDocument()
    })

    it('should format dates at year boundaries', () => {
      const mockStats: TemporalStat[] = [
        {
          date: '2023-12-31',
          attempts: 1,
          wins: 1,
          failures: 0,
        },
        {
          date: MOCK_DATE_2024_01_01,
          attempts: 2,
          wins: 1,
          failures: 0,
        },
      ]

      render(<TemporalLeaderboard stats={mockStats} />)

      expect(screen.getByText('Dec 31')).toBeInTheDocument()
      expect(screen.getByText('Jan 1')).toBeInTheDocument()
    })
  })
})
