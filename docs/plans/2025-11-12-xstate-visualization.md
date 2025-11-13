# XState State Machine Visualization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Date:** 2025-11-12
**Status:** 📋 Planning
**Priority:** MEDIUM
**Complexity:** Low

**Goal:** Generate auto-updating Mermaid state machine diagrams from XState machines in CI, making the system easier to understand for coding agents and humans.

**Architecture:** Define arena state machines as XState machines in TypeScript, use @xstate/graph to extract graph structure, convert to Mermaid format, and auto-generate documentation in CI/build process.

**Tech Stack:** XState v5, @xstate/graph, TypeScript 5.0+, Mermaid diagrams, eslint-plugin-xstate

---

## Code Quality & Linting

**eslint-plugin-xstate** provides 18 rules - we configure ALL rules as **errors** (not warnings).

**Zero-tolerance policy:** If it's in the config, it must be followed. No warnings.

### Critical Rules (MUST enforce - errors)
- **no-infinite-loop**: Detects infinite loops from eventless transitions
- **no-imperative-action**: Prevents misuse of action creators
- **no-async-guard**: Catches async guard functions (not allowed in XState)
- **no-invalid-transition-props**: Validates transition object properties
- **no-invalid-state-props**: Validates state node properties
- **invoke-usage**: Ensures proper service invocation
- **entry-exit-action**: Validates entry/exit action declarations
- **no-misplaced-on-transition**: Flags invalid transition declarations
- **no-ondone-outside-compound-state**: Restricts onDone to appropriate state types
- **no-invalid-conditional-action**: Validates `choose` action syntax

### Style & Consistency Rules (enforce as errors)
- **event-names**: Enforce SCREAMING_SNAKE_CASE for events (e.g., `PR_SUBMITTED`)
- **state-names**: Enforce camelCase for states (e.g., `inProgress`)
- **no-inline-implementation**: Extract handlers into machine options (keeps code organized)
- **prefer-always**: Use `always` syntax for eventless transitions (clearer intent)

### Optional Rules (not enforced)
- **prefer-predictable-action-arguments**: Adds complexity, skip for now
- **system-id**: Not needed for our use case (no complex actor systems yet)
- **spawn-usage**: XState v4 only, we use v5

**Why All Errors, No Warnings:**
- Warnings get ignored → clutter output → no value
- If a rule matters, enforce it
- If it doesn't matter, don't enable it
- Our project has `--max-warnings 0` policy already

---

## Executive Summary

**Current State:**
- Well-documented state machine in `/docs/arena-state-machine.md` (450 lines)
- State machine is **partially implemented** - scattered across multiple files
- No single source of truth - documentation can drift from implementation
- Critical gaps: issue state transitions, agent state completion, validation not enforced

**Proposed Solution:**
- Model arena state machines as XState machines (TypeScript)
- Generate Mermaid diagrams automatically in CI from the machine definitions
- Diagrams stay in sync with implementation (code is the source of truth)
- Enables future: state machine enforcement, testing, visual debugging

**Key Benefits:**
1. **Code = Docs**: Diagrams auto-generated from TypeScript, never out of sync
2. **Type Safety**: XState v5 provides excellent TypeScript inference
3. **Testing**: Can use `@xstate/graph` to generate test paths
4. **CI Integration**: Diagrams regenerate on every build/commit
5. **Future Proof**: Foundation for enforcing state machine, visual debugging with Stately Inspector

**Effort Estimate:** 2-3 days (16-24 hours)

---

## Value Proposition Analysis

### ✅ High Value:

1. **Documentation Never Out of Sync**
   - Current: Manual Mermaid diagrams in markdown (can drift)
   - Future: Generated from code (always accurate)
   - Impact: Coding agents can trust state machine docs

2. **Foundation for State Machine Enforcement**
   - Current: State validation functions exist but never used
   - Future: XState provides runtime state machine enforcement
   - Impact: Prevents invalid state transitions, ensures data integrity

3. **Comprehensive Test Coverage**
   - Current: Manual test cases
   - Future: Use `getShortestPaths()` to generate all state paths
   - Impact: Catch edge cases, 100% transition coverage

4. **Visual Debugging Capability**
   - Current: console.log debugging
   - Future: Stately Inspector shows real-time state
   - Impact: Faster debugging, better understanding

