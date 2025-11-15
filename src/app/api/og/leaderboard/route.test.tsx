/**
 * Tests for GET /api/og/leaderboard endpoint.
 *
 * @packageDocumentation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from './route.js'

// Mock getAgentStats
vi.mock('@/lib/queries', () => ({
  getAgentStats: vi.fn(),
}))

const { getAgentStats } = await import('@/lib/queries')

describe('GET /api/og/leaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render OG image with top 3 agents', async () => {
    const mockAgents = [
      {
        agentName: 'cursor',
        displayName: 'Cursor',
        avatarUrl: 'https://example.com/cursor.png',
        ordinal: 1600,
        issues: 10,
        prs: 15,
        wins: 8,
        dnf: 2,
        attempts: 15,
        acceptancePct: 80,
        gamesPlayed: 10,
      },
      {
        agentName: 'copilot',
        displayName: 'GitHub Copilot',
        avatarUrl: 'https://example.com/copilot.png',
        ordinal: 1500,
        issues: 8,
        prs: 12,
        wins: 6,
        dnf: 2,
        attempts: 12,
        acceptancePct: 75,
        gamesPlayed: 8,
      },
      {
        agentName: 'engine',
        displayName: 'Engine',
        avatarUrl: null,
        ordinal: 1400,
        issues: 6,
        prs: 10,
        wins: 4,
        dnf: 2,
        attempts: 10,
        acceptancePct: 66.7,
        gamesPlayed: 6,
      },
      {
        agentName: 'cyrus',
        displayName: 'Cyrus',
        avatarUrl: null,
        ordinal: 1300,
        issues: 4,
        prs: 6,
        wins: 2,
        dnf: 2,
        attempts: 6,
        acceptancePct: 50,
        gamesPlayed: 4,
      },
    ]

    vi.mocked(getAgentStats).mockResolvedValue(mockAgents)

    const response = await GET()

    // Verify response is an image
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')

    // Verify getAgentStats was called
    expect(getAgentStats).toHaveBeenCalledOnce()
  })

  it('should render empty state when no agents exist', async () => {
    vi.mocked(getAgentStats).mockResolvedValue([])

    const response = await GET()

    // Verify response is an image
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')

    // Verify getAgentStats was called
    expect(getAgentStats).toHaveBeenCalledOnce()
  })

  it('should return 500 on error', async () => {
    vi.mocked(getAgentStats).mockRejectedValue(
      new Error('Database connection failed')
    )

    const response = await GET()

    expect(response.status).toBe(500)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('Database connection failed')
  })
})
