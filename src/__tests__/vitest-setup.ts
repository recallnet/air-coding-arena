import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

/**
 * Set dummy DATABASE_URL for tests that import db client at module level.
 * Mark it as a test URL so integration tests can detect it and skip.
 */
if (!process.env['DATABASE_URL']) {
  process.env['DATABASE_URL'] = 'postgresql://testdummy@localhost/testdummy'
  process.env['IS_TEST_DB_URL'] = 'true'
}

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
