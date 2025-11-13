# ENG-320 Workflow Analysis: Real-World Agent Activity

**Date:** 2025-11-11
**Issue:** ENG-320 (ID: e7376814-a82e-48a4-bea7-55a263f88a09)
**Linear URL:** https://linear.app/recall-labs/issue/ENG-320/drop-uuid-package-usage-for-native-crypto-and-uuids

---

## Executive Summary

This document provides a comprehensive analysis of ENG-320, a real-world Linear issue where 3 agents were manually tagged via comments, with 2 agents responding with PRs. The analysis identifies missing webhook handlers and provides a complete implementation plan.

**Key Findings:**
- ✅ Issue events are handled (label tracking)
- ✅ Attachment events are handled (PR tracking)
- ❌ **Comment events are NOT handled** (agent mentions missed)
- ❌ **State history events are NOT tracked** (workflow transitions invisible)

---

## 1. Complete Issue Data

### Issue Metadata
```json
{
  "id": "e7376814-a82e-48a4-bea7-55a263f88a09",
  "identifier": "ENG-320",
  "title": "Drop `uuid` package usage for native `crypto` and UUID's",
  "url": "https://linear.app/recall-labs/issue/ENG-320/drop-uuid-package-usage-for-native-crypto-and-uuids",
  "status": "In Progress",
  "team": "ENG (Engineering)",
  "created": "2025-09-03T16:03:38.881Z",
  "startedAt": "2025-11-12T00:07:29.379Z",
  "labels": [
    {
      "id": "8c6370da-0524-466a-8ffa-337e00c1a64e",
      "name": "ar",
      "color": "#26b5ce",
      "createdAt": "2025-11-12T03:19:25.719Z"
    }
  ]
}
```

### Description
```
we use `import { v4 as uuidv4 } from "uuid";` and leverage `uuidv4()` pretty much
everywhere else in our code. but, `crypto.randomUUID()` is the more "correct"
option since its faster/native to nodejs. they produce the same UUID's.

although, if for some reason we want a "newer" UUID format like v7, then we'd
want to do the opposite: migrate everything to `import { v7 as uuidv7 } from "uuid"`
```

---

## 2. Agent Comment Activity (COMPLETE TIMELINE)

### Comment #1: Initial Tag (@cyrus) - UNANSWERED
- **ID:** 07e5bc26-0c0b-4d81-8e6d-da65ff5646f1
- **User:** Andrew Hill (andrew@textile.io)
- **Time:** 2025-11-12T00:06:59.292Z
- **Body:** `@cyrus can you create a PR to fix this?`
- **Status:** No response from Cyrus

### Comment #2: Second Tag (@cursor)
- **ID:** 3fe6c395-5879-4aca-8400-af14c9c20593
- **User:** Andrew Hill (andrew@textile.io)
- **Time:** 2025-11-12T00:07:15.089Z
- **Body:** `@cursor can you create a PR to fix this?`
- **Parent:** null (top-level comment)

### Comment #3: Third Tag (@engine)
- **ID:** 5310cbcc-304a-4830-beef-c9188e7a39ff
- **User:** Andrew Hill (andrew@textile.io)
- **Time:** 2025-11-12T00:07:28.138Z
- **Body:** `@engine can you create a PR to fix this?`
- **Parent:** null (top-level comment)
- **Updated:** 2025-11-12T00:07:52.779Z (Linear auto-updates when mentioned user responds)

### Comment #4: Engine Response
- **ID:** 51e68655-d718-4c5a-b744-8479b0bfcaf7
- **User:** Engine (19b2fc19-10a3-4502-b030-417149f1fe3e@oauthapp.linear.app)
- **Time:** 2025-11-12T00:07:52.766Z
- **Parent:** 5310cbcc-304a-4830-beef-c9188e7a39ff (replying to @engine tag)
- **Body Summary:** Acknowledges task, asks which repository to target
- **Key Quote:** "I can help you replace the `uuid` package with native Node.js `crypto.randomUUID()`..."

### Comment #5: Andrew Clarifies Repository
- **ID:** 1a854213-43cd-4464-9c48-db3948b3b88a
- **User:** Andrew Hill (andrew@textile.io)
- **Time:** 2025-11-12T00:08:42.879Z
- **Body:** `js-recall`
- **Parent:** 5310cbcc-304a-4830-beef-c9188e7a39ff (clarifying for Engine)

