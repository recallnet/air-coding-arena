# Vitest Test Execution Performance

**Status**: Not Started
**Priority**: Medium
**Estimated Impact**: 20-40% faster test execution
**Owner**: TBD

## Context

Our test suite runs via Vitest with the following characteristics:
- 763 total tests across 62 test files
- Takes ~75 seconds for test execution (plus ~89s setup, ~270s environment overhead)
- Uses thread-based worker pool with 1-8 threads
- Sharded across 4 runners in CI (each shard takes similar time)
- 90% coverage requirements enforced on all metrics

Current configuration in `vitest.config.ts`:
```
pool: 'threads'
maxThreads: 8
minThreads: 1
```

## Objective

Optimize Vitest configuration to reduce test execution time while maintaining test isolation, reliability, and coverage requirements.

## Key Areas to Investigate

### 1. Worker Pool Strategy
Vitest offers different worker pool modes:
- `threads` (current)
- `forks`
- `vmThreads`

Research:
- What are the performance characteristics of each pool type?
- What are the tradeoffs in terms of isolation vs speed?
- Which pool type is best suited for our test suite composition?
- How does this interact with test sharding in CI (4 shards)?

### 2. Test Isolation Settings
Current config uses strict isolation with mocks reset between tests. Consider:
- `isolate: true` (default) vs `isolate: false` - what's the impact?
- Are our tests truly independent, or do they share state?
- What are the risks of reducing isolation?
- Can we measure if reduced isolation causes flaky tests?

### 3. Parallel Execution
Configuration options:
- `fileParallelism` - run test files in parallel
- Number of workers - how many concurrent test executions
- Shard size - is 4 shards optimal?

Questions:
- Are we maximizing parallelism within each shard?
- How does the number of test files (62) relate to optimal worker count?
- What's the overhead of spawning workers vs actual test time?

### 4. Setup and Environment Overhead
Current metrics show:
- Setup: 89.74s
- Environment: 269.42s
- Actual tests: 74.99s

Investigate:
- What causes the environment overhead (269s is 3.6x test time)?
- Is jsdom environment initialization the bottleneck?
- Can we reduce setup time with better module resolution?
- Are there any imports that can be lazy-loaded?

### 5. Coverage Collection Performance
Coverage adds overhead with v8 provider. Consider:
- Is coverage slowing down test execution significantly?
- Should we collect coverage differently in CI vs local development?
- Are there files we're collecting coverage for unnecessarily?

## Success Criteria

- [ ] Test execution time reduced by at least 20%
- [ ] No flaky tests introduced
- [ ] All 763 tests continue to pass
- [ ] 90% coverage maintained on all metrics (lines, functions, branches, statements)
- [ ] Performance improvements work both locally and in CI
- [ ] No test isolation issues (verify with multiple runs)

## Testing Requirements

1. Run tests 10+ times locally to check for flakiness
2. Run full CI pipeline 5+ times to verify consistency
3. Introduce an intentional test failure and verify it's still caught
4. Verify that test execution order doesn't affect results
5. Check coverage reports are still accurate

## Constraints

- MUST NOT lower 90% coverage thresholds
- MUST NOT introduce flaky tests or test interdependencies
- MUST maintain test isolation where it matters (database mocks, etc.)
- Configuration should work on developer machines (various CPUs) and CI runners

## Resources

- Current config: `vitest.config.ts`
- Test setup: `src/__tests__/vitest-setup.ts`
- Vitest documentation on worker pools and performance
- Current test execution metrics (in the PR description)

## Experiments to Run

1. **Baseline**: Measure current performance over 5 runs
2. **Pool comparison**: Test threads vs forks vs vmThreads
3. **Isolation experiment**: Try `isolate: false` and run 20x to check for flakiness
4. **Worker tuning**: Try different maxThreads values (2, 4, 8, 16)
5. **Shard analysis**: Check if test distribution across 4 shards is balanced

## Questions to Answer

1. Where is the 269s environment overhead coming from?
2. Is our test suite CPU-bound or I/O-bound?
3. How much overhead does coverage collection add?
4. Are some test files significantly slower than others?
5. What's the optimal worker count for our test suite size?
