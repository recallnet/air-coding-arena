# Investigation Report: ENG-901 and PR #1561 "Unknown" Agent Attribution

**Date**: 2025-11-12
**Issue**: ENG-901 (Linear ID: `ca76c613-cf9d-478c-beaa-ca17f4fc3f04`)
**Problem**: PR #1561 (https://github.com/recallnet/js-recall/pull/1561) is being marked as "unknown" agent instead of "engine"

---

## Executive Summary

**ROOT CAUSE IDENTIFIED**: The agent mention detection code in `/Users/andrewhill/Coding/coding-arena/src/lib/linear-sync.ts` line 224 is checking if the comment body includes the substring `@engine`, but Linear's actual mention format is `@[engine](user-id)`, which does **NOT** contain the substring `@engine` due to the `[` character between `@` and the agent name.

**Impact**: All agent mentions in Linear comments using the native mention format (`@[agent](user-id)`) are not being detected, causing parent chain detection to fail and PRs to be attributed to "unknown" instead of the correct agent.

---

## Investigation Details

### 1. Linear Issue Structure

**Issue**: ENG-901 - "Drop `uuid` package usage for native `crypto` and UUID's (copy)"

**Comments**: 20 total comments

**PR #1561 References**: Found in 3 comments:

1. `ba7ffed8-32b3-4d13-be50-d015c765350e` (created 2025-11-12 14:24:47 MST)
2. `e574b9d5-eb06-4877-9c61-cfff42ac2afb` (created 2025-11-12 15:32:53 MST)
3. `ed9dd015-3573-433a-ac81-7c7678cbfa37` (created 2025-11-12 15:35:48 MST)

### 2. Parent Relationship Verification

All three PR #1561 comments have valid parent relationships:

**Comment 1** (`ba7ffed8-32b3-4d13-be50-d015c765350e`):

- Parent ID: `f17ba463-ca10-41d8-b6a4-322f65806f16`
- Parent body: `@[engine](039e79a0-9e12-4000-9359-72957e5b02e2) please work on this issue.`
- Parent created: 2025-11-12 14:07:25 MST

**Comment 2** (`e574b9d5-eb06-4877-9c61-cfff42ac2afb`):

- Parent ID: `e1371eab-0dd7-47e8-9fc4-f7b074a20f47`
- Parent body: `@[engine](039e79a0-9e12-4000-9359-72957e5b02e2) please work on this issue.`
- Parent created: 2025-11-12 15:32:22 MST

**Comment 3** (`ed9dd015-3573-433a-ac81-7c7678cbfa37`):

- Parent ID: `cd553266-23a5-4d95-ab74-ddbaa98ff55f`
- Parent body: `@[engine](039e79a0-9e12-4000-9359-72957e5b02e2) please work on this issue.`
- Parent created: 2025-11-12 15:35:18 MST

**Conclusion**: Parent relationships ARE working correctly in the Linear API. The `.parent` property on comments properly returns the parent comment with full metadata including body text.

### 3. Linear Mention Format

Linear uses a special format for @mentions that includes the user ID:

**Format**: `@[agent-name](linear-user-id)`

**Examples from ENG-901**:

- `@[engine](039e79a0-9e12-4000-9359-72957e5b02e2)`
- `@[cursor](8f02e788-7c5b-47ec-8a35-b907d7a05dbc)`
- `@[cyrus](69fb2b92-e5c6-4899-8cad-8f3aad74d7b3)`
- `@[factory](11b25fbc-ea21-487f-ad5e-b3fb092c3397)`

This format is different from a simple `@agent` mention.

### 4. Detection Code Analysis

**File**: `/Users/andrewhill/Coding/coding-arena/src/lib/linear-sync.ts`
**Line**: 224

**Current code**:

```typescript
for (const handle of getAgentHandles()) {
  if (body.toLowerCase().includes(handle.toLowerCase())) {
    const agentName = handle.substring(1).toLowerCase() // Remove @ prefix
    mentionedAgents.push(agentName)
    // ... insert into database
  }
}
```

**Problem**: `getAgentHandles()` returns values like `@engine`, `@cursor`, etc., but the Linear comment bodies contain `@[engine](...)`, `@[cursor](...)`, etc.

### 5. String Matching Test

Testing the actual string matching:

```javascript
const text =
  '@[engine](039e79a0-9e12-4000-9359-72957e5b02e2) please work on this issue'

text.includes('@engine') // false ❌
text.includes('@[engine]') // true  ✅
text.includes('engine') // true  ✅
```

**The bug**: Because `@[engine]` does NOT contain the substring `@engine` (the `[` character breaks the match), the detection code at line 224 never finds agent mentions in Linear comments.

### 6. Impact on Parent Chain Detection

The `determineAgentOwnershipFromThread()` function (line 150-187) walks up the parent chain looking for agent mentions:

