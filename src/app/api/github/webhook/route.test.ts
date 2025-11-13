import crypto from 'node:crypto'

import { NextRequest } from 'next/server'
import { beforeEach, describe, it, expect, vi } from 'vitest'

import { db } from '@/db/client'
import { events } from '@/db/schema'

import { POST } from './route'

// Mock the database
vi.mock('@/db/client', () => ({
  db: {
    insert: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('/api/github/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 for missing signature', async () => {
    const req = new NextRequest('http://localhost:3000/api/github/webhook', {
      method: 'POST',
      body: JSON.stringify({ action: 'opened' }),
    })

    const response = await POST(req)
    expect(response.status).toBe(401)
  })

  describe('Signature Verification', () => {
    const secret = 'test-secret-key'
    const payload = JSON.stringify({
      action: 'opened',
      pull_request: { number: 1 },
    })

    beforeEach(() => {
      vi.stubEnv('GITHUB_WEBHOOK_SECRET', secret)
    })

    it('should accept valid HMAC signature', async () => {
      const hmac = crypto.createHmac('sha256', secret)
      const signature = 'sha256=' + hmac.update(payload).digest('hex')

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
  })

  describe('Idempotency', () => {
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
})
