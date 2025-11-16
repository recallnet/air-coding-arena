# Type Architecture: State Machine to Display

**Status:** Active
**Last Updated:** 2025-11-16
**Related Files:**
- `/src/types/state-machine.ts` - Canonical state definitions
- `/src/types/display-status.ts` - Display layer types
- `/src/types/database.ts` - Database types
- `/src/db/schema.ts` - Database schema

---

## Overview

The coding arena uses a **hierarchical type system** to maintain type safety from the database layer through to the UI. This document explains how state machine types flow through the application.

---

## Type Hierarchy

```
┌─────────────────────────────────────┐
│  State Machine Types (Canonical)    │
│  src/types/state-machine.ts         │
│                                      │
│  - AgentStatus                       │
│  - IssueStatus                       │
│  - Transition validation             │
└──────────────┬───────────────────────┘
               │
               ├─────────────────────────────────┐
               │                                 │
               ▼                                 ▼
┌──────────────────────────┐    ┌────────────────────────────┐
│  Database Types          │    │  Display Types             │
│  src/types/database.ts   │    │  src/types/display-status  │
│  src/db/schema.ts        │    │                            │
│                          │    │  - AgentOutcome            │
│  - IssueAgentStatus      │    │  - getAgentOutcome()       │
│  - Extends state machine │    │  - Type-safe mappings      │
│    + dispatch_failed     │    │                            │
└──────────────────────────┘    └────────────────────────────┘
```

---

## Layer 1: State Machine (Canonical Truth)

**File:** `/src/types/state-machine.ts`

The state machine defines the **canonical states** and **valid transitions** for agents and issues.

### AgentStatus

```typescript
export const AgentStatus = {
  PENDING: 'pending',       // Agent assigned but not yet dispatched
  SUBMITTED: 'submitted',   // Agent submitted a PR for review
  ACCEPTED: 'accepted',     // Agent's PR was merged (winner)
  REJECTED: 'rejected',     // Agent's PR was not merged (another won)
  IGNORED: 'ignored'        // Agent assigned but never submitted PR
} as const

export type AgentStatusType = (typeof AgentStatus)[keyof typeof AgentStatus]
```

### IssueStatus

```typescript
export const IssueStatus = {
  OPEN: 'open',                // Issue is open and available
  IN_PROGRESS: 'in_progress',  // At least one PR submitted
  COMPLETED: 'completed',      // Winner selected, issue closed
  CANCELLED: 'cancelled'       // Issue cancelled before completion
} as const

export type IssueStatusType = (typeof IssueStatus)[keyof typeof IssueStatus]
```

### Validation Functions

```typescript
isValidAgentTransition(from: AgentStatusType, to: AgentStatusType): boolean
isValidIssueTransition(from: IssueStatusType, to: IssueStatusType): boolean
```

**Purpose:** Ensure state transitions follow the state machine rules.

---

## Layer 2: Database Types

**File:** `/src/types/database.ts`, `/src/db/schema.ts`

Database types **extend** state machine types with database-specific additions.

### IssueAgentStatus

```typescript
export type IssueAgentStatus =
  | 'pending'
  | 'submitted'
  | 'accepted'
  | 'rejected'
  | 'ignored'
  | 'dispatch_failed'  // Database-specific: dispatch operation failed
```

**Note:** All values except `dispatch_failed` come from `AgentStatus`. This maintains a clear relationship while allowing database-specific states.

### Database Schema

```typescript
// src/db/schema.ts
export const issueAgents = pgTable('issue_agents', {
  // ...
  status: text('status').notNull().default('pending'),
  // Values stored: 'pending', 'submitted', 'accepted', 'rejected', 'ignored', 'dispatch_failed'
})
```

---

## Layer 3: Display Types

**File:** `/src/types/display-status.ts`

Display types provide **user-friendly strings** derived from state machine types.

### AgentOutcome

```typescript
export const AgentOutcome = {
  WON: 'won',           // Display for AgentStatus.ACCEPTED
  LOST: 'lost',         // Display for AgentStatus.REJECTED
  DNF: 'dnf',           // Display for AgentStatus.IGNORED
  SUBMITTED: 'submitted', // Display for AgentStatus.SUBMITTED
  PENDING: 'pending'    // Display for AgentStatus.PENDING
} as const

export type AgentOutcomeType = (typeof AgentOutcome)[keyof typeof AgentOutcome]
```

### Type-Safe Mapping