5. **Clear System Model**
   - Current: State logic scattered across 7+ files
   - Future: Single machine definition per state machine
   - Impact: New developers understand system quickly

### ⚠️ Medium Value:

6. **Easier Onboarding**
   - Visual diagrams help new developers
   - State machine shows the "big picture"

7. **Gap Detection**
   - Machine definition makes missing transitions obvious
   - Compiler errors if state is invalid

### ⚠️ Trade-offs:

1. **Learning Curve**: Team needs to learn XState (well-documented, but new)
2. **Migration Effort**: Convert existing scattered logic to centralized machines
3. **Bundle Size**: XState adds ~25KB gzipped (acceptable for our use case)

---

## Feasibility Analysis

### ✅ Highly Feasible:

1. **@xstate/graph is production-ready**
   - Actively maintained (last publish ~3 months ago)
   - Part of official XState ecosystem
   - Well-documented

2. **Simple Mermaid conversion**
   - 50-100 lines of TypeScript to convert graph → Mermaid
   - Research agents found working examples
   - No complex dependencies

3. **CI Integration is straightforward**
   - Add script to generate diagrams
   - Run in `npm run build` or pre-commit hook
   - Write to `docs/diagrams/`

4. **Our state machines are simple**
   - Issue: 4 states, 4 transitions (2/10 complexity)
   - Agent: 5 states, 6 transitions (5/10 complexity)
   - Overall: 6/10 complexity
   - XState handles far more complex scenarios

5. **TypeScript 5.0+ already in use**
   - Project uses TypeScript 5.6.3
   - XState v5 requires TS 5.0+ ✅

### ⚠️ Moderate Concerns:

1. **Not a Direct Replacement**
   - XState machines won't automatically fix missing transitions
   - We still need to wire up state updates in webhooks/queries
   - Benefit: Makes gaps obvious, provides enforcement foundation

2. **Two-Phase Implementation**
   - Phase 1: Define machines, generate diagrams (immediate value)
   - Phase 2: Enforce machines in runtime (future work)
   - Trade-off: Partial value upfront, but low risk

### ❌ Low Risk:

1. **Next.js App Router Complexity**
   - Research found: XState works fine with React Server Components
   - We don't need client-side state management yet (Phase 2)
   - Phase 1 is purely build-time (no runtime concerns)

---

## Maintenance Assessment

### ✅ Easy to Maintain:

1. **Automatic Diagram Updates**
   - Change machine → diagram regenerates
   - Zero manual maintenance for docs

2. **Type Safety Prevents Errors**
   - TypeScript catches invalid states/transitions at compile time
   - No runtime surprises

3. **Single Source of Truth**
   - Machine definition lives in one file per state machine
   - No hunting through 7 files to understand state logic

4. **Standard Tooling**
   - XState is well-known in TypeScript ecosystem
   - Large community, good documentation
   - Easy to find developers familiar with it

### ⚠️ Requires Discipline:

1. **Must Update Machine When Logic Changes**
   - If we add new state, must update machine definition
   - Benefit: Compiler forces us to update (type errors if we forget)

2. **CI Script Maintenance**
   - Mermaid conversion script needs occasional updates
   - Low effort: ~50 lines of straightforward code

---

## Implementation Plan

### Phase 1: Foundation (Tasks 1-4) - 1 day

#### Task 1: Install XState, @xstate/graph, and ESLint Plugin

**Files:**
- Modify: `package.json`
- Modify: `eslint.config.mjs`

**Step 1: Install packages**

```bash
npm install xstate@^5.18.0 @xstate/graph@^3.0.4
npm install --save-dev eslint-plugin-xstate@^3.2.1
```

**Step 2: Verify installation**

Run: `npm list xstate @xstate/graph eslint-plugin-xstate`
Expected: All packages listed with versions

**Step 3: Configure ESLint plugin**

Add to `eslint.config.mjs`:

