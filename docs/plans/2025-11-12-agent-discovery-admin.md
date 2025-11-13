# Agent Discovery & Admin Configuration System

**Status**: Planning
**Created**: 2025-11-12
**Complexity**: High
**Timeline**: 16 days

## Overview

Implement automated discovery of coding agents available in the repository, store them in a database table with enable/disable capabilities, and create an admin UI for configuration. Replace the current AGENTS_CONFIG_JSON environment variable approach with a database-driven system that supports:
- Automatic discovery of agents from Linear API
- Enable/disable individual agents
- Configuration modes: run all agents, max N agents (random sample), or manual assignment only
- Discovery runs on page load and during reconciliation

## Current State

### Agent Configuration (Environment Variable)
```typescript
// src/lib/agent-config.ts
// Currently reads from AGENTS_CONFIG_JSON env var
type AgentConfig = {
  name: string    // lowercase identifier (e.g., "cursor")
  handle: string  // Linear mention handle (e.g., "@Cursor")
}
```

### Agent Dispatch
```typescript
// src/lib/agent-dispatch.ts
export async function dispatchMissingAgents(dbIssueId: string): Promise<void>
// Creates Linear comments with @mentions for agents not yet in issue_agents table
// Only dispatches to open/in_progress issues
```

### Database Schema
```typescript
// src/db/schema.ts
export const issueAgents = pgTable('issue_agents', {
  issueId: text('issue_id').notNull().references(() => issues.id),
  agentName: text('agent_name').notNull(),
  status: text('status').notNull(),
  // ...
})
// No standalone agents table currently exists
```

### Discovery Entry Points
1. **Server startup**: `src/instrumentation.ts` calls `reconcileLinearIssues()`
2. **Hourly cron**: `/api/linear/reconcile` endpoint
3. **Page loads**: `src/app/page.tsx` (dashboard) and `src/app/issues/[id]/page.tsx` (issue detail)

## Requirements

### 1. Agent Discovery
- Query Linear API for users in the workspace
- Filter to identify coding agents (vs human users)
- Store discovered agents in database table
- Run discovery automatically:
  - On server startup
  - During hourly reconciliation
  - When dashboard page loads
  - When issue detail page loads (if stale)
- Update existing agents if metadata changes

### 2. Agent Database Table
- Store all discovered agents
- Track active status (currently available in workspace)
- Track enabled status (admin can disable)
- Store Linear user metadata (name, email, avatar, etc.)
- Default enabled=true for new agents

### 3. Admin Configuration UI
- Page at `/admin/agents` (no auth required)
- Display all agents in table format
- Enable/disable individual agents via toggle
- Show active status (read-only indicator)
- Show last discovered/seen timestamp
- Configuration modes:
  - **Run all agents**: Assign all enabled agents to every issue
  - **Max N agents**: Random sample of N enabled agents (min 2) per issue
  - **Manual assignment only**: No auto-assignment, listen for @mentions in comments

### 4. Assignment Logic
- Replace AGENTS_CONFIG_JSON with database lookup
- `agent-config.ts` reads from database instead of env var
- `agent-dispatch.ts` filters by enabled=true
- Respect configuration mode:
  - Run all: dispatch all enabled agents
  - Max N: randomly sample N enabled agents
  - Manual: skip auto-dispatch, only sync @mentions from comments

### 5. Impact on Issues
- **Active issues** (open/in_progress with arena:ready label):
  - Respect current configuration mode
  - If agent disabled: no new dispatches, preserve existing issue_agents records
  - If mode changes: apply new logic to future dispatches only
- **Future issues** (new issues with arena:ready label):
  - Apply current configuration mode from first dispatch

## Technical Design

### Database Schema Changes

#### New `agents` Table
```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,              -- lowercase identifier (e.g., "cursor")
  display_name TEXT NOT NULL,             -- human-readable name (e.g., "Cursor")
  linear_user_id TEXT NOT NULL UNIQUE,    -- Linear API user ID
  email TEXT,                              -- agent email address
  avatar_url TEXT,                         -- profile image URL
  is_active BOOLEAN NOT NULL DEFAULT true, -- currently in workspace
  is_enabled BOOLEAN NOT NULL DEFAULT true,-- admin enabled/disabled
  discovered_at TIMESTAMP NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMP NOT NULL DEFAULT now(),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_agents_enabled ON agents(is_enabled) WHERE is_enabled = true;
CREATE INDEX idx_agents_active ON agents(is_active) WHERE is_active = true;
```

