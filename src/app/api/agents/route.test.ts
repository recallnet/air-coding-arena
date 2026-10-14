/**
 * Tests for GET /api/agents endpoint.
 *
 * @packageDocumentation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/db/client'

import { GET } from './route'

// Test constants
const TEST_EMAIL_CURSOR = 'cursor@oauthapp.linear.app'
const TEST_EMAIL_ENGINE = 'engine@oauthapp.linear.app'
const TEST_AVATAR_URL = 'https://example.com/avatar1.png'
const TEST_LINEAR_USER_1 = 'linear-user-1'
const TEST_LINEAR_USER_2 = 'linear-user-2'
const TEST_DATE_DISCOVERED = '2025-01-01T00:00:00Z'
const TEST_DATE_LAST_SEEN = '2025-01-02T00:00:00Z'

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
        slug: 'cursor',
        displayName: 'Cursor',
        linearUserId: TEST_LINEAR_USER_1,
        email: TEST_EMAIL_CURSOR,
        avatarUrl: TEST_AVATAR_URL,
        isActive: true,
        isEnabled: true,
        discoveredAt: new Date(TEST_DATE_DISCOVERED),
        lastSeenAt: new Date(TEST_DATE_LAST_SEEN),
      },
      {
        id: 'agent-2',
        name: 'engine',
        slug: 'engine',
        displayName: 'Engine',
        linearUserId: TEST_LINEAR_USER_2,
        email: TEST_EMAIL_ENGINE,
        avatarUrl: null,
        isActive: false,
        isEnabled: false,
        discoveredAt: new Date(TEST_DATE_DISCOVERED),
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
      slug: 'cursor',
      displayName: 'Cursor',
      linearUserId: TEST_LINEAR_USER_1,
      email: TEST_EMAIL_CURSOR,
      avatarUrl: TEST_AVATAR_URL,
      isActive: true,
      isEnabled: true,
    })

    // Check second agent
    const agent2 = data.agents.find((a) => a.name === 'engine')
    expect(agent2).toBeDefined()
    expect(agent2).toMatchObject({
      name: 'engine',
      slug: 'engine',
      displayName: 'Engine',
      linearUserId: TEST_LINEAR_USER_2,
      email: TEST_EMAIL_ENGINE,
      avatarUrl: null,
      isActive: false,
      isEnabled: false,
    })
  })
})