```javascript
import xstate from 'eslint-plugin-xstate';

export default [
  // ... existing config ...
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      xstate,
    },
    rules: {
      // Critical XState rules - ALL ERRORS (no warnings)
      'xstate/no-infinite-loop': 'error',
      'xstate/no-imperative-action': 'error',
      'xstate/no-async-guard': 'error',
      'xstate/no-invalid-transition-props': 'error',
      'xstate/no-invalid-state-props': 'error',
      'xstate/invoke-usage': 'error',
      'xstate/entry-exit-action': 'error',
      'xstate/no-misplaced-on-transition': 'error',
      'xstate/no-ondone-outside-compound-state': 'error',
      'xstate/no-invalid-conditional-action': 'error',

      // Style & consistency - ERRORS (not warnings)
      'xstate/event-names': ['error', 'macro'], // SCREAMING_SNAKE_CASE
      'xstate/state-names': ['error', 'camelCase'], // camelCase
      'xstate/no-inline-implementation': 'error', // Extract to machine options
      'xstate/prefer-always': 'error', // Use 'always' for eventless transitions

      // NOT enabled (optional rules we don't need):
      // 'xstate/prefer-predictable-action-arguments': off (adds complexity)
      // 'xstate/system-id': off (not needed yet)
      // 'xstate/spawn-usage': off (v4 only)
    },
  },
];
```

**Step 4: Verify ESLint config**

Run: `npm run lint src/machines/`
Expected: No errors (no machines exist yet)

**Step 5: Commit**

```bash
git add package.json package-lock.json eslint.config.mjs
git commit -m "chore: add xstate, @xstate/graph, and eslint-plugin-xstate"
```

---

#### Task 2: Create Agent State Machine

**Files:**
- Create: `src/machines/agentMachine.ts`
- Create: `src/machines/agentMachine.test.ts`

**Step 1: Write the machine definition**

```typescript
import { setup } from 'xstate';

/**
 * Agent lifecycle state machine for arena competitions.
 *
 * States:
 * - pending: Agent mentioned in Linear comment, waiting for PR
 * - submitted: PR created and linked
 * - accepted: Agent's PR was merged (winner)
 * - rejected: Another agent won OR PR closed without merge
 * - ignored: Issue closed before agent submitted PR
 */

type AgentContext = {
  agentName: string;
  issueId: string;
  prUrl?: string;
};

type AgentEvents =
  | { type: 'PR_SUBMITTED'; prUrl: string }
  | { type: 'PR_MERGED' }
  | { type: 'OTHER_AGENT_WON' }
  | { type: 'PR_CLOSED' }
  | { type: 'ISSUE_CLOSED' };

export const agentMachine = setup({
  types: {
    context: {} as AgentContext,
    events: {} as AgentEvents,
  },
}).createMachine({
  id: 'agent',
  initial: 'pending',
  context: {
    agentName: '',
    issueId: '',
    prUrl: undefined,
  },
  states: {
    pending: {
      on: {
        PR_SUBMITTED: {
          target: 'submitted',
        },
        ISSUE_CLOSED: {
          target: 'ignored',
        },
      },
    },
    submitted: {
      on: {
        PR_MERGED: {
          target: 'accepted',
        },
        OTHER_AGENT_WON: {
          target: 'rejected',
        },
        PR_CLOSED: {
          target: 'rejected',
        },
      },
    },
    accepted: {
      type: 'final',
    },
    rejected: {
      type: 'final',
    },
    ignored: {
      type: 'final',
    },
  },
});
```

**Step 2: Write basic test**

```typescript
import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { agentMachine } from './agentMachine';

describe('agentMachine', () => {
  it('transitions from pending to submitted on PR_SUBMITTED', () => {
    const actor = createActor(agentMachine);
    actor.start();

    expect(actor.getSnapshot().value).toBe('pending');

    actor.send({ type: 'PR_SUBMITTED', prUrl: 'https://github.com/org/repo/pull/1' });

    expect(actor.getSnapshot().value).toBe('submitted');
  });

  it('transitions from pending to ignored on ISSUE_CLOSED', () => {
    const actor = createActor(agentMachine);
    actor.start();

    actor.send({ type: 'ISSUE_CLOSED' });

    expect(actor.getSnapshot().value).toBe('ignored');
  });

  it('transitions from submitted to accepted on PR_MERGED', () => {
    const actor = createActor(agentMachine, {
      snapshot: { value: 'submitted', context: { agentName: 'test', issueId: '1' } },
    });
    actor.start();

    actor.send({ type: 'PR_MERGED' });

    expect(actor.getSnapshot().value).toBe('accepted');
  });

  it('transitions from submitted to rejected on OTHER_AGENT_WON', () => {
    const actor = createActor(agentMachine, {
      snapshot: { value: 'submitted', context: { agentName: 'test', issueId: '1' } },
    });
    actor.start();

    actor.send({ type: 'OTHER_AGENT_WON' });

    expect(actor.getSnapshot().value).toBe('rejected');
  });
});
```

