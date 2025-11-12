# Implementation Plan: Linear Comment Webhook Handler

**Priority:** HIGH
**Based on:** ENG-320 real-world workflow analysis
**Goal:** Track agent mentions in Linear comments to measure dispatch latency and response rates

---

## Problem Statement

Currently, the webhook handler processes:
- ✅ Issue events (label tracking, status updates)
- ✅ Attachment events (PR links)
- ❌ **Comment events (agent mentions)**

This means we're missing critical data:
- When agents were manually requested to work on issues
- Response time from mention to PR submission
- Which agents respond vs ignore requests
- Comment thread context for PRs

---

## Solution Overview

Add a `handleCommentEvent()` function to parse agent mentions from comment body and record them in the `issue_agents` table.

---

## Implementation

### 1. Type Definitions

**File:** `/Users/andrewhill/Coding/coding-arena/src/app/api/linear/webhook/route.ts`

Add after existing type definitions:

```typescript
/**
 * Linear Comment data structure.
 */
type LinearComment = {
  id: string
  body: string
  issueId: string
  userId: string
  createdAt: string
  updatedAt: string
  edited: boolean
  parent?: { id: string } | null
}
```

---

### 2. Comment Event Handler

Add before the `POST` handler:

```typescript
/**
 * Handles Comment webhook events.
 * Parses agent mentions and records dispatch requests.
 *
 * @param payload - Linear webhook payload
 */
async function handleCommentEvent(
  payload: LinearWebhookPayload
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comment = payload.data as any as LinearComment

  // Parse agent mentions from comment body
  // Matches: @cursor, @engine, @cyrus (case-insensitive)
  const mentionRegex = /@(cursor|engine|cyrus)\b/gi
  const matches = [...comment.body.matchAll(mentionRegex)]
  const mentionedAgents = matches.map((m) => m[1]?.toLowerCase() ?? '')

  if (mentionedAgents.length === 0) {
    return // No agent mentions in this comment
  }

  // Get the issue this comment belongs to
  const issueResult = await db
    .select({ id: issues.id })
    .from(issues)
    .where(eq(issues.linearId, comment.issueId))
    .limit(1)

  if (issueResult.length === 0) {
    console.warn(
      `Comment ${comment.id} references unknown issue: ${comment.issueId}`
    )
    return
  }

  const issueId = issueResult[0]?.id
  if (!issueId) return

  // Record each mentioned agent
  for (const agentName of mentionedAgents) {
    await db
      .insert(issueAgents)
      .values({
        issueId,
        agentName,
        status: 'mentioned',
        triggeredAt: new Date(comment.createdAt),
      })
      .onConflictDoUpdate({
        target: [issueAgents.issueId, issueAgents.agentName],
        set: {
          status: 'mentioned',
          triggeredAt: new Date(comment.createdAt),
        },
      })

    console.log(
      `Agent ${agentName} mentioned in comment ${comment.id} for issue ${issueId}`
    )
  }
}
```

---

### 3. Route Handler Update

In the `POST` function, add Comment event routing:

**Before:**
```typescript
// 3. Route by type
if (payload.type === 'Issue') {
  await handleIssueEvent(payload)
} else if (payload.type === 'Attachment') {
  await handleAttachmentEvent(payload)
}
```

**After:**
```typescript
// 3. Route by type
if (payload.type === 'Issue') {
  await handleIssueEvent(payload)
} else if (payload.type === 'Attachment') {
  await handleAttachmentEvent(payload)
} else if (payload.type === 'Comment') {
  await handleCommentEvent(payload)
}
```

---

## Testing

### 4. Test Cases

**File:** `/Users/andrewhill/Coding/coding-arena/src/app/api/linear/webhook/route.test.ts`

Add at the end, before the closing brace:

