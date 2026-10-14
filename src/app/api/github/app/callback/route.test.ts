import { generateKeyPairSync } from 'node:crypto'

/* eslint-disable no-undef */
import type { NextRequest } from 'next/server'
import { describe, test, expect, beforeEach, vi } from 'vitest'

import { db } from '@/db/client'

import { GET } from './route'

const CALLBACK_URL = 'http://localhost:3000/api/github/app/callback'

// Fresh key material exists only in this test process.
const { privateKey: TEST_PRIVATE_KEY } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})

// Mock database
vi.mock('@/db/client', () => ({
  db: {
    insert: vi.fn(),
  },
}))

function installationCallbackUrl(action: string): string {
  const url = new URL(CALLBACK_URL)
  url.searchParams.set('installation_id', '12345')
  url.searchParams.set('setup_action', action)
  return url.toString()
}

/**
 * Creates a mock Next.js request
 *
 * @param url - The URL for the request
 * @returns NextRequest object
 */
function createMockRequest(url: string): NextRequest {
  const req = new Request(url, {
    method: 'GET',
  }) as NextRequest

  // Manually add nextUrl property which is needed by Next.js routes
  Object.defineProperty(req, 'nextUrl', {
    value: new URL(url),
    writable: false,
  })

  return req
}

describe('/api/github/app/callback', () => {
  beforeEach(() => {
    // Don't use clearAllMocks as it breaks the mock chain
    // Just reset the environment and fetch mock
    process.env['GITHUB_APP_ID'] = '123456'
    process.env['GITHUB_APP_PRIVATE_KEY'] = TEST_PRIVATE_KEY
  })

  test('should handle successful installation', async () => {
    // Set up database mock
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue([
          {
            id: 'test-id',
            installationId: '12345',
            accountLogin: 'recallnet',
          },
        ]),
      }),
    } as never)

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 12345,
        account: {
          id: 67890,
          login: 'recallnet',
          type: 'Organization',
        },
      }),
    })
    global.fetch = mockFetch

    const request = createMockRequest(
      `${CALLBACK_URL}?installation_id=12345&setup_action=install`
    )

    const response = await GET(request)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('/admin/github/setup?success=true')
    expect(location).toContain('&t=')
  })

  test('should handle missing installation_id', async () => {
    const request = createMockRequest(`${CALLBACK_URL}?setup_action=install`)

    const response = await GET(request)

    expect(response.status).toBe(400)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('Missing installation_id')
  })

  test('should handle API errors gracefully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    })
    global.fetch = mockFetch

    const request = createMockRequest(
      `${CALLBACK_URL}?installation_id=12345&setup_action=install`
    )

    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toContain('error=')
  })

  test('should mark installation as suspended on suspend action', async () => {
    // Set up database mock
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue([
          {
            id: 'test-id',
            installationId: '12345',
            accountLogin: 'recallnet',
          },
        ]),
      }),
    } as never)

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 12345,
        account: {
          id: 67890,
          login: 'recallnet',
          type: 'Organization',
        },
        suspended_at: '2024-01-01T00:00:00Z',
      }),
    })
    global.fetch = mockFetch

    const request = createMockRequest(installationCallbackUrl('suspend'))

    const response = await GET(request)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('/admin/github/setup?suspended=true')
    expect(location).toContain('&t=')
  })

  test('should mark as suspended when suspended_at is present but action is not install/update', async () => {
    // Set up database mock
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue([
          {
            id: 'test-id',
            installationId: '12345',
            accountLogin: 'recallnet',
          },
        ]),
      }),
    } as never)

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 12345,
        account: {
          id: 67890,
          login: 'recallnet',
          type: 'Organization',
        },
        suspended_at: '2024-01-01T00:00:00Z',
      }),
    })
    global.fetch = mockFetch

    const request = createMockRequest(installationCallbackUrl('other'))

    const response = await GET(request)

    expect(response.status).toBe(307)
    const location = response.headers.get('Location')
    expect(location).toContain('/admin/github/setup?suspended=true')
    expect(location).toContain('&t=')
  })
})