**Step 3: Run tests**

Run: `npm test src/machines/agentMachine.test.ts`
Expected: All 4 tests pass

**Step 4: Commit**

```bash
git add src/machines/agentMachine.ts src/machines/agentMachine.test.ts
git commit -m "feat: add XState agent lifecycle state machine"
```

---

#### Task 3: Create Issue State Machine

**Files:**
- Create: `src/machines/issueMachine.ts`
- Create: `src/machines/issueMachine.test.ts`

**Step 1: Write the machine definition**

```typescript
import { setup } from 'xstate';

/**
 * Issue lifecycle state machine for arena competitions.
 *
 * States:
 * - open: Issue has arena:ready label, may or may not have agents
 * - in_progress: At least one agent has submitted a PR
 * - completed: Winner selected, PR merged
 * - cancelled: arena:ready label removed OR issue closed
 */

type IssueContext = {
  issueId: string;
  winnerAgentName?: string;
  agentCount: number;
};

type IssueEvents =
  | { type: 'FIRST_PR_SUBMITTED' }
  | { type: 'PR_MERGED'; agentName: string }
  | { type: 'LABEL_REMOVED' }
  | { type: 'ISSUE_CLOSED' };

export const issueMachine = setup({
  types: {
    context: {} as IssueContext,
    events: {} as IssueEvents,
  },
}).createMachine({
  id: 'issue',
  initial: 'open',
  context: {
    issueId: '',
    winnerAgentName: undefined,
    agentCount: 0,
  },
  states: {
    open: {
      on: {
        FIRST_PR_SUBMITTED: {
          target: 'in_progress',
        },
        LABEL_REMOVED: {
          target: 'cancelled',
        },
        ISSUE_CLOSED: {
          target: 'cancelled',
        },
      },
    },
    in_progress: {
      on: {
        PR_MERGED: {
          target: 'completed',
        },
        LABEL_REMOVED: {
          target: 'cancelled',
        },
        ISSUE_CLOSED: {
          target: 'cancelled',
        },
      },
    },
    completed: {
      type: 'final',
    },
    cancelled: {
      type: 'final',
    },
  },
});
```

**Step 2: Write basic tests**

```typescript
import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { issueMachine } from './issueMachine';

describe('issueMachine', () => {
  it('starts in open state', () => {
    const actor = createActor(issueMachine);
    actor.start();

    expect(actor.getSnapshot().value).toBe('open');
  });

  it('transitions from open to in_progress on FIRST_PR_SUBMITTED', () => {
    const actor = createActor(issueMachine);
    actor.start();

    actor.send({ type: 'FIRST_PR_SUBMITTED' });

    expect(actor.getSnapshot().value).toBe('in_progress');
  });

  it('transitions from open to cancelled on LABEL_REMOVED', () => {
    const actor = createActor(issueMachine);
    actor.start();

    actor.send({ type: 'LABEL_REMOVED' });

    expect(actor.getSnapshot().value).toBe('cancelled');
  });

  it('transitions from in_progress to completed on PR_MERGED', () => {
    const actor = createActor(issueMachine, {
      snapshot: { value: 'in_progress', context: { issueId: '1', agentCount: 2 } },
    });
    actor.start();

    actor.send({ type: 'PR_MERGED', agentName: 'agent1' });

    expect(actor.getSnapshot().value).toBe('completed');
  });

  it('transitions from in_progress to cancelled on ISSUE_CLOSED', () => {
    const actor = createActor(issueMachine, {
      snapshot: { value: 'in_progress', context: { issueId: '1', agentCount: 1 } },
    });
    actor.start();

    actor.send({ type: 'ISSUE_CLOSED' });

    expect(actor.getSnapshot().value).toBe('cancelled');
  });
});
```

**Step 3: Run tests**

Run: `npm test src/machines/issueMachine.test.ts`
Expected: All 5 tests pass

**Step 4: Commit**

