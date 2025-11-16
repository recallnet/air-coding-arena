# Next.js Build Performance Optimization

**Status**: Not Started
**Priority**: High
**Estimated Impact**: 20-40% faster builds in CI and Vercel
**Owner**: TBD

## Context

Next.js builds are used in multiple places:
1. **Local pre-push hook**: Ensures production build works before pushing
2. **Vercel deployments**: Every push triggers a build
3. **Potential CI builds**: We might add build checks to CI

Current configuration in `next.config.js`:
- React strict mode enabled
- TypeScript errors fail the build
- Image optimization configured for remote patterns
- Basic webpack configuration to exclude `encoding` package

Build characteristics:
- Takes 30-60 seconds depending on machine
- Compiles all pages and API routes
- Generates optimized bundles
- No experimental features enabled

## Objective

Optimize Next.js build performance through configuration, experimental features, and build-time optimizations without compromising bundle size, runtime performance, or functionality.

## Key Areas to Investigate

### 1. Experimental Next.js Features
Next.js 15 has several experimental features. Research and evaluate:

**SWC Minification**:
- Is this already the default in Next.js 15?
- What's the performance difference vs Terser?
- Any compatibility issues with our dependencies?

**Turbopack**:
- Currently we have `turbopack: {}` in config (empty object)
- Is Turbopack enabled for builds or just dev mode?
- What's the build time difference with Turbopack?
- Are there any limitations or known issues?

**Module Optimization**:
- `optimizePackageImports` - can optimize specific packages
- Which of our dependencies would benefit? (@geist-ui/icons, lucide-react, others?)
- What's the impact on build time vs bundle size?

### 2. Build Caching
Next.js generates a `.next/cache` directory. Consider:
- What does Next.js cache between builds?
- How do we enable caching in Vercel deployments?
- What about CI environments?
- How is cache invalidation handled?

### 3. Source Maps
We currently don't explicitly configure source maps:
- Are production source maps being generated?
- What's the build time cost of source maps?
- Do we need them in production, or only for debugging?
- Consider `productionBrowserSourceMaps: false` for faster builds

### 4. Package Import Optimization
Our dependencies include several large UI libraries:
- `@geist-ui/icons` - icon library
- `lucide-react` - another icon library
- `@testing-library/*` - testing utilities
- Others?

Questions:
- Are we tree-shaking these effectively?
- Would `optimizePackageImports` help?
- Are there any dependencies we're importing wastefully?

### 5. Webpack Configuration
Current custom webpack config excludes `encoding`:
```javascript
config.resolve.alias = {
  ...config.resolve.alias,
  encoding: false,
}
```

Research:
- Why was this needed?
- Are there other packages we should exclude?
- Any webpack optimizations we're missing?
- Should we migrate fully to Turbopack instead?

### 6. Vercel-Specific Optimizations
In `vercel.json` we specify:
```json
{
  "buildCommand": "npm run vercel-build",
  "framework": "nextjs"
}
```

The `vercel-build` script runs migrations then builds:
```json
"vercel-build": "npm run db:migrate && npm run db:migrate:manual && next build"
```

Questions:
- Can we optimize the Vercel build process?
- Should we use Vercel's build cache?
- Any Vercel-specific Next.js optimizations?
- Should we specify `installCommand` for faster installs?

## Success Criteria

- [ ] Build time reduced by at least 20% (measure before/after)
- [ ] All pages and API routes still work correctly
- [ ] Bundle sizes don't increase significantly (< 5% growth)
- [ ] No runtime errors introduced
- [ ] No visual regressions in UI
- [ ] Vercel deployments are faster
- [ ] Local pre-push builds are faster

## Testing Requirements

1. **Baseline**: Measure current build time (5 runs, average)
2. **Bundle analysis**: Run `next build` with bundle analyzer
3. **After optimization**: Measure new build time (5 runs, average)
4. **Bundle comparison**: Compare before/after bundle sizes
5. **Functionality testing**:
   - Test all pages render correctly
   - Test all API routes work
   - Test image optimization still works
   - Test OG image generation works
6. **Vercel deployment**: Deploy and verify production build
7. **Error handling**: Verify TypeScript errors still fail the build

## Constraints

- MUST NOT break any existing functionality
- MUST keep TypeScript build errors enabled (no `ignoreBuildErrors`)
- MUST maintain React strict mode
- Bundle size increase should be minimal (< 5%)
- Runtime performance must not degrade

## Resources

- Current Next.js config: `next.config.js`
- Build script in `package.json`: `"build": "next build"`
- Vercel config: `vercel.json`
- Next.js 15 documentation on experimental features
- Next.js build optimization documentation
- Vercel build optimization docs

## Experiments to Run

1. **Turbopack for builds**: Enable Turbopack for production builds
2. **Disable source maps**: Set `productionBrowserSourceMaps: false`
3. **Package import optimization**: Add `optimizePackageImports` for key packages
4. **Bundle analysis**: Use `@next/bundle-analyzer` to find optimization opportunities
5. **Vercel cache**: Configure and test Vercel build caching

## Questions to Answer

1. What's the current breakdown of build time (compilation, bundling, optimization)?
2. How large are our current bundles (total, per page)?
3. Which dependencies contribute most to bundle size?
4. Is Turbopack stable enough for production builds?
5. What's the performance impact of each experimental feature?
6. Are we generating unused code that could be tree-shaken?

## Bundle Analysis

Before implementing, analyze the current build:

```bash
# Install bundle analyzer
npm install --save-dev @next/bundle-analyzer

# Run build with analysis
ANALYZE=true next build
```

Look for:
- Large dependencies that might be optimized
- Duplicate code across bundles
- Unused exports being bundled

## Advanced Considerations

- Should we use `outputFileTracing` for smaller deployments?
- Would splitting API routes into separate deployments help?
- Any images that should be optimized at build time rather than runtime?
- Consider using Next.js middleware for better caching
