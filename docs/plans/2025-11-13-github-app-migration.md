# GitHub App Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace manual GitHub PAT authentication with GitHub App installation flow for secure, scalable, multi-org support.

**Architecture:** GitHub App uses short-lived JWT tokens to authenticate the app, then exchanges those for 1-hour installation tokens scoped to specific organizations. Installation tokens are cached in-memory and refreshed automatically. Admin UI provides one-click installation flow via OAuth callback.

**Tech Stack:** GitHub REST API, jsonwebtoken (RS256), Next.js App Router, Drizzle ORM, PostgreSQL

---

## Task 1: Database Schema for GitHub App Installations

**Files:**
- Modify: `src/db/schema.ts` (add after line 295, before relations section)

**Step 1: Write failing test for schema**

Create: `src/db/schema.test.ts`

```typescript
import { describe, test, expect } from 'vitest'
import { githubAppInstallations } from './schema'

describe('Database Schema', () => {
  test('githubAppInstallations table should have correct structure', () => {
    // Verify table exists and has expected columns
    expect(githubAppInstallations).toBeDefined()
    expect(githubAppInstallations.id).toBeDefined()
    expect(githubAppInstallations.installationId).toBeDefined()
    expect(githubAppInstallations.accountLogin).toBeDefined()
    expect(githubAppInstallations.accountType).toBeDefined()
    expect(githubAppInstallations.isActive).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/db/schema.test.ts`
Expected: FAIL with "Cannot find name 'githubAppInstallations'"

**Step 3: Add GitHub App installations table to schema**

In `src/db/schema.ts`, add after the `agentConfig` table definition (after line 295):

```typescript
/**
 * GitHub App installations table - Tracks installed organizations.
 * One row per organization where the GitHub App is installed.
 */
export const githubAppInstallations = pgTable(
  'github_app_installations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    installationId: text('installation_id').notNull().unique(), // GitHub's installation ID
    accountId: text('account_id').notNull(), // Organization/user ID
    accountLogin: text('account_login').notNull(), // Organization/user login name
    accountType: text('account_type').notNull(), // 'Organization' or 'User'
    isActive: boolean('is_active').notNull().default(true),
    installedAt: timestamp('installed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    installationIdIdx: index('idx_gh_installation_id').on(
      table.installationId
    ),
    isActiveIdx: index('idx_gh_installation_active').on(table.isActive),
  })
)

/**
 * TypeScript types for GitHub App installations
 */
export type GitHubAppInstallation = typeof githubAppInstallations.$inferSelect
export type NewGitHubAppInstallation = typeof githubAppInstallations.$inferInsert
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/db/schema.test.ts`
Expected: PASS

**Step 5: Generate and apply migration**

Run: `npm run db:generate && npm run db:migrate`
Expected: Migration file created and applied successfully

**Step 6: Commit**

```bash
git add src/db/schema.ts src/db/schema.test.ts
git commit -m "feat(db): add github_app_installations table

- Track GitHub App installations per organization
- Store installation ID, account info, and active status
- Add indexes for fast lookups

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: GitHub App JWT Token Generation Utility

**Files:**
- Create: `src/lib/github-app-auth.ts`
- Create: `src/lib/github-app-auth.test.ts`

**Step 1: Install jsonwebtoken dependency**

Run: `npm install jsonwebtoken && npm install --save-dev @types/jsonwebtoken`
Expected: Package installed successfully

**Step 2: Write failing test for JWT generation**

Create: `src/lib/github-app-auth.test.ts`

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { generateAppJWT } from './github-app-auth'

describe('GitHub App Auth', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GITHUB_APP_ID: '123456',
      GITHUB_APP_PRIVATE_KEY: `TEST_PRIVATE_KEY_REMOVED`,
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

    // Verify expiration is ~10 minutes
    const payload = decoded?.payload as jwt.JwtPayload
    const expiry = payload.exp! - payload.iat!
    expect(expiry).toBeLessThanOrEqual(600) // 10 minutes max
    expect(expiry).toBeGreaterThan(0)
  })

  test('generateAppJWT should throw if GITHUB_APP_ID missing', () => {
    delete process.env.GITHUB_APP_ID
    expect(() => generateAppJWT()).toThrow('GITHUB_APP_ID not configured')
  })

  test('generateAppJWT should throw if GITHUB_APP_PRIVATE_KEY missing', () => {
    delete process.env.GITHUB_APP_PRIVATE_KEY
    expect(() => generateAppJWT()).toThrow(
      'GITHUB_APP_PRIVATE_KEY not configured'
    )
  })
})
```

