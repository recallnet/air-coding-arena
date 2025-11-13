/**
 * Tests for agent configuration
 * @packageDocumentation
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '@/db/client'
import { agents } from '@/db/schema'

import { getAgentConfigs, getAgentHandles, getAgentNames } from './agent-config'

describe('agent-config', () => {
  beforeEach(async () => {
    // Clear agents table before each test
    await db.delete(agents)
  })

  describe('getAgentConfigs', () => {
    it('should return enabled agents from database', async () => {
      // Insert test agents
      await db.insert(agents).values([
        {
          name: 'cursor',
          displayName: 'Cursor',
          linearUserId: 'user-1',
          isEnabled: true,
          isActive: true,
        },
        {
          name: 'engine',
          displayName: 'Engine',
          linearUserId: 'user-2',
          isEnabled: true,
          isActive: true,
        },
        {
          name: 'disabled',
          displayName: 'Disabled',
          linearUserId: 'user-3',
          isEnabled: false,
          isActive: true,
        },
      ])

      const configs = await getAgentConfigs()

      expect(configs).toHaveLength(2)
      expect(configs).toEqual([
        { name: 'cursor', handle: '@Cursor' },
        { name: 'engine', handle: '@Engine' },
      ])
    })

    it('should return empty array if no enabled agents', async () => {
      // Insert only disabled agent
      await db.insert(agents).values([
        {
          name: 'disabled',
          displayName: 'Disabled',
          linearUserId: 'user-1',
          isEnabled: false,
          isActive: true,
        },
      ])

      const configs = await getAgentConfigs()
      expect(configs).toEqual([])
    })

    it('should order agents by name', async () => {
      await db.insert(agents).values([
        {
          name: 'zzz',
          displayName: 'ZZZ',
          linearUserId: 'user-1',
          isEnabled: true,
          isActive: true,
        },
        {
          name: 'aaa',
          displayName: 'AAA',
          linearUserId: 'user-2',
          isEnabled: true,
          isActive: true,
        },
        {
          name: 'mmm',
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
      await db.insert(agents).values([
        {
          name: 'cursor-agent',
          displayName: 'Cursor AI',
          linearUserId: 'user-1',
          isEnabled: true,
          isActive: true,
        },
      ])

      const configs = await getAgentConfigs()
      expect(configs[0]?.handle).toBe('@Cursor AI')
    })
  })

  describe('getAgentHandles', () => {
    it('should return array of handles', async () => {
      await db.insert(agents).values([
        {
          name: 'cursor',
          displayName: 'Cursor',
          linearUserId: 'user-1',
          isEnabled: true,
          isActive: true,
        },
        {
          name: 'engine',
          displayName: 'Engine',
          linearUserId: 'user-2',
          isEnabled: true,
          isActive: true,
        },
      ])

      const handles = await getAgentHandles()
      expect(handles).toEqual(['@Cursor', '@Engine'])
    })

    it('should return empty array if no enabled agents', async () => {
      const handles = await getAgentHandles()
      expect(handles).toEqual([])
    })
  })

  describe('getAgentNames', () => {
    it('should return array of names', async () => {
      await db.insert(agents).values([
        {
          name: 'cursor',
          displayName: 'Cursor',
          linearUserId: 'user-1',
          isEnabled: true,
          isActive: true,
        },
        {
          name: 'engine',
          displayName: 'Engine',
          linearUserId: 'user-2',
          isEnabled: true,
          isActive: true,
        },
      ])

      const names = await getAgentNames()
      expect(names).toEqual(['cursor', 'engine'])
    })

    it('should return empty array if no enabled agents', async () => {
      const names = await getAgentNames()
      expect(names).toEqual([])
    })
  })

})