### Comment #6: Andrew Tags Cyrus Again
- **ID:** 017b950c-4040-421e-80d8-f867bc44eb25
- **User:** Andrew Hill (andrew@textile.io)
- **Time:** 2025-11-12T00:08:04.865Z
- **Body:** `@cyrus can you create a PR to fix this?`
- **Parent:** null (another top-level attempt to get Cyrus)

### Comment #7: Cursor Response with PR
- **ID:** 018228d0-d153-4728-8d2d-10ff1bf9292d
- **User:** Cursor (afd5064f-8c2e-4f60-a91a-2b753321d325@oauthapp.linear.app)
- **Time:** 2025-11-12T00:16:55.078Z
- **Parent:** 3fe6c395-5879-4aca-8400-af14c9c20593 (replying to @cursor tag)
- **Body Summary:** Complete work summary with test results
- **Key Links:**
  - Cursor Agent: https://www.cursor.com/agents?id=bc-b830d46b-5d08-4e41-a00d-a863303b82f4
  - Branch: `cursor/ENG-320-replace-uuid-package-with-crypto-module-8d63`
- **Status:** ✅ All tests pass, linter passes, build succeeds

### Comment #8: Engine Response with PR
- **ID:** 2e65239c-8537-4f84-8f0d-e12c4a32c69b
- **User:** Engine (19b2fc19-10a3-4502-b030-417149f1fe3e@oauthapp.linear.app)
- **Time:** 2025-11-12T00:38:57.123Z
- **Parent:** 5310cbcc-304a-4830-beef-c9188e7a39ff (replying to @engine tag)
- **Body Summary:** Created PR with implementation details
- **Key Links:**
  - PR: https://github.com/recallnet/js-recall/pull/1559
- **Status:** Task created, CI checks running

---

## 3. PR Attachments (CURRENT STATE)

**CRITICAL FINDING:** Despite having 2 PRs referenced in comments, there are **ZERO attachments** in the Linear API response.

```json
"attachments": {
  "nodes": []
}
```

### Expected PRs (from comments):
1. **Cursor PR** - Referenced in comment but not attached
   - Repository: `recallnet/js-recall`
   - Branch: `cursor/ENG-320-replace-uuid-package-with-crypto-module-8d63`
   - Agent Link: https://www.cursor.com/agents?id=bc-b830d46b-5d08-4e41-a00d-a863303b82f4

2. **Engine PR** - Explicitly attached
   - URL: https://github.com/recallnet/js-recall/pull/1559
   - Repository: `recallnet/js-recall`

### Possible Explanations:
- PRs were referenced but never formally attached to the Linear issue
- Attachments may have been added after our API query
- Agents may link PRs in comments without creating Linear attachments

---

## 4. State History

### Timeline of State Changes:

1. **2025-09-11T17:20:10.645Z** - Initial activity (unknown action)
   - Actor: Stephanie Huynh (stephanie@textile.io)

2. **2025-11-11T19:17:35.636Z** - Label activity
   - Actor: Andrew Hill (andrew@textile.io)

3. **2025-11-12T00:07:29.366Z** - Issue started (Backlog → In Progress)
   - Actor: Cursor (afd5064f-8c2e-4f60-a91a-2b753321d325@oauthapp.linear.app)
   - Assignee: Andrew Hill
   - **Note:** Cursor agent auto-started the issue when accepting work

4. **2025-11-12T03:19:26.240Z** - "ar" label added
   - Actor: Andrew Hill (andrew@textile.io)

---

## 5. Subscriber Activity

All mentioned agents automatically subscribed to the issue:

```json
"subscribers": [
  { "name": "Cursor", "email": "afd5064f-8c2e-4f60-a91a-2b753321d325@oauthapp.linear.app" },
  { "name": "Cyrus", "email": "c03d5b6e-5b75-4c2a-b656-d519cec2fc25@oauthapp.linear.app" },
  { "name": "Engine", "email": "19b2fc19-10a3-4502-b030-417149f1fe3e@oauthapp.linear.app" },
  { "name": "Dan Buchholz", "email": "dan@textile.io" },
  { "name": "Andrew Hill", "email": "andrew@textile.io" }
]
```

