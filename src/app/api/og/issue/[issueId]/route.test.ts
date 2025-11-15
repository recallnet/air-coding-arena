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
const IMAGE_PNG_CONTENT_TYPE = 'image/png'
const WITH_WINNER_ATTEMPT = { winnerAttempt: true }
const TEST_DATE_OPENED = new Date('2025-01-11T00:00:00Z')
const TEST_DATE_MERGED = new Date('2025-01-12T00:00:00Z')
const TEST_DATE_LABELED = new Date('2025-01-10T00:00:00Z')
const TEST_REPO = 'acme/app'
const CONTENT_TYPE_HEADER = 'content-type'

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
      repo: TEST_REPO,
      status: 'done',
      description: 'Add OAuth authentication flow',
      winnerAttemptId: '456e4567-e89b-12d3-a456-426614174001',
      winnerAttempt: {
        id: '456e4567-e89b-12d3-a456-426614174001',
        issueId: TEST_ISSUE_ID,
        agentName: 'cursor',
        repo: TEST_REPO,
        prNumber: 42,
        prUrl: 'https://github.com/acme/app/pull/42',
        status: 'merged',
        commitCount: 3,
        openedAt: TEST_DATE_OPENED,
        mergedAt: TEST_DATE_MERGED,
        closedAt: TEST_DATE_MERGED,
      },
      arenaReadyLabeledAt: TEST_DATE_LABELED,
      createdAt: TEST_DATE_LABELED,
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
    expect(response.headers.get(CONTENT_TYPE_HEADER)).toBe(
      IMAGE_PNG_CONTENT_TYPE
    )

    // Verify database queries were called correctly
    expect(db.query.issues.findFirst).toHaveBeenCalledWith({
      where: expect.anything(),
      with: WITH_WINNER_ATTEMPT,
    })
  })

  it('should render OG image for issue with winner and single competitor', async () => {
    // Mock issue with winner and only 1 competitor
    const mockIssue = {
      id: TEST_ISSUE_ID,
      linearId: TEST_LINEAR_ID,
      linearKey: 'CA-789',
      title: 'Fix bug in payment flow',
      url: 'https://linear.app/company/issue/CA-789',
      repo: TEST_REPO,
      status: 'done',
      description: 'Fix Stripe webhook handling',
      winnerAttemptId: '789e4567-e89b-12d3-a456-426614174003',
      winnerAttempt: {
        id: '789e4567-e89b-12d3-a456-426614174003',
        issueId: TEST_ISSUE_ID,
        agentName: 'cursor',
        repo: TEST_REPO,
        prNumber: 99,
        prUrl: 'https://github.com/acme/app/pull/99',
        status: 'merged',
        commitCount: 1,
        openedAt: TEST_DATE_OPENED,
        mergedAt: TEST_DATE_MERGED,
        closedAt: TEST_DATE_MERGED,
      },
      arenaReadyLabeledAt: TEST_DATE_LABELED,
      createdAt: TEST_DATE_LABELED,
    }

    const mockCompetitors = [
      {
        agentName: 'cursor',
        attemptCount: 1,
      },
    ]

    // Mock database queries
    vi.mocked(db.query.issues.findFirst).mockResolvedValue(mockIssue as never)

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
    expect(response.headers.get(CONTENT_TYPE_HEADER)).toBe(
      IMAGE_PNG_CONTENT_TYPE
    )
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

  it('should return 500 with unknown error message for non-Error exceptions', async () => {
    vi.mocked(db.query.issues.findFirst).mockRejectedValue(
      'String error thrown'
    )

    const request = new Request(TEST_REQUEST_URL_WINNER)
    const response = await GET(request, {
      params: Promise.resolve({ issueId: TEST_ISSUE_ID }),
    })

    expect(response.status).toBe(500)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('Unknown error')
  })

  it('should render active competition view when no winner', async () => {
    // Mock issue without winner
    const mockIssue = {
      id: TEST_ISSUE_ID,
      linearId: TEST_LINEAR_ID,
      linearKey: 'CA-456',
      title: 'Add payment integration',
      url: 'https://linear.app/company/issue/CA-456',
      repo: TEST_REPO,
      status: 'in progress',
      description: 'Integrate Stripe payment system',
      winnerAttemptId: null,
      arenaReadyLabeledAt: TEST_DATE_LABELED,
      createdAt: TEST_DATE_LABELED,
    }

    const mockCompetitors = [
      {
        agentName: 'cursor',
        attemptCount: 2,
      },
      {
        agentName: 'copilot',
        attemptCount: 1,
      },
    ]

    // Mock database queries
    vi.mocked(db.query.issues.findFirst).mockResolvedValue(mockIssue as never)

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
    expect(response.headers.get(CONTENT_TYPE_HEADER)).toBe(
      IMAGE_PNG_CONTENT_TYPE
    )

    // Verify database queries were called correctly
    expect(db.query.issues.findFirst).toHaveBeenCalledWith({
      where: expect.anything(),
      with: WITH_WINNER_ATTEMPT,
    })
  })
})
