# Sub-Issue Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate from comment-based agent coordination to sub-issue-based coordination while maintaining backwards compatibility

**Architecture:** Hybrid approach - create one sub-issue per agent for isolated work tracking, while preserving existing comment parsing and PR attribution logic

**Tech Stack:** Linear API (GraphQL), Drizzle ORM (PostgreSQL), Next.js API routes, TypeScript

---

## Section 1: Research Findings & Current Architecture

### 1.1 Executive Summary

**Migration Goal:** Transition from comment-based agent coordination to sub-issue-based coordination in the Coding Arena system.

**Why This Migration:**
- Current system dispatches agents by posting comments like "Agent 1: @agent1" on the parent issue
- Agents struggle to parse long comment threads to understand which work is assigned to them
- Comment-based coordination creates cognitive overhead for Claude agents navigating threaded discussions
- Sub-issues provide isolated, dedicated issue assignments per agent
- Each agent gets a clean workspace without parsing comment noise

**Migration Approach:**
- Hybrid system that preserves existing logic while adding sub-issue support
- Create one sub-issue per agent, linked via Linear's parentId
- Maintain existing comment parsing for backwards compatibility during transition
- Preserve PR attribution logic that walks comment threads
- Extend issueAgents table to track sub-issue IDs
- Support both old (comment-based) and new (sub-issue-based) coordination methods

### 1.2 Current System Architecture

#### 1.2.1 Issue Detection & Webhook Processing

**Primary Entry Point:** `/Users/andrewhill/Coding/coding-arena/src/app/api/linear/webhook/route.ts`

Linear webhooks are received and trigger the following flow:
1. Issue labeled with `arena:ready` → webhook fires
2. System creates issue record in database
3. Syncs full metadata from Linear API
4. Dispatches agents via `dispatchMissingAgents()`

**Cron-Based Detection:** `/Users/andrewhill/Coding/coding-arena/src/app/api/linear/reconcile/route.ts`
- Runs hourly to catch missed webhooks
- Fetches all issues with `arena:ready` label
- Syncs metadata and agent statuses

#### 1.2.2 Agent Dispatch via Comments

**File:** `/Users/andrewhill/Coding/coding-arena/src/lib/agent-dispatch.ts`

Current dispatch flow:
1. Identifies agents not yet dispatched
2. Creates `issueAgents` record with `onConflictDoNothing()` (atomic lock)
3. If insert succeeds, creates Linear comment mentioning agent
4. If insert fails, another process already dispatched (race protection)

**Atomic Operation Pattern:**
```typescript
const insertResult = await db
  .insert(issueAgents)
  .values({
    issueId: dbIssueId,
    agentName,
    status: 'pending',
    triggeredAt: new Date(),
  })
  .onConflictDoNothing({
    target: [issueAgents.issueId, issueAgents.agentName],
  })
  .returning({ id: issueAgents.id })

if (insertResult.length === 0) {
  console.log('Agent already dispatched, skipping')
  continue
}
```

#### 1.2.3 PR Tracking & Attribution

**GitHub Webhook Handler:** `/Users/andrewhill/Coding/coding-arena/src/app/api/github/webhook/route.ts`

PR lifecycle:
1. PR opened → webhook with action='opened'
2. PR merged → webhook with action='closed', merged=true
3. PR closed without merge → webhook with action='closed', merged=false

**PR Attribution Logic:** `/Users/andrewhill/Coding/coding-arena/src/lib/linear-sync.ts`

Walks Linear comment threads to find agent mentions:
```typescript
async function determineAgentOwnershipFromThread(
  commentId: string,
  mentionedAgents: string[],
  commentAgents: Map<string, string[]>,
  commentParents: Map<string, string | null>
): Promise<string> {
  // Check current comment for mentions
  if (mentionedAgents.length > 0) return mentionedAgents[0]

  // Walk up parent chain to find @mention
  let currentId = commentId
  while (currentId) {
    const agents = commentAgents.get(currentId) ?? []
    if (agents.length > 0) return agents[0]
    currentId = commentParents.get(currentId) ?? null
  }

  return 'unknown'
}
```

