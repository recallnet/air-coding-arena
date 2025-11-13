/**
 * Tests for GET /api/linear/reconcile endpoint.
 *
 * @packageDocumentation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as linearReconcile from '@/lib/linear-reconcile'

import { GET } from './route'

// Mock linear-reconcile module
vi.mock('@/lib/linear-reconcile', () => ({
  reconcileLinearIssues: vi.fn(),
}))

const INTERNAL_SERVER_ERROR = 'Internal server error'

describe('GET /api/linear/reconcile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear console mocks
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('should call reconcileLinearIssues and return count on success', async () => {
    // Mock successful reconciliation with 5 issues
    const mockCount = 5
    vi.mocked(linearReconcile.reconcileLinearIssues).mockResolvedValue(
      mockCount
    )

    const response = await GET()
    const data = (await response.json()) as { success: boolean; count: number }

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true, count: mockCount })
    expect(linearReconcile.reconcileLinearIssues).toHaveBeenCalledTimes(1)
    expect(console.log).toHaveBeenCalledWith(
      '[Reconcile] Starting reconciliation...'
    )
    expect(console.log).toHaveBeenCalledWith('[Reconcile] Complete: 5 issues')
  })

  it('should handle zero reconciled issues', async () => {
    // Mock reconciliation with no issues found
    vi.mocked(linearReconcile.reconcileLinearIssues).mockResolvedValue(0)

    const response = await GET()
    const data = (await response.json()) as { success: boolean; count: number }

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true, count: 0 })
    expect(linearReconcile.reconcileLinearIssues).toHaveBeenCalledTimes(1)
  })

  it('should handle large number of reconciled issues', async () => {
    // Mock reconciliation with many issues
    const mockCount = 100
    vi.mocked(linearReconcile.reconcileLinearIssues).mockResolvedValue(
      mockCount
    )

    const response = await GET()
    const data = (await response.json()) as { success: boolean; count: number }

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true, count: mockCount })
  })

  it('should return 500 when LINEAR_API_KEY is not configured', async () => {
    // Mock missing API key error
    const errorMessage = 'LINEAR_API_KEY not configured'
    vi.mocked(linearReconcile.reconcileLinearIssues).mockRejectedValue(
      new Error(errorMessage)
    )

    const response = await GET()
    const data = (await response.json()) as { error: string }

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: INTERNAL_SERVER_ERROR })
    expect(console.error).toHaveBeenCalledWith(
      'Reconciliation error:',
      expect.any(Error)
    )
  })

  it('should return 500 on Linear API error', async () => {
    // Mock Linear API failure
    const errorMessage = 'Linear API request failed'
    vi.mocked(linearReconcile.reconcileLinearIssues).mockRejectedValue(
      new Error(errorMessage)
    )

    const response = await GET()
    const data = (await response.json()) as { error: string }

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: INTERNAL_SERVER_ERROR })
    expect(linearReconcile.reconcileLinearIssues).toHaveBeenCalledTimes(1)
  })

  it('should return 500 on database error', async () => {
    // Mock database error
    const errorMessage = 'Database connection failed'
    vi.mocked(linearReconcile.reconcileLinearIssues).mockRejectedValue(
      new Error(errorMessage)
    )

    const response = await GET()
    const data = (await response.json()) as { error: string }

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: INTERNAL_SERVER_ERROR })
  })

  it('should return 500 on network error', async () => {
    // Mock network failure
    vi.mocked(linearReconcile.reconcileLinearIssues).mockRejectedValue(
      new Error('Network request failed')
    )

    const response = await GET()
    const data = (await response.json()) as { error: string }

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: INTERNAL_SERVER_ERROR })
    expect(console.error).toHaveBeenCalled()
  })

  it('should return 500 for unknown error types', async () => {
    // Mock non-Error object thrown
    vi.mocked(linearReconcile.reconcileLinearIssues).mockRejectedValue(
      'Unknown error'
    )

    const response = await GET()
    const data = (await response.json()) as { error: string }

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: INTERNAL_SERVER_ERROR })
    expect(console.error).toHaveBeenCalledWith(
      'Reconciliation error:',
      'Unknown error'
    )
  })

  it('should log reconciliation start and completion', async () => {
    const mockCount = 3
    vi.mocked(linearReconcile.reconcileLinearIssues).mockResolvedValue(
      mockCount
    )

    await GET()

    expect(console.log).toHaveBeenCalledWith(
      '[Reconcile] Starting reconciliation...'
    )
    expect(console.log).toHaveBeenCalledWith(
      `[Reconcile] Complete: ${mockCount} issues`
    )
  })

  it('should handle reconciliation timeout', async () => {
    // Mock timeout error
    vi.mocked(linearReconcile.reconcileLinearIssues).mockRejectedValue(
      new Error('Request timeout')
    )

    const response = await GET()
    const data = (await response.json()) as { error: string }

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: INTERNAL_SERVER_ERROR })
  })
})
