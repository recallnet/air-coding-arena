# Fix Issue Agent Status Overwrite Bug Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix bug where reconciliation unconditionally overwrites issue_agents.status from 'accepted'/'rejected' back to 'submitted', causing leaderboard to show 0 wins.

**Architecture:** Add conditional check in linear-sync.ts to only update status to 'submitted' when current status is 'pending'. This preserves final statuses set by updateWinner() while still tracking initial PR submissions.

**Tech Stack:** TypeScript, Drizzle ORM, Vitest, PostgreSQL

---

## Background

**Root Cause:** `src/lib/linear-sync.ts:408-418` unconditionally sets `status = 'submitted'` when processing PR URLs during reconciliation, overwriting 'accepted'/'rejected' statuses.

**Timeline of Bug:**
1. PR merges → updateWinner() sets issue_agents.status = 'accepted' ✓
2. Reconciliation runs → syncIssueFromLinear() processes comments
3. Finds PR URL in comment → unconditionally sets status = 'submitted' ✗
4. Result: Leaderboard shows 0 wins because no 'accepted' records exist

**Status State Machine:**
- `pending` → `submitted` (when PR opens) ✓ SHOULD UPDATE
- `submitted` → `accepted` (when PR merges as winner) ✓ SHOULD PRESERVE
- `submitted` → `rejected` (when PR closes/different winner) ✓ SHOULD PRESERVE

---

## Task 1: Research All Status Update Locations

**Files:**
- Read: `src/lib/linear-sync.ts`
- Read: `src/lib/update-winner.ts`

**Step 1: Find all code that updates issue_agents.status**

```bash
grep -rn "\.set.*status" src/lib/linear-sync.ts src/lib/update-winner.ts
```

Expected: List of all status update locations

**Step 2: Verify no other reconciliation overwrites**

Review the grep results and confirm linear-sync.ts:408-418 is the ONLY location that could overwrite after updateWinner().

**Step 3: Check webhook event ordering**

Verify that webhooks don't have similar issues. Quick scan of:
- `src/app/api/github/webhook/route.ts`
- `src/lib/linear-webhooks.ts`

Expected: Confirm these don't overwrite statuses incorrectly

---

## Task 2: Write Failing Test for Status Preservation

**Files:**
- Read: `src/lib/linear-sync.test.ts`
- Modify: `src/lib/linear-sync.test.ts`

**Step 1: Understand existing test structure**

Read the test file to understand mocking patterns and test structure.

**Step 2: Add test case for preserving accepted status**

Add this test in the appropriate describe block (likely near other syncIssueFromLinear tests):

```typescript
it('should not overwrite accepted status when processing PR URLs during sync', async () => {
  // Mock Linear client to return issue with PR URL in comment
  const mockLinearIssue = {
    id: 'linear-issue-123',
    identifier: 'ENG-999',
    title: 'Test Issue',
    url: 'https://linear.app/test/issue/ENG-999',
    state: Promise.resolve({ name: 'Done' }),
    team: Promise.resolve({ key: 'ENG' }),
    labels: Promise.resolve({ nodes: [{ name: 'arena:ready' }] }),
    comments: Promise.resolve({
      nodes: [
        {
          id: 'comment-1',
          body: '@engine https://github.com/owner/repo/pull/123',
          createdAt: '2024-01-01T00:00:00Z',
          user: Promise.resolve({ name: 'User', email: 'user@example.com' }),
        },
      ],
    }),
    attachments: Promise.resolve({ nodes: [] }),
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  }

  vi.mocked(mockLinearClient.issue).mockResolvedValue(mockLinearIssue as never)

  // Mock database: issue exists with engine already marked as 'accepted'
  const mockIssueSelect = vi.fn().mockResolvedValue([
    { id: 'db-issue-id', linearId: 'linear-issue-123' },
  ])
  const mockIssueFrom = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([{ id: 'db-issue-id' }]),
    }),
  })

  // Mock issueAgents query showing agent is already 'accepted'
  const mockAgentQuery = vi.fn().mockResolvedValue({
    id: 'agent-id',
    issueId: 'db-issue-id',
    agentName: 'engine',
    status: 'accepted', // ← Already accepted!
  })

  vi.mocked(db.query.issueAgents.findFirst).mockImplementation(mockAgentQuery)
  vi.mocked(db.select).mockReturnValue({
    from: mockIssueFrom,
  } as never)

  // Call syncIssueFromLinear
  await syncIssueFromLinear('linear-issue-123')

  // Verify that update was NOT called for issue_agents
  // (or if called, verify it didn't change status from 'accepted')
  const updateCalls = vi.mocked(db.update).mock.calls
  const issueAgentUpdates = updateCalls.filter(
    (call) => call[0] === issueAgents
  )

  // If there were updates, verify none changed the status
  for (const updateCall of issueAgentUpdates) {
    const setCall = vi.mocked(updateCall[1]?.set)
    if (setCall) {
      expect(setCall).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: 'submitted' })
      )
    }
  }
})
```

