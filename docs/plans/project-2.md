## What you’ll get in v1 (UI‑first)

- A live **Arena dashboard** (Next.js + Tailwind) showing:
  - Leaderboard by **agent** (Cursor, Engine, Cyrus): attempts, wins, acceptance %, avg time‑to‑PR, avg time‑to‑merge.
  - **Issues** list (from mocked Linear snapshot): status, winner PR, per‑agent attempts (with commit_count).
  - **Issue detail**: attempts timeline, PR links, branch names, simple CI summary (mocked).
  - **Agent detail**: trends across time (table first; charts can follow).

- Real **Neon** DB with production‑shape tables.
- **Seed pipeline** that creates realistic data from your existing Linear workspace snapshot (or canned fixtures) so it “feels real”.

Later, we’ll flip a switch: webhooks start updating these same tables.

---

## Step 1 — Environment & scaffolding (your checklist)

**Create a Neon database**

- Provision a Neon Postgres instance. Copy the connection string.

**Create a Vercel project**

- New Next.js (App Router, TS). Add the env vars below.

**Environment variables (.env / Vercel Project Settings)**

```bash
# Core
NODE_ENV=development
DATABASE_URL=postgres://user:pass@host/db?sslmode=require

# UI mode
ARENA_MODE=demo              # 'demo' now; later 'live'
ARENA_LABEL=arena:ready      # used only for copy & display in demo

# Optional (for later live hookup — keep placeholders)
LINEAR_WEBHOOK_SECRET=
LINEAR_API_KEY=
GITHUB_WEBHOOK_SECRET=
GITHUB_TOKEN=
ALLOWED_REPOS=org/frontend,org/api

# Seeding
ARENA_SEED_SOURCE=fixtures   # 'fixtures' or 'linear'
LINEAR_TEAM_KEYS=ENG,APP     # if you seed from Linear API later
SEED_DAYS=30                 # how far back to synthesize activity
```

> In **UI‑first** mode we won’t call external APIs; the seed script reads local JSON fixtures that mimic your Linear issues & GitHub PRs.

---

## Step 2 — Information architecture (entities)

We keep the production‑shape tables so the UI won’t change when we go live.

- **issues** (from Linear)
  - `linear_id`, `linear_key`, `title`, `url`, `repo?`, `status`, `arena_ready_labeled_at`, `winner_attempt_id?`, timestamps

- **issue_agents** (dispatch bookkeeping)
  - `issue_id`, `agent_name` (cursor|engine|cyrus), `status` (queued|triggered|failed|skipped), `triggered_at?`

- **attempts** (each PR an agent opens)
  - `issue_id`, `agent_name`, `repo`, `pr_number`, `pr_url`, `branch`, `opened_at`, `merged_at?`, `closed_at?`,
    `status` (open|merged|closed), `commit_count`, `last_commit_sha?`

- **ci_metrics** (optional now, easy later)
  - `attempt_id`, `tests_passed`, `tests_failed`, `coverage_delta`, `perf_delta_ms`, `lint_errors`, `size_delta_bytes`, `json_blob`

- **events** (idempotency/logging — for later live mode)
  - `source`, `key`, `payload`, `created_at`

---

## Step 3 — Database DDL (ready for Neon)

Use this as a migration (Prisma or raw SQL). Raw SQL shown:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linear_id TEXT UNIQUE NOT NULL,
  linear_key TEXT NOT NULL,            -- e.g., ENG-123
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  repo TEXT,
  status TEXT,                         -- e.g., Backlog|In Progress|In Review|Done
  arena_ready_labeled_at TIMESTAMPTZ,
  winner_attempt_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,            -- 'cursor' | 'engine' | 'cyrus'
  repo TEXT NOT NULL,                  -- 'owner/repo'
  pr_number INTEGER NOT NULL,
  pr_url TEXT NOT NULL,
  branch TEXT,
  opened_at TIMESTAMPTZ NOT NULL,
  merged_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  status TEXT NOT NULL,                -- 'open' | 'merged' | 'closed'
  commit_count INTEGER NOT NULL DEFAULT 1,
  last_commit_sha TEXT,
  UNIQUE (issue_id, agent_name, pr_number)
);

ALTER TABLE issues
  ADD CONSTRAINT issues_winner_fk
  FOREIGN KEY (winner_attempt_id) REFERENCES attempts(id);

CREATE TABLE issue_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  status TEXT NOT NULL,                -- 'queued' | 'triggered' | 'failed' | 'skipped'
  external_job_id TEXT,
  triggered_at TIMESTAMPTZ,
  UNIQUE (issue_id, agent_name)
);

CREATE TABLE ci_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  tests_passed INTEGER,
  tests_failed INTEGER,
  coverage_delta REAL,
  perf_delta_ms REAL,
  lint_errors INTEGER,
  size_delta_bytes INTEGER,
  json_blob JSONB
);

CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,                -- 'linear' | 'github' | 'cron'
  key TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, key)
);
```

**Views** (for the UI)

```sql
CREATE VIEW agent_stats AS
SELECT
  agent_name,
  COUNT(*) AS attempts,
  COUNT(*) FILTER (WHERE status='merged') AS wins,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status='merged') / NULLIF(COUNT(*),0), 1) AS acceptance_pct