#### 1.2.4 IssueAgents Table & Status Lifecycle

**Schema:** `/Users/andrewhill/Coding/coding-arena/src/db/schema.ts`

```typescript
export const issueAgents = pgTable('issue_agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  issueId: uuid('issue_id').references(() => issues.id).notNull(),
  agentName: text('agent_name').notNull(),
  status: text('status').notNull().default('pending'),
  externalJobId: text('external_job_id'),
  triggeredAt: timestamp('triggered_at'),
}, (table) => ({
  uniqueIssueAgent: unique().on(table.issueId, table.agentName),
}))
```

**Status Lifecycle:**
- `pending` → Agent dispatched but no PR yet
- `submitted` → Agent opened PR
- `accepted` → Agent's PR merged (winner)
- `rejected` → Agent's PR closed or another agent won
- `ignored` → Issue closed without agent submitting PR
- `dispatch_failed` → Failed to dispatch (retry allowed)

#### 1.2.5 Deduplication Mechanisms

**Three layers of protection:**

1. **Database unique constraints** - `(issueId, agentName)` prevents duplicates
2. **onConflictDoNothing()** - Returns empty array if conflict, code detects and skips
3. **Defensive Linear API checks** - Fetches recent comments before creating new ones

**Webhook deduplication:** `/Users/andrewhill/Coding/coding-arena/src/app/api/linear/webhook/route.ts`
- Time-window deduplication (5 second window)
- Event key idempotency check using `events` table

### 1.3 Linear API Capabilities

#### 1.3.1 Creating Sub-Issues with parentId

**GraphQL Mutation:**
```graphql
mutation CreateSubIssue {
  issueCreate(
    input: {
      title: "Sub-issue Title"
      teamId: "TEAM_ID"
      parentId: "PARENT_ISSUE_ID"
      assigneeId: "AGENT_USER_ID"
    }
  ) {
    success
    issue {
      id
      identifier
      parent { id }
    }
  }
}
```

**Linear SDK Usage:**
```typescript
import { LinearClient } from '@linear/sdk'

const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY })
const subIssue = await client.createIssue({
  teamId: 'team-id',
  title: 'Sub-issue title',
  parentId: 'parent-id',
  assigneeId: 'agent-user-id',
})
```

#### 1.3.2 Parent-Child Relationships

**Bidirectional access:**
```typescript
// From parent, get children
const parent = await client.issue('parent-id')
const children = await parent.children()

// From child, get parent
const child = await client.issue('child-id')
const parent = await child.parent
```

**Linear does NOT auto-close sub-issues** when parent closes - must handle explicitly

#### 1.3.3 Webhook Events

Webhook payload includes `parentId` field for sub-issues:
```typescript
{
  type: 'Issue',
  action: 'create' | 'update' | 'remove',
  data: {
    id: string,
    parentId?: string,  // Present if this is a sub-issue
    // ... other fields
  }
}
```

### 1.4 GitHub API Integration

**PR merged vs closed detection:**
```typescript
if (pull_request.state === 'closed') {
  if (pull_request.merged === true) {
    // PR was merged
    await handlePRMerged(pull_request)
  } else {
    // PR was closed without merge
    await handlePRClosed(pull_request)
  }
}
```

### 1.5 Current Data Model

**Three core tables:**

1. **issues** - Linear issues with `arena:ready` label
2. **attempts** - Multiple attempts to solve an issue
3. **issueAgents** - Individual agent assignments

**Foreign key hierarchy:**
```
issues (1) ──< (many) attempts (1) ──< (many) issueAgents
```

**Unique constraints:**
- `issues.linearId` - One issue per Linear ID
- `attempts(issueId, attemptNumber)` - Sequential attempt numbers
- `issueAgents(issueId, agentName)` - One agent per issue

---

## Section 2: Requirements, Edge Cases & User Flows

### 2.1 Core Requirements

**Primary Goal:** Create a dedicated Linear sub-issue for each enabled agent

