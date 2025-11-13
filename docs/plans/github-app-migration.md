# GitHub App Migration Plan

## Executive Summary

Migrate from manual GitHub Personal Access Token (PAT) setup to a **GitHub App** with automatic webhook management and one-click installation.

**Recommendation**: **GitHub App** (not OAuth App) for superior security, automatic webhook management, and 3x better rate limits.

**Feasibility**: HIGH - Well-documented path with clear API support
**Effort**: 46-67 hours total
**Complexity**: MEDIUM - Straightforward implementation
**Timeline**: 2-3 weeks part-time, or 1-2 weeks full-time

### Why GitHub App?

| Feature | Current (PAT) | GitHub App |
|---------|---------------|------------|
| Token Lifetime | Perpetual | 1 hour (auto-refresh) |
| Security Risk | High | Low |
| Webhooks | Manual per repo | **Automatic** |
| Rate Limits | 5,000/hour | **15,000/hour** (3x) |
| Multi-Org | Separate PAT per org | **Single app, multiple installations** |
| User Dependency | Breaks if user leaves | **Org-level, survives user changes** |
| Setup | Copy/paste token | **One-click install** |
| Productization | Not suitable | **Marketplace ready** |

---

## Current State

### GitHub Token Usage

**Single location**: `src/app/api/github/webhook/route.ts:75`

**Purpose**: Fetch commit count from GitHub API
```typescript
const token = process.env['GITHUB_TOKEN']
const response = await fetch(
  `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/commits`,
  {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  }
)
```

**Operations**:
- Read pull request commit list (read-only)
- Count commits for tracking attempts
- Store commit count in database

**Required Permissions**:
- Pull requests: Read
- Contents: Read

### Webhook Secret Usage

**Single location**: `src/app/api/github/webhook/route.ts:50`

**Purpose**: Verify webhook signatures
```typescript
const secret = process.env['GITHUB_WEBHOOK_SECRET']
const hmac = crypto.createHmac('sha256', secret)
const digest = 'sha256=' + hmac.update(payload).digest('hex')
```

### Current Webhook Events

**Endpoint**: `/api/github/webhook`

**Events processed**:
1. `pull_request.synchronize` - New commits pushed
2. `pull_request.closed` - PR merged/closed
3. `check_suite.completed` - CI status changes

**Current setup** (manual):
- Admin creates webhook in GitHub UI per repository
- Sets URL, secret, and events manually
- Error-prone and time-consuming

---

## GitHub App Architecture

### Why GitHub App vs OAuth App?

**GitHub App advantages**:
1. ✅ **Automatic webhook registration** - No manual setup per repo
2. ✅ **3x better rate limits** - 15,000 vs 5,000 requests/hour
3. ✅ **Short-lived tokens** - 1-hour expiry reduces risk
4. ✅ **Fine-grained permissions** - Read-only for commits
5. ✅ **Org-level installation** - Survives user changes
6. ✅ **Multi-org ready** - Each installation isolated
7. ✅ **Marketplace eligible** - Public distribution ready

**OAuth App disadvantages**:
- No automatic webhooks (still manual setup)
- Same rate limits as PAT (5,000/hour)
- Broad user-level permissions
- Tied to individual users

**Decision**: GitHub App is clearly superior for our use case.

### Required Permissions

Based on our operations:

| Permission | Access | Why |
|------------|--------|-----|
| Pull requests | Read | Read PR metadata and commits |
| Checks | Read | Receive check_suite events |
| Metadata | Read | Auto-required |

**Webhook events to subscribe**:
- `pull_request` (synchronize, closed)
- `check_suite` (completed)

**Why read-only is sufficient**: We only fetch data, never write comments or modify PRs.

---

## Database Schema

### New Tables

#### github_app_installations
Stores app installation metadata per organization/user:

