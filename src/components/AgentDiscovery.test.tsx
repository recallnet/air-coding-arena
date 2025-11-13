/**
 * Tests for AgentDiscovery component.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AgentDiscovery } from './AgentDiscovery'

// Test constants
const API_AGENTS_CONFIG_URL = '/api/agents/config'

// Mock fetch
const mockFetch = vi.fn()
globalThis.fetch = mockFetch

// Mock window.location.reload
const mockReload = vi.fn()
Object.defineProperty(globalThis, 'location', {
  value: { reload: mockReload },
  writable: true,
})

describe('AgentDiscovery', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockReload.mockReset()
  })

  describe('Initial Rendering', () => {
    it('should render discovery status card', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lastDiscoveryAt: null }),
      })

      render(<AgentDiscovery />)

      expect(screen.getByText('Discovery Status')).toBeInTheDocument()

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(API_AGENTS_CONFIG_URL)
      })
    })

    it('should render Discover Agents button', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lastDiscoveryAt: null }),
      })

      render(<AgentDiscovery />)

      expect(
        screen.getByRole('button', { name: /Discover Agents/i })
      ).toBeInTheDocument()

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(API_AGENTS_CONFIG_URL)
      })
    })

    it('should show "Never" when no last discovery', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lastDiscoveryAt: null }),
      })

      render(<AgentDiscovery />)

      await waitFor(
        () => {
          expect(
            screen.getByText(/Last discovered: Never/i)
          ).toBeInTheDocument()
        },
        { timeout: 2000 }
      )
    })

    it('should show relative time for recent discovery (minutes)', async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lastDiscoveryAt: fiveMinutesAgo }),
      })

      render(<AgentDiscovery />)

      await waitFor(
        () => {
          expect(
            screen.getByText(/Last discovered: \d+ minutes ago/i)
          ).toBeInTheDocument()
        },
        { timeout: 2000 }
      )
    })

    it('should show singular form for 1 minute', async () => {
      const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000).toISOString()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lastDiscoveryAt: oneMinuteAgo }),
      })

      render(<AgentDiscovery />)

      await waitFor(
        () => {
          expect(
            screen.getByText(/Last discovered: 1 minute ago/i)
          ).toBeInTheDocument()
        },
        { timeout: 2000 }
      )
    })

    it('should show relative time for recent discovery (hours)', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lastDiscoveryAt: twoHoursAgo }),
      })

      render(<AgentDiscovery />)

      await waitFor(
        () => {
          expect(
            screen.getByText(/Last discovered: \d+ hours ago/i)
          ).toBeInTheDocument()
        },
        { timeout: 2000 }
      )
    })

    it('should show singular form for 1 hour', async () => {
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lastDiscoveryAt: oneHourAgo }),
      })

      render(<AgentDiscovery />)

      await waitFor(
        () => {
          expect(
            screen.getByText(/Last discovered: 1 hour ago/i)
          ).toBeInTheDocument()
        },
        { timeout: 2000 }
      )
    })

    it('should show relative time for recent discovery (days)', async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lastDiscoveryAt: threeDaysAgo }),
      })

      render(<AgentDiscovery />)

      await waitFor(
        () => {
          expect(
            screen.getByText(/Last discovered: \d+ days ago/i)
          ).toBeInTheDocument()
        },
        { timeout: 2000 }
      )
    })

    it('should show singular form for 1 day', async () => {
      const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lastDiscoveryAt: oneDayAgo }),
      })

      render(<AgentDiscovery />)

      await waitFor(
        () => {
          expect(
            screen.getByText(/Last discovered: 1 day ago/i)
          ).toBeInTheDocument()
        },
        { timeout: 2000 }
      )
    })

    it('should show formatted date for old discovery', async () => {
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lastDiscoveryAt: twoWeeksAgo }),
      })

      render(<AgentDiscovery />)

      await waitFor(
        () => {
          // Should show formatted date like "Jan 1" or "Dec 31, 2024"
          const text = screen.getByText(/Last discovered:/)
          expect(text).toBeInTheDocument()
        },
        { timeout: 2000 }
      )

      // Additional check for date format in separate assertion
      const text = screen.getByText(/Last discovered:/)
      expect(text.textContent).toMatch(/Last discovered: (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/)
    })
  })

  describe('Discovery Trigger', () => {
    it('should display discovery results after success', async () => {
      const user = userEvent.setup()
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ lastDiscoveryAt: null }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            discovered: 5,
            updated: 2,
            deactivated: 1,
          }),
        })

      render(<AgentDiscovery />)

      // Wait for initial render
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Discover Agents/i })
        ).toBeInTheDocument()
      })

      const button = screen.getByRole('button', { name: /Discover Agents/i })
      await user.click(button)

      await waitFor(
        () => {
          expect(screen.getByText('5 discovered')).toBeInTheDocument()
        },
        { timeout: 2000 }
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle fetch config error gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      // Should not throw
      render(<AgentDiscovery />)

      // Should still render the component
      expect(screen.getByText('Discovery Status')).toBeInTheDocument()

      // Wait for error to be handled
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(API_AGENTS_CONFIG_URL)
      })
    })

    it('should display error message on discovery failure', async () => {
      const user = userEvent.setup()
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ lastDiscoveryAt: null }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        })

      render(<AgentDiscovery />)

      // Wait for initial render
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Discover Agents/i })
        ).toBeInTheDocument()
      })

      const button = screen.getByRole('button', { name: /Discover Agents/i })
      await user.click(button)

      await waitFor(
        () => {
          expect(screen.getByText(/Error:/)).toBeInTheDocument()
        },
        { timeout: 2000 }
      )
    })

    it('should handle non-Error exceptions during discovery', async () => {
      const user = userEvent.setup()
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ lastDiscoveryAt: null }),
        })
        .mockRejectedValueOnce('String error')

      render(<AgentDiscovery />)

      // Wait for initial render
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Discover Agents/i })
        ).toBeInTheDocument()
      })

      const button = screen.getByRole('button', { name: /Discover Agents/i })
      await user.click(button)

      await waitFor(
        () => {
          expect(
            screen.getByText(/Error: Failed to discover agents/)
          ).toBeInTheDocument()
        },
        { timeout: 2000 }
      )
    })
  })
})
