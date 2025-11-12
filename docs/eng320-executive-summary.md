# ENG-320 Investigation: Executive Summary

**Date:** 2025-11-11
**Issue:** ENG-320 - Drop uuid package usage for native crypto
**Investigation Goal:** Understand real-world agent workflow and identify missing event handlers

---

## Key Findings

### 1. Agent Activity Timeline

**ENG-320** demonstrates a typical manual agent workflow:

```
2025-11-12T00:06:59Z  Andrew tags @cyrus        → No response
2025-11-12T00:07:15Z  Andrew tags @cursor       → Responded with PR (9 min)
2025-11-12T00:07:28Z  Andrew tags @engine       → Responded with PR (31 min)
2025-11-12T00:08:04Z  Andrew tags @cyrus again  → Still no response
```

**Agents Tagged:** 3 (Cursor, Engine, Cyrus)
**Agents Responded:** 2 (Cursor, Engine)
**Response Rate:** 66%

---

### 2. Critical Missing Handler: Comments

**Current State:**
- ✅ Issue events handled (label tracking)
- ✅ Attachment events handled (PR tracking)
- ❌ **Comment events NOT handled** (agent mentions missed)

**Impact:**
- Cannot measure agent response time (mention → PR)
- Cannot track which agents respond vs ignore
- Cannot identify manual vs automatic dispatch
- Cannot link PRs to original request comments

**Example Comment Event:**
```json
{
  "type": "Comment",
  "action": "create",
  "data": {
    "id": "07e5bc26-0c0b-4d81-8e6d-da65ff5646f1",
    "body": "@cursor can you create a PR to fix this?",
    "issueId": "e7376814-a82e-48a4-bea7-55a263f88a09",
    "createdAt": "2025-11-12T00:07:15.089Z"
  }
}
```

---

### 3. Mysterious Missing Attachments

**Expected:** 2 PR attachments (from Cursor and Engine comments)
**Actual:** 0 attachments in API response

```json
"attachments": {
  "nodes": []
}
```

