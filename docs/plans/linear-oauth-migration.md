# Linear OAuth Migration Plan

## Executive Summary

Migrate from manual Linear API key setup to OAuth 2.0 application with automatic webhook registration. This enables multi-workspace support and prepares the product for distribution to other organizations.

**Effort**: 60-90 hours total
**Complexity**: Medium-Hard
**Timeline**: 5-6 weeks (can be compressed with dedicated focus)
**Dependencies**: Linear OAuth app registration, database schema changes

## Why OAuth?

### Current Limitations (API Key Approach)
- Manual setup: Copy API key, create webhook, copy webhook secret
- Single workspace only (can't support multiple orgs)
- Manual webhook configuration (error-prone)
- Not suitable for product distribution
- Requires Linear admin access for setup

### Benefits of OAuth
- ✅ One-click connection for admins
- ✅ Automatic webhook registration
- ✅ Multi-workspace support (critical for productization)
- ✅ Professional integration experience
- ✅ Eligible for Linear app marketplace
- ✅ Better security (short-lived tokens)
- ✅ Scalable for SaaS distribution

## Current State Analysis

### LINEAR_API_KEY Usage (4 locations)
1. **src/lib/linear-sync.ts** - Issue synchronization
2. **src/lib/agent-dispatch.ts** - Agent mentions and dispatch
3. **src/lib/linear-reconcile.ts** - Cron reconciliation
4. **scripts/** - Various admin/maintenance scripts

### LINEAR_WEBHOOK_SECRET Usage (1 location)
1. **src/app/api/linear/webhook/route.ts** - Webhook signature verification

### Current Pattern
```typescript
const apiKey = process.env['LINEAR_API_KEY']
if (!apiKey) throw new Error('LINEAR_API_KEY not configured')
const client = new LinearClient({ apiKey })
```

## Architecture Overview

### New Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin UI                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │  Connect   │  │  Status    │  │ Disconnect │            │
│  │  Linear    │  │  Display   │  │  Workspace │            │
│  └────────────┘  └────────────┘  └────────────┘            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  OAuth Flow Layer                            │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │ Authorize  │→ │  Callback  │→ │   Token    │            │
│  │            │  │  Handler   │  │  Storage   │            │
│  └────────────┘  └────────────┘  └────────────┘            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Token Management Layer                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │  Refresh   │  │  Validate  │  │   Revoke   │            │
│  │  Logic     │  │  Expiry    │  │            │            │
│  └────────────┘  └────────────┘  └────────────┘            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│           Webhook Management Layer                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │  Register  │  │   Verify   │  │   Delete   │            │
│  │  Webhook   │  │ Signature  │  │  Webhook   │            │
│  └────────────┘  └────────────┘  └────────────┘            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Linear API Integration                          │
│         (all existing functionality)                         │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema

Three new tables required:

1. **linear_oauth_tokens** - Stores OAuth tokens per workspace
2. **linear_webhooks** - Tracks registered webhooks
3. **linear_oauth_config** - App configuration (singleton)

### Data Flow

**Connection Flow**:
```
Admin clicks "Connect Linear"
  → /api/linear/auth/authorize
  → Redirect to Linear OAuth
  → User authorizes
  → Linear redirects to /api/linear/auth/callback
  → Exchange code for tokens
  → Store tokens in database
  → Register webhook programmatically
  → Store webhook info
  → Redirect to admin dashboard
  → Show "Connected" status
```

**API Call Flow**:
```
Code needs Linear client
  → Call getValidLinearClient(workspaceId)
  → Load token from database
  → Check if expired
  → If expired: refresh token, update database
  → Create LinearClient with valid token
  → Return client
```

**Webhook Flow**:
```
Linear sends webhook
  → /api/linear/webhook
  → Extract workspace context (from URL or header)
  → Load webhook secret from database
  → Verify signature
  → Process event
  → Return 200 OK
```

## Implementation Plan

### Phase 1: Database Schema (4-6 hours)

**Tasks**:
- [ ] Create Drizzle schema definitions for 3 new tables
- [ ] Write migration file
- [ ] Add indexes for performance (workspace_id, token lookups)
- [ ] Test migration locally
- [ ] Test rollback
- [ ] Deploy to staging

**Schema Design**:

```typescript
// src/db/schema.ts additions

export const linearOauthTokens = pgTable('linear_oauth_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: text('workspace_id').notNull().unique(),
  workspaceName: text('workspace_name').notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  tokenType: text('token_type').notNull().default('Bearer'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  scope: text('scope').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const linearWebhooks = pgTable('linear_webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: text('workspace_id').notNull().references(() => linearOauthTokens.workspaceId, { onDelete: 'cascade' }),
  linearWebhookId: text('linear_webhook_id').notNull().unique(),
  webhookUrl: text('webhook_url').notNull(),
  webhookSecret: text('webhook_secret').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  resourceTypes: jsonb('resource_types').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const linearOauthConfig = pgTable('linear_oauth_config', {
  id: text('id').primaryKey().default('singleton'),
  clientId: text('client_id').notNull(),
  clientSecret: text('client_secret').notNull(),
  redirectUri: text('redirect_uri').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  singleRow: check('single_row', sql`${table.id} = 'singleton'`),
}))
```

**Migration File**:
- Create `migrations/NNNN_add_linear_oauth.sql`
- Include all tables, indexes, constraints
- Test on dev database

**Acceptance Criteria**:
- [ ] All tables created successfully
- [ ] Foreign keys working correctly
- [ ] Indexes in place
- [ ] Can insert/query test data
- [ ] Migration reversible

---

### Phase 2: OAuth Flow Implementation (16-24 hours)

#### Task 2.1: Create OAuth API Routes

**New routes**:
- [ ] `/api/linear/auth/authorize` (GET)
- [ ] `/api/linear/auth/callback` (GET)
- [ ] `/api/linear/auth/disconnect` (POST)
- [ ] `/api/linear/auth/status` (GET)

**Authorization Endpoint** (`/api/linear/auth/authorize`):
```typescript
// Generates OAuth URL with CSRF protection
export async function GET(request: NextRequest) {
  // Generate random state for CSRF protection
  const state = crypto.randomBytes(32).toString('hex')

  // Store state in cookie (expires in 10 minutes)
  const response = NextResponse.redirect(oauthUrl)
  response.cookies.set('linear_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
  })

  // Build Linear OAuth URL
  const params = new URLSearchParams({
    client_id: process.env.LINEAR_OAUTH_CLIENT_ID!,
    redirect_uri: process.env.LINEAR_OAUTH_REDIRECT_URI!,
    response_type: 'code',
    scope: 'read,write,comments:create,admin',
    state,
  })

  const oauthUrl = `https://linear.app/oauth/authorize?${params}`

  return NextResponse.redirect(oauthUrl)
}
```

**Callback Handler** (`/api/linear/auth/callback`):
```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  // Verify state (CSRF protection)
  const storedState = request.cookies.get('linear_oauth_state')?.value
  if (!state || state !== storedState) {
    return new NextResponse('Invalid state', { status: 400 })
  }

  // Exchange code for tokens
  const tokenResponse = await fetch('https://api.linear.app/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.LINEAR_OAUTH_CLIENT_ID!,
      client_secret: process.env.LINEAR_OAUTH_CLIENT_SECRET!,
      redirect_uri: process.env.LINEAR_OAUTH_REDIRECT_URI!,
    }),
  })

  const tokens = await tokenResponse.json()

  // Get workspace info
  const client = new LinearClient({ accessToken: tokens.access_token })
  const viewer = await client.viewer
  const organization = await viewer.organization

  // Store tokens in database
  await db.insert(linearOauthTokens).values({
    workspaceId: organization.id,
    workspaceName: organization.name,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenType: tokens.token_type,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    scope: tokens.scope,
  }).onConflictDoUpdate({
    target: linearOauthTokens.workspaceId,
    set: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      updatedAt: new Date(),
    },
  })

  // Register webhook (Phase 3)
  await registerLinearWebhook(client, organization.id)

  // Clear state cookie
  const response = NextResponse.redirect('/admin/linear')
  response.cookies.delete('linear_oauth_state')

  return response
}
```

**Status Endpoint** (`/api/linear/auth/status`):
```typescript
export async function GET() {
  const tokens = await db
    .select({
      workspaceId: linearOauthTokens.workspaceId,
      workspaceName: linearOauthTokens.workspaceName,
      expiresAt: linearOauthTokens.expiresAt,
      scope: linearOauthTokens.scope,
    })
    .from(linearOauthTokens)
    .limit(1)

  if (tokens.length === 0) {
    return NextResponse.json({ connected: false })
  }

  const token = tokens[0]
  const isExpired = token.expiresAt && new Date() >= token.expiresAt

  return NextResponse.json({
    connected: true,
    workspaceId: token.workspaceId,
    workspaceName: token.workspaceName,
    expiresAt: token.expiresAt,
    isExpired,
    scope: token.scope,
  })
}
```

**Disconnect Endpoint** (`/api/linear/auth/disconnect`):
```typescript
export async function POST() {
  // Get current token
  const tokens = await db.select().from(linearOauthTokens).limit(1)

  if (tokens.length === 0) {
    return NextResponse.json({ success: false, error: 'Not connected' }, { status: 400 })
  }

  const token = tokens[0]

  // Revoke token via Linear API (optional but recommended)
  try {
    await fetch('https://api.linear.app/oauth/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token: token.accessToken,
        client_id: process.env.LINEAR_OAUTH_CLIENT_ID!,
        client_secret: process.env.LINEAR_OAUTH_CLIENT_SECRET!,
      }),
    })
  } catch (error) {
    console.error('Failed to revoke token:', error)
  }

  // Delete from database (webhooks cascade delete)
  await db.delete(linearOauthTokens).where(eq(linearOauthTokens.workspaceId, token.workspaceId))

  return NextResponse.json({ success: true })
}
```

**Acceptance Criteria**:
- [ ] OAuth flow works end-to-end
- [ ] CSRF protection with state parameter
- [ ] Tokens stored in database
- [ ] Workspace info captured
- [ ] Error handling for OAuth failures
- [ ] Redirect back to admin UI after connection

#### Task 2.2: Token Refresh Logic

**Helper Function** (`src/lib/linear-oauth.ts`):
```typescript
export async function getValidLinearClient(workspaceId?: string): Promise<LinearClient> {
  // Get token (use first one if workspaceId not specified - single workspace mode)
  let tokenQuery = db.select().from(linearOauthTokens)
  if (workspaceId) {
    tokenQuery = tokenQuery.where(eq(linearOauthTokens.workspaceId, workspaceId))
  }
  const tokens = await tokenQuery.limit(1)

  if (tokens.length === 0) {
    throw new Error('Linear workspace not connected. Please connect in admin settings.')
  }

  const token = tokens[0]

  // Check if token expired
  if (token.expiresAt && new Date() >= token.expiresAt) {
    console.log('Token expired, refreshing...')

    if (!token.refreshToken) {
      throw new Error('Token expired and no refresh token available')
    }

    // Refresh token
    const response = await fetch('https://api.linear.app/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
        client_id: process.env.LINEAR_OAUTH_CLIENT_ID!,
        client_secret: process.env.LINEAR_OAUTH_CLIENT_SECRET!,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Token refresh failed: ${error}`)
    }

    const newTokens = await response.json()

    // Update database
    await db
      .update(linearOauthTokens)
      .set({
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || token.refreshToken, // Keep old if not provided
        expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
        updatedAt: new Date(),
      })
      .where(eq(linearOauthTokens.workspaceId, token.workspaceId))

    console.log('Token refreshed successfully')

    return new LinearClient({ accessToken: newTokens.access_token })
  }

  // Token still valid
  return new LinearClient({ accessToken: token.accessToken })
}

// Convenience function for single-workspace mode
export async function getPrimaryLinearClient(): Promise<LinearClient> {
  return getValidLinearClient()
}
```

**Acceptance Criteria**:
- [ ] Token refresh works automatically
- [ ] Database updated with new tokens
- [ ] Errors handled gracefully
- [ ] Logging for debugging
- [ ] Tested with expired tokens

---

### Phase 3: Webhook Management (12-16 hours)

#### Task 3.1: Programmatic Webhook Registration

**Research findings**: Linear supports webhook creation via GraphQL API. The OAuth app can also configure automatic webhook settings.

**Implementation** (`src/lib/linear-webhook.ts`):
```typescript
export async function registerLinearWebhook(
  client: LinearClient,
  workspaceId: string
): Promise<void> {
  // Check if webhook already exists
  const existing = await db
    .select()
    .from(linearWebhooks)
    .where(eq(linearWebhooks.workspaceId, workspaceId))
    .limit(1)

  if (existing.length > 0) {
    console.log('Webhook already registered for this workspace')
    return
  }

  // Generate webhook secret
  const webhookSecret = crypto.randomBytes(32).toString('hex')

  // Determine webhook URL
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.LINEAR_WEBHOOK_BASE_URL || 'http://localhost:3109'
  const webhookUrl = `${baseUrl}/api/linear/webhook/${workspaceId}`

  // Create webhook via GraphQL
  const result = await client.createWebhook({
    url: webhookUrl,
    allPublicTeams: true,
    resourceTypes: ['Issue', 'Comment', 'Attachment'],
    label: 'Air Coding Arena',
  })

  if (!result.success || !result.webhook) {
    throw new Error('Failed to create webhook in Linear')
  }

  // Store webhook info
  await db.insert(linearWebhooks).values({
    workspaceId,
    linearWebhookId: result.webhook.id,
    webhookUrl,
    webhookSecret,
    enabled: true,
    resourceTypes: ['Issue', 'Comment', 'Attachment'],
  })

  console.log(`Webhook registered: ${result.webhook.id}`)
}

export async function deleteLinearWebhook(workspaceId: string): Promise<void> {
  // Get webhook info
  const webhook = await db
    .select()
    .from(linearWebhooks)
    .where(eq(linearWebhooks.workspaceId, workspaceId))
    .limit(1)

  if (webhook.length === 0) {
    return
  }

  const webhookInfo = webhook[0]

  // Get Linear client
  const client = await getValidLinearClient(workspaceId)

  // Delete webhook via GraphQL
  try {
    await client.deleteWebhook(webhookInfo.linearWebhookId)
    console.log(`Webhook deleted: ${webhookInfo.linearWebhookId}`)
  } catch (error) {
    console.error('Failed to delete webhook from Linear:', error)
  }

  // Delete from database
  await db.delete(linearWebhooks).where(eq(linearWebhooks.workspaceId, workspaceId))
}
```

**Challenge**: Linear's webhook secret is generated by Linear, not by us. Two approaches:

**Approach A: Use OAuth app automatic webhooks** (Recommended)
- Configure webhook settings in Linear OAuth app
- Linear automatically creates webhook on authorization
- Need to research how to retrieve the webhook secret

**Approach B: Generate our own secret and store**
- We generate the secret
- Store it before creating webhook
- Linear doesn't validate the secret we claim

**Decision**: Use Approach A with OAuth app configuration, but need to research if/how we can retrieve the Linear-generated secret. May need to make it configurable or use a known pattern.

**Acceptance Criteria**:
- [ ] Webhook created successfully on OAuth connection
- [ ] Webhook URL includes workspace ID for routing
- [ ] Webhook secret stored securely
- [ ] Webhook deleted on disconnect
- [ ] Error handling for webhook creation failures

#### Task 3.2: Update Webhook Signature Verification

**Current**: Uses `process.env.LINEAR_WEBHOOK_SECRET`

**New**: Load secret from database based on workspace ID

**Implementation** (`src/app/api/linear/webhook/[workspaceId]/route.ts`):
```typescript
async function verifyLinearSignature(
  payload: string,
  signature: string | null,
  workspaceId: string
): Promise<boolean> {
  if (!signature) {
    console.error('No signature provided')
    return false
  }

  // Load webhook secret from database
  const webhook = await db
    .select({ webhookSecret: linearWebhooks.webhookSecret })
    .from(linearWebhooks)
    .where(eq(linearWebhooks.workspaceId, workspaceId))
    .limit(1)

  if (webhook.length === 0) {
    console.error(`No webhook found for workspace: ${workspaceId}`)
    return false
  }

  const secret = webhook[0].webhookSecret

  // Verify signature
  const hmac = crypto.createHmac('sha256', secret)
  const digest = hmac.update(payload).digest('hex')

  return signature === digest
}

export async function POST(
  request: Request,
  { params }: { params: { workspaceId: string } }
) {
  const { workspaceId } = params
  const signature = request.headers.get('linear-signature')
  const body = await request.text()

  // Verify signature
  const isValid = await verifyLinearSignature(body, signature, workspaceId)
  if (!isValid) {
    console.error(`[Webhook] Invalid signature for workspace ${workspaceId}`)
    return new NextResponse('Invalid signature', { status: 401 })
  }

  // Process webhook (existing logic)
  // ...
}
```

**Note**: Webhook URL now includes workspace ID: `/api/linear/webhook/[workspaceId]`

**Acceptance Criteria**:
- [ ] Signature verification uses database secret
- [ ] Workspace ID extracted from URL
- [ ] Invalid signatures rejected
- [ ] Logging for debugging
- [ ] Works with real webhook payloads

---

### Phase 4: Code Migration (8-12 hours)

#### Task 4.1: Update All Linear Client Instantiations

**Files to update**:
1. `src/lib/linear-sync.ts`
2. `src/lib/agent-dispatch.ts`
3. `src/lib/linear-reconcile.ts`
4. All scripts in `scripts/`

**Before**:
```typescript
const apiKey = process.env['LINEAR_API_KEY']
if (!apiKey) {
  throw new Error('LINEAR_API_KEY not configured')
}
const client = new LinearClient({ apiKey })
```

**After**:
```typescript
import { getPrimaryLinearClient } from '@/lib/linear-oauth'

const client = await getPrimaryLinearClient()
```

**Script Updates**: Scripts need error message update
```typescript
// scripts/example.ts
import { getPrimaryLinearClient } from '../src/lib/linear-oauth'

async function main() {
  try {
    const client = await getPrimaryLinearClient()
    // ... rest of script
  } catch (error) {
    if (error.message.includes('not connected')) {
      console.error('Linear workspace not connected.')
      console.error('Please run the app and connect via /admin/linear')
      process.exit(1)
    }
    throw error
  }
}
```

**Acceptance Criteria**:
- [ ] All LinearClient instantiations updated
- [ ] No more direct API key usage
- [ ] Error messages point to admin UI
- [ ] All functions still work identically
- [ ] Scripts updated with helpful error messages

#### Task 4.2: Implement Backward Compatibility (Optional)

**Dual-mode support** for smooth transition:

```typescript
export async function getLinearClient(): Promise<LinearClient> {
  // Try OAuth first
  try {
    return await getPrimaryLinearClient()
  } catch (oauthError) {
    // Fall back to API key if present
    const apiKey = process.env['LINEAR_API_KEY']
    if (apiKey) {
      console.warn('Using fallback API key. Consider migrating to OAuth.')
      return new LinearClient({ apiKey })
    }

    // Neither OAuth nor API key available
    throw new Error(
      'Linear not configured. Please connect via /admin/linear or set LINEAR_API_KEY'
    )
  }
}
```

**Decision**: Include this during migration period, remove after OAuth proven stable.

**Acceptance Criteria**:
- [ ] Fallback to API key works
- [ ] Warning logged when using API key
- [ ] Both modes tested
- [ ] Can switch between modes without code changes

---

### Phase 5: Admin UI (8-12 hours)

#### Task 5.1: Create Connection Management Page

**New page**: `/app/admin/linear/page.tsx`

**UI Components**:

```tsx
export default async function LinearAdminPage() {
  // Check connection status
  const statusResponse = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/linear/auth/status`)
  const status = await statusResponse.json()

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Linear Integration</h1>

      {status.connected ? (
        <ConnectedView status={status} />
      ) : (
        <DisconnectedView />
      )}
    </div>
  )
}
```

**Connected View**:
```tsx
function ConnectedView({ status }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="text-green-500" />
          Connected to Linear
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm text-muted-foreground">Workspace</label>
          <p className="font-medium">{status.workspaceName}</p>
        </div>

        <div>
          <label className="text-sm text-muted-foreground">Status</label>
          <p className="flex items-center gap-2">
            {status.isExpired ? (
              <>
                <AlertCircle className="text-yellow-500" size={16} />
                Token expired (will refresh automatically)
              </>
            ) : (
              <>
                <CheckCircle className="text-green-500" size={16} />
                Active
              </>
            )}
          </p>
        </div>

        <div>
          <label className="text-sm text-muted-foreground">Webhook</label>
          <p className="flex items-center gap-2">
            <CheckCircle className="text-green-500" size={16} />
            Registered and receiving events
          </p>
        </div>

        <div>
          <label className="text-sm text-muted-foreground">Scopes</label>
          <p className="text-sm font-mono">{status.scope}</p>
        </div>

        <Button
          variant="destructive"
          onClick={handleDisconnect}
        >
          Disconnect Workspace
        </Button>
      </CardContent>
    </Card>
  )
}
```

**Disconnected View**:
```tsx
function DisconnectedView() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="text-yellow-500" />
          Linear Not Connected
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          Connect your Linear workspace to enable issue synchronization,
          agent dispatch, and automated workflows.
        </p>

        <div className="bg-muted p-4 rounded-lg space-y-2">
          <h3 className="font-medium">What happens when you connect:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>Automatic webhook registration</li>
            <li>Real-time issue synchronization</li>
            <li>Agent dispatch capabilities</li>
            <li>PR tracking and ratings</li>
          </ul>
        </div>

        <Button
          onClick={() => window.location.href = '/api/linear/auth/authorize'}
        >
          <ExternalLink className="mr-2" size={16} />
          Connect Linear Workspace
        </Button>
      </CardContent>
    </Card>
  )
}
```

**Acceptance Criteria**:
- [ ] Status display shows connection state
- [ ] Connect button initiates OAuth flow
- [ ] Disconnect button works correctly
- [ ] Loading states during OAuth
- [ ] Error messages for failures
- [ ] Responsive design

#### Task 5.2: Add Connection Check to Admin Dashboard

Update `/app/admin/page.tsx` to show Linear connection status:

```tsx
export default async function AdminDashboard() {
  const linearStatus = await fetch('/api/linear/auth/status').then(r => r.json())

  return (
    <div>
      {/* Existing admin content */}

      {!linearStatus.connected && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Linear Not Connected</AlertTitle>
          <AlertDescription>
            Connect your Linear workspace to enable full functionality.
            <Link href="/admin/linear" className="underline ml-2">
              Connect now
            </Link>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
```

**Acceptance Criteria**:
- [ ] Warning shown when not connected
- [ ] Link to connection page
- [ ] Dismissible (optional)
- [ ] Clear call-to-action

---

### Phase 6: Testing & Validation (8-16 hours)

#### Task 6.1: Unit Tests

**Test files to create**:
- [ ] `src/lib/linear-oauth.test.ts` - Token refresh logic
- [ ] `src/lib/linear-webhook.test.ts` - Webhook management
- [ ] `src/app/api/linear/auth/callback/route.test.ts` - OAuth callback
- [ ] `src/app/api/linear/webhook/[workspaceId]/route.test.ts` - Webhook verification

**Test scenarios**:
- [ ] Token refresh with valid refresh token
- [ ] Token refresh with expired refresh token
- [ ] Token refresh with network failure
- [ ] OAuth callback with valid code
- [ ] OAuth callback with invalid state (CSRF)
- [ ] Webhook signature verification success
- [ ] Webhook signature verification failure
- [ ] Webhook creation success
- [ ] Webhook creation failure

#### Task 6.2: Integration Tests

**Test flows**:
- [ ] Complete OAuth flow end-to-end
- [ ] Disconnect and reconnect
- [ ] Token expiry and automatic refresh
- [ ] Webhook registration on connection
- [ ] Webhook deletion on disconnect
- [ ] API calls with OAuth token
- [ ] Fallback to API key (if dual-mode)

#### Task 6.3: Manual Testing

**Testing checklist**:
- [ ] Click "Connect Linear" button
- [ ] Complete OAuth flow in Linear
- [ ] Verify redirect back to admin
- [ ] Check connection status displayed correctly
- [ ] Verify webhook created in Linear settings
- [ ] Send test webhook from Linear
- [ ] Verify webhook processed correctly
- [ ] Let token expire (or manually expire in DB)
- [ ] Trigger API call to test refresh
- [ ] Check new token stored in database
- [ ] Click "Disconnect" button
- [ ] Verify webhook deleted from Linear
- [ ] Verify tokens removed from database

---

### Phase 7: Deployment & Migration (4-6 hours)

#### Task 7.1: Register Linear OAuth Application

**Steps**:
1. Go to Linear Settings → OAuth Applications
2. Click "New OAuth application"
3. Fill in details:
   - **Name**: Air Coding Arena
   - **Description**: Automated agent competition platform for Linear issues
   - **Callback URLs**:
     - Production: `https://your-domain.vercel.app/api/linear/auth/callback`
     - Staging: `https://your-staging.vercel.app/api/linear/auth/callback`
     - Local: `http://localhost:3109/api/linear/auth/callback` (for testing)
   - **Webhook URL**: (optional, for automatic webhooks)
   - **Logo**: Upload arena logo
   - **Homepage**: https://your-domain.vercel.app
4. Save application
5. Copy Client ID and Client Secret

**Acceptance Criteria**:
- [ ] OAuth app registered in Linear
- [ ] All callback URLs configured
- [ ] Client credentials saved securely

#### Task 7.2: Update Environment Variables

**New variables needed**:
```bash
# OAuth credentials
LINEAR_OAUTH_CLIENT_ID=lin_oauth_...
LINEAR_OAUTH_CLIENT_SECRET=...
LINEAR_OAUTH_REDIRECT_URI=https://your-domain.vercel.app/api/linear/auth/callback

# Webhook base URL (for constructing webhook URLs)
LINEAR_WEBHOOK_BASE_URL=https://your-domain.vercel.app

# Keep for backward compatibility (remove after migration)
LINEAR_API_KEY=lin_api_...
LINEAR_WEBHOOK_SECRET=...
```

**Add to**:
- [ ] `.env.local` (local development)
- [ ] Vercel project settings (production)
- [ ] Vercel preview settings (staging)
- [ ] Update `.env.example` with new variables

#### Task 7.3: Deploy Migration

**Deployment steps**:
1. [ ] Merge OAuth implementation to main
2. [ ] Verify all tests pass
3. [ ] Deploy to staging environment
4. [ ] Test OAuth flow in staging
5. [ ] Verify webhooks working in staging
6. [ ] Deploy to production
7. [ ] Keep API key setup working (dual-mode)
8. [ ] Monitor for errors

#### Task 7.4: Connect Production Workspace

**Steps**:
1. [ ] Navigate to production `/admin/linear`
2. [ ] Click "Connect Linear Workspace"
3. [ ] Authorize in Linear
4. [ ] Verify connection successful
5. [ ] Check webhook created in Linear
6. [ ] Test webhook delivery
7. [ ] Verify all functionality works

**Validation**:
- [ ] Issue sync working
- [ ] Agent dispatch working
- [ ] Webhook events processing
- [ ] No errors in logs
- [ ] Token refresh working

#### Task 7.5: Remove API Key (Optional)

**After OAuth proven stable** (1-2 weeks):
1. [ ] Remove API key fallback logic
2. [ ] Remove `LINEAR_API_KEY` from env vars
3. [ ] Remove `LINEAR_WEBHOOK_SECRET` from env vars
4. [ ] Update documentation
5. [ ] Deploy cleanup

---

## Environment Variables

### New Variables Required

```bash
# Linear OAuth Application
LINEAR_OAUTH_CLIENT_ID=lin_oauth_...        # From Linear OAuth app settings
LINEAR_OAUTH_CLIENT_SECRET=...               # From Linear OAuth app settings (keep secret!)
LINEAR_OAUTH_REDIRECT_URI=https://...        # Must match OAuth app callback URL

# Webhook Configuration
LINEAR_WEBHOOK_BASE_URL=https://...          # Base URL for webhook registration

# Legacy (remove after migration complete)
LINEAR_API_KEY=lin_api_...                   # Keep during transition
LINEAR_WEBHOOK_SECRET=...                    # Keep during transition
```

### Local Development

```bash
# .env.local
LINEAR_OAUTH_CLIENT_ID=lin_oauth_dev_...
LINEAR_OAUTH_CLIENT_SECRET=dev_secret
LINEAR_OAUTH_REDIRECT_URI=http://localhost:3109/api/linear/auth/callback
LINEAR_WEBHOOK_BASE_URL=http://localhost:3109

# Use ngrok for webhook testing locally
# ngrok http 3109
# Then update LINEAR_WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok.io
```

---

## Security Considerations

### Token Storage
- ✅ Store tokens in database (encrypted at rest by Postgres)
- ✅ Never log access tokens or refresh tokens
- ✅ Use HTTPS for all OAuth redirects
- ✅ Implement CSRF protection with state parameter

### Webhook Security
- ✅ Always verify webhook signatures
- ✅ Use cryptographically random webhook secrets
- ✅ Store secrets securely (database, not env vars)
- ✅ Reject webhooks with invalid signatures

### Token Refresh
- ✅ Implement automatic refresh before expiry
- ✅ Handle refresh failures gracefully
- ✅ Log refresh events for monitoring
- ✅ Alert on repeated refresh failures

### Admin Access
- ✅ Protect `/admin/linear` with authentication
- ✅ Require admin role for connect/disconnect
- ✅ Log all connection changes
- ✅ Implement rate limiting on OAuth endpoints

---

## Monitoring & Alerts

### Metrics to Track

1. **OAuth Flow**:
   - Authorization attempts
   - Successful connections
   - Failed authorizations
   - CSRF validation failures

2. **Token Management**:
   - Token refresh success rate
   - Token refresh failures
   - Token expiry events
   - Time to token expiry

3. **Webhook Health**:
   - Webhook events received
   - Signature verification failures
   - Webhook processing errors
   - Event processing latency

4. **API Calls**:
   - Linear API call success rate
   - Linear API call failures
   - Rate limit hits
   - Response times

### Alerts to Configure

- [ ] Token refresh failing repeatedly (3+ failures)
- [ ] Webhook signature verification failing (10+ failures in 5 minutes)
- [ ] Linear API calls failing (5+ failures in 1 minute)
- [ ] Token expiring soon with no refresh token
- [ ] Webhook not receiving events (30+ minutes silence)

### Logging

**What to log**:
```typescript
// OAuth events
console.log('[OAuth] Authorization started')
console.log('[OAuth] Token exchange successful', { workspaceId, expiresAt })
console.log('[OAuth] Token refresh successful', { workspaceId })
console.error('[OAuth] Token refresh failed', { workspaceId, error })

// Webhook events
console.log('[Webhook] Event received', { workspaceId, type, action })
console.error('[Webhook] Signature verification failed', { workspaceId })

// API calls
console.log('[Linear] API call', { operation, workspaceId })
console.error('[Linear] API call failed', { operation, workspaceId, error })
```

---

## Risk Mitigation

### Risk 1: Token Refresh Failures
**Impact**: High (breaks all Linear functionality)
**Mitigation**:
- Implement retry logic with exponential backoff
- Alert on repeated failures
- Keep API key fallback during transition
- Monitor token expiry proactively

### Risk 2: Webhook Registration Failures
**Impact**: High (no real-time updates)
**Mitigation**:
- Retry webhook creation on failures
- Manual webhook fallback instructions in UI
- Verify webhook creation after OAuth
- Test webhook delivery immediately

### Risk 3: Database Migration Issues
**Impact**: High (deployment failure)
**Mitigation**:
- Test migrations thoroughly in staging
- Prepare rollback scripts
- Take database backup before migration
- Deploy during low-traffic period

### Risk 4: OAuth Callback URL Mismatch
**Impact**: High (OAuth flow broken)
**Mitigation**:
- Double-check callback URLs in Linear app settings
- Test in staging first
- Document exact URLs needed
- Handle redirect errors gracefully

### Risk 5: Multi-Workspace Complexity
**Impact**: Medium (confusion, complexity)
**Mitigation**:
- Start with single-workspace mode
- Add multi-workspace as Phase 2
- Clear UI for workspace selection
- Document workspace limitations

---

## Testing Strategy

### Unit Tests (Required)
- [ ] Token refresh logic
- [ ] OAuth callback handler
- [ ] Webhook signature verification
- [ ] Linear client creation with OAuth

### Integration Tests (Required)
- [ ] Complete OAuth flow
- [ ] Token expiry and refresh
- [ ] Webhook creation and deletion
- [ ] API calls with OAuth token

### E2E Tests (Recommended)
- [ ] Connect Linear via UI
- [ ] Disconnect Linear via UI
- [ ] Process webhook event
- [ ] Agent dispatch with OAuth

### Manual Tests (Critical)
- [ ] Test in staging environment
- [ ] Test with real Linear workspace
- [ ] Test token expiry (24 hours)
- [ ] Test webhook delivery
- [ ] Test all existing features work

---

## Documentation Updates

### Files to Update

1. **README.md**:
   - [ ] Update setup instructions for OAuth
   - [ ] Remove API key instructions (or mark as legacy)
   - [ ] Add screenshots of OAuth flow

2. **DEPLOYMENT.md** (create if needed):
   - [ ] OAuth app registration steps
   - [ ] Environment variable configuration
   - [ ] Production deployment checklist
   - [ ] Troubleshooting guide

3. **docs/setup/linear-integration.md** (new):
   - [ ] Detailed OAuth setup guide
   - [ ] Webhook configuration
   - [ ] Multi-workspace support (future)
   - [ ] Migration from API key

4. **Code comments**:
   - [ ] Document token refresh logic
   - [ ] Document webhook management
   - [ ] Document OAuth flow

---

## Success Criteria

### Functional Requirements
- [ ] Admin can connect Linear workspace via OAuth
- [ ] Webhook automatically registered on connection
- [ ] All existing Linear features work with OAuth
- [ ] Token refresh happens automatically
- [ ] Admin can disconnect workspace
- [ ] Clear UI showing connection status

### Non-Functional Requirements
- [ ] OAuth flow completes in < 10 seconds
- [ ] Token refresh succeeds 99.9% of time
- [ ] Webhook delivery within 2 seconds
- [ ] Zero downtime during migration
- [ ] Backward compatible during transition

### Quality Gates
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Test coverage > 90%
- [ ] Type coverage > 99.9%
- [ ] Zero ESLint warnings
- [ ] Manual testing completed

---

## Timeline

**Estimated: 5-6 weeks** (can be compressed with full-time focus)

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Database Schema | 4-6 hours | None |
| Phase 2: OAuth Flow | 16-24 hours | Phase 1 |
| Phase 3: Webhook Management | 12-16 hours | Phase 2 |
| Phase 4: Code Migration | 8-12 hours | Phase 3 |
| Phase 5: Admin UI | 8-12 hours | Phase 2 |
| Phase 6: Testing | 8-16 hours | All phases |
| Phase 7: Deployment | 4-6 hours | All phases |
| **Total** | **60-96 hours** | |

**Parallelization opportunities**:
- Admin UI can be built in parallel with webhook management
- Testing can start as soon as components are ready
- Documentation can be written throughout

---

## Future Enhancements

### Phase 2: Multi-Workspace Support

**After single-workspace stable**, add support for multiple Linear workspaces:

1. **Workspace Selection UI**:
   - List all connected workspaces
   - Select primary workspace
   - Switch between workspaces

2. **Database Changes**:
   - Add workspace_id to issues table
   - Add workspace_id to all relevant tables
   - Workspace-scoped queries

3. **UI Updates**:
   - Workspace selector in admin
   - Per-workspace settings
   - Workspace-scoped issue views

4. **API Updates**:
   - Workspace context in all API routes
   - Workspace validation
   - Workspace isolation

**Effort**: 20-30 hours additional

### Phase 3: Linear App Marketplace

**Requirements for Linear app marketplace**:
1. Public OAuth app (not private)
2. Support for any Linear workspace
3. Clear privacy policy
4. Terms of service
5. Support documentation
6. App logo and screenshots

**Effort**: 10-15 hours (mostly documentation and compliance)

---

## Rollback Plan

### If OAuth Migration Fails

**Immediate rollback** (< 5 minutes):
1. Revert to previous deployment
2. Re-enable API key mode
3. Notify team of rollback

**Partial rollback** (keep OAuth, fix issues):
1. Enable dual-mode support
2. Let users choose API key or OAuth
3. Fix issues while maintaining service
4. Re-attempt OAuth cutover later

**Database rollback**:
```sql
-- Drop OAuth tables if needed
DROP TABLE IF EXISTS linear_webhooks CASCADE;
DROP TABLE IF EXISTS linear_oauth_tokens CASCADE;
DROP TABLE IF EXISTS linear_oauth_config CASCADE;
```

**Environment variables rollback**:
- Keep `LINEAR_API_KEY` during transition
- Can switch back by removing OAuth env vars

---

## Questions to Research

1. **Webhook Secret**: Can we retrieve the Linear-generated webhook secret programmatically? Or do we need to generate and use our own?
   - Research Linear's webhook creation API response
   - Check if OAuth app automatic webhooks expose secrets

2. **Token Expiry**: Are all Linear OAuth tokens now 24-hour expiry, or just new apps after Oct 2025?
   - Check Linear documentation for app creation date cutoff
   - Test with newly created OAuth app

3. **Webhook Events**: Do programmatically created webhooks support all event types?
   - Verify Issue, Comment, Attachment events work
   - Test event delivery and payload format

4. **Multi-Workspace**: How does Linear's OAuth handle organization vs workspace concepts?
   - Research OAuth scopes for multi-org access
   - Understand workspace/org hierarchy

5. **Rate Limits**: Does OAuth have different rate limits than API keys?
   - Research Linear's rate limiting policy
   - Test rate limits with OAuth tokens

---

## Appendix: Linear OAuth Resources

### Documentation
- OAuth 2.0 Guide: https://linear.app/developers/oauth-2-0-authentication
- Webhook Guide: https://linear.app/developers/sdk-webhooks
- GraphQL API: https://studio.apollographql.com/public/Linear-API/home
- SDK Documentation: https://github.com/linear/linear/tree/master/packages/sdk

### Support
- Linear Community: https://linear.app/community
- Linear Support: support@linear.app
- GitHub Issues: https://github.com/linear/linear/issues

### Testing
- Linear OAuth Playground: (check if available)
- Webhook Testing: Use ngrok for local development
- GraphQL Playground: https://api.linear.app/graphql