**Step 3: Run test to verify it fails**

Run: `npm test -- src/lib/github-app-auth.test.ts`
Expected: FAIL with "Cannot find module './github-app-auth'"

**Step 4: Implement JWT generation**

Create: `src/lib/github-app-auth.ts`

```typescript
/**
 * GitHub App authentication utilities
 * @packageDocumentation
 */

import jwt from 'jsonwebtoken'

/**
 * Generates a JWT for authenticating as the GitHub App
 * Valid for 10 minutes (GitHub's maximum)
 *
 * @returns JWT token string
 * @throws Error if GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY not configured
 */
export function generateAppJWT(): string {
  const appId = process.env['GITHUB_APP_ID']
  const privateKey = process.env['GITHUB_APP_PRIVATE_KEY']

  if (!appId) {
    throw new Error('GITHUB_APP_ID not configured')
  }

  if (!privateKey) {
    throw new Error('GITHUB_APP_PRIVATE_KEY not configured')
  }

  // Replace literal \n with actual newlines (env vars store it escaped)
  const formattedKey = privateKey.replace(/\\n/g, '\n')

  const now = Math.floor(Date.now() / 1000)

  const payload = {
    iat: now - 60, // Issued 60 seconds in past for clock skew tolerance
    exp: now + 600, // Expires in 10 minutes (GitHub's max)
    iss: appId,
  }

  return jwt.sign(payload, formattedKey, { algorithm: 'RS256' })
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/github-app-auth.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/github-app-auth.ts src/lib/github-app-auth.test.ts package.json package-lock.json
git commit -m "feat(auth): add GitHub App JWT generation

- Generate RS256 JWTs for GitHub App authentication
- Handle clock skew with 60s backdating
- 10 minute expiry per GitHub limits
- Complete test coverage

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Installation Token Management with Caching

**Files:**
- Modify: `src/lib/github-app-auth.ts` (add functions)
- Modify: `src/lib/github-app-auth.test.ts` (add tests)

**Step 1: Write failing test for installation token fetch**

In `src/lib/github-app-auth.test.ts`, add:

```typescript
import { vi } from 'vitest'

describe('Installation Token Management', () => {
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/github-app-auth.test.ts`
Expected: FAIL with "Cannot find name 'getInstallationToken'"

**Step 3: Implement installation token management**

In `src/lib/github-app-auth.ts`, add:

```typescript
/**
 * In-memory cache for installation tokens
 * Key: installation ID, Value: { token, expiresAt }
 */
const tokenCache = new Map<
  string,
  {
    token: string
    expiresAt: Date
  }
>()

/**
 * Fetches an installation access token for a specific installation
 * Tokens are cached in-memory and refreshed 5 minutes before expiry
 *
 * @param installationId - GitHub installation ID
 * @returns Installation access token
 * @throws Error if API call fails
 */
export async function getInstallationToken(
  installationId: string
): Promise<string> {
  // Check cache first
  const cached = tokenCache.get(installationId)
  if (cached) {
    // Refresh if less than 5 minutes remaining
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)
    if (cached.expiresAt > fiveMinutesFromNow) {
      return cached.token
    }
  }

  // Generate app JWT
  const jwt = generateAppJWT()

  // Fetch installation token
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${jwt}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  )

  if (!response.ok) {
    throw new Error(
      `Failed to get installation token: ${response.status} ${response.statusText}`
    )
  }

  const data = (await response.json()) as {
    token: string
    expires_at: string
  }

  // Cache token
  tokenCache.set(installationId, {
    token: data.token,
    expiresAt: new Date(data.expires_at),
  })

  return data.token
}

/**
 * Clears the token cache (useful for testing)
 */