**Key Constraints:**
- Sub-issues created only when needed (see edge cases)
- Existing comment-based flow continues to work
- Parent issue assignment and manual mentions respected
- Deduplication prevents duplicate sub-issue creation

### 2.2 Edge Cases & Compatibility Scenarios

#### 2.2.1 Edge Case 1: Parent Issue Pre-Assigned to Agent

**Scenario:**
```
Parent Issue: LINEAR-123 "Add dark mode"
Assignee: agent-frontend
Enabled Agents: [agent-frontend, agent-backend, agent-qa]
```

**Expected:**
- Monitor agent-frontend via comments on LINEAR-123 (no sub-issue)
- Create sub-issues for agent-backend and agent-qa only

#### 2.2.2 Edge Case 2: Manual Agent Mentions in Comments

**Scenario:**
```
Parent Issue: LINEAR-200
Comment: "@agent-backend can you review? @agent-qa please test"
Enabled Agents: [agent-backend, agent-qa, agent-security]
```

**Expected:**
- Parse comments to detect mentions
- Monitor agent-backend and agent-qa via comments
- Create sub-issue only for agent-security

#### 2.2.3 Edge Case 3: Preventing Duplicate Sub-Issues

**Deduplication strategy:**
- Database check: Query `issueAgents` for existing assignment
- Linear API check: Query for existing sub-issues
- Idempotency key with 5-minute TTL

#### 2.2.4 Edge Case 4: Combined Pre-Assignment + Manual Mentions

**Scenario:**
```
Parent: LINEAR-300
Assignee: agent-backend
Comment: "@agent-security please audit"
Enabled: [agent-backend, agent-security, agent-frontend, agent-qa]
```

**Expected:**
- agent-backend → monitored via comments (assigned)
- agent-security → monitored via comments (mentioned)
- agent-frontend → sub-issue created
- agent-qa → sub-issue created

### 2.3 User Flows

#### Flow 1: Standard Sub-Issue Creation (No User Intervention)

```
1. User creates LINEAR-400 "Implement rate limiting"
2. User adds labels: #agent-backend, #agent-security, #agent-qa
3. Linear webhook fires
4. System discovers 3 enabled agents
5. System checks: no assignee, no mentions
6. System creates 3 sub-issues:
   - LINEAR-401 (agent-backend)
   - LINEAR-402 (agent-security)
   - LINEAR-403 (agent-qa)
7. Each agent receives webhook for their sub-issue
```

#### Flow 2: Parent Issue Pre-Assigned

```
1. User creates LINEAR-500 "Fix memory leak"
2. User assigns LINEAR-500 to agent-backend
3. System detects assignee = agent-backend
4. System creates sub-issues only for agent-devops and agent-qa
5. agent-backend monitors parent LINEAR-500 via comments
```

#### Flow 3: Manual Agent Mentions

```
1. User creates LINEAR-600 "Upgrade React"
2. User comments: "@agent-frontend handle component updates"
3. System parses mention
4. System creates sub-issue only for agent-qa (not mentioned)
5. agent-frontend monitors parent via comments
```

#### Flow 4: Agent Needs Feedback

```
1. agent-backend working on sub-issue LINEAR-401
2. agent-backend comments: "Need clarification on rate limit"
3. System detects: comment without PR link
4. System sets feedback_needed = true
5. Parent shows status: "⏸️ Waiting for feedback"
```

#### Flow 5: User Responds to Feedback

```
1. User sees "Waiting for feedback" status
2. User comments on LINEAR-401: "Use 1000 req/min"
3. System detects: non-agent comment after feedback request
4. System sets feedback_needed = false
5. agent-backend resumes work
```

#### Flow 6: Agent Submits PR

**Scenario A: Sub-issue**
```
1. agent-backend posts PR link to LINEAR-401
2. System updates issueAgents with PR URL
3. System transitions LINEAR-401 to "In Review"
4. Parent shows: "agent-backend: ✅ PR submitted"
```

**Scenario B: Parent issue (no sub-issue)**
```
1. agent-frontend posts PR link to parent LINEAR-600
2. System updates issueAgents (where sub_issue_id IS NULL)
3. System transitions LINEAR-600 to "In Review"
```

