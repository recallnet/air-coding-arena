/**
 * Tests for GET /api/agents endpoint.
 *
 * @packageDocumentation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/db/client'
import { agents } from '@/db/schema'

import { GET } from './route'

// Mock database
vi.mock('@/db/client', () => ({
  db: {
    select: vi.fn(),
  },
}))

describe('GET /api/agents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return empty array when no agents exist', async () => {
    // Mock empty database result
    const mockFrom = vi.fn().mockReturnValue({
      orderBy: vi.fn().mockResolvedValue([]),
    })
    const mockSelect = vi.fn().mockReturnValue({
      from: mockFrom,
    })
    vi.mocked(db.select).mockImplementation(mockSelect as never)

    const response = await GET()
    const data = (await response.json()) as { agents: unknown[] }

    expect(response.status).toBe(200)
    expect(data.agents).toEqual([])
    expect(db.select).toHaveBeenCalled()
  })

  it('should return all agents with correct shape', async () => {
    // Mock database result with agents
    const mockAgents = [
      {
        id: 'agent-1',
        name: 'cursor',
        displayName: 'Cursor',
        linearUserId: 'linear-user-1',
        email: 'cursor@oauthapp.linear.app',
        avatarUrl: 'https://example.com/avatar1.png',
        isActive: true,
        isEnabled: true,
        discoveredAt: new Date('2025-01-01T00:00:00Z'),
        lastSeenAt: new Date('2025-01-02T00:00:00Z'),
      },
      {
        id: 'agent-2',
        name: 'engine',
        displayName: 'Engine',
        linearUserId: 'linear-user-2',
        email: 'engine@oauthapp.linear.app',
        avatarUrl: null,
        isActive: false,
        isEnabled: false,
        discoveredAt: new Date('2025-01-01T00:00:00Z'),
        lastSeenAt: new Date('2025-01-01T12:00:00Z'),
      },
    ]

    const mockFrom = vi.fn().mockReturnValue({
      orderBy: vi.fn().mockResolvedValue(mockAgents),
    })
    const mockSelect = vi.fn().mockReturnValue({
      from: mockFrom,
    })
    vi.mocked(db.select).mockImplementation(mockSelect as never)

    const response = await GET()
    const data = (await response.json()) as {
      agents: Array<{
        id: string
        name: string
        displayName: string
        linearUserId: string
        email: string | null
        avatarUrl: string | null
        isActive: boolean
        isEnabled: boolean
        discoveredAt: Date
        lastSeenAt: Date
      }>
    }

    expect(response.status).toBe(200)
    expect(data.agents).toHaveLength(2)

    // Check first agent
    const agent1 = data.agents.find((a) => a.name === 'cursor')
    expect(agent1).toBeDefined()
    expect(agent1).toMatchObject({
      name: 'cursor',
      displayName: 'Cursor',
      linearUserId: 'linear-user-1',
      email: 'cursor@oauthapp.linear.app',
      avatarUrl: 'https://example.com/avatar1.png',
      isActive: true,
      isEnabled: true,
    })

    // Check second agent
    const agent2 = data.agents.find((a) => a.name === 'engine')
    expect(agent2).toBeDefined()
    expect(agent2).toMatchObject({
      name: 'engine',
      displayName: 'Engine',
      linearUserId: 'linear-user-2',
      email: 'engine@oauthapp.linear.app',
      avatarUrl: null,
      isActive: false,
      isEnabled: false,
    })
  })
})

// Integration tests - run against real database
describe.skipIf(
  !process.env['DATABASE_URL'] || process.env['IS_TEST_DB_URL'] === 'true'
)('GET /api/agents (integration)', () => {
  beforeEach(async () => {
    // Clean up agents table before each test
    await db.delete(agents)
  })

  it('should return empty array when no agents exist', async () => {
    const response = await GET()
    const data = (await response.json()) as { agents: unknown[] }

    expect(response.status).toBe(200)
    expect(data.agents).toEqual([])
  })

  it('should return all agents with correct shape', async () => {
    // Insert test agents
    await db.insert(agents).values([
      {
        name: 'cursor',
        displayName: 'Cursor',
        linearUserId: 'linear-user-1',
        email: 'cursor@oauthapp.linear.app',
        avatarUrl: 'https://example.com/avatar1.png',
        isActive: true,
        isEnabled: true,
        discoveredAt: new Date('2025-01-01T00:00:00Z'),
        lastSeenAt: new Date('2025-01-02T00:00:00Z'),
      },
      {
        name: 'engine',
        displayName: 'Engine',
        linearUserId: 'linear-user-2',
        email: 'engine@oauthapp.linear.app',
        avatarUrl: null,
        isActive: false,
        isEnabled: false,
        discoveredAt: new Date('2025-01-01T00:00:00Z'),
        lastSeenAt: new Date('2025-01-01T12:00:00Z'),
      },
    ])

    const response = await GET()
    const data = (await response.json()) as {
      agents: Array<{
        id: string
        name: string
        displayName: string
        linearUserId: string
        email: string | null
        avatarUrl: string | null
        isActive: boolean
        isEnabled: boolean
        discoveredAt: string
        lastSeenAt: string
      }>
    }

    expect(response.status).toBe(200)
    expect(data.agents).toHaveLength(2)

    // Check first agent
    const agent1 = data.agents.find((a) => a.name === 'cursor')
    expect(agent1).toBeDefined()
    expect(agent1).toMatchObject({
      name: 'cursor',
      displayName: 'Cursor',
      linearUserId: 'linear-user-1',
      email: 'cursor@oauthapp.linear.app',
      avatarUrl: 'https://example.com/avatar1.png',
      isActive: true,
      isEnabled: true,
    })
    expect(agent1?.id).toBeTruthy()
    expect(agent1?.discoveredAt).toBe('2025-01-01T00:00:00.000Z')
    expect(agent1?.lastSeenAt).toBe('2025-01-02T00:00:00.000Z')

    // Check second agent
    const agent2 = data.agents.find((a) => a.name === 'engine')
    expect(agent2).toBeDefined()
    expect(agent2).toMatchObject({
      name: 'engine',
      displayName: 'Engine',
      linearUserId: 'linear-user-2',
      email: 'engine@oauthapp.linear.app',
      avatarUrl: null,
      isActive: false,
      isEnabled: false,
    })
  })

  it('should return agents sorted by name', async () => {
    // Insert agents in non-alphabetical order
    await db.insert(agents).values([
      {
        name: 'zebra',
        displayName: 'Zebra',
        linearUserId: 'linear-user-z',
        email: null,
        avatarUrl: null,
        isActive: true,
        isEnabled: true,
      },
      {
        name: 'alpha',
        displayName: 'Alpha',
        linearUserId: 'linear-user-a',
        email: null,
        avatarUrl: null,
        isActive: true,
        isEnabled: true,
      },
      {
        name: 'middle',
        displayName: 'Middle',
        linearUserId: 'linear-user-m',
        email: null,
        avatarUrl: null,
        isActive: true,
        isEnabled: true,
      },
    ])

    const response = await GET()
    const data = (await response.json()) as {
      agents: Array<{ name: string }>
    }

    expect(response.status).toBe(200)
    expect(data.agents.map((a) => a.name)).toEqual(['alpha', 'middle', 'zebra'])
  })
})