#### New `agent_config` Table (Singleton)
```sql
CREATE TABLE agent_config (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  mode TEXT NOT NULL DEFAULT 'all',       -- 'all' | 'max_n' | 'manual'
  max_agents INTEGER DEFAULT NULL,        -- only used if mode='max_n', min 2
  last_discovery_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 'singleton'),
  CONSTRAINT valid_mode CHECK (mode IN ('all', 'max_n', 'manual')),
  CONSTRAINT valid_max_agents CHECK (max_agents IS NULL OR max_agents >= 2)
);
```

### API Endpoints

#### `GET /api/agents`
- Returns all agents with active/enabled status
- Used by admin UI page
- Response:
```typescript
{
  agents: Array<{
    id: string
    name: string
    displayName: string
    linearUserId: string
    email: string | null
    avatarUrl: string | null
    isActive: boolean
    isEnabled: boolean
    discoveredAt: string
    lastSeenAt: string
  }>
}
```

#### `POST /api/agents/discover`
- Triggers agent discovery from Linear API
- Queries Linear workspace users
- Filters to identify agents (exclude humans)
- Inserts/updates agents table
- Returns discovery results
- Response:
```typescript
{
  discovered: number
  updated: number
  deactivated: number
}
```

#### `PATCH /api/agents/:id`
- Updates agent enabled status
- Request body: `{ isEnabled: boolean }`
- Used by admin UI toggle

#### `GET /api/agents/config`
- Returns current agent configuration
- Response:
```typescript
{
  mode: 'all' | 'max_n' | 'manual'
  maxAgents: number | null
  lastDiscoveryAt: string | null
}
```

#### `PATCH /api/agents/config`
- Updates agent configuration
- Request body:
```typescript
{
  mode: 'all' | 'max_n' | 'manual'
  maxAgents?: number  // required if mode='max_n'
}
```

### Agent Discovery Function

```typescript
// src/lib/agent-discovery.ts

/**
 * Discovers agents from Linear API workspace
 * Filters users to identify coding agents
 * Updates agents table with active status
 */
export async function discoverAgents(): Promise<{
  discovered: number
  updated: number
  deactivated: number
}> {
  const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY })

  // Query all users in workspace
  const users = await client.users()

  // Filter to identify agents
  // Primary heuristic: OAuth app email pattern (@oauthapp.linear.app)
  // This is the most reliable indicator based on actual workspace data
  const agents = users.nodes.filter(isAgent)

  // Upsert to agents table
  let discovered = 0
  let updated = 0

  for (const agent of agents) {
    const result = await db.insert(agents).values({
      name: agent.name.toLowerCase(),
      displayName: agent.displayName,
      linearUserId: agent.id,
      email: agent.email,
      avatarUrl: agent.avatarUrl,
      isActive: true,
      lastSeenAt: new Date(),
    }).onConflictDoUpdate({
      target: agents.linearUserId,
      set: {
        displayName: agent.displayName,
        email: agent.email,
        avatarUrl: agent.avatarUrl,
        isActive: true,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      },
    })

    // Track whether this was insert or update
    // ...
  }

  // Mark agents not seen as inactive
  const deactivated = await db.update(agents)
    .set({ isActive: false })
    .where(/* not in current agent list */)

  // Update last_discovery_at in agent_config
  await db.update(agentConfig)
    .set({ lastDiscoveryAt: new Date() })
    .where(eq(agentConfig.id, 'singleton'))

  return { discovered, updated, deactivated }
}

/**
 * Checks if Linear user is a coding agent
 *
 * Primary detection method: OAuth app email pattern
 * Coding agents authenticate via OAuth and get emails like:
 * {uuid}@oauthapp.linear.app
 *
 * Example agents from actual workspace:
 * - cursor: afd5064f-8c2e-4f60-a91a-2b753321d325@oauthapp.linear.app
 * - engine: 19b2fc19-10a3-4502-b030-417149f1fe3e@oauthapp.linear.app
 * - factory: 32620278-3ad5-4ca3-b0ab-40adf0f14a74@oauthapp.linear.app
 * - cyrus: c03d5b6e-5b75-4c2a-b656-d519cec2fc25@oauthapp.linear.app
 * - notionai: f305bf89-adf0-494b-ba3b-a9e3f9d16054@oauthapp.linear.app
 *
 * Human users have real email addresses:
 * - andrew@textile.io
 * - carson@textile.io
 * - etc.
 */
function isAgent(user: LinearUser): boolean {
  // Primary heuristic: OAuth app email pattern
  // This is the most reliable indicator based on actual Linear workspace data
  if (user.email && user.email.endsWith('@oauthapp.linear.app')) {
    return true
  }

  // Fallback: Check for guest users (shouldn't be agents)
  // Guest users are external contractors/collaborators with real emails
  if (user.guest) {
    return false
  }

  return false
}
```

