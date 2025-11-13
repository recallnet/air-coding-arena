# ENG-320 Investigation Index

This investigation thoroughly analyzed Linear issue ENG-320 to understand the real-world agent workflow and identify missing webhook handlers.

## Start Here

**New to this investigation?** Read in this order:

1. **Quick Reference** (`eng320-quick-reference.md`) - 3 minutes
   - 30-second summary of findings
   - Timeline visualization
   - Implementation checklist

2. **Executive Summary** (`eng320-executive-summary.md`) - 10 minutes
   - High-level findings and impact
   - Recommended actions with timeline
   - Success metrics and risk assessment

3. **Implementation Plan** (`comment-webhook-implementation-plan.md`) - 15 minutes
   - Step-by-step code changes
   - Complete test cases
   - Deployment and verification steps

4. **Detailed Analysis** (`eng320-workflow-analysis.md`) - 30 minutes
   - Complete raw data and timeline
   - Full webhook documentation
   - Analytics queries and examples

5. **Structured Data** (`eng320-data.json`) - Reference
   - Machine-readable timeline
   - Agent performance metrics
   - All IDs and timestamps

## Files Overview

| File | Size | Lines | Purpose |
|------|------|-------|---------|
| `eng320-quick-reference.md` | 3.3K | ~90 | Fast lookup and checklists |
| `eng320-executive-summary.md` | 8.6K | 305 | Business case and decisions |
| `comment-webhook-implementation-plan.md` | 14K | 586 | Developer implementation guide |
| `eng320-workflow-analysis.md` | 18K | 595 | Complete technical analysis |
| `eng320-data.json` | 7.8K | ~270 | Structured data export |

**Total:** 51.7K of documentation (1,486 lines)

## Key Findings Summary

### What's Working
- ✅ Issue events tracked (label-based workflow)
- ✅ Attachment events tracked (PR links)
- ✅ State transitions captured
- ✅ Idempotency via events table

### Critical Gap
- ❌ **Comment events NOT handled**
  - Agent mentions invisible to system
  - Cannot measure response latency
  - Cannot track ignored requests

### Real-World Data
- **3 agents tagged:** Cursor, Engine, Cyrus
- **2 agents responded:** Cursor (9 min), Engine (31 min)
- **1 agent ignored:** Cyrus (tagged twice, no response)
- **Response rate:** 67%

### Mystery
- **0 attachments found** despite 2 PRs referenced in comments
- Need to investigate Linear attachment behavior

## Implementation Priority

### HIGH: Comment Webhook Handler
**File:** `/Users/andrewhill/Coding/coding-arena/src/app/api/linear/webhook/route.ts`

**Changes Required:**
1. Add `LinearComment` type definition
2. Implement `handleCommentEvent()` function
3. Parse agent mentions from comment body
4. Record in `issue_agents` table with timestamp
5. Add 5+ test cases

**Estimated Time:** 1.5 hours
**Impact:** Enables all agent performance metrics

### MEDIUM: Attachment Investigation
**Goal:** Understand why ENG-320 has zero attachments

**Hypotheses:**
1. Agents comment with PR links but don't create attachments
2. Attachments added after our API query
3. External tracking (e.g., Cursor agent dashboard)

**Action:** Manual inspection of Linear UI for ENG-320

### LOW: Enhanced Analytics
**Prerequisites:** Comment handler must be deployed first

**New Capabilities:**
- Agent response rate dashboard
- Response latency metrics
- Ignored request alerts
- Multi-agent comparison leaderboard

## Linear Webhook Event Types

### Currently Handled
- `Issue` (create, update, remove) - Label tracking, state changes
- `Attachment` (create, update, remove) - PR links

### Missing Handler
- `Comment` (create, update, remove) - **Agent mentions**

### Not Needed
- `Project`, `Document`, `Reaction`, `IssueSla` - Out of scope

## ENG-320 Raw Data

**Issue:** https://linear.app/recall-labs/issue/ENG-320
**Linear ID:** `e7376814-a82e-48a4-bea7-55a263f88a09`
**Status:** In Progress
**Created:** 2025-09-03
**Arena Ready:** 2025-11-12 (added "ar" label)

**Agents:**
- Cursor: `8f02e788-7c5b-47ec-8a35-b907d7a05dbc`
- Engine: `039e79a0-9e12-4000-9359-72957e5b02e2`
- Cyrus: `69fb2b92-e5c6-4899-8cad-8f3aad74d7b3`

**Complete JSON:** See `eng320-data.json`

## Useful Queries (Post-Implementation)

**Agent Response Rate:**
```sql
SELECT agent_name, COUNT(*) as mentions,
       SUM(CASE WHEN pr_created THEN 1 ELSE 0 END) as responses,
       ROUND(100.0 * SUM(CASE WHEN pr_created THEN 1 ELSE 0 END) / COUNT(*), 2) as rate
FROM issue_agents
GROUP BY agent_name;
```

**Average Response Time:**
```sql
SELECT ia.agent_name,
       AVG(EXTRACT(EPOCH FROM (a.opened_at - ia.triggered_at))) / 60 as avg_minutes
FROM issue_agents ia
JOIN attempts a ON ia.issue_id = a.issue_id AND ia.agent_name = a.agent_name
GROUP BY ia.agent_name;
```

**Ignored Mentions:**
```sql
SELECT i.linear_key, i.title, ia.agent_name, ia.triggered_at
FROM issue_agents ia
JOIN issues i ON ia.issue_id = i.id
LEFT JOIN attempts a ON ia.issue_id = a.issue_id AND ia.agent_name = a.agent_name
WHERE a.id IS NULL
ORDER BY ia.triggered_at DESC;
```

## Related Files

**Scripts:**
- `/Users/andrewhill/Coding/coding-arena/scripts/fetch-eng320-details.ts` (existing)
- `/Users/andrewhill/Coding/coding-arena/scripts/fetch-eng320-raw.ts` (created)
- `/Users/andrewhill/Coding/coding-arena/scripts/backfill-attachments.ts` (existing)

**Code to Modify:**
- `/Users/andrewhill/Coding/coding-arena/src/app/api/linear/webhook/route.ts`
- `/Users/andrewhill/Coding/coding-arena/src/app/api/linear/webhook/route.test.ts`

**Database Schema:**
- `/Users/andrewhill/Coding/coding-arena/src/db/schema.ts` (no changes needed)

## Next Actions

1. **Review** executive summary with team
2. **Implement** Comment webhook handler
3. **Test** with staging webhook
4. **Investigate** missing attachments
5. **Build** analytics dashboard
6. **Monitor** agent performance metrics

## Questions?

- **Technical implementation:** See `comment-webhook-implementation-plan.md`
- **Raw data and timeline:** See `eng320-workflow-analysis.md`
- **Business case:** See `eng320-executive-summary.md`
- **Quick lookup:** See `eng320-quick-reference.md`

---

**Investigation Date:** 2025-11-11
**Total Investigation Time:** ~2 hours
**Documentation Generated:** 51.7K (1,486 lines)
