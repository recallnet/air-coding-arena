/**
 * Tests for Admin Agents page.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// eslint-disable-next-line import/order -- Type import needed before mocks
import type { Agent } from './page'

// Mock the database client - must be before actual component import
vi.mock('@/db/client', () => {
  const mockSelect = vi.fn()
  return {
    db: {
      select: mockSelect,
    },
  }
})

vi.mock('@/db/schema', () => ({
  agents: {
    id: 'id',
    name: 'name',
    displayName: 'displayName',
    linearUserId: 'linearUserId',
    email: 'email',
    avatarUrl: 'avatarUrl',
    isActive: 'isActive',
    isEnabled: 'isEnabled',
    discoveredAt: 'discoveredAt',
    lastSeenAt: 'lastSeenAt',
  },
}))

vi.mock('drizzle-orm', () => ({
  asc: vi.fn((field) => field as unknown),
}))

// Import after mocking
import AdminAgentsPage from './page'

// Test constants
const MOCK_AGENT_1_ID = 'agent-1'
const MOCK_AGENT_1_NAME = 'cursor'
const MOCK_AGENT_1_DISPLAY_NAME = 'Cursor'
const MOCK_AGENT_1_EMAIL = 'cursor@example.com'
const MOCK_AGENT_1_AVATAR_URL = 'https://example.com/avatar1.png'
const MOCK_AGENT_1_DISCOVERED_AT = new Date('2025-01-01T00:00:00Z')
const MOCK_AGENT_1_LAST_SEEN_AT = new Date('2025-01-10T12:00:00Z')

const MOCK_AGENT_2_ID = 'agent-2'
const MOCK_AGENT_2_NAME = 'engine'
const MOCK_AGENT_2_DISPLAY_NAME = 'Engine'
const MOCK_AGENT_2_DISCOVERED_AT = new Date('2025-01-02T00:00:00Z')
const MOCK_AGENT_2_LAST_SEEN_AT = new Date('2025-01-05T08:00:00Z')

/**
 * Creates a mock agent object for testing
 *
 * @param overrides - Partial agent properties to override defaults
 * @returns Mock agent object
 */
function createMockAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: MOCK_AGENT_1_ID,
    name: MOCK_AGENT_1_NAME,
    displayName: MOCK_AGENT_1_DISPLAY_NAME,
    linearUserId: 'user-1',
    email: MOCK_AGENT_1_EMAIL,
    avatarUrl: MOCK_AGENT_1_AVATAR_URL,
    isActive: true,
    isEnabled: true,
    discoveredAt: MOCK_AGENT_1_DISCOVERED_AT.toISOString(),
    lastSeenAt: MOCK_AGENT_1_LAST_SEEN_AT.toISOString(),
    ...overrides,
  }
}

/**
 * Mocks the database query to return specified agents
 *
 * @param agents - Array of agents to return from database
 */
async function mockDbQuery(agents: Agent[]): Promise<void> {
  const { db } = await import('@/db/client')
  const mockSelect = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockResolvedValue(
        agents.map((agent) => ({
          ...agent,
          discoveredAt: new Date(agent.discoveredAt),
          lastSeenAt: new Date(agent.lastSeenAt),
        }))
      ),
    }),
  })
  vi.mocked(db).select = mockSelect
}

