/**
 * Tests for agent configuration
 * @packageDocumentation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/db/client'
import { agents } from '@/db/schema'

import { getAgentConfigs, getAgentHandles, getAgentNames } from './agent-config'

/**
 * Check if we're using a real database for integration tests.
 * Skip these tests if we're using the dummy test URL.
 */
const isRealDatabase = process.env['IS_TEST_DB_URL'] !== 'true'

// Test constants
const DISABLED_AGENT_NAME = 'disabled'
const DISABLED_AGENT_DISPLAY_NAME = 'Disabled'
const EMPTY_AGENTS_TEST_DESC = 'should return empty array if no enabled agents'
const SKIP_MESSAGE = 'Skipping: dummy database'

describe('agent-config', () => {
  beforeEach(async () => {
    if (!isRealDatabase) return
    // Clear agents table before each test
    await db.delete(agents)
  })

  describe('getAgentConfigs', () => {
    it('should return enabled agents from database', async () => {
      if (!isRealDatabase) {
        console.log(SKIP_MESSAGE)
        return
      }

      // Insert test agents
      await db.insert(agents).values([
        {
          name: 'cursor',
          slug: 'cursor',
          displayName: 'Cursor',
          linearUserId: 'user-1',
          isEnabled: true,
          isActive: true,
        },
        {
          name: 'engine',
          slug: 'engine',
          displayName: 'Engine',
          linearUserId: 'user-2',
          isEnabled: true,
          isActive: true,
        },
        {
          name: DISABLED_AGENT_NAME,
          slug: DISABLED_AGENT_NAME.toLowerCase().replace(/ /g, '-'),
          displayName: DISABLED_AGENT_DISPLAY_NAME,
          linearUserId: 'user-3',
          isEnabled: false,
          isActive: true,
        },
      ])

      const configs = await getAgentConfigs()

      expect(configs).toHaveLength(2)
      expect(configs).toEqual([
        {
          name: 'cursor',
          slug: 'cursor',
          handle: '@Cursor',
          displayName: 'Cursor',
          linearUserId: 'user-1',
        },
        {
          name: 'engine',
          slug: 'engine',
          handle: '@Engine',
          displayName: 'Engine',
          linearUserId: 'user-2',
        },
      ])
    })

    it(EMPTY_AGENTS_TEST_DESC, async () => {
      if (!isRealDatabase) {
        console.log(SKIP_MESSAGE)
        return
      }

      // Insert only disabled agent
      await db.insert(agents).values([
        {
          name: DISABLED_AGENT_NAME,
          slug: DISABLED_AGENT_NAME.toLowerCase().replace(/ /g, '-'),
          displayName: DISABLED_AGENT_DISPLAY_NAME,
          linearUserId: 'user-1',
          isEnabled: false,
          isActive: true,
        },
      ])

      const configs = await getAgentConfigs()
      expect(configs).toEqual([])
    })

    it('should order agents by name', async () => {
      if (!isRealDatabase) {
        console.log(SKIP_MESSAGE)
        return
      }

      await db.insert(agents).values([
        {
          name: 'zzz',
          slug: 'zzz',
          displayName: 'ZZZ',
          linearUserId: 'user-1',
          isEnabled: true,
          isActive: true,
        },
        {
          name: 'aaa',
          slug: 'aaa',
          displayName: 'AAA',
          linearUserId: 'user-2',
          isEnabled: true,
          isActive: true,
        },
        {
          name: 'mmm',
          slug: 'mmm',
          displayName: 'MMM',
          linearUserId: 'user-3',
          isEnabled: true,
          isActive: true,
        },
      ])

      const configs = await getAgentConfigs()
      expect(configs.map((c) => c.name)).toEqual(['aaa', 'mmm', 'zzz'])
    })

    it('should use display name for handle', async () => {
      if (!isRealDatabase) {
        console.log(SKIP_MESSAGE)
        return
      }

      await db.insert(agents).values([
        {
          name: 'cursor-agent',
          slug: 'cursor-agent',
          displayName: 'Cursor AI',
          linearUserId: 'user-1',
          isEnabled: true,
          isActive: true,
        },
      ])

      const configs = await getAgentConfigs()
      expect(configs[0]?.handle).toBe('@Cursor AI')
      expect(configs[0]?.displayName).toBe('Cursor AI')
      expect(configs[0]?.linearUserId).toBe('user-1')
    })
  })

  describe('getAgentHandles', () => {
    it('should return array of handles', async () => {
      if (!isRealDatabase) {
        console.log(SKIP_MESSAGE)
        return
      }

      await db.insert(agents).values([
        {
          name: 'cursor',
          slug: 'cursor',
          displayName: 'Cursor',
          linearUserId: 'user-1',
          isEnabled: true,
          isActive: true,
        },
        {
          name: 'engine',
          slug: 'engine',
          displayName: 'Engine',
          linearUserId: 'user-2',
          isEnabled: true,
          isActive: true,
        },
      ])

      const handles = await getAgentHandles()
      expect(handles).toEqual(['@Cursor', '@Engine'])
    })

    it(EMPTY_AGENTS_TEST_DESC, async () => {
      if (!isRealDatabase) {
        console.log(SKIP_MESSAGE)
        return
      }

      const handles = await getAgentHandles()
      expect(handles).toEqual([])
    })
  })

  describe('getAgentNames', () => {
    it('should return array of names', async () => {
      if (!isRealDatabase) {
        console.log(SKIP_MESSAGE)
        return
      }

      await db.insert(agents).values([
        {
          name: 'cursor',
          slug: 'cursor',
          displayName: 'Cursor',
          linearUserId: 'user-1',
          isEnabled: true,
          isActive: true,
        },
        {
          name: 'engine',
          slug: 'engine',
          displayName: 'Engine',
          linearUserId: 'user-2',
          isEnabled: true,
          isActive: true,
        },
      ])

      const names = await getAgentNames()
      expect(names).toEqual(['cursor', 'engine'])
    })

    it(EMPTY_AGENTS_TEST_DESC, async () => {
      if (!isRealDatabase) {
        console.log(SKIP_MESSAGE)
        return
      }

      const names = await getAgentNames()
      expect(names).toEqual([])
    })
  })
})

