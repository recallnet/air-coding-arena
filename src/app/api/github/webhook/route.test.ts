/* eslint-disable no-undef, sonarjs/no-duplicate-string */
import crypto from 'node:crypto'

import { NextRequest } from 'next/server'
import { beforeEach, describe, it, expect, vi } from 'vitest'

import { db } from '@/db/client'

import { POST } from './route'

// Test constants
const WEBHOOK_URL = 'http://localhost:3000/api/github/webhook'
const TEST_SECRET = 'test-secret-key'
const TEST_REPO = 'recallnet/js-recall'
const TEST_PR_NUMBER = 1559
const TEST_SHA = 'new-sha-123'
const TEST_ATTEMPT_ID = 'attempt-uuid'
const TEST_ISSUE_ID = 'test-issue-id'

// Mock the database
vi.mock('@/db/client', () => ({
  db: {
    insert: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  },
}))

/**
 * Helper to create authenticated request
 *
 * @param payload - Request payload
 * @param secret - Webhook secret
 * @returns Authenticated NextRequest
 */
function createAuthenticatedRequest(
  payload: object,
  secret = TEST_SECRET
): NextRequest {
  const body = JSON.stringify(payload)
  const hmac = crypto.createHmac('sha256', secret)
  const signature = 'sha256=' + hmac.update(body).digest('hex')

  return new NextRequest(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'x-hub-signature-256': signature },
    body,
  })
}

