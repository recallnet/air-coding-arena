/**
 * Tests for agent configuration
 * @packageDocumentation
 */

import { beforeEach, describe, expect, it } from 'vitest'

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
          name: DISABLED_AGENT_NAME,
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

    it(EMPTY_AGENTS_TEST_DESC, async () => {
      if (!isRealDatabase) {
        console.log(SKIP_MESSAGE)
        return
      }

      // Insert only disabled agent
      await db.insert(agents).values([
        {
          name: DISABLED_AGENT_NAME,
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
      if (!isRealDatabase) {
        console.log(SKIP_MESSAGE)
        return
      }

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
