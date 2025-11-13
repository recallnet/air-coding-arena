/**
 * Tests for EnableToggle component.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EnableToggle } from './EnableToggle'

// Mock fetch
const mockFetch = vi.fn()
globalThis.fetch = mockFetch

describe('EnableToggle', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe('Rendering', () => {
    it('should render checkbox in enabled state', () => {
      render(<EnableToggle agentId="agent-1" enabled={true} />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeInTheDocument()
      expect(checkbox).toBeChecked()
    })

    it('should render checkbox in disabled state', () => {
      render(<EnableToggle agentId="agent-1" enabled={false} />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeInTheDocument()
      expect(checkbox).not.toBeChecked()
    })
  })

  describe('Toggle Interaction', () => {
    it('should toggle from enabled to disabled', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ isEnabled: false }),
      })

      render(<EnableToggle agentId="agent-1" enabled={true} />)

      const checkbox = screen.getByRole('checkbox')
      await user.click(checkbox)

      expect(mockFetch).toHaveBeenCalledWith('/api/agents/agent-1', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isEnabled: false }),
      })
    })

    it('should toggle from disabled to enabled', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ isEnabled: true }),
      })

      render(<EnableToggle agentId="agent-1" enabled={false} />)

      const checkbox = screen.getByRole('checkbox')
      await user.click(checkbox)

      expect(mockFetch).toHaveBeenCalledWith('/api/agents/agent-1', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isEnabled: true }),
      })
    })

    it('should call onToggle callback on success', async () => {
      const user = userEvent.setup()
      const onToggle = vi.fn()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ isEnabled: false }),
      })

      render(
        <EnableToggle agentId="agent-1" enabled={true} onToggle={onToggle} />
      )

      const checkbox = screen.getByRole('checkbox')
      await user.click(checkbox)

      await waitFor(() => {
        expect(onToggle).toHaveBeenCalledWith(false)
      })
    })
  })

  describe('Error Handling', () => {
    it('should show error message on API failure', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      render(<EnableToggle agentId="agent-1" enabled={true} />)

      const checkbox = screen.getByRole('checkbox')
      await user.click(checkbox)

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument()
      })
    })

    it('should revert optimistic update on failure', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      render(<EnableToggle agentId="agent-1" enabled={true} />)

      const checkbox = screen.getByRole('checkbox')

      // Initially checked
      expect(checkbox).toBeChecked()

      // Click to toggle
      await user.click(checkbox)

      // Should revert back to checked after error
      await waitFor(() => {
        expect(checkbox).toBeChecked()
      })
    })

    it('should not call onToggle callback on failure', async () => {
      const user = userEvent.setup()
      const onToggle = vi.fn()
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      render(
        <EnableToggle agentId="agent-1" enabled={true} onToggle={onToggle} />
      )

      const checkbox = screen.getByRole('checkbox')
      await user.click(checkbox)

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument()
      })

      expect(onToggle).not.toHaveBeenCalled()
    })
  })

  describe('Optimistic UI Updates', () => {
    it('should immediately show unchecked state before API response', async () => {
      const user = userEvent.setup()
      // eslint-disable-next-line no-unused-vars
      type PromiseResolver = (value: Response) => void
      let resolvePromise: PromiseResolver | undefined
      const promise = new Promise<Response>((resolve: PromiseResolver) => {
        resolvePromise = resolve
      })
      mockFetch.mockReturnValueOnce(promise)

      render(<EnableToggle agentId="agent-1" enabled={true} />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeChecked()

      await user.click(checkbox)

      // Should be unchecked immediately (optimistic)
      expect(checkbox).not.toBeChecked()

      // Resolve the promise
      if (resolvePromise) {
        resolvePromise({
          ok: true,
          json: async () => ({ isEnabled: false }),
        } as Response)
      }

      await waitFor(() => {
        expect(checkbox).not.toBeChecked()
      })
    })
  })
})
