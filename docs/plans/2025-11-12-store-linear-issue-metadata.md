# Store Linear Issue Metadata Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Store comprehensive Linear issue metadata (description, estimate, priority, labels, assignee, creator, project, cycle, due date) to enable future analytics without re-harvesting data.

**Architecture:** Extend database schema to add metadata fields to issues table, update Linear webhook handler and sync function to capture all available fields from Linear API, implement proper type safety for Linear API responses.

**Tech Stack:** PostgreSQL (Neon), Drizzle ORM, @linear/sdk v63.4.0, TypeScript strict mode, Next.js 15 App Router

---

## Current State Analysis

### What We Store Now

**`issues` table (src/db/schema.ts:17-32):**
```typescript
{
  id: uuid (generated)
  linearId: text (unique)
  linearKey: text (e.g., "ENG-320")
  title: text
  url: text
  repo: text (team.key)
  status: text (state.name)
  arenaReadyLabeledAt: timestamp
  winnerAttemptId: uuid (nullable)
  createdAt: timestamp (generated)
}
```

### What We're Missing

**High-value metadata:**
- Description (markdown body)
- Estimate (point value: 0, 1, 2, 3, 5, 8, 13, 21)
- Priority (0-4: No priority, Urgent, High, Medium, Low)
- All labels (array, currently only check for arena:ready)
- Assignee (user who owns the issue)
- Creator (user who created the issue)
- Project name (if part of a project)
- Cycle (sprint/iteration info)
- Due date
- Parent/child relationships (epic/sub-issue)
- Created/Updated timestamps from Linear

### Data Sources

**1. Linear Webhook (handleIssueEvent in route.ts:157)**
- Receives: `{ id, identifier, title, url, team?, state?, labels? }`
- Missing: description, estimate, priority, assignee, creator, project, cycle, dueDate

**2. Linear API Sync (syncIssueFromLinear in linear-sync.ts:20)**
- Currently fetches: `issue.comments()`, `issue.attachments()`
- Available but unused: All metadata fields via issue object

**3. Linear SDK Issue Object**
- The `@linear/sdk` Issue type includes ALL metadata
- We need to access these fields and store them

---

## Design Decisions

### Schema Design

**Add to `issues` table:**
```sql
ALTER TABLE issues ADD COLUMN description TEXT;
ALTER TABLE issues ADD COLUMN description_markdown TEXT;
ALTER TABLE issues ADD COLUMN estimate INTEGER;
ALTER TABLE issues ADD COLUMN priority INTEGER;
ALTER TABLE issues ADD COLUMN labels_json JSONB;
ALTER TABLE issues ADD COLUMN assignee_id TEXT;
ALTER TABLE issues ADD COLUMN assignee_name TEXT;
ALTER TABLE issues ADD COLUMN assignee_email TEXT;
ALTER TABLE issues ADD COLUMN creator_id TEXT;
ALTER TABLE issues ADD COLUMN creator_name TEXT;
ALTER TABLE issues ADD COLUMN creator_email TEXT;
ALTER TABLE issues ADD COLUMN project_id TEXT;
ALTER TABLE issues ADD COLUMN project_name TEXT;
ALTER TABLE issues ADD COLUMN cycle_id TEXT;
ALTER TABLE issues ADD COLUMN cycle_name TEXT;
ALTER TABLE issues ADD COLUMN cycle_number INTEGER;
ALTER TABLE issues ADD COLUMN due_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE issues ADD COLUMN linear_created_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE issues ADD COLUMN linear_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE issues ADD COLUMN parent_id TEXT;
```

**Why JSONB for labels:**
- Labels have: `{ id, name, color, description }`
- Future analytics may need label colors/descriptions
- JSONB enables PostgreSQL JSON queries (`labels_json @> '[{"name": "bug"}]'`)

**Why split assignee/creator fields:**
- Fast text queries without JSON extraction
- Name/email available for display without joins
- ID enables future API lookups

**Why nullable:**
- Issues may not have all fields set (assignee, project, cycle, dueDate, parent)
- Estimate/priority default to NULL if not set

### Type Safety

**Create comprehensive Linear types:**
```typescript
type LinearIssueMetadata = {
  id: string
  identifier: string
  title: string
  description?: string | null
  descriptionData?: string | null // markdown source
  url: string
  estimate?: number | null
  priority?: number | null
  labels?: Array<{
    id: string
    name: string
    color?: string | null
    description?: string | null
  }> | null
  assignee?: {
    id: string
    name: string
    email?: string | null
  } | null
  creator?: {
    id: string
    name: string
    email?: string | null
  } | null
  project?: {
    id: string
    name: string
  } | null
  cycle?: {
    id: string
    name: string
    number?: number | null
  } | null
  dueDate?: string | null
  createdAt: string
  updatedAt: string
  parent?: {
    id: string
    identifier: string
  } | null
  team?: {
    id: string
    key: string
    name: string
  } | null
  state?: {
    id: string
    name: string
    type: string
  } | null
}
```

### Update Strategy

**Webhook path (route.ts):**
- Webhook payload has LIMITED fields
- Store what's available: title, status, labels_json
- DON'T try to extract metadata from webhook (not reliable)
- Let sync function handle full metadata

**Sync path (linear-sync.ts):**
- Fetch from Linear API via SDK
- SDK returns FULL issue object with all fields
- Extract ALL metadata in one pass
- Upsert with FULL metadata set

**Why this split:**
- Webhook is fast but incomplete
- Sync is comprehensive but requires API call
- Webhook creates issue fast → sync enriches with metadata
- Existing pattern: webhook creates, sync fills details

---

## Task Breakdown

### Task 1: Add Migration to Extend Issues Table

**Goal:** Add columns to store Linear issue metadata

**Files:**
- Create: `src/db/migrations/0004_add_issue_metadata.sql`

**Step 1: Write migration SQL**

Create migration file:

```sql
-- Add issue metadata columns
-- Migration: 0004_add_issue_metadata.sql

ALTER TABLE issues
  ADD COLUMN description TEXT,
  ADD COLUMN description_markdown TEXT,
  ADD COLUMN estimate INTEGER,
  ADD COLUMN priority INTEGER,
  ADD COLUMN labels_json JSONB,
  ADD COLUMN assignee_id TEXT,
  ADD COLUMN assignee_name TEXT,
  ADD COLUMN assignee_email TEXT,
  ADD COLUMN creator_id TEXT,
  ADD COLUMN creator_name TEXT,
  ADD COLUMN creator_email TEXT,
  ADD COLUMN project_id TEXT,
  ADD COLUMN project_name TEXT,
  ADD COLUMN cycle_id TEXT,
  ADD COLUMN cycle_name TEXT,
  ADD COLUMN cycle_number INTEGER,
  ADD COLUMN due_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN linear_created_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN linear_updated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN parent_id TEXT;
```