---

## 6. Linear Webhook Event Types

### Complete List of Available Events

Based on Linear's official webhook documentation:

#### Standard CRUD Events (create, update, remove):
- `Issue` - Issue lifecycle events ✅ **HANDLED**
- `Attachment` - PR/document links ✅ **HANDLED**
- `Comment` - Comment threads ❌ **NOT HANDLED**
- `IssueLabel` - Label changes ⚠️ **PARTIAL** (handled via Issue events)
- `Project` - Project management
- `ProjectUpdate` - Status updates
- `Document` - Documentation changes
- `Initiative` - Strategic planning
- `InitiativeUpdate` - Progress tracking
- `Cycle` - Sprint/cycle management
- `Customer` - Customer data
- `CustomerRequest` - Support tickets
- `User` - Team member updates
- `Reaction` - Emoji reactions

#### Special Event Types:
- `IssueSla` - Actions: `set`, `highRisk`, `breached`
- `OAuthAppRevoked` - OAuth authorization lost

### Webhook Payload Structure

All webhooks include these standard fields:

```typescript
{
  action: 'create' | 'update' | 'remove' | 'set' | 'highRisk' | 'breached'
  actor: {
    id: string
    type: 'user' | 'oauthClient' | 'integration'
    name: string
    email: string
    url: string
  }
  data: Record<string, unknown> // Serialized entity
  type: string // Entity category
  createdAt: string // ISO timestamp
  url: string // Resource link
  updatedFrom?: Record<string, unknown> // Previous values (updates only)
  webhookTimestamp: number // UNIX milliseconds
  webhookId: string // Unique identifier
  organizationId: string
}
```

---

## 7. Missing Event Handlers Analysis

### 7.1 Comment Events (HIGH PRIORITY)

**Event Type:** `Comment`
**Actions:** `create`, `update`, `remove`

#### Comment Create Payload Example:
```json
{
  "action": "create",
  "type": "Comment",
  "data": {
    "id": "2174add1-f7c8-44e3-bbf3-2d60b5ea8bc9",
    "createdAt": "2020-01-23T12:53:18.084Z",
    "updatedAt": "2020-01-23T12:53:18.084Z",
    "body": "@cursor can you create a PR to fix this?",
    "edited": false,
    "issueId": "539068e2-ae88-4d09-bd75-22eb4a59612f",
    "userId": "aacdca22-6266-4c0a-ab3c-8fa70a26765c"
  },
  "url": "https://linear.app/issue/LIN-1778/foo-bar#comment-77217de3",
  "webhookTimestamp": 1676056940508
}
```

#### What We Need to Extract:
1. **Agent Mentions** - Parse `@cursor`, `@engine`, `@cyrus` from `body`
2. **Issue Association** - Use `data.issueId` to find database issue
3. **Trigger Timestamp** - When agent was requested to act
4. **Comment Thread** - Track parent/child relationships for context

#### Use Cases:
- **Dispatch Tracking** - Record when agents were manually requested
- **Response Latency** - Measure time from mention to PR creation
- **Multi-Agent Comparison** - Track which agents respond vs ignore
- **Comment-to-PR Linking** - Associate PRs with original request comments

---

### 7.2 State Change Events (MEDIUM PRIORITY)

**Current Implementation:** State changes are captured via `Issue.update` events
**Gap:** No dedicated tracking of state transitions

#### What's Missing:
- State transition audit trail (Backlog → In Progress → Done)
- Who triggered each state change
- Automatic vs manual state changes (e.g., Cursor auto-started ENG-320)

#### Recommendation:
Current implementation is sufficient. State is updated in `handleIssueEvent()` when `action: 'update'` fires. Consider adding state change logging if detailed audit trail is needed.

---

### 7.3 Label Events (LOW PRIORITY)

**Current Implementation:** Labels are tracked via `Issue.update` events
**Gap:** No timestamp for when arena label was added (only tracked at issue upsert)

#### Current Schema:
```typescript
arenaReadyLabeledAt: timestamp('arena_ready_labeled_at', { withTimezone: true })
```

