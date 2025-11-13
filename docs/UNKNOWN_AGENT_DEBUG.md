# Debugging "unknown" Agent Attribution

## The Problem

Attempts are being created with `agentName='unknown'` when they should be attributed to a specific agent.

## Root Causes

### 1. Branch Naming Convention Not Followed

**Issue**: Our graceful agent extraction (Task 3) expects branches to follow the pattern:
```
{issue-key}--{description}--agent-{name}
Example: ENG-906--drop-uuid--agent-cursor
```

**What Actually Happens**: Agents create branches like:
- `cursor/drop-uuid-eng-906` ❌
- `fix/eng-906` ❌
- `main` ❌

**When this happens**:
1. Attachment webhook can't extract agent from branch
2. Skips attempt creation, triggers `syncIssueFromLinear()`
3. Comment sync must determine agent from thread

### 2. Comment Thread Parent Relationship Missing

**Issue**: `determineAgentOwnershipFromThread()` walks up the parent chain to find @mentions.

**What Can Go Wrong**:
- Linear comment doesn't have `parentId` set correctly
- Agent posts PR link without replying to dispatch comment
- Comment thread structure not preserved by Linear API

**Example from ENG-906**:
```
Comment 1: "@Cursor please work on this issue" (has @mention)
Comment 2: "@Cursor please submit a PR for this fix" (has @mention)
Comment 3: "https://github.com/.../pull/2168" (PR link, NO @mention)
           └─ If parentId is null, can't find parent @mentions
```

### 3. Agent Name Case Sensitivity (FIXED)

**Was**: Agents mentioned as `@Cursor` (capital C) but code looked for `@cursor`
**Status**: ✅ Fixed - code converts both body and agent name to lowercase

## How Comment Sync Works

```typescript
// PHASE 1: Build agent map
for each comment:
  - Extract @mentions from body
  - Store commentAgents[commentId] = [mentions]
  - Store commentParents[commentId] = parentId

// PHASE 2: Extract PR URLs
for each comment with PR URL:
  - Call determineAgentOwnershipFromThread()
    1. Check if PR comment itself has @mention → return it
    2. Walk up parent chain looking for @mentions
    3. If no @mention found in chain → return 'unknown'
```

## Solutions

### Immediate Fix: Auto-Heal Script

Run `npx tsx scripts/fix-unknown-agents.ts` to:
1. Find all attempts with `agentName='unknown'`
2. Check if only one agent was dispatched to the issue → use that
3. Look at Linear comments near PR link for @mentions
4. Update database with correct agent

### Prevention Strategy 1: Improve Agent Detection

Add fallback heuristics to `determineAgentOwnershipFromThread()`:

```typescript
// 1. Check comment itself for @mention ✅ (already done)
// 2. Walk parent chain ✅ (already done)
// 3. NEW: Check temporal proximity
//    - Find @mentions within 5 minutes before PR comment
//    - If only one agent mentioned recently → use that
// 4. NEW: Check issue-level dispatch
//    - If only one agent dispatched to issue → use that
```

### Prevention Strategy 2: Enforce Branch Naming

**Option A**: Document convention clearly in agent instructions

**Option B**: Add branch name validation
- Check PR branch name when attachment webhook fires
- If doesn't match pattern, post Linear comment: "⚠️ Branch should follow pattern: {issue-key}--{desc}--agent-{name}"

**Option C**: Auto-detect from PR metadata
- Use GitHub API to get PR author
- Map GitHub username → Linear agent
- Requires maintaining username mapping

### Prevention Strategy 3: Use GitHub PR Author

When GitHub webhook fires for PR events:
1. Get PR author from GitHub API
2. Map to agent name (if possible)
3. Update attempt if currently 'unknown'

## Monitoring

Add alerts for `agentName='unknown'`:
- Log warning when attempt created with unknown agent
- Track metric: `attempts.unknown_agent_count`
- Alert if > 0 in production

## Testing Improvements Needed

Add tests for:
1. ✅ PR comment without @mention (parent has @mention)
2. ❌ PR comment without @mention AND no parent
3. ❌ PR comment with broken parent chain
4. ❌ Multiple agents dispatched, PR comment ambiguous

## Real Case: ENG-906

**What Happened**:
- Issue: https://linear.app/recall-labs/issue/ENG-906
- Agent: Cursor
- Branch: (probably not following convention)
- Comments:
  1. "@Cursor please work on this issue"
  2. "@Cursor please submit a PR for this fix"
  3. Cursor posts: https://github.com/recallnet/js-recall/pull/2168
- Result: agentName='unknown' in database

**Why**:
- Attachment webhook: branch doesn't have `--agent-cursor` → skips attempt creation
- Comment sync: `determineAgentOwnershipFromThread()` can't find @mention in parent chain
  - Either parentId is null, or parent chain broken
  - Returns 'unknown'

**Fix**:
Run `npx tsx scripts/fix-unknown-agents.ts` to correct this specific case.
