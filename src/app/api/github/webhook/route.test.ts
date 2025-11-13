import crypto from 'node:crypto'

import { NextRequest } from 'next/server'
import { beforeEach, describe, it, expect, vi } from 'vitest'

import { POST } from './route'

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
})
