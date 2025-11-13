/**
 * Tests for POST /api/agents/discover endpoint.
 *
 * @packageDocumentation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as agentDiscovery from '@/lib/agent-discovery'

import { POST } from './route'

// Mock agent-discovery module
vi.mock('@/lib/agent-discovery', () => ({
  discoverAgents: vi.fn(),
}))

describe('POST /api/agents/discover', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call discoverAgents and return results', async () => {
    // Mock successful discovery
    const mockResults = {
      discovered: 3,
      updated: 2,
      deactivated: 1,
    }
    vi.mocked(agentDiscovery.discoverAgents).mockResolvedValue(mockResults)

    const response = await POST()
    const data = (await response.json()) as {
      discovered: number
      updated: number
      deactivated: number
    }

    expect(response.status).toBe(200)
    expect(data).toEqual(mockResults)
    expect(agentDiscovery.discoverAgents).toHaveBeenCalledTimes(1)
  })

  it('should return 500 on discovery error', async () => {
    // Mock discovery failure
    const errorMessage = 'LINEAR_API_KEY not configured'
    vi.mocked(agentDiscovery.discoverAgents).mockRejectedValue(
      new Error(errorMessage)
    )

    const response = await POST()
    const data = (await response.json()) as { error: string }

    expect(response.status).toBe(500)
    expect(data.error).toBe(errorMessage)
    expect(agentDiscovery.discoverAgents).toHaveBeenCalledTimes(1)
  })

  it('should return 500 with generic error for unknown errors', async () => {
    // Mock discovery failure with non-Error object
    vi.mocked(agentDiscovery.discoverAgents).mockRejectedValue('Unknown error')

    const response = await POST()
    const data = (await response.json()) as { error: string }

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to discover agents')
  })

  it('should handle zero discoveries', async () => {
    // Mock no changes
    const mockResults = {
      discovered: 0,
      updated: 0,
      deactivated: 0,
    }
    vi.mocked(agentDiscovery.discoverAgents).mockResolvedValue(mockResults)

    const response = await POST()
    const data = (await response.json()) as {
      discovered: number
      updated: number
      deactivated: number
    }

    expect(response.status).toBe(200)
    expect(data).toEqual(mockResults)
  })
})
