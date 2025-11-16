# Vercel Deployment Optimization

**Status**: Not Started
**Priority**: Medium
**Estimated Impact**: 20-30% faster Vercel deployments
**Owner**: TBD

## Context

Our Vercel deployments currently:
1. Install all dependencies (including devDependencies)
2. Run database migrations
3. Run manual migrations script
4. Build the Next.js application
5. Deploy

Current `vercel.json` configuration:
```json
{
  "buildCommand": "npm run vercel-build",
  "framework": "nextjs",
  "crons": [...]
}
```

The `vercel-build` script:
```json
"vercel-build": "npm run db:migrate && npm run db:migrate:manual && next build"
```

## Objective

Optimize Vercel deployment time and efficiency by reducing the amount of code deployed, optimizing the install process, and leveraging Vercel-specific features.

## Key Areas to Investigate

### 1. Vercelignore - Reduce Deployment Size
We currently have no `.vercelignore` file, meaning Vercel uploads:
- Test files (`*.test.ts`, `*.test.tsx`, `*.spec.ts`)
- Test utilities (`src/__tests__/`, `src/test-utils/`)
- Documentation (`docs/`, `*.md`)
- Coverage reports (`coverage/`)
- GitHub workflows (`.github/`)
- Scripts directory (`scripts/`)
- Other development artifacts

Research:
- What files can safely be excluded from Vercel deployments?
- What's the size difference?
- Does deployment size affect build time?
- Are there any runtime dependencies on these files?

### 2. Install Command Optimization
Vercel runs `npm install` by default. Consider:
- Specifying a custom `installCommand` in `vercel.json`
- Using `npm ci --prefer-offline --no-audit` for faster installs
- Using `npm ci --omit=dev` to skip devDependencies (check if this breaks the build)
- Whether Vercel's caching works better with certain commands

Questions:
- Do we need devDependencies in Vercel builds?
- TypeScript compilation happens during build - is `typescript` needed?
- Do any build scripts use dev dependencies?

### 3. Build Output Optimization
Next.js generates various outputs. Research:
- `outputFileTracing` - can reduce deployment size
- Static vs server-rendered pages optimization
- API route bundling
- Image optimization settings

### 4. Vercel Build Cache
Vercel has its own caching mechanisms. Investigate:
- Does Vercel automatically cache Next.js builds?
- Can we configure cache behavior?
- How does cache invalidation work?
- What's cached between deployments?

### 5. Database Migration Strategy
Current approach runs migrations on every build:
```bash
npm run db:migrate && npm run db:migrate:manual
```

Questions:
- Do migrations slow down builds significantly?
- Should migrations run on build, or separately?
- Can we make migration scripts faster?
- Are migrations idempotent (safe to run multiple times)?
- Do preview deployments need migrations?

### 6. Environment-Specific Builds
Consider:
- Different build strategies for production vs preview deployments
- Skipping certain steps in preview builds
- Using environment variables to optimize for environment

## Success Criteria

- [ ] Deployment time reduced by at least 20%
- [ ] Deployment artifact size reduced
- [ ] All functionality still works in deployed environment
- [ ] Database migrations still run correctly
- [ ] Preview deployments work correctly
- [ ] No runtime errors introduced
- [ ] Build logs are clear about what's happening

## Testing Requirements

1. **Baseline**: Time current production deployment
2. **Preview baseline**: Time preview deployment
3. **Size baseline**: Check current deployment artifact size
4. **After optimization**: Time production deployment
5. **Size comparison**: Check new artifact size
6. **Functionality tests**:
   - All pages load correctly
   - All API routes work
   - Database queries work
   - Image optimization works
   - OG images generate correctly
   - Cron jobs work
7. **Migration testing**: Verify migrations run correctly on fresh database

## Constraints

- MUST NOT break any runtime functionality
- Database migrations must still work reliably
- Preview deployments must remain functional
- Environment variables must still be accessible
- Vercel-specific features (Edge, Serverless) must still work

## Resources

- Current Vercel config: `vercel.json`
- Vercel build script: `package.json` `vercel-build`
- Vercel documentation on build optimization
- Next.js documentation on deployment
- Our database migration scripts

## Experiments to Run

1. **Create .vercelignore**: Add common dev files, measure size/time difference
2. **Custom install command**: Test `npm ci --prefer-offline --no-audit`
3. **Skip dev dependencies**: Try `--omit=dev`, check if build still works
4. **Migration timing**: Measure how long migrations take in Vercel builds
5. **Output tracing**: Enable `outputFileTracing` in Next.js config
6. **Preview optimization**: Different config for preview vs production

## Questions to Answer

1. How much of our deployment size is test/dev files?
2. Do we need devDependencies for Vercel builds?
3. How long do migrations take compared to the build?
4. Can we run migrations outside the build process?
5. What's Vercel's default caching behavior?
6. Are there Vercel-specific Next.js optimizations we're missing?

## Suggested .vercelignore Content

Research and determine which of these can be safely excluded:
```
# Tests
**/*.test.ts
**/*.test.tsx
**/*.spec.ts
**/*.spec.tsx
src/__tests__/
src/test-utils/

# Documentation
docs/
*.md
!README.md

# Development
.github/
scripts/
coverage/
.eslintcache
.tsbuildinfo

# Config files (might be needed?)
*.config.ts
!next.config.js
!tailwind.config.ts
!postcss.config.js
```

Careful analysis needed - some config files ARE needed for build.

## Database Migration Considerations

Current approach:
```bash
npm run db:migrate && npm run db:migrate:manual && next build
```

Alternative approaches to research:
1. **Separate migration job**: Run migrations as a separate Vercel deploy hook
2. **Runtime migrations**: Run on app startup (serverless function warm-up)
3. **Skip on preview**: Only run migrations on production deploys
4. **Cache migration state**: Check if migrations are needed before running

Trade-offs:
- Build time vs reliability
- Preview environment accuracy
- Deployment safety (what if migration fails?)

## Advanced Considerations

- Should we use Vercel's Edge Config for feature flags?
- Can we optimize serverless function size?
- Would splitting into multiple projects help (API routes separate from pages)?
- Consider using Vercel's build cache API
- Look into `framework: "nextjs"` specific optimizations
