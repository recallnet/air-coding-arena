# Fix Linear Comment Parent API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix thread-based agent detection by properly accessing Linear comment parent relationships from the API

**Architecture:** The current implementation attempts to access `parentId` from Linear SDK comment responses, but the SDK doesn't expose this field by default. We need to investigate the actual API response, determine how to access parent relationships, and update our code to properly extract and use parent data for thread-based agent detection.

**Tech Stack:**
- TypeScript
- Linear SDK v63.4.0
- Linear GraphQL API (fallback if SDK insufficient)
- Node.js

---

## Task 1: Investigate Linear API Parent Field

**Files:**
- Run: `scripts/debug-sync.ts`
- Analyze output to understand available fields

**Step 1: Run debug script with current Linear API**

```bash
tsx scripts/debug-sync.ts
```

Expected: Output showing comment fields including whether `parent` or `parentId` exists

**Step 2: Document findings**

Create temporary file to capture results:

```bash
tsx scripts/debug-sync.ts > /tmp/linear-api-response.txt 2>&1
```

**Step 3: Analyze the output**

Look for:
- Does `ParentId:` appear in output? If yes, note the value
- Does `Parent:` appear in output? If yes, note the structure
- Are there any parent-related fields logged?

**Expected Outcomes:**
- If `ParentId` exists: Note the field name and value format
- If `ParentId` is missing: Need to investigate Linear SDK/GraphQL docs
- If `Parent` exists as object: May need to access `parent.id` instead of `parentId`

---

## Task 2: Research Linear SDK Documentation

**Files:**
- Read: `node_modules/@linear/sdk/README.md`
- Research: Linear SDK TypeScript definitions

**Step 1: Check Linear SDK type definitions**

```bash
grep -r "Comment" node_modules/@linear/sdk/dist/*.d.ts | head -20
```

Expected: Type definitions showing Comment interface

**Step 2: Check for parent field in Comment type**

```bash
grep -A 50 "interface Comment" node_modules/@linear/sdk/dist/*.d.ts | grep -i parent
```

Expected: Find how parent relationships are typed

**Step 3: Search Linear SDK for comment parent examples**

```bash
find node_modules/@linear/sdk -name "*.md" -exec grep -l "parent" {} \;
```

**Step 4: Document findings in temporary note**

Create `docs/linear-sdk-findings.md`:

```markdown
# Linear SDK Parent Field Investigation

## Comment Type Definition
[Paste relevant type definitions]

## Parent Field Access
[Document how to access parent - e.g., comment.parent, comment.parent(), etc.]

## SDK Version
@linear/sdk: ^63.4.0
```

---

## Task 3: Test Parent Field Access Method

**Files:**
- Modify: `scripts/debug-sync.ts`
- Run test to verify correct access pattern

**Step 1: Update debug script to test parent access**

In `scripts/debug-sync.ts`, around line 47-52, add more detailed logging:

```typescript
// Check for parent relationship
const commentObj = comment as any
console.log(`  Available keys:`, Object.keys(commentObj))

// Try different access patterns
if (commentObj.parent) {
  console.log(`  ✓ parent exists:`, typeof commentObj.parent)
  if (typeof commentObj.parent === 'function') {
    try {
      const parentData = await commentObj.parent
      console.log(`    parent.id:`, parentData?.id)
    } catch (e) {
      console.log(`    parent() call failed:`, e.message)
    }
  } else {
    console.log(`    parent.id:`, commentObj.parent?.id)
  }
}

if (commentObj.parentId) {
  console.log(`  ✓ parentId:`, commentObj.parentId)
}
```

**Step 2: Run updated debug script**

```bash
tsx scripts/debug-sync.ts
```

Expected: Clear indication of which parent access pattern works

**Step 3: Identify correct access pattern**

Based on output, determine one of:
1. `comment.parent` (property returning object with `id`)
2. `await comment.parent` (async function returning parent comment)
3. `comment.parentId` (direct property with parent ID string)
4. Not available (need GraphQL query)

---

## Task 4: Fix linear-sync.ts Parent Access

**Files:**
- Modify: `src/lib/linear-sync.ts:129-131`
- Update parent field extraction based on findings

**Step 1: Update parent extraction in syncComments**

Replace lines 129-131 with correct access pattern. Examples:

**If parent is a property:**
```typescript
// Get parent ID if it exists
const parent = comment.parent
const parentId = parent?.id ?? null
commentParents.set(commentId, parentId)
```

**If parent is async function:**
```typescript
// Get parent ID if it exists (async)
try {
  const parent = await comment.parent
  const parentId = parent?.id ?? null
  commentParents.set(commentId, parentId)
} catch {
  commentParents.set(commentId, null)
}
```

