import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

/**
 * Mock Geist fonts.
 */
vi.mock('geist/font/sans', () => ({
  GeistSans: {
    variable: '--font-geist-sans',
  },
}))

vi.mock('geist/font/mono', () => ({
  GeistMono: {
    variable: '--font-geist-mono',
  },
}))

/**
 * Cleanup after each test automatically.
 * Ensures no test pollution between test cases.
 */
afterEach(() => {
  cleanup()
})
