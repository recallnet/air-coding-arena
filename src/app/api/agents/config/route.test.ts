/**
 * Tests for GET /api/agents/config endpoint
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/db/client'

import { GET } from './route'

// Mock database
vi.mock('@/db/client', () => ({
  db: {
    select: vi.fn(),
  },
}))

describe('GET /api/agents/config', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('API Response', () => {
    it('should return config with correct shape', async () => {
      // Mock database result with config
      const mockConfig = [
        {
          id: 'singleton',
          mode: 'max_n',
          maxAgents: 5,
          lastDiscoveryAt: new Date('2025-01-01T00:00:00Z'),
        },
      ]

      const mockWhere = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(mockConfig),
      })
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      })
      const mockSelect = vi.fn().mockReturnValue({
        from: mockFrom,
      })
      vi.mocked(db.select).mockImplementation(mockSelect as never)

      const response = await GET()

      expect(response.status).toBe(200)

      const data = await response.json()

      expect(data).toHaveProperty('mode')
      expect(data).toHaveProperty('maxAgents')
      expect(data).toHaveProperty('lastDiscoveryAt')
    })

    it('should return valid mode value', async () => {
      // Mock database result with config
      const mockConfig = [
        {
          id: 'singleton',
          mode: 'all',
          maxAgents: null,
          lastDiscoveryAt: null,
        },
      ]

      const mockWhere = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(mockConfig),
      })
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      })
      const mockSelect = vi.fn().mockReturnValue({
        from: mockFrom,
      })
      vi.mocked(db.select).mockImplementation(mockSelect as never)

      const response = await GET()

      expect(response.status).toBe(200)

      const data = await response.json()

      expect(['all', 'max_n', 'manual']).toContain(data.mode)
    })

    it('should return default values when no config exists', async () => {
      // Mock empty database result
      const mockWhere = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      })
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      })
      const mockSelect = vi.fn().mockReturnValue({
        from: mockFrom,
      })
      vi.mocked(db.select).mockImplementation(mockSelect as never)

      const response = await GET()

      expect(response.status).toBe(200)

      const data = await response.json()

      // Should return default values
      expect(data.mode).toBe('all')
      expect(data.maxAgents).toBeNull()
      expect(data.lastDiscoveryAt).toBeNull()
    })

    it('should define GET handler', () => {
      expect(GET).toBeDefined()
      expect(typeof GET).toBe('function')
    })

    it('should handle database errors', async () => {
      // Mock database error
      const mockWhere = vi.fn().mockReturnValue({
        limit: vi.fn().mockRejectedValue(new Error('Database error')),
      })
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      })
      const mockSelect = vi.fn().mockReturnValue({
        from: mockFrom,
      })
      vi.mocked(db.select).mockImplementation(mockSelect as never)

      const response = await GET()

      expect(response.status).toBe(500)

      const data = await response.json()

      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Database error')
    })

    it('should handle non-Error exceptions', async () => {
      // Mock non-Error exception (string thrown)
      const mockWhere = vi.fn().mockReturnValue({
        limit: vi.fn().mockRejectedValue('Something went wrong'),
      })
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      })
      const mockSelect = vi.fn().mockReturnValue({
        from: mockFrom,
      })
      vi.mocked(db.select).mockImplementation(mockSelect as never)

      const response = await GET()

      expect(response.status).toBe(500)

      const data = await response.json()

      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Failed to fetch config')
    })
  })
})
