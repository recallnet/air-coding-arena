# Fix Issue Progress Counting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix two critical bugs in issue progress counting: (1) denominator incorrectly excludes `ignored` agents, and (2) prevent issues from entering arena without agent assignments.

**Architecture:**
- Issue #1: Modify SQL view `agent_stats` in migration 004 to only exclude `pending` from denominator, not `ignored`
- Issue #2: Add validation in issue reconciliation to ensure issues have agent assignments before marking as arena-ready

**Tech Stack:** PostgreSQL, Drizzle ORM, Vitest

---

## Background

### Issue #1: Incorrect Progress Denominator
**Current behavior:** ENG-977 shows "2/2 complete"
- 4 agents total: engine (accepted), cursor (rejected), github copilot (ignored), factory (ignored)
- Current denominator = engaged agents (NOT pending, NOT ignored) = 2
- Shows: "2/2 complete"

**Expected behavior:** Should show "2/4 complete"
- Denominator should = ALL agents EXCEPT pending = 4
- `ignored` means "assigned but didn't submit" - should COUNT
- `pending` means "never dispatched" - should NOT count

### Issue #2: Issue in Arena Without Agents
**Current behavior:** ENG-978 has `arena_ready_labeled_at` set but ZERO agent assignments
**Expected behavior:** Issues should not enter arena without at least one agent assignment

---

## Task 1: Write Failing Test for Progress Counting

**Files:**
- Modify: `src/components/IssueActivityTable.test.tsx`

**Step 1: Add test case for ignored agents in denominator**

Add this test to the "agent progress counting" describe block:

```typescript
it('should include ignored agents in denominator', () => {
  const issueWithIgnored: IssueWithAgents = {
    ...mockIssue,
    agents: [
      { agentName: 'engine', status: 'accepted' },
      { agentName: 'cursor', status: 'rejected' },
      { agentName: 'githubcopilot', status: 'ignored' },
      { agentName: 'factory', status: 'ignored' },
    ],
  }
  render(<IssueActivityTable issues={[issueWithIgnored]} />)
  // 2 complete (accepted + rejected) out of 4 (includes ignored, excludes pending)
  expect(screen.getByText('2/4 complete')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/components/IssueActivityTable.test.tsx --run
```

Expected output: FAIL - "Unable to find element with text: 2/4 complete"
(Currently shows "2/2 complete")

**Step 3: Commit failing test**

```bash
git add src/components/IssueActivityTable.test.tsx
git commit -m "test: add failing test for ignored agents in denominator"
```

---

## Task 2: Fix SQL View to Include Ignored in Denominator

**Files:**
- Modify: `drizzle/manual-migrations/004-update-agent-stats-view-and-indexes.sql`

**Step 1: Update agent_stats view SQL**

Replace the view definition in the migration file:

```sql
DROP VIEW IF EXISTS agent_stats;

CREATE VIEW agent_stats AS
SELECT
  ia.agent_name,
  COUNT(DISTINCT ia.issue_id) AS issues,
  COUNT(DISTINCT a.id) AS prs,
  COUNT(*) FILTER (WHERE ia.status = 'accepted') AS wins,
  COUNT(*) FILTER (WHERE ia.status = 'ignored') AS dnf,
  COUNT(DISTINCT a.id) AS attempts,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE ia.status = 'accepted') /
    NULLIF(COUNT(*) FILTER (WHERE ia.status IN ('accepted', 'rejected')), 0),
    1
  ) AS acceptance_pct
FROM issue_agents ia
LEFT JOIN attempts a ON ia.issue_id = a.issue_id AND ia.agent_name = a.agent_name
-- ONLY exclude pending agents from denominator
-- ignored agents (assigned but didn't submit) should be counted
WHERE ia.status != 'pending'
GROUP BY ia.agent_name;
```

**Step 2: Update in-memory view logic**

The view query uses `WHERE ia.status != 'pending'` which means:
- `ignored` agents ARE included in the denominator ✓
- Only `pending` agents are excluded ✓

Update the logic in `IssueActivityTable.tsx`:

Modify: `src/components/IssueActivityTable.tsx:246-265`

```typescript
function getAgentProgress(
  agents: Array<{ agentName: string; status: string }>
): string | null {
  if (agents.length === 0) return null

  // Only exclude pending agents from denominator
  // ignored agents (assigned but didn't submit) should be counted
  const countableAgents = agents.filter((a) => a.status !== 'pending')

  if (countableAgents.length === 0) return `${agents.length} assigned`

  const total = countableAgents.length
  const completed = countableAgents.filter(
    (a) => a.status === 'accepted' || a.status === 'rejected'
  ).length
  const submitted = countableAgents.filter((a) => a.status === 'submitted').length

  if (completed > 0) {
    return `${completed}/${total} complete`
  } else if (submitted > 0) {
    return `${submitted}/${total} in review`
  }

  return `${total} in progress`
}
```

**Step 3: Run tests to verify fix**

```bash
npm test -- src/components/IssueActivityTable.test.tsx --run
```

Expected output: ALL TESTS PASS including the new test

**Step 4: Commit fix**

```bash
git add drizzle/manual-migrations/004-update-agent-stats-view-and-indexes.sql src/components/IssueActivityTable.tsx
git commit -m "fix(progress): include ignored agents in denominator

Previously excluded both pending and ignored from denominator.
Now only excludes pending (never dispatched).

ignored means 'assigned but didn't submit' - should count in denominator
pending means 'never dispatched' - should NOT count

Fixes issue where ENG-977 showed '2/2 complete' instead of '2/4 complete'"
```

**Step 5: Apply migration in production**

The migration will auto-apply on next Vercel deploy, but for immediate fix:

