/**
 * Tests for agent discovery functions
 * @packageDocumentation
 */

import { LinearClient } from '@linear/sdk'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { isAgent, discoverAgents } from './agent-discovery'

// Mock the Linear SDK
vi.mock('@linear/sdk')

// Mock the database client
vi.mock('@/db/client', () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
  },
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock typing
type MockFunction = any

describe('isAgent', () => {
  it('returns true for OAuth app email pattern', () => {
    const user = {
      id: 'user-1',
      name: 'cursor',
      // eslint-disable-next-line no-secrets/no-secrets -- Test data
      email: 'afd5064f-8c2e-4f60-a91a-2b753321d325@oauthapp.linear.app',
      displayName: 'Cursor',
      guest: false,
    }
    expect(isAgent(user)).toBe(true)
  })

  it('returns true for any UUID with oauthapp.linear.app domain', () => {
    const user = {
      id: 'user-2',
      name: 'engine',
      email: '19b2fc19-10a3-4502-b030-417149f1fe3e@oauthapp.linear.app',
      displayName: 'Engine',
      guest: false,
    }
    expect(isAgent(user)).toBe(true)
  })

  it('returns false for human email addresses', () => {
    const user = {
      id: 'user-3',
      name: 'andrew',
      email: 'andrew@textile.io',
      displayName: 'Andrew',
      guest: false,
    }
    expect(isAgent(user)).toBe(false)
  })

  it('returns false for guest users even with OAuth pattern', () => {
    const user = {
      id: 'user-4',
      name: 'guest-agent',
      email: 'test-uuid@oauthapp.linear.app',
      displayName: 'Guest Agent',
      guest: true,
    }
    expect(isAgent(user)).toBe(false)
  })

  it('returns false for users without email', () => {
    const user = {
      id: 'user-5',
      name: 'no-email',
      email: null,
      displayName: 'No Email',
      guest: false,
    }
    expect(isAgent(user)).toBe(false)
  })

  it('returns false for undefined email', () => {
    const user = {
      id: 'user-6',
      name: 'undefined-email',
      email: null,
      displayName: 'Undefined Email',
      guest: false,
    }
    expect(isAgent(user)).toBe(false)
  })

  it('returns false for non-guest human users', () => {
    const user = {
      id: 'user-7',
      name: 'carson',
      email: 'carson@textile.io',
      displayName: 'Carson',
      guest: false,
    }
    expect(isAgent(user)).toBe(false)
  })
})