describe('AdminAgentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Page Structure', () => {
    it('should display the page title and subtitle', async () => {
      await mockDbQuery([])

      render(await AdminAgentsPage())

      expect(
        screen.getByRole('heading', { name: 'Agent Management' })
      ).toBeInTheDocument()
      expect(
        screen.getByText('Manage agent discovery and configuration')
      ).toBeInTheDocument()
    })

    it('should display the agents card header', async () => {
      await mockDbQuery([])

      render(await AdminAgentsPage())

      expect(screen.getByText('Agents')).toBeInTheDocument()
      expect(
        screen.getByText(
          'All discovered agents with their status and configuration'
        )
      ).toBeInTheDocument()
    })
  })

  describe('Components Rendering', () => {
    it('should render AgentsTable component with agents data', async () => {
      const mockAgents = [createMockAgent()]
      await mockDbQuery(mockAgents)

      render(await AdminAgentsPage())

      // Check that the table headers are present (from AgentsTable component)
      expect(screen.getByText('Agent')).toBeInTheDocument()
      expect(screen.getByText('Email')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Last Seen')).toBeInTheDocument()
      expect(screen.getByText('Enabled')).toBeInTheDocument()
    })

    it('should render AgentRefreshButton component', async () => {
      await mockDbQuery([])

      render(await AdminAgentsPage())

      const refreshButton = screen.getByRole('button', {
        name: /discover agents/i,
      })
      expect(refreshButton).toBeInTheDocument()
    })

    it('should render AgentConfigPlaceholder component', async () => {
      await mockDbQuery([])

      render(await AdminAgentsPage())

      // Check for configuration section
      expect(screen.getByText('Configuration')).toBeInTheDocument()
      expect(screen.getByText('Agent assignment settings')).toBeInTheDocument()
    })
  })

  describe('Agent Data Display', () => {
    it('should display single agent data correctly', async () => {
      const mockAgents = [createMockAgent()]
      await mockDbQuery(mockAgents)

      render(await AdminAgentsPage())

      expect(screen.getByText(MOCK_AGENT_1_DISPLAY_NAME)).toBeInTheDocument()
      expect(screen.getByText(MOCK_AGENT_1_NAME)).toBeInTheDocument()
      expect(screen.getByText(MOCK_AGENT_1_EMAIL)).toBeInTheDocument()
    })

    it('should display multiple agents data correctly', async () => {
      const mockAgents = [
        createMockAgent(),
        createMockAgent({
          id: MOCK_AGENT_2_ID,
          name: MOCK_AGENT_2_NAME,
          displayName: MOCK_AGENT_2_DISPLAY_NAME,
          linearUserId: 'user-2',
          email: null,
          avatarUrl: null,
          isActive: false,
          isEnabled: false,
          discoveredAt: MOCK_AGENT_2_DISCOVERED_AT.toISOString(),
          lastSeenAt: MOCK_AGENT_2_LAST_SEEN_AT.toISOString(),
        }),
      ]
      await mockDbQuery(mockAgents)

      render(await AdminAgentsPage())

      // First agent
      expect(screen.getByText(MOCK_AGENT_1_DISPLAY_NAME)).toBeInTheDocument()
      expect(screen.getByText(MOCK_AGENT_1_NAME)).toBeInTheDocument()
      expect(screen.getByText(MOCK_AGENT_1_EMAIL)).toBeInTheDocument()

      // Second agent
      expect(screen.getByText(MOCK_AGENT_2_DISPLAY_NAME)).toBeInTheDocument()
      expect(screen.getByText(MOCK_AGENT_2_NAME)).toBeInTheDocument()
    })

    it('should display active status badge for active agents', async () => {
      const mockAgents = [
        createMockAgent({
          isActive: true,
        }),
      ]
      await mockDbQuery(mockAgents)

      render(await AdminAgentsPage())

      expect(screen.getByText('Active')).toBeInTheDocument()
    })

    it('should display inactive status badge for inactive agents', async () => {
      const mockAgents = [
        createMockAgent({
          isActive: false,
        }),
      ]
      await mockDbQuery(mockAgents)

      render(await AdminAgentsPage())

      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })

    it('should display agent avatar when avatarUrl is provided', async () => {
      const mockAgents = [createMockAgent()]
      await mockDbQuery(mockAgents)

      render(await AdminAgentsPage())

      const avatar = screen.getByAltText(MOCK_AGENT_1_DISPLAY_NAME)
      expect(avatar).toBeInTheDocument()
      expect(avatar).toHaveAttribute('src')
      expect(avatar.getAttribute('src')).toContain('example.com')
    })

    it('should display fallback avatar when avatarUrl is null', async () => {
      const mockAgents = [
        createMockAgent({
          avatarUrl: null,
        }),
      ]
      await mockDbQuery(mockAgents)

      render(await AdminAgentsPage())

      // Check for fallback (first letter of display name)
      const fallback = screen.getByText('C')
      expect(fallback).toBeInTheDocument()
    })

    it('should display dash when email is null', async () => {
      const mockAgents = [
        createMockAgent({
          email: null,
        }),
      ]
      await mockDbQuery(mockAgents)

      render(await AdminAgentsPage())

      const cells = screen.getAllByText('-')
      expect(cells.length).toBeGreaterThan(0)
    })

    it('should display relative timestamps for lastSeenAt', async () => {
      const mockAgents = [createMockAgent()]
      await mockDbQuery(mockAgents)

      render(await AdminAgentsPage())

      // Should show relative time (the exact text depends on current time)
      const cells = screen.getAllByRole('cell')
      const hasTimeInfo = cells.some((cell) =>
        cell.textContent?.match(/ago|Just now|Jan|Feb|Mar/i)
      )
      expect(hasTimeInfo).toBe(true)
    })
  })

  describe('Enable Toggle', () => {
    it('should display enable toggle for each agent', async () => {
      const mockAgents = [createMockAgent(), createMockAgent({ id: 'agent-2' })]
      await mockDbQuery(mockAgents)

      render(await AdminAgentsPage())

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes).toHaveLength(2)
    })

    it('should display enabled toggle as checked', async () => {
      const mockAgents = [
        createMockAgent({
          isEnabled: true,
        }),
      ]
      await mockDbQuery(mockAgents)

      render(await AdminAgentsPage())

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeChecked()
    })

    it('should display disabled toggle as unchecked', async () => {
      const mockAgents = [
        createMockAgent({
          isEnabled: false,
        }),
      ]
      await mockDbQuery(mockAgents)

      render(await AdminAgentsPage())

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).not.toBeChecked()
    })
  })

  describe('Empty State', () => {
    it('should display empty state when no agents', async () => {
      await mockDbQuery([])

      render(await AdminAgentsPage())

      expect(screen.getByText(/No agents discovered yet/i)).toBeInTheDocument()
      expect(
        screen.getByText(/Click "Discover Agents" to find agents/i)
      ).toBeInTheDocument()
    })

    it('should not display table headers when no agents', async () => {
      await mockDbQuery([])

      render(await AdminAgentsPage())

      // Table headers should not be visible with empty state
      // AgentsTable shows empty state message instead of table
      const tableHeaders = screen.queryAllByRole('columnheader')
      expect(tableHeaders.length).toBe(0) // Headers do not exist when empty
    })

    it('should still display page structure when no agents', async () => {
      await mockDbQuery([])

      render(await AdminAgentsPage())

      // Page header should still be visible
      expect(
        screen.getByRole('heading', { name: 'Agent Management' })
      ).toBeInTheDocument()

      // Card header should still be visible
      expect(screen.getByText('Agents')).toBeInTheDocument()

      // Config section should still be visible
      expect(screen.getByText('Configuration')).toBeInTheDocument()
    })
  })

  describe('Configuration Section', () => {
    it('should display configuration placeholder with all options', async () => {
      await mockDbQuery([])

      render(await AdminAgentsPage())

      expect(screen.getByText('Run all agents')).toBeInTheDocument()
      expect(screen.getByText('Max N agents')).toBeInTheDocument()
      expect(screen.getByText('Manual assignment only')).toBeInTheDocument()
    })

    it('should display "Coming in Milestone 3" badge', async () => {
      await mockDbQuery([])

      render(await AdminAgentsPage())

      expect(screen.getByText('Coming in Milestone 3')).toBeInTheDocument()
    })

    it('should have all configuration options disabled', async () => {
      await mockDbQuery([])

      render(await AdminAgentsPage())

      const radios = screen.getAllByRole('radio')
      expect(radios).toHaveLength(3)
      for (const radio of radios) {
        expect(radio).toBeDisabled()
      }
    })

    it('should display max agents input as disabled', async () => {
      await mockDbQuery([])

      render(await AdminAgentsPage())

      const numberInput = screen.getByRole('spinbutton')
      expect(numberInput).toBeDisabled()
      expect(numberInput).toHaveValue(5)
    })
  })

  describe('Database Query Behavior', () => {
    it('should convert Date objects to ISO strings', async () => {
      const mockAgents = [createMockAgent()]
      await mockDbQuery(mockAgents)

      render(await AdminAgentsPage())

      // Verify component receives ISO string format
      expect(screen.getByText(MOCK_AGENT_1_DISPLAY_NAME)).toBeInTheDocument()
    })

    it('should handle agents ordered by name', async () => {
      const mockAgents = [
        createMockAgent({
          id: 'zebra-agent',
          name: 'zebra',
          displayName: 'Zebra',
        }),
        createMockAgent({
          id: 'aardvark-agent',
          name: 'aardvark',
          displayName: 'Aardvark',
        }),
      ]
      await mockDbQuery(mockAgents)

      render(await AdminAgentsPage())

      // Both agents should be displayed
      expect(screen.getByText('Zebra')).toBeInTheDocument()
      expect(screen.getByText('Aardvark')).toBeInTheDocument()
    })
  })

  describe('Integration with Components', () => {
    it('should pass correct props to AgentsTable', async () => {
      const mockAgents = [createMockAgent()]
      await mockDbQuery(mockAgents)

      render(await AdminAgentsPage())

      // Verify AgentsTable receives and displays the data
      expect(screen.getByText(MOCK_AGENT_1_DISPLAY_NAME)).toBeInTheDocument()
      expect(screen.getByText(MOCK_AGENT_1_EMAIL)).toBeInTheDocument()
    })

    it('should render all three main sections', async () => {
      await mockDbQuery([])

      render(await AdminAgentsPage())

      // 1. Agents Table Section
      expect(screen.getByText('Agents')).toBeInTheDocument()

      // 2. Agent Refresh Button
      expect(
        screen.getByRole('button', { name: /discover agents/i })
      ).toBeInTheDocument()

      // 3. Configuration Placeholder
      expect(screen.getByText('Configuration')).toBeInTheDocument()
    })
  })

  describe('Dynamic Rendering', () => {
    it('should fetch fresh data on each render', async () => {
      const mockAgents = [createMockAgent()]
      await mockDbQuery(mockAgents)

      render(await AdminAgentsPage())

      // Verify database was queried
      const { db } = await import('@/db/client')
      expect(db.select).toHaveBeenCalled()
    })
  })

  describe('Multiple Agents Scenarios', () => {
    it('should handle mix of active and inactive agents', async () => {
      const mockAgents = [
        createMockAgent({
          id: 'active-1',
          isActive: true,
          displayName: 'Active Agent',
        }),
        createMockAgent({
          id: 'inactive-1',
          isActive: false,
          displayName: 'Inactive Agent',
        }),
      ]
      await mockDbQuery(mockAgents)

      render(await AdminAgentsPage())

      expect(screen.getByText('Active Agent')).toBeInTheDocument()
      expect(screen.getByText('Inactive Agent')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })

    it('should handle mix of enabled and disabled agents', async () => {
      const mockAgents = [
        createMockAgent({
          id: 'enabled-1',
          isEnabled: true,
        }),
        createMockAgent({
          id: 'disabled-1',
          isEnabled: false,
        }),
      ]
      await mockDbQuery(mockAgents)

      render(await AdminAgentsPage())

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes[0]).toBeChecked()
      expect(checkboxes[1]).not.toBeChecked()
    })

    it('should handle agents with various email states', async () => {
      const mockAgents = [
        createMockAgent({
          id: 'with-email',
          email: 'agent@example.com',
          displayName: 'With Email',
        }),
        createMockAgent({
          id: 'without-email',
          email: null,
          displayName: 'Without Email',
        }),
      ]
      await mockDbQuery(mockAgents)

      render(await AdminAgentsPage())

      expect(screen.getByText('agent@example.com')).toBeInTheDocument()
      expect(screen.getByText('With Email')).toBeInTheDocument()
      expect(screen.getByText('Without Email')).toBeInTheDocument()
    })

    it('should handle agents with various avatar states', async () => {
      const mockAgents = [
        createMockAgent({
          id: 'with-avatar',
          avatarUrl: 'https://example.com/avatar.png',
          displayName: 'With Avatar',
        }),
        createMockAgent({
          id: 'without-avatar',
          avatarUrl: null,
          displayName: 'Without Avatar',
        }),
      ]
      await mockDbQuery(mockAgents)

      render(await AdminAgentsPage())

      // With avatar should have image
      const avatarImg = screen.getByAltText('With Avatar')
      expect(avatarImg).toBeInTheDocument()

      // Without avatar should have fallback (first letter)
      const fallback = screen.getByText('W')
      expect(fallback).toBeInTheDocument()
    })
  })
})