```typescript
{
  id: uuid (primary key)
  installationId: bigint (unique) // GitHub's installation ID
  accountId: bigint              // GitHub account/org ID
  accountLogin: text             // Account/org name (e.g., "recallnet")
  accountType: text              // "User" or "Organization"
  repositorySelection: text      // "all" or "selected"
  permissions: jsonb             // Granted permissions
  events: jsonb                  // Subscribed events
  suspendedAt: timestamp         // If installation suspended
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### github_app_webhooks (optional tracking)
Tracks webhook configuration per installation:

```typescript
{
  id: uuid (primary key)
  installationId: uuid (foreign key)
  webhookId: bigint              // GitHub webhook ID
  active: boolean
  events: jsonb
  createdAt: timestamp
  updatedAt: timestamp
}
```

---

## Implementation Plan

### Phase 1: Database Schema (4-6 hours)

**Tasks**:
- [ ] Define Drizzle schema for `github_app_installations`
- [ ] Define Drizzle schema for `github_app_webhooks` (optional)
- [ ] Generate migration file
- [ ] Test migration locally
- [ ] Add indexes (installationId, accountLogin)
- [ ] Deploy to staging

**Acceptance Criteria**:
- [ ] Tables created successfully
- [ ] Can insert/query test data
- [ ] Foreign keys work correctly
- [ ] Migration reversible

---

### Phase 2: GitHub App Registration (2-3 hours)

**Steps**:
1. Navigate to: `https://github.com/organizations/recallnet/settings/apps/new`
2. Configure app:
   - **Name**: Air Coding Arena
   - **Homepage URL**: `https://coding-arena.vercel.app`
   - **Callback URL**: `https://coding-arena.vercel.app/api/github/app/callback`
   - **Webhook URL**: `https://coding-arena.vercel.app/api/github/webhook`
   - **Webhook Secret**: Generate with `openssl rand -hex 32`

3. Set Permissions:
   - Pull requests: Read-only
   - Checks: Read-only
   - Metadata: Read-only (auto)

4. Subscribe to Events:
   - pull_request
   - check_suite

5. Get credentials:
   - App ID
   - Client ID
   - Client Secret
   - Private Key (download .pem)

**Environment Variables**:
```bash
GITHUB_APP_ID=123456
GITHUB_APP_CLIENT_ID=Iv1.abc123def456
GITHUB_APP_CLIENT_SECRET=secret_here
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GITHUB_APP_WEBHOOK_SECRET=webhook_secret_here
```

**Acceptance Criteria**:
- [ ] App registered in GitHub
- [ ] Permissions configured correctly
- [ ] Webhook URL set
- [ ] Credentials saved securely

---

### Phase 3: Installation Flow (12-16 hours)

#### Task 3.1: JWT Generation Library

Create `src/lib/github-app-auth.ts`:

**Core functions needed**:
1. `generateAppJWT()` - Generate JWT for app authentication
2. `getInstallationAccessToken(installationId)` - Exchange for installation token
3. `getCachedInstallationToken(installationId)` - Get/refresh cached token
4. `getInstallationTokenForRepo(repoFullName)` - Helper for repo-specific token

**Key implementation details**:
- JWT expires in 10 minutes (max allowed)
- Installation tokens expire in 1 hour
- Cache tokens in memory with 50-minute TTL
- Refresh 10 minutes before expiry
- Use `jsonwebtoken` library for JWT signing

**Dependencies to add**:
```bash
npm install jsonwebtoken
npm install -D @types/jsonwebtoken
```

#### Task 3.2: API Routes

**Create 4 new routes**:

1. `/api/github/app/install` (GET)
   - Generate GitHub installation URL
   - Redirect to GitHub authorization page

2. `/api/github/app/callback` (GET)
   - Handle installation callback from GitHub
   - Extract `installation_id` and `setup_action`
   - Fetch installation details via GitHub API
   - Store in database
   - Redirect to admin UI

3. `/api/github/app/uninstall` (POST)
   - Remove installation from database
   - Return success response

4. `/api/github/app/status` (GET)
   - Check if app installed
   - Return installation details
   - List connected repositories

**Acceptance Criteria**:
- [ ] Installation flow works end-to-end
- [ ] Installation details stored correctly
- [ ] Can retrieve installation tokens
- [ ] Token refresh works automatically
- [ ] Uninstallation cleanup successful

