import { eq } from 'drizzle-orm'
import { describe, test, expect, beforeAll } from 'vitest'

import { db } from '@/db/client'
import { githubAppInstallations } from '@/db/schema'

import { generateAppJWT } from './github-app-auth'

/* eslint-disable no-secrets/no-secrets */
// Test private key - not a real secret, used only for unit testing JWT generation
const TEST_PRIVATE_KEY = `TEST_PRIVATE_KEY_REMOVED`
/* eslint-enable no-secrets/no-secrets */

describe('GitHub App Integration', () => {
  const testInstallationId = '12345'
  const testOrg = 'test-org'
  const isTestDb = process.env['IS_TEST_DB_URL'] === 'true'

  beforeAll(async () => {
    // Set up test environment
    process.env['GITHUB_APP_ID'] = '2287430'
    process.env['GITHUB_APP_PRIVATE_KEY'] = TEST_PRIVATE_KEY

    // Skip database operations if using test dummy database
    if (isTestDb) {
      return
    }

    // Insert test installation (only when real database is available)
    await db
      .insert(githubAppInstallations)
      .values({
        installationId: testInstallationId,
        accountId: '67890',
        accountLogin: testOrg,
        accountType: 'Organization',
        isActive: true,
      })
      .onConflictDoNothing()
  })

  test('should generate valid JWT', () => {
    const jwt = generateAppJWT()

    expect(jwt).toBeDefined()
    expect(typeof jwt).toBe('string')
    expect(jwt.split('.')).toHaveLength(3) // JWT has 3 parts
  })

  test.skipIf(isTestDb)('should fetch installation from database', async () => {
    const installation = await db
      .select()
      .from(githubAppInstallations)
      .where(eq(githubAppInstallations.accountLogin, testOrg))
      .limit(1)

    expect(installation).toHaveLength(1)
    expect(installation[0]?.accountLogin).toBe(testOrg)
    expect(installation[0]?.installationId).toBe(testInstallationId)
    expect(installation[0]?.isActive).toBe(true)
  })

  // eslint-disable-next-line vitest/no-disabled-tests
  test.skip('should use installation token for webhook API calls', async () => {
    // This test requires actual GitHub API access
    // Skip in CI, run manually during verification
  })
})
