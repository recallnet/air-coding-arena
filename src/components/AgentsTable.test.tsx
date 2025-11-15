/**
 * Tests for AgentsTable component.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AgentsTable, type Agent } from './AgentsTable'

const mockAgents: Agent[] = [
  {
    id: 'agent-1',
    name: 'cursor',
    displayName: 'Cursor',
    linearUserId: 'user-1',
    email: 'cursor@example.com',
    avatarUrl: 'https://example.com/avatar1.png',
    isActive: true,
    isEnabled: true,
    discoveredAt: '2025-01-01T00:00:00Z',
    lastSeenAt: '2025-01-10T12:00:00Z',
  },
  {
    id: 'agent-2',
    name: 'engine',
    displayName: 'Engine',
    linearUserId: 'user-2',
    email: null,
    avatarUrl: null,
    isActive: false,
    isEnabled: false,
    discoveredAt: '2025-01-02T00:00:00Z',
    lastSeenAt: '2025-01-05T08:00:00Z',
  },
]

describe('AgentsTable', () => {
  describe('Empty State', () => {
    it('should show empty state when no agents', () => {
      render(<AgentsTable initialAgents={[]} />)

      expect(screen.getByText(/No agents discovered yet/i)).toBeInTheDocument()
      expect(
        screen.getByText(/Click "Discover Agents" to find agents/i)
      ).toBeInTheDocument()
    })
  })

  describe('Table Rendering', () => {
    it('should render table with agents', () => {
      render(<AgentsTable initialAgents={mockAgents} />)

      // Check table headers
      expect(screen.getByText('Agent')).toBeInTheDocument()
      expect(screen.getByText('Email')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Last Seen')).toBeInTheDocument()
      expect(screen.getByText('Enabled')).toBeInTheDocument()
    })

    it('should render agent display names', () => {
      render(<AgentsTable initialAgents={mockAgents} />)

      expect(screen.getByText('Cursor')).toBeInTheDocument()
      expect(screen.getByText('Engine')).toBeInTheDocument()
    })

    it('should render agent names', () => {
      render(<AgentsTable initialAgents={mockAgents} />)

      expect(screen.getByText('cursor')).toBeInTheDocument()
      expect(screen.getByText('engine')).toBeInTheDocument()
    })

    it('should render agent emails', () => {
      render(<AgentsTable initialAgents={mockAgents} />)

      expect(screen.getByText('cursor@example.com')).toBeInTheDocument()
      // Null email should show dash
      const cells = screen.getAllByText('-')
      expect(cells.length).toBeGreaterThan(0)
    })
  })

  describe('Agent Avatars', () => {
    it('should render avatar image when avatarUrl is provided', () => {
      render(<AgentsTable initialAgents={mockAgents} />)

      const avatar = screen.getByAltText('Cursor')
      expect(avatar).toBeInTheDocument()
      // Next.js Image component transforms the src URL
      expect(avatar).toHaveAttribute('src')
      expect(avatar.getAttribute('src')).toContain('example.com')
    })

    it('should render fallback avatar when avatarUrl is null', () => {
      render(<AgentsTable initialAgents={mockAgents} />)

      // Engine has no avatar, should show fallback with first letter
      const fallback = screen.getByText('E')
      expect(fallback).toBeInTheDocument()
      expect(fallback.className).toContain('rounded-full')
    })
  })

  describe('Status Badges', () => {
    it('should show Active badge for active agents', () => {
      render(<AgentsTable initialAgents={mockAgents} />)

      const activeBadge = screen.getByText('Active')
      expect(activeBadge).toBeInTheDocument()
    })

    it('should show Inactive badge for inactive agents', () => {
      render(<AgentsTable initialAgents={mockAgents} />)

      const inactiveBadge = screen.getByText('Inactive')
      expect(inactiveBadge).toBeInTheDocument()
    })
  })

  describe('Enable Toggles', () => {
    it('should render toggle for each agent', () => {
      render(<AgentsTable initialAgents={mockAgents} />)

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes).toHaveLength(2)
    })

    it('should render enabled toggle as checked', () => {
      render(<AgentsTable initialAgents={mockAgents} />)

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes[0]).toBeChecked()
    })

    it('should render disabled toggle as unchecked', () => {
      render(<AgentsTable initialAgents={mockAgents} />)

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes[1]).not.toBeChecked()
    })
  })

  describe('Relative Time Formatting', () => {
    it('should display relative time for lastSeenAt', () => {
      render(<AgentsTable initialAgents={mockAgents} />)

      // Should show relative time (the exact text depends on current time)
      // Just verify that the table cells contain time-related text
      const cells = screen.getAllByRole('cell')
      const hasTimeInfo = cells.some((cell) =>
        cell.textContent?.match(/ago|Just now|Jan|Feb|Mar/i)
      )
      expect(hasTimeInfo).toBe(true)
    })

    it('should show "Just now" for very recent times', () => {
      const now = new Date()
      const baseAgent = mockAgents[0]
      if (!baseAgent) throw new Error('Mock agent not found')
      const recentAgent: Agent = {
        ...baseAgent,
        lastSeenAt: now.toISOString(),
      }
      render(<AgentsTable initialAgents={[recentAgent]} />)

      expect(screen.getByText('Just now')).toBeInTheDocument()
    })

    it('should show minutes for times under 1 hour (singular)', () => {
      const now = new Date()
      const oneMinuteAgo = new Date(now.getTime() - 60000)
      const baseAgent = mockAgents[0]
      if (!baseAgent) throw new Error('Mock agent not found')
      const recentAgent: Agent = {
        ...baseAgent,
        lastSeenAt: oneMinuteAgo.toISOString(),
      }
      render(<AgentsTable initialAgents={[recentAgent]} />)

      expect(screen.getByText('1 minute ago')).toBeInTheDocument()
    })

    it('should show minutes for times under 1 hour (plural)', () => {
      const now = new Date()
      const twoMinutesAgo = new Date(now.getTime() - 120000)
      const baseAgent = mockAgents[0]
      if (!baseAgent) throw new Error('Mock agent not found')
      const recentAgent: Agent = {
        ...baseAgent,
        lastSeenAt: twoMinutesAgo.toISOString(),
      }
      render(<AgentsTable initialAgents={[recentAgent]} />)

      expect(screen.getByText('2 minutes ago')).toBeInTheDocument()
    })

    it('should show hours for times under 24 hours (singular)', () => {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 3600000)
      const baseAgent = mockAgents[0]
      if (!baseAgent) throw new Error('Mock agent not found')
      const recentAgent: Agent = {
        ...baseAgent,
        lastSeenAt: oneHourAgo.toISOString(),
      }
      render(<AgentsTable initialAgents={[recentAgent]} />)

      expect(screen.getByText('1 hour ago')).toBeInTheDocument()
    })

    it('should show hours for times under 24 hours (plural)', () => {
      const now = new Date()
      const twoHoursAgo = new Date(now.getTime() - 7200000)
      const baseAgent = mockAgents[0]
      if (!baseAgent) throw new Error('Mock agent not found')
      const recentAgent: Agent = {
        ...baseAgent,
        lastSeenAt: twoHoursAgo.toISOString(),
      }
      render(<AgentsTable initialAgents={[recentAgent]} />)

      expect(screen.getByText('2 hours ago')).toBeInTheDocument()
    })

    it('should show days for times under 7 days (singular)', () => {
      const now = new Date()
      const oneDayAgo = new Date(now.getTime() - 86400000)
      const baseAgent = mockAgents[0]
      if (!baseAgent) throw new Error('Mock agent not found')
      const recentAgent: Agent = {
        ...baseAgent,
        lastSeenAt: oneDayAgo.toISOString(),
      }
      render(<AgentsTable initialAgents={[recentAgent]} />)

      expect(screen.getByText('1 day ago')).toBeInTheDocument()
    })

    it('should show days for times under 7 days (plural)', () => {
      const now = new Date()
      const twoDaysAgo = new Date(now.getTime() - 172800000)
      const baseAgent = mockAgents[0]
      if (!baseAgent) throw new Error('Mock agent not found')
      const recentAgent: Agent = {
        ...baseAgent,
        lastSeenAt: twoDaysAgo.toISOString(),
      }
      render(<AgentsTable initialAgents={[recentAgent]} />)

      expect(screen.getByText('2 days ago')).toBeInTheDocument()
    })
  })
})