---

### Phase 4: Code Migration (8-12 hours)

#### Task 4.1: Update Webhook Handler

**File**: `src/app/api/github/webhook/route.ts`

**Changes needed**:

**Before**:
```typescript
const token = process.env['GITHUB_TOKEN']
```

**After**:
```typescript
import { getInstallationTokenForRepo } from '@/lib/github-app-auth'

const token = await getInstallationTokenForRepo(repo)
```

**New helper function** (in github-app-auth.ts):
```typescript
export async function getInstallationTokenForRepo(
  repoFullName: string
): Promise<string> {
  const [owner] = repoFullName.split('/')

  const installations = await db
    .select()
    .from(githubAppInstallations)
    .where(eq(githubAppInstallations.accountLogin, owner))
    .limit(1)

  if (installations.length === 0) {
    throw new Error(`GitHub App not installed for ${owner}`)
  }

  return await getCachedInstallationToken(installations[0].installationId)
}
```

#### Task 4.2: Backward Compatibility (Optional)

**Dual-mode support** during transition:
```typescript
async function getGitHubToken(repo: string): Promise<string> {
  try {
    return await getInstallationTokenForRepo(repo)
  } catch {
    const pat = process.env['GITHUB_TOKEN']
    if (pat) {
      console.warn('Using PAT fallback. Migrate to GitHub App.')
      return pat
    }
    throw new Error('No GitHub authentication configured')
  }
}
```

**Acceptance Criteria**:
- [ ] All GitHub API calls use installation tokens
- [ ] No direct PAT usage
- [ ] Token refresh automatic
- [ ] Error messages helpful
- [ ] Fallback works (optional)

---

### Phase 5: Admin UI (8-12 hours)

#### Task 5.1: Connection Management Page

**New page**: `/app/admin/github/page.tsx`

**UI Components**:

**Disconnected View**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Install GitHub App</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Install the Air Coding Arena GitHub App to enable automatic PR tracking.</p>

    <div className="bg-muted p-4 rounded-lg mt-4">
      <h3 className="font-medium mb-2">What you get:</h3>
      <ul className="list-disc list-inside space-y-1 text-sm">
        <li>Automatic webhook setup (no manual configuration)</li>
        <li>Real-time PR tracking across repositories</li>
        <li>Secure, short-lived tokens (1-hour expiry)</li>
        <li>3x better rate limits (15,000 requests/hour)</li>
      </ul>
    </div>

    <Button
      className="mt-4"
      onClick={() => window.location.href = '/api/github/app/install'}
    >
      Install GitHub App
    </Button>
  </CardContent>
</Card>
```

**Connected View**:
```tsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <CheckCircle className="text-green-500" />
      GitHub App Installed
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <div>
      <label className="text-sm text-muted-foreground">Account</label>
      <p className="font-medium">{status.accountLogin}</p>
      <p className="text-sm text-muted-foreground">{status.accountType}</p>
    </div>

    <div>
      <label className="text-sm text-muted-foreground">Repositories</label>
      <p>{status.repositorySelection === 'all'
        ? 'All repositories (current and future)'
        : 'Selected repositories'}
      </p>
      {status.repositories && (
        <ul className="list-disc list-inside mt-2 text-sm">
          {status.repositories.map(repo => (
            <li key={repo}>{repo}</li>
          ))}
        </ul>
      )}
    </div>

    <div>
      <label className="text-sm text-muted-foreground">Webhooks</label>
      <p className="flex items-center gap-2 text-sm">
        <CheckCircle className="text-green-500" size={16} />
        Automatic (no manual setup required)
      </p>
    </div>

    <div>
      <label className="text-sm text-muted-foreground">Token Status</label>
      <p className="flex items-center gap-2 text-sm">
        <CheckCircle className="text-green-500" size={16} />
        Auto-refreshing (1-hour expiry)
      </p>
    </div>

    <Button variant="destructive" onClick={handleUninstall}>
      Uninstall App
    </Button>
  </CardContent>
