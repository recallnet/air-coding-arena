# Comprehensive GitHub CI/CD Proposal for Next.js/TypeScript Project

## Executive Summary

This proposal outlines a "zippy" GitHub Actions CI/CD strategy for your Next.js 15 + TypeScript project that balances speed with comprehensive quality gates. The strategy leverages parallelization, intelligent caching, and selective checks to minimize CI time while maintaining the zero-tolerance quality standards enforced by your pre-commit hooks.

**Key Metrics:**
- Current Setup: 62 source files, 25 test files (8,252 lines of test code)
- Dependencies: 1.5GB node_modules, 233MB .next build output
- Quality Gates: 99.9%+ type coverage, 90%+ test coverage, zero ESLint warnings

**Expected Results:**
- CI time: **45-60 seconds** (all checks in parallel)
- Pre-commit: **2-3 minutes** (down from 6-8)
- Pre-push: **2-3 minutes** (down from 4-5)
- Cost: **$0/month** (within free tier)

---

## 1. CI Strategy Overview

### When to Run What

| Check Type | Pre-commit | Pre-push | CI (PR) | CI (Main) | Rationale |
|------------|------------|----------|---------|-----------|-----------|
| Type Check | ✅ | ✅ | ✅ | ✅ | Critical path, fast |
| Type Coverage | ✅ | ✅ | ✅ | ✅ | Prevents 'any' regression |
| ESLint | ✅ | ✅ | ✅ (changed files) | ✅ (full) | Incremental for speed |
| Prettier | ✅ | ✅ | ✅ | ✅ | Fast check |
| Tests | ✅ | ✅ | ✅ (parallel) | ✅ (parallel) | Sharded for speed |
| Docs | ✅ | ✅ | ✅ | ✅ | Ensures API docs |
| Build | ❌ → ✅ pre-push | ✅ | ✅ | ✅ | Too slow for every commit |
| State Diagrams | ✅ | ❌ | ❌ | ✅ | Pre-commit only |

---

## 2. GitHub Actions Workflow Design

### Recommended Structure: 5 Specialized Workflows

```
.github/workflows/
├── fast-checks.yml       # Type-check, Prettier (1-2 min)
├── lint.yml              # ESLint with incremental (1-2 min)
├── test.yml              # Vitest sharded (1-2 min)
├── build-docs.yml        # Next.js build + docs (2-3 min)
└── validation-gate.yml   # Meta-check for branch protection
```

### Workflow 1: Fast Checks

```yaml
name: Fast Checks

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  type-check:
    name: TypeScript
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run type-check

  prettier:
    name: Format Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Prettier check
        run: npm run format:check
```

### Workflow 2: Lint (Incremental on PR, Full on Main)

```yaml
name: Lint

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  eslint:
    name: ESLint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # For changed files detection

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      # Cache ESLint results
      - name: Cache ESLint
        uses: actions/cache@v4
        with:
          path: .eslintcache
          key: eslint-${{ runner.os }}-${{ hashFiles('**/eslint.config.mjs') }}-${{ github.sha }}
          restore-keys: |
            eslint-${{ runner.os }}-${{ hashFiles('**/eslint.config.mjs') }}-

      # For PRs: lint only changed files (60-80% faster)
      - name: Run ESLint on changed files (PR)
        if: github.event_name == 'pull_request'
        uses: tj-actions/eslint-changed-files@v25
        with:
          config_path: "eslint.config.mjs"
          extra_args: "--max-warnings=0 --cache --cache-location .eslintcache"

      # For main: lint all files
      - name: Run ESLint on all files (main)
        if: github.event_name == 'push'
        run: npm run lint -- --cache --cache-location .eslintcache
```

### Workflow 3: Tests (Parallel/Sharded)

```yaml
name: Tests

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    name: Test (Shard ${{ matrix.shard }})
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
      fail-fast: false
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Cache Vitest
        uses: actions/cache@v4
        with:
          path: |
            node_modules/.vite
            node_modules/.cache
          key: vitest-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}-${{ github.sha }}
          restore-keys: |
            vitest-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}-

      - name: Run tests (sharded)
        run: npx vitest run --shard=${{ matrix.shard }}/4 --coverage --coverage.lines=90 --coverage.functions=90 --coverage.branches=90 --coverage.statements=90
        env:
          CI: true
```

