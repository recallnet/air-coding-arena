import jwt from 'jsonwebtoken'
import { describe, test, expect, beforeEach, afterEach } from 'vitest'

import { generateAppJWT } from './github-app-auth'

/* eslint-disable no-secrets/no-secrets */
// Test private key - not a real secret, used only for unit testing JWT generation
const TEST_PRIVATE_KEY = `TEST_PRIVATE_KEY_REMOVED`
/* eslint-enable no-secrets/no-secrets */

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
})