### 2.4 Feedback Status Tracking

**Feedback needed detection:**
- Comment author matches assigned agent
- Comment has no PR link regex match
- Comment contains question marks OR keywords (clarification, unclear, etc.)

**User response detection:**
- Comment author is NOT an agent
- Comment on sub-issue with feedback_needed=true
- Comment timestamp > feedback_requested_at

### 2.5 Multi-Provider Data Model Strategy

**Source tracking:**
- Add `issueSource` field: 'linear' | 'github'
- Add `sourceUrl` field for full URL
- Compound unique constraint: `(issue_id, source)`

**Provider abstraction:**
```typescript
interface IssueProvider {
  source: 'linear' | 'github'
  createSubIssue(parent: Issue, agent: Agent): Promise<Issue>
  postComment(issueId: string, body: string): Promise<void>
  // ... other methods
}
```

### 2.6 Backward Compatibility

**Guarantees:**
- Issues created before migration continue using comment flow
- Comment parsing continues to work
- PR link detection regex unchanged
- Status lifecycle maintained

---

## Section 3: Data Model Changes

### 3.1 New Database Fields

**Issues Table:**
- `parentLinearId` (TEXT, nullable) - Links sub-issues to parent
- `issueSource` (TEXT, NOT NULL, default 'linear') - Tracks provider

**IssueAgents Table:**
- `subIssueLinearId` (TEXT, nullable) - Which sub-issue agent is working on
- `feedbackStatus` (TEXT, NOT NULL, default 'none') - 'none' | 'needed' | 'responded'
- `lastCommentAt` (TIMESTAMP, nullable) - Last comment timestamp

### 3.2 Schema Migration SQL

```sql
-- Issues table additions
ALTER TABLE issues ADD COLUMN "parentLinearId" TEXT;
ALTER TABLE issues ADD COLUMN "issueSource" TEXT NOT NULL DEFAULT 'linear';
ALTER TABLE issues ADD CONSTRAINT "issues_issueSource_check"
  CHECK ("issueSource" IN ('linear', 'github'));

-- IssueAgents table additions
ALTER TABLE "issueAgents" ADD COLUMN "subIssueLinearId" TEXT;
ALTER TABLE "issueAgents" ADD COLUMN "feedbackStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "issueAgents" ADD CONSTRAINT "issueAgents_feedbackStatus_check"
  CHECK ("feedbackStatus" IN ('none', 'needed', 'responded'));
ALTER TABLE "issueAgents" ADD COLUMN "lastCommentAt" TIMESTAMP WITH TIME ZONE;

-- Foreign key constraints
ALTER TABLE issues ADD CONSTRAINT "issues_parentLinearId_fkey"
  FOREIGN KEY ("parentLinearId") REFERENCES issues("linearId") ON DELETE CASCADE;

ALTER TABLE "issueAgents" ADD CONSTRAINT "issueAgents_subIssueLinearId_fkey"
  FOREIGN KEY ("subIssueLinearId") REFERENCES issues("linearId") ON DELETE SET NULL;

-- Performance indexes
CREATE INDEX "issues_parentLinearId_idx" ON issues("parentLinearId")
  WHERE "parentLinearId" IS NOT NULL;

CREATE INDEX "issueAgents_subIssueLinearId_idx" ON "issueAgents"("subIssueLinearId")
  WHERE "subIssueLinearId" IS NOT NULL;

CREATE INDEX "issueAgents_feedbackStatus_idx" ON "issueAgents"("feedbackStatus")
  WHERE "feedbackStatus" = 'needed';

-- Comments for documentation
COMMENT ON COLUMN issues."parentLinearId" IS 'Linear ID of parent issue if this is a sub-issue';
COMMENT ON COLUMN issues."issueSource" IS 'Source provider: linear or github';
COMMENT ON COLUMN "issueAgents"."subIssueLinearId" IS 'Linear ID of sub-issue agent is assigned to';
COMMENT ON COLUMN "issueAgents"."feedbackStatus" IS 'Feedback status: none, needed, or responded';
```