</Card>
```

**Acceptance Criteria**:
- [ ] Shows installation status
- [ ] Install button redirects to GitHub
- [ ] Connected view shows repositories
- [ ] Uninstall button works
- [ ] Loading states implemented
- [ ] Error handling with clear messages

---

### Phase 6: Testing (8-12 hours)

#### Unit Tests

**Test files to create**:
- [ ] `src/lib/github-app-auth.test.ts`
  - JWT generation
  - Token retrieval
  - Token caching
  - Token expiry handling

**Test scenarios**:
- [ ] JWT generation with valid private key
- [ ] JWT generation with invalid key (error)
- [ ] Installation token fetch success
- [ ] Installation token fetch failure
- [ ] Token cache hit
- [ ] Token cache miss
- [ ] Token refresh on expiry
- [ ] Installation lookup by repo

#### Integration Tests

**Test flows**:
- [ ] Complete installation flow
- [ ] Callback handler with valid installation_id
- [ ] Callback handler with invalid installation_id
- [ ] Token generation and API call
- [ ] Token expiry and refresh
- [ ] Webhook processing with installation context
- [ ] Uninstallation cleanup

#### Manual Testing

**Checklist**:
- [ ] Install app on test repository
- [ ] Verify installation stored in database
- [ ] Check webhook events arrive at endpoint
- [ ] Test PR synchronize event processing
- [ ] Test PR closed event processing
- [ ] Test check_suite completed event processing
- [ ] Verify commit counts fetched correctly
- [ ] Wait for token expiry (or force expire)
- [ ] Test automatic token refresh
- [ ] Uninstall app
- [ ] Verify database cleanup

---

### Phase 7: Deployment (4-6 hours)

#### Task 7.1: Production App Registration

**Steps**:
- [ ] Register GitHub App in production
- [ ] Configure production callback URL
- [ ] Configure production webhook URL
- [ ] Download production private key
- [ ] Generate production webhook secret

#### Task 7.2: Environment Configuration

**Add to Vercel**:
```bash
GITHUB_APP_ID=...
GITHUB_APP_CLIENT_ID=...
GITHUB_APP_CLIENT_SECRET=...
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GITHUB_APP_WEBHOOK_SECRET=...

# Keep during transition
GITHUB_TOKEN=...
```

**Update `.env.example`**:
```bash
# GitHub App (recommended)
GITHUB_APP_ID=
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
GITHUB_APP_PRIVATE_KEY=
GITHUB_APP_WEBHOOK_SECRET=

# Legacy (remove after migration)
GITHUB_TOKEN=
GITHUB_WEBHOOK_SECRET=
```

#### Task 7.3: Deployment Steps

1. [ ] Deploy database migration to staging
2. [ ] Deploy code to staging
3. [ ] Test staging end-to-end
4. [ ] Deploy database migration to production
5. [ ] Deploy code to production
6. [ ] Navigate to `/admin/github`
7. [ ] Click "Install GitHub App"
8. [ ] Authorize installation
9. [ ] Select repositories
10. [ ] Verify webhooks working
11. [ ] Monitor logs for errors
12. [ ] Test PR tracking

#### Task 7.4: Stabilization Period

**Week 1-2 after deployment**:
- [ ] Monitor token generation success rate
- [ ] Monitor webhook delivery
- [ ] Monitor API call success rate
- [ ] Check for errors in logs
- [ ] Verify all features working

**After stable (Week 3+)**:
- [ ] Remove PAT fallback code (if implemented)
- [ ] Remove `GITHUB_TOKEN` env var
- [ ] Remove `GITHUB_WEBHOOK_SECRET` env var
- [ ] Update documentation
- [ ] Announce migration complete

---

## Technical Details

### JWT Generation

**Algorithm**: RS256 (RSA with SHA-256)
**Expiry**: 10 minutes (max allowed by GitHub)
**Claims**:
- `iat`: Issued at (60 seconds ago for clock skew)
- `exp`: Expires at (now + 10 minutes)
- `iss`: GitHub App ID

**Implementation**:
```typescript
import jwt from 'jsonwebtoken'