**If parentId is direct property:**
```typescript
// Get parent ID if it exists (keep current approach but verify it works)
const commentAny = comment as any
const parentId = commentAny.parentId as string | undefined
commentParents.set(commentId, parentId ?? null)
```

**Step 2: Add proper TypeScript typing**

After determining correct access, define interface at top of file:

```typescript
interface LinearComment {
  id: string
  body?: string | null
  createdAt: Date
  parent?: { id: string } | null  // Or adjust based on findings
}
```

Update function signature:

```typescript
async function syncComments(
  issueId: string,
  comments: LinearComment[]  // Instead of generic Array<{...}>
): Promise<void> {
```

**Step 3: Remove type assertion**

Replace `comment as any` with proper typing throughout the function.

---

## Task 5: Handle Case Where Parent API Is Unavailable

**Files:**
- Modify: `src/lib/linear-sync.ts:20-52`

**Step 1: Add fallback if Linear SDK doesn't support parent**

If investigation shows `parent`/`parentId` is NOT available via SDK:

At line 44, use GraphQL query directly:

```typescript
// Fetch comments with parent relationship using GraphQL
const commentsQuery = `
  query IssueComments($issueId: String!) {
    issue(id: $issueId) {
      comments {
        nodes {
          id
          body
          createdAt
          parent {
            id
          }
        }
      }
    }
  }
`

const result = await client.client.rawRequest(commentsQuery, { issueId: linearIssueId })
const comments = result.data.issue.comments.nodes
```

**Step 2: Update comment type to match GraphQL response**

```typescript
interface LinearCommentWithParent {
  id: string
  body?: string | null
  createdAt: string  // GraphQL returns ISO string
  parent?: { id: string } | null
}
```

**Step 3: Convert ISO string dates**

```typescript
const commentsWithDates = comments.map(c => ({
  ...c,
  createdAt: new Date(c.createdAt)
}))
```

---

## Task 6: Remove Debug Logging

**Files:**
- Modify: `src/lib/linear-sync.ts:184-186`

**Step 1: Remove console.log statement**

Delete lines 184-186:

```typescript
console.log(
  `[DEBUG] PR ${prNumber} in comment ${commentId}: agent=${agentName}`
)
```

**Step 2: Commit the cleanup**

```bash
git add src/lib/linear-sync.ts
git commit -m "chore: remove debug logging from linear sync"
```

---

## Task 7: Add Thread Detection Tests

**Files:**
- Create: `src/lib/linear-sync.test.ts` (or modify if exists)

**Step 1: Write test for parent chain walking**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { syncIssueFromLinear } from './linear-sync'
import { db } from '@/db/client'

describe('Linear Sync - Thread-Based Detection', () => {
  it('should attribute PR to agent mentioned in parent comment', async () => {
    // Mock Linear API response with parent relationships
    const mockComments = [
      {
        id: 'comment-1',
        body: '@engine can you fix this?',
        createdAt: new Date('2025-11-12T10:00:00Z'),
        parent: null
      },
      {
        id: 'comment-2',
        body: 'https://github.com/org/repo/pull/123',
        createdAt: new Date('2025-11-12T10:05:00Z'),
        parent: { id: 'comment-1' }
      }
    ]

    // TODO: Mock LinearClient and db calls
    // TODO: Call syncIssueFromLinear
    // TODO: Assert PR #123 is attributed to "engine"
  })

  it('should walk up multiple levels to find agent mention', async () => {
    // Test case: PR comment -> reply -> original @mention
  })

  it('should handle circular parent references gracefully', async () => {
    // Test case: comment-1 parent is comment-2, comment-2 parent is comment-1
  })

  it('should fallback to guessAgent when no parent chain', async () => {
    // Test case: PR comment with no parent and no @mention
  })
})
```

**Step 2: Run tests to ensure they fail (RED)**

```bash
npm test src/lib/linear-sync.test.ts
```

Expected: Tests fail because mocks not implemented

**Step 3: Note test implementation for future**

Add TODO comment in test file:

```typescript
// TODO: These tests require mocking LinearClient and database
// Implementation depends on final parent field access method from Task 4
// Complete after parent field access is confirmed working
```

---

## Task 8: Test with Real ENG-320 Data

**Files:**
- Run: `scripts/clear-eng320.ts`
- Run: `scripts/add-eng320.ts`
- Run: `scripts/run-sync.ts`
- Verify: Database state

**Step 1: Clear existing ENG-320 data**

```bash
tsx scripts/clear-eng320.ts
```

Expected: "✅ Cleared ENG-320 data"

**Step 2: Re-add ENG-320 issue**

```bash
tsx scripts/add-eng320.ts
```

Expected: "✅ Added ENG-320"

**Step 3: Run sync with fixed parent detection**

```bash
tsx scripts/run-sync.ts
```

Expected:
- "🔄 Syncing issue..."
- No errors
- "✅ Sync complete"

**Step 4: Verify database state**

```bash
tsx -e "
import { db } from './src/db/client.js'
import { attempts, issueAgents } from './src/db/schema.js'
import { eq } from 'drizzle-orm'