```bash
git add src/machines/issueMachine.ts src/machines/issueMachine.test.ts
git commit -m "feat: add XState issue lifecycle state machine"
```

---

#### Task 4: Create Mermaid Diagram Generator

**Files:**
- Create: `scripts/generate-state-diagrams.ts`

**Step 1: Write the generator script**

```typescript
#!/usr/bin/env tsx
import { writeFileSync, mkdirSync } from 'fs';
import { toDirectedGraph } from '@xstate/graph';
import { agentMachine } from '../src/machines/agentMachine';
import { issueMachine } from '../src/machines/issueMachine';

/**
 * Converts an XState machine to Mermaid stateDiagram-v2 format.
 */
function toMermaid(graph: any, machineName: string): string {
  let mermaid = '```mermaid\n';
  mermaid += 'stateDiagram-v2\n';

  // Add initial state marker
  if (graph.stateNode.initial) {
    mermaid += `  [*] --> ${graph.stateNode.initial}\n`;
  }

  // Process all edges (transitions)
  const edges = new Set<string>();
  graph.edges.forEach((edge: any) => {
    const source = edge.source.id.replace(`${machineName}.`, '');
    const target = edge.target.id.replace(`${machineName}.`, '');
    const event = edge.transition.eventType;

    // Build edge string
    let edgeStr = `  ${source} --> ${target}`;
    if (event) {
      edgeStr += ` : ${event}`;
    }

    edges.add(edgeStr);
  });

  // Add unique edges
  edges.forEach(edge => {
    mermaid += edge + '\n';
  });

  // Add final state markers
  graph.children.forEach((child: any) => {
    if (child.stateNode?.type === 'final') {
      const stateName = child.id.replace(`${machineName}.`, '');
      mermaid += `  ${stateName} --> [*]\n`;
    }
  });

  mermaid += '```';
  return mermaid;
}

/**
 * Main execution
 */
function main() {
  console.log('Generating state machine diagrams...\n');

  // Create output directory
  mkdirSync('./docs/diagrams', { recursive: true });

  // Generate Agent Machine diagram
  const agentGraph = toDirectedGraph(agentMachine);
  const agentMermaid = toMermaid(agentGraph, 'agent');

  const agentDoc = `# Agent Lifecycle State Machine

**Generated from:** \`src/machines/agentMachine.ts\`
**Last Updated:** ${new Date().toISOString()}

${agentMermaid}

## States

- **pending**: Agent mentioned in Linear comment, waiting for PR
- **submitted**: PR created and linked to issue
- **accepted**: Agent's PR was merged (winner)
- **rejected**: Another agent won OR PR closed without merge
- **ignored**: Issue closed before agent submitted PR

## Events

- \`PR_SUBMITTED\`: Agent creates PR
- \`PR_MERGED\`: Agent's PR is merged
- \`OTHER_AGENT_WON\`: Different agent's PR was merged
- \`PR_CLOSED\`: Agent's PR was closed without merge
- \`ISSUE_CLOSED\`: Issue closed before PR submitted
`;

  writeFileSync('./docs/diagrams/agent-state-machine.md', agentDoc);
  console.log('✅ Generated: docs/diagrams/agent-state-machine.md');

  // Generate Issue Machine diagram
  const issueGraph = toDirectedGraph(issueMachine);
  const issueMermaid = toMermaid(issueGraph, 'issue');

  const issueDoc = `# Issue Lifecycle State Machine

**Generated from:** \`src/machines/issueMachine.ts\`
**Last Updated:** ${new Date().toISOString()}

${issueMermaid}

## States

- **open**: Issue has \`arena:ready\` label, agents may be dispatched
- **in_progress**: At least one agent has submitted a PR
- **completed**: Winner selected, PR merged
- **cancelled**: \`arena:ready\` label removed OR issue closed

## Events

- \`FIRST_PR_SUBMITTED\`: First agent submits PR (any agent)
- \`PR_MERGED\`: Winner's PR is merged
- \`LABEL_REMOVED\`: \`arena:ready\` label removed from issue
- \`ISSUE_CLOSED\`: Issue closed in Linear
`;

  writeFileSync('./docs/diagrams/issue-state-machine.md', issueDoc);
  console.log('✅ Generated: docs/diagrams/issue-state-machine.md');

  console.log('\n🎉 State machine diagrams generated successfully!\n');
}