const payload = {
  iat: Math.floor(Date.now() / 1000) - 60,
  exp: Math.floor(Date.now() / 1000) + 600,
  iss: process.env.GITHUB_APP_ID,
}

const privateKey = process.env.GITHUB_APP_PRIVATE_KEY
  .replace(/\\n/g, '\n') // Handle Vercel's literal \n

const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' })
```

### Installation Token Flow

```
App needs to call GitHub API
  ↓
Check in-memory cache for token
  ↓
If cached and not expiring soon (>10 min left)
  → Return cached token
  ↓
Generate JWT (10-minute expiry)
  ↓
POST /app/installations/{id}/access_tokens
  Authorization: Bearer {jwt}
  ↓
Receive installation token (1-hour expiry)
  ↓
Cache token with expiry time
  ↓
Return token to caller
```

### Token Cache Strategy

**In-memory Map**:
```typescript
const tokenCache = new Map<number, {
  token: string
  expiresAt: Date
}>()
```

**Benefits**:
- Fast lookups (no database)
- Automatic eviction on expiry
- Survives across requests (same process)

**Limitations**:
- Lost on deployment (regenerates quickly)
- Not shared across serverless functions (acceptable)

**Refresh Strategy**:
- Check expiry before returning cached token
- Refresh if less than 10 minutes remaining
- Prevents expiry mid-request

### Webhook Routing

**GitHub App webhooks include installation context**:
```json
{
  "action": "synchronize",
  "installation": {
    "id": 12345,
    "account": {
      "login": "recallnet",
      "type": "Organization"
    }
  },
  "repository": {
    "full_name": "recallnet/air-coding-arena"
  },
  "pull_request": { /* ... */ }
}
```

**Routing logic**:
```typescript
const installationId = payload.installation?.id

if (!installationId) {
  return NextResponse.json(
    { error: 'Not a GitHub App webhook' },
    { status: 400 }
  )
}

// Verify installation in database
const installation = await db
  .select()
  .from(githubAppInstallations)
  .where(eq(githubAppInstallations.installationId, installationId))
  .limit(1)

if (!installation[0]) {
  return NextResponse.json(
    { error: 'Installation not found' },
    { status: 404 }
  )
}

// Process webhook
```

---

## Security Considerations

### Private Key Protection

**Storage**:
- Store in Vercel environment variables (encrypted at rest)
- Never commit to git
- Never log in production

**Usage**:
- Only used server-side for JWT generation
- JWT expires in 10 minutes (limited exposure)
- Installation tokens expire in 1 hour

**Rotation**:
- GitHub allows generating new private keys
- Old keys remain valid for 10 minutes after rotation
- No downtime during rotation

### Token Security

**Installation Tokens**:
- Short-lived (1 hour)
- Scoped to specific installation
- Read-only permissions
- Automatically revoked on app uninstall

**Comparison to PAT**:
- PAT: Perpetual, all repos user has access to
- Installation token: 1 hour, specific repos only

### Webhook Security

**Signature Verification**:
- Required for all webhook events
- Uses HMAC-SHA256
- Secret stored in environment variables
- Timing-safe comparison

**No changes needed** - existing verification works with app secret.

---

## Monitoring & Alerts

### Metrics to Track

1. **Installation Health**:
   - Number of active installations
   - Installation creation rate
   - Uninstallation rate

2. **Token Management**:
   - JWT generation success rate
   - Installation token fetch success rate
   - Token cache hit rate
   - Token refresh failures

3. **API Usage**:
   - GitHub API call success rate
   - GitHub API errors (by type)
   - Rate limit usage
   - Response times

4. **Webhook Health**:
   - Webhook events received
   - Signature verification failures
   - Event processing errors
   - Processing latency

### Alerts to Configure

**Critical**:
- [ ] Installation token fetch failing (3+ failures)
- [ ] JWT generation failing
- [ ] Webhook signature verification failing (10+ in 5 min)

**Warning**:
- [ ] Token cache hit rate < 80%
- [ ] GitHub API error rate > 5%
- [ ] Rate limit approaching (> 80% used)

### Logging

**What to log**:
```typescript
// Installation events
console.log('[GitHub App] Installation created', { installationId, account })
console.log('[GitHub App] Installation removed', { installationId })