export function clearTokenCache(): void {
  tokenCache.clear()
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/github-app-auth.test.ts`
Expected: PASS

**Step 5: Clean up test side effects**

In `src/lib/github-app-auth.test.ts`, add cleanup:

```typescript
import { clearTokenCache } from './github-app-auth'

describe('Installation Token Management', () => {
  afterEach(() => {
    clearTokenCache()
    vi.restoreAllMocks()
  })

  // ... existing tests
})
```

**Step 6: Commit**

```bash
git add src/lib/github-app-auth.ts src/lib/github-app-auth.test.ts
git commit -m "feat(auth): add installation token management with caching

- Fetch installation tokens from GitHub API
- Cache tokens in-memory with 5-minute refresh buffer
- Auto-refresh expired tokens
- Complete test coverage including error handling

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: OAuth Callback Endpoint for Installation Flow

**Files:**
- Create: `src/app/api/github/app/callback/route.ts`
- Create: `src/app/api/github/app/callback/route.test.ts`

**Step 1: Write failing test for callback endpoint**

Create: `src/app/api/github/app/callback/route.test.ts`

```typescript
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { GET } from './route'

// Mock database
vi.mock('@/db/client', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue([
          {
            id: 'test-id',
            installationId: '12345',
            accountLogin: 'recallnet',
          },
        ]),
      }),
    }),
  },
}))

describe('/api/github/app/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should handle successful installation', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        installations: [
          {
            id: 12345,
            account: {
              id: 67890,
              login: 'recallnet',
              type: 'Organization',
            },
          },
        ],
      }),
    })
    global.fetch = mockFetch

    const request = new Request(
      'http://localhost:3000/api/github/app/callback?installation_id=12345&setup_action=install'
    )

    const response = await GET(request)

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/admin/github/setup?success=true')
  })

  test('should handle missing installation_id', async () => {
    const request = new Request(
      'http://localhost:3000/api/github/app/callback?setup_action=install'
    )

    const response = await GET(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Missing installation_id')
  })

  test('should handle API errors gracefully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    })
    global.fetch = mockFetch

    const request = new Request(
      'http://localhost:3000/api/github/app/callback?installation_id=12345&setup_action=install'
    )

    const response = await GET(request)

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toContain('error=')
  })

  test('should mark installation as suspended on suspend action', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        installations: [
          {
            id: 12345,
            account: {
              id: 67890,
              login: 'recallnet',
              type: 'Organization',
            },
            suspended_at: '2024-01-01T00:00:00Z',
          },
        ],
      }),
    })
    global.fetch = mockFetch

    const request = new Request(
      'http://localhost:3000/api/github/app/callback?installation_id=12345&setup_action=suspend'
    )

    const response = await GET(request)

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/admin/github/setup?suspended=true')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/github/app/callback/route.test.ts`
Expected: FAIL with "Cannot find module './route'"

**Step 3: Implement OAuth callback endpoint**

Create: `src/app/api/github/app/callback/route.ts`

```typescript
/**
 * GitHub App OAuth callback endpoint
 * Handles installation, update, and suspend actions
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { githubAppInstallations } from '@/db/schema'
import { generateAppJWT } from '@/lib/github-app-auth'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams
  const installationId = searchParams.get('installation_id')
  const setupAction = searchParams.get('setup_action') // 'install' | 'update' | 'suspend'

  if (!installationId) {
    return NextResponse.json(
      { error: 'Missing installation_id' },
      { status: 400 }
    )
  }

  try {
    // Fetch installation details from GitHub
    const jwt = generateAppJWT()
    const response = await fetch(
      `https://api.github.com/user/installations/${installationId}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${jwt}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    )

    if (!response.ok) {
      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText}`
      )
    }

    const data = (await response.json()) as {
      installations: Array<{
        id: number
        account: {
          id: number
          login: string
          type: string
        }
        suspended_at?: string
      }>
    }

    const installation = data.installations[0]
    if (!installation) {
      throw new Error('Installation not found in response')
    }

    // Upsert installation to database
    const isSuspended = setupAction === 'suspend' || !!installation.suspended_at
    await db
      .insert(githubAppInstallations)
      .values({
        installationId: installation.id.toString(),
        accountId: installation.account.id.toString(),
        accountLogin: installation.account.login,
        accountType: installation.account.type,
        isActive: !isSuspended,
        suspendedAt: isSuspended ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: [githubAppInstallations.installationId],
        set: {
          accountId: installation.account.id.toString(),
          accountLogin: installation.account.login,
          accountType: installation.account.type,
          isActive: !isSuspended,
          suspendedAt: isSuspended ? new Date() : null,
          updatedAt: new Date(),
        },
      })

    // Redirect to setup page with success
    const redirectUrl = new URL('/admin/github/setup', request.url)
    if (isSuspended) {
      redirectUrl.searchParams.set('suspended', 'true')
    } else {
      redirectUrl.searchParams.set('success', 'true')
    }

    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error('GitHub App callback error:', error)

    // Redirect to setup page with error
    const redirectUrl = new URL('/admin/github/setup', request.url)
    redirectUrl.searchParams.set(
      'error',
      error instanceof Error ? error.message : 'Unknown error'
    )

    return NextResponse.redirect(redirectUrl)
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/github/app/callback/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/github/app/callback/route.ts src/app/api/github/app/callback/route.test.ts
git commit -m "feat(api): add GitHub App OAuth callback endpoint

- Handle install, update, and suspend actions
- Fetch installation details from GitHub API
- Store installations in database with active status
- Redirect to setup page with status messages

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Admin UI for GitHub App Connection

**Files:**
- Create: `src/app/admin/github/setup/page.tsx`
- Create: `src/app/admin/github/setup/page.test.tsx`

**Step 1: Write failing test for setup page**

Create: `src/app/admin/github/setup/page.test.tsx`

```typescript
import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import GitHubSetupPage from './page'

describe('GitHub Setup Page', () => {
  test('should render installation button', () => {
    render(<GitHubSetupPage />)

    expect(
      screen.getByText(/Connect GitHub Organization/i)
    ).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('github.com/apps/')
    )
  })

  test('should display success message from URL param', () => {
    // Mock URL searchParams
    vi.mock('next/navigation', () => ({
      useSearchParams: () =>
        new URLSearchParams('success=true'),
    }))

    render(<GitHubSetupPage />)

    expect(
      screen.getByText(/Successfully connected/i)
    ).toBeInTheDocument()
  })

  test('should display error message from URL param', () => {
    vi.mock('next/navigation', () => ({
      useSearchParams: () =>
        new URLSearchParams('error=API%20connection%20failed'),
    }))

    render(<GitHubSetupPage />)

    expect(
      screen.getByText(/Error: API connection failed/i)
    ).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/admin/github/setup/page.test.tsx`
Expected: FAIL with "Cannot find module './page'"

**Step 3: Implement GitHub setup page**

Create: `src/app/admin/github/setup/page.tsx`

```typescript
'use client'

import { useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default function GitHubSetupPage() {
  const searchParams = useSearchParams()
  const success = searchParams?.get('success')
  const error = searchParams?.get('error')
  const suspended = searchParams?.get('suspended')

  const appId = process.env['NEXT_PUBLIC_GITHUB_APP_ID'] || '2287430'
  const installUrl = `https://github.com/apps/air-coding-arena/installations/new`

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">GitHub App Setup</h1>

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
          Successfully connected to GitHub! Your organization can now receive webhooks and the app can access repositories.
        </div>
      )}

      {suspended && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6">
          GitHub App installation suspended. Please reinstall to restore access.
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          Error: {decodeURIComponent(error)}
        </div>
      )}

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Connect GitHub Organization</h2>
        <p className="text-gray-600 mb-6">
          Install the Air Coding Arena GitHub App to enable:
        </p>
        <ul className="list-disc list-inside text-gray-600 mb-6 space-y-2">
          <li>Automatic webhook registration for PR events</li>
          <li>Secure, short-lived API tokens (1-hour expiry)</li>
          <li>Organization-level permissions (survives user changes)</li>
          <li>3x better rate limits (15,000 requests/hour)</li>
        </ul>

        <Button asChild>
          <a
            href={installUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Install GitHub App
          </a>
        </Button>

        <p className="text-sm text-gray-500 mt-4">
          After installation, you'll be redirected back here to confirm the connection.
        </p>
      </Card>

      <Card className="p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">Current Status</h2>
        <div className="text-gray-600">
          {/* TODO: Fetch and display current installations from database */}
          <p>No installations configured yet.</p>
        </div>
      </Card>
    </div>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/app/admin/github/setup/page.test.tsx`
Expected: PASS

**Step 5: Add NEXT_PUBLIC_GITHUB_APP_ID to .env.local**

In `.env.local`, add:

```bash
# GitHub App Configuration
NEXT_PUBLIC_GITHUB_APP_ID=2287430
GITHUB_APP_ID=2287430
GITHUB_APP_PRIVATE_KEY="TEST_PRIVATE_KEY_REMOVED"
```

**Step 6: Commit**

```bash
git add src/app/admin/github/setup/page.tsx src/app/admin/github/setup/page.test.tsx .env.local
git commit -m "feat(ui): add GitHub App setup page

- Installation button with GitHub App link
- Success/error/suspended status messages
- Benefits list for admins
- TODO: Display current installations

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Migrate GitHub Webhook to Use Installation Tokens

**Files:**
- Modify: `src/app/api/github/webhook/route.ts`
- Modify: `src/app/api/github/webhook/route.test.ts`

**Step 1: Write failing test for installation token usage**

In `src/app/api/github/webhook/route.test.ts`, add new test:

```typescript
test('should use installation token instead of PAT for API calls', async () => {
  // Mock installation in database
  vi.mock('@/db/client', () => ({
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                installationId: '12345',
              },
            ]),
          }),
        }),
      }),
      // ... other db mocks
    },
  }))

  // Mock getInstallationToken
  vi.mock('@/lib/github-app-auth', () => ({
    getInstallationToken: vi.fn().mockResolvedValue('ghs_installation_token'),
  }))

  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [{ sha: 'abc123' }, { sha: 'def456' }, { sha: 'ghi789' }],
  })
  global.fetch = mockFetch

  const payload = {
    action: 'synchronize',
    number: 1559,
    pull_request: {
      number: 1559,
      head: { repo: { full_name: 'recallnet/js-recall' } },
    },
    repository: { full_name: 'recallnet/js-recall' },
  }

  const response = await POST(
    createMockRequest(payload, 'pull_request')
  )

  expect(response.status).toBe(200)

  // Verify fetch used installation token, not PAT
  expect(mockFetch).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer ghs_installation_token',
      }),
    })
  )
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/github/webhook/route.test.ts`
Expected: FAIL - test should fail because webhook still uses GITHUB_TOKEN

**Step 3: Modify webhook to use installation tokens**

In `src/app/api/github/webhook/route.ts`, find the function that fetches commit count (around line 75) and replace:

```typescript
// OLD CODE (remove):
const token = process.env['GITHUB_TOKEN']
if (!token) {
  console.error('GITHUB_TOKEN not configured')
  return
}

// Fetch commit count
const response = await fetch(
  `https://api.github.com/repos/${repo}/pulls/${prNumber}/commits`,
  {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  }
)

// NEW CODE (add):
import { getInstallationToken } from '@/lib/github-app-auth'
import { githubAppInstallations } from '@/db/schema'
import { eq } from 'drizzle-orm'

// Extract org from repo (e.g., "recallnet/js-recall" -> "recallnet")
const [org] = repo.split('/')
if (!org) {
  console.error('Invalid repo format:', repo)
  return
}

// Look up installation for this org
const installation = await db
  .select()
  .from(githubAppInstallations)
  .where(eq(githubAppInstallations.accountLogin, org))
  .limit(1)

if (!installation[0]) {
  console.error(`No GitHub App installation found for org: ${org}`)
  // Fallback to PAT if configured
  const token = process.env['GITHUB_TOKEN']
  if (!token) {
    console.error('GITHUB_TOKEN not configured either')
    return
  }
  // Continue with PAT...
} else {
  // Get installation token
  const token = await getInstallationToken(installation[0].installationId)

  // Fetch commit count
  const response = await fetch(
    `https://api.github.com/repos/${repo}/pulls/${prNumber}/commits`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  )
  // ... rest of code
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/github/webhook/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/github/webhook/route.ts src/app/api/github/webhook/route.test.ts
git commit -m "feat(webhook): migrate to GitHub App installation tokens

- Look up installation by org name
- Use short-lived installation tokens instead of PAT
- Fallback to GITHUB_TOKEN if no installation found
- Update tests to verify token usage

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Documentation and Environment Setup

**Files:**
- Create: `docs/github-app-setup.md`
- Modify: `.env.example` (if exists)

**Step 1: Create setup documentation**

Create: `docs/github-app-setup.md`

```markdown
# GitHub App Setup Guide

## Overview

The Air Coding Arena uses a GitHub App for authentication instead of Personal Access Tokens (PATs). This provides:

- **Security**: Short-lived tokens (1 hour) instead of perpetual PATs
- **Scalability**: Works across multiple organizations
- **Reliability**: Organization-level installation survives user changes
- **Performance**: 3x better rate limits (15,000 vs 5,000 requests/hour)

## Prerequisites

1. GitHub organization with admin access
2. Deployed Next.js application with public URL

## Creating the GitHub App

### 1. Register the App

Visit: https://github.com/organizations/YOUR_ORG/settings/apps/new

### 2. Configure Settings

**GitHub App name:** `air-coding-arena` (or your preferred name)

**Homepage URL:** `https://your-domain.com`

**Callback URL:**
```
https://your-domain.com/api/github/app/callback
```

**Setup URL (optional):**
```
https://your-domain.com/admin/github/setup
```

**Webhook:**
- ✅ Active
- **Webhook URL:** `https://your-domain.com/api/github/webhook`
- **Webhook secret:** Generate with `openssl rand -hex 32`

**Permissions:**
- **Repository permissions:**
  - Contents: Read-only
  - Pull requests: Read & Write
  - Metadata: Read-only (auto-included)

**Subscribe to events:**
- ✅ Pull request
- ✅ Check suite

**Where can this GitHub App be installed?**
- ◉ Only on this account (for production, can enable "Any account" later)

### 3. Generate Private Key

After creating the app:

1. Scroll to bottom of app settings page
2. Click "Generate a private key"
3. Save the downloaded `.pem` file securely
4. Note the **App ID** from the top of the settings page

## Environment Configuration

Add these to your `.env.local`:

```bash
# GitHub App Configuration
GITHUB_APP_ID=<your-app-id>
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
<your-private-key-contents-with-\n-for-newlines>
-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=<your-webhook-secret>

# For client-side (optional, for UI)
NEXT_PUBLIC_GITHUB_APP_ID=<your-app-id>
```

**Important:** The private key must have literal `\n` characters for newlines, not actual newlines.

## Installation

### Admin Installation

1. Navigate to `/admin/github/setup` in your application
2. Click "Install GitHub App"
3. Select which repositories to grant access
4. Confirm installation
5. You'll be redirected back with a success message

### Programmatic Installation

Installation data is automatically stored in the `github_app_installations` table:

```sql
SELECT * FROM github_app_installations;
```

## Verification

### Check Installation Status

```bash
curl -X GET https://api.github.com/app/installations \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Accept: application/vnd.github+json"
```

### Test Webhook

1. Create a test PR in an installed repository
2. Check application logs for webhook events
3. Verify commit count is fetched successfully

### Test Installation Token

```typescript
import { getInstallationToken } from '@/lib/github-app-auth'

const token = await getInstallationToken('12345')
console.log('Token:', token.substring(0, 10) + '...')
```

## Troubleshooting

### "No GitHub App installation found for org"

**Cause:** App not installed for the organization containing the repository

**Solution:** Install the app via `/admin/github/setup`

### "Failed to get installation token: 403 Forbidden"

**Cause:** Invalid private key or App ID

**Solution:**
1. Verify `GITHUB_APP_ID` matches your app
2. Regenerate private key and update `.env.local`
3. Ensure newlines are escaped as `\n`

### "JWT expired"

**Cause:** System clock skew

**Solution:** Sync system time with NTP server

### Webhook Not Receiving Events

**Cause:** Webhook secret mismatch or incorrect URL

**Solution:**
1. Verify `GITHUB_WEBHOOK_SECRET` matches GitHub App settings
2. Ensure webhook URL is publicly accessible
3. Check webhook delivery logs in GitHub App settings

## Migration from PAT

If you're migrating from `GITHUB_TOKEN` (PAT):

1. Install GitHub App for your organization
2. Verify webhooks work with installation tokens
3. Remove `GITHUB_TOKEN` from `.env.local` (optional - kept as fallback)
4. Monitor logs for any "falling back to PAT" messages

## Rate Limits

Check your current rate limit:

```bash
curl -X GET https://api.github.com/rate_limit \
  -H "Authorization: Bearer <installation-token>"
```

**Expected limits:**
- **PAT:** 5,000 requests/hour
- **GitHub App:** 15,000 requests/hour

## Security Best Practices

1. **Private Key Storage:**
   - Never commit `.pem` files to git
   - Store in environment variables only
   - Rotate keys periodically

2. **Webhook Secret:**
   - Use cryptographically random secrets
   - Rotate if compromised
   - Never log the secret value

3. **Permissions:**
   - Grant minimum required permissions
   - Review permission requests periodically
   - Use read-only when write access not needed

## Support

For issues with GitHub App setup:

1. Check GitHub App installation logs: `https://github.com/settings/installations`
2. Review webhook delivery logs in app settings
3. Check application server logs for authentication errors
4. Verify environment variables are set correctly
```

**Step 2: Update .env.example**

Create or modify `.env.example`:

```bash
# GitHub App Configuration
GITHUB_APP_ID=your_app_id_here
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nyour_private_key_here\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# Optional: For client-side UI
NEXT_PUBLIC_GITHUB_APP_ID=your_app_id_here

# Legacy (optional, used as fallback)
GITHUB_TOKEN=ghp_your_personal_access_token_here
```

**Step 3: Commit**

```bash
git add docs/github-app-setup.md .env.example
git commit -m "docs: add comprehensive GitHub App setup guide

- Step-by-step app creation instructions
- Environment configuration examples
- Installation and verification steps
- Troubleshooting common issues
- Security best practices
- Migration guide from PAT

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: End-to-End Testing

**Files:**
- Create: `src/lib/github-app-integration.test.ts`

**Step 1: Write integration test**

Create: `src/lib/github-app-integration.test.ts`

```typescript
import { describe, test, expect, beforeAll } from 'vitest'
import { db } from '@/db/client'
import { githubAppInstallations } from '@/db/schema'
import { generateAppJWT, getInstallationToken } from './github-app-auth'
import { eq } from 'drizzle-orm'

describe('GitHub App Integration', () => {
  const testInstallationId = '12345'
  const testOrg = 'test-org'

  beforeAll(async () => {
    // Set up test environment
    process.env.GITHUB_APP_ID = '2287430'
    process.env.GITHUB_APP_PRIVATE_KEY = `TEST_PRIVATE_KEY_REMOVED`

    // Insert test installation
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

  test('should fetch installation from database', async () => {
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

  test('should use installation token for webhook API calls', async () => {
    // This test requires actual GitHub API access
    // Skip in CI, run manually during verification
    test.skip()
  })
})
```

**Step 2: Run integration test**

Run: `npm test -- src/lib/github-app-integration.test.ts`
Expected: PASS (skip GitHub API test)

**Step 3: Manual verification checklist**

Create verification checklist in terminal:

```bash
echo "GitHub App Migration Verification Checklist:"
echo ""
echo "☐ 1. Visit /admin/github/setup and install the app"
echo "☐ 2. Verify installation appears in database:"
echo "    SELECT * FROM github_app_installations;"
echo "☐ 3. Create a test PR in an installed repo"
echo "☐ 4. Verify webhook receives event and uses installation token"
echo "☐ 5. Check commit count is fetched successfully"
echo "☐ 6. Verify no GITHUB_TOKEN fallback messages in logs"
echo "☐ 7. Test token caching (should only call API once per hour)"
echo "☐ 8. Suspend app and verify suspended status in UI"
echo "☐ 9. Reinstall app and verify active status restored"
echo "☐ 10. Check rate limits match 15,000/hour (not 5,000/hour)"
```

**Step 4: Commit**

```bash
git add src/lib/github-app-integration.test.ts
git commit -m "test: add GitHub App integration tests

- JWT generation validation
- Database installation lookup
- End-to-end flow skeleton
- Manual verification checklist

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Verification & Acceptance Criteria

### Automated Tests
- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ Type coverage maintained at 99.9%+
- ✅ Test coverage ≥90% for new code

### Manual Verification
1. **Installation Flow**
   - Navigate to `/admin/github/setup`
   - Click "Install GitHub App"
   - Complete OAuth flow
   - Verify redirect back with success message
   - Confirm installation in database

2. **Webhook Functionality**
   - Create test PR in installed repository
   - Verify webhook event logged
   - Check commit count fetched using installation token
   - Confirm no "GITHUB_TOKEN" fallback messages

3. **Token Management**
   - Verify tokens cached (check logs - should only call API once)
   - Wait 5 minutes, trigger another webhook
   - Confirm cached token used
   - Wait 1 hour, trigger webhook
   - Confirm token refreshed

4. **Error Handling**
   - Trigger webhook for non-installed org
   - Verify graceful fallback to GITHUB_TOKEN if configured
   - Suspend app installation
   - Verify suspended status shown in UI
   - Reinstall and verify active status

### Performance
- Installation token fetch < 500ms
- Cached token lookup < 5ms
- No increased latency on webhook processing

### Security
- Private key never logged
- Webhook secret verified on all requests
- Installation tokens expire after 1 hour
- No PAT tokens logged in production

---

## Execution Plan Complete

Plan saved to: `docs/plans/2025-11-13-github-app-migration.md`

**Two execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration with quality gates

2. **Parallel Session (separate)** - Open new session in this worktree with the executing-plans skill, batch execution with checkpoints

**Which approach would you prefer?**
