# ENG-320 Investigation: Quick Reference

## Files Created

1. **Executive Summary** (305 lines)
   - `/Users/andrewhill/Coding/coding-arena/docs/eng320-executive-summary.md`
   - High-level findings, metrics, and recommendations

2. **Detailed Analysis** (595 lines)
   - `/Users/andrewhill/Coding/coding-arena/docs/eng320-workflow-analysis.md`
   - Complete timeline, raw data, webhook documentation

3. **Implementation Plan** (586 lines)
   - `/Users/andrewhill/Coding/coding-arena/docs/comment-webhook-implementation-plan.md`
   - Step-by-step guide to implement Comment webhook handler

4. **Structured Data** (JSON)
   - `/Users/andrewhill/Coding/coding-arena/docs/eng320-data.json`
   - Machine-readable timeline and metrics

## Key Findings (30-Second Version)

**Problem:** Comment events not handled, so agent mentions aren't tracked

**Impact:**
- Cannot measure response time (Cursor: 9min, Engine: 31min, Cyrus: no response)
- Cannot track which agents respond vs ignore (2 of 3 responded = 67% rate)
- Cannot link PRs to original request comments

**Solution:** Add Comment webhook handler to parse `@cursor`, `@engine`, `@cyrus` mentions

**Effort:** ~1.5 hours implementation

## Linear Webhook Event Types

```
✅ Issue          (create, update, remove)  - HANDLED
✅ Attachment     (create, update, remove)  - HANDLED
❌ Comment        (create, update, remove)  - NOT HANDLED ← FIX THIS
⚠️  IssueLabel    (create, update, remove)  - Partial (via Issue events)
```

## ENG-320 Timeline (Condensed)

```
00:06:59  Andrew tags @cyrus         → No response
00:07:15  Andrew tags @cursor        → Responded in 9 min
00:07:28  Andrew tags @engine        → Responded in 31 min
00:07:29  Cursor auto-starts issue   → State: In Progress
00:08:04  Andrew tags @cyrus again   → Still no response
00:16:55  Cursor submits PR          → All tests pass
00:38:57  Engine submits PR          → GitHub PR #1559
```

## Comment Event Payload

```json
{
  "type": "Comment",
  "action": "create",
  "data": {
    "id": "comment-123",
    "body": "@cursor can you create a PR?",
    "issueId": "e7376814-a82e-48a4-bea7-55a263f88a09",
    "userId": "user-123",
    "createdAt": "2025-11-12T00:07:15.089Z"
  }
}
```

## Implementation Checklist

- [ ] Add `LinearComment` type to route.ts
- [ ] Implement `handleCommentEvent()` function
- [ ] Add `else if (payload.type === 'Comment')` routing
- [ ] Write 5+ test cases in route.test.ts
- [ ] Run `pnpm test` and verify 90%+ coverage
- [ ] Deploy to staging
- [ ] Test with real Linear webhook
- [ ] Monitor for 24 hours
- [ ] Deploy to production

## Agent Performance (ENG-320)

| Agent  | Mentions | Responded | Latency | PR Link |
|--------|----------|-----------|---------|---------|
| Cursor | 1        | Yes       | 9 min   | [Link](https://www.cursor.com/agents?id=bc-b830d46b-5d08-4e41-a00d-a863303b82f4) |
| Engine | 1        | Yes       | 31 min  | [PR #1559](https://github.com/recallnet/js-recall/pull/1559) |
| Cyrus  | 2        | No        | -       | - |

## Next Steps

1. Read executive summary for context
2. Follow implementation plan step-by-step
3. Investigate why ENG-320 has zero attachments (should be 2)
4. Build analytics dashboard for agent metrics

## Questions?

See detailed documents for:
- Complete timeline and raw data
- Webhook payload examples
- Test case specifications
- Analytics query examples
- Rollback procedures
