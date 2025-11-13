# Investigation Report: ENG-903 and PR #1562 Attribution Issue

## Executive Summary

PR #1562 (https://github.com/recallnet/js-recall/pull/1562) is marked as "unknown" agent in the database because the parent comment detection is working correctly, but it's finding **Linear user mentions** (`@[engine](user-id)`) instead of **plain text agent handles** (`@Engine`).

## Issue Details

- **Issue**: ENG-903 - Drop `uuid` package usage for native `crypto` and UUID's (copy)
- **Linear ID**: f388dc49-a5f7-4c9f-82c8-d5c049173b40
- **Issue URL**: https://linear.app/recall-labs/issue/ENG-903/drop-uuid-package-usage-for-native-crypto-and-uuids-copy
- **PR**: #1562
- **Current Attribution**: unknown
- **Expected Attribution**: engine (or possibly cursor/factory/cyrus)

## Root Cause Analysis

### 1. Parent Relationship Detection Works Correctly

The Linear SDK's `.parent` property is functioning properly. The investigation revealed:

- 3 comments mention PR #1562
- All 3 comments have parent relationships
- Parent chain traversal works as expected

**Example Comment Structure:**

```
Comment 5cabffaf (PR #1562 mention)
  └─ Parent 465d230f: "@[engine](039e79a0-9e12-4000-9359-72957e5b02e2) please work on this issue."
```

### 2. Linear Mention Format vs. Agent Handle Format

**The Problem:** Two different mention formats are being used:

#### Linear User Mentions (What's in the comments)

```
@[engine](039e79a0-9e12-4000-9359-72957e5b02e2)
@[cursor](8f02e788-7c5b-47ec-8a35-b907d7a05dbc)
@[cyrus](69fb2b92-e5c6-4899-8cad-8f3aad74d7b3)
@[factory](11b25fbc-ea21-487f-ad5e-b3fb092c3397)
```

Format: `@[username](user-id)` - This is Linear's native user mention syntax

#### Agent Handles (What the code looks for)

```
@Cursor
@Engine
@Cyrus
@Factory
```

Format: `@Handle` - Plain text handles defined in agent configuration

### 3. Code Behavior

In `/Users/andrewhill/Coding/coding-arena/src/lib/linear-sync.ts`, the `syncComments` function:

```typescript
// Line 223-240
for (const handle of getAgentHandles()) {
  if (body.toLowerCase().includes(handle.toLowerCase())) {
    const agentName = handle.substring(1).toLowerCase() // Remove @ prefix
    mentionedAgents.push(agentName)
    // ... insert into database
  }
}
```

**What it looks for:** Plain text like `@cursor`, `@engine`, `@aider`

**What it finds in ENG-903:** `@[engine](039e79a0-9e12-4000-9359-72957e5b02e2)`

**Result:** No match, because the string match fails:

- `@engine` ≠ `@[engine](039e79a0-9e12-4000-9359-72957e5b02e2)`

### 4. Agent Configuration

From `/Users/andrewhill/Coding/coding-arena/src/lib/agent-config.ts`:

```typescript
const DEFAULT_AGENTS: AgentConfig[] = [
  { name: 'cursor', handle: '@Cursor' },
  { name: 'engine', handle: '@Engine' },
  { name: 'cyrus', handle: '@Cyrus' },
  { name: 'factory', handle: '@Factory' },
]
```

The system expects plain text handles but receives Linear's structured mention format.

## Comment Analysis for ENG-903

### All Comments with Mentions

The issue has 21 total comments, including multiple agent dispatch attempts:

| Comment Time                  | User Mention | Format                     |
| ----------------------------- | ------------ | -------------------------- |
| 2025-11-12T21:37:32           | cursor       | `@[cursor](8f02e788-...)`  |
| 2025-11-12T21:37:32           | engine       | `@[engine](039e79a0-...)`  |
| 2025-11-12T21:37:34           | cyrus        | `@[cyrus](69fb2b92-...)`   |
| 2025-11-12T21:37:34           | factory      | `@[factory](11b25fbc-...)` |
| (repeated at 22:32 and 22:35) |              |                            |

### PR #1562 Mentions

Three comments mention PR #1562:

1. **Comment 5cabffaf** (2025-11-12T21:54:05)
   - Parent: `465d230f` - "@[engine](...) please work on this issue."
   - Should be attributed to: **engine**

2. **Comment 65cecd67** (2025-11-12T22:32:43)
   - Parent: `c876b177` - "@[engine](...) please work on this issue."
   - Should be attributed to: **engine**

3. **Comment 668ae32b** (2025-11-12T22:35:44)
   - Parent: `caca3a47` - "@[engine](...) please work on this issue."
   - Should be attributed to: **engine**

**All three should be attributed to "engine" based on parent relationships.**