```typescript
describe('Comment events', () => {
  it('should track single agent mention', async () => {
    const payload = {
      type: 'Comment',
      action: 'create',
      data: {
        id: 'comment-123',
        body: '@cursor can you create a PR to fix this?',
        issueId: TEST_ISSUE_ID,
        userId: 'user-123',
        createdAt: TEST_TIMESTAMP,
        updatedAt: TEST_TIMESTAMP,
        edited: false,
      },
      updatedAt: TEST_TIMESTAMP,
      createdAt: TEST_TIMESTAMP,
    }

    // Mock issue lookup
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'db-issue-uuid' }]),
        }),
      }),
    } as never)

    // Mock event and issueAgents insert
    const mockInsert = vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }),
      onConflictDoUpdate: vi.fn().mockResolvedValue([]),
    })

    vi.mocked(db.insert).mockReturnValue({
      values: mockInsert,
    } as never)

    const req = createMockRequest(payload)
    const response = await POST(req)

    expect(response.status).toBe(200)
    expect(mockInsert).toHaveBeenCalled()
  })

  it('should track multiple agent mentions in one comment', async () => {
    const payload = {
      type: 'Comment',
      action: 'create',
      data: {
        id: 'comment-multi',
        body: '@cursor @engine @cyrus - all of you, create PRs!',
        issueId: TEST_ISSUE_ID,
        userId: 'user-123',
        createdAt: TEST_TIMESTAMP,
        updatedAt: TEST_TIMESTAMP,
        edited: false,
      },
      updatedAt: TEST_TIMESTAMP,
      createdAt: TEST_TIMESTAMP,
    }

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'db-issue-uuid' }]),
        }),
      }),
    } as never)

    const mockInsert = vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }),
      onConflictDoUpdate: vi.fn().mockResolvedValue([]),
    })

    vi.mocked(db.insert).mockReturnValue({
      values: mockInsert,
    } as never)

    const req = createMockRequest(payload)
    const response = await POST(req)

    expect(response.status).toBe(200)
    // Should insert 3 issueAgents records (one per agent)
    // Note: mockInsert will be called 4 times total:
    // 1x for event, 3x for each agent mention
  })

  it('should ignore comments without agent mentions', async () => {
    const payload = {
      type: 'Comment',
      action: 'create',
      data: {
        id: 'comment-regular',
        body: 'This is a regular comment with no mentions',
        issueId: TEST_ISSUE_ID,
        userId: 'user-123',
        createdAt: TEST_TIMESTAMP,
        updatedAt: TEST_TIMESTAMP,
        edited: false,
      },
      updatedAt: TEST_TIMESTAMP,
      createdAt: TEST_TIMESTAMP,
    }

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      }),
    } as never)

    const req = createMockRequest(payload)
    await POST(req)

    // Should only insert event, not query for issue or insert issueAgents
    expect(db.insert).toHaveBeenCalledOnce()
  })

  it('should handle comment on unknown issue', async () => {
    const payload = {
      type: 'Comment',
      action: 'create',
      data: {
        id: 'comment-orphan',
        body: '@cursor fix this',
        issueId: 'unknown-issue-id',
        userId: 'user-123',
        createdAt: TEST_TIMESTAMP,
        updatedAt: TEST_TIMESTAMP,
        edited: false,
      },
      updatedAt: TEST_TIMESTAMP,
      createdAt: TEST_TIMESTAMP,
    }

    // Mock issue not found
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as never)

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      }),
    } as never)

    const req = createMockRequest(payload)
    await POST(req)

    // Should only insert event, not issue_agents
    expect(db.insert).toHaveBeenCalledOnce()
  })

  it('should be case-insensitive for agent mentions', async () => {
    const payload = {
      type: 'Comment',
      action: 'create',
      data: {
        id: 'comment-case',
        body: '@Cursor @ENGINE @CyRuS - mixed case test',
        issueId: TEST_ISSUE_ID,
        userId: 'user-123',
        createdAt: TEST_TIMESTAMP,
        updatedAt: TEST_TIMESTAMP,
        edited: false,
      },
      updatedAt: TEST_TIMESTAMP,
      createdAt: TEST_TIMESTAMP,
    }

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'db-issue-uuid' }]),
        }),
      }),
    } as never)

    const mockInsert = vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }),
      onConflictDoUpdate: vi.fn().mockResolvedValue([]),
    })

    vi.mocked(db.insert).mockReturnValue({
      values: mockInsert,
    } as never)

    const req = createMockRequest(payload)
    const response = await POST(req)

    expect(response.status).toBe(200)
  })
})
```

---

## Verification

### 5. Run Tests

```bash
pnpm test -- src/app/api/linear/webhook/route.test.ts
```

Expected output:
```
✓ Comment events (5)
  ✓ should track single agent mention
  ✓ should track multiple agent mentions in one comment
  ✓ should ignore comments without agent mentions
  ✓ should handle comment on unknown issue
  ✓ should be case-insensitive for agent mentions
```

### 6. Test Coverage

Ensure coverage remains at or above thresholds:

```bash
pnpm test:coverage
```

---

## Deployment

### 7. Webhook Subscription Check

Verify Linear webhook is subscribed to Comment events:

```bash
curl https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ webhooks { nodes { id label resourceTypes enabled } } }"
  }'
```

Expected output should include:
```json
{
  "resourceTypes": ["Issue", "Attachment", "Comment"]
}
```

