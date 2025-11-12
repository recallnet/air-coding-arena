# Dynamic Agent Configuration via Environment Variables

**Date:** 2025-11-12
**Status:** 📋 Design
**Priority:** HIGH (Blocker for testing flexibility)

---

## Problem Statement

### Current State: Hardcoded ❌

**Agent handles are hardcoded in 3 locations:**

1. **`src/lib/linear-sync.ts:12`**
   ```typescript
   const AGENT_HANDLES = ['@cursor', '@engine', '@cyrus', '@claude']
   ```

2. **`src/app/api/linear/webhook/route.ts:290-296`**
   ```typescript
   function guessAgent(title: string, branch?: string): string {
     const source = (branch ?? title).toLowerCase()
     if (source.includes('cursor')) return 'cursor'
     if (source.includes('engine')) return 'engine'
     if (source.includes('cyrus')) return 'cyrus'
     return 'unknown'
   }
   ```

3. **`src/lib/linear-sync.ts:155-162`** (duplicate `guessAgent`)
   ```typescript
   function guessAgent(title: string, subtitle?: string | null): string {
     const source = (subtitle ?? title).toLowerCase()
     if (source.includes('cursor')) return 'cursor'
     if (source.includes('engine')) return 'engine'
     if (source.includes('cyrus')) return 'cyrus'
     if (source.includes('claude')) return 'claude'
     return 'unknown'
   }
   ```

**Problems:**
- Can't add/remove agents without code changes
- Can't test with different agent sets
- Can't disable problematic agents (e.g., Cyrus ignoring mentions)
- Inconsistent: `@claude` missing from route.ts
- Code duplication: `guessAgent()` defined twice

---

## Solution Design

### JSON Configuration (Selected Approach)

**Env Var:**
```bash
AGENTS_CONFIG_JSON='[{"name":"cursor","handle":"@Cursor"},{"name":"engine","handle":"@Engine"},{"name":"cyrus","handle":"@Cyrus"},{"name":"factory","handle":"@Factory"}]'
```

**Why JSON:**
- Case-sensitive handles (@Cursor vs @cursor matters in Linear)
- Easy to add per-agent metadata later (endpoints, modes)
- Clear explicit configuration
- Future-proof for HTTP dispatch

**Configuration:**
```json
[
  {
    "name": "cursor",
    "handle": "@Cursor"
  },
  {
    "name": "engine",
    "handle": "@Engine"
  },
  {
    "name": "cyrus",
    "handle": "@Cyrus"
  },
  {
    "name": "factory",
    "handle": "@Factory"
  }
]
```

**Field Definitions:**
- `name` (required): Agent identifier (lowercase, used in database)
- `handle` (required): Linear mention handle (case-sensitive)

**Future Fields (not implemented yet):**
- `mode`: "linear_mention" | "http_endpoint"
- `endpoint`: URL for HTTP dispatch
- `enabled`: boolean flag to disable agent

---

## Implementation Plan

### Task 1: Create Agent Config Module

**File:** `src/lib/agent-config.ts`

```typescript
/**
 * Agent configuration from environment variables
 * @packageDocumentation
 */

export type AgentConfig = {
  name: string
  handle: string
}

/**
 * Default agent configuration (fallback)
 */
const DEFAULT_AGENTS: AgentConfig[] = [
  { name: 'cursor', handle: '@Cursor' },
  { name: 'engine', handle: '@Engine' },
  { name: 'cyrus', handle: '@Cyrus' },
  { name: 'factory', handle: '@Factory' },
]

/**
 * Parses agent list from AGENTS_CONFIG_JSON env var
 * Format: [{"name":"cursor","handle":"@Cursor"},{"name":"engine","handle":"@Engine"}]
 * @returns Array of agent configs
 */
export function getAgentConfigs(): AgentConfig[] {
  const configJson = process.env.AGENTS_CONFIG_JSON

  if (!configJson) {
    // Fallback to default agents for backward compatibility
    console.warn('AGENTS_CONFIG_JSON not set, using defaults: cursor, engine, cyrus, factory')
    return DEFAULT_AGENTS
  }

  try {
    const parsed = JSON.parse(configJson) as unknown

    // Validate structure
    if (!Array.isArray(parsed)) {
      throw new Error('AGENTS_CONFIG_JSON must be an array')
    }

    if (parsed.length === 0) {
      throw new Error('AGENTS_CONFIG_JSON is empty, must specify at least one agent')
    }

    // Validate each agent config
    const configs: AgentConfig[] = []
    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) {
        throw new Error('Each agent config must be an object')
      }

      const config = item as Record<string, unknown>

      if (typeof config.name !== 'string' || config.name.trim().length === 0) {
        throw new Error('Agent config missing required field: name (string)')
      }

      if (typeof config.handle !== 'string' || config.handle.trim().length === 0) {
        throw new Error('Agent config missing required field: handle (string)')
      }

      configs.push({
        name: config.name.toLowerCase().trim(),
        handle: config.handle.trim(),
      })
    }

    return configs
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in AGENTS_CONFIG_JSON: ${error.message}`)
    }
    throw error
  }
}

