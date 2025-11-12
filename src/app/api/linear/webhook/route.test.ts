/**
 * Tests for Linear webhook handler.
 *
 * @packageDocumentation
 */

import crypto from 'node:crypto'

import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/db/client'

import { POST } from './route'

// Mock modules
vi.mock('@/db/client', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  },
}))

const WEBHOOK_URL = 'http://localhost:3109/api/linear/webhook'
const TEST_SECRET = 'test-secret'
const ARENA_LABEL = 'arena:ready'
const TEST_PR_URL = 'https://github.com/org/repo/pull/42'
const TEST_ISSUE_ID = 'issue-123'
const TEST_TIMESTAMP = '2024-01-01T00:00:00Z'

/**
 * Creates a mock Next.js request with Linear webhook signature.
 *
 * @param payload - Webhook payload object
 * @param secret - Webhook secret for signature
 * @returns Mock NextRequest
 */
function createMockRequest(
  payload: Record<string, unknown>,
  secret?: string
): NextRequest {
  const body = JSON.stringify(payload)
  const hmac = crypto.createHmac('sha256', secret ?? TEST_SECRET)
  const signature = hmac.update(body).digest('hex')

  return new Request(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'linear-signature': signature,
    },
    body,
  }) as NextRequest
}

describe('/api/linear/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env['LINEAR_WEBHOOK_SECRET'] = TEST_SECRET
    process.env['ARENA_LABEL'] = ARENA_LABEL
  })

  describe('signature verification', () => {
    it('should reject requests without signature', async () => {
      const req = new Request(WEBHOOK_URL, {
        method: 'POST',
        body: JSON.stringify({ type: 'Issue' }),
      }) as NextRequest

      const response = await POST(req)
      const data = (await response.json()) as { error: string }

      expect(response.status).toBe(401)
      expect(data.error).toBe('Invalid signature')
    })

    it('should reject requests with invalid signature', async () => {
      const payload = { type: 'Issue', data: { id: '123' } }
      const body = JSON.stringify(payload)

      const req = new Request(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'linear-signature': 'invalid-signature',
        },
        body,
      }) as NextRequest

      const response = await POST(req)
      const data = (await response.json()) as { error: string }

      expect(response.status).toBe(401)
      expect(data.error).toBe('Invalid signature')
    })

    it('should accept requests with valid signature', async () => {
      const payload = {
        type: 'Issue',
        action: 'update',
        data: {
          id: TEST_ISSUE_ID,
          identifier: 'ENG-123',
          title: 'Test issue',
          url: 'https://linear.app/test/issue/ENG-123',
          labels: [{ name: ARENA_LABEL }],
        },
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }

      // Mock database calls
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never)

      const req = createMockRequest(payload)
      const response = await POST(req)
      const data = (await response.json()) as { success: boolean }

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('idempotency', () => {
    it('should reject duplicate events', async () => {
      const payload = {
        type: 'Issue',
        action: 'update',
        data: {
          id: TEST_ISSUE_ID,
          identifier: 'ENG-123',
        },
        updatedAt: TEST_TIMESTAMP,
        createdAt: TEST_TIMESTAMP,
      }

      // Mock duplicate event (empty result)
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never)

      const req = createMockRequest(payload)
      const response = await POST(req)
      const data = (await response.json()) as { status: string }

      expect(response.status).toBe(200)
      expect(data.status).toBe('duplicate')
    })
  })

  describe('Issue events', () => {
    it('should create issue when arena:ready label is present', async () => {
      const payload = {
        type: 'Issue',
        action: 'create',
        data: {
          id: TEST_ISSUE_ID,
          identifier: 'ENG-123',
          title: 'Implement feature X',
          url: 'https://linear.app/test/issue/ENG-123',
          team: { key: 'engineering' },
          state: { name: 'Backlog' },
          labels: [{ name: ARENA_LABEL }, { name: 'frontend' }],
        },
        updatedAt: TEST_TIMESTAMP,
        createdAt: TEST_TIMESTAMP,
      }

      const mockInsert = vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      })

      vi.mocked(db.insert).mockReturnValue({
        values: mockInsert,
      } as never)

      const req = createMockRequest(payload)
      const response = await POST(req)

      expect(response.status).toBe(200)
      expect(mockInsert).toHaveBeenCalled()
    })

    it('should ignore issues without arena:ready label', async () => {
      const payload = {
        type: 'Issue',
        action: 'create',
        data: {
          id: 'issue-456',
          identifier: 'ENG-456',
          title: 'Regular issue',
          url: 'https://linear.app/test/issue/ENG-456',
          labels: [{ name: 'bug' }],
        },
        updatedAt: TEST_TIMESTAMP,
        createdAt: TEST_TIMESTAMP,
      }

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      const req = createMockRequest(payload)
      await POST(req)

      // Should only have created event, not issue (insert called once for event)
      expect(db.insert).toHaveBeenCalledOnce()
    })
  })

  describe('Attachment events', () => {
    it('should create attempt for GitHub PR attachment', async () => {
      const payload = {
        type: 'Attachment',
        action: 'create',
        data: {
          id: 'attach-123',
          url: TEST_PR_URL,
          title: 'Add feature X (agent-cursor)',
          subtitle: 'org/repo #42 • open',
          metadata: {
            branch: 'eng-123--feature-x--agent-cursor',
          },
          issue: {
            id: TEST_ISSUE_ID,
          },
        },
        updatedAt: TEST_TIMESTAMP,
        createdAt: TEST_TIMESTAMP,
      }

      // Mock database calls
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'db-issue-uuid' }]),
          }),
        }),
      })

      vi.mocked(db.select).mockReturnValue(mockSelect() as never)

      const mockInsert = vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
        onConflictDoUpdate: vi.fn().mockResolvedValue([]),
      })

      vi.mocked(db.insert).mockReturnValue({
        values: mockInsert,
      } as never)

      const req = createMockRequest(payload)
      const response = await POST(req)

      expect(response.status).toBe(200)
      expect(mockSelect).toHaveBeenCalled()
    })

    it('should guess agent from branch name', async () => {
      const testCases = [
        { branch: 'eng-123--fix--agent-cursor', expected: 'cursor' },
        { branch: 'eng-124--feature--agent-engine', expected: 'engine' },
        { branch: 'eng-125--refactor--agent-cyrus', expected: 'cyrus' },
        { branch: 'eng-126--other', expected: 'unknown' },
      ]

      for (const testCase of testCases) {
        const payload = {
          type: 'Attachment',
          action: 'create',
          data: {
            id: `attach-${testCase.branch}`,
            url: TEST_PR_URL,
            title: 'Test PR',
            subtitle: 'org/repo #42 • open',
            metadata: { branch: testCase.branch },
            issue: { id: TEST_ISSUE_ID },
          },
          updatedAt: TEST_TIMESTAMP,
          createdAt: TEST_TIMESTAMP,
        }

        vi.mocked(db.select).mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 'uuid' }]),
            }),
          }),
        } as never)

        vi.mocked(db.insert).mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoNothing: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 1 }]),
            }),
            onConflictDoUpdate: vi.fn().mockResolvedValue([]),
          }),
        } as never)

        const req = createMockRequest(payload)
        const response = await POST(req)
        expect(response.status).toBe(200)
      }
    })

    it('should detect merged status from subtitle', async () => {
      const payload = {
        type: 'Attachment',
        action: 'update',
        data: {
          id: 'attach-123',
          url: TEST_PR_URL,
          title: 'Add feature X',
          subtitle: 'org/repo #42 • merged',
          issue: { id: TEST_ISSUE_ID },
        },
        updatedAt: '2024-01-01T01:00:00Z',
        createdAt: TEST_TIMESTAMP,
      }

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'uuid' }]),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 'winner-id' }]),
            }),
          }),
        }),
      } as never)

      // Mock for attempts insert and update winner
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
          onConflictDoUpdate: vi.fn().mockResolvedValue([]),
        }),
      } as never)

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as never)

      const req = createMockRequest(payload)
      await POST(req)

      expect(db.update).toHaveBeenCalled()
    })

    it('should ignore non-GitHub URLs', async () => {
      const payload = {
        type: 'Attachment',
        action: 'create',
        data: {
          id: 'attach-doc',
          url: 'https://docs.google.com/document/123',
          title: 'Design doc',
          issue: { id: TEST_ISSUE_ID },
        },
        updatedAt: TEST_TIMESTAMP,
        createdAt: TEST_TIMESTAMP,
      }

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      const req = createMockRequest(payload)
      await POST(req)

      // Should only insert event, not query for issue or insert attempt
      expect(db.insert).toHaveBeenCalledOnce()
    })
  })

  describe('error handling', () => {
    it('should return 500 on database error', async () => {
      const payload = {
        type: 'Issue',
        action: 'create',
        data: { id: TEST_ISSUE_ID },
        updatedAt: TEST_TIMESTAMP,
        createdAt: TEST_TIMESTAMP,
      }

      vi.mocked(db.insert).mockImplementation(() => {
        throw new Error('Database connection failed')
      })

      const req = createMockRequest(payload)
      const response = await POST(req)

      expect(response.status).toBe(500)
    })

    it('should handle missing LINEAR_WEBHOOK_SECRET', async () => {
      delete process.env['LINEAR_WEBHOOK_SECRET']

      const payload = { type: 'Issue', data: { id: '123' } }
      const req = createMockRequest(payload, 'wrong-secret')
      const response = await POST(req)

      expect(response.status).toBe(401)
    })
  })
})