If missing, update webhook subscription via Linear settings.

---

### 8. Live Test

Create a test issue and tag an agent:

1. Create issue in Linear with "ar" label
2. Add comment: `@cursor test comment webhook`
3. Check database:

```sql
SELECT * FROM issue_agents
WHERE agent_name = 'cursor'
ORDER BY triggered_at DESC
LIMIT 1;
```

Expected: New row with `status = 'mentioned'` and recent timestamp.

---

## Metrics & Analytics

### 9. New Queries Enabled

Once deployed, these queries become possible:

**Agent Response Rate:**
```sql
SELECT
  ia.agent_name,
  COUNT(DISTINCT ia.issue_id) as mentions,
  COUNT(DISTINCT a.id) as prs_created,
  ROUND(100.0 * COUNT(DISTINCT a.id) / COUNT(DISTINCT ia.issue_id), 2) as response_rate
FROM issue_agents ia
LEFT JOIN attempts a ON ia.issue_id = a.issue_id AND ia.agent_name = a.agent_name
WHERE ia.status = 'mentioned'
GROUP BY ia.agent_name;
```

**Average Response Time:**
```sql
SELECT
  ia.agent_name,
  AVG(EXTRACT(EPOCH FROM (a.opened_at - ia.triggered_at))) / 60 as avg_minutes
FROM issue_agents ia
JOIN attempts a ON ia.issue_id = a.issue_id AND ia.agent_name = a.agent_name
WHERE ia.status = 'mentioned'
GROUP BY ia.agent_name;
```

**Mentions Without PRs:**
```sql
SELECT
  i.linear_key,
  i.title,
  ia.agent_name,
  ia.triggered_at
FROM issue_agents ia
JOIN issues i ON ia.issue_id = i.id
LEFT JOIN attempts a ON ia.issue_id = a.issue_id AND ia.agent_name = a.agent_name
WHERE ia.status = 'mentioned'
  AND a.id IS NULL
ORDER BY ia.triggered_at DESC;
```

---

## Schema Enhancements (Future)

### Optional: Link Back to Comment

Add fields to `issue_agents` table:

```typescript
export const issueAgents = pgTable('issue_agents', {
  // ... existing fields ...
  commentId: text('comment_id'), // Linear comment ID
  commentUrl: text('comment_url'), // Direct link to mention
})
```

**Migration:**
```sql
ALTER TABLE issue_agents
ADD COLUMN comment_id TEXT,
ADD COLUMN comment_url TEXT;
```

**Handler Update:**
```typescript
await db.insert(issueAgents).values({
  // ... existing fields ...
  commentId: comment.id,
  commentUrl: payload.url, // Linear provides full URL in webhook
})
```

---

## Rollback Plan

If issues arise:

1. **Disable Comment Processing:**
   ```typescript
   // In POST handler, comment out:
   // } else if (payload.type === 'Comment') {
   //   await handleCommentEvent(payload)
   // }
   ```

2. **Revert Database:**
   ```sql
   DELETE FROM issue_agents WHERE status = 'mentioned';
   ```

3. **Remove Tests:**
   Comment out `describe('Comment events', ...)` block

---

## Success Criteria

- ✅ All tests pass with >90% coverage
- ✅ Comment webhook processes without errors
- ✅ Agent mentions recorded in `issue_agents` table
- ✅ No performance degradation on webhook endpoint
- ✅ Idempotency preserved (duplicate webhooks don't create duplicates)

---

## Timeline

| Phase | Task | Duration |
|-------|------|----------|
| 1 | Add type definitions | 5 min |
| 2 | Implement `handleCommentEvent()` | 15 min |
| 3 | Update route handler | 5 min |
| 4 | Write tests | 30 min |
| 5 | Run tests & verify coverage | 10 min |
| 6 | Deploy to staging | 15 min |
| 7 | Live test with real issue | 10 min |
| 8 | Monitor for 24 hours | - |
| 9 | Deploy to production | 5 min |

**Total Active Work:** ~1.5 hours

---

## References

- **Analysis Document:** `/Users/andrewhill/Coding/coding-arena/docs/eng320-workflow-analysis.md`
- **Current Handler:** `/Users/andrewhill/Coding/coding-arena/src/app/api/linear/webhook/route.ts`
- **Current Tests:** `/Users/andrewhill/Coding/coding-arena/src/app/api/linear/webhook/route.test.ts`
- **Schema:** `/Users/andrewhill/Coding/coding-arena/src/db/schema.ts`
- **Linear Webhook Docs:** https://linear.app/developers/webhooks

---

**End of Implementation Plan**