/**
 * Gets list of agent handles for mention detection
 * @returns Array of handles like ['@cursor', '@engine']
 */
export function getAgentHandles(): string[] {
  return getAgentConfigs().map(agent => agent.handle)
}

/**
 * Gets list of agent names for database queries
 * @returns Array of names like ['cursor', 'engine']
 */
export function getAgentNames(): string[] {
  return getAgentConfigs().map(agent => agent.name)
}

/**
 * Guesses agent name from PR title or branch
 * Checks against configured agents
 * @param text - Text to search (title, branch, subtitle)
 * @returns Agent name or 'unknown'
 */
export function guessAgentFromText(text: string): string {
  const lowerText = text.toLowerCase()

  for (const agent of getAgentConfigs()) {
    if (lowerText.includes(agent.name.toLowerCase())) {
      return agent.name
    }
  }

  return 'unknown'
}
```

**Tests:** `src/lib/agent-config.test.ts`

```typescript
import { describe, expect, it, afterEach } from 'vitest'
import { getAgentConfigs, getAgentHandles, guessAgentFromText } from './agent-config'

describe('agent-config', () => {
  const originalEnv = process.env.AGENTS_CONFIG_JSON

  afterEach(() => {
    process.env.AGENTS_CONFIG_JSON = originalEnv
  })

  describe('getAgentConfigs', () => {
    it('should parse JSON agent config', () => {
      process.env.AGENTS_CONFIG_JSON = JSON.stringify([
        { name: 'cursor', handle: '@Cursor' },
        { name: 'engine', handle: '@Engine' },
      ])

      const configs = getAgentConfigs()

      expect(configs).toEqual([
        { name: 'cursor', handle: '@Cursor' },
        { name: 'engine', handle: '@Engine' },
      ])
    })

    it('should preserve case-sensitive handles', () => {
      process.env.AGENTS_CONFIG_JSON = JSON.stringify([
        { name: 'cursor', handle: '@Cursor' },
        { name: 'factory', handle: '@Factory' },
      ])

      const configs = getAgentConfigs()

      expect(configs[0]?.handle).toBe('@Cursor')
      expect(configs[1]?.handle).toBe('@Factory')
    })

    it('should lowercase agent names', () => {
      process.env.AGENTS_CONFIG_JSON = JSON.stringify([
        { name: 'CURSOR', handle: '@Cursor' },
        { name: 'Engine', handle: '@Engine' },
      ])

      const configs = getAgentConfigs()

      expect(configs[0]?.name).toBe('cursor')
      expect(configs[1]?.name).toBe('engine')
    })

    it('should trim whitespace', () => {
      process.env.AGENTS_CONFIG_JSON = JSON.stringify([
        { name: ' cursor ', handle: ' @Cursor ' },
      ])

      const configs = getAgentConfigs()

      expect(configs[0]).toEqual({ name: 'cursor', handle: '@Cursor' })
    })

    it('should fall back to defaults if not set', () => {
      delete process.env.AGENTS_CONFIG_JSON

      const configs = getAgentConfigs()

      expect(configs).toHaveLength(4)
      expect(configs.map(c => c.name)).toEqual(['cursor', 'engine', 'cyrus', 'factory'])
    })

    it('should throw if JSON is invalid', () => {
      process.env.AGENTS_CONFIG_JSON = 'invalid json'

      expect(() => getAgentConfigs()).toThrow('Invalid JSON')
    })

    it('should throw if not an array', () => {
      process.env.AGENTS_CONFIG_JSON = JSON.stringify({ name: 'cursor' })

      expect(() => getAgentConfigs()).toThrow('must be an array')
    })

    it('should throw if array is empty', () => {
      process.env.AGENTS_CONFIG_JSON = '[]'

      expect(() => getAgentConfigs()).toThrow('must specify at least one agent')
    })

    it('should throw if name is missing', () => {
      process.env.AGENTS_CONFIG_JSON = JSON.stringify([
        { handle: '@Cursor' },
      ])

      expect(() => getAgentConfigs()).toThrow('missing required field: name')
    })

    it('should throw if handle is missing', () => {
      process.env.AGENTS_CONFIG_JSON = JSON.stringify([
        { name: 'cursor' },
      ])

      expect(() => getAgentConfigs()).toThrow('missing required field: handle')
    })
  })

  describe('getAgentHandles', () => {
    it('should return array of handles', () => {
      process.env.ARENA_AGENTS = 'cursor,engine'

      const handles = getAgentHandles()

      expect(handles).toEqual(['@cursor', '@engine'])
    })
  })

  describe('guessAgentFromText', () => {
    beforeEach(() => {
      process.env.AGENTS_CONFIG_JSON = JSON.stringify([
        { name: 'cursor', handle: '@Cursor' },
        { name: 'engine', handle: '@Engine' },
        { name: 'factory', handle: '@Factory' },
      ])
    })

    it('should detect agent in branch name', () => {
      expect(guessAgentFromText('cursor/fix-bug')).toBe('cursor')
      expect(guessAgentFromText('engine-123-feature')).toBe('engine')
      expect(guessAgentFromText('factory-pr-branch')).toBe('factory')
    })

    it('should detect agent in PR title', () => {
      expect(guessAgentFromText('feat: Add feature by Cursor')).toBe('cursor')
      expect(guessAgentFromText('Factory agent implementation')).toBe('factory')
    })

    it('should be case-insensitive for detection', () => {
      expect(guessAgentFromText('CURSOR/fix')).toBe('cursor')
      expect(guessAgentFromText('Engine-PR')).toBe('engine')
      expect(guessAgentFromText('FACTORY-branch')).toBe('factory')
    })

    it('should return unknown if no match', () => {
      expect(guessAgentFromText('some-random-branch')).toBe('unknown')
    })

    it('should return first match if multiple agents mentioned', () => {
      // cursor comes before engine in config
      expect(guessAgentFromText('cursor-and-engine-pr')).toBe('cursor')
    })
  })
})
```

---

### Task 2: Update Linear Sync to Use Config

**File:** `src/lib/linear-sync.ts`

**Before:**
```typescript
const AGENT_HANDLES = ['@cursor', '@engine', '@cyrus', '@claude']