```typescript
export function getAgentOutcome(status: AgentStatusType): AgentOutcomeType {
  switch (status) {
    case AgentStatus.ACCEPTED:  return AgentOutcome.WON
    case AgentStatus.REJECTED:  return AgentOutcome.LOST
    case AgentStatus.IGNORED:   return AgentOutcome.DNF
    case AgentStatus.SUBMITTED: return AgentOutcome.SUBMITTED
    case AgentStatus.PENDING:   return AgentOutcome.PENDING
  }
}
```

**Benefits:**
- **Compile-time validation** - If state machine changes, TypeScript errors
- **Single source of truth** - Display strings defined once
- **Refactor-safe** - Change display values in one place
- **Type-safe** - No runtime string errors

---

## Data Flow Examples

### Example 1: PR Merge Updates Agent Status

```typescript
// 1. Webhook arrives (GitHub PR merged)
const prStatus = 'merged'

// 2. Update winner logic determines accepted agent
await updateWinner(issueId)

// 3. Database update (uses state machine type)
await db.update(issueAgents)
  .set({ status: AgentStatus.ACCEPTED })  // ✅ Type-safe
  .where(eq(issueAgents.id, agentId))

// 4. Frontend displays outcome (uses display type)
const outcome = getAgentOutcome(agent.status)  // 'won'
```

### Example 2: Agent Stats Query

```sql
-- SQL View: drizzle/manual-migrations/004-update-agent-stats-view-and-indexes.sql
SELECT
  ia.agent_name,
  COUNT(*) FILTER (WHERE ia.status = 'accepted') AS wins,  -- Maps to AgentStatus.ACCEPTED
  COUNT(*) FILTER (WHERE ia.status = 'ignored') AS dnf     -- Maps to AgentStatus.IGNORED
FROM issue_agents ia
WHERE ia.status != 'pending'
GROUP BY ia.agent_name;
```

**Type Flow:**
1. Database stores: `'accepted'`, `'ignored'` (AgentStatus values)
2. SQL view counts: `wins`, `dnf`
3. TypeScript receives: `AgentStats { wins: number, dnf: number }`
4. Frontend displays: "5 wins", "2 DNF"

**Critical:** SQL view uses **string literals** that match `AgentStatus` constants. If state machine changes, SQL must update in sync.

---

## Frontend Usage

### Before (Runtime String Mapping)

```typescript
// ❌ NOT type-safe
function getAgentStatusDisplayText(status: string): string {
  switch (status) {
    case 'accepted': return 'won'
    case 'rejected': return 'lost'
    // Easy to make typos, no compile-time validation
  }
}
```

### After (Type-Safe Mapping)

```typescript
// ✅ Type-safe
import { getAgentOutcome, type AgentStatusType } from '@/types'

function getAgentStatusDisplayText(status: AgentStatusType): AgentOutcomeType {
  return getAgentOutcome(status)
}

// Usage in component
<Badge variant={getStatusVariant(getAgentOutcome(agent.status))}>
  {getAgentOutcome(agent.status)}
</Badge>
```

---

## Badge Variant Mapping

**File:** `/src/app/issues/[id]/page.tsx` (or components)

```typescript
import { AgentOutcome, type AgentOutcomeType } from '@/types'

function getAgentStatusBadgeVariant(outcome: AgentOutcomeType): BadgeVariant {
  switch (outcome) {
    case AgentOutcome.WON:
      return 'success'
    case AgentOutcome.LOST:
      return 'error'
    case AgentOutcome.DNF:
      return 'outline'
    case AgentOutcome.SUBMITTED:
      return 'warning'
    case AgentOutcome.PENDING:
      return 'outline'
  }
}
```

---

## Maintaining Type Consistency

### Rule 1: State Machine is Source of Truth

**Always define new states in state machine first:**

```typescript
// src/types/state-machine.ts
export const AgentStatus = {
  // ...existing states
  NEW_STATE: 'new_state'  // ✅ Add here first
} as const
```

Then update:
1. Database schema migration (if needed)
2. Display mapping in `display-status.ts`
3. SQL views (if aggregating on this state)

### Rule 2: Never Hardcode Status Strings

```typescript
// ❌ BAD
if (agent.status === 'accepted') { ... }

// ✅ GOOD
import { AgentStatus } from '@/types/state-machine'
if (agent.status === AgentStatus.ACCEPTED) { ... }
```

### Rule 3: Use Type Guards for User Input

```typescript
import { isAgentOutcome } from '@/types'

function handleUserFilter(filter: string) {
  if (isAgentOutcome(filter)) {
    // filter is now typed as AgentOutcomeType
    const status = outcomeToStatus(filter)
    // Query database with status
  }
}
```

---

## SQL View Synchronization

**Critical:** SQL views use string literals that must match state machine constants.

### Current SQL View

