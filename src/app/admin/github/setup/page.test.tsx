import { render, screen } from '@testing-library/react'
import type { ReadonlyURLSearchParams } from 'next/navigation'
import { describe, test, expect, vi, beforeEach } from 'vitest'

import GitHubSetupPage from './page'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(),
}))

/**
 * Helper to create a mock URLSearchParams
 *
 * @param params - Object with key-value pairs to return
 * @returns Mocked ReadonlyURLSearchParams
 */
function mockSearchParams(
  params: Record<string, string | null>
): ReadonlyURLSearchParams {
  return {
    get: (key: string) => params[key] ?? null,
    getAll: () => [],
    has: () => false,
    keys: () => [][Symbol.iterator](),
    values: () => [][Symbol.iterator](),
    entries: () => [][Symbol.iterator](),
    forEach: () => undefined,
    append: () => undefined,
    delete: () => undefined,
    set: () => undefined,
    sort: () => undefined,
    size: 0,
    toString: () => '',
    [Symbol.iterator]: () => [][Symbol.iterator](),
  }
}

describe('GitHub Setup Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should render installation button', async () => {
    const { useSearchParams } = await import('next/navigation')
    vi.mocked(useSearchParams).mockReturnValue(mockSearchParams({}))

    render(<GitHubSetupPage />)

    expect(screen.getByText(/Connect GitHub Organization/i)).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('github.com/apps/')
    )
  })

  test('should display success message from URL param', async () => {
    const { useSearchParams } = await import('next/navigation')
    vi.mocked(useSearchParams).mockReturnValue(
      mockSearchParams({ success: 'true' })
    )

    render(<GitHubSetupPage />)

    expect(screen.getByText(/Successfully connected/i)).toBeInTheDocument()
  })

  test('should display error message from URL param', async () => {
    const { useSearchParams } = await import('next/navigation')
    vi.mocked(useSearchParams).mockReturnValue(
      mockSearchParams({ error: 'API%20connection%20failed' })
    )

    render(<GitHubSetupPage />)

    expect(
      screen.getByText(/Error: API connection failed/i)
    ).toBeInTheDocument()
  })

  test('should display suspended message from URL param', async () => {
    const { useSearchParams } = await import('next/navigation')
    vi.mocked(useSearchParams).mockReturnValue(
      mockSearchParams({ suspended: 'true' })
    )

    render(<GitHubSetupPage />)

    expect(
      screen.getByText(/GitHub App installation suspended/i)
    ).toBeInTheDocument()
  })
})
