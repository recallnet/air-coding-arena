import { NextRequest } from 'next/server'
import { describe, it, expect } from 'vitest'

import { POST } from './route'

describe('/api/github/webhook', () => {
  it('should return 401 for missing signature', async () => {
    const req = new NextRequest('http://localhost:3000/api/github/webhook', {
      method: 'POST',
      body: JSON.stringify({ action: 'opened' }),
    })

    const response = await POST(req)
    expect(response.status).toBe(401)
  })

  it('should return success for request with signature', async () => {
    const req = new NextRequest('http://localhost:3000/api/github/webhook', {
      method: 'POST',
      headers: {
        'x-hub-signature-256': 'sha256=test',
      },
      body: JSON.stringify({ action: 'opened' }),
    })

    const response = await POST(req)
    const json = (await response.json()) as { success?: boolean }

    expect(json.success).toBe(true)
  })
})
