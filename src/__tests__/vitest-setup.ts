import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

/**
 * Mock Next.js Google Fonts.
 */
vi.mock('next/font/google', () => ({
  Inter: () => ({
    className: 'inter-font',
  }),
}))

/**
 * Cleanup after each test automatically.
 * Ensures no test pollution between test cases.
 */
afterEach(() => {
  cleanup()
})