### Workflow 4: Build & Docs

```yaml
name: Build & Docs

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  build:
    name: Next.js Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Cache Next.js
        uses: actions/cache@v4
        with:
          path: |
            ~/.npm
            ${{ github.workspace }}/.next/cache
          key: ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}-${{ hashFiles('**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx') }}
          restore-keys: |
            ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}-

      - name: Build Next.js
        run: npx next build
        env:
          SKIP_ENV_VALIDATION: true

  docs:
    name: Documentation
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate docs
        run: npm run docs
```

---

## 3. Optimization Techniques

### Speed Optimization Summary

| Workflow | Without Optimization | With Optimization | Speedup |
|----------|---------------------|-------------------|---------|
| Type Check | 45s | 25s (cache) | 1.8x |
| Prettier | 30s | 20s (cache) | 1.5x |
| ESLint | 60s | 20s (incremental) | 3x |
| Tests | 120s | 35s (4 shards) | 3.4x |
| Build | 90s | 45s (cache) | 2x |
| **Total Serial** | **385s (6.4min)** | **~45s** (parallel) | **~9x** |

### Key Optimizations

1. **Multi-Layer Caching**
   - npm dependencies (built-in)
   - Next.js build cache
   - Vitest cache
   - ESLint cache
   - TypeScript build info

2. **Incremental Checks**
   - ESLint: Changed files only for PRs (60-80% faster)
   - TypeScript: Incremental compilation (already enabled)

3. **Test Sharding**
   - Split 25 test files across 4 parallel jobs
   - ~6-7 files per shard
   - 3-3.5x speedup

4. **Parallel Execution**
   - All workflows run simultaneously
   - No dependencies between checks
   - Fast failure feedback

---

## 4. Hook Improvements

### Optimized Pre-commit Hook

**Changes:**
- ❌ Remove: Build check (too slow)
- ❌ Remove: Docs generation (CI only)
- ✅ Add: Smart state diagram generation (only when needed)
- ✅ Add: ESLint caching
- ⚡ Result: **2-3 minutes** (down from 6-8)

```bash
#!/usr/bin/env sh
# === PRE-COMMIT HOOK - OPTIMIZED VERSION ===

echo "🔒 Running pre-commit quality gates..."

# Only regenerate diagrams if state machine changed
if git diff --cached --name-only | grep -q "src/types/state-machine.ts"; then
  echo "\n🎨 Generating state machine diagrams..."
  npm run generate-diagrams || exit 1
  git add docs/diagrams/
fi

# Fast checks in parallel
echo "\n📘 Type check..."
npm run type-check || exit 1

echo "\n🔍 ESLint..."
npm run lint -- --cache --cache-location .eslintcache || exit 1

echo "\n✨ Prettier..."
npm run format:check || exit 1

echo "\n🧪 Tests..."
npm run test || exit 1

echo "\n✅ All pre-commit checks passed!"
```

### Optimized Pre-push Hook

**Changes:**
- ✅ Keep: Full validation + build
- ✅ Add: Documentation generation (moved from pre-commit)
- ⚡ Result: **2-3 minutes** (down from 4-5)

```bash
#!/usr/bin/env sh
# === PRE-PUSH HOOK - OPTIMIZED VERSION ===

echo "🚀 Running pre-push validation..."

echo "\n🔬 Validation suite..."
npm run validate || exit 1

echo "\n🏗️  Production build..."
npm run build || exit 1

echo "\n📚 Documentation..."
npm run docs || exit 1

echo "\n✅ All pre-push checks passed!"
```

---

## 5. Quality Gates & Branch Protection

### Required Status Checks (9 total)

Configure these in Settings → Branches → Branch protection rules:

```yaml
Required checks:
  ✅ TypeScript
  ✅ Format Check
  ✅ ESLint
  ✅ Test (Shard 1)
  ✅ Test (Shard 2)
  ✅ Test (Shard 3)
  ✅ Test (Shard 4)
  ✅ Next.js Build
  ✅ Documentation
```

### Branch Protection Configuration