main();
```

**Step 2: Make script executable and test**

Run: `chmod +x scripts/generate-state-diagrams.ts && tsx scripts/generate-state-diagrams.ts`
Expected:
```
Generating state machine diagrams...

✅ Generated: docs/diagrams/agent-state-machine.md
✅ Generated: docs/diagrams/issue-state-machine.md

🎉 State machine diagrams generated successfully!
```

**Step 3: Verify generated files**

Run: `cat docs/diagrams/agent-state-machine.md`
Expected: Valid Mermaid diagram with states and transitions

**Step 4: Add to package.json scripts**

```json
{
  "scripts": {
    "generate-diagrams": "tsx scripts/generate-state-diagrams.ts",
    "build": "npm run generate-diagrams && npm run validate && next build"
  }
}
```

**Step 5: Run via npm script**

Run: `npm run generate-diagrams`
Expected: Diagrams regenerated

**Step 6: Commit**

```bash
git add scripts/generate-state-diagrams.ts package.json docs/diagrams/
git commit -m "feat: add auto-generated state machine diagrams from XState"
```

---

### Phase 2: Integration (Tasks 5-7) - 0.5 days

#### Task 5: Add Pre-commit Hook

**Files:**
- Modify: `.husky/pre-commit`

**Step 1: Update pre-commit hook**

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npm run generate-diagrams
git add docs/diagrams/
```

**Step 2: Test hook**

Make a trivial change to `agentMachine.ts` (add comment)

Run: `git add src/machines/agentMachine.ts && git commit -m "test: verify diagram regeneration"`
Expected: Hook runs, diagrams update automatically, commit succeeds

**Step 3: Commit hook changes**

```bash
git add .husky/pre-commit
git commit -m "chore: auto-regenerate state diagrams on commit"
```

---

#### Task 6: Update Main State Machine Docs

**Files:**
- Modify: `docs/arena-state-machine.md`

**Step 1: Add header notice**

Add to top of `docs/arena-state-machine.md` after title:

```markdown
> **⚠️ DEPRECATED DIAGRAMS**: The Mermaid diagrams in this file are now auto-generated from code.
>
> **See:**
> - Agent state machine: [docs/diagrams/agent-state-machine.md](diagrams/agent-state-machine.md)
> - Issue state machine: [docs/diagrams/issue-state-machine.md](diagrams/issue-state-machine.md)
>
> **Source of truth:**
> - `src/machines/agentMachine.ts`
> - `src/machines/issueMachine.ts`
```

**Step 2: Verify links work**

Open `docs/arena-state-machine.md` in GitHub/editor
Click links to generated diagrams
Expected: Links navigate correctly

**Step 3: Commit**

```bash
git add docs/arena-state-machine.md
git commit -m "docs: link to auto-generated state machine diagrams"
```

---

#### Task 7: Add README Documentation

**Files:**
- Modify: `README.md`

**Step 1: Add State Machine section**

Add section to README.md:

```markdown
## State Machines

The coding arena uses XState to model agent and issue lifecycles. State machines are defined in TypeScript and diagrams are auto-generated in CI.

**View diagrams:**
- [Agent Lifecycle](docs/diagrams/agent-state-machine.md)
- [Issue Lifecycle](docs/diagrams/issue-state-machine.md)

**Source code:**
- `src/machines/agentMachine.ts` - Agent state machine definition
- `src/machines/issueMachine.ts` - Issue state machine definition

**Generate diagrams manually:**
```bash
npm run generate-diagrams
```

Diagrams are automatically regenerated:
- On every commit (pre-commit hook)
- During build (`npm run build`)
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add state machine documentation to README"
```

---

### Phase 3: Testing & Validation (Task 8) - 0.5 days

#### Task 8: Add Comprehensive State Machine Tests

**Files:**
- Modify: `src/machines/agentMachine.test.ts`
- Modify: `src/machines/issueMachine.test.ts`

**Step 1: Add path coverage tests for agent machine**

Add to `agentMachine.test.ts`:

```typescript
import { getShortestPaths } from '@xstate/graph';

describe('agentMachine - comprehensive path coverage', () => {
  it('covers all possible paths using @xstate/graph', () => {
    const paths = getShortestPaths(agentMachine);

    // Verify all terminal states are reachable
    expect(paths.get('{"value":"accepted"}')?.segments).toBeDefined();
    expect(paths.get('{"value":"rejected"}')?.segments).toBeDefined();
    expect(paths.get('{"value":"ignored"}')?.segments).toBeDefined();

    // Log paths for documentation
    console.log('\nAgent State Machine Paths:');
    paths.forEach((path, state) => {
      console.log(`\n${state}:`);
      path.segments.forEach((segment, i) => {
        console.log(`  ${i + 1}. ${segment.event.type} → ${segment.state.value}`);
      });
    });
  });

  it('path: pending → submitted → accepted', () => {
    const actor = createActor(agentMachine);
    actor.start();

    expect(actor.getSnapshot().value).toBe('pending');
    actor.send({ type: 'PR_SUBMITTED', prUrl: 'test' });
    expect(actor.getSnapshot().value).toBe('submitted');
    actor.send({ type: 'PR_MERGED' });
    expect(actor.getSnapshot().value).toBe('accepted');
  });

  it('path: pending → submitted → rejected (other agent won)', () => {
    const actor = createActor(agentMachine);
    actor.start();

    actor.send({ type: 'PR_SUBMITTED', prUrl: 'test' });
    actor.send({ type: 'OTHER_AGENT_WON' });
    expect(actor.getSnapshot().value).toBe('rejected');
  });

  it('path: pending → submitted → rejected (PR closed)', () => {
    const actor = createActor(agentMachine);
    actor.start();

    actor.send({ type: 'PR_SUBMITTED', prUrl: 'test' });
    actor.send({ type: 'PR_CLOSED' });
    expect(actor.getSnapshot().value).toBe('rejected');
  });

  it('path: pending → ignored', () => {
    const actor = createActor(agentMachine);
    actor.start();

    actor.send({ type: 'ISSUE_CLOSED' });
    expect(actor.getSnapshot().value).toBe('ignored');
  });

  it('rejects invalid transitions', () => {
    const actor = createActor(agentMachine);
    actor.start();

    // Can't merge PR before submitting it
    actor.send({ type: 'PR_MERGED' });
    expect(actor.getSnapshot().value).toBe('pending'); // No transition
  });
});
```

**Step 2: Add path coverage tests for issue machine**

Add to `issueMachine.test.ts`:

```typescript
import { getShortestPaths } from '@xstate/graph';

describe('issueMachine - comprehensive path coverage', () => {
  it('covers all possible paths using @xstate/graph', () => {
    const paths = getShortestPaths(issueMachine);

    // Verify all terminal states are reachable
    expect(paths.get('{"value":"completed"}')?.segments).toBeDefined();
    expect(paths.get('{"value":"cancelled"}')?.segments).toBeDefined();

    console.log('\nIssue State Machine Paths:');
    paths.forEach((path, state) => {
      console.log(`\n${state}:`);
      path.segments.forEach((segment, i) => {
        console.log(`  ${i + 1}. ${segment.event.type} → ${segment.state.value}`);
      });
    });
  });

  it('path: open → in_progress → completed', () => {
    const actor = createActor(issueMachine);
    actor.start();

    actor.send({ type: 'FIRST_PR_SUBMITTED' });
    expect(actor.getSnapshot().value).toBe('in_progress');
    actor.send({ type: 'PR_MERGED', agentName: 'test' });
    expect(actor.getSnapshot().value).toBe('completed');
  });

  it('path: open → cancelled (label removed)', () => {
    const actor = createActor(issueMachine);
    actor.start();

    actor.send({ type: 'LABEL_REMOVED' });
    expect(actor.getSnapshot().value).toBe('cancelled');
  });

  it('path: open → cancelled (issue closed)', () => {
    const actor = createActor(issueMachine);
    actor.start();

    actor.send({ type: 'ISSUE_CLOSED' });
    expect(actor.getSnapshot().value).toBe('cancelled');
  });

  it('path: in_progress → cancelled', () => {
    const actor = createActor(issueMachine, {
      snapshot: { value: 'in_progress', context: { issueId: '1', agentCount: 1 } },
    });
    actor.start();

    actor.send({ type: 'ISSUE_CLOSED' });
    expect(actor.getSnapshot().value).toBe('cancelled');
  });
});
```

**Step 3: Run all tests**

Run: `npm test src/machines/`
Expected: All tests pass, path logs show complete coverage