const issueId = '9fa3997d-40a4-40a5-8c92-f18ab3662e3e'

const attemptsData = await db.select().from(attempts).where(eq(attempts.issueId, issueId))
const agentsData = await db.select().from(issueAgents).where(eq(issueAgents.issueId, issueId))

console.log('Attempts:', attemptsData.length)
attemptsData.forEach(a => console.log('  -', a.agentName, 'PR#' + a.prNumber))

console.log('Agents:', agentsData.length)
agentsData.forEach(a => console.log('  -', a.agentName, a.status))

process.exit(0)
"
```

Expected output:
```
Attempts: 1
  - engine PR#1559
Agents: 3
  - engine submitted
  - cursor pending
  - cyrus pending
```

**Step 5: Verify in browser**

Start dev server and check issue page:

```bash
npm run dev
```

Navigate to: http://localhost:3109/issues/9fa3997d-40a4-40a5-8c92-f18ab3662e3e

Expected:
- 3 agents shown (engine, cursor, cyrus)
- 1 attempt shown (engine, PR #1559)
- Engine status: "submitted"

---

## Task 9: Commit Working Implementation

**Files:**
- Commit: `src/lib/linear-sync.ts`
- Commit: `docs/linear-sdk-findings.md` (if created)

**Step 1: Review all changes**

```bash
git diff src/lib/linear-sync.ts
```

**Step 2: Stage changes**

```bash
git add src/lib/linear-sync.ts
```

**Step 3: Commit with detailed message**

```bash
git commit -m "$(cat <<'EOF'
fix: properly access Linear comment parent relationships for thread-based PR attribution

The thread-based agent detection was not working because Linear SDK comment
responses don't expose parentId by default. This commit fixes the parent field
access to properly walk the comment thread chain.

Changes:
- Update parent field extraction in syncComments() to use correct API access pattern
- Add proper TypeScript typing for Linear comment with parent relationship
- Remove debug logging
- Verified with ENG-320: PR #1559 correctly attributed to "engine" only

Fixes: Thread-based detection falling back to guessAgent for all PRs

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Document Parent Field Access Pattern

**Files:**
- Create: `docs/linear-api-notes.md`

**Step 1: Create documentation file**

```markdown
# Linear API Notes

## Comment Parent Relationships

### Access Pattern

Linear SDK comments expose parent relationships via [document actual pattern found]:

[Option 1: Property]
- Access: `comment.parent?.id`
- Type: `{ id: string } | null`

[Option 2: Async Function]
- Access: `await comment.parent`
- Type: Promise<Comment | null>

[Option 3: GraphQL Direct]
- Query parent field explicitly in GraphQL query
- SDK doesn't expose parent by default

### Usage in Codebase

See `src/lib/linear-sync.ts:syncComments()` for implementation of thread-based
agent detection using parent relationships.

### Testing

Verified with issue ENG-320 (Linear ID: e7376814-a82e-48a4-bea7-55a263f88a09):
- PR comment has parent pointing to @engine mention
- Thread detection correctly attributes PR #1559 to "engine" agent

### SDK Version

@linear/sdk: ^63.4.0
```

**Step 2: Commit documentation**

```bash
git add docs/linear-api-notes.md
git commit -m "docs: document Linear SDK parent field access pattern"
```

---

## Verification Checklist

After completing all tasks, verify:

- [ ] Thread-based detection uses actual parent data (not falling back to guessAgent)
- [ ] PR #1559 attributed to "engine" only (not all 3 agents)
- [ ] All 3 agents present in issueAgents table
- [ ] Agent statuses correct (engine: submitted, others: pending)
- [ ] No debug logging in production code
- [ ] TypeScript types properly defined (no `as any`)
- [ ] Dev server runs without errors
- [ ] Database state matches expectations

## Notes for Engineer

- Linear SDK may not expose parent field by default - be prepared to use GraphQL directly
- The `visited` Set in `determineAgentOwnershipFromThread()` prevents infinite loops
- Case sensitivity already fixed - all agent names normalized to lowercase
- Tests marked as TODO - complete after confirming parent access method works
- If you can't get parent data working, document why and consider alternative approaches
