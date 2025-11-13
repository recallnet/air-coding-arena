# Linear Webhook Lifecycle Audit

**Date:** 2025-11-12
**Status:** 🔍 Pre-Implementation Review
**Purpose:** Verify system readiness before adding GitHub webhooks

---

## Executive Summary

**Overall Status:** ⚠️ **GAPS IDENTIFIED - NOT PRODUCTION READY**

The system tracks agent mentions and PR submissions correctly, but **lacks automatic agent dispatch**. When you add the `arena:ready` label, the system will:
- ✅ Store the issue in database
- ✅ Sync existing comments/PRs from Linear API
- ❌ **NOT dispatch agents automatically** (you must manually @mention them)

**Critical Missing Feature:** Automatic agent dispatch via Linear comments.

---

## Question 1: Webhook Recovery (Server Downtime)

### Current Behavior: ⚠️ PARTIAL RECOVERY

**Scenario:** Server is down, you add `arena:ready` label, webhook is missed.

**What happens when server restarts:**
- ❌ **No automatic recovery** - No startup hook to sync open issues
- ❌ Webhook is lost (Linear doesn't retry indefinitely)
- ✅ Manual recovery possible: Re-save issue in Linear → triggers new webhook

**Code Evidence:**
```typescript
// No startup/recovery logic exists
// Searched for: startup*.ts, recovery*.ts, cron*.ts
// Result: No files found
```

**Risk Level:** 🔴 HIGH
- If webhook is missed, issue never enters arena
- No monitoring or alerting for missed webhooks
- No automatic reconciliation

**Recommended Fix:**
1. Add startup recovery script:
   ```typescript
   // src/lib/startup-sync.ts
   async function syncOpenArenaIssues() {
     const linearClient = new LinearClient({ apiKey })
     const openIssues = await linearClient.issues({
       filter: { labels: { name: { eq: 'arena:ready' } } }
     })
     for (const issue of openIssues.nodes) {
       await syncIssueFromLinear(issue.id)
     }
   }
   ```

2. Add Vercel cron job (daily):
   ```typescript
   // src/app/api/cron/reconcile/route.ts
   export async function GET(req: NextRequest) {
     // Verify cron secret
     // Sync all open/in_progress issues
   }
   ```

**Manual Workaround (for now):**
- If you suspect a webhook was missed, edit the Linear issue (e.g., add a comment)
- This triggers a new webhook → system syncs it

---

## Question 2: Agent Dispatch Comments

### Current Behavior: ❌ NOT IMPLEMENTED

**Expected (from project.md:72-75):**
> **Trigger agents:**
> - **Mentions**: post a Linear comment to the issue for each agent
> - Include branch template and PR body template

**Actual Implementation:**
```typescript
// route.ts:156-190 - handleIssueEvent()
async function handleIssueEvent(payload: LinearWebhookPayload) {
  // Upsert issue ✅
  // Sync from Linear API ✅
  // Post dispatch comments ❌ NOT IMPLEMENTED
}
```

**What happens when you add `arena:ready`:**
1. ✅ Issue stored in database
2. ✅ Existing @mentions extracted from comments
3. ❌ **No automatic dispatch comments posted**
4. ❌ Agents don't get notified

**Current Workflow (manual):**
- You must manually comment `@cursor can you create a PR?`
- You must manually comment `@engine can you create a PR?`
- You must manually comment `@cyrus can you create a PR?`
- System sees these mentions via comment webhook → records in `issue_agents`

**Risk Level:** 🟡 MEDIUM
- Not a blocker (manual dispatch works)
- Defeats purpose of "automatic arena"
- Increases friction for testing

**Recommended Fix:**
```typescript
// Add to handleIssueEvent() after line 189
async function dispatchAgents(issueId: string, linearIssueId: string) {
  const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY })
  const issue = await client.issue(linearIssueId)

  const agentHandles = ['@cursor', '@engine', '@cyrus', '@claude']

  for (const handle of agentHandles) {
    const agentName = handle.substring(1)
    const comment = `
${handle} Arena trigger: Please start work on this issue.

Use branch:
  ${issueKey}--${slug}--agent-${agentName}

Include in PR body:
  Refs ${issueUrl}
`

    await issue.createComment(comment)

    // Record dispatch
    await db.insert(issueAgents).values({
      issueId,
      agentName,
      status: 'pending',
      triggeredAt: new Date(),
    })
  }
}
```

**Manual Workaround (for now):**
- Manually @mention agents in Linear comments
- System tracks mentions correctly

---

## Question 3: Agent Handles Configuration

### Current Configuration: ✅ MOSTLY COMPLETE

**Configured Agents:**
```typescript
// src/lib/linear-sync.ts:12
const AGENT_HANDLES = ['@cursor', '@engine', '@cyrus', '@claude']
```

**Agent Detection (PR attachments):**
```typescript
// route.ts:290-296
function guessAgent(title: string, branch?: string): string {
  const source = (branch ?? title).toLowerCase()
  if (source.includes('cursor')) return 'cursor'
  if (source.includes('engine')) return 'engine'
  if (source.includes('cyrus')) return 'cyrus'
  return 'unknown'  // ⚠️ 'claude' not in guessAgent!
}
```

**Gap:** `@claude` is in AGENT_HANDLES but NOT in guessAgent()

**Recommended Fix:**
```typescript
function guessAgent(title: string, branch?: string): string {
  const source = (branch ?? title).toLowerCase()
  if (source.includes('cursor')) return 'cursor'
  if (source.includes('engine')) return 'engine'
  if (source.includes('cyrus')) return 'cyrus'
  if (source.includes('claude')) return 'claude'  // ← ADD THIS
  return 'unknown'
}
```

Also in `linear-sync.ts:155-162` - same issue.

**Risk Level:** 🟢 LOW
- Only affects @claude mentions
- Easy to fix

---

## Question 4: State Machine Completeness

### Audit Results: ⚠️ MISSING TRANSITIONS

#### Issue State Machine

**Defined States:**
```typescript
open → in_progress → completed
  ↓         ↓
cancelled  cancelled
```

**Implemented Transitions:**

| Transition | Trigger | Code Location | Status |
|-----------|---------|---------------|--------|
| (none) → open | `ar` label added | route.ts:167 | ✅ |
| open → in_progress | First PR created | ❌ NOT IMPLEMENTED | 🔴 |
| in_progress → completed | PR merged | ❌ NOT IMPLEMENTED | 🔴 |
| open/in_progress → cancelled | Label removed | ❌ NOT IMPLEMENTED | 🔴 |

**Critical Finding:** Issue status is synced from Linear (`issue.state?.name`) but **never updated by Arena logic**.

**Current Code:**
```typescript
// route.ts:176-183 - Always uses Linear's status
status: issue.state?.name,  // ← Passive, doesn't control state
```

**Expected Behavior:**
- When first PR created → Update issue status to `in_progress`
- When PR merged → Update issue status to `completed`
- When `ar` label removed → Update issue status to `cancelled`

**Actual Behavior:**
- Issue status = whatever Linear says
- Arena doesn't drive state transitions
- State machine is purely documentation

**Risk Level:** 🔴 HIGH
- State machine doesn't actually control flow
- Dashboard may show incorrect states
- Can't detect "stalled" issues

#### Agent State Machine

**Defined States:**
```typescript
pending → submitted → accepted/rejected
  ↓
ignored
```

**Implemented Transitions:**

| Transition | Trigger | Code Location | Status |
|-----------|---------|---------------|--------|
| (none) → pending | Agent @mentioned | linear-sync.ts:71 | ✅ |
| pending → submitted | PR created | route.ts:273 | ✅ |
| submitted → accepted | PR merged (winner) | queries.ts:620-626 | ✅ |
| submitted → rejected | Another agent won | updateWinner:324-328 | ✅ |
| pending → ignored | Issue closed, no PR | agent-status.ts:56 | ⚠️ NEVER CALLED |

**Critical Finding:** `markIgnoredOnIssueClosed()` exists but is **never called**.

**Code Evidence:**
```bash
$ grep -r "markIgnoredOnIssueClosed" src/
src/lib/agent-status.ts:export async function markIgnoredOnIssueClosed
# ← No callers!
```

**Risk Level:** 🟡 MEDIUM
- Pending agents never transition to ignored
- They stay `pending` forever
- Analytics will be skewed

**Recommended Fix:**
```typescript
// Add to handleIssueEvent() when label removed
if (!hasArenaLabel && existingIssue) {
  await markIgnoredOnIssueClosed(existingIssue.id)
  await db.update(issues)
    .set({ status: 'cancelled' })
    .where(eq(issues.id, existingIssue.id))
}
```

---

## Question 5: Stall Conditions

### Identified Stall Scenarios

#### Stall 1: Webhook Missed (Server Down)
**Condition:** Server down when `ar` label added
**State:** Issue never enters database
**Recovery:** ❌ No automatic recovery
**Workaround:** Re-save issue in Linear

#### Stall 2: No Agents Dispatch
**Condition:** `ar` label added but no agents @mentioned
**State:** Issue = `open`, no agents = `pending`
**Recovery:** ❌ No timeout or alerting
**Workaround:** Manually @mention agents

#### Stall 3: Agent Ignores Mention
**Condition:** Agent @mentioned but never responds
**State:** Agent = `pending` forever
**Recovery:** ❌ No timeout
**Workaround:** None (analytics will show as pending)

#### Stall 4: PR Created But Never Merged/Closed
**Condition:** Agent creates PR, then abandons it
**State:** Agent = `submitted`, Issue = `in_progress`
**Recovery:** ❌ No timeout
**Workaround:** Manually close PR in GitHub

#### Stall 5: Label Removed But Agents Keep Working
**Condition:** `ar` label removed while agents are working
**State:** Agents stay `pending` or `submitted`
**Recovery:** ❌ `markIgnoredOnIssueClosed()` never called
**Workaround:** None

---

## Question 6: Test Coverage

### Current Test Status: ✅ GOOD

**Overall Results:**
```
Test Files: 22 passed (22)
Tests: 322 passed (322)
Duration: 4.36s
```

**Coverage by Module:**

| Module | Coverage | Status |
|--------|----------|--------|
| Linear webhook route | ~85% | ✅ Good |
| State machine types | 100% | ✅ Excellent |
| Linear sync | ~70% | ⚠️ Could improve |
| Agent status | ~80% | ✅ Good |
| Queries | ~90% | ✅ Excellent |

**Missing Test Scenarios:**

1. **Webhook recovery** - No tests for server restart
2. **Label removal** - No tests for `ar` label removed
3. **Stale agents** - No tests for agents that never respond
4. **Multiple PRs merged** - Edge case tested indirectly
5. **Agent dispatch** - Can't test (not implemented)

---

## Critical Gaps Summary

### 🔴 HIGH PRIORITY (Blockers)

1. **No Automatic Agent Dispatch**
   - System doesn't post Linear comments to @mention agents
   - Must manually dispatch agents
   - **Impact:** Can't test automated competitions

2. **No Webhook Recovery**
   - Missed webhooks are lost forever
   - No startup sync or cron reconciliation
   - **Impact:** Silent failures, data loss

3. **Issue State Not Managed**
   - State machine defined but not enforced
   - Issue status = Linear status (passive)
   - **Impact:** Can't detect stalled issues

4. **`markIgnoredOnIssueClosed()` Never Called**
   - Function exists but has no callers
   - Pending agents stay pending forever
   - **Impact:** Incorrect analytics

### 🟡 MEDIUM PRIORITY (Quality Issues)

5. **No Timeout for Pending Agents**
   - Agents can stay `pending` indefinitely
   - No alerts or auto-cleanup
   - **Impact:** Stale data, unclear metrics

6. **`@claude` Missing from guessAgent()**
   - Inconsistency between AGENT_HANDLES and guessAgent()
   - **Impact:** Claude PRs marked as 'unknown'

### 🟢 LOW PRIORITY (Nice to Have)

7. **No Monitoring/Alerting**
   - No visibility into missed webhooks
   - No alerts for stalled issues
   - **Impact:** Manual monitoring required

8. **No Dashboard for Pending Issues**
   - Can't see which issues are waiting for agents
   - Can't identify stuck workflows
   - **Impact:** Poor operational visibility

---

## Workflow Walkthrough: Adding `arena:ready` Label

### Expected Workflow (Design)
1. Human adds `arena:ready` label to Linear issue
2. Linear webhook fires → Arena receives it
3. Arena stores issue in database
4. Arena syncs existing comments/PRs from Linear API
5. **Arena posts dispatch comments for each agent** ← NOT IMPLEMENTED
6. Agents receive @mentions in Linear
7. Agents create PRs
8. System tracks PRs via attachment webhooks
9. First merged PR wins

### Actual Workflow (Current)
1. Human adds `arena:ready` label ✅
2. Linear webhook fires ✅
3. Arena stores issue ✅
4. Arena syncs existing comments/PRs ✅
5. **Nothing happens** ❌
6. Human must manually @mention each agent ⚠️
7. Agents create PRs ✅
8. System tracks PRs ✅
9. First merged PR wins ✅

**Conclusion:** System works but requires manual agent dispatch.

---

## Recommendations: Pre-Launch Checklist

### Must Fix Before Production

- [ ] **Implement automatic agent dispatch**
  - Post Linear comments with @mentions
  - Include branch template and PR body template
  - Record dispatch in `issue_agents` table

- [ ] **Add webhook recovery**
  - Startup sync for open arena issues
  - Daily cron job for reconciliation
  - Log missed webhook count

- [ ] **Fix state transitions**
  - Update issue status when PRs created/merged
  - Call `markIgnoredOnIssueClosed()` when label removed
  - Enforce state machine transitions

- [ ] **Add `@claude` to guessAgent()**
  - Update `route.ts:290-296`
  - Update `linear-sync.ts:155-162`

### Should Fix Soon

- [ ] **Add timeout for pending agents**
  - Auto-mark as ignored after 7 days
  - Send alert to engineering channel

- [ ] **Add monitoring**
  - Track webhook success/failure rate
  - Alert on missed webhooks
  - Dashboard for stalled issues

- [ ] **Add tests**
  - Label removal scenario
  - Webhook recovery
  - Agent timeout

### Nice to Have

- [ ] **Operational dashboard**
  - Show pending issues
  - Show agents waiting to respond
  - Show stalled PRs

- [ ] **Retry mechanism**
  - Retry failed Linear API calls
  - Retry failed agent dispatches

---

## Testing Plan: First Arena Issue

### Setup
1. Fix critical gaps above (or accept manual workarounds)
2. Configure webhook secrets in Vercel
3. Verify Linear webhook is active

### Test Scenario
**Issue:** Create test issue "Test Arena Flow"

**Step 1: Label Issue**
```
Action: Add arena:ready label in Linear
Expected:
  ✅ Webhook received
  ✅ Issue stored in database
  ✅ Comments/PRs synced from Linear
  ⚠️ No dispatch comments (must do manually)
```

**Step 2: Dispatch Agents (Manual)**
```
Action: Post 3 comments in Linear:
  - @cursor can you create a PR?
  - @engine can you create a PR?
  - @cyrus can you create a PR?
Expected:
  ✅ Comment webhooks received
  ✅ Sync triggered for each comment
  ✅ 3 rows in issue_agents (status=pending)
```

**Step 3: Agents Create PRs**
```
Action: Wait for agents to respond
Expected:
  ✅ PR attachments appear in Linear
  ✅ Attachment webhooks received
  ✅ Attempts created (status=open)
  ✅ Agent status → submitted
```

**Step 4: Review PRs**
```
Action: Review PRs, request changes
Expected:
  ❌ No tracking (GitHub webhooks not implemented)
  ⚠️ commitCount stays at 1
```

**Step 5: Merge Winner**
```
Action: Merge one PR
Expected:
  ✅ Attachment webhook (merged)
  ✅ Winner selected
  ✅ Other PRs marked closed
  ✅ Winner agent → accepted
  ✅ Other agents → rejected
```

### Validation Queries

**Check issue created:**
```sql
SELECT * FROM issues WHERE linear_key = 'TEST-123';
```

**Check agents dispatched:**
```sql
SELECT * FROM issue_agents WHERE issue_id = '<uuid>';
```

**Check attempts tracked:**
```sql
SELECT * FROM attempts WHERE issue_id = '<uuid>';
```

**Check winner:**
```sql
SELECT i.linear_key, i.winner_attempt_id, a.agent_name, a.pr_url
FROM issues i
JOIN attempts a ON a.id = i.winner_attempt_id
WHERE i.linear_key = 'TEST-123';
```

---

## Environment Variables Checklist

```bash
# Required (existing)
LINEAR_WEBHOOK_SECRET=<configured in Vercel>
LINEAR_API_KEY=<configured in Vercel>
DATABASE_URL=<configured in Vercel>
ARENA_LABEL=arena:ready

# Required (for agent dispatch - if implemented)
LINEAR_WORKSPACE=<e.g., recall-labs>

# Optional (for monitoring)
WEBHOOK_FAILURE_ALERT_URL=<Slack webhook>
```

---

## Summary: Can You Test Now?

### ✅ What Works
- Webhook signature verification
- Idempotency (no duplicate processing)
- Issue storage when label added
- Sync of existing comments/PRs from Linear API
- Agent mention tracking from comments
- PR attachment tracking
- Winner selection
- Agent status transitions (mostly)

### ❌ What's Missing
- **Automatic agent dispatch** (must manually @mention)
- **Webhook recovery** (server downtime = data loss)
- **State machine enforcement** (passive, not active)
- **Ignored agent transitions** (function exists but never called)
- **Timeout handling** (agents can stall forever)

### 🎯 Can You Test?

**Answer: YES, with manual workarounds**

**Process:**
1. Add `arena:ready` label to Linear issue
2. Manually @mention agents in comments
3. Wait for agents to create PRs
4. Agents create PRs (tracked automatically)
5. Merge winner (tracked automatically)

**Limitations:**
- Must manually dispatch agents
- If server is down when you add label, webhook is lost
- No automatic recovery
- Pending agents never time out

**Recommendation:**
- Fix agent dispatch first (biggest impact)
- Add webhook recovery second (data integrity)
- Test with one issue to validate workflow
- Don't rely on it for production competitions yet

---

**Status:** Ready for testing with manual agent dispatch
**Next Steps:** Implement agent dispatch → Test → Fix state transitions → Add recovery