// ... later in syncComments()
for (const handle of AGENT_HANDLES) {
  if (body.toLowerCase().includes(handle.toLowerCase())) {
    const agentName = handle.substring(1)
    // ...
  }
}

// ... guessAgent function (duplicate, wrong)
function guessAgent(title: string, subtitle?: string | null): string {
  const source = (subtitle ?? title).toLowerCase()
  if (source.includes('cursor')) return 'cursor'
  if (source.includes('engine')) return 'engine'
  if (source.includes('cyrus')) return 'cyrus'
  if (source.includes('claude')) return 'claude'
  return 'unknown'
}
```

**After:**
```typescript
import { getAgentHandles, guessAgentFromText } from './agent-config'

// Remove AGENT_HANDLES constant

// ... in syncComments()
for (const handle of getAgentHandles()) {
  if (body.toLowerCase().includes(handle.toLowerCase())) {
    const agentName = handle.substring(1) // Remove @ prefix
    // ...
  }
}

// ... replace guessAgent()
function guessAgent(title: string, subtitle?: string | null): string {
  return guessAgentFromText(subtitle ?? title)
}
```

---

### Task 3: Update Webhook Route to Use Config

**File:** `src/app/api/linear/webhook/route.ts`

**Before:**
```typescript
function guessAgent(title: string, branch?: string): string {
  const source = (branch ?? title).toLowerCase()
  if (source.includes('cursor')) return 'cursor'
  if (source.includes('engine')) return 'engine'
  if (source.includes('cyrus')) return 'cyrus'
  return 'unknown'
}
```

**After:**
```typescript
import { guessAgentFromText } from '@/lib/agent-config'

