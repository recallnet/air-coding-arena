# Plan: Improve Linear Webhook Deduplication

**Date**: 2025-11-12
**Status**: Proposed
**Priority**: High (causes unnecessary API calls and log spam)

## Problem Statement

Linear sends multiple webhook events when an issue is deleted (or updated), and our current idempotency check treats each as unique because they have different `updatedAt` timestamps.

### Observed Behavior

When deleting a single issue:
```
21:49:44.139 MST POST /api/linear/webhook
21:49:44.262 MST POST /api/linear/webhook
21:49:44.276 MST POST /api/linear/webhook
21:49:44.305 MST POST /api/linear/webhook (x2)
21:49:44.624 MST POST /api/linear/webhook
21:49:44.657 MST POST /api/linear/webhook
21:49:44.662 MST POST /api/linear/webhook
21:49:44.663 MST POST /api/linear/webhook
21:49:44.927 MST POST /api/linear/webhook
```

Result: 10 webhooks, all processed, each calling `syncIssueFromLinear()`, which:
- Fetches full issue data from Linear API (expensive)
- Updates database
- Calls `dispatchMissingAgents()` (logs "All agents already dispatched" spam)

### Current Idempotency Logic

`src/app/api/linear/webhook/route.ts:82`:
```typescript
const eventKey = `linear:${payload.type}:${dataId}:${payload.updatedAt}`
```

**Problem**: `updatedAt` changes with each webhook, so every event is considered unique.

## Root Cause Analysis

### Why Does Linear Send Multiple Webhooks?

Linear sends webhooks for:
1. **Issue deletion** itself
2. **Related entity updates** (attachments, comments, etc.)
3. **Cascading updates** (when issue is deleted, related entities are updated)
4. **Multiple subscriptions** (if multiple webhooks are configured)

Each of these gets a new `updatedAt` timestamp as Linear processes the deletion cascade.

### Why Current Deduplication Fails

The idempotency key includes `updatedAt`:
- Event 1: `linear:Issue:abc123:2024-11-12T21:49:44.139Z` ✓ Processed
- Event 2: `linear:Issue:abc123:2024-11-12T21:49:44.262Z` ✓ Processed (different updatedAt)
- Event 3: `linear:Issue:abc123:2024-11-12T21:49:44.305Z` ✓ Processed (different updatedAt)
- ...

All are treated as distinct events!

## Options

### Option 1: Remove `updatedAt` from Idempotency Key (Simple)

**Change**:
```typescript
// Before
const eventKey = `linear:${payload.type}:${dataId}:${payload.updatedAt}`

// After
const eventKey = `linear:${payload.type}:${dataId}:${payload.action}`
```

**Pros**:
- Simple one-line change
- Groups multiple rapid-fire updates by action type
- Still distinguishes between create/update/remove actions

**Cons**:
- Won't deduplicate legitimate sequential updates
- Could miss real updates if they happen very quickly

### Option 2: Time-Window Deduplication (Recommended)

**Change**: Add time-based deduplication - only process one event per (type, id, action) in a sliding window (e.g., 5 seconds).

```typescript
const eventKey = `linear:${payload.type}:${dataId}:${payload.action}`

// Check if we processed this (type, id, action) recently
const recentEvent = await db
  .select()
  .from(events)
  .where(
    and(
      eq(events.source, 'linear'),
      eq(events.key, eventKey),
      gt(events.createdAt, new Date(Date.now() - 5000)) // Within last 5 seconds
    )
  )
  .limit(1)

if (recentEvent.length > 0) {
  console.log(`[Webhook] Deduplicated: ${eventKey} (within 5s window)`)
  return NextResponse.json({ status: 'deduplicated' })
}

// Continue with event processing...
```

**Pros**:
- Handles rapid-fire duplicates from Linear
- Still allows legitimate sequential updates after 5 seconds
- Configurable window

**Cons**:
- Slightly more complex
- Requires timestamp comparison query

### Option 3: Rate Limiting Per Resource (Most Robust)

**Change**: Track "last processed" timestamp per (type, id) and only reprocess if enough time has passed.

```typescript
// Add to events table or create new table
type ResourceLock = {
  key: string // "linear:Issue:abc123"
  lastProcessedAt: Date
}

// Check if we can process
const minInterval = 1000 // 1 second between updates for same resource
const lockKey = `linear:${payload.type}:${dataId}`

const lastProcessed = await getResourceLock(lockKey)
if (lastProcessed && Date.now() - lastProcessed.getTime() < minInterval) {
  console.log(`[Webhook] Rate limited: ${lockKey}`)
  return NextResponse.json({ status: 'rate-limited' })
}

await updateResourceLock(lockKey, new Date())
// Continue processing...
```

**Pros**:
- Most robust - prevents any rapid-fire spam
- Can tune interval per resource type
- Handles all duplicate scenarios

**Cons**:
- Requires new table or column
- More complex implementation

### Option 4: Smarter Action-Based Deduplication (Pragmatic)

**Change**: Different deduplication strategies for different actions.

