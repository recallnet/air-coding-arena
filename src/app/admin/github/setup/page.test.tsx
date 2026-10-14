import { render, screen } from '@testing-library/react'
import type { ReadonlyURLSearchParams } from 'next/navigation'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

import GitHubSetupPage from './page'

// Mock the queries module
vi.mock('@/lib/queries', () => ({
  getGitHubAppInstallations: vi.fn(),
}))

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

// Test constants
const MOCK_DATE = '2024-01-01'

describe('GitHub Setup Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_GITHUB_APP_NAME', 'arena-example')
  })

  afterEach(() => vi.unstubAllEnvs())

  test('does not link to a third-party App when no App name is configured', async () => {
    const { getGitHubAppInstallations } = await import('@/lib/queries')
    const { useSearchParams } = await import('next/navigation')
    vi.mocked(getGitHubAppInstallations).mockResolvedValue([])
    vi.mocked(useSearchParams).mockReturnValue(mockSearchParams({}))
    vi.stubEnv('NEXT_PUBLIC_GITHUB_APP_NAME', '')
    render(await GitHubSetupPage())
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(
      screen.getByText(/Configure your GitHub App name/i)
    ).toBeInTheDocument()
  })

  test('should render installation button', async () => {
    const { getGitHubAppInstallations } = await import('@/lib/queries')
    const { useSearchParams } = await import('next/navigation')

    vi.mocked(getGitHubAppInstallations).mockResolvedValue([])
    vi.mocked(useSearchParams).mockReturnValue(mockSearchParams({}))

    const Page = await GitHubSetupPage()
    render(Page)

    expect(screen.getByText(/Connect GitHub Organization/i)).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('github.com/apps/')
    )
  })

  test('should display success message from URL param', async () => {
    const { getGitHubAppInstallations } = await import('@/lib/queries')
    const { useSearchParams } = await import('next/navigation')

    vi.mocked(getGitHubAppInstallations).mockResolvedValue([])
    vi.mocked(useSearchParams).mockReturnValue(
      mockSearchParams({ success: 'true' })
    )

    const Page = await GitHubSetupPage()
    render(Page)

    expect(screen.getByText(/Successfully connected/i)).toBeInTheDocument()
  })

  test('should display error message from URL param', async () => {
    const { getGitHubAppInstallations } = await import('@/lib/queries')
    const { useSearchParams } = await import('next/navigation')

    vi.mocked(getGitHubAppInstallations).mockResolvedValue([])
    vi.mocked(useSearchParams).mockReturnValue(
      mockSearchParams({ error: 'API%20connection%20failed' })
    )

    const Page = await GitHubSetupPage()
    render(Page)

    expect(
      screen.getByText(/Error: API connection failed/i)
    ).toBeInTheDocument()
  })

  test('should display suspended message from URL param', async () => {
    const { getGitHubAppInstallations } = await import('@/lib/queries')
    const { useSearchParams } = await import('next/navigation')

    vi.mocked(getGitHubAppInstallations).mockResolvedValue([])
    vi.mocked(useSearchParams).mockReturnValue(
      mockSearchParams({ suspended: 'true' })
    )

    const Page = await GitHubSetupPage()
    render(Page)

    expect(
      screen.getByText(/GitHub App installation suspended/i)
    ).toBeInTheDocument()
  })

  test('should display installations when they exist', async () => {
    const { getGitHubAppInstallations } = await import('@/lib/queries')
    const { useSearchParams } = await import('next/navigation')

    const mockInstallations = [
      {
        id: 'install-1',
        installationId: '12345',
        accountId: '67890',
        accountLogin: 'test-org',
        accountType: 'Organization',
        isActive: true,
        installedAt: new Date(MOCK_DATE),
        suspendedAt: null,
        createdAt: new Date(MOCK_DATE),
        updatedAt: new Date(MOCK_DATE),
      },
    ]

    vi.mocked(getGitHubAppInstallations).mockResolvedValue(mockInstallations)
    vi.mocked(useSearchParams).mockReturnValue(mockSearchParams({}))

    const Page = await GitHubSetupPage()
    render(Page)

    expect(screen.getByText('test-org')).toBeInTheDocument()
    expect(screen.getByText('Organization')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  test('should display empty state when no installations', async () => {
    const { getGitHubAppInstallations } = await import('@/lib/queries')
    const { useSearchParams } = await import('next/navigation')

    vi.mocked(getGitHubAppInstallations).mockResolvedValue([])
    vi.mocked(useSearchParams).mockReturnValue(mockSearchParams({}))

    const Page = await GitHubSetupPage()
    render(Page)

    expect(
      screen.getByText('No installations configured yet.')
    ).toBeInTheDocument()
  })

  test('should display suspended installations with warning styling', async () => {
    const { getGitHubAppInstallations } = await import('@/lib/queries')
    const { useSearchParams } = await import('next/navigation')

    const mockInstallations = [
      {
        id: 'install-1',
        installationId: '12345',
        accountId: '67890',
        accountLogin: 'suspended-org',
        accountType: 'Organization',
        isActive: false,
        installedAt: new Date(MOCK_DATE),
        suspendedAt: new Date('2024-01-05'),
        createdAt: new Date(MOCK_DATE),
        updatedAt: new Date('2024-01-05'),
      },
    ]

    vi.mocked(getGitHubAppInstallations).mockResolvedValue(mockInstallations)
    vi.mocked(useSearchParams).mockReturnValue(mockSearchParams({}))

    const Page = await GitHubSetupPage()
    render(Page)

    expect(screen.getByText('suspended-org')).toBeInTheDocument()
    expect(screen.getByText('Suspended')).toBeInTheDocument()
  })
})
