# Milestone 1: Arena Dashboard - Complete

Welcome to the Coding Arena Dashboard! This document covers everything you need to know about Milestone 1.

## Overview

Milestone 1 establishes the foundation of the Coding Arena Dashboard - a Next.js 15 application that displays AI coding agent leaderboards, issue tracking, and performance metrics. This milestone delivers a fully functional, production-quality dashboard with zero-tolerance quality standards.

### What Was Accomplished

- **5 Complete Pages**: Home (leaderboard), Issues list, Issue detail, Agent detail, and 404
- **Type-Safe Database Layer**: PostgreSQL with Drizzle ORM, 5 tables + 1 materialized view
- **100% Type Coverage**: Every piece of code is fully typed with TypeScript
- **90%+ Test Coverage**: Comprehensive test suite with Vitest
- **Zero ESLint Warnings**: Enforced by 16 ESLint plugins
- **Demo Mode**: Seeded with real Linear export data
- **7-Stage Pre-Commit Hooks**: Automated quality gates on every commit

### Key Technologies

- **Next.js 15** - App Router with React Server Components
- **TypeScript 5.6** - Strict mode with 100% type coverage
- **PostgreSQL** - Via Neon serverless Postgres
- **Drizzle ORM** - Type-safe database queries
- **Vitest** - Fast unit testing with 90% coverage requirements
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - High-quality UI components

## Features

### 1. Dashboard Home Page (Leaderboard)

**Route:** `/`

The landing page displays a leaderboard of AI agents ranked by performance metrics:

- **Agent Name** - Link to agent detail page
- **Attempts** - Total PRs opened by the agent
- **Wins** - Number of PRs merged (winning solutions)
- **Acceptance Rate** - Percentage of attempts that won

Data is pulled from the `agent_stats` materialized view which aggregates metrics across all issues and attempts.

### 2. Issues List Page

**Route:** `/issues`

Displays all arena-ready issues with:

- **Issue Key** - Linear issue identifier (e.g., `ARENA-123`)
- **Title** - Issue description
- **Status** - Current state (open, in_progress, resolved)
- **Attempts** - Number of agent PRs submitted
- **Winner** - Agent name if issue is resolved

Clicking an issue navigates to the detail page.

### 3. Issue Detail Page

**Route:** `/issues/[id]`

Shows comprehensive information about a specific issue:

- **Issue Header** - Title, Linear link, repo, status badge
- **Metadata** - Arena ready labeled date, winner (if resolved)
- **Attempts Table** - All PRs for this issue with:
  - Agent name (links to agent page)
  - PR number (links to GitHub PR)
  - Branch name
  - Status badge (open, merged, closed)
  - Timestamps (opened, merged, closed)
  - Commit count

### 4. Agent Detail Page

**Route:** `/agents/[agentName]`

Displays performance metrics and history for a specific agent:

- **Agent Stats Card** - Attempts, wins, acceptance rate
- **Attempt History** - Table of all PRs by this agent:
  - Issue key (links to issue page)
  - PR number (links to GitHub PR)
  - Branch name
  - Status badge
  - Timestamps
  - Commit count

### 5. Navigation and Layout

- **Fixed Navigation Bar** - Persists across all pages
  - "Coding Arena" branding (links to home)
  - "Leaderboard" link
  - "Issues" link
- **Responsive Design** - Mobile-friendly layout
- **404 Page** - Custom not found page

## Architecture

### Next.js 15 App Router with Server Components

This application leverages Next.js 15's App Router with React Server Components for optimal performance:

```
src/app/
├── layout.tsx                 # Root layout with navigation
├── page.tsx                   # Home page (leaderboard)
├── issues/
│   ├── page.tsx              # Issues list
│   └── [id]/
│       └── page.tsx          # Issue detail
└── agents/
    └── [agentName]/
        └── page.tsx          # Agent detail
```

All pages are Server Components by default, meaning:

- Data fetching happens on the server
- No client-side JavaScript for data loading
- Automatic static optimization where possible
- SEO-friendly with server-rendered HTML

### Database Schema

The database consists of **5 tables** and **1 materialized view**:

#### 1. `issues` Table

Stores Linear issues labeled with `arena:ready`:

```typescript
{
  id: uuid (PK),
  linearId: text (unique),
  linearKey: text,              // e.g., "ARENA-123"
  title: text,
  url: text,
  repo: text,
  status: text,
  arenaReadyLabeledAt: timestamp,
  winnerAttemptId: uuid,
  createdAt: timestamp
}
```

#### 2. `attempts` Table