```typescript
// For 'remove' actions, deduplicate by id only (removal is removal)
if (payload.action === 'remove') {
  eventKey = `linear:${payload.type}:${dataId}:remove`
} else {
  // For create/update, include updatedAt to catch real updates
  eventKey = `linear:${payload.type}:${dataId}:${payload.action}:${payload.updatedAt}`
}
```

**Pros**:
- Solves the delete spam specifically
- Keeps existing behavior for updates
- Minimal change

**Cons**:
- Still doesn't handle update spam
- Partial solution

## Recommended Solution: Option 2 (Time-Window Deduplication)

Implement a 5-second sliding window for deduplication. This:
- Solves the delete spam (all 10 events within milliseconds)
- Allows legitimate updates after 5 seconds
- Simple to implement
- No schema changes needed

### Implementation

**File**: `src/app/api/linear/webhook/route.ts`

**Changes**:

```typescript
// After parsing payload (line 71)
const payload = JSON.parse(body) as LinearWebhookPayload

// Log webhook
console.log(
  `[Webhook] Received: type=${payload.type}, action=${payload.action}`
)

// NEW: Time-window deduplication
const dataId = payload.data['id'] as any as string
const baseKey = `linear:${payload.type}:${dataId}:${payload.action}`

// Check for recent events with same base key (within 5 seconds)
const fiveSecondsAgo = new Date(Date.now() - 5000)
const recentEvents = await db
  .select()
  .from(events)
  .where(
    and(
      eq(events.source, 'linear'),
      sql`${events.key} LIKE ${baseKey + '%'}`,
      gt(events.createdAt, fiveSecondsAgo)
    )
  )
  .limit(1)

if (recentEvents.length > 0) {
  console.log(`[Webhook] Deduplicated (5s window): ${baseKey}`)
  return NextResponse.json({ status: 'deduplicated' })
}

// Original idempotency check (for exact duplicates)
const eventKey = `linear:${payload.type}:${dataId}:${payload.updatedAt}`

const existing = await db
  .insert(events)
  .values({
    source: 'linear',
    key: eventKey,
    payload,
  })
  .onConflictDoNothing({
    target: [events.source, events.key],
  })
  .returning({ id: events.id })

if (existing.length === 0) {
  console.log(`[Webhook] Duplicate event: ${eventKey}`)
  return NextResponse.json({ status: 'duplicate' })
}

// Continue with event processing...
```

### Testing

Add tests in `src/app/api/linear/webhook/route.test.ts`:

```typescript
describe('Time-window deduplication', () => {
  it('should deduplicate events within 5 second window', async () => {
    // Send first event
    const req1 = createMockRequest({ type: 'Issue', action: 'update', data: { id: 'issue-1' }})
    const res1 = await POST(req1)
    expect(res1.status).toBe(200)

    // Send duplicate event 1 second later (same issue, same action)
    const req2 = createMockRequest({ type: 'Issue', action: 'update', data: { id: 'issue-1' }})
    const res2 = await POST(req2)
    expect(res2.status).toBe(200)
    const body = await res2.json()
    expect(body.status).toBe('deduplicated')
  })

  it('should process events after 5 second window', async () => {
    // Send first event
    const req1 = createMockRequest({ type: 'Issue', action: 'update', data: { id: 'issue-1' }})
    await POST(req1)

    // Mock time passage (6 seconds)
    vi.useFakeTimers()
    vi.advanceTimersByTime(6000)

    // Send second event (should be processed)
    const req2 = createMockRequest({ type: 'Issue', action: 'update', data: { id: 'issue-1' }})
    const res2 = await POST(req2)
    expect(res2.status).toBe(200)
    const body = await res2.json()
    expect(body.success).toBe(true) // Not deduplicated

    vi.useRealTimers()
  })
})
```

## Performance Impact

### Before
- 10 webhooks for single issue deletion
- 10 Linear API calls (expensive)
- 10 database syncs
- 10 dispatch checks

### After
- 10 webhooks received
- 1 processed, 9 deduplicated immediately
- 1 Linear API call
- 1 database sync
- 1 dispatch check

**Improvement**: 90% reduction in unnecessary processing

## Alternative: Configuration-Based Window

Make the window configurable:

```typescript
const WEBHOOK_DEDUP_WINDOW_MS = Number.parseInt(
  process.env['WEBHOOK_DEDUP_WINDOW_MS'] ?? '5000',
  10
)
```

This allows tuning in production without code changes.

## Success Criteria

- [ ] Multiple rapid webhooks for same issue deduplicated
- [ ] Legitimate sequential updates still processed after window
- [ ] Log spam eliminated ("All agents already dispatched" x21)
- [ ] Linear API call volume reduced
- [ ] Tests cover deduplication logic
- [ ] Window is configurable via environment variable

## Related Issues

- None currently, but this pattern could apply to GitHub webhooks too

## Next Steps

1. Implement Option 2 (time-window deduplication)
2. Add tests for deduplication logic
3. Monitor webhook processing in production
4. Tune window duration if needed (5s is a starting point)