// Unit tests with mocked database
vi.mock('@/db/client', async () => {
  const actual = await vi.importActual('@/db/client')
  return {
    ...actual,
    db: {
      select: vi.fn(),
      delete: vi.fn(),
      insert: vi.fn(),
    },
  }
})

describe('agent-config unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAgentConfigs - unit', () => {
    it('should return mapped agent configs from database', async () => {
      const mockAgents = [
        {
          name: 'cursor',
          slug: 'cursor',
          displayName: 'Cursor',
          linearUserId: 'user-1',
          isEnabled: true,
          isActive: true,
        },
        {
          name: 'engine',
          slug: 'engine',
          displayName: 'Engine',
          linearUserId: 'user-2',
          isEnabled: true,
          isActive: true,
        },
      ]

      const mockOrderBy = vi.fn().mockResolvedValue(mockAgents)
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

      vi.mocked(db.select).mockImplementation(mockSelect as never)

      const configs = await getAgentConfigs()

      expect(mockSelect).toHaveBeenCalled()
      expect(mockFrom).toHaveBeenCalledWith(agents)
      expect(mockWhere).toHaveBeenCalled()
      expect(mockOrderBy).toHaveBeenCalled()

      expect(configs).toHaveLength(2)
      expect(configs).toEqual([
        {
          name: 'cursor',
          handle: '@Cursor',
          displayName: 'Cursor',
          linearUserId: 'user-1',
        },
        {
          name: 'engine',
          handle: '@Engine',
          displayName: 'Engine',
          linearUserId: 'user-2',
        },
      ])
    })

    it('should return empty array when no agents found', async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([])
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

      vi.mocked(db.select).mockImplementation(mockSelect as never)

      const configs = await getAgentConfigs()

      expect(configs).toEqual([])
    })

    it('should correctly format handle with @ prefix', async () => {
      const mockAgents = [
        {
          name: 'test-agent',
          slug: 'test-agent',
          displayName: 'TestAgent',
          linearUserId: 'user-1',
          isEnabled: true,
          isActive: true,
        },
      ]

      const mockOrderBy = vi.fn().mockResolvedValue(mockAgents)
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

      vi.mocked(db.select).mockImplementation(mockSelect as never)

      const configs = await getAgentConfigs()

      expect(configs[0]?.handle).toBe('@TestAgent')
    })

    it('should handle display names with spaces', async () => {
      const mockAgents = [
        {
          name: 'my-agent',
          slug: 'my-agent',
          displayName: 'My Agent Name',
          linearUserId: 'user-1',
          isEnabled: true,
          isActive: true,
        },
      ]

      const mockOrderBy = vi.fn().mockResolvedValue(mockAgents)
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

      vi.mocked(db.select).mockImplementation(mockSelect as never)

      const configs = await getAgentConfigs()

      expect(configs[0]?.handle).toBe('@My Agent Name')
      expect(configs[0]?.displayName).toBe('My Agent Name')
    })

    it('should propagate database errors', async () => {
      const mockError = new Error('Database connection failed')
      const mockOrderBy = vi.fn().mockRejectedValue(mockError)
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

      vi.mocked(db.select).mockImplementation(mockSelect as never)

      await expect(getAgentConfigs()).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('should preserve linearUserId in output', async () => {
      const mockAgents = [
        {
          name: 'cursor',
          slug: 'cursor',
          displayName: 'Cursor',
          linearUserId: 'linear-uuid-123',
          isEnabled: true,
          isActive: true,
        },
      ]

      const mockOrderBy = vi.fn().mockResolvedValue(mockAgents)
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

      vi.mocked(db.select).mockImplementation(mockSelect as never)

      const configs = await getAgentConfigs()

      expect(configs[0]?.linearUserId).toBe('linear-uuid-123')
    })
  })

  describe('getAgentHandles - unit', () => {
    it('should return handles from agent configs', async () => {
      const mockAgents = [
        {
          name: 'cursor',
          slug: 'cursor',
          displayName: 'Cursor',
          linearUserId: 'user-1',
          isEnabled: true,
          isActive: true,
        },
        {
          name: 'engine',
          slug: 'engine',
          displayName: 'Engine',
          linearUserId: 'user-2',
          isEnabled: true,
          isActive: true,
        },
      ]

      const mockOrderBy = vi.fn().mockResolvedValue(mockAgents)
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

      vi.mocked(db.select).mockImplementation(mockSelect as never)

      const handles = await getAgentHandles()

      expect(handles).toEqual(['@Cursor', '@Engine'])
    })

    it('should return empty array when no agents', async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([])
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

      vi.mocked(db.select).mockImplementation(mockSelect as never)

      const handles = await getAgentHandles()

      expect(handles).toEqual([])
    })

    it('should handle single agent', async () => {
      const mockAgents = [
        {
          name: 'cursor',
          slug: 'cursor',
          displayName: 'Cursor',
          linearUserId: 'user-1',
          isEnabled: true,
          isActive: true,
        },
      ]

      const mockOrderBy = vi.fn().mockResolvedValue(mockAgents)
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

      vi.mocked(db.select).mockImplementation(mockSelect as never)

      const handles = await getAgentHandles()

      expect(handles).toEqual(['@Cursor'])
      expect(handles).toHaveLength(1)
    })

    it('should maintain handle order from database', async () => {
      const mockAgents = [
        {
          name: 'aaa',
          slug: 'aaa',
          displayName: 'AAA',
          linearUserId: 'user-1',
          isEnabled: true,
          isActive: true,
        },
        {
          name: 'zzz',
          slug: 'zzz',
          displayName: 'ZZZ',
          linearUserId: 'user-2',
          isEnabled: true,
          isActive: true,
        },
      ]

      const mockOrderBy = vi.fn().mockResolvedValue(mockAgents)
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

      vi.mocked(db.select).mockImplementation(mockSelect as never)

      const handles = await getAgentHandles()

      expect(handles).toEqual(['@AAA', '@ZZZ'])
    })
  })

  describe('getAgentNames - unit', () => {
    it('should return names from agent configs', async () => {
      const mockAgents = [
        {
          name: 'cursor',
          slug: 'cursor',
          displayName: 'Cursor',
          linearUserId: 'user-1',
          isEnabled: true,
          isActive: true,
        },
        {
          name: 'engine',
          slug: 'engine',
          displayName: 'Engine',
          linearUserId: 'user-2',
          isEnabled: true,
          isActive: true,
        },
      ]

      const mockOrderBy = vi.fn().mockResolvedValue(mockAgents)
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

      vi.mocked(db.select).mockImplementation(mockSelect as never)

      const names = await getAgentNames()

      expect(names).toEqual(['cursor', 'engine'])
    })

    it('should return empty array when no agents', async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([])
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

      vi.mocked(db.select).mockImplementation(mockSelect as never)

      const names = await getAgentNames()

      expect(names).toEqual([])
    })

    it('should handle single agent name', async () => {
      const mockAgents = [
        {
          name: 'cursor',
          slug: 'cursor',
          displayName: 'Cursor',
          linearUserId: 'user-1',
          isEnabled: true,
          isActive: true,
        },
      ]

      const mockOrderBy = vi.fn().mockResolvedValue(mockAgents)
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

      vi.mocked(db.select).mockImplementation(mockSelect as never)

      const names = await getAgentNames()

      expect(names).toEqual(['cursor'])
      expect(names).toHaveLength(1)
    })

    it('should return name field, not displayName', async () => {
      const mockAgents = [
        {
          name: 'cursor-ai',
          slug: 'cursor-ai',
          displayName: 'Cursor AI Assistant',
          linearUserId: 'user-1',
          isEnabled: true,
          isActive: true,
        },
      ]

      const mockOrderBy = vi.fn().mockResolvedValue(mockAgents)
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

      vi.mocked(db.select).mockImplementation(mockSelect as never)

      const names = await getAgentNames()

      expect(names).toEqual(['cursor-ai'])
      expect(names).not.toContain('Cursor AI Assistant')
    })

    it('should maintain name order from database', async () => {
      const mockAgents = [
        {
          name: 'aaa',
          slug: 'aaa',
          displayName: 'AAA',
          linearUserId: 'user-1',
          isEnabled: true,
          isActive: true,
        },
        {
          name: 'mmm',
          slug: 'mmm',
          displayName: 'MMM',
          linearUserId: 'user-2',
          isEnabled: true,
          isActive: true,
        },
        {
          name: 'zzz',
          slug: 'zzz',
          displayName: 'ZZZ',
          linearUserId: 'user-3',
          isEnabled: true,
          isActive: true,
        },
      ]

      const mockOrderBy = vi.fn().mockResolvedValue(mockAgents)
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

      vi.mocked(db.select).mockImplementation(mockSelect as never)

      const names = await getAgentNames()

      expect(names).toEqual(['aaa', 'mmm', 'zzz'])
    })
  })
})