function guessAgent(title: string, branch?: string): string {
  return guessAgentFromText(branch ?? title)
}
```

---

### Task 4: Update Tests

**Files to update:**
- `src/app/api/linear/webhook/route.test.ts`
- `src/lib/linear-sync.test.ts`

**Add to beforeEach:**
```typescript
beforeEach(() => {
  // ... existing setup
  process.env.AGENTS_CONFIG_JSON = JSON.stringify([
    { name: 'cursor', handle: '@Cursor' },
    { name: 'engine', handle: '@Engine' },
    { name: 'cyrus', handle: '@Cyrus' },
    { name: 'factory', handle: '@Factory' },
  ])
})
```

**Add test for unknown agent:**
```typescript
it('should handle unknown agent gracefully', () => {
  process.env.AGENTS_CONFIG_JSON = JSON.stringify([
    { name: 'cursor', handle: '@Cursor' },
    { name: 'engine', handle: '@Engine' },
  ])

  const agent = guessAgent('random-branch-name')

  expect(agent).toBe('unknown')
})
```

---

### Task 5: Update Environment Configuration

**File:** `.env.local.example`
```bash
# Arena Configuration
ARENA_LABEL=arena:ready
AGENTS_CONFIG_JSON='[{"name":"cursor","handle":"@Cursor"},{"name":"engine","handle":"@Engine"},{"name":"cyrus","handle":"@Cyrus"},{"name":"factory","handle":"@Factory"}]'

# Linear Integration
LINEAR_WEBHOOK_SECRET=your-secret-here
LINEAR_API_KEY=your-api-key-here
```

**File:** `README.md` (Environment Variables section)
```markdown
### Required Environment Variables

```bash
# Arena Configuration
ARENA_LABEL=arena:ready
AGENTS_CONFIG_JSON='[{"name":"cursor","handle":"@Cursor"},{"name":"engine","handle":"@Engine"},{"name":"cyrus","handle":"@Cyrus"},{"name":"factory","handle":"@Factory"}]'

# Linear Integration
LINEAR_WEBHOOK_SECRET=<random-64-chars>
LINEAR_API_KEY=<linear-api-key>
```

**Optional:**
- `AGENTS_CONFIG_JSON` - Defaults to: cursor, engine, cyrus, factory
```

**Vercel Configuration:**
```bash
AGENTS_CONFIG_JSON=[{"name":"cursor","handle":"@Cursor"},{"name":"engine","handle":"@Engine"},{"name":"cyrus","handle":"@Cyrus"},{"name":"factory","handle":"@Factory"}]
```

**Note:** No quotes needed in Vercel env vars

---

## Migration Strategy

### Backward Compatibility ✅

**Strategy:** Graceful fallback to defaults

```typescript
const DEFAULT_AGENTS: AgentConfig[] = [
  { name: 'cursor', handle: '@Cursor' },
  { name: 'engine', handle: '@Engine' },
  { name: 'cyrus', handle: '@Cyrus' },
  { name: 'factory', handle: '@Factory' },
]

if (!configJson) {
  console.warn('AGENTS_CONFIG_JSON not set, using defaults: cursor, engine, cyrus, factory')
  return DEFAULT_AGENTS
}
```

**Result:**
- Existing deployments work without changes (uses defaults)
- Warning logged to help users migrate
- No breaking changes

---

## Testing Strategy

### Unit Tests

**Test Cases:**
1. ✅ Parse JSON agent config correctly
2. ✅ Preserve case-sensitive handles (@Cursor vs @cursor)
3. ✅ Lowercase agent names (cursor, not Cursor)
4. ✅ Trim whitespace from name and handle
5. ✅ Fall back to defaults if env not set
6. ✅ Throw error if JSON is invalid
7. ✅ Throw error if not an array
8. ✅ Throw error if array is empty
9. ✅ Throw error if name is missing
10. ✅ Throw error if handle is missing
11. ✅ Detect agents in PR titles/branches
12. ✅ Case-insensitive matching for detection
13. ✅ Return 'unknown' if no match

### Integration Tests

**Scenarios:**
1. Add `arena:ready` label with JSON config of only 2 agents:
   ```json
   [{"name":"cursor","handle":"@Cursor"},{"name":"engine","handle":"@Engine"}]
   ```
   - Only cursor and engine tracked
   - Factory/Cyrus mentions ignored

2. Change to single agent:
   ```json
   [{"name":"cursor","handle":"@Cursor"}]
   ```
   - Only cursor tracked
   - Verify no errors

3. Custom agent with different case:
   ```json
   [{"name":"copilot","handle":"@GitHub-Copilot"}]
   ```
   - Custom agent tracked
   - @GitHub-Copilot mentions detected (case-sensitive)

4. Remove env var → uses defaults
   - All 4 default agents tracked (cursor, engine, cyrus, factory)

---

## Use Cases Enabled

### 1. Disable Problematic Agent
```bash
# Cyrus never responds, remove it
AGENTS_CONFIG_JSON='[{"name":"cursor","handle":"@Cursor"},{"name":"engine","handle":"@Engine"},{"name":"factory","handle":"@Factory"}]'
```

### 2. Test Single Agent
```bash
# Only test cursor
AGENTS_CONFIG_JSON='[{"name":"cursor","handle":"@Cursor"}]'
```

### 3. Add New Agent
```bash
# Add new agent without code changes
AGENTS_CONFIG_JSON='[{"name":"cursor","handle":"@Cursor"},{"name":"engine","handle":"@Engine"},{"name":"cyrus","handle":"@Cyrus"},{"name":"factory","handle":"@Factory"},{"name":"copilot","handle":"@GitHub-Copilot"}]'
```

### 4. Staging vs Production
```bash
# Staging: Test with limited agents
AGENTS_CONFIG_JSON='[{"name":"cursor","handle":"@Cursor"},{"name":"engine","handle":"@Engine"}]'