Each PR opened by an agent for an issue:

```typescript
{
  id: uuid (PK),
  issueId: uuid (FK -> issues),
  agentName: text,
  repo: text,
  prNumber: integer,
  prUrl: text,
  branch: text,
  openedAt: timestamp,
  mergedAt: timestamp,
  closedAt: timestamp,
  status: text,                 // 'open', 'merged', 'closed'
  commitCount: integer,
  lastCommitSha: text,
  UNIQUE(issueId, agentName, prNumber)
}
```

#### 3. `issue_agents` Table

Dispatch bookkeeping (tracks which agents were assigned to issues):

```typescript
{
  id: uuid (PK),
  issueId: uuid (FK -> issues),
  agentName: text,
  status: text,
  externalJobId: text,
  triggeredAt: timestamp,
  UNIQUE(issueId, agentName)
}
```

#### 4. `ci_metrics` Table

Optional CI/CD metrics per attempt:

```typescript
{
  id: uuid (PK),
  attemptId: uuid (FK -> attempts),
  testsPassed: integer,
  testsFailed: integer,
  coverageDelta: real,
  perfDeltaMs: real,
  lintErrors: integer,
  sizeDeltaBytes: integer,
  jsonBlob: jsonb
}
```

#### 5. `events` Table

Idempotency and audit log for webhooks:

```typescript
{
  id: bigserial (PK),
  source: text,                 // 'linear', 'github'
  key: text,                    // Unique event identifier
  payload: jsonb,
  createdAt: timestamp,
  UNIQUE(source, key)
}
```

#### 6. `agent_stats` Materialized View

Aggregated agent performance metrics:

```sql
CREATE MATERIALIZED VIEW agent_stats AS
SELECT
  agent_name,
  COUNT(*) as attempts,
  COUNT(*) FILTER (WHERE status = 'merged') as wins,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'merged') / COUNT(*),
    1
  ) as acceptance_pct
FROM attempts
GROUP BY agent_name;
```

This view is refreshed by the seed script and will be refreshed by webhooks in Milestone 2.

### Query Layer

Type-safe query functions in `/src/lib/queries.ts`:

- `getAgentStats()` - Leaderboard data
- `getAllIssues()` - Issues list with attempt counts
- `getIssueById(id)` - Issue detail with all attempts
- `getAttemptsByAgent(agentName)` - Agent history
- `getAttemptsByIssue(issueId)` - Issue attempts

All queries use Drizzle ORM with full TypeScript type inference.

### UI Components

Built with shadcn/ui and Tailwind CSS:

- `Card` - Content containers with header/title/content sections
- `Table` - Responsive tables with header/body/row/cell components
- `Badge` - Status indicators with color variants
- `Button` - Interactive elements with multiple variants
- `Navigation` - Persistent top navigation bar

All components are fully tested and 100% type-safe.

## Demo Mode

**Important:** Milestone 1 operates in demo mode with seeded data.

### Data Source

The database is seeded from a Linear export containing real issues from the coding-arena Linear workspace. The export includes:

- Issue titles, descriptions, and metadata
- Linear issue keys (e.g., `ARENA-1`, `ARENA-2`)
- Status information and timestamps

### Synthetic Data

Since GitHub webhooks are not yet implemented, the following data is **synthetic** and generated by the seed script:

- **PR Numbers** - Random numbers between 1-1000
- **Branch Names** - Format: `agent-name/issue-linear-key`
- **Agent Names** - `claude-3.5-sonnet`, `gpt-4o`, `gemini-pro`, `mistral-large`
- **PR URLs** - Format: `https://github.com/owner/repo/pull/{pr_number}`
- **Commit Counts** - Random numbers between 1-20

### Console Warnings

When viewing the demo dashboard, you'll see console warnings for synthetic data:

```
[DEMO MODE] PR and branch data is synthetic. Real webhook integration coming in Milestone 2.
```

This is intentional and reminds developers that real GitHub data will be integrated in the next milestone.

### Seeding the Database

To populate the database with demo data:

```bash
npm run db:seed
```

This will:

1. Clear existing data
2. Import issues from Linear export
3. Generate synthetic attempts data
4. Refresh the `agent_stats` materialized view
5. Display seeding summary

### What's Coming in Milestone 2

Real webhook integration will replace synthetic data:

- Linear webhooks will create/update issues
- GitHub webhooks will create/update attempts
- Real PR numbers, branches, and commit data
- Live status updates as PRs are opened/merged/closed

## Getting Started

### Prerequisites

