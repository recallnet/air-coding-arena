# Cursor Agent Dispatch Investigation Report

## Executive Summary

**Issue**: ENG-901 (Linear ID: ca76c613-cf9d-478c-beaa-ca17f4fc3f04)
**Problem**: Cursor agent was not dispatched, while engine, cyrus, and factory were successfully dispatched
**Root Cause**: Linear user "Cursor" does not exist in the Linear workspace

## Investigation Details

### 1. Database Issue Lookup

- **Status**: PASSED
- **Findings**:
  - Issue found in database with ID: 09ad9188-123f-4651-a075-3221f03c9bf9
  - Linear Key: ENG-901
  - Title: Drop `uuid` package usage for native `crypto` and UUID's (copy)
  - Status: In Progress

### 2. Issue Status Check

- **Status**: PASSED
- **Findings**:
  - Current status: "In Progress"
  - Status is eligible for dispatch (must be "open", "in progress", or "in_progress")
  - This is NOT the root cause

### 3. Agent Configuration Check

- **Status**: PASSED
- **Findings**:
  - AGENTS_CONFIG_JSON is properly set
  - Configuration contains 4 agents: cursor, engine, cyrus, factory
  - Cursor is present in the configuration
  - This is NOT the root cause

### 4. Dispatched Agents Check

- **Status**: FAILED (Cursor missing)
- **Findings**:
  - 3 agents dispatched: engine, cyrus, factory (all "pending")
  - Cursor is NOT in the issue_agents table
  - All agents were dispatched at approximately the same time (14:07:25-26 MST)

### 5. Linear User Lookup

- **Status**: FAILED
- **ROOT CAUSE IDENTIFIED**
- **Findings**:
  - Total Linear users in workspace: 27
  - Linear user "Cursor" NOT FOUND (case-insensitive search)
  - Other agents exist in Linear:
    - factory: 32620278-3ad5-4ca3-b0ab-40adf0f14a74@oauthapp.linear.app
    - cyrus: c03d5b6e-5b75-4c2a-b656-d519cec2fc25@oauthapp.linear.app
    - engine: 19b2fc19-10a3-4502-b030-417149f1fe3e@oauthapp.linear.app
  - Available users include: factory, sanket, ramiro.vazquez, marla, aaron, sara, cyrus, tim, brian, notionai, engine, and 16 others

## Root Cause Analysis

### Primary Root Cause

**Linear user "Cursor" does not exist in the Linear workspace**

The dispatch process failed for Cursor at the user lookup stage. The relevant code in `/Users/andrewhill/Coding/coding-arena/src/lib/agent-dispatch.ts` (lines 150-159):

```typescript
try {
  // Look up Linear user ID for proper @mention
  const userId = await findLinearUserByDisplayName(client, agentName)

  if (!userId) {
    console.warn(
      `Linear user not found for ${agentName}, skipping dispatch`
    )
    continue
  }
  // ... dispatch code ...
}
```

When the user lookup fails, the code:

1. Logs a warning: "Linear user not found for cursor, skipping dispatch"
2. Uses `continue` to skip to the next agent
3. Does NOT throw an error or record the failure
4. Does NOT create a database record for the skipped agent

This explains why:

- engine, cyrus, and factory were successfully dispatched (their Linear users exist)
- Cursor was silently skipped (no Linear user exists)
- No error was thrown (by design - error handling continues with other agents)

### Why Other Checks Passed

1. **Status check**: Issue is "In Progress", which is eligible
2. **Config check**: Cursor is in AGENTS_CONFIG_JSON
3. **Missing agents logic**: Cursor is in config but not in database, so it's correctly identified as "missing"
4. **Error handling**: The code intentionally skips agents when user lookup fails (lines 154-159)

## Verification of Other Agents

Cross-check of successfully dispatched agents:

- **engine**: Linear user EXISTS, dispatched SUCCESS
- **cyrus**: Linear user EXISTS, dispatched SUCCESS
- **factory**: Linear user EXISTS, dispatched SUCCESS
- **cursor**: Linear user NOT FOUND, dispatched FAILED (silently skipped)

## Resolution Required

To fix this issue, one of the following actions must be taken:

### Option 1: Create Linear User (Recommended)

Create a Linear user with displayName "Cursor" (case-insensitive match)

### Option 2: Update Configuration

If Cursor agent should not be dispatched, remove it from AGENTS_CONFIG_JSON:

```json
[
  { "name": "engine", "handle": "@Engine" },
  { "name": "cyrus", "handle": "@Cyrus" },
  { "name": "factory", "handle": "@Factory" }
]
```

### Option 3: Map to Existing User

If Cursor should map to an existing Linear user, update the agent name in AGENTS_CONFIG_JSON to match an existing user's displayName

## Diagnostic Script Location

The diagnostic script used for this investigation is available at:
`/Users/andrewhill/Coding/coding-arena/scripts/diagnose-cursor-dispatch.ts`

To run again:

```bash
npx tsx scripts/diagnose-cursor-dispatch.ts
```

## Timeline of Events

1. ENG-901 created and set to "In Progress"
2. dispatchMissingAgents() called for ENG-901
3. Agent dispatch loop starts:
   - cursor: User lookup fails → skipped with warning
   - engine: User lookup succeeds → dispatched (14:07:25)
   - cyrus: User lookup succeeds → dispatched (14:07:26)
   - factory: User lookup succeeds → dispatched (14:07:26)
4. Function returns 3 agents dispatched (instead of 4)

## Conclusion

This is **NOT** a bug in the dispatch logic. The system is working as designed - it intentionally skips agents when their Linear users cannot be found, allowing other agents to be dispatched successfully. The root cause is environmental: the Linear user "Cursor" needs to be created in the Linear workspace before the Cursor agent can be dispatched.