describe('discoverAgents', () => {
  const TEST_LINEAR_ID_1 = 'linear-user-1'
  const TEST_LINEAR_ID_2 = 'linear-user-2'
  const TEST_EMAIL_1 = 'uuid-1@oauthapp.linear.app'
  const TEST_EMAIL_2 = 'uuid-2@oauthapp.linear.app'

  beforeEach(() => {
    vi.clearAllMocks()

    // Set environment variables
    process.env['LINEAR_API_KEY'] = 'test-api-key'
    process.env['KNOWN_CODING_AGENTS'] = 'cursor,engine,factory,cyrus'
  })

  it('discovers agents from Linear API with OAuth email pattern', async () => {
    // Mock Linear API response with 2 agents and 1 human
    const mockUsers = {
      nodes: [
        {
          id: TEST_LINEAR_ID_1,
          name: 'Cursor',
          email: TEST_EMAIL_1,
          displayName: 'Cursor',
          avatarUrl: 'https://avatar1.com',
          guest: false,
        },
        {
          id: TEST_LINEAR_ID_2,
          name: 'Engine',
          email: TEST_EMAIL_2,
          displayName: 'Engine',
          avatarUrl: 'https://avatar2.com',
          guest: false,
        },
        {
          id: 'linear-user-3',
          name: 'Andrew Hill',
          email: 'andrew@textile.io',
          displayName: 'Andrew Hill',
          avatarUrl: 'https://avatar3.com',
          guest: false,
        },
      ],
    }

    const mockLinearClient = {
      users: vi.fn().mockResolvedValue(mockUsers),
    }
    vi.mocked(LinearClient).mockImplementation(() => mockLinearClient as MockFunction)

    // Import db after mocking
    const { db } = await import('@/db/client')

    // Setup db.select() mock for checking existing agents
    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockLimit = vi.fn()

    // Return empty for first two agent checks (they don't exist)
    // Return empty for config check (it doesn't exist)
    mockLimit
      .mockResolvedValueOnce([]) // cursor doesn't exist
      .mockResolvedValueOnce([]) // engine doesn't exist
      .mockResolvedValueOnce([]) // config doesn't exist

    vi.mocked(db.select).mockReturnValue({
      from: mockFrom,
    } as MockFunction)
    mockFrom.mockReturnValue({
      where: mockWhere,
    } as MockFunction)
    mockWhere.mockReturnValue({
      limit: mockLimit,
    } as MockFunction)

    // Setup db.insert() mock
    const mockInsertValues = vi.fn().mockResolvedValue([{ id: 'new-id' }])
    vi.mocked(db.insert).mockReturnValue({
      values: mockInsertValues,
    } as MockFunction)

    // Setup db.update() mock
    const mockSet = vi.fn().mockReturnThis()
    const mockUpdateWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([{ id: 'old-agent' }])

    vi.mocked(db.update).mockReturnValue({
      set: mockSet,
    } as MockFunction)
    mockSet.mockReturnValue({
      where: mockUpdateWhere,
    } as MockFunction)
    mockUpdateWhere.mockReturnValue({
      returning: mockReturning,
    } as MockFunction)

    // Call discoverAgents
    const result = await discoverAgents()

    // Verify results
    expect(result.discovered).toBe(2) // 2 new agents
    expect(result.updated).toBe(0) // no existing agents
    expect(result.deactivated).toBe(1) // 1 old agent marked inactive

    // Verify Linear API was called
    expect(mockLinearClient.users).toHaveBeenCalledTimes(1)
  })

  it('sets isEnabled=true for known agents', async () => {
    const mockUsers = {
      nodes: [
        {
          id: TEST_LINEAR_ID_1,
          name: 'Cursor',
          email: TEST_EMAIL_1,
          displayName: 'Cursor',
          avatarUrl: null,
          guest: false,
        },
      ],
    }

    const mockLinearClient = {
      users: vi.fn().mockResolvedValue(mockUsers),
    }
    vi.mocked(LinearClient).mockImplementation(() => mockLinearClient as MockFunction)

    const { db } = await import('@/db/client')

    // Setup mocks
    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockResolvedValue([])

    vi.mocked(db.select).mockReturnValue({ from: mockFrom } as MockFunction)
    mockFrom.mockReturnValue({ where: mockWhere } as MockFunction)
    mockWhere.mockReturnValue({ limit: mockLimit } as MockFunction)

    const mockInsertValues = vi.fn().mockResolvedValue([{ id: 'new-id' }])
    vi.mocked(db.insert).mockReturnValue({ values: mockInsertValues } as MockFunction)

    const mockSet = vi.fn().mockReturnThis()
    const mockUpdateWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([])
    vi.mocked(db.update).mockReturnValue({ set: mockSet } as MockFunction)
    mockSet.mockReturnValue({ where: mockUpdateWhere } as MockFunction)
    mockUpdateWhere.mockReturnValue({ returning: mockReturning } as MockFunction)

    await discoverAgents()

    // Verify cursor (known agent) was inserted with isEnabled=true
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'cursor',
        isEnabled: true,
      })
    )
  })

  it('sets isEnabled=false for unknown agents', async () => {
    const mockUsers = {
      nodes: [
        {
          id: TEST_LINEAR_ID_1,
          name: 'NotionAI',
          email: TEST_EMAIL_1,
          displayName: 'Notion AI',
          avatarUrl: null,
          guest: false,
        },
      ],
    }

    const mockLinearClient = {
      users: vi.fn().mockResolvedValue(mockUsers),
    }
    vi.mocked(LinearClient).mockImplementation(() => mockLinearClient as MockFunction)

    const { db } = await import('@/db/client')

    // Setup mocks
    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockResolvedValue([])

    vi.mocked(db.select).mockReturnValue({ from: mockFrom } as MockFunction)
    mockFrom.mockReturnValue({ where: mockWhere } as MockFunction)
    mockWhere.mockReturnValue({ limit: mockLimit } as MockFunction)

    const mockInsertValues = vi.fn().mockResolvedValue([{ id: 'new-id' }])
    vi.mocked(db.insert).mockReturnValue({ values: mockInsertValues } as MockFunction)

    const mockSet = vi.fn().mockReturnThis()
    const mockUpdateWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([])
    vi.mocked(db.update).mockReturnValue({ set: mockSet } as MockFunction)
    mockSet.mockReturnValue({ where: mockUpdateWhere } as MockFunction)
    mockUpdateWhere.mockReturnValue({ returning: mockReturning } as MockFunction)

    await discoverAgents()

    // Verify notionai (unknown agent) was inserted with isEnabled=false
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'notionai',
        isEnabled: false,
      })
    )
  })

  it('uses default known agents if env var not set', async () => {
    delete process.env['KNOWN_CODING_AGENTS']

    const mockUsers = {
      nodes: [
        {
          id: TEST_LINEAR_ID_1,
          name: 'Cursor',
          email: TEST_EMAIL_1,
          displayName: 'Cursor',
          avatarUrl: null,
          guest: false,
        },
      ],
    }

    const mockLinearClient = {
      users: vi.fn().mockResolvedValue(mockUsers),
    }
    vi.mocked(LinearClient).mockImplementation(() => mockLinearClient as MockFunction)

    const { db } = await import('@/db/client')

    // Setup mocks
    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockResolvedValue([])

    vi.mocked(db.select).mockReturnValue({ from: mockFrom } as MockFunction)
    mockFrom.mockReturnValue({ where: mockWhere } as MockFunction)
    mockWhere.mockReturnValue({ limit: mockLimit } as MockFunction)

    const mockInsertValues = vi.fn().mockResolvedValue([{ id: 'new-id' }])
    vi.mocked(db.insert).mockReturnValue({ values: mockInsertValues } as MockFunction)

    const mockSet = vi.fn().mockReturnThis()
    const mockUpdateWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([])
    vi.mocked(db.update).mockReturnValue({ set: mockSet } as MockFunction)
    mockSet.mockReturnValue({ where: mockUpdateWhere } as MockFunction)
    mockUpdateWhere.mockReturnValue({ returning: mockReturning } as MockFunction)

    await discoverAgents()

    // Verify cursor (known in default list) was inserted with isEnabled=true
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'cursor',
        isEnabled: true,
      })
    )
  })

  it('marks agents not seen as inactive', async () => {
    const mockUsers = {
      nodes: [
        {
          id: TEST_LINEAR_ID_1,
          name: 'Cursor',
          email: TEST_EMAIL_1,
          displayName: 'Cursor',
          avatarUrl: null,
          guest: false,
        },
      ],
    }

    const mockLinearClient = {
      users: vi.fn().mockResolvedValue(mockUsers),
    }
    vi.mocked(LinearClient).mockImplementation(() => mockLinearClient as MockFunction)

    const { db } = await import('@/db/client')

    // Setup mocks
    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockResolvedValue([])

    vi.mocked(db.select).mockReturnValue({ from: mockFrom } as MockFunction)
    mockFrom.mockReturnValue({ where: mockWhere } as MockFunction)
    mockWhere.mockReturnValue({ limit: mockLimit } as MockFunction)

    const mockInsertValues = vi.fn().mockResolvedValue([{ id: 'new-id' }])
    vi.mocked(db.insert).mockReturnValue({ values: mockInsertValues } as MockFunction)

    const mockSet = vi.fn().mockReturnThis()
    const mockUpdateWhere = vi.fn().mockReturnThis()
    // Two old agents marked inactive
    const mockReturning = vi
      .fn()
      .mockResolvedValue([{ id: 'agent-old-1' }, { id: 'agent-old-2' }])
    vi.mocked(db.update).mockReturnValue({ set: mockSet } as MockFunction)
    mockSet.mockReturnValue({ where: mockUpdateWhere } as MockFunction)
    mockUpdateWhere.mockReturnValue({ returning: mockReturning } as MockFunction)

    const result = await discoverAgents()

    // Verify 2 agents were marked inactive
    expect(result.deactivated).toBe(2)
  })

  it('updates lastDiscoveryAt in agent_config', async () => {
    const mockUsers = {
      nodes: [],
    }

    const mockLinearClient = {
      users: vi.fn().mockResolvedValue(mockUsers),
    }
    vi.mocked(LinearClient).mockImplementation(() => mockLinearClient as MockFunction)

    const { db } = await import('@/db/client')

    // Setup mocks
    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockResolvedValue([])

    vi.mocked(db.select).mockReturnValue({ from: mockFrom } as MockFunction)
    mockFrom.mockReturnValue({ where: mockWhere } as MockFunction)
    mockWhere.mockReturnValue({ limit: mockLimit } as MockFunction)

    const mockInsertValues = vi.fn().mockResolvedValue([{ id: 'config-id' }])
    vi.mocked(db.insert).mockReturnValue({ values: mockInsertValues } as MockFunction)

    // For update, when seenLinearUserIds is empty, .set() is followed by .returning() directly
    const mockReturning = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({
      returning: mockReturning,
    })
    vi.mocked(db.update).mockReturnValue({ set: mockSet } as MockFunction)

    await discoverAgents()

    // Verify config insert was called with lastDiscoveryAt
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        lastDiscoveryAt: expect.any(Date),
      })
    )
  })

  it('throws error if LINEAR_API_KEY not configured', async () => {
    delete process.env['LINEAR_API_KEY']

    await expect(discoverAgents()).rejects.toThrow('LINEAR_API_KEY not configured')
  })
})