- **Node.js** >= 18.18.0
- **npm** >= 9.0.0
- **Neon Postgres Account** - Free tier available at [neon.tech](https://neon.tech)

### Environment Setup

1. **Create a Neon Postgres database:**
   - Sign up at https://neon.tech
   - Create a new project
   - Copy the connection string

2. **Create `.env.local` file:**

```bash
cp .env.example .env.local
```

3. **Add your database URL:**

```env
# Database
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"

# Optional: Linear API (for future webhook integration)
LINEAR_API_KEY="your-linear-api-key"
LINEAR_WEBHOOK_SECRET="your-webhook-secret"

# Optional: GitHub (for future webhook integration)
GITHUB_TOKEN="your-github-token"
GITHUB_WEBHOOK_SECRET="your-webhook-secret"
```

Only `DATABASE_URL` is required for Milestone 1.

### Installation Steps

1. **Clone the repository** (if not already done)

2. **Install dependencies:**

```bash
npm install
```

3. **Run database migrations:**

```bash
npm run db:migrate
```

This creates all tables and the `agent_stats` view.

4. **Seed the database:**

```bash
npm run db:seed
```

This populates the database with demo data from Linear export.

5. **Start the development server:**

```bash
npm run dev
```

The application will be available at http://localhost:3109

### Verifying the Setup

After starting the dev server, you should see:

- Leaderboard with 4 agents on the home page
- Issues list with multiple arena-ready issues
- Clickable links to issue and agent detail pages
- Console warnings about demo mode (expected)

## Project Structure

```
coding-arena/
├── src/
│   ├── app/                      # Next.js App Router pages
│   │   ├── layout.tsx           # Root layout with navigation
│   │   ├── page.tsx             # Home page (leaderboard)
│   │   ├── issues/
│   │   │   ├── page.tsx         # Issues list
│   │   │   └── [id]/
│   │   │       └── page.tsx     # Issue detail
│   │   └── agents/
│   │       └── [agentName]/
│   │           └── page.tsx     # Agent detail
│   ├── components/
│   │   ├── Navigation.tsx       # Top navigation bar
│   │   └── ui/                  # shadcn/ui components
│   │       ├── Badge.tsx
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       └── Table.tsx
│   ├── db/
│   │   ├── client.ts            # Drizzle database client
│   │   └── schema.ts            # Database schema and relations
│   ├── lib/
│   │   ├── queries.ts           # Type-safe database queries
│   │   └── utils.ts             # Utility functions (cn)
│   └── types/
│       ├── database.ts          # Database type definitions
│       ├── api/                 # API types (future)
│       ├── components/          # Component prop types (future)
│       ├── domain/              # Domain types (future)
│       └── utils/               # Utility types (future)
├── scripts/
│   ├── seed.ts                  # Database seeding script
│   ├── reset-db.ts              # Database reset utility
│   ├── export-linear.ts         # Linear data export tool
│   └── run-manual-migration.ts  # Manual migration runner
├── drizzle/                      # Generated migrations
├── .husky/                       # Git hooks
│   ├── pre-commit               # 7-stage quality gates
│   └── pre-push                 # Additional validation
├── coverage/                     # Test coverage reports
├── docs/                         # Generated TypeDoc documentation
├── .env.local                    # Environment variables (not committed)
├── .env.example                  # Environment template
├── drizzle.config.ts            # Drizzle ORM configuration
├── eslint.config.mjs            # ESLint configuration
├── next.config.js               # Next.js configuration
├── package.json                 # Dependencies and scripts
├── postcss.config.mjs           # PostCSS configuration
├── tailwind.config.ts           # Tailwind CSS configuration
├── tsconfig.json                # TypeScript configuration
├── typedoc.json                 # TypeDoc configuration
└── vitest.config.ts             # Vitest configuration
```

## Quality Standards

This project maintains **zero-tolerance quality standards** enforced by automated tooling:

### 100% Type Coverage

Every piece of code is fully typed with TypeScript. No `any` types allowed.

```bash
npm run type-check
```

Verification:

- TypeScript compilation: **0 errors**
- Type coverage: **100.00%** (2385/2385 symbols)
- Configuration: Strict mode, no implicit any

### 90%+ Test Coverage

Comprehensive test suite with strict coverage thresholds:

```bash
npm run test
```

Coverage Metrics (Current):

- **Statements:** 99.76%
- **Branches:** 99.24%
- **Functions:** 100%
- **Lines:** 99.76%

All metrics exceed the 90% minimum requirement.

Test Statistics:

- **149 tests** across **12 test files**
- All tests passing
- Average test execution: <2.5 seconds

### Zero ESLint Warnings

Strict linting with **16 ESLint plugins**:

```bash
npm run lint
```

ESLint Plugin Stack:

1. **@typescript-eslint** - TypeScript-specific rules
2. **eslint-plugin-react** - React best practices
3. **eslint-plugin-react-hooks** - Hooks rules
4. **eslint-plugin-jsx-a11y** - Accessibility standards
5. **eslint-plugin-import** - Import/export validation
6. **eslint-plugin-unicorn** - Code quality improvements
7. **eslint-plugin-sonarjs** - Bug detection patterns
8. **eslint-plugin-security** - Security vulnerability detection
9. **eslint-plugin-no-secrets** - Prevents secret leakage
10. **eslint-plugin-promise** - Promise best practices
11. **eslint-plugin-vitest** - Test-specific rules
12. **eslint-plugin-testing-library** - Testing best practices
13. **eslint-plugin-jsdoc** - Documentation standards
14. **eslint-plugin-functional** - Functional programming patterns
15. **eslint-plugin-boundaries** - Architecture enforcement
16. **eslint-plugin-eslint-comments** - ESLint directive rules

Auto-fix available:

```bash
npm run lint:fix
```

### 7-Stage Pre-Commit Hooks

Every commit must pass all quality gates:

1. **TypeScript Compilation** - `npm run type-check`
2. **Type Coverage** - 100% coverage verification
3. **ESLint** - Zero warnings policy
4. **Prettier** - Code formatting check
5. **Tests** - All tests must pass with 90% coverage
6. **Documentation** - TypeDoc generation
7. **Build** - Production build must succeed

If any stage fails, the commit is blocked. No exceptions.

To bypass hooks (not recommended):

```bash
git commit --no-verify
```

### Code Formatting

Prettier with Tailwind CSS plugin:

```bash
# Check formatting
npm run format:check

# Auto-format
npm run format
```

### Production Build

Full validation pipeline before build:

```bash
npm run build
```

This runs all quality checks (type-check, lint, test, format) before building.

## Testing

### Running Tests

Run all tests with coverage:

```bash
npm run test
```

Watch mode for development:

```bash
npm run test:watch
```

Visual UI for test exploration:

```bash
npm run test:ui
```

### Test Structure

Each component/module has a corresponding test file:

```
src/app/page.tsx          -> src/app/page.test.tsx
src/components/Badge.tsx  -> src/components/Badge.test.tsx
src/lib/queries.ts        -> src/lib/queries.test.ts
```

### Coverage Reports

After running tests, open the HTML coverage report:

```bash
open coverage/index.html
```

This provides line-by-line coverage visualization.

### Type Checking

Verify TypeScript compilation and type coverage:

```bash
npm run type-check
```

This runs:

1. `tsc --noEmit` - Compilation check
2. `type-coverage` - 100% coverage verification

## npm Scripts Reference

### Development

- `npm run dev` - Start dev server on port 3109
- `npm run start` - Start production server

### Quality Checks

- `npm run type-check` - TypeScript + type coverage
- `npm run lint` - ESLint with zero warnings
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run test` - Run tests with coverage
- `npm run test:watch` - Watch mode
- `npm run test:ui` - Visual test UI
- `npm run format:check` - Check Prettier formatting
- `npm run format` - Auto-format with Prettier

### Validation

- `npm run validate` - Run all checks (type, lint, test, format)
- `npm run build` - Validate + production build

### Documentation

- `npm run docs` - Generate TypeDoc documentation
- `npm run docs:serve` - Generate and serve docs

### Database

- `npm run db:generate` - Generate migrations
- `npm run db:migrate` - Run migrations
- `npm run db:push` - Push schema (dev only)
- `npm run db:studio` - Open Drizzle Studio
- `npm run db:seed` - Seed database with demo data
- `npm run db:reset` - Clear all data

### Utilities

- `npm run export:linear` - Export Linear issues

## Next Steps: Milestone 2

The next milestone will transform this from a demo dashboard into a **live, real-time system** by integrating webhooks from Linear and GitHub.

### Planned Features

#### 1. Linear Webhook Integration

- Receive webhook events when issues are labeled `arena:ready`
- Automatically create/update issues in the database
- Real-time status updates (open → in_progress → resolved)
- Idempotency using the `events` table

#### 2. GitHub Webhook Integration

- Receive webhook events for PR lifecycle:
  - PR opened → Create attempt
  - PR updated → Update commit count, last commit SHA
  - PR merged/closed → Update attempt status and timestamps
- Real branch names from GitHub
- Real commit data and PR metadata
- Link attempts to Linear issues via branch naming convention

#### 3. Real-Time PR Tracking

- No more synthetic data
- Live updates as agents open PRs
- Automatic winner detection when PR is merged
- Real acceptance rate calculations

#### 4. CI Metrics Collection

- Capture CI/CD metrics from GitHub Actions
- Populate the `ci_metrics` table with:
  - Test pass/fail counts
  - Coverage deltas
  - Performance metrics
  - Lint error counts
  - Bundle size changes
- Display metrics on issue detail pages

#### 5. Webhook Security

- HMAC signature verification for Linear webhooks
- SHA-256 signature verification for GitHub webhooks
- Idempotency checks using the `events` table
- Rate limiting and error handling

#### 6. Agent Dispatch System

- Automatically dispatch agents when issues are labeled
- Track dispatch status in `issue_agents` table
- Integration with agent execution platform (e.g., Modal, AWS Lambda)
- Timeout handling and retry logic

### Breaking Changes

None expected. Milestone 2 is purely additive:

- Existing database schema remains unchanged
- Query functions remain backward compatible
- UI components will gain new features without breaking changes
- Demo mode can coexist with webhook mode

### Development Roadmap

1. **Week 1:** Linear webhook endpoint + issue creation
2. **Week 2:** GitHub webhook endpoint + attempt tracking
3. **Week 3:** Agent dispatch system integration
4. **Week 4:** CI metrics collection + UI updates
5. **Week 5:** Testing, security hardening, documentation

---

## Appendix

### Database Views

The `agent_stats` materialized view is created by migration:

```sql
-- Migration: 0003_create_agent_stats_view.sql
CREATE MATERIALIZED VIEW agent_stats AS
SELECT
  agent_name,
  COUNT(*) as attempts,
  COUNT(*) FILTER (WHERE status = 'merged') as wins,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'merged') / COUNT(*),
    1
  ) as acceptance_pct