**Possible Explanations:**
1. Agents linked PRs in comments but didn't attach to Linear issue
2. Attachments were added after our API query
3. Agents use external tracking (e.g., Cursor's agent dashboard)

**Action Required:** Investigate whether agents are expected to create Linear attachments or just comment with PR links.

---

### 4. Complete Event Type Inventory

Based on Linear webhook documentation:

| Event Type | Actions | Current Handler | Priority |
|-----------|---------|-----------------|----------|
| Issue | create, update, remove | ✅ Handled | - |
| Attachment | create, update, remove | ✅ Handled | - |
| **Comment** | **create, update, remove** | **❌ Missing** | **HIGH** |
| IssueLabel | create, update, remove | ⚠️ Partial (via Issue) | LOW |
| Project | create, update, remove | ❌ Not needed | - |
| Document | create, update, remove | ❌ Not needed | - |
| Reaction | create, update, remove | ❌ Not needed | - |
| IssueSla | set, highRisk, breached | ❌ Not needed | - |

---

## Recommended Actions

### Immediate (Week 1)
1. ✅ **Complete investigation** (this document)
2. ⬜ **Implement Comment webhook handler**
   - Parse agent mentions from comment body
   - Record in `issue_agents` table with timestamp
   - Track which agents were requested to act

3. ⬜ **Add test coverage**
   - Single agent mention
   - Multiple agents in one comment
   - Case-insensitive matching
   - Unknown issue handling

### Short-term (Week 2-3)
4. ⬜ **Investigate missing attachments**
   - Check Linear UI for ENG-320 attachments
   - Query with longer history window
   - Verify webhook subscription includes Attachments

5. ⬜ **Build analytics dashboard**
   - Agent response rate (% of mentions that result in PRs)
   - Average response time (mention → PR)
   - Leaderboard: fastest responding agents

### Long-term (Month 2+)
6. ⬜ **Enhanced tracking**
   - Link comments to PRs via timing correlation
   - Track comment threads (parent/child relationships)
   - Detect when agents acknowledge vs ignore mentions

---

## Data We Can Now Track (After Comment Handler)

### Agent Performance Metrics

**Response Rate:**
```sql
SELECT
  agent_name,
  COUNT(*) as mentions,
  SUM(CASE WHEN pr_created THEN 1 ELSE 0 END) as responses,
  ROUND(100.0 * SUM(CASE WHEN pr_created THEN 1 ELSE 0 END) / COUNT(*), 2) as rate
FROM issue_agents
GROUP BY agent_name;
```

**Response Latency:**
```sql
SELECT
  ia.agent_name,
  AVG(EXTRACT(EPOCH FROM (a.opened_at - ia.triggered_at))) / 60 as avg_minutes
FROM issue_agents ia
JOIN attempts a ON ia.issue_id = a.issue_id AND ia.agent_name = a.agent_name
GROUP BY ia.agent_name;
```

**Ignored Requests:**
```sql
SELECT
  i.linear_key,
  i.title,
  ia.agent_name,
  ia.triggered_at
FROM issue_agents ia
JOIN issues i ON ia.issue_id = i.id
LEFT JOIN attempts a ON ia.issue_id = a.issue_id AND ia.agent_name = a.agent_name
WHERE a.id IS NULL
ORDER BY ia.triggered_at DESC;
```

---

## Technical Details

### Linear Webhook Payload Structure

All webhooks include:
```typescript
{
  type: string                    // "Issue", "Attachment", "Comment"
  action: string                  // "create", "update", "remove"
  data: Record<string, unknown>   // The entity data
  actor: {
    id: string
    type: 'user' | 'oauthClient' | 'integration'
    name: string
    email: string
  }
  url: string                     // Direct link to resource
  createdAt: string               // ISO timestamp
  webhookTimestamp: number        // UNIX milliseconds
  webhookId: string               // Unique webhook ID
}
```

### Comment Event Specific Fields

```typescript
type LinearComment = {
  id: string
  body: string                    // Comment text (contains @mentions)
  issueId: string                 // Parent issue
  userId: string                  // Comment author
  createdAt: string
  updatedAt: string
  edited: boolean
  parent?: { id: string } | null  // Thread parent (if reply)
}
```

---

## Files Modified

**Analysis Documents Created:**
- `/Users/andrewhill/Coding/coding-arena/docs/eng320-workflow-analysis.md` (detailed)
- `/Users/andrewhill/Coding/coding-arena/docs/comment-webhook-implementation-plan.md` (implementation)
- `/Users/andrewhill/Coding/coding-arena/docs/eng320-executive-summary.md` (this file)

**Scripts Used:**
- `/Users/andrewhill/Coding/coding-arena/scripts/fetch-eng320-details.ts` (existing)
- `/Users/andrewhill/Coding/coding-arena/scripts/fetch-eng320-raw.ts` (created)

**Files to Modify:**
- `/Users/andrewhill/Coding/coding-arena/src/app/api/linear/webhook/route.ts` (add Comment handler)
- `/Users/andrewhill/Coding/coding-arena/src/app/api/linear/webhook/route.test.ts` (add tests)

---

## Success Metrics

Once Comment handler is deployed:

| Metric | Current | Target |
|--------|---------|--------|
| Events Tracked | 2 (Issue, Attachment) | 3 (+ Comment) |
| Agent Response Visibility | 0% | 100% |
| Response Time Measurement | ❌ No | ✅ Yes |
| Ignored Request Detection | ❌ No | ✅ Yes |
| Comment-to-PR Linking | ❌ No | ⚠️ Partial (timing-based) |

---

## Risk Assessment

**Low Risk:**
- Comment handler is additive (doesn't modify existing handlers)
- Uses existing `issue_agents` table (no schema changes required)
- Idempotency preserved via events table
- Can be disabled by commenting out route

**Monitoring:**
- Watch webhook processing latency
- Monitor database insert performance
- Check for duplicate agent mention records
- Verify no missing events due to parsing errors

---

## Questions for Product Team

1. **Attachment Strategy:** Should agents create Linear attachments, or is commenting with PR links sufficient?

2. **Response Expectations:** What's the expected response time for agent mentions? (Currently: Cursor 9min, Engine 31min)

3. **Non-responders:** How should we handle agents that ignore mentions? (e.g., Cyrus was tagged twice, never responded)

4. **Analytics Priority:** Which metrics are most valuable for leaderboard?
   - Response rate (% mentions → PRs)
   - Response speed (mention → PR latency)
   - Success rate (% PRs merged)
   - Quality metrics (test pass rate, review comments)

---

## Next Steps

**Developer Action Items:**
1. Review this summary with team
2. Implement Comment webhook handler (see implementation plan)
3. Deploy to staging and test with real Linear webhooks
4. Build analytics queries for agent performance
5. Investigate missing attachments on ENG-320

**Product Questions:**
- Confirm Comment tracking is required
- Define agent response SLAs
- Prioritize analytics dashboard features

---

## Appendix: ENG-320 Raw Data

**Issue ID:** `e7376814-a82e-48a4-bea7-55a263f88a09`
**Issue Key:** `ENG-320`
**Title:** Drop uuid package usage for native crypto and UUID's
**Status:** In Progress
**Labels:** ar (arena-ready)
**Created:** 2025-09-03
**Started:** 2025-11-12 (by Cursor agent)
**Comments:** 8 total (3 user, 5 agent)
**Attachments:** 0 (unexpected - should be 2 PRs)
**Subscribers:** 5 (Andrew, Dan, Cursor, Engine, Cyrus)

**Complete Data:** See `/tmp/eng320-raw.json` or detailed analysis document.

---

**End of Executive Summary**