```typescript
function determineAgentOwnershipFromThread(
  commentId: string,
  mentionedAgents: string[],
  body: string,
  commentAgents: Map<string, string[]>,
  commentParents: Map<string, string | null>
): string {
  // Walk up parent chain
  let currentId: string | null = commentId
  while (currentId) {
    const agents = commentAgents.get(currentId) ?? []
    if (agents.length > 0 && agents[0]) {
      return agents[0] // Found agent in parent
    }
    currentId = commentParents.get(currentId) ?? null
  }
  return 'unknown' // No agent found
}
```

Because the `commentAgents` Map is empty (no agents were detected in the first pass due to the string matching bug), the function always returns `'unknown'`.

---

## Why Parent Detection Works But Agent Attribution Doesn't

1. **Parent relationships ARE working**: The Linear SDK properly returns parent comments via `await comment.parent`
2. **Parent chain walking IS working**: The code correctly walks up the chain using parentId
3. **Agent detection IS NOT working**: The code fails to detect agent mentions because it's looking for `@engine` but Linear uses `@[engine](...)`

---

## Solution

The fix needs to be in `/Users/andrewhill/Coding/coding-arena/src/lib/linear-sync.ts` at line 224.

**Current approach** (checking for exact handle):

```typescript
if (body.toLowerCase().includes(handle.toLowerCase())) {
```

**Fixed approach** (option 1 - check for agent name only):

```typescript
const agentName = handle.substring(1).toLowerCase() // e.g., "engine"
if (body.toLowerCase().includes(agentName)) {
```

**Fixed approach** (option 2 - regex for Linear format):

```typescript
const agentName = handle.substring(1).toLowerCase() // e.g., "engine"
const linearMentionRegex = new RegExp(`@\\[${agentName}\\]\\([^)]+\\)`, 'i')
if (linearMentionRegex.test(body)) {
```

**Fixed approach** (option 3 - flexible matching):

```typescript
const agentName = handle.substring(1).toLowerCase() // e.g., "engine"
// Match either @engine or @[engine](...)
if (body.toLowerCase().includes(`@${agentName}`) ||
    body.toLowerCase().includes(`@[${agentName}]`)) {
```

### Recommendation

Use **Option 3** (flexible matching) to support both simple mentions (`@engine`) and Linear's native format (`@[engine](...)`). This provides the most robust detection.

---

## Expected Behavior After Fix

1. Agent mentions in Linear comments will be detected correctly
2. The `commentAgents` Map will be properly populated
3. Parent chain walking will find agent mentions in parent comments
4. PR #1561 will be attributed to "engine" instead of "unknown"
5. All future PRs posted in reply threads will inherit the correct agent from parent mentions

---

## Testing Plan

After implementing the fix:

1. Re-sync ENG-901: `tsx scripts/run-sync.ts` (if such a script exists)
2. Query database for PR #1561:
   ```sql
   SELECT * FROM attempts WHERE pr_number = 1561;
   ```
3. Verify agent_name is "engine" instead of "unknown"
4. Check that other agents (cursor, cyrus, factory) remain in pending state
5. Verify engine status is "submitted"

---

## Additional Notes

### Agent Handles in Use

From code inspection and Linear data, the following agents are in use:

- `engine` (Linear user ID: `039e79a0-9e12-4000-9359-72957e5b02e2`)
- `cursor` (Linear user ID: `8f02e788-7c5b-47ec-8a35-b907d7a05dbc`)
- `cyrus` (Linear user ID: `69fb2b92-e5c6-4899-8cad-8f3aad74d7b3`)
- `factory` (Linear user ID: `11b25fbc-ea21-487f-ad5e-b3fb092c3397`)

All use the `@[agent](user-id)` format in Linear comments.

### Parent API Findings

The parent relationship API is working correctly:

- `comment.parent` is an async getter that returns `Promise<Comment | null>`
- `comment.parentId` is NOT exposed (confirmed by previous investigation)
- Must use `await comment.parent` then access `.id` property
- This is already implemented correctly in the code (line 218-220)

### False Positive Risk

Using Option 1 (checking for agent name only without `@`) could cause false positives if agent names appear in regular text. However, given agent names like "engine", "cursor", "cyrus", "factory", the risk is acceptable:

- "engine" could appear in technical text but unlikely in Linear comments
- "cursor" very unlikely outside of @mentions
- "cyrus" is a proper name, unlikely to appear
- "factory" could appear but unlikely in PR/issue context

Option 3 (flexible matching with `@`) is safer and recommended.

---

## Files Referenced

- `/Users/andrewhill/Coding/coding-arena/src/lib/linear-sync.ts` (lines 150-187, 201-244)
- `/Users/andrewhill/Coding/coding-arena/CURSOR_DISPATCH_INVESTIGATION_REPORT.md`
- `/Users/andrewhill/Coding/coding-arena/scripts/investigate-eng901.ts` (investigation script)
- `/Users/andrewhill/Coding/coding-arena/linear-sdk-findings.md`

---

## Conclusion

The issue is NOT with parent detection—that works perfectly. The issue is with agent mention detection using a string matching approach that doesn't account for Linear's `@[agent](user-id)` mention format. A simple fix to check for the agent name with flexible matching will resolve the attribution problem for PR #1561 and all future PRs in comment threads.
