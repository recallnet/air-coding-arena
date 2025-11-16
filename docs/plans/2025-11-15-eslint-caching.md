# ESLint Caching and Performance

**Status**: Not Started
**Priority**: Medium
**Estimated Impact**: 30%+ faster linting
**Owner**: TBD

## Context

ESLint is a critical part of our quality checks but can be slow on large codebases:
- Runs on every commit (pre-commit hook)
- Runs in CI on every push
- Enforces zero warnings (`--max-warnings 0`)
- Uses 13 different ESLint plugins with various rules

Current configuration:
- Config file: `eslint.config.mjs` (flat config format)
- Zero tolerance policy (fail on any warning)
- No caching currently enabled

## Objective

Implement ESLint caching to speed up repeated runs, especially in local development, while maintaining the same quality standards and zero-warning policy.

## Key Areas to Investigate

### 1. ESLint Cache Flag
ESLint has a built-in `--cache` flag. Research:
- How does the cache work?
- What does it cache (file contents? AST? rule results?)
- How is cache invalidation handled?
- What happens if a rule configuration changes?

Questions:
- Is the cache safe (no false negatives)?
- How much space does the cache file take?
- Where should the cache file be stored (`--cache-location`)?

### 2. Cache Strategy
Consider the different caching approaches:
- Cache location: `.eslintcache` in project root vs elsewhere
- Cache lifetime: when should it be invalidated?
- Git integration: should cache be in `.gitignore`?

### 3. CI Integration
For CI benefits:
- Should we cache the `.eslintcache` file in GitHub Actions?
- What's the cache hit rate on typical PRs (few files changed)?
- What if eslint config changes - how do we invalidate?

Tradeoffs:
- Complexity of managing cache in CI
- Speed benefit when only a few files changed
- Risk of stale cache causing missed warnings

### 4. Flat Config Considerations
We use the newer flat config format (`eslint.config.mjs`):
- Does caching work differently with flat config vs legacy `.eslintrc`?
- Are there any known issues or limitations?
- Check ESLint documentation for flat config specific notes

### 5. Plugin and Rule Performance
We have 13 plugins. Consider:
- Are some plugins significantly slower than others?
- Can we profile ESLint to find slow rules?
- Would disabling certain rules in development but keeping them in CI help?

## Success Criteria

- [ ] First lint run takes the same time (baseline)
- [ ] Subsequent lint runs with no changes are 50%+ faster
- [ ] Lint runs with few file changes are 30%+ faster
- [ ] Cache invalidation works correctly (eslint config changes detected)
- [ ] Zero-warning policy still enforced
- [ ] No false negatives (cache doesn't hide violations)

## Testing Requirements

1. **Baseline**: Measure lint time without cache (3 runs, average)
2. **Cold cache**: First run with `--cache` enabled
3. **Warm cache, no changes**: Run twice, measure second run
4. **Warm cache, few changes**: Modify 1-2 files, measure lint time
5. **Config change**: Modify eslint.config.mjs, verify cache invalidation
6. **Violation detection**: Introduce intentional violation, verify it's caught
7. **CI integration**: Test caching in GitHub Actions

## Constraints

- MUST catch all ESLint violations (no false negatives)
- MUST maintain zero-warning policy (`--max-warnings 0`)
- MUST NOT commit cache file to git
- Configuration should work locally and in CI
- Cache invalidation must work when config changes

## Resources

- Current ESLint config: `eslint.config.mjs`
- Lint scripts in `package.json`: `"lint"` and `"lint:fix"`
- ESLint documentation on caching
- List of our ESLint plugins (in package.json devDependencies)

## Experiments to Run

1. Add `--cache` flag to lint script, measure improvement
2. Try different cache locations
3. Profile ESLint to identify slow rules/plugins (use `TIMING=1` env var)
4. Test cache behavior when config changes
5. Implement CI caching and measure benefit on typical PRs

## Questions to Answer

1. What's the current lint time breakdown by plugin/rule?
2. How much space does the cache file take?
3. What's the cache hit rate on typical PRs (few files changed)?
4. Are there any ESLint rules that don't cache well?
5. Should we use different cache strategies for local vs CI?

## Performance Profiling

Before implementing, profile current ESLint performance:
```bash
TIMING=1 eslint . --max-warnings 0
```

Identify:
- Which plugins are slowest?
- Which rules have the most overhead?
- Are there any rules we could reconsider or configure differently?

## Advanced Considerations

- ESLint v9 introduced performance improvements - are we on latest?
- Would switching to oxlint or other faster linters be worth investigating?
- Can we split linting into multiple passes (fast rules first, slow rules later)?
- Should we lint in parallel for different file types?
