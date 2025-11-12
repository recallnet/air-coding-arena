# Linear Sync PR Extraction Fix - Implementation Summary

## Problem

The `syncIssueFromLinear` function only processed PR attachments, missing GitHub PRs posted by agents (like Cursor) as **links within comment bodies**. Debug output showed 8 comments with agent mentions and PR links, but 0 attachments.

## Solution Implemented

Enhanced the `syncComments` function in `/Users/andrewhill/Coding/coding-arena/src/lib/linear-sync.ts` to extract GitHub PR URLs from comment bodies and create corresponding attempts.

## Key Changes

### 1. Two-Phase Processing

Split comment processing into two phases to ensure the agent mention map is fully built before searching for PRs:

**Phase 1**: Build agent mentions map for all comments

- Scan all comments for agent handles (@cursor, @engine, @cyrus, @claude)
- Create entries in `issue_agents` table with status="pending"
- Store mentions in `commentAgents` map

**Phase 2**: Extract PR URLs with full context

- Scan comment bodies for GitHub PR URLs using regex: `/github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/g`
- Determine agent using intelligent search strategy
- Create entries in `attempts` table
- Update agent status to "submitted"

### 2. Intelligent Agent Detection Strategy

The agent is determined using a fallback chain:

1. **Direct mention in PR comment**: Check if agent is @mentioned in the same comment as the PR
2. **Body content analysis**: Use `guessAgent()` to detect agent names in comment text (e.g., "cursor.com" URLs)
3. **Search nearby comments**:
   - Search forward in array (older comments in time) up to 6 comments away
   - For each comment, try body analysis first, then check for explicit mentions
   - Search backward in array (newer comments in time) up to 3 comments away
4. **Fallback**: Use "unknown" if no agent can be determined

### 3. Agent Status Update

When a PR is successfully associated with an agent, the agent's status in `issue_agents` is updated from "pending" to "submitted".

### 4. Edge Cases Handled

- Multiple PR URLs in one comment (regex with global flag)
- PRs from unknown agents (fallback to "unknown")
- Duplicate PRs (onConflictDoUpdate with unique constraint on issueId + agentName + prNumber)
- Comments in reverse chronological order (newest first)

## Code Changes

### Modified Imports

```typescript
import { eq, and } from 'drizzle-orm'
```

### Enhanced `syncComments` Function

- Added two-phase processing architecture
- Integrated PR URL extraction with regex matching
- Implemented intelligent agent detection with nearby comment search
- Added upsert logic for attempts table
- Added conditional agent status update

## Testing Results

### Before Fix

```
Issue Agents: 3
  - engine (pending)
  - cursor (pending)
  - cyrus (pending)

Attempts: 0
```

### After Fix

```
Issue Agents: 3
  - engine (pending)
  - cursor (submitted)    <- Status updated
  - cyrus (pending)

Attempts: 1
  - cursor: https://github.com/recallnet/js-recall/pull/1559
    Status: open
    Opened: Tue Nov 11 2025 17:38:57 GMT-0700 (Mountain Standard Time)
```

### Test Case

- **Issue**: ENG-320 (Drop `uuid` package usage)
- **PR Link**: Found in Comment #0 (newest comment)
- **Agent**: Detected as "cursor" from Comment #1 containing "cursor.com" URL
- **Result**: Successfully created attempt and updated cursor agent status to "submitted"

## Files Modified

- `/Users/andrewhill/Coding/coding-arena/src/lib/linear-sync.ts`

## Verification Commands

```bash
# Test sync (requires DATABASE_URL and LINEAR_API_KEY env vars)
tsx scripts/test-sync.ts

# Check database state
tsx scripts/check-database.ts
```

## Impact

The system can now track PRs submitted by agents through Linear comments, not just through attachments. This captures the real-world workflow where agents like Cursor post PR links in comment bodies.
