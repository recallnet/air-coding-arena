# TypeScript Incremental Compilation

This document explains how TypeScript incremental compilation is configured in this project to optimize type-checking performance.

## Overview

TypeScript incremental compilation caches the results of previous type-checking operations in a `.tsbuildinfo` file. On subsequent runs, TypeScript only re-checks files that have changed or are affected by changes, resulting in significantly faster type-checking times.

## Configuration

### tsconfig.json

The following settings enable incremental compilation:

```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo",
    "noEmit": true
  }
}
```

- `incremental: true` - Enables incremental compilation
- `tsBuildInfoFile: ".tsbuildinfo"` - Specifies where to store the build cache (root directory)
- `noEmit: true` - We don't emit JavaScript files (Next.js handles transpilation)

**Note**: Incremental compilation works correctly with `noEmit` mode. The cache tracks type information and dependencies without needing to emit JavaScript files.

### .gitignore

The build info file should never be committed to git:

```
# typescript
*.tsbuildinfo
.tsbuildinfo
next-env.d.ts
```

Each developer and CI run maintains their own cache file, ensuring:
- No merge conflicts from build artifacts
- Cache is always fresh for the current environment
- No stale cache issues from different TypeScript/Node.js versions

### CI Caching (GitHub Actions)

The `.github/workflows/ci-fast-and-tests.yml` workflow caches the `.tsbuildinfo` file across CI runs:

```yaml
- name: Restore TypeScript build info cache
  id: tsbuild-cache
  uses: actions/cache@v4
  with:
    path: .tsbuildinfo
    key: tsbuildinfo-${{ runner.os }}-node-${{ steps.setup-node.outputs.node-version }}-${{ hashFiles('tsconfig.json', 'package-lock.json') }}-${{ github.sha }}
    restore-keys: |
      tsbuildinfo-${{ runner.os }}-node-${{ steps.setup-node.outputs.node-version }}-${{ hashFiles('tsconfig.json', 'package-lock.json') }}-
      tsbuildinfo-${{ runner.os }}-node-${{ steps.setup-node.outputs.node-version }}-
      tsbuildinfo-${{ runner.os }}-
```

**Cache Key Strategy**:
- **Primary key**: Includes commit SHA for exact cache matching
- **Restore keys** (fallbacks):
  1. Same OS, Node version, and TypeScript config (different commit)
  2. Same OS and Node version (different config)
  3. Same OS (different Node version)

**Cache Invalidation**:
The cache is automatically invalidated when:
- `tsconfig.json` changes (different compiler options)
- `package-lock.json` changes (different TypeScript version)
- Node.js version changes (different runtime environment)

## Performance Benchmarks

Based on testing in this repository (10,298 tracked types across 62 test files):

### TypeScript Compilation Only (`tsc --noEmit`)
- **Cold cache** (first run): ~10 seconds
- **Warm cache** (subsequent runs): ~6 seconds
- **Improvement**: ~42% faster ✅

### Full Type Check (`npm run type-check`)
Includes `tsc --noEmit` + `type-coverage` (99.9% coverage enforcement):
- **Cold cache**: ~18.5 seconds
- **Warm cache**: ~14.4 seconds
- **Improvement**: ~22% faster

The overall improvement is lower because `type-coverage` doesn't benefit from TypeScript's incremental cache. The ~5s reduction comes entirely from the `tsc` portion.

### With File Changes
- **Single file change**: ~15 seconds
- TypeScript correctly detects the change and re-checks affected files
- Cache invalidation works as expected ✅

## Type Coverage Integration

Our type-check script runs both TypeScript and type-coverage:

```json
{
  "scripts": {
    "type-check": "tsc --noEmit && type-coverage --at-least 99.9 --strict ..."
  }
}
```

**Important**: Incremental compilation does NOT affect type-coverage enforcement:
- Type-coverage runs independently after TypeScript compilation
- 99.9% coverage threshold is still enforced
- No false positives or negatives

## Local Development Workflow

### First Type Check (Cold Cache)
```bash
npm run type-check
# Takes ~18.5s (full compilation)
```

### Subsequent Type Checks (Warm Cache)
```bash
npm run type-check
# Takes ~14.4s (incremental compilation)
```

### After Making Changes
```bash
npm run type-check
# Takes ~14-15s (only re-checks affected files)
```

### Force Full Recompile
If you suspect the cache is stale or corrupted:
```bash
rm .tsbuildinfo
npm run type-check
```

## CI Workflow

1. **Restore cache**: GitHub Actions attempts to restore `.tsbuildinfo` from previous runs
2. **Run type-check**: TypeScript uses cache if available
3. **Save cache**: Updated `.tsbuildinfo` is automatically cached for future runs

**Cache hit scenarios**:
- ✅ **Full hit**: Same commit, instant restore
- ⚠️ **Partial hit**: Different commit, same config (most common, saves ~4s)
- ❌ **Cache miss**: New configuration or first run of the day

## Troubleshooting

### Cache Not Working?
Check that:
1. `.tsbuildinfo` exists after running `tsc --noEmit`
2. The file is NOT committed to git (check `.gitignore`)
3. Permissions allow reading/writing the file

### Inconsistent Type Errors?
If incremental compilation misses type errors:
1. Delete `.tsbuildinfo`
2. Run `npm run type-check` fresh
3. If the issue persists, this is a TypeScript bug (very rare)

### CI Cache Not Restoring?
Check the GitHub Actions logs:
1. Look for "TypeScript cache status" step
2. Verify the cache key matches expected pattern
3. Ensure `.tsbuildinfo` is generated before cache saving

### Build Info File Too Large?
The `.tsbuildinfo` file size is proportional to codebase size:
- **Current size**: ~302 KB (10,298 types)
- **Typical range**: 100 KB - 2 MB
- **Too large**: > 10 MB (consider project references)

## Future Optimizations

### TypeScript Project References
If the codebase grows significantly (> 100K lines):
- Consider splitting into multiple TypeScript projects
- Use project references for isolated compilation
- Can provide even faster incremental builds
- Adds configuration complexity

**Current recommendation**: Not needed yet. Single-project incremental compilation provides sufficient performance.

## References

- [TypeScript Incremental Compilation](https://www.typescriptlang.org/docs/handbook/project-references.html#build-mode-for-typescript)
- [GitHub Actions Cache](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [Type Coverage Tool](https://github.com/plantain-00/type-coverage)

## Summary

✅ **Incremental compilation is enabled and working**
✅ **Performance improvement: 42% for TypeScript, 22% overall**
✅ **CI caching configured with proper invalidation**
✅ **Type coverage enforcement unchanged**
✅ **Cache invalidation works correctly**

Developers and CI runs will automatically benefit from faster type-checking with no additional configuration required.
