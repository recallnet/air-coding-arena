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
    it('should parse JSON agent config', () => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([
        { name: 'cursor', handle: '@Cursor' },
        { name: 'engine', handle: '@Engine' },
      ])

      const configs = getAgentConfigs()

      expect(configs).toEqual([
        { name: 'cursor', handle: '@Cursor' },
        { name: 'engine', handle: '@Engine' },
      ])
    })

    it('should preserve case-sensitive handles', () => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([
        { name: 'cursor', handle: '@Cursor' },
        { name: 'factory', handle: '@Factory' },
      ])

      const configs = getAgentConfigs()

      expect(configs[0]?.handle).toBe('@Cursor')
      expect(configs[1]?.handle).toBe('@Factory')
    })

    it('should lowercase agent names', () => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([
        { name: 'CURSOR', handle: '@Cursor' },
        { name: 'Engine', handle: '@Engine' },
      ])

      const configs = getAgentConfigs()

      expect(configs[0]?.name).toBe('cursor')
      expect(configs[1]?.name).toBe('engine')
    })

    it('should trim whitespace', () => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([
        { name: ' cursor ', handle: ' @Cursor ' },
      ])

      const configs = getAgentConfigs()

      expect(configs[0]).toEqual({ name: 'cursor', handle: '@Cursor' })
    })

    it('should fall back to defaults if not set', () => {
      delete process.env['AGENTS_CONFIG_JSON']

      const configs = getAgentConfigs()

      expect(configs).toHaveLength(4)
      expect(configs.map((c) => c.name)).toEqual([
        'cursor',
        'engine',
        'cyrus',
        'factory',
      ])
    })

    it('should throw if JSON is invalid', () => {
      process.env['AGENTS_CONFIG_JSON'] = 'invalid json'

      expect(() => getAgentConfigs()).toThrow('Invalid JSON')
    })

    it('should throw if not an array', () => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify({ name: 'cursor' })

      expect(() => getAgentConfigs()).toThrow('must be an array')
    })

    it('should throw if array is empty', () => {
      process.env['AGENTS_CONFIG_JSON'] = '[]'

      expect(() => getAgentConfigs()).toThrow('must specify at least one agent')
    })

    it('should throw if name is missing', () => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([
        { handle: '@Cursor' },
      ])

      expect(() => getAgentConfigs()).toThrow('missing required field: name')
    })

    it('should throw if handle is missing', () => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([{ name: 'cursor' }])

      expect(() => getAgentConfigs()).toThrow('missing required field: handle')
    })

    it('should throw if name is empty string', () => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([
        { name: '', handle: '@Cursor' },
      ])

      expect(() => getAgentConfigs()).toThrow('missing required field: name')
    })

    it('should throw if handle is empty string', () => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([
        { name: 'cursor', handle: '' },
      ])

      expect(() => getAgentConfigs()).toThrow('missing required field: handle')
    })
  })

  describe('getAgentHandles', () => {
    it('should return array of handles', () => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([
        { name: 'cursor', handle: '@Cursor' },
        { name: 'engine', handle: '@Engine' },
      ])

      const handles = getAgentHandles()

      expect(handles).toEqual(['@Cursor', '@Engine'])
    })

    it('should preserve case in handles', () => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([
        { name: 'factory', handle: '@Factory' },
      ])

      const handles = getAgentHandles()

      expect(handles[0]).toBe('@Factory')
    })
  })

  describe('getAgentNames', () => {
    it('should return array of names', () => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([
        { name: 'cursor', handle: '@Cursor' },
        { name: 'engine', handle: '@Engine' },
      ])

      const names = getAgentNames()

      expect(names).toEqual(['cursor', 'engine'])
    })

    it('should return lowercase names', () => {
      process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([
        { name: 'CURSOR', handle: '@Cursor' },
      ])

      const names = getAgentNames()

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

    it('should detect agent in branch name', () => {
      expect(guessAgentFromText('cursor/fix-bug')).toBe('cursor')
      expect(guessAgentFromText('engine-123-feature')).toBe('engine')
      expect(guessAgentFromText('factory-pr-branch')).toBe('factory')
    })

    it('should detect agent in PR title', () => {
      expect(guessAgentFromText('feat: Add feature by Cursor')).toBe('cursor')
      expect(guessAgentFromText('Factory agent implementation')).toBe('factory')
    })

    it('should be case-insensitive for detection', () => {
      expect(guessAgentFromText('CURSOR/fix')).toBe('cursor')
      expect(guessAgentFromText('Engine-PR')).toBe('engine')
      expect(guessAgentFromText('FACTORY-branch')).toBe('factory')
    })

    it('should return unknown if no match', () => {
      expect(guessAgentFromText('some-random-branch')).toBe('unknown')
    })

    it('should return first match if multiple agents mentioned', () => {
      // cursor comes before engine in config
      expect(guessAgentFromText('cursor-and-engine-pr')).toBe('cursor')
    })

    it('should handle partial matches', () => {
      expect(guessAgentFromText('my-cursor-feature')).toBe('cursor')
      expect(guessAgentFromText('factory-2024')).toBe('factory')
    })
  })
})