// Token events
console.log('[GitHub App] Token generated', { installationId, expiresAt })
console.log('[GitHub App] Token cache hit', { installationId })
console.error('[GitHub App] Token fetch failed', { installationId, error })

// Webhook events
console.log('[Webhook] Event received', { type, action, installationId })
console.error('[Webhook] Signature invalid', { installationId })

// API calls
console.log('[GitHub API] Request', { endpoint, installationId })
console.error('[GitHub API] Error', { endpoint, error })
```

---

## Rollback Plan

### Immediate Rollback (< 5 minutes)

**If critical issues**:
1. Revert to previous deployment
2. Re-enable PAT in environment variables
3. Notify team

**PAT still works** - no breaking changes to webhooks.

### Partial Rollback (Keep GitHub App, Fix Issues)

**If non-critical issues**:
1. Keep GitHub App live
2. Enable PAT fallback temporarily
3. Fix issues in next deployment
4. Remove fallback after stable

### Database Rollback

**If needed**:
```sql
DROP TABLE IF EXISTS github_app_webhooks CASCADE;
DROP TABLE IF EXISTS github_app_installations CASCADE;
```

**Note**: Additive migrations, no destructive changes.

---

## Migration Timeline

### 2-Week Timeline (Part-Time)

**Week 1**:
- Mon-Tue: Database schema and migration
- Wed-Thu: GitHub App registration and environment setup
- Fri: Installation flow (JWT, tokens)

**Week 2**:
- Mon: Installation flow (API routes)
- Tue: Code migration (webhook handler update)
- Wed: Admin UI
- Thu: Testing
- Fri: Deployment to staging

**Week 3**:
- Mon: Production deployment
- Tue-Fri: Monitoring and stabilization

### 1-Week Timeline (Full-Time)

**Day 1-2**: Database + Registration + Installation Flow
**Day 3**: Code Migration + Admin UI
**Day 4**: Testing
**Day 5**: Deployment + Monitoring

---

## Effort Summary

| Phase | Effort | Complexity |
|-------|--------|------------|
| Database Schema | 4-6 hours | Easy |
| GitHub App Registration | 2-3 hours | Easy |
| Installation Flow | 12-16 hours | Medium |
| Code Migration | 8-12 hours | Easy |
| Admin UI | 8-12 hours | Medium |
| Testing | 8-12 hours | Medium |
| Deployment | 4-6 hours | Easy |
| **Total** | **46-67 hours** | **Medium** |

**Parallelization opportunities**:
- Admin UI can be built while installation flow in progress
- Testing can start as components complete
- Documentation throughout

---

## Success Criteria

### Functional Requirements
- [ ] Admin can install GitHub App via one-click flow
- [ ] Installation automatically registers webhooks
- [ ] All GitHub API calls use installation tokens
- [ ] Tokens refresh automatically
- [ ] Admin can uninstall app
- [ ] Clear UI showing installation status

### Non-Functional Requirements
- [ ] Installation flow completes in < 30 seconds
- [ ] Token generation succeeds 99.9% of time
- [ ] Webhook delivery within 2 seconds
- [ ] Zero downtime during migration
- [ ] Backward compatible during transition

### Quality Gates
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Manual testing completed
- [ ] Test coverage > 90%
- [ ] Type coverage > 99.9%
- [ ] Zero ESLint warnings

---

## Future Enhancements

### Phase 2: Multi-Organization Support

After single-org stable:
- [ ] Support multiple org installations
- [ ] Org selector in admin UI
- [ ] Per-org webhook routing
- [ ] Per-org token management

### Phase 3: GitHub Marketplace

Requirements for listing:
- [ ] Public app (not private)
- [ ] Privacy policy
- [ ] Terms of service
- [ ] Support documentation
- [ ] App screenshots
- [ ] Verification

---

## References

1. **GitHub Docs: GitHub Apps vs OAuth Apps**
   https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps

2. **GitHub Docs: Authenticating with GitHub Apps**
   https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation

3. **GitHub Docs: Webhook Events**
   https://docs.github.com/en/webhooks/webhook-events-and-payloads

4. **GitHub Docs: Rate Limits**
   https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting

5. **jsonwebtoken Library**
   https://www.npmjs.com/package/jsonwebtoken

---

## Appendix: Complete Code Examples

### Complete JWT and Token Management

```typescript
// src/lib/github-app-auth.ts
import jwt from 'jsonwebtoken'
import { db } from '@/db/client'
import { githubAppInstallations } from '@/db/schema'
import { eq } from 'drizzle-orm'