**Step 3: Add test case for correctly updating pending to submitted**

```typescript
it('should update pending status to submitted when processing PR URLs', async () => {
  // Similar structure to above test, but with status: 'pending'
  const mockLinearIssue = {
    id: 'linear-issue-456',
    identifier: 'ENG-888',
    title: 'Test Issue',
    url: 'https://linear.app/test/issue/ENG-888',
    state: Promise.resolve({ name: 'In Progress' }),
    team: Promise.resolve({ key: 'ENG' }),
    labels: Promise.resolve({ nodes: [{ name: 'arena:ready' }] }),
    comments: Promise.resolve({
      nodes: [
        {
          id: 'comment-1',
          body: '@cursor https://github.com/owner/repo/pull/456',
          createdAt: '2024-01-01T00:00:00Z',
          user: Promise.resolve({ name: 'User', email: 'user@example.com' }),
        },
      ],
    }),
    attachments: Promise.resolve({ nodes: [] }),
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  }

  vi.mocked(mockLinearClient.issue).mockResolvedValue(mockLinearIssue as never)

  // Mock database: agent is currently 'pending'
  const mockAgentQuery = vi.fn().mockResolvedValue({
    id: 'agent-id',
    issueId: 'db-issue-id',
    agentName: 'cursor',
    status: 'pending', // ← Currently pending
  })

  vi.mocked(db.query.issueAgents.findFirst).mockImplementation(mockAgentQuery)

  await syncIssueFromLinear('linear-issue-456')

  // Verify update WAS called to change status to 'submitted'
  expect(db.update).toHaveBeenCalledWith(issueAgents)
  // Additional assertions to verify the update happened correctly
})
```

**Step 4: Run tests to verify they fail**

```bash
npm test -- src/lib/linear-sync.test.ts --run
```