### Updated Agent Configuration

```typescript
// src/lib/agent-config.ts (refactored)

/**
 * Gets enabled agents from database
 * Replaces AGENTS_CONFIG_JSON env var approach
 */
export async function getAgentConfigs(): Promise<AgentConfig[]> {
  const enabledAgents = await db
    .select({
      name: agents.name,
      handle: agents.displayName,
    })
    .from(agents)
    .where(and(
      eq(agents.isActive, true),
      eq(agents.isEnabled, true)
    ))

  return enabledAgents.map(a => ({
    name: a.name,
    handle: `@${a.handle}`,
  }))
}

/**
 * Gets agents to dispatch for an issue
 * Respects configuration mode (all, max_n, manual)
 */
export async function getAgentsForDispatch(): Promise<AgentConfig[]> {
  const config = await getAgentConfig()

  if (config.mode === 'manual') {
    // No auto-dispatch in manual mode
    return []
  }

  const enabledAgents = await getAgentConfigs()

  if (config.mode === 'all') {
    return enabledAgents
  }

  if (config.mode === 'max_n') {
    // Random sample of maxAgents
    return shuffleArray(enabledAgents).slice(0, config.maxAgents)
  }

  return []
}

/**
 * Gets current agent configuration
 */
async function getAgentConfig(): Promise<AgentConfig> {
  const config = await db
    .select()
    .from(agentConfig)
    .where(eq(agentConfig.id, 'singleton'))
    .limit(1)

  if (!config[0]) {
    // Create default config
    await db.insert(agentConfig).values({
      id: 'singleton',
      mode: 'all',
      maxAgents: null,
    })
    return { mode: 'all', maxAgents: null }
  }

  return config[0]
}
```

### Updated Agent Dispatch

```typescript
// src/lib/agent-dispatch.ts (updated)

/**
 * Dispatches missing agents to an issue
 * Respects enabled status and configuration mode
 */
export async function dispatchMissingAgents(dbIssueId: string): Promise<void> {
  // Get agents to dispatch (respects config mode)
  const agentsToDispatch = await getAgentsForDispatch()

  if (agentsToDispatch.length === 0) {
    // Manual mode or no enabled agents
    return
  }

  // Rest of dispatch logic unchanged
  // ...
}
```

### Admin UI Page

```typescript
// src/app/admin/agents/page.tsx

export default async function AdminAgentsPage() {
  const agents = await getAgents()
  const config = await getAgentConfig()

  return (
    <main className="container mx-auto p-6">
      <h1>Agent Configuration</h1>

      {/* Configuration Mode Section */}
      <Card>
        <CardHeader>
          <CardTitle>Assignment Mode</CardTitle>
        </CardHeader>
        <CardContent>
          <ConfigModeForm currentMode={config.mode} maxAgents={config.maxAgents} />
        </CardContent>
      </Card>

      {/* Discovery Section */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Discovery</CardTitle>
          <CardDescription>
            Last discovered: {config.lastDiscoveryAt}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DiscoverButton />
        </CardContent>
      </Card>

      {/* Agents Table Section */}
      <Card>
        <CardHeader>
          <CardTitle>Agents</CardTitle>
        </CardHeader>
        <CardContent>
          <AgentsTable agents={agents} />
        </CardContent>
      </Card>
    </main>
  )
}
```

