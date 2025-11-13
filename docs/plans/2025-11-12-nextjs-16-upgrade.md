# Next.js 16 Upgrade Plan

**Date**: 2025-11-12
**Status**: Research Complete
**Priority**: Medium (Strategic - not urgent)
**Complexity**: 7/10 (Moderate-to-High)
**Estimated Effort**: 8-16 hours

---

## Executive Summary

Next.js 16 was released on **October 21, 2025** with significant improvements focused on explicit caching, async APIs, and Turbopack as the default bundler. This project is currently on **Next.js 15.0.3** and is **well-positioned for migration** due to already using async params patterns.

**Key Finding**: ✅ **Our codebase is already Next.js 16 compliant** for the biggest breaking change (async params)!

**Main Challenges**:
1. React 18 → 19 upgrade (required dependency)
2. Webpack config decision (opt-out vs Turbopack)
3. Node.js 18 → 20 version bump

**Recommendation**: **✅ Proceed** - Benefits outweigh risks, especially Turbopack performance gains (2-10x faster builds).

---

## Current Project State

### Dependencies
```json
{
  "next": "15.0.3",
  "react": "18.3.1",
  "react-dom": "18.3.1",
  "typescript": "5.6.3",
  "node": ">=18.18.0"
}
```

### Architecture Analysis
- ✅ **App Router**: Fully adopted (no Pages Router)
- ✅ **Async Params**: Already using `await params` pattern
- ✅ **ESLint 9**: Using flat config (modern)
- ✅ **TypeScript 5.6.3**: Exceeds 5.1.0 requirement
- ✅ **Test Coverage**: 90%+ requirement provides safety net
- ❌ **No Middleware**: Good - avoids proxy.ts migration
- ⚠️ **Custom Webpack Config**: Linear SDK warning suppression

---

## Breaking Changes Impact Assessment

### 1. ⚠️ Async Request APIs - ✅ ALREADY COMPLIANT

**Status**: **ZERO MIGRATION NEEDED**

Our dynamic routes already use the Next.js 16 pattern:

**`src/app/agents/[agentName]/page.tsx:106`**:
```typescript
const { agentName } = await params
```

**`src/app/issues/[id]/page.tsx:153`**:
```typescript
const { id } = await params
```

**Impact**: ✅ **NONE** - Code is future-ready!

---

### 2. ⚠️ Minimum Version Requirements - 🔴 ACTION REQUIRED

**Required Changes**:

| Dependency | Current | Required | Action |
|------------|---------|----------|--------|
| Node.js | 18.18.0+ | **20.9.0+** | Update package.json + deployments |
| React | 18.3.1 | **19.2+** | Major upgrade (see below) |
| TypeScript | 5.6.3 | 5.1.0+ | ✅ Already compliant |

**Impact**: 🔴 **HIGH** - React 19 is a major version upgrade

---

### 3. ⚠️ Turbopack as Default Bundler - 🟡 DECISION REQUIRED

**Current Webpack Config** (`next.config.js:24-31`):
```javascript
webpack: (config, { isServer }) => {
  if (isServer) {
    config.ignoreWarnings = [{ module: /node_modules\/@linear\/sdk/ }]
  }
  return config
}
```

**Problem**: Turbopack doesn't support `ignoreWarnings` configuration.

**Options**:

**Option A (Conservative)**: Opt-out to webpack
```json
"scripts": {
  "dev": "next dev -p 3109 --webpack",
  "build": "npm run validate && next build --webpack"
}
```
- ✅ Keeps current behavior
- ❌ Misses Turbopack performance gains (2-10x faster)

**Option B (Progressive)**: Adopt Turbopack
```javascript
// Remove webpack config, tolerate Linear SDK warnings
```
- ✅ 2-10x faster builds and dev server
- ❌ Linear SDK warnings reappear
- ⚠️ Can revert to Option A if needed

**Recommendation**: Start with **Option A** (safe), test **Option B** in parallel branch.

**Impact**: 🟡 **MEDIUM** - Requires testing and decision

---

### 4. ⚠️ Other Breaking Changes - ✅ NOT APPLICABLE

| Change | Status | Impact |
|--------|--------|--------|
| Middleware → proxy.ts rename | ✅ No middleware.ts exists | NONE |
| `revalidateTag()` / `updateTag()` | ✅ Not used in codebase | NONE |
| `next lint` command removed | ✅ Already using `eslint .` directly | NONE |