describe('/api/github/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 for missing signature', async () => {
    const req = new NextRequest(WEBHOOK_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'opened' }),
    })

    const response = await POST(req)
    expect(response.status).toBe(401)
  })

  describe('Signature Verification', () => {
    const payload = JSON.stringify({
      action: 'opened',
      pull_request: { number: 1, head: { sha: 'abc123' } },
    })

    beforeEach(() => {
      vi.stubEnv('GITHUB_WEBHOOK_SECRET', TEST_SECRET)
    })

    it('should accept valid HMAC signature', async () => {
      const hmac = crypto.createHmac('sha256', TEST_SECRET)
      const signature = 'sha256=' + hmac.update(payload).digest('hex')

      // Mock successful insert
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      const req = new NextRequest('http://localhost:3000/api/github/webhook', {
        method: 'POST',
        headers: { 'x-hub-signature-256': signature },
        body: payload,
      })

      const response = await POST(req)
      expect(response.status).not.toBe(401)
    })

    it('should reject invalid HMAC signature', async () => {
      const req = new NextRequest('http://localhost:3000/api/github/webhook', {
        method: 'POST',
        headers: { 'x-hub-signature-256': 'sha256=invalid' },
        body: payload,
      })

      const response = await POST(req)
      expect(response.status).toBe(401)
    })

    it('should reject when GITHUB_WEBHOOK_SECRET is not configured', async () => {
      vi.stubEnv('GITHUB_WEBHOOK_SECRET', '')

      const hmac = crypto.createHmac('sha256', 'some-secret')
      const payload = JSON.stringify({
        action: 'opened',
        pull_request: { number: 1, head: { sha: 'abc123' } },
      })
      const signature = 'sha256=' + hmac.update(payload).digest('hex')

      const req = new NextRequest('http://localhost:3000/api/github/webhook', {
        method: 'POST',
        headers: { 'x-hub-signature-256': signature },
        body: payload,
      })

      const response = await POST(req)
      expect(response.status).toBe(401)
    })
  })

  describe('Idempotency', () => {
    beforeEach(() => {
      vi.stubEnv('GITHUB_WEBHOOK_SECRET', TEST_SECRET)
      vi.clearAllMocks()
    })

    it('should process first webhook event', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: { number: 1, head: { sha: 'abc123' } },
      }
      const req = createAuthenticatedRequest(payload)

      // Mock successful insert
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            target: vi.fn(),
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      const response = await POST(req)
      const json = (await response.json()) as { success?: boolean }

      expect(json.success).toBe(true)
    })

    it('should return duplicate for same event', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: { number: 1, head: { sha: 'abc123' } },
      }

      // Mock duplicate (empty result)
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            target: vi.fn(),
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      const json = (await response.json()) as { status?: string }

      expect(json.status).toBe('duplicate')
    })
  })

  describe('pull_request.synchronize', () => {
    beforeEach(() => {
      vi.stubEnv('GITHUB_WEBHOOK_SECRET', TEST_SECRET)
      vi.stubEnv('GITHUB_TOKEN', 'github_pat_test_token')
      vi.clearAllMocks()
    })

    it('should update commit count for tracked PR', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: {
          number: TEST_PR_NUMBER,
          head: { sha: TEST_SHA },
        },
        repository: { full_name: TEST_REPO },
      }

      // Mock idempotency check (event is new)
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock attempt lookup (PR is tracked)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: TEST_ATTEMPT_ID,
                issueId: TEST_ISSUE_ID,
                agentName: 'cursor',
                repo: TEST_REPO,
                prNumber: TEST_PR_NUMBER,
                commitCount: 1,
              },
            ]),
          }),
        }),
      } as never)

      // Mock GitHub API response for commit count
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { sha: 'commit1' },
          { sha: 'commit2' },
          { sha: 'commit3' },
        ],
      })

      // Mock update operation
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'attempt-uuid' }]),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Verify update was called with correct data
      expect(db.update).toHaveBeenCalled()
    })

    it('should ignore untracked PRs', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: {
          number: 9999,
          head: { sha: 'unknown-sha' },
        },
        repository: { full_name: 'recallnet/js-recall' },
      }

      // Mock idempotency check (event is new)
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock attempt lookup (PR not found)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Should not call update for untracked PRs
      expect(db.update).not.toHaveBeenCalled()
    })

    it('should handle GitHub API errors gracefully', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: {
          number: 1559,
          head: { sha: 'new-sha-123' },
        },
        repository: { full_name: 'recallnet/js-recall' },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock attempt lookup
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'attempt-uuid',
                issueId: 'test-issue-id',
                agentName: 'cursor',
                repo: 'recallnet/js-recall',
                prNumber: 1559,
                commitCount: 1,
              },
            ]),
          }),
        }),
      } as never)

      // Mock GitHub API failure
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      })

      // Mock update operation
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'attempt-uuid' }]),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Should still update with fallback count (1)
      expect(db.update).toHaveBeenCalled()
    })

    it('should handle missing GITHUB_TOKEN', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: {
          number: 1559,
          head: { sha: 'new-sha-123' },
        },
        repository: { full_name: 'recallnet/js-recall' },
      }

      vi.stubEnv('GITHUB_TOKEN', '')

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock attempt lookup
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'attempt-uuid',
                issueId: 'test-issue-id',
                agentName: 'cursor',
                repo: 'recallnet/js-recall',
                prNumber: 1559,
                commitCount: 1,
              },
            ]),
          }),
        }),
      } as never)

      // Mock update operation
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'attempt-uuid' }]),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Should still update with fallback count (1) when token is missing
      expect(db.update).toHaveBeenCalled()
    })

    it('should handle invalid repository format', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: {
          number: 1559,
          head: { sha: 'new-sha-123' },
        },
        repository: { full_name: 'invalid-repo' },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock attempt lookup
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'attempt-uuid',
                issueId: 'test-issue-id',
                agentName: 'cursor',
                repo: 'invalid-repo',
                prNumber: 1559,
                commitCount: 1,
              },
            ]),
          }),
        }),
      } as never)

      // Mock update operation
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'attempt-uuid' }]),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Should still update with fallback count (1) for invalid repo format
      expect(db.update).toHaveBeenCalled()
    })

    it('should handle fetch exceptions', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: {
          number: 1559,
          head: { sha: 'new-sha-123' },
        },
        repository: { full_name: 'recallnet/js-recall' },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock attempt lookup
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'attempt-uuid',
                issueId: 'test-issue-id',
                agentName: 'cursor',
                repo: 'recallnet/js-recall',
                prNumber: 1559,
                commitCount: 1,
              },
            ]),
          }),
        }),
      } as never)

      // Mock fetch to throw an error
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      // Mock update operation
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'attempt-uuid' }]),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Should still update with fallback count (1) on network error
      expect(db.update).toHaveBeenCalled()
    })

    it('should handle missing pull_request in payload', async () => {
      const payload = {
        action: 'synchronize',
        repository: { full_name: 'recallnet/js-recall' },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Should not call select or update
      expect(db.select).not.toHaveBeenCalled()
      expect(db.update).not.toHaveBeenCalled()
    })

    it('should handle missing repository in payload', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: {
          number: 1559,
          head: { sha: 'new-sha-123' },
        },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Should not call select or update
      expect(db.select).not.toHaveBeenCalled()
      expect(db.update).not.toHaveBeenCalled()
    })

    it('should handle non-array response from GitHub API', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: {
          number: 1559,
          head: { sha: 'new-sha-123' },
        },
        repository: { full_name: 'recallnet/js-recall' },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock attempt lookup
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'attempt-uuid',
                issueId: 'test-issue-id',
                agentName: 'cursor',
                repo: 'recallnet/js-recall',
                prNumber: 1559,
                commitCount: 1,
              },
            ]),
          }),
        }),
      } as never)

      // Mock GitHub API returning non-array
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'Not an array' }),
      })

      // Mock update operation
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'attempt-uuid' }]),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Should update with fallback count (1) when response is not array
      expect(db.update).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    const secret = 'test-secret-key'

    beforeEach(() => {
      vi.stubEnv('GITHUB_WEBHOOK_SECRET', secret)
      vi.clearAllMocks()
    })

    function createAuthenticatedRequest(payload: object): NextRequest {
      const body = JSON.stringify(payload)
      const hmac = crypto.createHmac('sha256', secret)
      const signature = 'sha256=' + hmac.update(body).digest('hex')

      return new NextRequest('http://localhost:3000/api/github/webhook', {
        method: 'POST',
        headers: { 'x-hub-signature-256': signature },
        body,
      })
    }

    it('should handle database errors gracefully', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: {
          number: 1559,
          head: { sha: 'new-sha-123' },
        },
        repository: { full_name: 'recallnet/js-recall' },
      }

      // Mock idempotency check to throw an error
      vi.mocked(db.insert).mockImplementation(() => {
        throw new Error('Database connection failed')
      })

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(500)

      const json = (await response.json()) as { error?: string }
      expect(json.error).toBe('Internal server error')
    })
  })
})
