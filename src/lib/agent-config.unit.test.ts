import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/db/client'
import { agents } from '@/db/schema'

import { getAgentConfigs, getAgentHandles, getAgentNames } from './agent-config'

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