```sql
-- IMPORTANT: These values MUST match AgentStatus in src/types/state-machine.ts
-- If state machine changes, this view MUST be updated in sync.

CREATE VIEW agent_stats AS
SELECT
  ia.agent_name,
  COUNT(*) FILTER (WHERE ia.status = 'accepted') AS wins,  -- AgentStatus.ACCEPTED
  COUNT(*) FILTER (WHERE ia.status = 'rejected') AS losses, -- AgentStatus.REJECTED
  COUNT(*) FILTER (WHERE ia.status = 'ignored') AS dnf     -- AgentStatus.IGNORED
FROM issue_agents ia
WHERE ia.status != 'pending'  -- AgentStatus.PENDING
GROUP BY ia.agent_name;
```

### Adding a New State

**Example:** Adding `DISQUALIFIED` status

1. **Update State Machine**
   ```typescript
   // src/types/state-machine.ts
   export const AgentStatus = {
     // ...existing
     DISQUALIFIED: 'disqualified'
   } as const
   ```

2. **Update Display Mapping**
   ```typescript
   // src/types/display-status.ts
   export const AgentOutcome = {
     // ...existing
     DISQUALIFIED: 'disqualified'
   } as const

   export function getAgentOutcome(status: AgentStatusType): AgentOutcomeType {
     // ...existing cases
     case AgentStatus.DISQUALIFIED: return AgentOutcome.DISQUALIFIED
   }
   ```

3. **Update SQL View (if needed)**
   ```sql
   -- Create migration: drizzle/manual-migrations/005-add-disqualified-to-agent-stats.sql
   DROP VIEW agent_stats;
   CREATE VIEW agent_stats AS
   SELECT
     ia.agent_name,
     -- ...existing columns
     COUNT(*) FILTER (WHERE ia.status = 'disqualified') AS disqualified
   FROM issue_agents ia
   WHERE ia.status != 'pending'
   GROUP BY ia.agent_name;
   ```

4. **Update Database Type**
   ```typescript
   // src/types/database.ts
   export type IssueAgentStatus =
     | 'pending'
     | 'submitted'
     | 'accepted'
     | 'rejected'
     | 'ignored'
     | 'disqualified'  // NEW
     | 'dispatch_failed'
   ```

5. **Update AgentStats Type (if aggregating)**
   ```typescript
   // src/types/database.ts
   export type AgentStats = {
     // ...existing
     disqualified: number  // NEW
   }
   ```

---

## Testing Type Safety

### Compile-Time Validation

```typescript
// This will fail to compile if state machine changes:
const outcome: AgentOutcomeType = getAgentOutcome(AgentStatus.ACCEPTED)
```

### Runtime Validation

```typescript
// Validate database values match state machine
import { AgentStatus } from '@/types/state-machine'

function validateAgentStatus(status: string): AgentStatusType {
  if (!Object.values(AgentStatus).includes(status as AgentStatusType)) {
    throw new Error(`Invalid agent status: ${status}`)
  }
  return status as AgentStatusType
}
```

---

## Migration Checklist

When adding or changing a state:

- [ ] Update `src/types/state-machine.ts` with new state constant
- [ ] Update `src/types/display-status.ts` with display mapping
- [ ] Update `src/types/database.ts` IssueAgentStatus if needed
- [ ] Create database migration if schema changes
- [ ] Update SQL views if aggregating on this state
- [ ] Update AgentStats type if adding new metric
- [ ] Add transition validation in state machine
- [ ] Update documentation (this file)
- [ ] Add tests for new state transitions

---

## Files Reference

**State Machine:**
- `/src/types/state-machine.ts` - Canonical state definitions

**Display Layer:**
- `/src/types/display-status.ts` - User-facing display types

**Database:**
- `/src/types/database.ts` - Database type definitions
- `/src/db/schema.ts` - Drizzle schema definitions

**SQL Views:**
- `/drizzle/manual-migrations/004-update-agent-stats-view-and-indexes.sql` - agent_stats view

**Frontend Usage:**
- `/src/app/issues/[id]/page.tsx` - Badge display logic
- `/src/components/AgentAvatar.tsx` - Status indicator
- `/src/components/IssueActivityTable.tsx` - Table display

---

## Benefits of This Architecture

1. **Type Safety** - Compile-time validation of status values
2. **Single Source of Truth** - State machine defines canonical states
3. **Refactor-Safe** - Change display strings without breaking code
4. **Self-Documenting** - Types explain the domain model
5. **Maintainable** - Clear hierarchy makes changes predictable
6. **Testable** - Type guards enable runtime validation

---

**End of Document**