---

## React 19 Upgrade Considerations

### Why Required?
Next.js 16 App Router depends on React 19.2+ (uses React Canary features).

### React 19 New Features
- **View Transitions** - Native element transitions during navigation
- **useEffectEvent** - Extract non-reactive logic from Effects
- **Activity API** - Render background activity while maintaining state
- **Server Components improvements** - Better streaming, async transitions

### Potential Breaking Changes
- ⚠️ Changed error handling in server components
- ⚠️ Stricter hydration mismatch detection
- ⚠️ Type changes in @types/react and @types/react-dom
- ⚠️ Deprecated APIs removed (rare in modern codebases)

### Dependency Compatibility

**Verified Compatible**:
- ✅ **drizzle-orm** 0.44.7 - Fully compatible
- ✅ **postgres** 3.4.7 - No React dependencies
- ✅ **@testing-library/react** 16.0.1 - Supports React 19
- ✅ **vitest** 2.1.3 - No React constraints

**Needs Verification**:
- ⚠️ **lucide-react** 0.553.0 - Check release notes
- ⚠️ **geist** 1.5.1 - Check React 19 support
- ⚠️ **@geist-ui/icons** 2.1.1 - Check compatibility

**Action**: Test visual components thoroughly after upgrade.

---

## New Features Worth Adopting

### 1. ⭐ Cache Components with "use cache" - HIGH VALUE

**What**: Opt-in caching system replacing implicit caching.

**Benefits**:
- Explicit control over what gets cached
- Better performance predictability
- Works with Server Components and Server Actions

**Perfect for our queries** (`src/lib/queries.ts`):
```typescript
'use cache'

export async function getAgentStats(limit?: number) {
  // This result will be cached automatically
  // 50-80% performance gain for repeated reads
  return await db.select(/* ... */)
}

'use cache'
export async function getAgentTemporalStats(/* ... */) {
  // Cached separately from getAgentStats
}
```

**Impact**: 🟢 **HIGH VALUE** - Major performance wins for leaderboard queries

**Recommended**: Yes - adopt during migration

---

### 2. ⭐ updateTag() API - MEDIUM VALUE

**What**: New Server Actions API with read-your-writes semantics.

**Benefits**:
- Expire cache AND immediately refresh within same request
- Better UX for interactive features
- No stale data between mutations

**Perfect for webhooks** (`src/app/api/github/webhook/route.ts:320`):
```typescript
// Current
await updateRatingsForIssue(attempt.issueId)

// With updateTag()
import { updateTag } from 'next/cache'

await updateRatingsForIssue(attempt.issueId)
await updateTag('agent-stats', { cacheLife: 'default' })
// Leaderboard immediately shows updated ratings
```

**Impact**: 🟡 **MEDIUM VALUE** - Improves webhook response accuracy

**Recommended**: Yes - adopt after initial migration stabilizes

---

### 3. ⭐ React Compiler (Stable) - MEDIUM VALUE

**What**: Automatic memoization without `useMemo`/`useCallback`.

**Benefits**:
- Zero manual optimization needed
- Reduces unnecessary re-renders
- Improves component performance (10-20% faster)

**Trade-off**: Slower build times (uses Babel).

**Configuration**:
```javascript
// next.config.js
const nextConfig = {
  reactCompiler: true, // Now stable in Next.js 16!
}
```

**Impact**: 🟡 **MEDIUM VALUE** - Better runtime performance, slower builds

**Recommended**: Test in staging after core migration

---

### 4. ⭐ Turbopack Performance - HIGH VALUE

**Benefits**:
- **Up to 10x faster Fast Refresh** in dev mode
- **2-5x faster production builds**
- Filesystem caching for faster restarts
- Zero configuration needed

**Trade-off**: Linear SDK warnings reappear (can opt-out if critical).

**Impact**: 🟢 **HIGH VALUE** - Significant DX improvement

**Recommended**: Test after core migration stabilizes

---

## Migration Strategy (6 Phases)

### Phase 1: Preparation (30 min)

**Goal**: Set up safety nets and backups.

**Steps**:
1. Create feature branch
   ```bash
   git checkout -b feat/nextjs-16-upgrade
   ```