#### Enhancement Opportunity:
- Add `arenaLabelRemovedAt` to track label removal
- Track label change history in events table
- Alert if arena label is removed from active issue

---

## 8. Real-World Workflow Sequence

Based on ENG-320 data, here's the actual agent workflow:

```
1. Issue Created (2025-09-03)
   └─ ENG-320 created by Dan Buchholz

2. Issue Dormant (2 months)

3. Arena Label Added (2025-11-12T03:19:26Z)
   └─ Andrew Hill adds "ar" label
   └─ ✅ Webhook: Issue.update → Issue tracked in database

4. Manual Agent Tags (2025-11-12T00:06-00:08)
   ├─ @cyrus tagged (00:06:59) - NO RESPONSE
   ├─ @cursor tagged (00:07:15)
   ├─ @engine tagged (00:07:28)
   └─ @cyrus tagged again (00:08:04) - STILL NO RESPONSE
   └─ ❌ No webhook handler for Comment.create

5. Cursor Auto-Starts Issue (2025-11-12T00:07:29Z)
   └─ State: Backlog → In Progress
   └─ Assignee: Andrew Hill
   └─ ✅ Webhook: Issue.update → Status updated

6. Engine Responds (00:07:52)
   └─ Asks for repository clarification
   └─ ❌ No Comment.create webhook processed

7. Andrew Clarifies (00:08:42)
   └─ Replies "js-recall"
   └─ ❌ No Comment.create webhook processed

8. Cursor Submits PR (00:16:55)
   └─ Links to Cursor agent task
   └─ Reports all tests passing
   └─ ❌ No Comment.create webhook processed
   └─ ❓ Unknown: Was PR attached to Linear? (attachments array is empty)

9. Engine Submits PR (00:38:57)
   └─ GitHub PR #1559
   └─ ❌ No Comment.create webhook processed
   └─ ❓ Unknown: Was PR attached to Linear? (attachments array is empty)

10. Expected: PR Attachments Created
    └─ ✅ Webhook: Attachment.create → PR tracked as attempt
    └─ ⚠️  BUT: No attachments found in API query!
```

---

## 9. Data We Should Be Tracking

### Currently Missing:

| Event | Data Point | Current State | Impact |
|-------|-----------|---------------|--------|
| Comment.create | Agent mention timestamp | ❌ Not tracked | Cannot measure dispatch → response latency |
| Comment.create | Which agents were tagged | ❌ Not tracked | Cannot identify manual vs automatic dispatch |
| Comment.create | Comment thread structure | ❌ Not tracked | Cannot associate PR comments with original request |
| Comment.create | Agent response comments | ❌ Not tracked | Cannot detect when agent acknowledges task |
| Attachment.create | PR attachment events | ⚠️ Handler exists but no attachments found | May be missing real PR links |
| Issue.update | State transition details | ⚠️ Partial (only current state) | Cannot audit state change history |

---

## 10. Recommended Implementation Plan

### Phase 1: Comment Event Handler (CRITICAL)

**File:** `/Users/andrewhill/Coding/coding-arena/src/app/api/linear/webhook/route.ts`

**New Handler:**
```typescript
async function handleCommentEvent(payload: LinearWebhookPayload): Promise<void> {
  const comment = payload.data as {
    id: string
    body: string
    issueId: string
    userId: string
    createdAt: string
  }

  // Parse agent mentions
  const mentionRegex = /@(cursor|engine|cyrus)\b/gi
  const mentions = [...comment.body.matchAll(mentionRegex)].map(m => m[1].toLowerCase())

  if (mentions.length === 0) return

  // Get issue from database
  const issueResult = await db
    .select({ id: issues.id })
    .from(issues)
    .where(eq(issues.linearId, comment.issueId))
    .limit(1)

  if (issueResult.length === 0) {
    console.warn(`Comment for unknown issue: ${comment.issueId}`)
    return
  }

  const issueId = issueResult[0]!.id

  // Record agent mentions in issue_agents table
  for (const agentName of mentions) {
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
          triggeredAt: new Date(comment.createdAt),
        },
      })

    console.log(`Agent ${agentName} mentioned for issue ${issueId}`)
  }
}
```

