/**
 * Tests for utility functions.
 */

import { describe, expect, it } from 'vitest'

import { cn } from './utils'

describe('cn', () => {
  describe('when given simple class names', () => {
    it('should merge class names', () => {
      expect(cn('px-4', 'py-2')).toBe('px-4 py-2')
    })
  })

  describe('when given conditional classes', () => {
    it('should include truthy conditional classes', () => {
      const isActive = true
      expect(cn('px-4', isActive && 'bg-blue-500')).toBe('px-4 bg-blue-500')
    })

    it('should exclude falsy conditional classes', () => {
      const isActive = false
      expect(cn('px-4', isActive && 'bg-blue-500')).toBe('px-4')
    })
  })

  describe('when given conflicting Tailwind classes', () => {
    it('should apply the last class', () => {
      expect(cn('px-4', 'px-2')).toBe('px-2')
    })
  })
})