## Database State

```sql
SELECT * FROM attempts WHERE pr_number = 1562;
```

| Field      | Value                                            |
| ---------- | ------------------------------------------------ |
| id         | dbe8353c-1bae-47dc-b9af-72cfe6df919b             |
| issue_id   | 2f4ef7d2-3339-4b01-8357-172ed7a98b5a             |
| agent_name | **unknown** ← Problem                            |
| pr_number  | 1562                                             |
| pr_url     | https://github.com/recallnet/js-recall/pull/1562 |
| status     | open                                             |
| opened_at  | 2025-11-12T21:54:05                              |

## Why Parent Detection Isn't Working

The parent detection IS working - it's correctly finding parent comments. The issue is:

1. ✅ Parent relationship detected correctly
2. ✅ Parent comment retrieved successfully
3. ❌ **Agent extraction fails** because:
   - Parent contains: `@[engine](user-id)` (Linear mention)
   - Code searches for: `@engine` (plain text)
   - String match fails: `"@engine"` not found in `"@[engine](039e79a0-...)"`

## Solutions

### Option 1: Extract Agent from Linear Mentions (Recommended)

Modify the agent detection to parse Linear's mention format:

```typescript
// Add this function to linear-sync.ts
function extractAgentFromLinearMention(body: string): string[] {
  const agents: string[] = []
  const mentionRegex = /@\[([^\]]+)\]\([^)]+\)/g
  let match: RegExpExecArray | null

  const configuredAgents = getAgentNames() // ['cursor', 'engine', 'cyrus', 'factory']

  while ((match = mentionRegex.exec(body)) !== null) {
    const mentionedName = match[1]?.toLowerCase()
    if (mentionedName && configuredAgents.includes(mentionedName)) {
      agents.push(mentionedName)
    }
  }

  return agents
}

// Update syncComments to check both formats
const mentionedAgents: string[] = []

// Check for plain text handles (existing behavior)
for (const handle of getAgentHandles()) {
  if (body.toLowerCase().includes(handle.toLowerCase())) {
    const agentName = handle.substring(1).toLowerCase()
    mentionedAgents.push(agentName)
  }
}

// Also check for Linear mentions (NEW)
const linearMentions = extractAgentFromLinearMention(body)
for (const agent of linearMentions) {
  if (!mentionedAgents.includes(agent)) {
    mentionedAgents.push(agent)
  }
}
```

### Option 2: Use Plain Text Handles in Linear

Train users to use plain text handles in Linear comments instead of @-mentioning users:

```
Bad:  @[engine](user-id) please work on this
Good: @Engine please work on this
```

**Drawback:** Loses Linear's native notification system

### Option 3: Hybrid Approach

Support both formats:

1. Parse Linear mentions for agent attribution
2. Also support plain text handles for backward compatibility
3. Document that either format works

## Recommendations

1. **Immediate Fix**: Implement Option 1 (extract agent from Linear mentions)
2. **Update Documentation**: Document that Linear user mentions work for agent attribution
3. **Add Tests**: Add test cases for Linear mention format
4. **Backfill**: Re-sync ENG-903 to correct PR #1562 attribution to "engine"

## Test Cases to Add

```typescript
describe('Linear mention extraction', () => {
  it('should extract agent from Linear user mention', () => {
    const body =
      '@[engine](039e79a0-9e12-4000-9359-72957e5b02e2) please work on this'
    const agents = extractAgentFromLinearMention(body)
    expect(agents).toEqual(['engine'])
  })

  it('should extract multiple agents', () => {
    const body = '@[cursor](user-1) and @[engine](user-2) please review'
    const agents = extractAgentFromLinearMention(body)
    expect(agents).toEqual(['cursor', 'engine'])
  })

  it('should ignore non-configured agents', () => {
    const body = '@[randomuser](user-id) please help'
    const agents = extractAgentFromLinearMention(body)
    expect(agents).toEqual([])
  })
})
```

## Linear User Details

The "@engine" mention resolves to:

- **Name**: Engine
- **Display Name**: engine
- **Email**: 19b2fc19-10a3-4502-b030-417149f1fe3e@oauthapp.linear.app
- **User ID**: 039e79a0-9e12-4000-9359-72957e5b02e2
- **Active**: true
- **Type**: Regular Linear user (not a bot)

This appears to be a Linear account representing the "Engine" AI agent.

## Conclusion

**The parent relationship detection is working correctly.** The issue is that:

1. Linear comments use structured user mentions: `@[username](user-id)`
2. The code looks for plain text handles: `@username`
3. These don't match, causing attribution to fail
4. The correct attribution for PR #1562 should be **"engine"** based on the parent comment

**Action Required:** Update the agent detection logic to parse Linear's mention format in addition to plain text handles.