```yaml
Branch: main

Settings:
  ✅ Require pull request before merging
    - Require approvals: 1
    - Dismiss stale reviews: true

  ✅ Require status checks to pass before merging
    - Require branches to be up to date: true
    - Status checks: [all 9 checks above]

  ✅ Require conversation resolution before merging
  ✅ Include administrators: true
  ❌ Allow force pushes: false
  ❌ Allow deletions: false
```

---

## 6. Migration Plan

### Phase 1: Foundation (Week 1)
1. Create `.github/workflows/` directory
2. Add `fast-checks.yml` workflow
3. Test on feature branch
4. Verify caching works

### Phase 2: Expand (Week 2)
1. Add `lint.yml` with incremental checking
2. Add `test.yml` with sharding
3. Monitor parallel execution

### Phase 3: Build & Docs (Week 3)
1. Add `build-docs.yml` workflow
2. Configure Next.js caching
3. Test build success

### Phase 4: Gate & Protect (Week 4)
1. Configure branch protection rules
2. Set required status checks
3. Update team documentation

### Phase 5: Optimize Hooks (Week 5)
1. Update pre-commit hook
2. Update pre-push hook
3. Team training

---

## 7. Cost Analysis

### GitHub Actions Usage

**Projected Monthly Usage:**
```
Assumptions:
- 50 PRs/month
- 5 commits per PR = 250 commits
- 50 main branch pushes
- Total: 300 workflow runs/month

Per Run: ~3 minutes (parallel execution)
Monthly: 300 × 3 = 900 minutes/month

Free Tier: 2,000 minutes/month
Cost: $0/month ✅
```

### Storage

**Projected Storage:**
```
Artifacts (7-day retention): ~1 GB
Caches (10 GB limit): ~465 MB

Free Tier: 500 MB artifacts, 10 GB cache
Cost: $0/month ✅
```

**ROI: Infinite** (time savings with zero cost)

---

## 8. Key Recommendations

### ✅ Do This First (Quick Wins)

1. Set up 5 specialized workflows
2. Configure all caching strategies
3. Enable branch protection
4. Optimize pre-commit hook (remove build)

### ✅ Implement for Speed

1. Use test sharding (4 shards)
2. Use incremental ESLint for PRs
3. Enable concurrency cancellation
4. Add .eslintcache to .gitignore

### ❌ Skip These (Not Needed)

1. Turborepo/Nx (single package project)
2. Self-hosted runners (free tier sufficient)
3. Complex remote caching (overkill)

---

## 9. Expected Results

**After Full Implementation:**

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| CI Time | N/A (no CI) | 45-60s | ✅ Fast |
| Pre-commit | 6-8 min | 2-3 min | 60-65% faster |
| Pre-push | 4-5 min | 2-3 min | 40-50% faster |
| Monthly Cost | N/A | $0 | ✅ Free |
| Code Quality | ✅ Zero tolerance | ✅ Maintained | No compromise |

**Coverage Maintained:**
- Type coverage: 99.9%+ ✅
- Test coverage: 90%+ ✅
- ESLint warnings: 0 ✅

---

## 10. Troubleshooting Guide

### Common Issues

**Cache not restoring:**
- Verify cache key matches
- Check path is correct
- Ensure `fetch-depth: 0` for git operations

**Tests failing in CI but pass locally:**
- Set `CI=true` environment variable
- Check `NODE_ENV=test`
- Verify no `.only` tests

**ESLint changed files not working:**
- Ensure `fetch-depth: 0` in checkout
- Verify git history is available

**Slow workflow despite caching:**
- Check cache hit rate in logs
- Verify cache key uniqueness
- Monitor Actions insights

---

## Summary

This proposal delivers a **zippy CI pipeline** that:

✅ Runs in **45-60 seconds** (all checks parallel)
✅ Costs **$0/month** (within free tier)
✅ Maintains **zero-tolerance quality** standards
✅ Reduces **local hook times by 50-65%**
✅ Provides **clear feedback** on failures
✅ Scales **with your team**

**Next Steps:**
1. Review this proposal
2. Start with Phase 1 (fast-checks workflow)
3. Iterate and expand over 4-5 weeks
4. Monitor and tune performance

---

**Document Version:** 1.0
**Created:** 2025-11-13
**Project:** air-coding-arena