2. Create rollback point
   ```bash
   git tag pre-nextjs-16-upgrade
   ```

3. Update Node.js requirement
   ```json
   // package.json
   "engines": {
     "node": ">=20.9.0",
     "npm": ">=9.0.0"
   }
   ```

4. Ensure local Node.js is 20.9.0+
   ```bash
   node --version # Should be 20.9.0+
   ```

**Deliverable**: Feature branch ready, rollback point created.

---

### Phase 2: Automated Upgrade (1-2 hours)

**Goal**: Let Next.js codemod handle mechanical changes.

**Steps**:
1. Run Next.js upgrade codemod
   ```bash
   npx @next/codemod@canary upgrade latest
   ```

   This will:
   - Update package.json to Next.js 16
   - Update React to 19.x
   - Update related dependencies
   - Apply automated code transforms

2. Install dependencies
   ```bash
   npm install
   ```

3. Verify installation
   ```bash
   npm list next react react-dom
   ```

**Expected Output**:
```
├── next@16.x.x
├── react@19.x.x
└── react-dom@19.x.x
```

**Deliverable**: Dependencies upgraded, node_modules updated.

---

### Phase 3: Configuration Updates (30 min)

**Goal**: Handle webpack config and verify ESLint.

**Steps**:
1. **Webpack Config Decision**

   **Conservative Approach (Recommended for Phase 3)**:
   ```json
   // package.json
   "scripts": {
     "dev": "next dev -p 3109 --webpack",
     "build": "npm run validate && next build --webpack"
   }
   ```

   **Progressive Approach (Test later)**:
   - Remove or comment out webpack config in next.config.js
   - Test if Linear SDK warnings are acceptable

2. **Verify ESLint Config**
   ```bash
   npm run lint
   ```

   Should pass (already using ESLint 9 + flat config).

**Deliverable**: Configuration updated, webpack opt-out in place.

---

### Phase 4: Testing & Validation (2-4 hours)

**Goal**: Catch regressions before deployment.

**Steps**:

1. **Type Checking**
   ```bash
   npm run type-check
   ```

   **Expected**: Pass (TypeScript 5.6.3 exceeds requirements)

   **If failures**: Check @types/react and @types/react-dom changes

2. **Linting**
   ```bash
   npm run lint
   ```

   **Expected**: Pass (ESLint 9 already compliant)

3. **Test Suite**
   ```bash
   npm test
   ```

   **Expected**: 595/595 tests pass, 90%+ coverage maintained

   **If failures**: Focus on component rendering tests (React 19 changes)

4. **Build Verification**
   ```bash
   npm run build
   ```

   **Expected**: Clean build with no errors

   **Watch for**: Linear SDK warnings (expected with webpack opt-out)

5. **Dev Server Smoke Test**
   ```bash
   npm run dev
   ```

   Open http://localhost:3109, verify:
   - [ ] Homepage loads and displays leaderboard
   - [ ] Agent detail page loads (pick any agent)
   - [ ] Issue detail page loads (pick any issue)
   - [ ] No console errors
   - [ ] Fast Refresh works (edit a component, verify hot reload)

**Deliverable**: All automated checks pass, manual smoke test complete.

---

### Phase 5: Manual Testing Checklist (2-3 hours)

**Goal**: Validate critical user paths.

**Testing Scenarios**:

**Frontend**:
- [ ] Homepage displays agent leaderboard correctly
- [ ] Agent stats update on page refresh
- [ ] Temporal chart renders (if using chart library)
- [ ] Navigation between pages works
- [ ] Lucide icons display correctly
- [ ] Geist fonts load correctly
- [ ] No hydration mismatch errors in console

**Dynamic Routes**:
- [ ] `/agents/cursor` loads
- [ ] `/agents/engine` loads
- [ ] `/issues/[valid-uuid]` loads
- [ ] Invalid routes show proper 404

**API Routes**:
- [ ] GitHub webhook endpoint responds (test with curl)
- [ ] Linear webhook endpoint responds (test with curl)
- [ ] Database queries execute successfully

**Database**:
- [ ] Drizzle ORM queries work (check logs)
- [ ] No connection errors
- [ ] Data displays correctly on frontend

**Performance** (baseline for later comparison):
- [ ] Measure dev server startup time
- [ ] Measure build time (`time npm run build`)
- [ ] Measure page load time (browser DevTools)

