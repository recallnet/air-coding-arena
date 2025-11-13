/**
 * Tests for AgentRefreshButton component
 * @packageDocumentation
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AgentRefreshButton } from './AgentRefreshButton'

// Mock fetch
const mockFetch = vi.fn()
globalThis.fetch = mockFetch

// Mock window.location.reload
const mockReload = vi.fn()
Object.defineProperty(globalThis, 'location', {
  value: { reload: mockReload },
  writable: true,
})

describe('AgentRefreshButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    mockReload.mockReset()
  })

  describe('Rendering', () => {
    it('should render refresh icon button', () => {
      render(<AgentRefreshButton />)

      const button = screen.getByRole('button', { name: /discover agents/i })
      expect(button).toBeInTheDocument()
    })
  })

  describe('Discovery Success', () => {
    it('should call discover API and reload page on click', async () => {
      const user = userEvent.setup()

      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ discovered: 3, updated: 1, deactivated: 0 }),
      })

      render(<AgentRefreshButton />)

      const button = screen.getByRole('button')
      await user.click(button)

      // Verify API call
      expect(mockFetch).toHaveBeenCalledWith('/api/agents/discover', {
        method: 'POST',
      })

      // Verify button shows loading state
      expect(button).toBeDisabled()

      // Wait for reload to be called (500ms setTimeout in component)
      await waitFor(
        () => {
          expect(mockReload).toHaveBeenCalled()
        },
        { timeout: 1000 }
      )
    })

    it('should show spinning icon while discovering', async () => {
      const user = userEvent.setup()

      // Mock delayed API response
      let resolvePromise:
        | ((_value: {
            ok: boolean
            json: () => Promise<{
              discovered: number
              updated: number
              deactivated: number
            }>
          }) => void)
        | undefined
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve
          })
      )

      render(<AgentRefreshButton />)

      const button = screen.getByRole('button')
      await user.click(button)

      // Wait for button to be disabled
      await waitFor(() => {
        expect(button).toBeDisabled()
      })

      // Icon should have animate-spin class
      const icon = button.querySelector('svg')
      expect(icon).toHaveClass('animate-spin')

      // Clean up - resolve the promise to avoid memory leaks
      if (resolvePromise) {
        resolvePromise({
          ok: true,
          json: async () => ({ discovered: 1, updated: 0, deactivated: 0 }),
        })
      }
    })
  })

  describe('Discovery Error', () => {
    it('should display error message on API failure', async () => {
      const user = userEvent.setup()

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      render(<AgentRefreshButton />)

      const button = screen.getByRole('button')
      await user.click(button)

      // Wait for error to appear
      await waitFor(() => {
        expect(
          screen.getByText(/failed to discover agents/i)
        ).toBeInTheDocument()
      })

      // Button should be re-enabled
      expect(button).not.toBeDisabled()

      // Should NOT reload page
      expect(mockReload).not.toHaveBeenCalled()
    })

    it('should display error message on network error', async () => {
      const user = userEvent.setup()

      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      render(<AgentRefreshButton />)

      const button = screen.getByRole('button')
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
      })

      expect(button).not.toBeDisabled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper title attribute', () => {
      render(<AgentRefreshButton />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('title', 'Discover agents from Linear')
    })
  })
})
