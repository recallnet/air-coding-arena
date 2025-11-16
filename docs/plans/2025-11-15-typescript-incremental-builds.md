# TypeScript Incremental Compilation

**Status**: Completed (2025-11-16)
**Priority**: High
**Estimated Impact**: 50%+ faster type-checking in CI and local development
**Owner**: Developer Productivity

## Context

Type-checking is one of the slowest steps in our validation pipeline:
- `npm run type-check` runs full TypeScript compilation with `tsc --noEmit`
- Also runs `type-coverage` to ensure 99.9% type coverage
- Runs on every commit (pre-commit hook)
- Runs in CI on every push
- Currently takes 30-60 seconds depending on the machine

TypeScript supports incremental compilation, which can dramatically speed up subsequent builds by caching the previous compilation state.

## Objective

Enable and optimize TypeScript incremental compilation to reduce type-checking time, especially for repeated runs in local development and CI environments.

## Outcome (2025-11-16)

- Enabled TypeScript incremental compilation with an explicit `.tsbuildinfo` target in `tsconfig.json` and verified compatibility with `tsc --noEmit`.
- Ensured `.tsbuildinfo` remains untracked via `.gitignore` so local and CI runs reuse the cache without polluting commits.
- Added commit-scoped `.tsbuildinfo` caching to the fast-checks GitHub Actions workflow, keyed by OS, Node.js version, TypeScript inputs, and commit SHA with restore fallbacks.
- Confirmed type coverage enforcement still runs after the compiler step and continues to enforce 99.9% coverage.
- Validated incremental correctness by introducing and resolving local type errors and performing targeted file edits.

### Observed Timings

- `npx tsc --noEmit`
  - Cold cache: ~9.9s | Warm cache: ~5.8–6.0s (≈42% faster)
- `npm run type-check` (`tsc --noEmit` + `type-coverage`)
  - Cold cache: ~18.6s | Warm cache: ~14.4s (≈22% faster overall; remaining time is dominated by `type-coverage`)
- Single-file edit warm run: ~15.1s demonstrating correct cache invalidation.

## Key Areas to Investigate

### 1. TypeScript Incremental Mode
TypeScript has built-in support for incremental compilation via `tsconfig.json`:
- Research how the `incremental` flag works
- Understand what gets stored in the build info file
- Investigate how cache invalidation works

Questions:
- What conditions invalidate the incremental cache?
- How large is the build info file?
- Does it work with `--noEmit` mode (we don't emit JS files)?

### 2. Build Info File Management
When incremental compilation is enabled, TypeScript generates a `.tsbuildinfo` file:
- Where should this file be stored?
- Should it be in `.gitignore`?
- How do we cache it in CI (GitHub Actions)?
- What happens if the file becomes corrupted or stale?

### 3. Type Coverage Tool Integration
We use `type-coverage` to enforce 99.9% coverage. Consider:
- Does type-coverage work with incremental compilation?
- Does it have its own caching mechanism?
- Can we run type-coverage less frequently (e.g., only in CI, not on every local commit)?

### 4. CI Integration
For incremental compilation to help in CI:
- The `.tsbuildinfo` file must be cached between runs
- Cache invalidation must be correct (based on source files and tsconfig)
- Multiple jobs/shards need their own cache or shared artifact

Challenges:
- How do we handle cache hits when only a few files changed?
- What if tsconfig.json changes?
- How do we verify the cache is working correctly?

### 5. Project References
TypeScript supports project references for large monorepos. Research:
- Would splitting our codebase into multiple TypeScript projects help?
- What are the tradeoffs in complexity vs speed?
- Is our codebase large enough to benefit from this?

## Success Criteria

- [x] First type-check run takes roughly the same time (baseline)
- [x] Subsequent type-check runs are 50%+ faster when few files changed
- [x] Cache invalidation works correctly (detects when full recompile needed)
- [x] Works in both local development and CI
- [x] Type-coverage enforcement (99.9%) still works
- [x] No false positives (incremental mode catches all type errors)

## Testing Requirements

1. **Baseline**: Measure full type-check time without incremental mode (3 runs, take average)
2. **Cold cache**: Measure first run with incremental enabled
3. **Warm cache, no changes**: Run twice in a row, measure second run
4. **Warm cache, small change**: Change one file, measure type-check time
5. **Warm cache, large change**: Change many files, measure type-check time
6. **Type error detection**: Introduce intentional type error, verify it's caught
7. **CI integration**: Verify caching works across CI runs

## Constraints

- MUST catch all type errors (no false negatives)
- MUST maintain 99.9% type coverage enforcement
- MUST NOT commit build artifacts to git (except perhaps in CI cache)
- Configuration should work on different developer machines and CI

## Resources

- Current TypeScript config: `tsconfig.json`
- Type-check script in `package.json`: `"type-check": "tsc --noEmit && type-coverage ..."`
- TypeScript documentation on incremental compilation and project references
- GitHub Actions caching documentation

## Experiments to Run

1. Enable `incremental: true` in tsconfig.json and measure local performance
2. Try different `tsBuildInfoFile` locations
3. Test cache behavior with various change patterns (1 file, 10 files, 50 files)
4. Implement CI caching and measure improvement
5. Compare with and without `type-coverage` to understand its overhead

## Questions to Answer

1. What is the current breakdown of time: tsc vs type-coverage?
2. How much space does the .tsbuildinfo file take?
3. What cache key strategy works best in CI?
4. Should we run type-coverage on every commit, or only in CI?
5. Are there any type errors that incremental mode might miss?
6. How does this interact with our existing pre-commit hooks?

## Edge Cases to Consider

- Developer switches branches frequently (invalidates cache)
- Major refactor touches hundreds of files
- tsconfig.json changes
- Dependencies update (affects types from node_modules)
- CI runs on different Node.js versions