FROM attempts
GROUP BY agent_name;
```

Lead‑time queries (issue→first PR, PR→merge) are computed in SQL or in code via joins.

---

## Step 4 — Fixtures & seeding (realistic mock data)

We want demo data that looks like your org:

```
/fixtures/
  linear-issues.json         # subset of your real issues (anonymized titles ok)
  github-prs.json            # synthetic PRs keyed by linear_key
  ci-metrics.json            # optional, to show the UI cards
```

**Option A (fastest):** Hand‑craft a small JSON (10–30 issues) with fields we need.
**Option B (richer):** Run a local one‑off script (not in the deployed app) that uses your Linear API key to export recent issues (team(s), last 30–60 days). Save the **JSON snapshot** into `/fixtures/` and commit it (with any redaction). _(We won’t call Linear at runtime.)_

**Seeding logic** (`scripts/seed.ts`)

- Read `linear-issues.json`; insert rows into `issues`.
- For each issue:
  - Generate 1–3 **attempts** (one per agent) with plausible timestamps:
    - `opened_at` = within [issue.created_at + 30m, +2d]
    - randomly **merge** 0–1 attempts; mark others `closed`.
    - realistic **commit_count** (1–7), `branch` like `eng-123--agent-cursor`.
    - set `repo` from a small map.
    - set `pr_url` as a plausible GH link (it’s just a link for now).

- If an attempt merged, set `issues.winner_attempt_id`.
- Optionally attach **ci_metrics** with believable numbers (coverage +1.2, perf −5.3 ms, etc.).

This gives you a dashboard that feels like production without any external calls.

---

## Step 5 — UI (pages & components)

**Tech choices**

- Next.js (App Router) + TypeScript
- Tailwind CSS (+ shadcn/ui components if you like)
- Data fetching via Server Components (simple SQL queries via Prisma/`postgres.js`)
- No auth for v1 (or add GitHub SSO later)

**Pages**

1. **/** — _Overview / Leaderboard_
   - Cards: **Attempts**, **Wins**, **Acceptance %**, **Avg time‑to‑PR**, **Avg time‑to‑merge** (per agent).
   - Table: agents (Cursor, Engine, Cyrus) with the above metrics.
   - Filters: date range (last 7/30/90), repo (multi‑select).

2. **/issues** — _Issues list_
   - Columns: Issue Key, Title, Repo, Status, Winner (agent), Winner PR, Time‑to‑merge.
   - Filters: status, repo, has winner, date range.
   - Row click → Issue detail.

3. **/issues/[key]** — _Issue detail_
   - Header: title, key, repo, status, created/labeled times.
   - **Attempts timeline**: list or simple timeline (agent → PR → status).
   - For each attempt: agent badge, PR link, commit_count, opened/closed/merged times, (optional) CI metrics.

4. **/agents/[name]** — _Agent detail_
   - KPI strip: acceptance %, attempts, wins, avg times.
   - Table: recent attempts and outcomes.
   - (Optional later) charts: acceptance over time, time‑to‑merge trend.

5. **/admin** (optional)
   - Read‑only view of `AGENTS_CONFIG_JSON`, `ALLOWED_REPOS`.
   - “Reseed DB” button (dev only).

**UI polish**

- Empty states (“No attempts in range”).
- Loading skeletons.
- Persistent filters in URL query.

---

## Step 6 — API routes (internal JSON for the UI)

- `GET /api/public/agents?from=&to=&repo=` → aggregates for leaderboard.
- `GET /api/public/issues?from=&to=&repo=&status=&winner=` → paginated list.
- `GET /api/public/issues/[key]` → detail (issue + attempts + ci_metrics).
- `GET /api/public/agents/[name]?from=&to=` → time‑series aggregates (table first).

> These mirror what the live mode will need; when we turn on webhooks, the API stays identical.

---

## Step 7 — Dev tasks (for the coding agent)

1. **Repo scaffolding**
   - Next.js app, Tailwind, basic layout and nav.
   - DB client and migration runner (Prisma or SQL migrations).
   - `.env.example` with the variables in Step 1.

2. **DB & seed**
   - Apply DDL to Neon.
   - Implement `scripts/seed.ts` consuming `/fixtures/*.json`.
   - Add `pnpm db:reset` → drops & re‑seeds (dev convenience).

3. **Data layer**
   - Query helpers for agent aggregates, issues list, issue detail, and simple date‑range filtering.

4. **Pages & components**
   - Implement pages in Step 5 with clean table components and KPI cards.
   - Add server‑side filters (query params → SQL WHERE).

5. **Demo mode controls**
   - Honor `ARENA_MODE=demo` to hide any live‑mode banners/buttons.
   - Footer badge: “Demo data (seeded from fixtures)”.

6. **QA**
   - Validate totals match: `wins ≤ attempts`, acceptance = wins/attempts.
   - Validate time deltas (non‑negative; merged implies merged_at set).
   - Empty states work with small seed sets.

---

## Step 8 — Acceptance criteria (UI‑first v1)

- App deploys on Vercel; loads data **only** from Neon.
- `/` shows a leaderboard with **Cursor/Engine/Cyrus** and correct aggregates over the seeded date range.
- `/issues` lists seeded issues; detail pages show attempts with plausible PR links and commit counts.
- Changing the date range or repo filter updates aggregates & tables accordingly.
- No calls to Linear/GitHub in demo mode; no secrets required to run the UI.

---

## Step 9 — How we “go live” later (zero UI change)

When the UI is approved:

1. Set `ARENA_MODE=live`.
2. Add **webhook routes**:
   - `POST /api/linear/webhook` → on `arena:ready`, insert `issue_agents` rows and (later) dispatch agents.
   - `POST /api/github/webhook` → upsert attempts/commit_count/status on PR events.

3. Keep the same tables. The UI **doesn’t change**—it already queries production‑shape data.

---

## Step 10 — Seed data templates (drop in now)

**fixtures/linear-issues.json (excerpt)**

```json
[
  {
    "linear_id": "lin_01HXYZ...",
    "linear_key": "ENG-123",
    "title": "Add server-side search to Projects page",
    "url": "https://linear.app/acme/issue/ENG-123",
    "repo": "acme/frontend",
    "status": "In Review",
    "created_at": "2025-10-02T12:10:00Z",
    "arena_ready_labeled_at": "2025-10-05T09:00:00Z"
  }
]
```

**fixtures/github-prs.json (excerpt)**

```json
[
  {
    "linear_key": "ENG-123",
    "attempts": [
      {
        "agent_name": "cursor",
        "repo": "acme/frontend",
        "pr_number": 4821,
        "pr_url": "https://github.com/acme/frontend/pull/4821",
        "branch": "eng-123--server-search--agent-cursor",
        "status": "merged",
        "opened_at": "2025-10-05T11:40:00Z",
        "merged_at": "2025-10-06T15:22:00Z",
        "commit_count": 4
      },
      {
        "agent_name": "engine",
        "repo": "acme/frontend",
        "pr_number": 4823,
        "pr_url": "https://github.com/acme/frontend/pull/4823",
        "branch": "eng-123--server-search--agent-engine",
        "status": "closed",
        "opened_at": "2025-10-05T12:10:00Z",
        "closed_at": "2025-10-06T16:55:00Z",
        "commit_count": 3
      }
    ]
  }
]
```

**fixtures/ci-metrics.json (optional)**

```json
[
  {
    "pr_number": 4821,
    "repo": "acme/frontend",
    "tests_passed": 842,
    "tests_failed": 0,
    "coverage_delta": 2.7,
    "perf_delta_ms": -6.5,
    "lint_errors": 0,
    "size_delta_bytes": 812
  }
]
```

---

## Step 11 — Copy you can paste into the UI

- **Empty state (issues):** “Label any Linear issue with **arena:ready** to trigger agent attempts. This dashboard shows results once PRs are opened.”
- **KPI tooltips:**
  - _Acceptance %_: “Merged attempts / Total attempts (period).”
  - _Time‑to‑PR_: “Diff between issue labeled **arena:ready** and first PR opened.”
  - _Time‑to‑merge_: “Diff between PR opened and merged.”

- **Issue detail hint:** “Branch names and PR bodies should include the Linear key (e.g., **ENG‑123**) so our automations can link and track status automatically.”

---

## Step 12 — What I need from you to start Milestone 1

- ✅ Neon connection string: `postgresql://neondb_owner:REDACTED_REVOKE_BEFORE_USE@ep-misty-poetry-a4ukdnof-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
- ✅ Either:
  - a small curated **fixtures/linear-issues.json** list you're comfortable committing **(best for speed)**, or
  - permission to run a **local** one‑off export to produce that JSON (never stored server‑side)

**Note:** We'll create Vercel project and configure env vars there only when ready to deploy (after M1 or before M2).

---

---

# MULTI-MILESTONE ROADMAP

The plan below breaks the full implementation into **3 clear milestones**, each fully functional and deployable. You can stop at any milestone and have a working system.

---

## 🎯 MILESTONE 1: UI-First Dashboard (Demo Mode)

**What you get:** A beautiful, fully functional Arena dashboard showing agent performance metrics, using seeded data. Runs locally for development.

**Duration:** ~1–2 days for a coding agent

**Status at completion:**

- ✅ App runs locally on `localhost:3000`
- ✅ Real Neon DB with production-shape tables
- ✅ Leaderboard, Issues list, Issue detail, Agent detail pages
- ✅ All UI polish: filters, empty states, loading states
- ✅ Seed pipeline that feels realistic
- ❌ No live webhooks (demo data only)
- ❌ Not deployed yet (local development only)

**Local Environment Setup:**

Create `.env.local` in project root:

```bash
# Database
DATABASE_URL=postgresql://neondb_owner:REDACTED_REVOKE_BEFORE_USE@ep-misty-poetry-a4ukdnof-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# Mode
ARENA_MODE=demo
NODE_ENV=development

# Demo config (for display/copy only)
ARENA_LABEL=arena:ready
ALLOWED_REPOS=org/frontend,org/api

# Seeding
ARENA_SEED_SOURCE=fixtures
SEED_DAYS=30
```

**Deliverables:**

- All pages & components from Step 5 above
- Seed script (`scripts/seed.ts`)
- JSON endpoints (`/api/public/*`)
- `.env.example` with all variables (but **not** the actual DB password)
- `pnpm db:reset` command for re-seeding
- Working app on `localhost:3000`

**Acceptance:**

- Dashboard loads with realistic agent stats on localhost
- Filters work (date range, repo)
- Detail pages show attempts timeline with commit counts
- No external API calls; runs without webhook secrets
- `.env.local` is gitignored (never committed)

---

## 🚀 OPTIONAL: Deploy to Vercel (Show Your Team)

**When to do this:** After M1 is working locally, deploy to show your team the UI before adding live webhooks.

**Steps:**

1. **Create Vercel project:**
   - Go to [vercel.com](https://vercel.com) → Add New Project
   - Import your GitHub repo
   - Vercel auto-detects Next.js

2. **Add Environment Variables in Vercel:**
   - Go to Project Settings → Environment Variables
   - Add for Production, Preview, and Development:

   ```bash
   DATABASE_URL=postgresql://neondb_owner:REDACTED_REVOKE_BEFORE_USE@ep-misty-poetry-a4ukdnof-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ARENA_MODE=demo
   ARENA_LABEL=arena:ready
   ALLOWED_REPOS=org/frontend,org/api
   ARENA_SEED_SOURCE=fixtures
   SEED_DAYS=30
   ```

3. **Deploy:**
   - Click "Deploy"
   - Your app will be live at `https://your-app.vercel.app`

4. **Run seed script** (if database is empty):
   - From Vercel dashboard, you can run commands in Functions logs
   - Or use a one-time deploy that includes a seeding step

**Note:** At this stage, the app still uses demo data. No webhooks yet.

---

## 🎯 MILESTONE 2: GitHub Integration (Live PR Tracking)

**What you get:** Real-time PR tracking. As agents (or anyone) open/update/merge PRs, your dashboard reflects it immediately.

**Duration:** ~1 day

**Status at completion:**

- ✅ GitHub webhook receiving PR events
- ✅ Automatic PR → Linear issue linking (with fallback autopatch)
- ✅ Real-time `commit_count` updates
- ✅ Winner selection when PR merges
- ✅ Dashboard shows live data
- ❌ Still manually adding `arena:ready` label in Linear (no auto-dispatch yet)

### How Webhooks Work (Important!)

**Webhooks are "reverse APIs"** — instead of your app calling GitHub, GitHub calls YOUR app when events happen.

**The flow:**

1. **You implement** webhook endpoints in your Next.js app (`/api/github/webhook`)
2. **You deploy** your app to a public URL (e.g., Vercel: `https://your-app.vercel.app`)
3. **You configure GitHub** to send events TO your app's URL
4. **GitHub pushes** event data to your endpoint when PRs are opened/updated/merged
5. **Your app receives** the data and updates your database

**Key point:** Your app must be deployed with the webhook route BEFORE you configure GitHub to use it.

**What changes:**

- Set `ARENA_MODE=live` (or `ARENA_MODE=github-only` if you want to be explicit)
- Add GitHub webhook & secrets

**New environment variables:**

```bash
ARENA_MODE=live
GITHUB_WEBHOOK_SECRET=<random-string>
GITHUB_TOKEN=<fine-grained-PAT-with-PR-read-write>
```

### Implementation: GitHub Webhook (`/api/github/webhook`)

**Route:** `POST /api/github/webhook`

**Purpose:** Track all PR activity and ensure every PR is linked to a Linear issue (even if agents forget).

#### Security

```typescript
import crypto from 'crypto'

function verifyGitHubSignature(payload: string, signature: string): boolean {
  const hmac = crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET!)
  const digest = 'sha256=' + hmac.update(payload).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))
}
```

Verify `X-Hub-Signature-256` header. ([GitHub Docs](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries))

#### Event: `pull_request.opened`

1. **Check repo whitelist:** If `payload.repository.full_name` not in `ALLOWED_REPOS`, ignore.
2. **Extract Linear key** (in priority order):
   - Parse **PR title** for pattern `ENG-123` or similar
   - Parse **PR body** for Linear URL or key with magic words
   - Parse **branch name** (preferred): `eng-123--slug--agent-cursor`
3. **If key found:**
   - Look up issue in `issues` table by `linear_key`
   - If not found, fetch from Linear API (optional, or skip)
   - Create `attempts` row:
     ```sql
     INSERT INTO attempts (issue_id, agent_name, repo, pr_number, pr_url, branch, opened_at, status, commit_count)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), 'open', 1);
     ```
4. **If key NOT found in title/body but IS in branch:**
   - Create attempt (as above)
   - **PATCH the PR body** to append: `\n\nRefs https://linear.app/<workspace>/issue/<KEY>`
   - This ensures Linear auto-links the PR ([Linear Docs](https://linear.app/docs/github-integration))
5. **If key not found anywhere:**
   - Log warning
   - Store attempt as "unlinked" (null `issue_id`) for manual reconciliation
   - Optionally add GitHub label `needs-linear-link`

**Why autopatch?** Linear's GitHub integration auto-links PRs when:

- Branch name contains the key, OR
- PR title contains the key, OR
- PR description includes a magic word (`Fixes`, `Closes`, `Resolves`, `Refs`, `Related to`) + key/URL

By patching the body with `Refs <URL>`, you guarantee the link without auto-closing the issue. ([Linear Docs](https://linear.app/docs/github-integration))

#### Event: `pull_request.synchronize`

Update the attempt:

```typescript
// Fetch commit count from GitHub API (authoritative source)
const commits = await octokit.rest.pulls.listCommits({
  owner,
  repo,
  pull_number,
})

await db.query(
  `
  UPDATE attempts
  SET commit_count = $1, last_commit_sha = $2
  WHERE pr_number = $3 AND repo = $4
`,
  [
    commits.data.length,
    commits.data[commits.data.length - 1].sha,
    pr_number,
    repo,
  ]
)
```

Use GitHub's "List commits on a pull request" endpoint ([GitHub Docs](https://docs.github.com/en/rest/pulls/pulls)).

#### Event: `pull_request.closed`

```typescript
const merged = payload.pull_request.merged

if (merged) {
  // Mark this attempt as merged
  await db.query(
    `
    UPDATE attempts SET status = 'merged', merged_at = NOW()
    WHERE pr_number = $1 AND repo = $2
    RETURNING id, issue_id
  `,
    [pr_number, repo]
  )

  // Set as winner
  await db.query(
    `
    UPDATE issues SET winner_attempt_id = $1
    WHERE id = $2
  `,
    [attempt.id, attempt.issue_id]
  )

  // Mark other attempts for same issue as closed
  await db.query(
    `
    UPDATE attempts SET status = 'closed', closed_at = NOW()
    WHERE issue_id = $1 AND id != $2 AND status = 'open'
  `,
    [attempt.issue_id, attempt.id]
  )
} else {
  // Just closed (not merged)
  await db.query(
    `
    UPDATE attempts SET status = 'closed', closed_at = NOW()
    WHERE pr_number = $1 AND repo = $2
  `,
    [pr_number, repo]
  )
}
```

**Note on Linear workflow automations:** Once PRs are linked, Linear's GitHub integration will automatically move issues through workflow states:

- **"In Progress"** when PR opens
- **"Ready to merge"** when CI passes & approvals complete
- **"Done"** when PR merges (if using closing magic words like `Fixes`)

You don't need to call Linear's API to update issue status—the integration handles it. ([Linear Changelog](https://linear.app/changelog/2023-11-15-github-workflow-updates))

#### Idempotency

Use the `events` table:

```typescript
const eventKey = `github:pr:${pr_number}:${action}:${pr_updated_at}`
await db.query(
  `
  INSERT INTO events (source, key, payload)
  VALUES ('github', $1, $2)
  ON CONFLICT (source, key) DO NOTHING
  RETURNING id
`,
  [eventKey, payload]
)

if (!inserted) {
  return // Already processed
}
```

### Setup Checklist (Milestone 2)

**CRITICAL ORDER OF OPERATIONS:**

#### Step 1: Implement the Webhook Route in Your App

Create the file `app/api/github/webhook/route.ts` (or `/pages/api/github/webhook.ts` for Pages Router):

```typescript
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  // 1. Verify signature
  const signature = req.headers.get('x-hub-signature-256')
  const body = await req.text()

  if (!verifyGitHubSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(body)

  // 2. Handle the event (implementation from above)
  // ... see Event handlers above

  return NextResponse.json({ received: true })
}

function verifyGitHubSignature(
  payload: string,
  signature: string | null
): boolean {
  if (!signature) return false
  const hmac = crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET!)
  const digest = 'sha256=' + hmac.update(payload).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))
}
```

#### Step 2: Deploy Your App to Vercel

**If you haven't deployed yet:**

1. Follow the "Deploy to Vercel" section above to create Vercel project and add base env vars
2. Push your code with the new webhook route
3. Deploy to Vercel
4. Note your deployment URL: `https://your-app.vercel.app`

**If you already deployed after M1:**

1. Push your code with the new webhook route
2. Vercel auto-deploys on push
3. Your webhook endpoint will be: `https://your-app.vercel.app/api/github/webhook`

#### Step 3: Add NEW Environment Variables to Vercel

Go to your Vercel project → Settings → Environment Variables

**Add these NEW variables** (for all environments: Production, Preview, Development):

```bash
# GitHub webhook security
GITHUB_WEBHOOK_SECRET=   # Generate with: openssl rand -hex 32

# GitHub API access (for patching PRs and reading commits)
GITHUB_TOKEN=   # Fine-grained PAT with "Pull Requests: Read/Write" permission

# Switch from demo to live mode
ARENA_MODE=live
```

**To create the GitHub token:**

1. Go to GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Click "Generate new token"
3. Repository access: Select repos in `ALLOWED_REPOS`
4. Permissions: `Pull requests` = Read and write
5. Generate and copy the token

**After adding env vars:** Redeploy (Vercel → Deployments → Redeploy)

#### Step 4: Configure GitHub to Send Events to Your App

**Now** you can set up the webhook in GitHub (this is where GitHub sends events TO your app):

1. Go to your GitHub repo or organization → Settings → Webhooks → Add webhook
2. **Payload URL**: `https://your-app.vercel.app/api/github/webhook` (your deployed app URL)
3. **Content type**: `application/json`
4. **Secret**: Use the same value from `GITHUB_WEBHOOK_SECRET` above
5. **Events**: Select "Let me select individual events"
   - Check: `Pull requests` (this includes opened, synchronize, closed)
   - Uncheck everything else for now
6. **Active**: Ensure it's checked
7. Click "Add webhook"

GitHub will send a test ping. Check "Recent Deliveries" to confirm it received a 200 response.

#### Step 5: Document Branch Naming Convention

For your team: `<KEY>--<slug>--agent-<name>` (e.g., `ENG-123--fix-search--agent-cursor`)

Linear's GitHub integration auto-links PRs based on branch names containing the key.

### Testing (Milestone 2)

1. **Auto-link via branch name:**
   - Create a branch `ENG-999--test--agent-manual`
   - Open a PR with empty body
   - Confirm: webhook patches PR body with `Refs` link, attempt appears in dashboard
2. **Commit count updates:**
   - Push 2 more commits
   - Confirm dashboard shows `commit_count = 3`
3. **Winner selection:**
   - Merge the PR
   - Confirm: attempt marked `merged`, issue shows winner, other attempts (if any) marked `closed`
4. **Unlinked PR:**
   - Open a PR from branch without key, no key in title/body
   - Confirm: logged as unlinked, flagged for manual fix

**Acceptance (Milestone 2):**

- ✅ Opening a PR from a properly named branch auto-links to Linear and creates an attempt
- ✅ Dashboard updates in real-time as commits are pushed
- ✅ Merging a PR selects a winner and closes other attempts
- ✅ PR body autopatch works when branch has key but body doesn't

---

## 🎯 MILESTONE 3: Linear Integration (Full Automation)

**What you get:** Complete end-to-end automation. Add `arena:ready` label → agents dispatched → PRs tracked → winner selected → dashboard updated.

**Duration:** ~1 day

**Status at completion:**

- ✅ Linear webhook receiving label events
- ✅ Automatic agent dispatch via @mentions
- ✅ Agent dispatch comments include branch & PR templates
- ✅ Full idempotent trigger system
- ✅ Production-ready

### How This Works with Linear Webhooks

Same as Milestone 2, but now Linear sends events to your app:

**The flow:**

1. **You implement** webhook endpoint in your app (`/api/linear/webhook`)
2. **You deploy** your updated app to Vercel
3. **You configure Linear** to send events TO your app's URL
4. **Linear pushes** event data when issues are labeled/updated
5. **Your app receives** the data, dispatches agents via Linear comments, and tracks in DB

**New environment variables:**

```bash
LINEAR_WEBHOOK_SECRET=<random-string>
LINEAR_API_KEY=<personal-api-key-or-oauth>
AGENTS_CONFIG_JSON=[{"name":"cursor","mode":"linear_mention","handle":"@Cursor"},{"name":"engine","mode":"linear_mention","handle":"@Engine"},{"name":"cyrus","mode":"linear_mention","handle":"@Cyrus"}]
ARENA_LABEL=arena:ready
ARENA_LABEL_ID=<optional-linear-label-uuid>
```

### Implementation: Linear Webhook (`/api/linear/webhook`)

**Route:** `POST /api/linear/webhook`

**Purpose:** When an issue gets the `arena:ready` label, dispatch all configured agents.

#### Security

```typescript
import crypto from 'crypto'

function verifyLinearSignature(payload: string, signature: string): boolean {
  const hmac = crypto.createHmac('sha256', process.env.LINEAR_WEBHOOK_SECRET!)
  const digest = hmac.update(payload).digest('hex')
  return signature === digest
}
```

Verify signature from Linear webhook headers.

#### Event: Issue labeled (or created/updated with label)

1. **Check for `arena:ready` label:**

   ```typescript
   const hasArenaLabel = payload.data.labels?.some(
     (label: any) => label.name === process.env.ARENA_LABEL
   )
   if (!hasArenaLabel) return
   ```

2. **Upsert issue:**

   ```typescript
   await db.query(
     `
     INSERT INTO issues (linear_id, linear_key, title, url, repo, status, arena_ready_labeled_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (linear_id)
     DO UPDATE SET
       arena_ready_labeled_at = COALESCE(issues.arena_ready_labeled_at, NOW()),
       status = EXCLUDED.status
   `,
     [
       issue.id,
       issue.identifier,
       issue.title,
       issue.url,
       issue.repository,
       issue.state,
     ]
   )
   ```

3. **Create `issue_agents` rows:**

   ```typescript
   const agents = JSON.parse(process.env.AGENTS_CONFIG_JSON!)

   for (const agent of agents) {
     await db.query(
       `
       INSERT INTO issue_agents (issue_id, agent_name, status)
       VALUES ($1, $2, 'queued')
       ON CONFLICT (issue_id, agent_name) DO NOTHING
     `,
       [dbIssueId, agent.name]
     )
   }
   ```

4. **Dispatch agents:**

   For each agent, post a **Linear comment** with the dispatch template:

   ```typescript
   import { LinearClient } from '@linear/sdk';
   const linear = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

   const slug = issue.title.toLowerCase()
     .replace(/[^a-z0-9]+/g, '-')
     .substring(0, 30);

   const branchName = `${issue.identifier.toLowerCase()}--${slug}--agent-${agent.name}`;

   const commentBody = `
   @${agent.handle} Arena trigger: Please start work on this issue.
   ```

**Use branch:**
\`\`\`
${branchName}
\`\`\`

**Include in PR body** (non-closing link):
\`\`\`
Refs ${issue.url}
\`\`\`

(Alternatively, to auto-complete the issue on merge, use \`Fixes ${issue.url}\`)
`.trim();

await linear.createComment({
issueId: issue.id,
body: commentBody
});

// Mark as triggered
await db.query(`      UPDATE issue_agents
     SET status = 'triggered', triggered_at = NOW()
     WHERE issue_id = $1 AND agent_name = $2
   `, [dbIssueId, agent.name]);

````

**Magic words policy decision:**
- **`Refs` (recommended for v1):** Links PR to issue without auto-closing. You rely on Linear's workflow automations to move the issue to Done when the PR merges.
- **`Fixes`/`Closes`/`Resolves`:** Auto-closes the issue on merge. Simpler but less flexible.

Pick one and document it in the agent dispatch template. ([Linear Docs](https://linear.app/docs/github-integration))

#### Idempotency

```typescript
const eventKey = `linear:issue:${issue.id}:labeled:arena-ready`;
// Same pattern as GitHub webhook
````

### Setup Checklist (Milestone 3)

**CRITICAL ORDER OF OPERATIONS:**

#### Step 1: Implement the Linear Webhook Route in Your App

Create the file `app/api/linear/webhook/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { LinearClient } from '@linear/sdk'

export async function POST(req: NextRequest) {
  // 1. Verify signature
  const signature = req.headers.get('linear-signature')
  const body = await req.text()

  if (!verifyLinearSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(body)

  // 2. Handle the event (implementation from above)
  // ... see Event handlers above

  return NextResponse.json({ success: true })
}

function verifyLinearSignature(
  payload: string,
  signature: string | null
): boolean {
  if (!signature) return false
  const hmac = crypto.createHmac('sha256', process.env.LINEAR_WEBHOOK_SECRET!)
  const digest = hmac.update(payload).digest('hex')
  return signature === digest
}
```

Install Linear SDK:

```bash
pnpm add @linear/sdk
```

#### Step 2: Deploy Your App to Vercel

**Your app should already be deployed from M2.** Just:

1. Push your code with the new Linear webhook route
2. Vercel auto-deploys on push
3. Your webhook endpoint will be: `https://your-app.vercel.app/api/linear/webhook`

#### Step 3: Add NEW Environment Variables to Vercel

Go to your Vercel project → Settings → Environment Variables

**Add these NEW variables** (for all environments: Production, Preview, Development):

```bash
# Linear webhook security
LINEAR_WEBHOOK_SECRET=   # Generate with: openssl rand -hex 32

# Linear API key (to post comments and dispatch agents)
LINEAR_API_KEY=   # Create in Linear Settings → API → Personal API keys

# Agent configuration
AGENTS_CONFIG_JSON=   # See format below
```

**AGENTS_CONFIG_JSON format** (paste as a single line):

```json
[{"name":"cursor","mode":"linear_mention","handle":"@Cursor"},{"name":"engine","mode":"linear_mention","handle":"@Engine"},{"name":"cyrus","mode":"linear_mention","handle":"@Cyrus"}]
```

**To create the Linear API key:**
1. Go to Linear Settings → API
2. Click "Create new key" under "Personal API keys"
3. Give it a name like "Arena Backend"
4. Copy the key (starts with `lin_api_...`)

**Note:** `ARENA_LABEL=arena:ready` should already be set from M1. No need to add it again.

**After adding env vars:** Redeploy (Vercel → Deployments → Redeploy)

#### Step 4: Configure Linear to Send Events to Your App

**Now** you can set up the webhook in Linear (this is where Linear sends events TO your app):

1. Go to Linear Settings → API (under "My Account" or "Workspace" section)
2. Click "Create new webhook"
3. **URL**: `https://your-app.vercel.app/api/linear/webhook` (your deployed app URL)
4. **Secret**: Use the same value from `LINEAR_WEBHOOK_SECRET` above
5. **Resources**: Select the events to monitor:
   - Check: `Issue`
   - Check: `IssueLabel`
6. Click "Create webhook"

Linear will send a test event. Check the webhook logs to confirm it's receiving events.

#### Step 5: Create the `arena:ready` Label in Linear

1. Go to Linear Settings → Labels
2. Create a new label: `arena:ready`
3. Choose a color (e.g., orange or red for urgency)
4. Save

Optionally note the label UUID, but it's not required—your webhook will filter by name.

#### Step 6: Install & Configure Linear GitHub Integration (CRITICAL)

This is what makes the system low-friction—Linear automatically updates issue status based on PR state:

1. Go to [Linear Integrations](https://linear.app/integrations/github)
2. Click "Add to Linear" and authorize GitHub access
3. Select your GitHub organization
4. Enable for repos in `ALLOWED_REPOS`
5. **Enable workflow automations** in team settings:
   - Settings → Teams → [Your Team] → Workflows
   - Turn on GitHub automations:
     - **PR opened** → move issue to "In Progress"
     - **PR approved + CI passing** → move issue to "Ready to merge"
     - **PR merged** → move issue to "Done"

This is the key feature that eliminates manual work. ([Linear Changelog](https://linear.app/changelog/2023-11-15-github-workflow-updates))

#### Step 7: Verify Agent Configuration

1. Confirm your three agents (Cursor, Engine, Cyrus) are set up in Linear
2. They must respond to `@mentions` in comments
3. Update `AGENTS_CONFIG_JSON` in Vercel with the exact handles (case-sensitive)
4. Test: @mention each agent in a Linear comment to verify they respond

### Testing (Milestone 3)

1. **Label trigger:**
   - Create a test issue `TEST-100` in Linear
   - Add label `arena:ready`
   - Confirm: webhook fires, `issue_agents` rows created, Linear comments posted with @mentions and templates
2. **Agent dispatch:**
   - Confirm agents receive the @mention notifications
   - Verify branch template and PR body template are correct
3. **End-to-end:**
   - Wait for an agent (or manually) to open a PR from the suggested branch
   - Confirm: GitHub webhook picks it up, creates attempt, links to issue
   - Merge PR
   - Confirm: winner selected, other attempts closed, Linear issue moves to Done (via workflow automation)
4. **Idempotency:**
   - Re-deliver the same Linear webhook
   - Confirm: agents not re-triggered (idempotency key prevents duplicates)

**Acceptance (Milestone 3):**

- ✅ Adding `arena:ready` to a Linear issue dispatches all agents exactly once
- ✅ Agents receive clear instructions (branch name, PR body template)
- ✅ Full flow works: label → dispatch → PR → merge → winner
- ✅ Linear issue status updates automatically via GitHub integration
- ✅ Dashboard shows real-time data from production

---

## 🎯 MILESTONE 4 (Optional): Polish & Production Hardening

**What you get:** Production-ready refinements, admin tools, monitoring.

**Duration:** ~1–2 days

**Features:**

### 4.1 Cron Reconciliation Job

**Route:** `GET /api/cron/reconcile` (protected by Vercel Cron secret)

**Purpose:** Nightly hygiene—catch any webhooks that were missed or issues that fell through cracks.

**Tasks:**

- Find issues with `arena_ready_labeled_at` set but no `issue_agents` rows → re-trigger
- Find open PRs (via GitHub API) that aren't in `attempts` → backfill
- Find attempts with `commit_count = 0` → update from GitHub
- Clean up stale `events` older than 90 days

**Setup:** Add Vercel Cron job in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/reconcile",
      "schedule": "0 2 * * *"
    }
  ]
}
```

### 4.2 Admin Panel (`/admin`)

**Features:**

- View current config: `AGENTS_CONFIG_JSON`, `ALLOWED_REPOS`, `ARENA_LABEL`
- Manual actions (dev/admin only):
  - Re-trigger specific issue
  - Reseed database
  - View recent webhook payloads (from `events` table)
- Health check: last successful Linear/GitHub webhook received

**Auth:** Add basic GitHub SSO or Vercel password protection.

### 4.3 Enhanced Error Handling

- Structured logging (Vercel logs or Datadog)
- Sentry integration for webhook errors
- Retry logic for Linear/GitHub API calls (with exponential backoff)
- Slack/Discord notifications for critical failures

### 4.4 Charts & Trends (Optional)

Replace tables in `/agents/[name]` with:

- Line chart: acceptance % over time (by week)
- Bar chart: time-to-merge distribution
- Heatmap: activity by day of week

Use Chart.js or Recharts.

### 4.5 Edge Cases & Notes

1. **Forked PRs:**
   - If an agent opens a PR from a fork and disables "edits from maintainers," your webhook can't patch the PR body
   - Solution: Log a warning and add a GitHub comment asking them to add the Linear link
2. **Multiple PRs per agent:**
   - Schema allows it: `UNIQUE (issue_id, agent_name, pr_number)`
   - Dashboard shows all attempts; only first merged PR becomes winner
3. **Private repos:**
   - Ensure `GITHUB_TOKEN` has access to private repos if needed
4. **Linear custom fields:**
   - If you want to track additional metadata (e.g., story points), add to `issues` table JSON column

---

## Summary: Your Path to Production

| Milestone        | Features                           | Duration | Deployable?              |
| ---------------- | ---------------------------------- | -------- | ------------------------ |
| **M1: UI-First** | Dashboard with demo data           | 1–2 days | ✅ Yes (demo mode)       |
| **M2: GitHub**   | Live PR tracking                   | 1 day    | ✅ Yes (manual labeling) |
| **M3: Linear**   | Full automation (label → dispatch) | 1 day    | ✅ Yes (production)      |
| **M4: Polish**   | Cron, admin, monitoring, charts    | 1–2 days | ✅ Yes (hardened prod)   |

**Total:** ~4–6 days for a coding agent to implement M1–M3.

**Recommendation:** Ship M1 to get feedback on UI/UX, then implement M2–M3 in one sprint.

---

## Key Decisions to Make Before Milestone 3

1. **Magic words policy:**
   - Use `Refs` (non-closing) or `Fixes` (auto-closing)?
   - Recommendation: Start with `Refs` + rely on Linear workflow automations
2. **Agent handles:**
   - Confirm exact @mention handles in Linear (case-sensitive)
3. **Repos:**
   - List all repos for `ALLOWED_REPOS`
4. **Issue assignment:**
   - Should issues be auto-assigned to the agents, or left unassigned?

---

## All Critical References (From Research)

- [Linear GitHub Integration](https://linear.app/integrations/github) — How auto-linking works
- [Linear Workflow Automations](https://linear.app/changelog/2023-11-15-github-workflow-updates) — PR state → issue state
- [Linear Docs: GitHub](https://linear.app/docs/github-integration) — Magic words, branch linking
- [GitHub: Webhook Validation](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries) — HMAC signature verification
- [GitHub: List PR Commits](https://docs.github.com/en/rest/pulls/pulls) — Authoritative commit count

---

## What I Need to Start Milestone 1

- ✅ Neon connection string
- ✅ Vercel project created
- ✅ Small `fixtures/linear-issues.json` (10–30 issues) or permission to export from Linear API

Once M1 is approved, we'll add the webhook secrets and API keys for M2–M3.
