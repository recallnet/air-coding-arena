/**
 * Tests for GET /api/og/issue/[issueId] endpoint.
 *
 * @packageDocumentation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/db/client'

import { GET } from './route.js'

// Test constants
const TEST_ISSUE_ID = '123e4567-e89b-12d3-a456-426614174000'
const TEST_LINEAR_ID = 'ISS-123'
const TEST_REQUEST_URL_WINNER = `http://localhost/api/og/issue/${TEST_ISSUE_ID}`

// Mock database
vi.mock('@/db/client', () => ({
  db: {
    select: vi.fn(),
    query: {
      issues: {
        findFirst: vi.fn(),
      },
      attempts: {
        findMany: vi.fn(),
      },
    },
  },
}))

describe('GET /api/og/issue/[issueId] - Task 3: Winner View', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render OG image for issue with winner', async () => {
    // Mock issue with winner
    const mockIssue = {
      id: TEST_ISSUE_ID,
      linearId: TEST_LINEAR_ID,
      linearKey: 'CA-123',
      title: 'Implement user authentication',
      url: 'https://linear.app/company/issue/CA-123',
      repo: 'acme/app',
      status: 'done',
      description: 'Add OAuth authentication flow',
      winnerAttemptId: '456e4567-e89b-12d3-a456-426614174001',
      arenaReadyLabeledAt: new Date('2025-01-10T00:00:00Z'),
      createdAt: new Date('2025-01-10T00:00:00Z'),
    }

    const mockWinnerAttempt = {
      id: '456e4567-e89b-12d3-a456-426614174001',
      issueId: TEST_ISSUE_ID,
      agentName: 'cursor',
      repo: 'acme/app',
      prNumber: 42,
      prUrl: 'https://github.com/acme/app/pull/42',
      status: 'merged',
      commitCount: 3,
      openedAt: new Date('2025-01-11T00:00:00Z'),
      mergedAt: new Date('2025-01-12T00:00:00Z'),
      closedAt: new Date('2025-01-12T00:00:00Z'),
    }

    const mockCompetitors = [
      {
        agentName: 'cursor',
        attemptCount: 1,
      },
      {
        agentName: 'copilot',
        attemptCount: 2,
      },
    ]

    // Mock database queries
    vi.mocked(db.query.issues.findFirst).mockResolvedValue(mockIssue as never)
    vi.mocked(db.query.attempts.findMany).mockResolvedValue([
      mockWinnerAttempt,
    ] as never)

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockResolvedValue(mockCompetitors),
        }),
      }),
    })
    vi.mocked(db.select).mockReturnValue(mockSelect() as never)

    const request = new Request(TEST_REQUEST_URL_WINNER)
    const response = await GET(request, {
      params: Promise.resolve({ issueId: TEST_ISSUE_ID }),
    })

    // Verify response is an image
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')

    // Verify database queries were called correctly
    expect(db.query.issues.findFirst).toHaveBeenCalledWith({
      where: expect.anything(),
      with: {
        winnerAttempt: true,
      },
    })
  })

  it('should return 404 if issue not found', async () => {
    vi.mocked(db.query.issues.findFirst).mockResolvedValue(undefined)

    const request = new Request(TEST_REQUEST_URL_WINNER)
    const response = await GET(request, {
      params: Promise.resolve({ issueId: TEST_ISSUE_ID }),
    })

    expect(response.status).toBe(404)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('Issue not found')
  })

  it('should return 500 on database error', async () => {
    vi.mocked(db.query.issues.findFirst).mockRejectedValue(
      new Error('Database connection failed')
    )

    const request = new Request(TEST_REQUEST_URL_WINNER)
    const response = await GET(request, {
      params: Promise.resolve({ issueId: TEST_ISSUE_ID }),
    })

    expect(response.status).toBe(500)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('Database connection failed')
  })
})