### 3.3 Updated TypeScript Types

```typescript
// db/schema.ts additions
export const issues = pgTable('issues', {
  // ... existing fields
  parentLinearId: text('parentLinearId'),
  issueSource: text('issueSource').notNull().default('linear'),
})

export const issueAgents = pgTable('issueAgents', {
  // ... existing fields
  subIssueLinearId: text('subIssueLinearId'),
  feedbackStatus: text('feedbackStatus').notNull().default('none'),
  lastCommentAt: timestamp('lastCommentAt'),
})

export type IssueSource = 'linear' | 'github'
export type FeedbackStatus = 'none' | 'needed' | 'responded'
```

### 3.4 Database Queries

**Find sub-issues of a parent:**
```typescript
export async function getSubIssues(parentLinearId: string) {
  return db.select()
    .from(issues)
    .where(eq(issues.parentLinearId, parentLinearId))
}
```

**Find agents needing feedback:**
```typescript
export async function getAgentsNeedingFeedback() {
  return db.select()
    .from(issueAgents)
    .where(eq(issueAgents.feedbackStatus, 'needed'))
}
```

---

## Section 4: TDD Implementation Tasks

### Task 1: Add Database Schema for Sub-Issues

**Step 1: Write failing migration test**

File: `/Users/andrewhill/Coding/coding-arena/src/db/__tests__/schema-migration.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { db } from '../client'
import { issues, issueAgents } from '../schema'
import { sql } from 'drizzle-orm'

describe('Schema migration - sub-issues', () => {
  it('should have parentLinearId column on issues', async () => {
    const result = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'issues' AND column_name = 'parentLinearId'
    `)
    expect(result.rows.length).toBe(1)
  })

  it('should have issueSource column on issues', async () => {
    const result = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'issues' AND column_name = 'issueSource'
    `)
    expect(result.rows.length).toBe(1)
  })

  it('should have subIssueLinearId column on issueAgents', async () => {
    const result = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'issueAgents' AND column_name = 'subIssueLinearId'
    `)
    expect(result.rows.length).toBe(1)
  })

  it('should have feedbackStatus column on issueAgents', async () => {
    const result = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'issueAgents' AND column_name = 'feedbackStatus'
    `)
    expect(result.rows.length).toBe(1)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/db/__tests__/schema-migration.test.ts
```

Expected: All 4 tests FAIL (columns don't exist)

**Step 3: Write migration SQL**

File: `/Users/andrewhill/Coding/coding-arena/drizzle/migrations/XXXXXX_add_sub_issue_fields.sql`

```sql
-- Add sub-issue tracking fields
ALTER TABLE issues ADD COLUMN "parentLinearId" TEXT;
ALTER TABLE issues ADD COLUMN "issueSource" TEXT NOT NULL DEFAULT 'linear';
ALTER TABLE "issueAgents" ADD COLUMN "subIssueLinearId" TEXT;
ALTER TABLE "issueAgents" ADD COLUMN "feedbackStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "issueAgents" ADD COLUMN "lastCommentAt" TIMESTAMP WITH TIME ZONE;

-- Add constraints
ALTER TABLE issues ADD CONSTRAINT "issues_issueSource_check"
  CHECK ("issueSource" IN ('linear', 'github'));
ALTER TABLE "issueAgents" ADD CONSTRAINT "issueAgents_feedbackStatus_check"
  CHECK ("feedbackStatus" IN ('none', 'needed', 'responded'));

-- Add foreign keys
ALTER TABLE issues ADD CONSTRAINT "issues_parentLinearId_fkey"
  FOREIGN KEY ("parentLinearId") REFERENCES issues("linearId") ON DELETE CASCADE;
ALTER TABLE "issueAgents" ADD CONSTRAINT "issueAgents_subIssueLinearId_fkey"
  FOREIGN KEY ("subIssueLinearId") REFERENCES issues("linearId") ON DELETE SET NULL;

-- Add indexes
CREATE INDEX "issues_parentLinearId_idx" ON issues("parentLinearId")
  WHERE "parentLinearId" IS NOT NULL;
CREATE INDEX "issueAgents_subIssueLinearId_idx" ON "issueAgents"("subIssueLinearId")
  WHERE "subIssueLinearId" IS NOT NULL;
CREATE INDEX "issueAgents_feedbackStatus_idx" ON "issueAgents"("feedbackStatus")
  WHERE "feedbackStatus" = 'needed';
```

Update schema.ts with new fields.

**Step 4: Run migration and test**

```bash
npm run db:migrate
npm test -- src/db/__tests__/schema-migration.test.ts
```

Expected: All 4 tests PASS

**Step 5: Commit**

```bash
git add drizzle/migrations/ src/db/schema.ts src/db/__tests__/schema-migration.test.ts
git commit -m "feat(db): add sub-issue tracking fields to schema"
```

---

### Task 2: Create Linear Sub-Issue Helper

**Step 1: Write failing test**

File: `/Users/andrewhill/Coding/coding-arena/src/lib/linear/__tests__/create-sub-issue.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSubIssue } from '../create-sub-issue'
import { LinearClient } from '@linear/sdk'

vi.mock('@linear/sdk')

describe('createSubIssue', () => {
  let mockLinearClient: any

  beforeEach(() => {
    mockLinearClient = {
      createIssue: vi.fn(),
    }
    vi.mocked(LinearClient).mockImplementation(() => mockLinearClient)
  })

  it('should create sub-issue with correct properties', async () => {
    mockLinearClient.createIssue.mockResolvedValue({
      issue: { id: 'sub-123', identifier: 'TEST-456' },
    })

    const result = await createSubIssue({
      parentLinearId: 'parent-123',
      teamId: 'team-123',
      agentLinearUserId: 'agent-user-123',
      title: 'Sub-issue title',
    })

    expect(result).toEqual({
      id: 'sub-123',
      identifier: 'TEST-456',
    })

    expect(mockLinearClient.createIssue).toHaveBeenCalledWith({
      title: 'Sub-issue title',
      parentId: 'parent-123',
      teamId: 'team-123',
      assigneeId: 'agent-user-123',
    })
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/lib/linear/__tests__/create-sub-issue.test.ts
```

Expected: FAIL (module not found)

**Step 3: Implement createSubIssue()**

File: `/Users/andrewhill/Coding/coding-arena/src/lib/linear/create-sub-issue.ts`

```typescript
import { LinearClient } from '@linear/sdk'

export interface CreateSubIssueParams {
  parentLinearId: string
  teamId: string
  agentLinearUserId: string
  title: string
}

export async function createSubIssue(params: CreateSubIssueParams) {
  const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY })

  const response = await client.createIssue({
    title: params.title,
    parentId: params.parentLinearId,
    teamId: params.teamId,
    assigneeId: params.agentLinearUserId,
  })

  const issue = await response.issue

  return {
    id: issue.id,
    identifier: issue.identifier,
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- src/lib/linear/__tests__/create-sub-issue.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/linear/create-sub-issue.ts src/lib/linear/__tests__/create-sub-issue.test.ts
git commit -m "feat(linear): add createSubIssue helper"
```

---

### Task 3: Detect Parent Issue Assignment

**Step 1: Write failing test**

File: `/Users/andrewhill/Coding/coding-arena/src/lib/__tests__/detect-parent-assignment.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { shouldCreateSubIssue } from '../detect-parent-assignment'

describe('shouldCreateSubIssue', () => {
  it('should return false if issue has parent (is sub-issue)', () => {
    const result = shouldCreateSubIssue({
      parentLinearId: 'parent-123',
      assigneeLinearUserId: 'user-123',
    })
    expect(result).toBe(false)
  })

  it('should return false if no assignee', () => {
    const result = shouldCreateSubIssue({
      parentLinearId: null,
      assigneeLinearUserId: null,
    })
    expect(result).toBe(false)
  })

  it('should return true if parent issue assigned to user', () => {
    const result = shouldCreateSubIssue({
      parentLinearId: null,
      assigneeLinearUserId: 'user-123',
    })
    expect(result).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/lib/__tests__/detect-parent-assignment.test.ts
```

Expected: FAIL

**Step 3: Implement detection logic**

File: `/Users/andrewhill/Coding/coding-arena/src/lib/detect-parent-assignment.ts`

```typescript
export interface DetectParams {
  parentLinearId: string | null
  assigneeLinearUserId: string | null
}

export function shouldCreateSubIssue(params: DetectParams): boolean {
  // Don't create sub-issue if this IS a sub-issue
  if (params.parentLinearId) return false

  // Don't create sub-issue if no assignee
  if (!params.assigneeLinearUserId) return false

  // This is a parent issue with assignee - create sub-issue
  return true
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- src/lib/__tests__/detect-parent-assignment.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/detect-parent-assignment.ts src/lib/__tests__/detect-parent-assignment.test.ts
git commit -m "feat(lib): add parent issue assignment detection"
```

---

### Tasks 4-20: Additional Implementation Steps

The remaining tasks follow the same RED-GREEN-REFACTOR TDD pattern:

4. Parse agent mentions from comments
5. Handle parent assignment in webhook
6. Handle comment mentions in webhook
7. Detect sub-issue webhooks
8. Link PRs to sub-issues
9. Update sub-issue status on PR events
10. Detect feedback needed status
11. Clear feedback status on user response
12. Get sub-issues for parent
13. Display sub-issues in UI
14. Add environment variable validation
15. Integration test: full sub-issue workflow
16. Integration test: parent assignment flow
17. Integration test: comment mention flow
18. Integration test: feedback flow
19. Update documentation
20. Run full test suite and create PR

Each task follows the 5-step pattern:
1. Write failing test
2. Run test to verify it fails
3. Write minimal implementation
4. Run test to verify it passes
5. Commit

---

## Section 5: Testing & Rollback Plan

### 5.1 Test Coverage Requirements

**Minimum coverage:**
- Unit tests: 90% line coverage
- Integration tests: All major flows covered
- E2E tests: Happy path + 3 edge cases

**Key test files:**
- `src/lib/linear/__tests__/create-sub-issue.test.ts`
- `src/lib/__tests__/detect-parent-assignment.test.ts`
- `src/app/api/linear/webhook/__tests__/sub-issue-flow.test.ts`
- `__tests__/integration/sub-issue-e2e.test.ts`

### 5.2 Migration Testing Strategy

**Phase 1: Unit tests (Tasks 1-14)**
- Each component tested in isolation
- Mocked dependencies
- Fast feedback loop

**Phase 2: Integration tests (Tasks 15-18)**
- Test webhook → database → Linear API flow
- Use test Linear workspace
- Verify end-to-end behavior

**Phase 3: Staging deployment**
- Deploy to staging environment
- Create test issues manually
- Verify sub-issues created correctly
- Test all edge cases

### 5.3 Rollback Plan

**If issues discovered post-deployment:**

**Step 1: Feature flag disable**
```typescript
// Add to env
ENABLE_SUB_ISSUE_COORDINATION=false

// In webhook handler
if (process.env.ENABLE_SUB_ISSUE_COORDINATION !== 'true') {
  // Use legacy comment-based flow
  return legacyDispatchAgents()
}
```

**Step 2: Database rollback**
```sql
-- Remove new columns (data preserved in separate table)
ALTER TABLE issues DROP COLUMN "parentLinearId";
ALTER TABLE issues DROP COLUMN "issueSource";
ALTER TABLE "issueAgents" DROP COLUMN "subIssueLinearId";
ALTER TABLE "issueAgents" DROP COLUMN "feedbackStatus";
ALTER TABLE "issueAgents" DROP COLUMN "lastCommentAt";
```

**Step 3: Code rollback**
```bash
git revert <commit-hash>
git push origin main
```

### 5.4 Monitoring & Alerts

**Key metrics to monitor:**
- Sub-issue creation rate
- Failed sub-issue creations
- Orphaned sub-issues (no parent)
- Feedback response time
- PR attribution success rate

**Alerts:**
- Sub-issue creation failure > 5% → page on-call
- No sub-issues created in 1 hour → investigate
- Database foreign key violations → immediate fix

---

## Section 6: Deployment Checklist

### 6.1 Pre-Deployment

- [ ] All tests passing (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] No type errors (`npm run type-check`)
- [ ] Documentation updated
- [ ] Environment variables documented
- [ ] Staging deployment successful

### 6.2 Environment Variables

Add to production environment:

```bash
# Required
LINEAR_STATE_IN_PROGRESS=<state-id>
LINEAR_STATE_COMPLETED=<state-id>
LINEAR_STATE_BLOCKED=<state-id>

# Optional (default: true)
ENABLE_SUB_ISSUE_COORDINATION=true
```

### 6.3 Deployment Steps

1. Merge PR to main
2. Run database migration: `npm run db:migrate`
3. Deploy application
4. Verify webhook endpoints responding
5. Create test issue to verify flow
6. Monitor logs for 1 hour
7. Announce to team

### 6.4 Post-Deployment Validation

- [ ] Create test issue with 3 agents
- [ ] Verify 3 sub-issues created
- [ ] Assign parent to 1 agent
- [ ] Verify only 2 sub-issues created for remaining agents
- [ ] Test comment mentions
- [ ] Test PR attribution
- [ ] Test feedback flow
- [ ] Check dashboard displays sub-issues

---

## Section 7: Future Enhancements

### 7.1 Phase 2 Features (Post-Launch)

**Auto-close sub-issues on parent close:**
- Listen for parent issue close webhook
- Query all child sub-issues
- Close open sub-issues automatically

**Sub-issue progress tracking:**
- Show progress bar on parent: "2/3 agents submitted PRs"
- Aggregate sub-issue statuses

**Agent performance by sub-issue:**
- Time from assignment to PR submission
- Feedback request frequency
- Completion rate

### 7.2 GitHub Issue Support

**Add GitHub as issue source:**
- Implement `GitHubProvider` class
- GitHub Issues don't have native sub-issues
- Use issue references: "Parent: #123" in body
- Cross-link with comments

### 7.3 Advanced Feedback Detection

**Use LLM to detect feedback requests:**
- Send comment to Claude API
- Classify as question/statement
- Higher accuracy than keyword matching

---

## Appendix A: File Reference

**New files created:**
- `src/lib/linear/create-sub-issue.ts`
- `src/lib/detect-parent-assignment.ts`
- `src/lib/parse-agent-mentions.ts`
- `drizzle/migrations/XXXXXX_add_sub_issue_fields.sql`

**Modified files:**
- `src/db/schema.ts`
- `src/app/api/linear/webhook/route.ts`
- `src/app/api/github/webhook/route.ts`
- `src/app/dashboard/page.tsx`

**Test files:**
- All files in `src/**/__tests__/` directories
- `__tests__/integration/sub-issue-e2e.test.ts`

---

## Appendix B: Linear API Reference

**Key mutations:**
- `issueCreate` - Create sub-issue with parentId
- `issueUpdate` - Update sub-issue status

**Key queries:**
- `issue(id)` - Get issue with parent/children
- `issues(filter)` - Query by parentId

**Webhook events:**
- Issue.create - Includes parentId if sub-issue
- Issue.update - Includes parentId
- Comment.create - On sub-issues

---

## Appendix C: Troubleshooting Guide

**Problem: Sub-issues not being created**

Check:
1. `ENABLE_SUB_ISSUE_COORDINATION=true` in env
2. Agent has Linear user account
3. Webhook endpoint receiving events
4. Database foreign key constraints satisfied

**Problem: Duplicate sub-issues created**

Check:
1. Unique constraint on `(parentLinearId, agentName)`
2. Idempotency key generation
3. Race condition logs

**Problem: PR not attributed to sub-issue**

Check:
1. Branch name contains issue ID
2. PR author matches agent username
3. Sub-issue exists in database
4. Foreign key from PR table to issues table

---

**END OF PLAN**

This plan provides complete context, requirements, and step-by-step TDD implementation tasks for migrating to sub-issue-based agent coordination while maintaining backward compatibility.
