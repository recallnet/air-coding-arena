import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import GitHubSetupPage from './page'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(),
}))

describe('GitHub Setup Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should render installation button', async () => {
    const { useSearchParams } = await import('next/navigation')
    vi.mocked(useSearchParams).mockReturnValue({
      get: () => null,
    } as any)

    render(<GitHubSetupPage />)

    expect(
      screen.getByText(/Connect GitHub Organization/i)
    ).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('github.com/apps/')
    )
  })

  test('should display success message from URL param', async () => {
    const { useSearchParams } = await import('next/navigation')
    vi.mocked(useSearchParams).mockReturnValue({
      get: (key: string) => (key === 'success' ? 'true' : null),
    } as any)

    render(<GitHubSetupPage />)

    expect(
      screen.getByText(/Successfully connected/i)
    ).toBeInTheDocument()
  })

  test('should display error message from URL param', async () => {
    const { useSearchParams } = await import('next/navigation')
    vi.mocked(useSearchParams).mockReturnValue({
      get: (key: string) =>
        key === 'error' ? 'API%20connection%20failed' : null,
    } as any)

    render(<GitHubSetupPage />)

    expect(
      screen.getByText(/Error: API connection failed/i)
    ).toBeInTheDocument()
  })

  test('should display suspended message from URL param', async () => {
    const { useSearchParams } = await import('next/navigation')
    vi.mocked(useSearchParams).mockReturnValue({
      get: (key: string) => (key === 'suspended' ? 'true' : null),
    } as any)

    render(<GitHubSetupPage />)

    expect(
      screen.getByText(/GitHub App installation suspended/i)
    ).toBeInTheDocument()
  })
})