**Deliverable**: All critical paths validated, performance baseline recorded.

---

### Phase 6: Optional Enhancements (2-4 hours)

**Goal**: Adopt Next.js 16 features for performance gains.

**6A: Add Cache Components** (1-2 hours)

**Benefit**: 50-80% performance gain for cached queries.

**Implementation**:
```typescript
// src/lib/queries.ts

'use cache'
export async function getAgentStats(limit?: number) {
  // Existing implementation
}

'use cache'
export async function getAgentTemporalStats(
  agentName: string,
  startDate: Date,
  endDate: Date
) {
  // Existing implementation
}

'use cache'
export async function getIssuesWithAgents(
  filters?: IssueFilters,
  limit?: number
) {
  // Existing implementation
}
```

**Testing**:
```bash
npm run build
npm test
# Verify leaderboard still loads correctly
```

---

**6B: Add updateTag() to Webhooks** (30 min)

**Benefit**: Immediate leaderboard updates after webhook processing.

**Implementation**:
```typescript
// src/app/api/github/webhook/route.ts:320

import { updateTag } from 'next/cache'

await updateRatingsForIssue(attempt.issueId)
await updateTag('agent-stats', { cacheLife: 'default' })
console.log(`[GitHub] Updated ratings and cache for issue ${attempt.issueId}`)
```

**Testing**:
- Trigger webhook (or simulate with test)
- Refresh leaderboard immediately
- Verify updated ratings appear

---

**6C: Test Turbopack** (1 hour)

**Benefit**: 2-10x faster builds and dev server.

**Implementation**:
```json
// package.json - Remove --webpack flags
"scripts": {
  "dev": "next dev -p 3109",
  "build": "npm run validate && next build"
}
```

**Testing**:
1. Remove webpack config from next.config.js
2. Run `npm run build`
3. Check for Linear SDK warnings
4. Measure build time vs. baseline
5. Run `npm run dev`, measure startup time
6. Test Fast Refresh (edit component, verify reload)

**Decision Criteria**:
- If build is 2x+ faster AND warnings acceptable → Keep Turbopack
- If warnings are problematic → Revert to webpack opt-out

---

**6D: Enable React Compiler** (30 min)

**Benefit**: 10-20% reduction in re-renders.

**Trade-off**: 5-10% slower build times.

**Implementation**:
```javascript
// next.config.js
const nextConfig = {
  reactCompiler: true,
  // ... other config
}
```

**Testing**:
1. Run `npm run build`
2. Measure build time vs. baseline
3. Run dev server, interact with UI
4. Check for React warnings in console
5. Verify components render correctly

**Decision Criteria**:
- If runtime performance improves → Keep enabled
- If build times become problematic → Disable

**Deliverable**: Performance optimizations adopted, measurements documented.

---

## Rollback Plan

### If Migration Fails

**Step 1: Revert to tag**
```bash
git checkout pre-nextjs-16-upgrade
```

**Step 2: Reinstall dependencies**
```bash
npm install
```

**Step 3: Verify rollback**
```bash
npm run build
npm test
```

### If Turbopack Causes Issues

**Quick fix**: Add `--webpack` flag
```json
"scripts": {
  "dev": "next dev -p 3109 --webpack",
  "build": "npm run validate && next build --webpack"
}
```

### If React 19 Causes Issues

**Downgrade React** (last resort):
```bash
npm install react@18.3.1 react-dom@18.3.1
```

**Note**: This will force you back to Next.js 15.

---

## Success Criteria

### Phase 4 (Required for Merge)
- [ ] All 595 tests pass
- [ ] 90%+ code coverage maintained
- [ ] Type checking passes (no errors)
- [ ] Linting passes (zero warnings)
- [ ] Build completes successfully
- [ ] Dev server starts without errors

### Phase 5 (Required for Merge)
- [ ] Homepage loads correctly
- [ ] Agent detail pages work
- [ ] Issue detail pages work
- [ ] Webhooks respond correctly
- [ ] Database queries execute
- [ ] No console errors during navigation

### Phase 6 (Optional)
- [ ] Cache Components improve query performance by 50%+
- [ ] updateTag() ensures fresh data after webhooks
- [ ] Turbopack provides 2x+ build speed improvement
- [ ] React Compiler reduces re-renders by 10%+

