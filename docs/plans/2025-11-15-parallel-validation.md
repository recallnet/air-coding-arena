# Parallel Validation Execution

**Status**: Not Started
**Priority**: Medium
**Estimated Impact**: 40%+ faster validation locally
**Owner**: TBD

## Context

Our validation pipeline in `package.json` currently runs steps sequentially:

```json
"validate": "npm run type-check && npm run lint && npm run test && npm run format:check"
```

This means:
- Type-check runs first (~30-60s)
- Then lint (~20-40s)
- Then tests (~90s with coverage)
- Finally format check (~5-10s)
- **Total: ~2-3 minutes**

These steps are independent - they don't depend on each other's output. They could run in parallel.

## Objective

Modify the validation script to run all checks in parallel, reducing total validation time from ~3 minutes to the duration of the slowest check (~90s for tests).

## Key Areas to Investigate

### 1. Parallel Execution Tools
Several npm packages can run scripts in parallel:
- `npm-run-all` with `--parallel` flag
- `concurrently`
- Unix `&` backgrounding with `wait`
- Other tools?

Research:
- Which tool is most reliable?
- How do they handle failures (if one check fails, kill the others)?
- How do they handle output (interleaved vs separate streams)?
- Cross-platform support (Windows, Mac, Linux)?

### 2. Output Handling
When running in parallel, stdout/stderr from different processes interleave. Consider:
- How do we present output clearly to developers?
- Should we buffer output and print per-check?
- How do we handle colored output from different tools?
- What happens when a check fails mid-stream?

### 3. Failure Behavior
When one check fails:
- Should other checks continue or be killed immediately?
- How do we report which check(s) failed?
- What exit code should the overall validation return?

Options:
- **Fail-fast**: Kill all checks as soon as one fails
- **Fail-complete**: Let all checks complete, then report all failures

### 4. Resource Contention
Running all checks in parallel means:
- Multiple Node.js processes competing for CPU
- Tests spawning their own worker threads (1-8 threads)
- TypeScript compiler running
- ESLint running

Questions:
- Will CPU saturation make each check slower?
- Is there an optimal balance (e.g., parallel on CI, sequential locally)?
- Should we limit test parallelism when running in validation mode?

### 5. CI vs Local Development
Consider different strategies for different environments:
- **CI**: Separate jobs already run in parallel - is this needed?
- **Local**: Parallel would help for pre-commit hooks
- **Pre-push**: Same as local

Should we have different scripts for different contexts?

### 6. Pre-commit Hook Integration
Our `.husky/pre-commit` hook runs `validate`. Consider:
- How does parallel execution affect the commit flow?
- Can developers easily see which check failed?
- Is the output clear in the Git commit UI?

## Success Criteria

- [ ] Validation time reduced by at least 40% (measure before/after)
- [ ] All checks still run to completion (unless fail-fast mode)
- [ ] Failed checks are clearly identified
- [ ] Output is readable and not overly interleaved
- [ ] Works on Mac, Linux, and Windows
- [ ] Exit code correctly indicates success/failure
- [ ] Pre-commit hook UX is not degraded

## Testing Requirements

1. **Baseline**: Measure current sequential validation time
2. **Parallel timing**: Measure parallel validation time
3. **All pass**: Run when all checks should pass, verify success
4. **Type error**: Introduce type error, verify it's caught and reported
5. **Lint error**: Introduce lint error, verify caught
6. **Test failure**: Introduce failing test, verify caught
7. **Format error**: Introduce formatting error, verify caught
8. **Multiple failures**: Introduce multiple errors, verify all are reported
9. **Output readability**: Check that output is clear enough for debugging

## Constraints

- MUST catch all errors (no false negatives)
- MUST work on all developer platforms
- MUST NOT require additional native dependencies
- Output should be clear enough for developers to understand failures
- Should not significantly increase CPU usage to the point of slowing down individual checks

## Resources

- Current validate script: `package.json` line 24
- Pre-commit hook: `.husky/pre-commit`
- Documentation for `npm-run-all`, `concurrently`, and similar tools

## Experiments to Run

1. **npm-run-all**: Test with `npm-run-all --parallel`
2. **concurrently**: Test with `concurrently "npm:type-check" "npm:lint" "npm:test" "npm:format:check"`
3. **Timing comparison**: Measure sequential vs parallel
4. **Failure modes**: Test each type of failure in parallel mode
5. **Resource usage**: Monitor CPU usage during parallel execution

## Questions to Answer

1. Which tool provides the best developer experience?
2. What's the actual time savings (theoretical best case: from 3min to 90s)?
3. Does CPU contention reduce the benefit?
4. Should we use different strategies for CI vs local?
5. How do we handle the test coverage requirement when running in parallel?
6. Is output readability acceptable for debugging?

## Implementation Considerations

**Option 1: npm-run-all**
```json
"validate": "npm-run-all --parallel type-check lint test format:check"
```

Pros: Simple, designed for this use case
Cons: Additional dependency, need to research failure behavior

**Option 2: concurrently**
```json
"validate": "concurrently \"npm:type-check\" \"npm:lint\" \"npm:test\" \"npm:format:check\""
```

Pros: Popular, good output handling
Cons: Additional dependency, syntax is a bit more complex

**Option 3: Shell scripting**
```json
"validate": "npm run type-check & npm run lint & npm run test & npm run format:check & wait"
```

Pros: No dependencies
Cons: Shell differences, unclear error handling, poor output

## Advanced Considerations

- Should we add a `validate:sequential` script as a fallback?
- Would parallel execution benefit other scripts (e.g., `vercel-build`)?
- Can we optimize the slowest check (tests) to make the benefit even greater?
- Should fast checks (format:check) run first for early feedback?
- Consider a "smart" mode that profiles and optimizes execution order
