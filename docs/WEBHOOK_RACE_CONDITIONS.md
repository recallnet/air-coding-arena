# Webhook Race Condition Prevention

## Problem

Linear sends webhooks for various events (Issue, Attachment, Comment). When multiple PRs merge around the same time, concurrent webhooks can race to set the winner, potentially selecting the wrong agent.

## Solution

### Transaction-Based Winner Selection

Use PostgreSQL transactions with row-level locking (`FOR UPDATE`) to atomically select and set the winner.

```typescript
await db.transaction(async (tx) => {
  // 1. Lock issue row (blocks concurrent updates)
  const [issue] = await tx
    .select()
    .from(issues)
    .where(eq(issues.id, issueId))
    .for('update') // Row-level lock
    .limit(1)

  // 2. Idempotency check
  if (issue.winnerAttemptId) {
    return // Winner already set
  }

  // 3. Select winner
  // 4. Update issue.winnerAttemptId
  // 5. Close losing attempts
  // 6. Update ratings
})
```

### Key Properties

- **Atomicity**: All operations in transaction succeed or fail together
- **Isolation**: Row lock prevents concurrent winner selection
- **Idempotency**: Safe to call multiple times (checks if winner already set)
- **Consistency**: Ratings calculated with correct winner state

## Implementation Details

### Files Changed
- `src/app/api/linear/webhook/route.ts`: Add transaction wrapping to `updateWinner()`
- `src/app/api/github/webhook/route.ts`: Remove rating updates (moved to Linear webhook)
- Tests: Add race condition integration tests

### Database Impact
- Uses PostgreSQL `FOR UPDATE` (row-level lock)
- Slightly slower (transaction overhead) but guarantees correctness
- No schema changes required

## Testing

See `src/app/api/linear/webhook/route.race-condition.test.ts` for integration tests simulating concurrent webhook processing.