```bash
psql "$PROD_DATABASE_URL" < drizzle/manual-migrations/004-update-agent-stats-view-and-indexes.sql
```

---

## Task 3: Write Failing Test for Arena Entry Validation

**Files:**
- Modify: `src/lib/linear-reconcile.test.ts`

**Step 1: Add test for issue without agents**

Add this test to the `reconcileLinearIssues` describe block:

```typescript
it('should not mark issue as arena-ready if no agents assigned', async () => {
  const issueWithNoAgents: LinearIssue = {
    id: 'linear-issue-id',
    identifier: 'ENG-999',
    title: 'Issue with no agents',
    url: 'https://linear.app/1',
    state: { name: 'In Progress' },
    team: { key: 'ENG' },
    labels: { nodes: [{ name: 'arena:ready' }] },
    comments: { nodes: [] }, // No comments = no agent mentions
    attachments: { nodes: [] },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  }

  mockLinearClient.issues.mockResolvedValue({
    nodes: [issueWithNoAgents],
  } as never)

  mockDb.insert.mockResolvedValue([{ id: 'db-issue-id' }] as never)
  mockDb.select.mockReturnValue({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  } as never)

  await reconcileLinearIssues()

  // Issue should be created but NOT marked as arena-ready
  expect(mockDb.insert).toHaveBeenCalled()
  const insertCall = mockDb.insert.mock.calls[0][0]
  expect(insertCall.values[0].arenaReadyLabeledAt).toBeNull()
})
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/lib/linear-reconcile.test.ts --run
```

Expected output: FAIL - issue is marked as arena-ready even without agents

**Step 3: Commit failing test**

```bash
git add src/lib/linear-reconcile.test.ts
git commit -m "test: add failing test for arena entry without agents"
```

---

## Task 4: Add Validation to Prevent Arena Entry Without Agents

**Files:**
- Modify: `src/lib/linear-reconcile.ts`

**Step 1: Add agent validation function**

Add this function before `reconcileLinearIssues`:

```typescript
/**
 * Checks if issue has at least one agent mention in comments.
 * Issues should not enter arena without agent assignments.
 */
function hasAgentMentions(issue: LinearIssue): boolean {
  const agentNames = ['cursor', 'engine', 'claude', 'cyrus', 'factory', 'githubcopilot', 'github copilot']
  const agentPattern = new RegExp(
    `@(${agentNames.join('|')})|@\\[([^\\]]+)\\]\\([^)]+\\)`,
    'gi'
  )

  for (const comment of issue.comments.nodes) {
    if (comment.body && agentPattern.test(comment.body)) {
      return true
    }
  }

  return false
}
```

**Step 2: Update reconcileLinearIssues to use validation**

In the `reconcileLinearIssues` function, modify the `arenaReadyLabeledAt` logic:

Find this code (around line 80):

```typescript
arenaReadyLabeledAt: hasArenaLabel ? new Date() : null,
```

Replace with:

```typescript
arenaReadyLabeledAt: hasArenaLabel && hasAgentMentions(issue) ? new Date() : null,
```

**Step 3: Run tests to verify fix**

```bash
npm test -- src/lib/linear-reconcile.test.ts --run
```

Expected output: ALL TESTS PASS including the new test

**Step 4: Run full test suite**

```bash
npm test
```

Expected output: ALL TESTS PASS

**Step 5: Commit fix**

```bash
git add src/lib/linear-reconcile.ts
git commit -m "fix(arena): prevent entry without agent mentions

Issues must have at least one agent mention in comments
before being marked as arena-ready.

Prevents issues like ENG-978 from entering arena with
zero agent assignments."
```

---

## Task 5: Run Full Validation Suite

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

**Step 4: Full test suite with coverage**

```bash
npm test
```

Expected output: All tests pass, coverage >= 90%

**Step 5: If any validation fails, fix and re-run**

Do NOT proceed to next task until all validation passes.

---

## Task 6: Fix Production Data

**Files:**
- N/A (production database fix)

**Step 1: Remove ENG-978 from arena**

```bash
psql "$PROD_DATABASE_URL" -c "
UPDATE issues
SET arena_ready_labeled_at = NULL
WHERE linear_key = 'ENG-978';
"
```

Expected output: UPDATE 1

**Step 2: Verify fix**

```bash
psql "$PROD_DATABASE_URL" -c "
SELECT linear_key, title, arena_ready_labeled_at
FROM issues
WHERE linear_key = 'ENG-978';
"
```

Expected output: arena_ready_labeled_at should be NULL

---

## Task 7: Final Commit and Push

**Step 1: Create final commit if needed**

```bash
git status
```

If there are uncommitted changes, commit them.

**Step 2: Push to main**

```bash
git push origin main
```

Expected output: All pre-push hooks pass, push succeeds

**Step 3: Verify Vercel deployment**

Wait for Vercel deployment to complete.
Migration 004 will auto-apply the updated view.

---

## Verification Checklist

After deployment:

- [ ] ENG-977 shows "2/4 complete" (not "2/2")
- [ ] ENG-978 no longer shows in active issues (arena_ready_labeled_at = NULL)
- [ ] New issues require agent mentions before entering arena
- [ ] Leaderboard stats correctly count ignored agents
- [ ] All tests pass
- [ ] No type errors
- [ ] No lint errors

---

## Rollback Plan

If issues arise:

1. **Revert migration**: Run the previous version of 004 migration
2. **Revert code changes**: `git revert HEAD`
3. **Restore ENG-978**: Re-add to arena if needed

---

## Notes

- **ignored vs pending**: `ignored` = "assigned but didn't submit" (COUNT), `pending` = "never dispatched" (DON'T COUNT)
- **Agent validation**: Prevents future issues from entering arena without assignments
- **Migration timing**: Auto-applies on Vercel deploy via `vercel-build` script
