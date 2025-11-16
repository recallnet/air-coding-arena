# Bug Fix: State Management Issues (ENG-973)

**Date:** 2025-11-16
**Issues Fixed:** Winner not set, ratings not updated, issue status not updated

## Summary

Fixed critical state management bugs where PRs could merge but the system would fail to:
1. Set the winning agent
2. Update agent ratings/scores
3. Mark issue as completed

The root cause was over-reliance on Linear webhooks with no fallback mechanism.

## Bugs Identified

### Bug #1: Winner Not Set When PR Merges
**Symptom:** Issue ENG-973 had engine's PR #14 merged, but `issues.winner_attempt_id` was NULL

**Root Cause:**
- GitHub webhook updates `attempts.status = 'merged'` but doesn't call `updateWinner()`
- Linear webhook is supposed to call `updateWinner()` but can fail/miss events
- Reconciliation only processes issues with `arena:ready` label
- If label is removed before reconciliation runs, issue never gets fixed

### Bug #2: Agent Scores Never Updated
**Symptom:**
- `agent_scores.games_played` stayed at 1 instead of incrementing to 2
- Ratings (mu, sigma, ordinal) never recalculated
- `agent_score_history` had no entry for ENG-973

**Root Cause:** Same as Bug #1 - `updateWinner()` was never called, so `updateRatingsForIssue()` never ran

### Bug #3: Issue Status Not Updated
**Symptom:** Issue status remained "In Progress" instead of "completed" (or syncing to Linear's "Done")

**Root Cause:** Same as Bug #1 - `updateWinner()` sets `issues.status = 'completed'`

## Architecture Analysis

### Original Design (Flawed)

```
GitHub PR Merged
↓
GitHub Webhook: Updates attempts.status = 'merged'
↓
[BLOCKS HERE - relies entirely on Linear]
↓
Linear Webhook OR Reconciliation: Calls updateWinner()
↓
Winner set, ratings updated, status changed
```

**Single Point of Failure:** If Linear webhooks fail or are delayed, nothing updates.

### New Design (Fixed)

```
GitHub PR Merged
↓
GitHub Webhook:
  1. Updates attempts.status = 'merged'
  2. Calls updateWinner() as fallback (idempotent)
↓
Winner set, ratings updated, status changed
↓
[Optional] Linear Webhook: Calls updateWinner() again (idempotent, no-op)
```

**Redundancy:** Both webhooks can call `updateWinner()` safely due to idempotency checks.

## The Fix

### Code Changes

**File:** `src/app/api/github/webhook/route.ts:386-395`

**Before:**
```typescript
console.log(`[GitHub] PR ${repo}#${prNumber} merged`)

// NOTE: Agent status updates are handled by Linear webhook's updateWinner()
// which uses transactions to avoid race conditions. GitHub webhook only
// tracks attempt status (merged/closed).

revalidatePath('/')
```

**After:**
```typescript
console.log(`[GitHub] PR ${repo}#${prNumber} merged`)

// Call updateWinner() as a fallback if Linear webhook hasn't processed this yet
// updateWinner() is idempotent - it checks if winner already set and skips if so
try {
  const { updateWinner } = await import('@/lib/update-winner')
  await updateWinner(attempt.issueId)
  console.log(`[GitHub] Called updateWinner for issue ${attempt.issueId}`)
} catch (error) {
  // Don't fail the webhook if updateWinner fails
  console.error(`[GitHub] updateWinner failed for ${attempt.issueId}:`, error)
}

revalidatePath('/')
```

### Why This Is Safe

1. **Idempotency:** `updateWinner()` checks if `issues.winner_attempt_id` is already set (line 42-46 in update-winner.ts):
   ```typescript
   if (issue.winnerAttemptId) return
   ```

2. **Transaction Safety:** `updateWinner()` uses PostgreSQL row-level locking:
   ```typescript
   .for('update')  // Row-level lock prevents race conditions
   ```

3. **Error Handling:** If `updateWinner()` fails, webhook doesn't fail - it logs and continues

4. **Race Condition Protection:** Even if GitHub and Linear webhooks fire simultaneously:
   - First one acquires row lock and sets winner
   - Second one sees winner already set and returns early
   - No duplicate score history entries
   - No double rating updates

## Verification

### Manual Test (Production)

Ran script to call `updateWinner('2450c80d-6a45-4eec-99c1-4954e77d9d64')`:

**Before:**
- Issue status: "In Progress"
- Winner: NULL
- Score history: 0 entries
- games_played: 1

**After:**
- Issue status: "completed" (then synced to "In Review" by Linear)
- Winner: engine (88728539-8754-4b39-9bf4-c3b3e90702f7)
- Score history: 2 entries (engine rank=1, cursor rank=2)
- games_played: 2
- Ratings: engine 1501.9, cursor 1501.1

### Database State After Fix

```sql
-- Agent scores updated correctly
SELECT agent_name, ordinal, games_played FROM agent_scores
ORDER BY ordinal DESC;

 agent_name |  ordinal  | games_played
------------+-----------+--------------
 engine     | 1501.9457 |            2
 cursor     | 1501.1235 |            2

-- Agent stats view shows correct wins
SELECT * FROM agent_stats ORDER BY wins DESC;

 agent_name | issues | prs | wins | dnf | acceptance_pct
------------+--------+-----+------+-----+----------------
 engine     |      4 |   4 |    1 |   0 |           25.0
 cursor     |      6 |   6 |    1 |   1 |           16.7
```

## Testing

### Integration Test
Created `src/__tests__/winner-determination.integration.test.ts` to reproduce the bug

### Unit Test
Created `src/app/api/github/webhook/route.updateWinner.test.ts` to verify the fix

## Files Changed

1. `src/app/api/github/webhook/route.ts` - Added updateWinner() fallback
2. `scripts/fix-eng-973.ts` - Manual fix script (used for verification)
3. `src/__tests__/winner-determination.integration.test.ts` - Integration tests
4. `src/app/api/github/webhook/route.updateWinner.test.ts` - Unit tests

## Deployment Notes

1. **No Migration Needed:** Database schema unchanged
2. **No Breaking Changes:** Existing functionality preserved
3. **Immediate Effect:** Next PR merge will trigger updateWinner()
4. **Backward Compatible:** Linear webhooks still work as before

## Future Improvements

### Consider Adding:

1. **Reconciliation Improvements:**
   - Process ALL issues with merged PRs, not just labeled ones
   - Add separate reconciliation job that checks `attempts.status='merged'` directly

2. **Monitoring:**
   - Alert if updateWinner() fails repeatedly
   - Track how often GitHub fallback is used vs Linear webhook

3. **Observability:**
   - Add metrics for winner determination latency
   - Log which system (GitHub/Linear) successfully set the winner

## Related Issues

- ENG-973: GitHub Actions Performance Optimization (the issue where this was discovered)
- Similar pattern may affect other issues if Linear webhooks were missed

## Credits

Investigation and fix completed using systematic-debugging skill:
- Phase 1: Root Cause Investigation
- Phase 2: Pattern Analysis
- Phase 3: Test-Driven Fix
- Phase 4: Verification

The fix ensures **defense in depth** - multiple layers can trigger winner determination, preventing single points of failure.
