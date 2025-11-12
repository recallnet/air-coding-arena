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

### Query Helper 1: By Label (JSONB Query)

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

### Query Helper 2: By Priority

```typescript
import { getIssuesByPriority } from '@/lib/issue-queries'

// Get all urgent issues (priority 1)
const urgentIssues = await getIssuesByPriority(1)
```

**Priority levels:**
- 0 = No priority
- 1 = Urgent
- 2 = High
- 3 = Medium
- 4 = Low

### Query Helper 3: By Estimate Range

```typescript
import { getIssuesByEstimate } from '@/lib/issue-queries'

// Get medium-sized issues (3-5 points)
const mediumIssues = await getIssuesByEstimate(3, 5)

// Small issues
const smallIssues = await getIssuesByEstimate(0, 2)

// Large issues
const largeIssues = await getIssuesByEstimate(8, 21)
```

**Standard estimates:**
- 0, 1, 2, 3, 5, 8, 13, 21 (Fibonacci)

### Query Helper 4: By Assignee

```typescript
import { getIssuesByAssignee } from '@/lib/issue-queries'

// Get issues assigned to a user
const myIssues = await getIssuesByAssignee('user-123')
```

### Query Helper 5: By Cycle

```typescript
import { getIssuesInCycle } from '@/lib/issue-queries'

// Get issues in current sprint
const sprintIssues = await getIssuesInCycle('cycle-42')
```

### Query Helper 6: By Project

```typescript
import { getIssuesInProject } from '@/lib/issue-queries'

// Get issues in a project
const projectIssues = await getIssuesInProject('project-q1')
```

### Query Helper 7: Overdue Issues

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
import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { issues } from '@/db/schema'

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
import { eq, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { issues } from '@/db/schema'

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
