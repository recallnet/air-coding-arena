# Fix Agent Progress Denominator Bug - Nov 16, 2025

**Status:** 🔴 IN PROGRESS
**Priority:** High - User-visible display bug
**Created:** 2025-11-16

---

## Problem Statement

The "Active Issues" table on the home page displays incorrect agent progress denominators, leading to confusing status reports like:
- Issue #320: Shows "1/1 in review" when it should be "1/5 in review" (4 pending agents not counted)
- Issue #954: Shows "1/2 complete" when it should show "1/3 complete" (missing context about 3 total agents)

**Root Cause:** The `getAgentProgress` function in `/src/components/IssueActivityTable.tsx:292-318` excludes `pending` agents from the denominator. This was recently corrected in `/docs/plans/2025-11-16-fix-status-overwrite-bug.md` where it was established that ignored agents should be included in the denominator.

---

## Current Behavior (INCORRECT)

```typescript
// Line 299 in IssueActivityTable.tsx
const countableAgents = agents.filter((a) => a.status !== 'pending')
const total = countableAgents.length  // ❌ Excludes pending agents
```

**Example:** Issue with 5 agents: [submitted, pending, pending, pending, pending]
- Current display: "1/1 in review" (only counts submitted agent)
- Expected display: "1/5 in review" (all 5 agents should count)

---

## Expected Behavior (CORRECT)

The denominator should include ALL agents assigned to an issue, regardless of status:
- `pending`: Agent assigned but not yet dispatched
- `submitted`: Agent has open PR
- `accepted`: Agent won (PR merged)
- `rejected`: Agent lost (PR closed without merge)
- `ignored`: Agent assigned but never submitted PR

**Rationale:** From `/docs/plans/2025-11-16-fix-status-overwrite-bug.md`:
> "Only exclude pending agents from denominator" ❌ This was WRONG
> "Include ignored agents (assigned but didn't submit) in denominator" ✅ This is RIGHT

The denominator represents the total competition pool, not just agents who have already acted.

---

## Correct Logic

```typescript
// All agents count in denominator (no filter needed)
const total = agents.length

// Count different status types for numerator
const completed = agents.filter(
  (a) => a.status === 'accepted' || a.status === 'rejected'
).length
const submitted = agents.filter((a) => a.status === 'submitted').length
const pending = agents.filter((a) => a.status === 'pending').length
const ignored = agents.filter((a) => a.status === 'ignored').length

// Display logic
if (completed > 0) {
  return `${completed}/${total} complete`
} else if (submitted > 0) {
  return `${submitted}/${total} in review`
} else if (pending > 0 || ignored > 0) {
  return `${total} in progress`  // or "0/${total} in review"
}
```

---

## Affected Components

**Primary:**
- `/src/components/IssueActivityTable.tsx` - `getAgentProgress()` function (lines 292-318)

**Potentially Related:**
- May affect other progress display components (needs investigation)

---

## Test Cases Needed

1. **Issue with all pending agents**: 5 pending → Should show "5 in progress" or "0/5 in review"
2. **Issue with mixed statuses**: 1 submitted, 4 pending → Should show "1/5 in review"
3. **Issue with completion**: 1 accepted, 2 rejected, 2 pending → Should show "3/5 complete"
4. **Issue with ignored agents**: 1 accepted, 1 ignored, 3 pending → Should show "1/5 complete"
5. **Issue with no agents**: Empty array → Should show null
6. **Issue with winner selected**: 1 accepted, 4 rejected → Should show "5/5 complete"

---

## Related Documentation

- `/docs/plans/2025-11-16-fix-status-overwrite-bug.md` - Recent fix that clarified denominator logic
- `/docs/arena-state-machine.md` - Agent status definitions
- `/docs/TYPE_ARCHITECTURE.md` - Type hierarchy for agent statuses

---

## Action Items

- [ ] Deploy investigation agent to verify current behavior with real data
- [ ] Fix `getAgentProgress()` function to include all agents in denominator
- [ ] Add comprehensive test coverage for all edge cases
- [ ] Verify fix resolves user-reported issues (#320, #954)
- [ ] Check for similar bugs in other progress display components

---

**User Reports:**
- Issue #320: "the denominator is broken again (still?) #320 says 1/1 in review, but 4 others are pending, so 1/5 is in review"
- Issue #954: "954 says 1/2 complete, it was actually 2/3 submitted, 1 chosen and won"

**End of Report**
