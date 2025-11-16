# GitHub Actions Performance Optimization

**Status**: Not Started
**Priority**: High
**Estimated Impact**: 30-50% faster CI runs
**Owner**: TBD

## Context

Our GitHub Actions CI workflow (`.github/workflows/ci-fast-and-tests.yml`) currently takes 2-3 minutes per job. While we have test sharding in place (4 shards), each shard reinstalls dependencies from scratch and doesn't leverage caching effectively.

The workflow currently:
- Uses `actions/setup-node@v4` with basic npm cache
- Runs `npm ci` on every run (downloads all packages)
- Has no caching for Next.js build artifacts
- Repeats dependency installation across both jobs (fast-checks and tests)

## Objective

Optimize the GitHub Actions workflow to reduce execution time through better caching strategies, without compromising reliability or test coverage.

## Key Areas to Investigate

### 1. Dependency Caching
Currently we use `cache: 'npm'` in the setup-node action, but `npm ci` still takes 30-60 seconds per job. Research:
- How does GitHub Actions cache work with `actions/cache@v4`?
- Can we cache `node_modules` directly instead of just the npm cache directory?
- What are the tradeoffs between caching strategies?
- How do we ensure cache invalidation when `package-lock.json` changes?

### 2. Next.js Build Cache
Next.js generates a `.next/cache` directory that can be reused across builds. Consider:
- Does caching `.next/cache` speed up subsequent builds?
- How do we ensure the cache is invalidated when source files change?
- What files should be included in the cache key to balance hit rate vs correctness?

### 3. npm ci Optimization
The `npm ci` command has flags that might speed up installation:
- Research what flags are available (check npm documentation)
- Which flags are safe to use in CI without compromising reproducibility?
- How do different flags interact with caching strategies?

### 4. Artifact Reuse Between Jobs
Currently both `fast-checks` and `tests` jobs install dependencies independently:
- Can we share artifacts between jobs to avoid duplicate installs?
- What are the tradeoffs in terms of complexity vs speed?

## Success Criteria

- [ ] CI run time reduced by at least 30% (measure before/after)
- [ ] All tests continue to pass with the same coverage thresholds
- [ ] Cache hit rate is measurable and logged
- [ ] Cache invalidation works correctly when dependencies change
- [ ] No flaky tests introduced by caching issues
- [ ] Documentation updated to explain the caching strategy

## Testing Requirements

Before merging:
1. Run CI 3+ times with cache hits to ensure stability
2. Make a dependency change and verify cache invalidation
3. Make a source code change and verify appropriate cache behavior
4. Check that all 4 test shards still work correctly

## Constraints

- DO NOT lower test coverage requirements
- DO NOT skip any existing validation steps
- DO NOT introduce non-deterministic behavior
- MUST work with GitHub-hosted runners (ubuntu-latest)

## Resources

- Current workflow: `.github/workflows/ci-fast-and-tests.yml`
- GitHub Actions cache documentation
- Next.js documentation on build caching
- npm documentation on ci command flags

## Questions to Answer

1. What is the current breakdown of time spent in each CI step?
2. What cache hit rate can we realistically achieve?
3. Are there any risks with caching that we need to mitigate?
4. How does this interact with the test sharding strategy?