---

## Risk Assessment

### High Risk
1. **React 19 component behavior changes**
   - **Likelihood**: Medium
   - **Impact**: High (broken UI)
   - **Mitigation**: 90% test coverage catches regressions
   - **Fallback**: Rollback to tag

2. **Third-party dependency incompatibility**
   - **Likelihood**: Low-Medium
   - **Impact**: Medium (visual bugs)
   - **Mitigation**: Test visual components thoroughly
   - **Fallback**: Pin incompatible deps to older versions

### Medium Risk
3. **Turbopack breaking Linear SDK integration**
   - **Likelihood**: Low
   - **Impact**: Medium (build warnings/errors)
   - **Mitigation**: Start with webpack opt-out
   - **Fallback**: Keep `--webpack` flag

4. **Performance regression**
   - **Likelihood**: Very Low
   - **Impact**: Medium (slower UX)
   - **Mitigation**: Measure baseline, compare after
   - **Fallback**: Disable React Compiler or cache

### Low Risk
5. **Node.js 20 deployment issues**
   - **Likelihood**: Low
   - **Impact**: High (broken deploy)
   - **Mitigation**: Update deployment config first
   - **Fallback**: Revert deploy, fix config

---

## Timeline Estimate

### Conservative Timeline (3 weeks)
- **Week 1**: Preparation, dependency research, local testing
- **Week 2**: Execute Phases 1-4, fix any issues
- **Week 3**: Manual testing (Phase 5), staging deployment

### Aggressive Timeline (1 week)
- **Day 1-2**: Phases 1-4 (automated upgrade + validation)
- **Day 3**: Phase 5 (manual testing)
- **Day 4-5**: Phase 6 (optional enhancements)

### Recommended: **2 weeks** (balanced)
- **Week 1**: Phases 1-5 (core migration + validation)
- **Week 2**: Phase 6 (enhancements), staging deployment, monitoring

---

## Post-Migration Monitoring

### Week 1 After Deploy
- [ ] Monitor error rates (expect some React 19 hydration warnings initially)
- [ ] Check build times (measure Turbopack improvement)
- [ ] Monitor page load performance (should be same or better)
- [ ] Watch for Linear SDK issues (if using Turbopack)

### Week 2-4 After Deploy
- [ ] Measure cache hit rates (if using "use cache")
- [ ] Verify webhook processing times (if using updateTag)
- [ ] Check developer experience feedback (Fast Refresh speed)
- [ ] Evaluate React Compiler impact (re-render metrics)

### Success Metrics
- ✅ Zero critical production errors
- ✅ Build time improved by 2x+ (with Turbopack)
- ✅ Dev server startup 5x+ faster (with Turbopack)
- ✅ Leaderboard queries 50%+ faster (with "use cache")

---

## Conclusion

### Recommendation: ✅ **PROCEED WITH MIGRATION**

**Strengths**:
1. ✅ Already using async params (biggest breaking change handled)
2. ✅ No middleware (avoids proxy.ts complexity)
3. ✅ Modern ESLint + TypeScript (no config migration)
4. ✅ 90% test coverage (safety net for regressions)
5. ✅ Drizzle ORM verified compatible

**Challenges** (all manageable):
1. ⚠️ React 19 upgrade (test suite catches issues)
2. ⚠️ Webpack config decision (can opt-out safely)
3. ⚠️ Node.js 20 requirement (deployment config update)

**Expected Benefits**:
- 🟢 2-10x faster builds (Turbopack)
- 🟢 50-80% faster queries (Cache Components)
- 🟢 Future-proofing (Next.js 15 will EOL)
- 🟢 Better DX (Fast Refresh improvements)

### Next Steps
1. Review this plan with team
2. Schedule 2-week sprint for migration
3. Create feature branch
4. Execute Phase 1-5 in Week 1
5. Optional enhancements in Week 2
6. Deploy to staging, monitor, then production

---

## References

- [Next.js 16 Release Notes](https://nextjs.org/blog/next-16)
- [React 19 Release Notes](https://react.dev/blog/2025/10/react-19)
- [Next.js Upgrade Guide](https://nextjs.org/docs/upgrading)
- [Turbopack Documentation](https://turbo.build/pack/docs)
- [Cache Components RFC](https://github.com/vercel/next.js/discussions/54075)