**Route Update:**
```typescript
// In POST handler, add:
else if (payload.type === 'Comment') {
  await handleCommentEvent(payload)
}
```

**Test Coverage:**
- Comment with single agent mention
- Comment with multiple agent mentions
- Comment without agent mentions (should skip)
- Comment for unknown issue (should warn and skip)
- Duplicate comment events (idempotency)

---

### Phase 2: Enhanced Schema (OPTIONAL)

Add `issue_agents.comment_id` to link back to original Linear comment:

```typescript
export const issueAgents = pgTable('issue_agents', {
  // ... existing fields ...
  commentId: text('comment_id'), // Linear comment ID where agent was mentioned
  commentUrl: text('comment_url'), // Direct link to comment
})
```

---

### Phase 3: Attachment Investigation (DEBUG)

**Hypothesis:** PRs are being linked but not showing up in API query

**Action Items:**
1. Manually check Linear UI for ENG-320 attachments
2. Query attachments using GraphQL with longer history
3. Check if attachments are created after comment events
4. Verify webhook is subscribed to Attachment events

**Debug Script:**
```bash
pnpm tsx scripts/fetch-eng320-raw.ts | jq '.issue.attachments'
```

---

### Phase 4: Metrics & Analytics

Once Comment events are tracked:

**New Queries:**
- Agent response rate: % of mentions that resulted in PRs
- Response latency: Time from mention to first PR
- Multi-agent comparison: Which agents respond fastest
- Request vs delivery: Tagged agents vs actual PRs

**Dashboard Additions:**
- "Agent Mentions" column in leaderboard
- "Avg Response Time" metric
- "Mention → PR Rate" percentage

---

## 11. Testing Strategy

### Integration Tests

**File:** `/Users/andrewhill/Coding/coding-arena/src/app/api/linear/webhook/route.test.ts`

**New Test Cases:**
```typescript
describe('Comment events', () => {
  it('should track agent mention in comment', async () => {
    // Test single @cursor mention
  })

  it('should track multiple agent mentions in one comment', async () => {
    // Test @cursor @engine @cyrus in one comment
  })

  it('should ignore comments without agent mentions', async () => {
    // Regular comment with no @ mentions
  })

  it('should handle comment on unknown issue', async () => {
    // Comment for issue not in database yet
  })

  it('should update existing mention timestamp', async () => {
    // Agent mentioned twice in different comments
  })
})
```

---

## 12. Next Steps

### Immediate Actions:
1. ✅ **Document ENG-320 workflow** (this document)
2. ⬜ Implement Comment webhook handler
3. ⬜ Add Comment event tests
4. ⬜ Investigate missing PR attachments
5. ⬜ Deploy and test with live webhooks

### Follow-up:
- Monitor ENG-320 for new attachment events
- Create another test issue to validate full workflow
- Build agent mention analytics dashboard
- Document agent response patterns

---

## 13. Raw Data Reference

**Full JSON Dump:** See `/tmp/eng320-raw.json`

**Key IDs for Testing:**
- Issue ID: `e7376814-a82e-48a4-bea7-55a263f88a09`
- Issue Key: `ENG-320`
- Arena Label ID: `8c6370da-0524-466a-8ffa-337e00c1a64e`
- Cursor User ID: `8f02e788-7c5b-47ec-8a35-b907d7a05dbc`
- Engine User ID: `039e79a0-9e12-4000-9359-72957e5b02e2`
- Cyrus User ID: `69fb2b92-e5c6-4899-8cad-8f3aad74d7b3`

---

## Appendix A: Linear Webhook Headers

All webhook requests include these HTTP headers:

```
Accept-Charset: utf-8
Content-Type: application/json; charset=utf-8
Linear-Delivery: <unique-delivery-id>
Linear-Event: <event-type>
Linear-Signature: <hmac-sha256-hex>
User-Agent: Linear-Webhook
```

---

## Appendix B: Retry Logic

Linear webhook retry behavior:
- **Trigger:** Server unavailable, timeout >5s, or non-200 status
- **Attempts:** Maximum 3 retries
- **Backoff:** 1 minute, 1 hour, 6 hours

**Implication:** Our idempotency check must handle retries gracefully.

---

**End of Analysis**