```typescript
// src/components/AgentsTable.tsx (Client Component)

'use client'

export function AgentsTable({ agents }: { agents: Agent[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Agent</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last Seen</TableHead>
          <TableHead>Enabled</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {agents.map(agent => (
          <TableRow key={agent.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                {agent.avatarUrl && (
                  <img src={agent.avatarUrl} className="h-8 w-8 rounded-full" />
                )}
                <div>
                  <div className="font-medium">{agent.displayName}</div>
                  <div className="text-sm text-muted-foreground">{agent.email}</div>
                </div>
              </div>
            </TableCell>
            <TableCell>
              {agent.isActive ? (
                <Badge variant="success">Active</Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </TableCell>
            <TableCell>{formatRelativeTime(agent.lastSeenAt)}</TableCell>
            <TableCell>
              <EnableToggle agentId={agent.id} enabled={agent.isEnabled} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

```typescript
// src/components/ConfigModeForm.tsx (Client Component)

'use client'

export function ConfigModeForm({ currentMode, maxAgents }: Props) {
  const [mode, setMode] = useState(currentMode)
  const [maxN, setMaxN] = useState(maxAgents ?? 5)

  async function handleSubmit() {
    await fetch('/api/agents/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, maxAgents: mode === 'max_n' ? maxN : null }),
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div>
          <label>
            <input type="radio" value="all" checked={mode === 'all'} onChange={e => setMode(e.target.value)} />
            Run all agents - Assign all enabled agents to every issue
          </label>
        </div>

        <div>
          <label>
            <input type="radio" value="max_n" checked={mode === 'max_n'} onChange={e => setMode(e.target.value)} />
            Max N agents - Random sample of N enabled agents
          </label>
          {mode === 'max_n' && (
            <input
              type="number"
              min={2}
              value={maxN}
              onChange={e => setMaxN(Number(e.target.value))}
            />
          )}
        </div>

        <div>
          <label>
            <input type="radio" value="manual" checked={mode === 'manual'} onChange={e => setMode(e.target.value)} />
            Manual assignment only - No auto-assignment, listen for @mentions
          </label>
        </div>

        <button type="submit">Save Configuration</button>
      </div>
    </form>
  )
}
```

### Discovery Integration Points

#### 1. Server Startup
```typescript
// src/instrumentation.ts (updated)

export async function register() {
  if (process.env['NEXT_RUNTIME'] === 'nodejs') {
    const { discoverAgents } = await import('@/lib/agent-discovery')
    const { reconcileLinearIssues } = await import('@/lib/linear-reconcile')

    // Discover agents first
    await discoverAgents()

    // Then reconcile issues
    await reconcileLinearIssues()
  }
}
```

#### 2. Hourly Reconciliation
```typescript
// src/app/api/linear/reconcile/route.ts (updated)

export async function GET() {
  // Discover agents first
  await discoverAgents()

  // Then reconcile issues
  await reconcileLinearIssues()

  return NextResponse.json({ success: true })
}
```

#### 3. Dashboard Page Load
```typescript
// src/app/page.tsx (updated)

export default async function Home() {
  // Check if discovery is stale (> 1 hour old)
  const config = await getAgentConfig()
  const staleThreshold = new Date(Date.now() - 60 * 60 * 1000) // 1 hour

  if (!config.lastDiscoveryAt || new Date(config.lastDiscoveryAt) < staleThreshold) {
    // Trigger discovery in background (don't await)
    discoverAgents().catch(console.error)
  }

  // Rest of page logic
  // ...
}
```

#### 4. Issue Detail Page Load
```typescript
// src/app/issues/[id]/page.tsx (updated)

export default async function IssuePage({ params }: Props) {
  // Check if discovery is stale
  const config = await getAgentConfig()
  const staleThreshold = new Date(Date.now() - 60 * 60 * 1000) // 1 hour

  if (!config.lastDiscoveryAt || new Date(config.lastDiscoveryAt) < staleThreshold) {
    // Trigger discovery in background
    discoverAgents().catch(console.error)
  }

  // Rest of page logic
  // ...
}
```

## Implementation Strategy

### Phased Approach
This implementation is organized into **3 milestones** to deliver incremental value:

**Milestone 1: Admin Page & Agent Discovery** (5 days)
- Get the admin page UI working with live data
- Implement agent discovery function with known agents list
- Create database tables and API endpoints
- Show agents table updating in real-time with spinner
- UI for settings (non-functional placeholders)

**Milestone 2: Wire to Production** (4 days)
- Replace AGENTS_CONFIG_JSON env var with database queries
- Update agent-config.ts to read from agents table
- Update agent-dispatch.ts to filter by enabled agents
- Comprehensive testing of integrated system

**Milestone 3: Configuration Modes** (5 days)
- Implement run all / max N / manual assignment modes
- Wire up settings UI from Milestone 1
- Add mode logic to dispatch system
- Discovery integration points (startup, reconciliation, page loads)

Total: 14 days

### Known Agents List
Maintain a list of verified coding agents in environment variable:
```
KNOWN_CODING_AGENTS=cursor,engine,factory,cyrus
```

**Default enabled behavior:**
- Known agents (in KNOWN_CODING_AGENTS): `enabled=true` by default
- Unknown agents (not in list): `enabled=false` by default (may be non-coding agents like Notion AI)
- User can override via admin UI

## Implementation Tasks

## Milestone 1: Admin Page & Agent Discovery

### Phase 1: Database Schema & Migration (1 day)

1. **Create migration script**
   - Add `agents` table with all fields
   - Add `agent_config` singleton table
   - Add indexes for performance
   - Migrate existing AGENTS_CONFIG_JSON data to agents table
   - File: `scripts/migrations/0005_create_agents_tables.sql`

2. **Update Drizzle schema**
   - Define agents table schema
   - Define agentConfig table schema
   - Export types for TypeScript
   - File: `src/db/schema.ts`

3. **Run migration**
   - Execute migration script
   - Verify tables created
   - Verify data migrated from env var

### Phase 2: Agent Discovery (3 days)

4. **Implement agent discovery function**
   - Create `src/lib/agent-discovery.ts`
   - Implement `discoverAgents()` function
   - Implement `isAgent()` heuristics
   - Query Linear API for workspace users
   - Filter to identify agents
   - Upsert to agents table
   - Mark inactive agents
   - Update last_discovery_at

5. **Create POST /api/agents/discover endpoint**
   - File: `src/app/api/agents/discover/route.ts`
   - Call `discoverAgents()` function
   - Return discovery results
   - Handle errors gracefully

6. **Integrate discovery into entry points**
   - Update `src/instrumentation.ts` (server startup)
   - Update `src/app/api/linear/reconcile/route.ts` (hourly cron)
   - Update `src/app/page.tsx` (dashboard page load, stale check)
   - Update `src/app/issues/[id]/page.tsx` (issue detail page load, stale check)

### Phase 3: Agent Configuration Refactor (2 days)

7. **Refactor agent-config.ts**
   - Update `getAgentConfigs()` to read from database
   - Implement `getAgentsForDispatch()` with mode logic
   - Implement `getAgentConfig()` helper
   - Add fallback for empty database (dev environments)
   - Remove AGENTS_CONFIG_JSON env var dependency
   - File: `src/lib/agent-config.ts`

8. **Update agent-dispatch.ts**
   - Use `getAgentsForDispatch()` instead of `getAgentConfigs()`
   - Respect manual mode (skip auto-dispatch)
   - Respect max_n mode (random sample)
   - File: `src/lib/agent-dispatch.ts`

### Phase 4: API Endpoints (2 days)

9. **Create GET /api/agents endpoint**
   - Return all agents with active/enabled status
   - File: `src/app/api/agents/route.ts`

10. **Create PATCH /api/agents/[id]/route.ts endpoint**
    - Update agent enabled status
    - Validate request body
    - Return updated agent

11. **Create GET /api/agents/config endpoint**
    - Return current configuration (mode, maxAgents, lastDiscoveryAt)
    - File: `src/app/api/agents/config/route.ts`

12. **Create PATCH /api/agents/config endpoint**
    - Update configuration mode
    - Validate maxAgents if mode=max_n
    - Return updated config
    - File: `src/app/api/agents/config/route.ts`

### Phase 5: Admin UI (4 days)

13. **Create admin agents page**
    - File: `src/app/admin/agents/page.tsx`
    - Server component that fetches agents and config
    - Layout with configuration, discovery, and agents sections

14. **Create AgentsTable component**
    - File: `src/components/AgentsTable.tsx`
    - Client component with enable/disable toggles
    - Display agent avatar, name, email, active status
    - Format relative timestamps

15. **Create ConfigModeForm component**
    - File: `src/components/ConfigModeForm.tsx`
    - Client component with radio buttons for mode
    - Number input for maxAgents (when mode=max_n)
    - Submit handler that calls PATCH /api/agents/config

16. **Create DiscoverButton component**
    - File: `src/components/DiscoverButton.tsx`
    - Client component with button to trigger discovery
    - Calls POST /api/agents/discover
    - Shows loading state and results

17. **Create EnableToggle component**
    - File: `src/components/EnableToggle.tsx`
    - Client component with toggle switch
    - Calls PATCH /api/agents/:id
    - Optimistic UI updates

18. **Add navigation link to admin page**
    - Update `src/components/Navigation.tsx`
    - Add link to /admin/agents

### Phase 6: Testing (3 days)

19. **Unit tests for agent-discovery.ts**
    - Test `isAgent()` heuristics
    - Test `discoverAgents()` upsert logic
    - Test inactive agent marking
    - Mock Linear API responses
    - File: `src/lib/agent-discovery.test.ts`

20. **Unit tests for refactored agent-config.ts**
    - Test `getAgentConfigs()` database query
    - Test `getAgentsForDispatch()` mode logic
    - Test random sampling for max_n mode
    - Test manual mode returns empty array
    - File: `src/lib/agent-config.test.ts`

21. **Integration tests for API endpoints**
    - Test GET /api/agents
    - Test POST /api/agents/discover
    - Test PATCH /api/agents/:id
    - Test GET /api/agents/config
    - Test PATCH /api/agents/config validation
    - File: `src/app/api/agents/*.test.ts`

22. **Integration tests for admin UI page**
    - Test page renders with agents
    - Test empty state
    - Test enable/disable toggle interactions
    - Test config mode form submission
    - Test discover button
    - File: `src/app/admin/agents/page.test.tsx`

23. **E2E tests for discovery integration**
    - Test server startup discovery
    - Test reconciliation discovery
    - Test stale check on page loads
    - File: `src/lib/agent-discovery.integration.test.ts`

24. **Update existing tests**
    - Update tests that use AGENTS_CONFIG_JSON
    - Mock database queries in agent-config.ts tests
    - Verify all 413+ tests still pass

## Testing Strategy

### Unit Tests
- **agent-discovery.ts**: Mock Linear API, test heuristics and upsert logic
- **agent-config.ts**: Mock database queries, test mode logic and random sampling
- **API routes**: Mock database operations, test validation and error handling

### Integration Tests
- **API endpoints**: Use test database, verify full request/response cycle
- **Admin UI page**: Test component interactions with mocked fetch
- **Discovery integration**: Test entry point triggers with test database

### Coverage Requirements
- Maintain 90% coverage across all metrics
- Test all configuration modes (all, max_n, manual)
- Test enable/disable flows
- Test discovery with various Linear API responses
- Test stale discovery detection

### Edge Cases to Test
1. **Empty agents table**: Should handle gracefully, show empty state
2. **All agents disabled**: Should show warning in admin UI
3. **max_n > enabled agents**: Should dispatch all enabled agents
4. **max_n = 1**: Should fail validation (min 2)
5. **Manual mode with @mentions**: Should still sync from comments
6. **Discovery API error**: Should not crash server, log error
7. **Stale discovery check**: Should trigger background discovery
8. **Concurrent discovery calls**: Should handle race conditions

## Migration Strategy

### Backward Compatibility
1. **Keep AGENTS_CONFIG_JSON as fallback**
   - If agents table is empty, read from env var
   - Log deprecation warning
   - Provides smooth transition for dev environments

2. **Migrate existing issue_agents records**
   - No changes needed (agent_name is still text)
   - Future dispatches will use new system

### Rollout Plan
1. Deploy database migration (Phase 1)
2. Deploy discovery function and API (Phase 2)
3. Run initial discovery to populate agents table
4. Deploy agent-config refactor (Phase 3)
5. Verify existing issues still work
6. Deploy API endpoints (Phase 4)
7. Deploy admin UI (Phase 5)
8. Remove AGENTS_CONFIG_JSON env var (after verification)

## Success Criteria

1. **Discovery works automatically**
   - Agents discovered on server startup
   - Agents discovered during hourly reconciliation
   - Agents discovered when dashboard/issue pages load (if stale)
   - Linear API users correctly filtered to agents

2. **Admin UI is functional**
   - Page displays all agents with correct status
   - Enable/disable toggles work
   - Configuration mode changes work
   - max_n validation works (min 2)
   - Discovery button triggers discovery

3. **Assignment logic respects configuration**
   - Run all mode: all enabled agents dispatched
   - Max N mode: random sample of N agents dispatched
   - Manual mode: no auto-dispatch, @mentions still work

4. **Migration is smooth**
   - Existing issues unchanged
   - Existing issue_agents records preserved
   - No downtime during deployment

5. **Tests pass and coverage maintained**
   - All 413+ existing tests still pass
   - New tests added for discovery, config, admin UI
   - Coverage stays above 90% threshold

## Implementation Notes

### Agent Identification Method
The `isAgent()` function uses a **robust, production-ready heuristic** based on actual Linear workspace data:

**Primary Method: OAuth App Email Pattern**
- Coding agents authenticate via Linear OAuth apps
- They receive email addresses matching: `{uuid}@oauthapp.linear.app`
- This pattern is **100% reliable** for distinguishing agents from humans
- Human users always have real email addresses (e.g., user@company.com)

**Verified agents in workspace:**
- cursor: `afd5064f-8c2e-4f60-a91a-2b753321d325@oauthapp.linear.app`
- engine: `19b2fc19-10a3-4502-b030-417149f1fe3e@oauthapp.linear.app`
- factory: `32620278-3ad5-4ca3-b0ab-40adf0f14a74@oauthapp.linear.app`
- cyrus: `c03d5b6e-5b75-4c2a-b656-d519cec2fc25@oauthapp.linear.app`
- notionai: `f305bf89-adf0-494b-ba3b-a9e3f9d16054@oauthapp.linear.app`

**Why this is better than alternatives:**
- ❌ Name keywords ("bot", "agent") - unreliable, could match humans
- ❌ Email domains - doesn't work, agents don't use service domains
- ❌ Bot flag - doesn't exist in Linear API user model
- ✅ OAuth app email pattern - deterministic, no false positives

**Future enhancements:**
- Manual override in admin UI (if non-OAuth agents exist)
- Exclude specific OAuth apps (if non-agent apps use same pattern)

### Random Sampling Algorithm
For max_n mode, use Fisher-Yates shuffle for unbiased random sampling:

```typescript
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
  }
  return shuffled
}
```

### Stale Discovery Threshold
Discovery is considered stale if `lastDiscoveryAt` is older than 1 hour. This prevents excessive API calls while keeping data fresh. Configurable via environment variable:

```typescript
const DISCOVERY_STALE_THRESHOLD_MS = Number(process.env.AGENT_DISCOVERY_STALE_MS) || 60 * 60 * 1000
```

### Performance Considerations
1. **Discovery on page load**: Run in background (don't await), don't block page render
2. **Database indexes**: Index on `is_enabled` and `is_active` for fast filtering
3. **Caching**: Consider caching enabled agents list for 1 minute to reduce DB queries

### Security Considerations
1. **No authentication yet**: Admin page is unprotected (per requirements)
2. **Future auth**: Add authentication middleware to `/admin/*` routes
3. **API validation**: Validate all PATCH request bodies to prevent injection
4. **Rate limiting**: Consider rate limiting discovery endpoint (expensive Linear API call)

## Timeline Estimate

- **Phase 1 (Database)**: 2 days
- **Phase 2 (Discovery)**: 3 days
- **Phase 3 (Refactor)**: 2 days
- **Phase 4 (API)**: 2 days
- **Phase 5 (Admin UI)**: 4 days
- **Phase 6 (Testing)**: 3 days

**Total**: 16 days (assumes 1 developer, serial work)

Parallelization opportunities:
- Phase 4 (API) and Phase 5 (Admin UI) can overlap (2 days saved)
- Adjusted total: 14 days with parallelization

## Future Enhancements

1. **Agent performance tracking**
   - Track acceptance rate per agent
   - Show performance metrics in admin UI
   - Auto-disable poorly performing agents

2. **Agent-specific configuration**
   - Allowlist/denylist agents per issue label
   - Agent skill tags (frontend, backend, ML)
   - Match agents to issue types

3. **Discovery scheduling**
   - Configurable discovery frequency
   - Manual discovery override in admin UI
   - Webhook from Linear when users added/removed

4. **Advanced sampling strategies**
   - Weighted random sampling by performance
   - Round-robin agent assignment
   - Load balancing (avoid overloading agents)

5. **Authentication and authorization**
   - Add auth middleware to admin routes
   - Role-based access control (admin vs viewer)
   - Audit log for configuration changes

6. **Multi-workspace support**
   - Support multiple Linear workspaces
   - Separate agent lists per workspace
   - Cross-workspace agent comparison