export function generateAppJWT(): string {
  const privateKeyEncoded = process.env.GITHUB_APP_PRIVATE_KEY!
  const privateKey = privateKeyEncoded.replace(/\\n/g, '\n')
  const appId = process.env.GITHUB_APP_ID!

  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iat: now - 60, // Clock skew tolerance
    exp: now + 600, // 10 minutes
    iss: appId,
  }

  return jwt.sign(payload, privateKey, { algorithm: 'RS256' })
}

export async function getInstallationAccessToken(
  installationId: number
): Promise<{ token: string; expiresAt: Date }> {
  const jwtToken = generateAppJWT()

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get installation token: ${error}`)
  }

  const data = await response.json()

  return {
    token: data.token,
    expiresAt: new Date(data.expires_at),
  }
}

const tokenCache = new Map<number, { token: string; expiresAt: Date }>()

export async function getCachedInstallationToken(
  installationId: number
): Promise<string> {
  const cached = tokenCache.get(installationId)
  const now = new Date()

  if (cached && cached.expiresAt.getTime() > now.getTime() + 10 * 60 * 1000) {
    return cached.token
  }

  const { token, expiresAt } = await getInstallationAccessToken(installationId)
  tokenCache.set(installationId, { token, expiresAt })

  return token
}

export async function getInstallationTokenForRepo(
  repoFullName: string
): Promise<string> {
  const [owner] = repoFullName.split('/')

  const installations = await db
    .select()
    .from(githubAppInstallations)
    .where(eq(githubAppInstallations.accountLogin, owner))
    .limit(1)

  if (installations.length === 0) {
    throw new Error(
      `GitHub App not installed for ${owner}. ` +
      `Please install at /admin/github`
    )
  }

  const installation = installations[0]
  return await getCachedInstallationToken(installation.installationId)
}
```

### Installation Callback Handler

```typescript
// src/app/api/github/app/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { githubAppInstallations } from '@/db/schema'
import { generateAppJWT } from '@/lib/github-app-auth'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const installationId = searchParams.get('installation_id')

  if (!installationId) {
    return NextResponse.json(
      { error: 'Missing installation_id' },
      { status: 400 }
    )
  }

  try {
    const jwtToken = generateAppJWT()
    const response = await fetch(
      `https://api.github.com/app/installations/${installationId}`,
      {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch installation')
    }

    const installation = await response.json()

    await db
      .insert(githubAppInstallations)
      .values({
        installationId: installation.id,
        accountId: installation.account.id,
        accountLogin: installation.account.login,
        accountType: installation.account.type,
        repositorySelection: installation.repository_selection,
        permissions: installation.permissions,
        events: installation.events,
        suspendedAt: installation.suspended_at
          ? new Date(installation.suspended_at)
          : null,
      })
      .onConflictDoUpdate({
        target: githubAppInstallations.installationId,
        set: {
          repositorySelection: installation.repository_selection,
          permissions: installation.permissions,
          events: installation.events,
          updatedAt: new Date(),
        },
      })

    return NextResponse.redirect(new URL('/admin/github', request.url))
  } catch (error) {
    console.error('Installation callback error:', error)
    return NextResponse.redirect(
      new URL('/admin/github?error=installation_failed', request.url)
    )
  }
}
```

---

**Document Version**: 1.0
**Created**: 2025-11-13
**Repository**: https://github.com/recallnet/air-coding-arena
**Status**: Planning
**Recommended Priority**: Medium (improves security, UX, not blocking)