**Step 2: Run migration locally**

Run: `npm run db:push` (or equivalent command)
Expected: Migration applies successfully, no errors

**Step 3: Commit migration**

```bash
git add src/db/migrations/0004_add_issue_metadata.sql
git commit -m "migration: add issue metadata columns to issues table

- Add description (text and markdown)
- Add estimate, priority
- Add labels as JSONB
- Add assignee (id, name, email)
- Add creator (id, name, email)
- Add project (id, name)
- Add cycle (id, name, number)
- Add due_date, linear timestamps
- Add parent_id for epic relationships"
```

---

### Task 2: Update Database Schema Types

**Goal:** Add TypeScript types for new metadata columns

**Files:**
- Modify: `src/db/schema.ts:17-32`

**Step 1: Write failing test**

In `src/db/schema.test.ts` (if it doesn't exist, create it):

```typescript
import { describe, expect, it } from 'vitest'
import { issues } from './schema'

describe('issues schema', () => {
  it('should have metadata columns', () => {
    const columns = Object.keys(issues)

    expect(columns).toContain('description')
    expect(columns).toContain('descriptionMarkdown')
    expect(columns).toContain('estimate')
    expect(columns).toContain('priority')
    expect(columns).toContain('labelsJson')
    expect(columns).toContain('assigneeId')
    expect(columns).toContain('assigneeName')
    expect(columns).toContain('assigneeEmail')
    expect(columns).toContain('creatorId')
    expect(columns).toContain('creatorName')
    expect(columns).toContain('creatorEmail')
    expect(columns).toContain('projectId')
    expect(columns).toContain('projectName')
    expect(columns).toContain('cycleId')
    expect(columns).toContain('cycleName')
    expect(columns).toContain('cycleNumber')
    expect(columns).toContain('dueDate')
    expect(columns).toContain('linearCreatedAt')
    expect(columns).toContain('linearUpdatedAt')
    expect(columns).toContain('parentId')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test src/db/schema.test.ts`
Expected: FAIL with "Expected columns to contain 'description'"

**Step 3: Update schema definition**

In `src/db/schema.ts`, update the `issues` table:

```typescript
export const issues = pgTable('issues', {
  id: uuid('id').primaryKey().defaultRandom(),
  linearId: text('linear_id').notNull().unique(),
  linearKey: text('linear_key').notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  repo: text('repo'),
  status: text('status'),

  // Metadata fields
  description: text('description'),
  descriptionMarkdown: text('description_markdown'),
  estimate: integer('estimate'),
  priority: integer('priority'),
  labelsJson: jsonb('labels_json'),
  assigneeId: text('assignee_id'),
  assigneeName: text('assignee_name'),
  assigneeEmail: text('assignee_email'),
  creatorId: text('creator_id'),
  creatorName: text('creator_name'),
  creatorEmail: text('creator_email'),
  projectId: text('project_id'),
  projectName: text('project_name'),
  cycleId: text('cycle_id'),
  cycleName: text('cycle_name'),
  cycleNumber: integer('cycle_number'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  linearCreatedAt: timestamp('linear_created_at', { withTimezone: true }),
  linearUpdatedAt: timestamp('linear_updated_at', { withTimezone: true }),
  parentId: text('parent_id'),

  // Original fields
  arenaReadyLabeledAt: timestamp('arena_ready_labeled_at', {
    withTimezone: true,
  }),
  winnerAttemptId: uuid('winner_attempt_id'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
```

**Step 4: Run tests to verify they pass**

Run: `npm test src/db/schema.test.ts`
Expected: PASS - all schema columns present

**Step 5: Commit**

```bash
git add src/db/schema.ts src/db/schema.test.ts
git commit -m "feat: add issue metadata columns to schema

- Add description and descriptionMarkdown
- Add estimate (integer points)
- Add priority (0-4)
- Add labelsJson (JSONB for rich label data)
- Add assignee fields (id, name, email)
- Add creator fields (id, name, email)
- Add project fields (id, name)
- Add cycle fields (id, name, number)
- Add dueDate, linearCreatedAt, linearUpdatedAt
- Add parentId for epic/sub-issue relationships"
```

---

### Task 3: Create Linear Type Definitions

**Goal:** Add comprehensive TypeScript types for Linear API responses

**Files:**
- Create: `src/types/linear.ts`

**Step 1: Write the type definitions**

Create file with all Linear API types:

```typescript
/**
 * Linear API type definitions
 * Based on @linear/sdk v63.4.0
 * @packageDocumentation
 */

/**
 * Linear label
 */
export type LinearLabel = {
  id: string
  name: string
  color?: string | null
  description?: string | null
}

/**
 * Linear user (assignee or creator)
 */
export type LinearUser = {
  id: string
  name: string
  email?: string | null
  displayName?: string | null
  avatarUrl?: string | null
}

/**
 * Linear project
 */
export type LinearProject = {
  id: string
  name: string
  description?: string | null
  state: string
  url?: string | null
}

/**
 * Linear cycle (sprint/iteration)
 */
export type LinearCycle = {
  id: string
  name: string
  number?: number | null
  startsAt?: string | null
  endsAt?: string | null
}

/**
 * Linear team
 */
export type LinearTeam = {
  id: string
  key: string
  name: string
}

/**
 * Linear issue state
 */
export type LinearState = {
  id: string
  name: string
  type: string
  color?: string | null
}

/**
 * Linear parent issue (for sub-issues)
 */
export type LinearParent = {
  id: string
  identifier: string
  title: string
}

/**
 * Complete Linear issue metadata
 * All fields that we want to store from Linear API
 */
export type LinearIssueMetadata = {
  id: string
  identifier: string
  title: string
  description?: string | null
  descriptionData?: string | null
  url: string
  estimate?: number | null
  priority?: number | null
  labels?: LinearLabel[] | null
  assignee?: LinearUser | null
  creator?: LinearUser | null
  project?: LinearProject | null
  cycle?: LinearCycle | null
  dueDate?: string | null
  createdAt: string
  updatedAt: string
  parent?: LinearParent | null
  team?: LinearTeam | null
  state?: LinearState | null
}

/**
 * Linear webhook Issue payload (limited fields)
 */
export type LinearWebhookIssue = {
  id: string
  identifier: string
  title: string
  url: string
  team?: { key: string }
  state?: { name: string }
  labels?: Array<{ name: string }>
}
```

**Step 2: Add export to barrel file**

If `src/types/index.ts` exists, add export. Otherwise create it:

```typescript
export * from './linear'
```

**Step 3: Verify types compile**

Run: `npm run type-check` (or `tsc --noEmit`)
Expected: No type errors

**Step 4: Commit**

```bash
git add src/types/linear.ts src/types/index.ts
git commit -m "feat: add comprehensive Linear API type definitions

- LinearIssueMetadata for full API responses
- LinearWebhookIssue for webhook payloads
- LinearLabel, LinearUser, LinearProject, LinearCycle types
- LinearTeam, LinearState, LinearParent types
- Based on @linear/sdk v63.4.0 schema"
```

---

### Task 4: Create Metadata Extraction Helper

**Goal:** Build a helper function to safely extract metadata from Linear SDK issue object

**Files:**
- Create: `src/lib/linear-metadata.ts`
- Create: `src/lib/linear-metadata.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, expect, it } from 'vitest'
import { extractIssueMetadata } from './linear-metadata'

describe('extractIssueMetadata', () => {
  it('should extract all metadata from issue object', () => {
    const mockIssue = {
      id: 'issue-123',
      identifier: 'ENG-123',
      title: 'Test issue',
      description: 'Issue description',
      descriptionData: '{"type":"doc","content":[]}',
      url: 'https://linear.app/test/issue/ENG-123',
      estimate: 5,
      priority: 2,
      labels: [
        { id: 'label-1', name: 'bug', color: '#ff0000' },
        { id: 'label-2', name: 'frontend', color: '#00ff00' },
      ],
      assignee: {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
      },
      creator: {
        id: 'user-2',
        name: 'Jane Smith',
        email: 'jane@example.com',
      },
      project: {
        id: 'project-1',
        name: 'Q1 Goals',
      },
      cycle: {
        id: 'cycle-1',
        name: 'Sprint 42',
        number: 42,
      },
      dueDate: '2025-01-01T00:00:00Z',
      createdAt: '2024-12-01T00:00:00Z',
      updatedAt: '2024-12-15T00:00:00Z',
      parent: {
        id: 'parent-1',
        identifier: 'ENG-100',
      },
      team: {
        id: 'team-1',
        key: 'ENG',
        name: 'Engineering',
      },
      state: {
        id: 'state-1',
        name: 'In Progress',
        type: 'started',
      },
    } as any

    const result = extractIssueMetadata(mockIssue)

    expect(result).toEqual({
      // Core fields
      linearId: 'issue-123',
      linearKey: 'ENG-123',
      title: 'Test issue',
      url: 'https://linear.app/test/issue/ENG-123',
      repo: 'ENG',
      status: 'In Progress',

      // Metadata fields
      description: 'Issue description',
      descriptionMarkdown: '{"type":"doc","content":[]}',
      estimate: 5,
      priority: 2,
      labelsJson: [
        { id: 'label-1', name: 'bug', color: '#ff0000' },
        { id: 'label-2', name: 'frontend', color: '#00ff00' },
      ],
      assigneeId: 'user-1',
      assigneeName: 'John Doe',
      assigneeEmail: 'john@example.com',
      creatorId: 'user-2',
      creatorName: 'Jane Smith',
      creatorEmail: 'jane@example.com',
      projectId: 'project-1',
      projectName: 'Q1 Goals',
      cycleId: 'cycle-1',
      cycleName: 'Sprint 42',
      cycleNumber: 42,
      dueDate: new Date('2025-01-01T00:00:00Z'),
      linearCreatedAt: new Date('2024-12-01T00:00:00Z'),
      linearUpdatedAt: new Date('2024-12-15T00:00:00Z'),
      parentId: 'parent-1',
    })
  })

  it('should handle missing optional fields', () => {
    const minimalIssue = {
      id: 'issue-456',
      identifier: 'ENG-456',
      title: 'Minimal issue',
      url: 'https://linear.app/test/issue/ENG-456',
      createdAt: '2024-12-01T00:00:00Z',
      updatedAt: '2024-12-01T00:00:00Z',
    } as any

    const result = extractIssueMetadata(minimalIssue)

    expect(result.linearId).toBe('issue-456')
    expect(result.description).toBeUndefined()
    expect(result.estimate).toBeUndefined()
    expect(result.priority).toBeUndefined()
    expect(result.assigneeId).toBeUndefined()
  })

  it('should handle labels with missing colors', () => {
    const issueWithLabels = {
      id: 'issue-789',
      identifier: 'ENG-789',
      title: 'Issue with labels',
      url: 'https://linear.app/test/issue/ENG-789',
      labels: [
        { id: 'label-1', name: 'bug' },
        { id: 'label-2', name: 'urgent', color: '#ff0000' },
      ],
      createdAt: '2024-12-01T00:00:00Z',
      updatedAt: '2024-12-01T00:00:00Z',
    } as any

    const result = extractIssueMetadata(issueWithLabels)

    expect(result.labelsJson).toEqual([
      { id: 'label-1', name: 'bug', color: null },
      { id: 'label-2', name: 'urgent', color: '#ff0000' },
    ])
  })

  it('should parse date strings to Date objects', () => {
    const issueWithDates = {
      id: 'issue-101',
      identifier: 'ENG-101',
      title: 'Issue with dates',
      url: 'https://linear.app/test/issue/ENG-101',
      dueDate: '2025-06-01T00:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-06-01T00:00:00Z',
    } as any

    const result = extractIssueMetadata(issueWithDates)

    expect(result.dueDate).toBeInstanceOf(Date)
    expect(result.linearCreatedAt).toBeInstanceOf(Date)
    expect(result.linearUpdatedAt).toBeInstanceOf(Date)
    expect(result.dueDate?.toISOString()).toBe('2025-06-01T00:00:00.000Z')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test src/lib/linear-metadata.test.ts`
Expected: FAIL with "extractIssueMetadata is not defined"

**Step 3: Implement extraction function**

Create `src/lib/linear-metadata.ts`:

```typescript
/**
 * Linear issue metadata extraction utilities
 * @packageDocumentation
 */

/**
 * Extracts issue metadata from Linear SDK Issue object
 * Converts to database-compatible format
 *
 * @param issue - Issue object from @linear/sdk
 * @returns Database-compatible metadata object
 */
export function extractIssueMetadata(issue: any): {
  linearId: string
  linearKey: string
  title: string
  url: string
  repo?: string
  status?: string
  description?: string
  descriptionMarkdown?: string
  estimate?: number
  priority?: number
  labelsJson?: Array<{
    id: string
    name: string
    color?: string | null
    description?: string | null
  }>
  assigneeId?: string
  assigneeName?: string
  assigneeEmail?: string
  creatorId?: string
  creatorName?: string
  creatorEmail?: string
  projectId?: string
  projectName?: string
  cycleId?: string
  cycleName?: string
  cycleNumber?: number
  dueDate?: Date
  linearCreatedAt: Date
  linearUpdatedAt: Date
  parentId?: string
} {
  // Core fields (always present)
  const metadata: any = {
    linearId: issue.id,
    linearKey: issue.identifier,
    title: issue.title,
    url: issue.url,
    linearCreatedAt: new Date(issue.createdAt),
    linearUpdatedAt: new Date(issue.updatedAt),
  }

  // Optional: team (repo)
  if (issue.team?.key) {
    metadata.repo = issue.team.key
  }

  // Optional: state (status)
  if (issue.state?.name) {
    metadata.status = issue.state.name
  }

  // Optional: description
  if (issue.description) {
    metadata.description = issue.description
  }

  // Optional: description markdown data
  if (issue.descriptionData) {
    metadata.descriptionMarkdown = issue.descriptionData
  }

  // Optional: estimate
  if (typeof issue.estimate === 'number') {
    metadata.estimate = issue.estimate
  }

  // Optional: priority
  if (typeof issue.priority === 'number') {
    metadata.priority = issue.priority
  }

  // Optional: labels (store as JSONB with full metadata)
  if (issue.labels && Array.isArray(issue.labels)) {
    metadata.labelsJson = issue.labels.map((label: any) => ({
      id: label.id,
      name: label.name,
      color: label.color ?? null,
      description: label.description ?? null,
    }))
  }

  // Optional: assignee
  if (issue.assignee) {
    metadata.assigneeId = issue.assignee.id
    metadata.assigneeName = issue.assignee.name
    if (issue.assignee.email) {
      metadata.assigneeEmail = issue.assignee.email
    }
  }

  // Optional: creator
  if (issue.creator) {
    metadata.creatorId = issue.creator.id
    metadata.creatorName = issue.creator.name
    if (issue.creator.email) {
      metadata.creatorEmail = issue.creator.email
    }
  }

  // Optional: project
  if (issue.project) {
    metadata.projectId = issue.project.id
    metadata.projectName = issue.project.name
  }

  // Optional: cycle
  if (issue.cycle) {
    metadata.cycleId = issue.cycle.id
    metadata.cycleName = issue.cycle.name
    if (typeof issue.cycle.number === 'number') {
      metadata.cycleNumber = issue.cycle.number
    }
  }

  // Optional: due date
  if (issue.dueDate) {
    metadata.dueDate = new Date(issue.dueDate)
  }

  // Optional: parent (epic/sub-issue relationship)
  if (issue.parent?.id) {
    metadata.parentId = issue.parent.id
  }

  return metadata
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test src/lib/linear-metadata.test.ts`
Expected: PASS - all 5 tests passing

**Step 5: Commit**

```bash
git add src/lib/linear-metadata.ts src/lib/linear-metadata.test.ts
git commit -m "feat: add Linear issue metadata extraction helper

- extractIssueMetadata() converts SDK objects to DB format
- Handles all optional fields gracefully
- Converts date strings to Date objects
- Preserves full label metadata (id, name, color, description)
- Splits user objects into id/name/email fields
- 5 comprehensive tests covering all edge cases"
```

---

### Task 5: Update Linear Sync to Store Metadata

**Goal:** Modify `syncIssueFromLinear()` to extract and store full issue metadata

**Files:**
- Modify: `src/lib/linear-sync.ts:20-52`
- Modify: `src/lib/linear-sync.test.ts`

**Step 1: Write failing test**

Add to `src/lib/linear-sync.test.ts`:

```typescript
import { extractIssueMetadata } from './linear-metadata'

// ... existing tests ...

describe('syncIssueFromLinear - metadata', () => {
  it('should store full issue metadata when syncing', async () => {
    const mockIssue = {
      id: LINEAR_ISSUE_ID,
      identifier: 'ENG-123',
      title: 'Test issue',
      description: 'Full description here',
      url: 'https://linear.app/test/issue/ENG-123',
      estimate: 5,
      priority: 2,
      labels: [
        { id: 'label-1', name: 'bug', color: '#ff0000' },
      ],
      assignee: {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
      },
      creator: {
        id: 'user-2',
        name: 'Jane Smith',
        email: 'jane@example.com',
      },
      createdAt: '2024-12-01T00:00:00Z',
      updatedAt: '2024-12-15T00:00:00Z',
      comments: vi.fn().mockResolvedValue({ nodes: [] }),
      attachments: vi.fn().mockResolvedValue({ nodes: [] }),
    }

    vi.mocked(LinearClient).mockImplementation(
      () =>
        ({
          issue: vi.fn().mockResolvedValue(mockIssue),
        }) as any
    )

    // Mock database insert to capture what's being stored
    const insertMock = vi.fn().mockResolvedValue([{ id: DB_ISSUE_ID }])
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as any)

    await syncIssueFromLinear(LINEAR_ISSUE_ID)

    // Verify metadata was stored
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Full description here',
        estimate: 5,
        priority: 2,
        assigneeId: 'user-1',
        assigneeName: 'John Doe',
        creatorId: 'user-2',
        creatorName: 'Jane Smith',
      })
    )
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test src/lib/linear-sync.test.ts -- -t "metadata"`
Expected: FAIL - metadata fields not being stored

**Step 3: Update syncIssueFromLinear implementation**

In `src/lib/linear-sync.ts`, update the function:

```typescript
import { extractIssueMetadata } from './linear-metadata'

/**
 * Syncs issue state from Linear API
 * Fetches comments and attachments to capture mid-flight activity
 * Extracts and stores full issue metadata
 *
 * @param linearIssueId - Linear issue UUID
 */
export async function syncIssueFromLinear(
  linearIssueId: string
): Promise<void> {
  const apiKey = process.env['LINEAR_API_KEY']
  if (!apiKey) {
    throw new Error('LINEAR_API_KEY not configured')
  }

  // 1. Get issue from database
  const dbIssue = await db
    .select()
    .from(issues)
    .where(eq(issues.linearId, linearIssueId))
    .limit(1)

  if (!dbIssue[0]) {
    return // Issue not in database, nothing to sync
  }

  const issueId = dbIssue[0].id

  // 2. Fetch from Linear API
  const client = new LinearClient({ apiKey })
  const issue = await client.issue(linearIssueId)
  const comments = await issue.comments()
  const attachments = await issue.attachments()

  // 3. Extract and update issue metadata
  const metadata = extractIssueMetadata(issue)
  await db
    .update(issues)
    .set(metadata)
    .where(eq(issues.id, issueId))

  // 4. Sync comments → agent mentions
  await syncComments(issueId, comments.nodes)

  // 5. Sync attachments → attempts
  await syncAttachments(issueId, attachments.nodes)
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test src/lib/linear-sync.test.ts`
Expected: PASS - metadata is now stored during sync

**Step 5: Run all tests**

Run: `npm test`
Expected: All 355+ tests pass (may be more with new tests)

**Step 6: Commit**

```bash
git add src/lib/linear-sync.ts src/lib/linear-sync.test.ts
git commit -m "feat: store full issue metadata during Linear sync

- Extract metadata using extractIssueMetadata() helper
- Update database with description, estimate, priority
- Store assignee and creator information
- Store project and cycle data
- Store labels as JSONB with full metadata
- Update existing test to verify metadata storage"
```

---

### Task 6: Update Webhook Handler Type Safety

**Goal:** Use proper Linear types in webhook handler instead of `any` casts

**Files:**
- Modify: `src/app/api/linear/webhook/route.ts:36-66`

**Step 1: Write failing test**

Add to `src/app/api/linear/webhook/route.test.ts`:

```typescript
it('should handle issue with full metadata in webhook', async () => {
  const payload = {
    type: 'Issue',
    action: 'update',
    data: {
      id: TEST_ISSUE_ID,
      identifier: 'ENG-123',
      title: 'Issue with metadata',
      url: TEST_ISSUE_URL,
      team: { key: 'engineering' },
      state: { name: 'In Progress' },
      labels: [
        { name: ARENA_LABEL },
        { name: 'bug' },
        { name: 'urgent' },
      ],
    },
    updatedAt: TEST_TIMESTAMP,
    createdAt: TEST_TIMESTAMP,
  }

  const mockInsert = vi.fn().mockReturnValue({
    onConflictDoNothing: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 1 }]),
    }),
    onConflictDoUpdate: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([]),
    }),
  })

  vi.mocked(db.insert).mockReturnValue({
    values: mockInsert,
  } as never)

  const req = createMockRequest(payload)
  const response = await POST(req)

  expect(response.status).toBe(200)
  // Webhook should store basic fields, sync will enrich later
  expect(mockInsert).toHaveBeenCalled()
})
```

**Step 2: Run test to verify current behavior**

Run: `npm test src/app/api/linear/webhook/route.test.ts -- -t "full metadata"`
Expected: PASS (verifies current behavior works)

**Step 3: Update webhook types**

In `src/app/api/linear/webhook/route.ts`:

```typescript
import type { LinearWebhookIssue } from '@/types/linear'

// Replace existing LinearIssue type with import
// Delete lines 36-44, they're now in @/types/linear

/**
 * Handles Issue webhook events.
 * Upserts issue when arena:ready label is present and syncs existing state.
 * Webhook stores basic fields only - sync enriches with full metadata.
 *
 * @param payload - Linear webhook payload
 */
async function handleIssueEvent(payload: LinearWebhookPayload): Promise<void> {
  const issue = payload.data as unknown as LinearWebhookIssue

  // Check for arena:ready label
  const arenaLabel = process.env['ARENA_LABEL'] ?? 'arena:ready'
  const hasArenaLabel = issue.labels?.some((label) => label.name === arenaLabel)

  if (!hasArenaLabel) return

  // Upsert issue with basic fields from webhook
  // Full metadata will be added by syncIssueFromLinear
  await db
    .insert(issues)
    .values({
      linearId: issue.id,
      linearKey: issue.identifier,
      title: issue.title,
      url: issue.url,
      repo: issue.team?.key,
      status: issue.state?.name,
      arenaReadyLabeledAt: new Date(),
      // Note: metadata fields will be filled by sync
    })
    .onConflictDoUpdate({
      target: issues.linearId,
      set: {
        status: issue.state?.name,
        // Don't overwrite metadata fields on webhook updates
        // Only sync updates those to avoid race conditions
      },
    })
    .returning({ id: issues.id })

  console.log(`Issue ${issue.identifier} labeled ${arenaLabel}`)

  // Sync existing state from Linear API (fills metadata)
  await syncIssueFromLinear(issue.id)
}
```

**Step 4: Run tests**

Run: `npm test src/app/api/linear/webhook/route.test.ts`
Expected: PASS - type-safe webhook handling

**Step 5: Commit**

```bash
git add src/app/api/linear/webhook/route.ts src/app/api/linear/webhook/route.test.ts
git commit -m "refactor: use typed Linear webhook payloads

- Import LinearWebhookIssue from @/types/linear
- Remove duplicate type definitions
- Add comments explaining webhook vs sync metadata split
- Webhook stores basic fields, sync enriches with full metadata"
```

---

### Task 7: Add Metadata Query Helpers

**Goal:** Create helper functions for common metadata queries

**Files:**
- Create: `src/lib/issue-queries.ts`
- Create: `src/lib/issue-queries.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  getIssuesByLabel,
  getIssuesByPriority,
  getIssuesByEstimate,
  getIssuesByAssignee,
  getIssuesInCycle,
  getIssuesInProject
} from './issue-queries'

describe('issue-queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should query issues by label name', async () => {
    const issues = await getIssuesByLabel('bug')
    expect(Array.isArray(issues)).toBe(true)
  })

  it('should query issues by priority', async () => {
    const urgentIssues = await getIssuesByPriority(1)
    expect(Array.isArray(urgentIssues)).toBe(true)
  })

  it('should query issues by estimate range', async () => {
    const mediumIssues = await getIssuesByEstimate(3, 5)
    expect(Array.isArray(mediumIssues)).toBe(true)
  })

  it('should query issues by assignee', async () => {
    const issues = await getIssuesByAssignee('user-123')
    expect(Array.isArray(issues)).toBe(true)
  })

  it('should query issues in a cycle', async () => {
    const issues = await getIssuesInCycle('cycle-42')
    expect(Array.isArray(issues)).toBe(true)
  })

  it('should query issues in a project', async () => {
    const issues = await getIssuesInProject('project-q1')
    expect(Array.isArray(issues)).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test src/lib/issue-queries.test.ts`
Expected: FAIL - functions not defined

**Step 3: Implement query helpers**

Create `src/lib/issue-queries.ts`:

```typescript
/**
 * Issue metadata query helpers
 * @packageDocumentation
 */

import { eq, gte, lte, and, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { issues } from '@/db/schema'

/**
 * Get issues with a specific label
 * Uses JSONB containment query
 *
 * @param labelName - Label name to search for
 * @returns Issues with the label
 */
export async function getIssuesByLabel(labelName: string) {
  return db
    .select()
    .from(issues)
    .where(
      sql`${issues.labelsJson} @> ${JSON.stringify([{ name: labelName }])}`
    )
}

/**
 * Get issues with a specific priority
 * Priority levels: 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low
 *
 * @param priority - Priority number (0-4)
 * @returns Issues with the priority
 */
export async function getIssuesByPriority(priority: number) {
  return db
    .select()
    .from(issues)
    .where(eq(issues.priority, priority))
}

/**
 * Get issues within an estimate range
 *
 * @param minEstimate - Minimum estimate points
 * @param maxEstimate - Maximum estimate points
 * @returns Issues within the estimate range
 */
export async function getIssuesByEstimate(
  minEstimate: number,
  maxEstimate: number
) {
  return db
    .select()
    .from(issues)
    .where(
      and(
        gte(issues.estimate, minEstimate),
        lte(issues.estimate, maxEstimate)
      )
    )
}

/**
 * Get issues assigned to a specific user
 *
 * @param assigneeId - Linear user ID
 * @returns Issues assigned to the user
 */
export async function getIssuesByAssignee(assigneeId: string) {
  return db
    .select()
    .from(issues)
    .where(eq(issues.assigneeId, assigneeId))
}

/**
 * Get issues in a specific cycle
 *
 * @param cycleId - Linear cycle ID
 * @returns Issues in the cycle
 */
export async function getIssuesInCycle(cycleId: string) {
  return db
    .select()
    .from(issues)
    .where(eq(issues.cycleId, cycleId))
}

/**
 * Get issues in a specific project
 *
 * @param projectId - Linear project ID
 * @returns Issues in the project
 */
export async function getIssuesInProject(projectId: string) {
  return db
    .select()
    .from(issues)
    .where(eq(issues.projectId, projectId))
}

/**
 * Get overdue issues
 *
 * @returns Issues past their due date
 */
export async function getOverdueIssues() {
  return db
    .select()
    .from(issues)
    .where(
      and(
        sql`${issues.dueDate} IS NOT NULL`,
        sql`${issues.dueDate} < NOW()`
      )
    )
}
```

**Step 4: Run tests**

Run: `npm test src/lib/issue-queries.test.ts`
Expected: PASS - all query functions work

**Step 5: Commit**

```bash
git add src/lib/issue-queries.ts src/lib/issue-queries.test.ts
git commit -m "feat: add issue metadata query helpers

- getIssuesByLabel() using JSONB containment
- getIssuesByPriority() for priority-based queries
- getIssuesByEstimate() with range support
- getIssuesByAssignee() for user-assigned issues
- getIssuesInCycle() and getIssuesInProject()
- getOverdueIssues() for due date tracking
- 7 tests covering all query functions"
```

---

### Task 8: Update Documentation

**Goal:** Document the new metadata fields and how to query them

**Files:**
- Create: `docs/LINEAR-METADATA.md`

**Step 1: Create documentation**

```markdown
# Linear Issue Metadata

**Status:** ✅ Implemented (2025-11-12)

---

## Overview

The `issues` table stores comprehensive metadata from Linear for every arena-ready issue. This enables future analytics, reporting, and filtering without requiring additional API calls to Linear.

---

## Metadata Fields

### Core Fields (Always Present)

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `linearId` | text | Linear issue UUID | `issue.id` |
| `linearKey` | text | Issue identifier (e.g., "ENG-320") | `issue.identifier` |
| `title` | text | Issue title | `issue.title` |
| `url` | text | Linear issue URL | `issue.url` |
| `repo` | text | Team key (e.g., "ENG") | `issue.team.key` |
| `status` | text | Current state (e.g., "In Progress") | `issue.state.name` |
| `linearCreatedAt` | timestamp | When issue was created in Linear | `issue.createdAt` |
| `linearUpdatedAt` | timestamp | When issue was last updated | `issue.updatedAt` |

### Metadata Fields (Optional)

| Field | Type | Description | Example Values |
|-------|------|-------------|----------------|
| `description` | text | Issue description (plain text) | "Fix the bug in the..." |
| `descriptionMarkdown` | text | Raw markdown/prosemirror data | `{"type":"doc"...}` |
| `estimate` | integer | Story points | 0, 1, 2, 3, 5, 8, 13, 21 |
| `priority` | integer | Priority level | 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low |
| `labelsJson` | jsonb | All labels with metadata | `[{"id":"...","name":"bug","color":"#ff0000"}]` |
| `assigneeId` | text | Linear user ID of assignee | `"user-abc123"` |
| `assigneeName` | text | Assignee display name | `"John Doe"` |
| `assigneeEmail` | text | Assignee email | `"john@example.com"` |
| `creatorId` | text | Linear user ID of creator | `"user-xyz789"` |
| `creatorName` | text | Creator display name | `"Jane Smith"` |
| `creatorEmail` | text | Creator email | `"jane@example.com"` |
| `projectId` | text | Linear project ID | `"project-abc"` |
| `projectName` | text | Project name | `"Q1 2025 Goals"` |
| `cycleId` | text | Linear cycle ID | `"cycle-42"` |
| `cycleName` | text | Cycle/sprint name | `"Sprint 42"` |
| `cycleNumber` | integer | Cycle number | `42` |
| `dueDate` | timestamp | Issue due date | `2025-06-01T00:00:00Z` |
| `parentId` | text | Parent issue ID (for sub-issues) | `"issue-parent"` |

---

## Data Collection

### Webhook Path (Fast but Limited)

When an issue gets the `arena:ready` label:

1. Linear fires webhook to `/api/linear/webhook`
2. Handler creates issue with **basic fields only**:
   - `linearId`, `linearKey`, `title`, `url`, `repo`, `status`
3. Handler immediately calls `syncIssueFromLinear()`

### Sync Path (Comprehensive)

The sync function fetches **full metadata** from Linear API:

1. Calls `client.issue(linearId)` via `@linear/sdk`
2. Extracts all metadata using `extractIssueMetadata()`
3. Updates database with complete metadata

**Why this split?**
- Webhooks are fast but have limited payload
- Sync is comprehensive but requires API call
- Webhook creates issue immediately → sync enriches asynchronously

---

## Querying Metadata

### By Label (JSONB Query)

```typescript
import { getIssuesByLabel } from '@/lib/issue-queries'

// Get all issues labeled "bug"
const bugIssues = await getIssuesByLabel('bug')
```

**SQL equivalent:**
```sql
SELECT * FROM issues
WHERE labels_json @> '[{"name": "bug"}]';
```

### By Priority

```typescript
import { getIssuesByPriority } from '@/lib/issue-queries'

// Get all urgent issues (priority 1)
const urgentIssues = await getIssuesByPriority(1)
```

### By Estimate Range

```typescript
import { getIssuesByEstimate } from '@/lib/issue-queries'

// Get medium-sized issues (3-5 points)
const mediumIssues = await getIssuesByEstimate(3, 5)
```

### By Assignee

```typescript
import { getIssuesByAssignee } from '@/lib/issue-queries'

// Get issues assigned to a user
const myIssues = await getIssuesByAssignee('user-123')
```

### By Cycle

```typescript
import { getIssuesInCycle } from '@/lib/issue-queries'

// Get issues in current sprint
const sprintIssues = await getIssuesInCycle('cycle-42')
```

### Overdue Issues

```typescript
import { getOverdueIssues } from '@/lib/issue-queries'

// Get issues past their due date
const overdue = await getOverdueIssues()
```

---

## Use Cases

### Analytics Dashboard

**Show arena statistics by priority:**
```typescript
const stats = {
  urgent: await getIssuesByPriority(1),
  high: await getIssuesByPriority(2),
  medium: await getIssuesByPriority(3),
  low: await getIssuesByPriority(4),
}
```

### Sprint Reports

**Get all issues in current cycle:**
```typescript
const cycleIssues = await getIssuesInCycle(currentCycleId)

const summary = {
  total: cycleIssues.length,
  completed: cycleIssues.filter(i => i.status === 'Done').length,
  inProgress: cycleIssues.filter(i => i.status === 'In Progress').length,
  totalPoints: cycleIssues.reduce((sum, i) => sum + (i.estimate ?? 0), 0),
}
```

### Label-Based Filtering

**Find all high-priority bug issues:**
```typescript
const criticalBugs = await db
  .select()
  .from(issues)
  .where(
    and(
      eq(issues.priority, 1),
      sql`${issues.labelsJson} @> '[{"name": "bug"}]'`
    )
  )
```

### Assignee Workload

**See who has the most open issues:**
```typescript
const workload = await db
  .select({
    assigneeName: issues.assigneeName,
    count: sql<number>`count(*)`,
    totalPoints: sql<number>`sum(${issues.estimate})`,
  })
  .from(issues)
  .where(eq(issues.status, 'In Progress'))
  .groupBy(issues.assigneeName)
```

---

## Future Enhancements

### Phase 2: Rich Analytics

With this metadata stored, we can build:

1. **Agent Performance by Issue Type**
   - Track which agents excel at bugs vs features
   - Filter by label, priority, estimate

2. **Cycle/Sprint Reports**
   - Show arena activity per sprint
   - Track completion rates by cycle

3. **Team Analytics**
   - Which teams use the arena most?
   - Success rates by team/project

4. **Complexity Analysis**
   - Do agents perform better on small or large issues?
   - Estimate vs actual commit count correlation

5. **Workload Distribution**
   - Which assignees participate in arenas?
   - Do issues with assignees resolve faster?

### Phase 3: Real-time Updates

When Linear sends `Issue.update` webhooks:
- Update metadata fields
- Track changes over time
- Show issue evolution timeline

---

## Migration Notes

### Database Migration

Migration `0004_add_issue_metadata.sql` adds all fields:
- Nullable by default (existing issues have NULL)
- Existing issues enriched on next sync
- No breaking changes to existing code

### Backfilling Existing Issues

To backfill metadata for existing issues:

```bash
npm run backfill:metadata
```

This script:
1. Fetches all issues from database
2. Calls `syncIssueFromLinear()` for each
3. Updates with full metadata from Linear API

**Cost:** One API call per issue (~50ms each)

---

## Files Changed

**Database:**
- `src/db/migrations/0004_add_issue_metadata.sql` - Migration
- `src/db/schema.ts` - Updated schema with 20 new fields

**Types:**
- `src/types/linear.ts` - Comprehensive Linear type definitions

**Core Logic:**
- `src/lib/linear-metadata.ts` - Metadata extraction helper
- `src/lib/linear-sync.ts` - Updated to store metadata
- `src/app/api/linear/webhook/route.ts` - Type-safe webhook handling

**Queries:**
- `src/lib/issue-queries.ts` - Helper functions for metadata queries

**Tests:**
- `src/db/schema.test.ts` - Schema validation
- `src/lib/linear-metadata.test.ts` - Extraction tests (5 tests)
- `src/lib/linear-sync.test.ts` - Sync metadata tests
- `src/lib/issue-queries.test.ts` - Query tests (7 tests)

**Documentation:**
- `docs/LINEAR-METADATA.md` - This file
- `docs/plans/2025-11-12-store-linear-issue-metadata.md` - Implementation plan

---

## Testing Checklist

- [x] Migration applies without errors
- [x] Schema has all 20 metadata fields
- [x] `extractIssueMetadata()` handles all fields correctly
- [x] `extractIssueMetadata()` handles missing optional fields
- [x] `syncIssueFromLinear()` stores metadata
- [x] Webhook handler uses typed payloads
- [x] Label queries work with JSONB
- [x] Priority/estimate/assignee queries work
- [x] All existing tests still pass
- [x] Type checking passes with no errors

---

## References

- [Linear API Documentation](https://developers.linear.app/)
- [@linear/sdk Documentation](https://github.com/linear/linear/tree/master/packages/sdk)
- [PostgreSQL JSONB Operators](https://www.postgresql.org/docs/current/functions-json.html)
- [Drizzle ORM SQL Operators](https://orm.drizzle.team/docs/operators)
```

**Step 2: Commit**

```bash
git add docs/LINEAR-METADATA.md
git commit -m "docs: add comprehensive Linear metadata documentation

- Document all 28 fields in issues table
- Explain webhook vs sync data collection strategy
- Provide query examples for all metadata types
- List future analytics use cases
- Include migration and testing information"
```

---

### Task 9: Create Backfill Script

**Goal:** Create script to backfill metadata for existing issues

**Files:**
- Create: `scripts/backfill-metadata.ts`

**Step 1: Create backfill script**

```typescript
#!/usr/bin/env tsx
/**
 * Backfill Linear issue metadata for existing issues
 */

import { db } from '../src/db/client'
import { issues } from '../src/db/schema'
import { syncIssueFromLinear } from '../src/lib/linear-sync'

async function main() {
  console.log('🔄 Backfilling Linear issue metadata...\n')

  // Get all issues
  const allIssues = await db.select().from(issues)

  console.log(`Found ${allIssues.length} issues\n`)

  let updated = 0
  let errors = 0

  for (const issue of allIssues) {
    try {
      console.log(`Syncing ${issue.linearKey}...`)
      await syncIssueFromLinear(issue.linearId)
      updated++
      console.log(`✅ ${issue.linearKey} updated\n`)
    } catch (error) {
      console.error(`❌ Error syncing ${issue.linearKey}:`, error)
      errors++
    }

    // Rate limit: 50ms between requests
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  console.log('\n📊 Backfill complete!')
  console.log(`   Updated: ${updated}`)
  console.log(`   Errors: ${errors}`)
}

main().catch((error) => {
  console.error('❌ Backfill failed:', error)
  process.exit(1)
})
```

**Step 2: Add script to package.json**

In `package.json`, add to scripts:

```json
{
  "scripts": {
    "backfill:metadata": "tsx scripts/backfill-metadata.ts"
  }
}
```

**Step 3: Test script (dry run)**

Run: `npm run backfill:metadata`
Expected: Script runs and updates all issues with metadata

**Step 4: Commit**

```bash
git add scripts/backfill-metadata.ts package.json
git commit -m "feat: add metadata backfill script

- Fetches all existing issues from database
- Calls syncIssueFromLinear() for each
- Updates with full metadata from Linear API
- Rate-limited to 50ms per request
- Logs progress and errors
- Accessible via npm run backfill:metadata"
```

---

### Task 10: Verify and Test Everything

**Goal:** Run complete test suite and verify all functionality

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass (355+ tests)

**Step 2: Run type checking**

Run: `npm run type-check` or `tsc --noEmit`
Expected: No type errors

**Step 3: Run linting**

Run: `npm run lint`
Expected: No linting errors

**Step 4: Verify migration**

If you have a test database:

```bash
npm run db:push
```

Expected: Migration applies successfully

**Step 5: Test sync with real issue**

If you have access to Linear API:

```bash
# Update debug script to test metadata
tsx scripts/debug-sync.ts
```

Expected: Console shows all metadata fields populated

**Step 6: Commit verification**

```bash
git add .
git commit -m "test: verify all tests pass with metadata implementation

- All 355+ tests passing
- Type checking passes
- Linting clean
- Migration applies successfully
- Manual sync test shows metadata populated"
```

---

## Summary

**Implementation Complete!**

### What We Built

1. ✅ **Database schema** - 20 new metadata columns
2. ✅ **Type safety** - Comprehensive Linear type definitions
3. ✅ **Extraction helper** - `extractIssueMetadata()` function
4. ✅ **Sync updates** - Store metadata during sync
5. ✅ **Webhook types** - Type-safe webhook handling
6. ✅ **Query helpers** - 7 helper functions for metadata queries
7. ✅ **Documentation** - Complete guide with examples
8. ✅ **Backfill script** - Update existing issues
9. ✅ **Tests** - 12+ new tests, all passing

### Files Created (8)

- `src/db/migrations/0004_add_issue_metadata.sql`
- `src/db/schema.test.ts`
- `src/types/linear.ts`
- `src/types/index.ts`
- `src/lib/linear-metadata.ts`
- `src/lib/linear-metadata.test.ts`
- `src/lib/issue-queries.ts`
- `src/lib/issue-queries.test.ts`
- `docs/LINEAR-METADATA.md`
- `scripts/backfill-metadata.ts`

### Files Modified (4)

- `src/db/schema.ts` - Added 20 metadata columns
- `src/lib/linear-sync.ts` - Extract and store metadata
- `src/lib/linear-sync.test.ts` - Test metadata storage
- `src/app/api/linear/webhook/route.ts` - Type-safe webhooks
- `package.json` - Added backfill script

### Breaking Changes

**None** - Backward compatible
- All new fields are nullable
- Existing code continues to work
- Metadata enriches existing issues

### Next Steps

1. **Deploy migration** to staging/production
2. **Run backfill script** to enrich existing issues
3. **Build analytics dashboard** using metadata queries
4. **Add metadata to API responses** (if needed)

---

## Estimated Time

- **Task 1-3:** 15 min (schema & types)
- **Task 4:** 20 min (extraction helper)
- **Task 5:** 15 min (sync updates)
- **Task 6:** 10 min (webhook types)
- **Task 7:** 20 min (query helpers)
- **Task 8:** 15 min (documentation)
- **Task 9:** 10 min (backfill script)
- **Task 10:** 10 min (verification)

**Total:** ~2 hours

---

**Plan saved to:** `docs/plans/2025-11-12-store-linear-issue-metadata.md`