FROM attempts
GROUP BY agent_name;

-- Refresh function (manual for now, auto in Milestone 2)
REFRESH MATERIALIZED VIEW agent_stats;
```

### Environment Variables

Complete `.env.local` template:

```env
# ========================================
# CODING ARENA - ENVIRONMENT VARIABLES
# ========================================

# === DATABASE ===
# Required: Neon Postgres connection string
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"

# === LINEAR (Optional for Milestone 1) ===
# Get from: https://linear.app/settings/api
LINEAR_API_KEY=""
LINEAR_WEBHOOK_SECRET=""

# === GITHUB (Optional for Milestone 1) ===
# Get from: https://github.com/settings/tokens
GITHUB_TOKEN=""
GITHUB_WEBHOOK_SECRET=""

# === AGENT PLATFORM (Future) ===
# Modal, AWS Lambda, etc.
AGENT_PLATFORM_API_KEY=""
```

### TypeDoc Documentation

View the generated API documentation:

```bash
npm run docs:serve
```

Then open http://localhost:3000 in your browser.

Documentation includes:

- Database schema types
- Query function signatures
- Component prop types
- Utility function documentation

### Common Issues

#### Issue: `DATABASE_URL` not set

**Error:** `Connection string not provided`

**Solution:** Create `.env.local` with your Neon Postgres URL

#### Issue: Port 3109 already in use

**Error:** `Port 3109 is already in use`

**Solution:** The `predev` script automatically kills existing processes, but if it fails:

```bash
lsof -ti:3109 | xargs kill -9
npm run dev
```

#### Issue: Tests failing after database changes

**Error:** Tests reference old schema

**Solution:**

1. Run migrations: `npm run db:migrate`
2. Reseed database: `npm run db:seed`
3. Update test mocks to match new schema

#### Issue: TypeDoc warnings

**Warning:** `PageProps not included in documentation`

**Explanation:** This is expected. Next.js page props are internal types and don't need public documentation.

### Performance Notes

- **Static Optimization:** Home page and issues list are statically generated
- **Dynamic Routes:** Issue detail and agent detail are dynamically rendered
- **Database Queries:** All queries use indexes for optimal performance
- **Bundle Size:** First Load JS is ~102 KB (excellent)
- **Test Speed:** Full test suite runs in <3 seconds

### License

[Add your license here]

### Contributors

[Add contributors here]

---

**Milestone 1 Status:** Complete

**Quality Metrics:**

- Type Coverage: 100.00%
- Test Coverage: 99.76%
- ESLint Warnings: 0
- Build Status: Passing

**Ready for Milestone 2:** Yes