Expected output: First test FAILS (status gets overwritten when it shouldn't)

**Step 5: Commit failing tests**

```bash
git add src/lib/linear-sync.test.ts
git commit -m "test: add failing tests for status preservation during sync

Tests verify:
1. accepted/rejected statuses preserved during reconciliation
2. pending status correctly updated to submitted when PR found

Currently failing - status unconditionally overwritten"
```

---

## Task 3: Fix Status Update Logic

**Files:**
- Modify: `src/lib/linear-sync.ts:408-418`

**Step 1: Locate the problematic code**

Navigate to `src/lib/linear-sync.ts` lines 408-418.

**Step 2: Add conditional check**

Replace the unconditional update:

```typescript
// BEFORE (lines 408-418):
if (agentName !== 'unknown') {
  await db
    .update(issueAgents)
    .set({ status: 'submitted' })
    .where(
      and(
        eq(issueAgents.issueId, issueId),
        eq(issueAgents.agentName, agentName)
      )
    )
}
```

With conditional update that preserves final statuses:

```typescript
// AFTER:
if (agentName !== 'unknown') {
  // Only update to 'submitted' if currently 'pending'
  // Preserve 'accepted'/'rejected' statuses set by updateWinner()
  await db
    .update(issueAgents)
    .set({ status: 'submitted' })
    .where(
      and(
        eq(issueAgents.issueId, issueId),
        eq(issueAgents.agentName, agentName),
        eq(issueAgents.status, 'pending')
      )
    )
}
```

**Step 3: Run tests to verify fix**

```bash
npm test -- src/lib/linear-sync.test.ts --run
```

Expected output: New tests PASS

**Step 4: Run full test suite**

```bash
npm test
```

Expected output: All tests pass (760+ tests)

**Step 5: Commit fix**

```bash
git add src/lib/linear-sync.ts
git commit -m "fix(sync): preserve accepted/rejected status during reconciliation

Previously, reconciliation unconditionally set status='submitted' when
processing PR URLs in comments, overwriting 'accepted'/'rejected'
statuses set by updateWinner().

Now only updates pending → submitted, preserving final statuses.

Fixes leaderboard showing 0 wins for agents with merged PRs.

Root cause: linear-sync.ts:408-418"
```

---

## Task 4: Run Full Validation Suite

**Step 1: Type check**

```bash
npm run type-check
```

Expected output: No type errors, coverage >= 99.9%

**Step 2: Lint**

```bash
npm run lint
```

Expected output: No linting errors

**Step 3: Format check**

```bash
npm run format:check
```

Expected output: All files properly formatted

**Step 4: Full test suite one more time**

```bash
npm test
```

Expected output: All tests pass, coverage >= 90%

**Step 5: If any validation fails, fix and re-run**

Do NOT proceed until all validation passes.

---

## Task 5: Verify Production Database State (Pre-Fix)

**Files:**
- N/A (production database inspection)

**Step 1: Check current state of affected records**

```bash
psql "postgresql://neondb_owner:REDACTED_REVOKE_BEFORE_USE@ep-little-hill-ahqourzl.c-3.us-east-1.aws.neon.tech/neondb" -c "
SELECT
  i.linear_key,
  ia.agent_name,
  ia.status as agent_status,
  a.status as attempt_status,
  a.merged_at
FROM issue_agents ia
JOIN issues i ON ia.issue_id = i.id
LEFT JOIN attempts a ON ia.issue_id = a.issue_id AND ia.agent_name = a.agent_name
WHERE ia.status = 'submitted'
  AND a.status = 'merged'
  AND ia.agent_name IN ('engine', 'cursor', 'githubcopilot', 'factory')
ORDER BY i.linear_key, ia.agent_name;
"
```

Expected output: List of records with incorrect status (should show multiple)

**Step 2: Document count for verification**

Note how many records need correction.

---

## Task 6: Push Changes and Deploy

**Step 1: Review all changes**

```bash
git log --oneline -3
git diff main~3..main
```

Expected: See test and fix commits

**Step 2: Run pre-push hooks**

```bash
git push --dry-run origin main
```

Expected: All hooks pass

**Step 3: Push to main**

```bash
git push origin main
```

Expected output: Push succeeds, Vercel deployment triggers

**Step 4: Monitor Vercel deployment**

Wait for deployment to complete (usually 2-3 minutes).
Check Vercel dashboard for any errors.

---

## Task 7: Fix Production Data

**Files:**
- N/A (production database manual correction)

**Step 1: Manually correct affected records**

After deployment, the code is fixed but existing incorrect data remains.
Need to update all 'submitted' records where PR is actually merged:

```bash
psql "postgresql://neondb_owner:REDACTED_REVOKE_BEFORE_USE@ep-little-hill-ahqourzl.c-3.us-east-1.aws.neon.tech/neondb" -c "
UPDATE issue_agents ia
SET status = 'accepted'
FROM attempts a, issues i
WHERE ia.issue_id = a.issue_id
  AND ia.agent_name = a.agent_name
  AND ia.issue_id = i.id
  AND ia.status = 'submitted'
  AND a.status = 'merged'
  AND i.winner_attempt_id = a.id;
"
```

Expected output: UPDATE N (where N is the count from Task 5)

**Step 2: Set non-winners to rejected**

```bash
psql "postgresql://neondb_owner:REDACTED_REVOKE_BEFORE_USE@ep-little-hill-ahqourzl.c-3.us-east-1.aws.neon.tech/neondb" -c "
UPDATE issue_agents ia
SET status = 'rejected'
FROM attempts a, issues i
WHERE ia.issue_id = a.issue_id
  AND ia.agent_name = a.agent_name
  AND ia.issue_id = i.id
  AND ia.status = 'submitted'
  AND a.status IN ('closed', 'merged')
  AND i.winner_attempt_id IS NOT NULL
  AND i.winner_attempt_id != a.id;
"
```

Expected output: UPDATE M

**Step 3: Verify no incorrect records remain**

```bash
psql "postgresql://neondb_owner:REDACTED_REVOKE_BEFORE_USE@ep-little-hill-ahqourzl.c-3.us-east-1.aws.neon.tech/neondb" -c "
SELECT COUNT(*) as incorrect_records
FROM issue_agents ia
LEFT JOIN attempts a ON ia.issue_id = a.issue_id AND ia.agent_name = a.agent_name
WHERE ia.status = 'submitted'
  AND a.status = 'merged';
"
```

Expected output: 0 incorrect records

---

## Task 8: Verify Fix in Production

**Step 1: Check leaderboard stats via SQL**

```bash
psql "postgresql://neondb_owner:REDACTED_REVOKE_BEFORE_USE@ep-little-hill-ahqourzl.c-3.us-east-1.aws.neon.tech/neondb" -c "
SELECT agent_name, issues, prs, wins, dnf, acceptance_pct
FROM agent_stats
WHERE agent_name IN ('engine', 'cursor')
ORDER BY wins DESC;
"
```

Expected output: engine and cursor show wins > 0

**Step 2: Check leaderboard UI**

Navigate to: https://coding-arena.vercel.app/leaderboard

Expected: Leaderboard shows correct wins for all agents

**Step 3: Verify specific issues**

```bash
psql "postgresql://neondb_owner:REDACTED_REVOKE_BEFORE_USE@ep-little-hill-ahqourzl.c-3.us-east-1.aws.neon.tech/neondb" -c "
SELECT
  i.linear_key,
  ia.agent_name,
  ia.status,
  a.status as attempt_status
FROM issue_agents ia
JOIN issues i ON ia.issue_id = i.id
LEFT JOIN attempts a ON ia.issue_id = a.issue_id AND ia.agent_name = a.agent_name
WHERE i.linear_key IN ('ENG-977', 'ENG-973', 'ENG-954')
ORDER BY i.linear_key, ia.agent_name;
"
```

Expected: Statuses match correctly (accepted for winners, rejected for losers)

---

## Verification Checklist

After deployment and data fix:

- [ ] Leaderboard shows correct wins for engine (should be > 0)
- [ ] Leaderboard shows correct wins for cursor (should be > 0)
- [ ] No issue_agents records with status='submitted' where attempt is merged
- [ ] All tests pass (760+ tests)
- [ ] No type errors (99.9%+ coverage)
- [ ] No lint errors
- [ ] Pre-push hooks pass
- [ ] agent_stats view shows correct data
- [ ] Future reconciliations preserve accepted/rejected statuses

---

## Rollback Plan

If issues arise:

1. **Revert code changes**:
   ```bash
   git revert HEAD~2..HEAD
   git push origin main
   ```

2. **Emergency data rollback**: Not recommended - forward fix is safer

3. **Monitor**: Check logs for any reconciliation errors or issues

---

## Notes

- **Status State Machine**: pending → submitted → {accepted, rejected}
- **Final Statuses Have Priority**: accepted/rejected should never be overwritten
- **Idempotent Fix**: Adding the condition makes reconciliation safe to run multiple times
- **No Migration Needed**: This is a pure code fix, no schema changes
- **Data Fix Required**: Existing incorrect data must be manually corrected once
- **Future-Proof**: After fix, reconciliation can run anytime without breaking statuses