**Step 4: Check coverage**

Run: `npm test -- --coverage`
Expected: machines/ folder has >90% coverage

**Step 5: Commit**

```bash
git add src/machines/
git commit -m "test: add comprehensive state machine path coverage"
```

---

## Success Criteria

### Must Have:
- [x] XState and @xstate/graph installed
- [x] Agent state machine defined in TypeScript
- [x] Issue state machine defined in TypeScript
- [x] Mermaid diagrams auto-generated from machines
- [x] Diagrams regenerate on commit (pre-commit hook)
- [x] Diagrams regenerate during build
- [x] Tests verify all state transitions
- [x] Tests use `getShortestPaths()` for path coverage
- [x] Documentation links to generated diagrams
- [x] >90% test coverage for machines

### Nice to Have (Future):
- [ ] State machine enforcement in webhook handlers
- [ ] Stately Inspector integration for debugging
- [ ] Visual state machine editor integration
- [ ] State transition logging to events table
- [ ] Central state machine service

---

## Files Changed

### New Files (6):
- `src/machines/agentMachine.ts` - Agent state machine definition
- `src/machines/agentMachine.test.ts` - Agent machine tests
- `src/machines/issueMachine.ts` - Issue state machine definition
- `src/machines/issueMachine.test.ts` - Issue machine tests
- `scripts/generate-state-diagrams.ts` - Diagram generator
- `docs/diagrams/agent-state-machine.md` - Generated agent diagram
- `docs/diagrams/issue-state-machine.md` - Generated issue diagram

### Modified Files (4):
- `package.json` - Add generate-diagrams script
- `.husky/pre-commit` - Auto-regenerate diagrams
- `docs/arena-state-machine.md` - Link to generated diagrams
- `README.md` - Add state machine documentation

---

## Risks & Mitigations

### Risk 1: XState Learning Curve
**Likelihood:** Medium
**Impact:** Low
**Mitigation:** XState v5 is well-documented, machines are simple (4-5 states each), plan includes complete code examples

### Risk 2: Diagram Format Limitations
**Likelihood:** Low
**Impact:** Low
**Mitigation:** Mermaid stateDiagram-v2 supports all our needs, GitHub renders it natively

### Risk 3: CI Performance
**Likelihood:** Low
**Impact:** Low
**Mitigation:** Diagram generation is fast (<1 second), runs async with build

### Risk 4: Team Adoption
**Likelihood:** Medium
**Impact:** Medium
**Mitigation:** Gradual rollout - Phase 1 is documentation only (no behavior change), Phase 2 (enforcement) is optional future work

---

## Future Enhancements (Not in This Plan)

### Phase 2: State Machine Enforcement
- Refactor webhook handlers to use XState actors
- Enforce state transitions at runtime
- Prevent invalid state changes
- Estimated effort: 3-5 days

### Phase 3: Visual Debugging
- Integrate Stately Inspector
- Real-time state visualization
- Record state transitions in events table
- Estimated effort: 2-3 days

### Phase 4: Advanced Testing
- Property-based testing with state machines
- Fuzzing state transitions
- Model-based testing
- Estimated effort: 2-3 days

---

## Timeline Estimate

**Total: 2-3 days (16-24 hours)**

| Phase | Duration | Effort |
|-------|----------|--------|
| Phase 1: Foundation (Tasks 1-4) | 1 day | 8 hours |
| Phase 2: Integration (Tasks 5-7) | 0.5 days | 4 hours |
| Phase 3: Testing (Task 8) | 0.5 days | 4 hours |
| **Total** | **2 days** | **16 hours** |

**Confidence:** Very High (simple, well-understood problem)

---

## Related Documents

- [Arena State Machine Spec](../arena-state-machine.md) - Current state machine documentation
- [Lifecycle Audit](../LIFECYCLE-AUDIT-2025-11-12.md) - Gap analysis showing need for better state modeling
- [XState Documentation](https://stately.ai/docs/xstate) - Official XState v5 docs
- [@xstate/graph Documentation](https://stately.ai/docs/xstate-graph) - Graph utilities

---

**Status:** Ready for implementation
**Next Steps:**
1. Review plan with team
2. Decide on execution approach (subagent-driven vs parallel session)
3. Start Task 1: Install XState packages
