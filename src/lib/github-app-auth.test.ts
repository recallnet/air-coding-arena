import { generateKeyPairSync } from 'node:crypto'

/* eslint-disable no-undef */
import jwt from 'jsonwebtoken'
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  generateAppJWT,
  getInstallationToken,
  clearTokenCache,
} from './github-app-auth'

const { privateKey: TEST_PRIVATE_KEY, publicKey: TEST_PUBLIC_KEY } =
  generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  })

describe('GitHub App Auth', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GITHUB_APP_ID: '123456',
      GITHUB_APP_PRIVATE_KEY: TEST_PRIVATE_KEY,
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('generateAppJWT should create valid JWT', () => {
    const token = generateAppJWT()

    expect(token).toBeDefined()
    expect(typeof token).toBe('string')

    expect(
      jwt.verify(token, TEST_PUBLIC_KEY, { algorithms: ['RS256'] })
    ).toMatchObject({ iss: '123456' })

    // Verify JWT structure
    const decoded = jwt.decode(token, { complete: true })
    expect(decoded).toBeDefined()
    expect(decoded?.header.alg).toBe('RS256')
    expect(decoded?.payload).toMatchObject({
      iss: '123456',
    })

    // Verify expiration is ~10 minutes (plus clock skew buffer)
    const payload = decoded?.payload as jwt.JwtPayload
    expect(payload.exp).toBeDefined()
    expect(payload.iat).toBeDefined()
    const expiry = (payload.exp ?? 0) - (payload.iat ?? 0)
    expect(expiry).toBeLessThanOrEqual(660) // 10 minutes + 60s clock skew
    expect(expiry).toBeGreaterThan(600) // At least 10 minutes
  })

  test('generateAppJWT should throw if GITHUB_APP_ID missing', () => {
    delete process.env['GITHUB_APP_ID']
    expect(() => generateAppJWT()).toThrow('GITHUB_APP_ID not configured')
  })

  test('generateAppJWT should throw if GITHUB_APP_PRIVATE_KEY missing', () => {
    delete process.env['GITHUB_APP_PRIVATE_KEY']
    expect(() => generateAppJWT()).toThrow(
      'GITHUB_APP_PRIVATE_KEY not configured'
    )
  })

  test('generateAppJWT should handle base64-encoded private key', () => {
    // Base64 encode the test private key
    const base64Key = Buffer.from(TEST_PRIVATE_KEY).toString('base64')
    process.env['GITHUB_APP_PRIVATE_KEY_BASE64'] = base64Key
    delete process.env['GITHUB_APP_PRIVATE_KEY']

    const token = generateAppJWT()

    expect(token).toBeDefined()
    expect(typeof token).toBe('string')

    // Verify JWT structure
    const decoded = jwt.decode(token, { complete: true })
    expect(decoded).toBeDefined()
    expect(decoded?.header.alg).toBe('RS256')
  })

  test('generateAppJWT should strip double quotes from private key', () => {
    // Add quotes around the key (common mistake in env vars)
    process.env['GITHUB_APP_PRIVATE_KEY'] = `"${TEST_PRIVATE_KEY}"`

    const token = generateAppJWT()

    expect(token).toBeDefined()
    expect(typeof token).toBe('string')

    // Verify JWT structure
    const decoded = jwt.decode(token, { complete: true })
    expect(decoded).toBeDefined()
    expect(decoded?.header.alg).toBe('RS256')
  })

  test('generateAppJWT should strip single quotes from private key', () => {
    // Add single quotes around the key
    process.env['GITHUB_APP_PRIVATE_KEY'] = `'${TEST_PRIVATE_KEY}'`

    const token = generateAppJWT()

    expect(token).toBeDefined()
    expect(typeof token).toBe('string')

    // Verify JWT structure
    const decoded = jwt.decode(token, { complete: true })
    expect(decoded).toBeDefined()
    expect(decoded?.header.alg).toBe('RS256')
  })

  test('generateAppJWT should throw if neither key format is available (defensive check)', () => {
    // Delete both to trigger the else branch (though this should be caught by earlier validation)
    delete process.env['GITHUB_APP_PRIVATE_KEY']
    delete process.env['GITHUB_APP_PRIVATE_KEY_BASE64']

    expect(() => generateAppJWT()).toThrow(
      'GITHUB_APP_PRIVATE_KEY not configured'
    )
  })
})

describe('Installation Token Management', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GITHUB_APP_ID: '123456',
      GITHUB_APP_PRIVATE_KEY: TEST_PRIVATE_KEY,
    }
  })

  afterEach(() => {
    clearTokenCache()
    vi.restoreAllMocks()
    process.env = originalEnv
  })

  test('getInstallationToken should fetch token from GitHub', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: 'ghs_test_token',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      }),
    })
    global.fetch = mockFetch

    const token = await getInstallationToken('12345')

    expect(token).toBe('ghs_test_token')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/app/installations/12345/access_tokens',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        }),
      })
    )
  })

  test('getInstallationToken should cache tokens', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: 'ghs_cached_token',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      }),
    })
    global.fetch = mockFetch

    // First call should fetch
    const token1 = await getInstallationToken('12345')
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Second call should use cache
    const token2 = await getInstallationToken('12345')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(token1).toBe(token2)
  })

  test('getInstallationToken should refresh expired tokens', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'ghs_old_token',
          expires_at: new Date(Date.now() + 100).toISOString(), // Expires in 100ms
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'ghs_new_token',
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        }),
      })
    global.fetch = mockFetch

    const token1 = await getInstallationToken('12345')
    expect(token1).toBe('ghs_old_token')

    // Wait for token to expire
    await new Promise((resolve) => setTimeout(resolve, 150))

    const token2 = await getInstallationToken('12345')
    expect(token2).toBe('ghs_new_token')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  test('getInstallationToken should throw on API error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })
    global.fetch = mockFetch

    await expect(getInstallationToken('99999')).rejects.toThrow(
      'Failed to get installation token: 404 Not Found'
    )
  })
})
