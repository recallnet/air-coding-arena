# Test Fixtures - Characterization Testing with Real Production Data

This directory contains **real production data** captured from our Linear API and webhook events database. These fixtures enable **characterization testing** (also called **fixture-based testing** or **golden file testing**) - validating that our code correctly handles all real-world data variations.

## Why This Matters

The `attachment.issue` undefined bug we just fixed **would have been caught** by these tests! By testing against actual production payloads, we prevent regressions caused by assumptions about data structure.

## Directory Structure

```
fixtures/
├── webhook-events/           # Real webhook events from database
│   ├── all-events.json      # All captured events
│   ├── attachment-events.json
│   ├── comment-events.json
│   ├── issue-events.json
│   └── metadata.json        # Summary and statistics
└── linear-issues/           # Real Linear issues with full data
    ├── eng-320.json         # Individual issue fixtures
    ├── eng-901.json
    ├── index.json           # All issues combined
    └── metadata.json        # Summary and statistics
```

## Capturing New Fixtures

### Option 1: Capture All Fixtures
```bash
npm run fixtures:capture
```

### Option 2: Capture Individually
```bash
# Capture webhook events from database (default: last 30 events)
npm run fixtures:capture:webhooks

# Capture Linear issues with arena:ready label
npm run fixtures:capture:issues
```

### Advanced Options
```bash
# Capture more/fewer webhook events
npx dotenv -e .env.local -- tsx scripts/capture-webhook-fixtures.ts --limit=50
```

## Using Fixtures in Tests

### Webhook Route Tests

```typescript
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Load all webhook fixtures
function loadWebhookFixtures() {
  const path = join(__dirname, '../fixtures/webhook-events/all-events.json')
  return JSON.parse(readFileSync(path, 'utf-8'))
}

// Test against all real events
it('should handle all real webhook events', async () => {
  const fixtures = loadWebhookFixtures()
  for (const fixture of fixtures) {
    const response = await POST(createMockRequest(fixture.payload))
    expect(response.status).toBe(200)
  }
})
```

### Linear Sync Tests

```typescript
// Load Linear issue fixtures
function loadLinearFixtures() {
  const path = join(__dirname, '../fixtures/linear-issues/index.json')
  return JSON.parse(readFileSync(path, 'utf-8'))
}

// Test parsing against real issues
it('should parse all real Linear issues correctly', async () => {
  const fixtures = loadLinearFixtures()
  for (const fixture of fixtures) {
    const result = await syncIssueFromLinear(fixture.id)
    // Assert expected behavior
  }
})
```

## What Makes This Different

### Traditional Unit Tests
```typescript
// Mock/fake data - may not reflect reality
it('should handle attachment', async () => {
  const payload = {
    type: 'Attachment',
    data: {
      issue: { id: 'test-123' }  // We assume this structure
    }
  }
  // ...
})
```

### Fixture-Based Tests
```typescript
// Real production data - captures actual variations
it('should handle all real attachments', async () => {
  const fixtures = loadFixturesByType('Attachment')
  for (const fixture of fixtures) {
    // Uses ACTUAL payloads from production
    // Including edge cases like missing `issue` field!
  }
})
```

## Benefits

1. **Catches Real Bugs**: The `attachment.issue` undefined bug would have been caught
2. **Documents Reality**: Fixtures show what data actually looks like
3. **Regression Prevention**: Any code change is validated against all known real cases
4. **No Mocking Assumptions**: Tests use actual data structure, not our assumptions
5. **Living Documentation**: Fixtures update as data evolves

## When to Recapture Fixtures

Recapture fixtures when:
- 📊 New issue patterns emerge (e.g., new label structures)
- 🐛 A production bug reveals missing edge cases
- 🔄 Linear API changes or adds fields
- 📈 Periodically (monthly?) to keep fixtures current
- ✨ New webhook event types are added

## Metadata Files

Each fixture directory includes a `metadata.json` with:
- Capture timestamp
- Total fixture count
- Summary statistics
- Edge cases identified (e.g., attachments without issue field)

Example:
```json
{
  "capturedAt": "2025-11-14T17:58:27.962Z",
  "totalEvents": 30,
  "eventTypes": [
    { "type": "Comment", "count": 26, "actions": ["create"] },
    { "type": "Attachment", "count": 1, "actions": ["create"] }
  ]
}
```

## Testing Philosophy

> **"Test the code you have, not the code you think you have."**

Fixture-based testing ensures our code handles reality, not our assumptions about reality. By using actual production data, we build more robust systems that handle edge cases we didn't even know existed.

## Current Fixture Coverage

### Webhook Events (30 samples)
- ✅ 26 Comment events (including agent mentions)
- ✅ 3 Issue events (create, update)
- ✅ 1 Attachment event (with GitHub PR link)
- 🐛 Includes events that triggered the `attachment.issue` bug

