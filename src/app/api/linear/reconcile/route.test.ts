/**
 * Tests for GET /api/linear/reconcile endpoint.
 *
 * @packageDocumentation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as agentDiscovery from '@/lib/agent-discovery'
import * as linearReconcile from '@/lib/linear-reconcile'

import { GET } from './route'

// Mock agent-discovery module
vi.mock('@/lib/agent-discovery', () => ({
  discoverAgents: vi.fn(),
}))

// Mock linear-reconcile module
vi.mock('@/lib/linear-reconcile', () => ({
  reconcileLinearIssues: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const INTERNAL_SERVER_ERROR = 'Internal server error'

describe('GET /api/linear/reconcile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear console mocks
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('should call discoverAgents and reconcileLinearIssues and return results on success', async () => {
    // Mock successful agent discovery
    const mockAgentResults = {
      discovered: 2,
      updated: 1,
      deactivated: 0,
    }
    vi.mocked(agentDiscovery.discoverAgents).mockResolvedValue(mockAgentResults)

    // Mock successful reconciliation with 5 issues
    const mockCount = 5
    vi.mocked(linearReconcile.reconcileLinearIssues).mockResolvedValue(
      mockCount
    )

    const response = await GET()
    const data = (await response.json()) as {
      success: boolean
      issueCount: number
      agentDiscovery: typeof mockAgentResults
    }

    expect(response.status).toBe(200)
    expect(data).toEqual({
      success: true,
      issueCount: mockCount,
      agentDiscovery: mockAgentResults,
    })
    expect(agentDiscovery.discoverAgents).toHaveBeenCalledTimes(1)
    expect(linearReconcile.reconcileLinearIssues).toHaveBeenCalledTimes(1)
    expect(console.log).toHaveBeenCalledWith(
      '[Reconcile] Discovering agents from Linear...'
    )
    expect(console.log).toHaveBeenCalledWith('[Reconcile] Complete: 5 issues')
  })

  it('should handle zero reconciled issues', async () => {
    // Mock agent discovery
    const mockAgentResults = { discovered: 0, updated: 0, deactivated: 0 }
    vi.mocked(agentDiscovery.discoverAgents).mockResolvedValue(mockAgentResults)

    // Mock reconciliation with no issues found
    vi.mocked(linearReconcile.reconcileLinearIssues).mockResolvedValue(0)

    const response = await GET()
    const data = (await response.json()) as {
      success: boolean
      issueCount: number
      agentDiscovery: typeof mockAgentResults
    }

    expect(response.status).toBe(200)
    expect(data).toEqual({
      success: true,
      issueCount: 0,
      agentDiscovery: mockAgentResults,
    })
    expect(linearReconcile.reconcileLinearIssues).toHaveBeenCalledTimes(1)
  })

  it('should handle large number of reconciled issues', async () => {
    // Mock agent discovery
    const mockAgentResults = { discovered: 5, updated: 2, deactivated: 1 }
    vi.mocked(agentDiscovery.discoverAgents).mockResolvedValue(mockAgentResults)

    // Mock reconciliation with many issues
    const mockCount = 100
    vi.mocked(linearReconcile.reconcileLinearIssues).mockResolvedValue(
      mockCount
    )

    const response = await GET()
    const data = (await response.json()) as {
      success: boolean
      issueCount: number
      agentDiscovery: typeof mockAgentResults
    }

    expect(response.status).toBe(200)
    expect(data).toEqual({
      success: true,
      issueCount: mockCount,
      agentDiscovery: mockAgentResults,
    })
  })

  it('should return 500 when LINEAR_API_KEY is not configured in agent discovery', async () => {
    // Mock missing API key error from discoverAgents
    const errorMessage = 'LINEAR_API_KEY not configured'
    vi.mocked(agentDiscovery.discoverAgents).mockRejectedValue(
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

  it('should return 500 on Linear API error during reconciliation', async () => {
    // Mock successful agent discovery
    const mockAgentResults = { discovered: 1, updated: 0, deactivated: 0 }
    vi.mocked(agentDiscovery.discoverAgents).mockResolvedValue(mockAgentResults)

    // Mock Linear API failure during reconciliation
    const errorMessage = 'Linear API request failed'
    vi.mocked(linearReconcile.reconcileLinearIssues).mockRejectedValue(
      new Error(errorMessage)
    )

    const response = await GET()
    const data = (await response.json()) as { error: string }

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: INTERNAL_SERVER_ERROR })
    expect(agentDiscovery.discoverAgents).toHaveBeenCalledTimes(1)
    expect(linearReconcile.reconcileLinearIssues).toHaveBeenCalledTimes(1)
  })

  it('should return 500 on database error', async () => {
    // Mock successful agent discovery
    const mockAgentResults = { discovered: 1, updated: 0, deactivated: 0 }
    vi.mocked(agentDiscovery.discoverAgents).mockResolvedValue(mockAgentResults)

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
    // Mock successful agent discovery
    const mockAgentResults = { discovered: 1, updated: 0, deactivated: 0 }
    vi.mocked(agentDiscovery.discoverAgents).mockResolvedValue(mockAgentResults)

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
    // Mock non-Error object thrown from agent discovery
    vi.mocked(agentDiscovery.discoverAgents).mockRejectedValue('Unknown error')

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
    // Mock successful agent discovery
    const mockAgentResults = { discovered: 3, updated: 1, deactivated: 0 }
    vi.mocked(agentDiscovery.discoverAgents).mockResolvedValue(mockAgentResults)

    const mockCount = 3
    vi.mocked(linearReconcile.reconcileLinearIssues).mockResolvedValue(
      mockCount
    )

    await GET()

    expect(console.log).toHaveBeenCalledWith(
      '[Reconcile] Discovering agents from Linear...'
    )
    expect(console.log).toHaveBeenCalledWith(
      '[Reconcile] Starting issue reconciliation...'
    )
    expect(console.log).toHaveBeenCalledWith(
      `[Reconcile] Complete: ${mockCount} issues`
    )
  })

  it('should handle reconciliation timeout', async () => {
    // Mock successful agent discovery
    const mockAgentResults = { discovered: 1, updated: 0, deactivated: 0 }
    vi.mocked(agentDiscovery.discoverAgents).mockResolvedValue(mockAgentResults)

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
