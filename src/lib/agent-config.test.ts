/**
 * Tests for agent configuration
 * @packageDocumentation
 */

import { describe, expect, it, afterEach, beforeEach } from 'vitest'

import {
  getAgentConfigs,
  getAgentHandles,
  getAgentNames,
  guessAgentFromText,
} from './agent-config'

describe('agent-config', () => {
  const originalEnv = process.env['AGENTS_CONFIG_JSON']

  afterEach(() => {
    process.env['AGENTS_CONFIG_JSON'] = originalEnv
  })

  describe('getAgentConfigs', () => {
    it('should parse JSON agent config', async () => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([
        { name: 'cursor', handle: '@Cursor' },
        { name: 'engine', handle: '@Engine' },
      ])

      const configs = await getAgentConfigs()

      expect(configs).toEqual([
        { name: 'cursor', handle: '@Cursor' },
        { name: 'engine', handle: '@Engine' },
      ])
    })

    it('should preserve case-sensitive handles', async () => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([
        { name: 'cursor', handle: '@Cursor' },
        { name: 'factory', handle: '@Factory' },
      ])

      const configs = await getAgentConfigs()

      expect(configs[0]?.handle).toBe('@Cursor')
      expect(configs[1]?.handle).toBe('@Factory')
    })

    it('should lowercase agent names', async () => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([
        { name: 'CURSOR', handle: '@Cursor' },
        { name: 'Engine', handle: '@Engine' },
      ])

      const configs = await getAgentConfigs()

      expect(configs[0]?.name).toBe('cursor')
      expect(configs[1]?.name).toBe('engine')
    })

    it('should trim whitespace', async () => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([
        { name: ' cursor ', handle: ' @Cursor ' },
      ])

      const configs = await getAgentConfigs()

      expect(configs[0]).toEqual({ name: 'cursor', handle: '@Cursor' })
    })

    it('should fall back to defaults if not set', async () => {
      delete process.env['AGENTS_CONFIG_JSON']

      const configs = await getAgentConfigs()

      expect(configs).toHaveLength(4)
      expect(configs.map((c) => c.name)).toEqual([
        'cursor',
        'engine',
        'cyrus',
        'factory',
      ])
    })

    it('should fall back to defaults if JSON is invalid', async () => {
      process.env['AGENTS_CONFIG_JSON'] = 'invalid json'

      const configs = await getAgentConfigs()
      expect(configs).toEqual([
        { name: 'cursor', handle: '@Cursor' },
        { name: 'engine', handle: '@Engine' },
        { name: 'cyrus', handle: '@Cyrus' },
        { name: 'factory', handle: '@Factory' },
      ])
    })

    it('should fall back to defaults if not an array', async () => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify({ name: 'cursor' })

      const configs = await getAgentConfigs()
      expect(configs).toEqual([
        { name: 'cursor', handle: '@Cursor' },
        { name: 'engine', handle: '@Engine' },
        { name: 'cyrus', handle: '@Cyrus' },
        { name: 'factory', handle: '@Factory' },
      ])
    })

    it('should fall back to defaults if array is empty', async () => {
      process.env['AGENTS_CONFIG_JSON'] = '[]'

      const configs = await getAgentConfigs()
      expect(configs).toEqual([
        { name: 'cursor', handle: '@Cursor' },
        { name: 'engine', handle: '@Engine' },
        { name: 'cyrus', handle: '@Cyrus' },
        { name: 'factory', handle: '@Factory' },
      ])
    })

    it('should fall back to defaults if name is missing', async () => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([
        { handle: '@Cursor' },
      ])

      const configs = await getAgentConfigs()
      expect(configs).toEqual([
        { name: 'cursor', handle: '@Cursor' },
        { name: 'engine', handle: '@Engine' },
        { name: 'cyrus', handle: '@Cyrus' },
        { name: 'factory', handle: '@Factory' },
      ])
    })

    it('should fall back to defaults if handle is missing', async () => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([{ name: 'cursor' }])

      const configs = await getAgentConfigs()
      expect(configs).toEqual([
        { name: 'cursor', handle: '@Cursor' },
        { name: 'engine', handle: '@Engine' },
        { name: 'cyrus', handle: '@Cyrus' },
        { name: 'factory', handle: '@Factory' },
      ])
    })

    it('should fall back to defaults if name is empty string', async () => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([
        { name: '', handle: '@Cursor' },
      ])

      const configs = await getAgentConfigs()
      expect(configs).toEqual([
        { name: 'cursor', handle: '@Cursor' },
        { name: 'engine', handle: '@Engine' },
        { name: 'cyrus', handle: '@Cyrus' },
        { name: 'factory', handle: '@Factory' },
      ])
    })

    it('should fall back to defaults if handle is empty string', async () => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([
        { name: 'cursor', handle: '' },
      ])

      const configs = await getAgentConfigs()
      expect(configs).toEqual([
        { name: 'cursor', handle: '@Cursor' },
        { name: 'engine', handle: '@Engine' },
        { name: 'cyrus', handle: '@Cyrus' },
        { name: 'factory', handle: '@Factory' },
      ])
    })
  })

  describe('getAgentHandles', () => {
    it('should return array of handles', async () => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([
        { name: 'cursor', handle: '@Cursor' },
        { name: 'engine', handle: '@Engine' },
      ])

      const handles = await getAgentHandles()

      expect(handles).toEqual(['@Cursor', '@Engine'])
    })

    it('should preserve case in handles', async () => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([
        { name: 'factory', handle: '@Factory' },
      ])

      const handles = await getAgentHandles()

      expect(handles[0]).toBe('@Factory')
    })
  })

  describe('getAgentNames', () => {
    it('should return array of names', async () => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([
        { name: 'cursor', handle: '@Cursor' },
        { name: 'engine', handle: '@Engine' },
      ])

      const names = await getAgentNames()

      expect(names).toEqual(['cursor', 'engine'])
    })

    it('should return lowercase names', async () => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([
        { name: 'CURSOR', handle: '@Cursor' },
      ])

      const names = await getAgentNames()

      expect(names[0]).toBe('cursor')
    })
  })

  describe('guessAgentFromText', () => {
    beforeEach(() => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([
        { name: 'cursor', handle: '@Cursor' },
        { name: 'engine', handle: '@Engine' },
        { name: 'factory', handle: '@Factory' },
      ])
    })

    it('should detect agent in branch name', async () => {
      expect(await guessAgentFromText('cursor/fix-bug')).toBe('cursor')
      expect(await guessAgentFromText('engine-123-feature')).toBe('engine')
      expect(await guessAgentFromText('factory-pr-branch')).toBe('factory')
    })

    it('should detect agent in PR title', async () => {
      expect(await guessAgentFromText('feat: Add feature by Cursor')).toBe('cursor')
      expect(await guessAgentFromText('Factory agent implementation')).toBe('factory')
    })

    it('should be case-insensitive for detection', async () => {
      expect(await guessAgentFromText('CURSOR/fix')).toBe('cursor')
      expect(await guessAgentFromText('Engine-PR')).toBe('engine')
      expect(await guessAgentFromText('FACTORY-branch')).toBe('factory')
    })

    it('should return unknown if no match', async () => {
      expect(await guessAgentFromText('some-random-branch')).toBe('unknown')
    })

    it('should return first match if multiple agents mentioned', async () => {
      // cursor comes before engine in config
      expect(await guessAgentFromText('cursor-and-engine-pr')).toBe('cursor')
    })

    it('should handle partial matches', async () => {
      expect(await guessAgentFromText('my-cursor-feature')).toBe('cursor')
      expect(await guessAgentFromText('factory-2024')).toBe('factory')
    })
  })
})