### Linear Issues (7 samples)
- ✅ Issues with agent mentions and PR links
- ✅ Issues with varying comment counts (9-22 comments)
- ✅ Issues with and without attachments
- ✅ Multiple state variations (Done, In Progress, etc.)

## Linear Sync Tests

Validates `linear-sync.ts` comment parsing and PR attribution logic with comprehensive test coverage.

### Test File
- **Main tests**: `/Users/andrewhill/Coding/coding-arena/src/lib/linear-sync.test.ts` (27 tests)

### Test Coverage

**1. Agent Mention Detection** (7 tests)
- Detects agent mentions in comment bodies (`@cursor`, `@engine`, etc.)
- Finds agents via body analysis (cursor.com URL patterns)
- Searches older comments when PR comment lacks agent
- Searches newer comments as fallback
- Handles explicit mentions when body analysis fails

**2. PR URL Extraction** (3 tests)
- Extracts GitHub PR URLs from various comment formats
- Handles multiple PR URLs in a single comment
- Detects cursor.com URLs to attribute PRs to Cursor agent

**3. Parent Chain Walking** (2 tests)
- Attributes PRs to agents mentioned in parent comment threads
- Detects circular parent chains without crashing (cycle protection)

**4. Edge Cases** (5 tests)
- Returns early if issue not in database
- Falls back to unknown agent when no context found
- Skips orphaned attachments (attachments without linked issues)
- Handles merged/closed PR attachments gracefully
- Handles agent dispatch errors without crashing

**5. Full Integration** (10 tests)
- Syncs entire issues with comments and attachments
- Extracts complete issue metadata (assignee, creator, project, cycle, team, state, labels)
- Creates attempts with correct agent attribution
- Updates agent status when PRs are submitted

### Synthetic Test Fixtures

Real-world edge case testing with 5 synthetic fixtures at `/Users/andrewhill/Coding/coding-arena/src/__tests__/fixtures/linear-issues/synthetic/`:

1. **circular-chain.json** - Tests circular parent reference detection (A→B→C→A)
   - Validates cycle detection prevents infinite loops
   - Comment count: 3
   - Edge case: Circular parent chain

2. **deep-threading.json** - Tests deep nested threading (depth 5)
   - Validates parent chain walking at depth 5+ (beyond typical depth 1-2)
   - Comment count: 6
   - Edge case: Deep nesting

3. **multiple-prs.json** - Multiple PR URLs in single comment
   - Tests extraction of 3 PRs from one comment body
   - Comment count: 2
   - Edge case: Multi-PR comments

4. **mixed-mentions.json** - Mixed agent mention formats
   - Tests `@agent` and `@[agent](uuid)` formats together
   - Tests multiple agents in single comment
   - Comment count: 5
   - Edge case: Mixed mention syntax

5. **extreme-long-chain.json** - Extreme case with 20 comments
   - Tests performance with long parent chain (depth 18)
   - Comment count: 20
   - Edge case: Large comment volume

### Real Patterns Validated

From 27 comprehensive tests:
- Agent mentions: @cursor, @engine, @cyrus, @claude, @factory
- Mention formats: Simple (@agent), UUID-tagged (@[agent](uuid)), URL-inferred
- PR attribution: Direct mention, parent chain, body analysis, fallback searches
- Defensive coding: Circular references, orphaned data, missing fields
- Full sync flow: Comments, attachments, metadata, agent status

### When to Update Tests

Update or regenerate tests when:
- Adding new agent mention patterns
- Changing PR URL extraction logic
- Modifying parent chain walking algorithm
- Adding new Linear SDK fields to metadata extraction
- Discovering new edge cases in production

### Usage Example

```typescript
import { syncIssueFromLinear } from './linear-sync'

// Tests mock Linear SDK and validate entire sync flow
it('should sync comments and find agent mentions', async () => {
  // Mock Linear SDK responses
  const mockIssue = createMockIssue({
    comments: vi.fn().mockResolvedValue({
      nodes: [
        { body: '@cursor can you help?', createdAt: '2024-01-01T00:00:00Z' },
        { body: '@engine please review', createdAt: '2024-01-02T00:00:00Z' }
      ]
    })
  })

  // Execute sync and verify database updates
  await syncIssueFromLinear('linear-issue-id')

  // Assertions validate agent detection and attempt creation
})
```

### Test Statistics

- **Total tests**: 27
- **Agent mention tests**: 7
- **PR extraction tests**: 3
- **Parent chain tests**: 2
- **Edge case tests**: 5
- **Integration tests**: 10
- **Synthetic fixtures**: 5
- **Total synthetic comments**: 36

## Related Files

- Tests:
  - `src/app/api/linear/webhook/route.fixtures.test.ts`
  - `src/lib/linear-sync.test.ts`
- Capture Scripts:
  - `scripts/capture-webhook-fixtures.ts`
  - `scripts/capture-linear-fixtures.ts`