# Production: Full agent set
AGENTS_CONFIG_JSON='[{"name":"cursor","handle":"@Cursor"},{"name":"engine","handle":"@Engine"},{"name":"cyrus","handle":"@Cyrus"},{"name":"factory","handle":"@Factory"}]'
```

---

## Benefits

### For Development
- ✅ Test with different agent combinations
- ✅ Disable flaky agents quickly
- ✅ Add new agents without code changes
- ✅ Separate staging/production configs

### For Operations
- ✅ No code deployment to change agent list
- ✅ Quick rollback if agent causes issues
- ✅ Easy A/B testing of agent sets
- ✅ Config-driven scaling

### For Code Quality
- ✅ Removes hardcoded values
- ✅ Eliminates code duplication (one `guessAgent`)
- ✅ Centralized agent configuration
- ✅ Type-safe agent handling

---

## Future Enhancements (Not in This Plan)

### Phase 2: JSON Configuration

When you need per-agent configuration:

```typescript
type AgentConfig = {
  name: string
  handle: string
  mode: 'linear_mention' | 'http_endpoint'
  endpoint?: string
  enabled: boolean
}
```

**Use cases:**
- HTTP dispatch for agents that don't use Linear
- Custom handles (e.g., `@Cursor` vs `@cursor`)
- Per-agent enable/disable flags
- Agent-specific metadata

---

## Rollout Plan

### Week 1: Implementation
- [ ] Task 1: Create agent-config module (4 hours)
- [ ] Task 2: Update linear-sync (2 hours)
- [ ] Task 3: Update webhook route (1 hour)
- [ ] Task 4: Update tests (2 hours)
- [ ] Task 5: Update docs (1 hour)

### Week 1: Testing
- [ ] Unit tests pass (all 10+ cases)
- [ ] Integration test with custom agents
- [ ] Verify backward compatibility

### Week 2: Deployment
- [ ] Deploy to staging with `ARENA_AGENTS=cursor,engine`
- [ ] Test with real issue
- [ ] Deploy to production with full agent set
- [ ] Monitor logs for config warnings

---

## Success Metrics

- ✅ All hardcoded agent references removed
- ✅ Agent list configurable via env var
- ✅ No code changes needed to add/remove agents
- ✅ Backward compatible (works without env var)
- ✅ Tests pass with custom agent configurations
- ✅ Code duplication eliminated (one `guessAgent`)

---

## Files Changed

**New Files (2):**
- `src/lib/agent-config.ts` (~100 lines)
- `src/lib/agent-config.test.ts` (~150 lines)

**Modified Files (4):**
- `src/lib/linear-sync.ts` (remove AGENT_HANDLES, use config)
- `src/app/api/linear/webhook/route.ts` (use config)
- `src/lib/linear-sync.test.ts` (add env setup)
- `src/app/api/linear/webhook/route.test.ts` (add env setup)

**Documentation (3):**
- `README.md` (add ARENA_AGENTS env var)
- `.env.local.example` (add ARENA_AGENTS)
- `docs/plans/2025-11-12-dynamic-agent-configuration.md` (this file)

---

## Risk Assessment

**Low Risk** 🟢

- Backward compatible (fallback to defaults)
- Simple CSV format (no parsing complexity)
- Well-tested (10+ test cases)
- No database changes
- No breaking changes

**Mitigation:**
- Warning logged if env var not set
- Graceful fallback ensures existing deployments work
- Unit tests verify all edge cases

---

## Timeline

**Estimated: 1-2 days (1 developer)**

| Task | Duration |
|------|----------|
| Create agent-config module | 4 hours |
| Update linear-sync | 2 hours |
| Update webhook route | 1 hour |
| Update tests | 2 hours |
| Documentation | 1 hour |
| Code review | 2 hours |
| **Total** | **12 hours** |

---

**Status:** Ready for implementation
**Recommendation:** Implement before GitHub webhook work
**Next Steps:** Create agent-config module, write tests, update references
