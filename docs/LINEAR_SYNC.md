# Linear Synchronization System

## Overview

The Linear sync system (`src/lib/linear-sync.ts`) synchronizes issue state from Linear to the Arena Dashboard database. It tracks agent assignments and GitHub PR submissions by processing Linear API data.

## Architecture

### Main Entry Point: `syncIssueFromLinear(linearIssueId)`

Fetches issue data from Linear API and syncs two types of information:
1. **Comments** → Agent mentions and PR links
2. **Attachments** → GitHub PR attachments (if any exist)

```typescript
export async function syncIssueFromLinear(linearIssueId: string): Promise<void>
```

## Comment Processing

### Two-Phase Architecture

The `syncComments` function uses a two-phase approach to handle the complexity of extracting both agent mentions and PR links from comment bodies:

#### Phase 1: Build Agent Mention Map
- Iterates through all comments
- Searches for agent handle mentions (`@cursor`, `@engine`, `@cyrus`, `@claude`)
- Creates/updates `issue_agents` table entries with "pending" status
- Builds a map: `commentIndex → [agentNames]` for phase 2

#### Phase 2: Extract PR Links
- Iterates through comments again with full agent context available
- Extracts GitHub PR URLs using regex: `/github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/g`
- Determines PR ownership using intelligent agent detection (see below)
- Creates `attempts` table entries
- Updates agent status from "pending" to "submitted"

### Why Two Phases?

**Problem**: Comments can contain PR links without explicit agent mentions. We need context from surrounding comments to determine which agent submitted the PR.

**Solution**: Build complete agent mention map first, then use it during PR extraction to search forward/backward for context.

## Agent Detection Algorithm

When a GitHub PR URL is found in a comment, the system determines which agent submitted it using this fallback chain:

### 1. Same Comment Check
If agent is mentioned in the same comment as the PR link → use that agent

### 2. Body Analysis
Analyze comment body for agent-specific patterns:
- `cursor` if body contains "cursor.com" URLs
- `engine` if body contains "engine" mentions
- `cyrus` if body contains "cyrus" mentions
- `claude` if body contains "claude" mentions

### 3. Search Nearby Older Comments (Forward in Array)
Comments are in reverse chronological order (newest first), so searching forward = going back in time.

Search up to 6 older comments:
- First try body analysis on each comment
- Then check for explicit agent mentions
- Stop on first match

**Rationale**: Agent assignment comments typically appear before PR submission comments

### 4. Search Nearby Newer Comments (Backward in Array)
If still no match, search up to 3 newer comments (forward in time):
- First try body analysis
- Then check for explicit mentions
- Stop on first match

**Rationale**: Sometimes PR appears before explicit confirmation comment

### 5. Fallback to "unknown"
If no agent can be determined, mark as "unknown"

## Data Flow

```
Linear API
   ↓
syncIssueFromLinear(linearIssueId)
   ├─→ Fetch issue, comments, attachments
   ├─→ syncComments(issueId, comments)
   │    ├─→ Phase 1: Build agent mention map
   │    │    └─→ Insert/update issue_agents (status: "pending")
   │    │
   │    └─→ Phase 2: Extract PR links
   │         ├─→ Find GitHub URLs in comment bodies
   │         ├─→ Detect agent ownership
   │         ├─→ Insert/update attempts table
   │         └─→ Update agent status to "submitted"
   │
   └─→ syncAttachments(issueId, attachments)
        └─→ Process any GitHub PR attachments
```

## Database Updates

### `issue_agents` Table
- **Created during**: Phase 1 of comment processing
- **Fields**: `issueId`, `agentName`, `status`, `triggeredAt`
- **Status transitions**:
  - `pending` → Agent mentioned but no PR found yet
  - `submitted` → PR link detected in comments
  - `accepted` → PR merged (updated by webhook)
  - `rejected` → PR closed without merge (updated by webhook)

### `attempts` Table
- **Created during**: Phase 2 of comment processing OR attachment processing
- **Fields**: `issueId`, `agentName`, `repo`, `prNumber`, `prUrl`, `openedAt`, `status`, etc.
- **Conflict handling**: Upsert on `(issueId, agentName, prNumber)` to avoid duplicates
- **Source tracking**:
  - `sourceAttachmentId: null` → Extracted from comment body
  - `sourceAttachmentId: string` → Came from formal attachment

## Edge Cases Handled

### Multiple PRs in One Comment
Regex uses global flag `/g` and `while` loop to extract all PR URLs

### Duplicate PR Detection
Upsert logic prevents duplicate attempts:
```typescript
.onConflictDoUpdate({
  target: [attempts.issueId, attempts.agentName, attempts.prNumber],
  set: { prUrl, status: 'open' },
})
```

### Unknown Agent Assignment
If agent cannot be determined, creates attempt with `agentName: 'unknown'` but does NOT update agent status

### Comments Without Agent Context
Searches up to 6 older + 3 newer comments to find context before giving up

## Real-World Example: ENG-320

**Scenario**: Three agents (@cursor, @engine, @cyrus) were assigned to ENG-320. Cursor submitted a PR.

**Linear Comments** (reverse chronological):
1. Cursor bot: "[Replace uuid package...](https://cursor.com/...)" + "github.com/recallnet/js-recall/pull/1559"
2. Link reference comment
3. Cyrus assignment: "@cyrus can you create a PR?"
4. Engine response
5. Engine assignment: "@engine can you create a PR?"
6. Cursor assignment: "@cursor can you create a PR?"
7. Original cyrus assignment

**Sync Result**:
- Phase 1: Created 3 `issue_agents` entries (cursor, engine, cyrus) all with status "pending"
- Phase 2:
  - Found PR URL in comment #1
  - Detected agent "cursor" from "cursor.com" in same comment body
  - Created `attempts` entry for cursor
  - Updated cursor's status to "submitted"
  - engine and cyrus remain "pending"

## Testing

Run manual sync:
```bash
DATABASE_URL='...' LINEAR_API_KEY='...' tsx scripts/test-sync.ts
```

Check database state:
```bash
DATABASE_URL='...' tsx scripts/check-database.ts
```

Debug sync with detailed output:
```bash
LINEAR_API_KEY='...' tsx scripts/debug-sync.ts
```

## Future Enhancements

### Potential Improvements
1. **PR Status Updates**: Parse attachment subtitles for "merged" / "closed" status
2. **Commit Count Extraction**: Use GitHub API to get actual commit count
3. **Branch Name Detection**: Extract branch names from PR URLs
4. **Better Agent Detection**: Machine learning model trained on comment patterns
5. **Webhook Integration**: Real-time sync triggered by Linear webhooks instead of polling

### Known Limitations
1. Relies on text parsing → fragile if comment format changes
2. "Unknown" agent assignment if comments lack context
3. Initial PR status always "open" → requires webhook updates for merge/close events
4. No historical PR state tracking (can't detect if PR was previously closed/reopened)

## Related Files

- `src/lib/linear-sync.ts` - Main sync logic
- `src/app/api/linear/webhook/route.ts` - Webhook handler for Linear events
- `src/db/schema.ts` - Database schema definitions
- `scripts/test-sync.ts` - Manual sync testing script
- `scripts/check-database.ts` - Database state inspection
- `scripts/debug-sync.ts` - Detailed sync debugging
