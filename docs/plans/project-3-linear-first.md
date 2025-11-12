# ARENA — Linear-First Implementation Plan

**Last updated:** Nov 12, 2025
**Status:** M1 Complete, ready for M2

---

## Executive Summary

This plan builds a **coding agent arena** where Cursor, Engine, and Cyrus compete on real Linear issues. The system uses **Linear as the event hub** (no GitHub webhooks needed) and relies on Linear's native GitHub integration to track PR activity.

### Why Linear-First?

- **Simpler architecture:** One webhook source instead of two
- **High fidelity:** Linear's GitHub integration auto-links PRs and tracks state
- **Less moving parts:** No GitHub webhook security/routing to manage
- **Same UX:** Dashboard updates in real-time from Linear events
- **Optional enrichment:** Add GitHub polling later for commit counts/CI metrics

---

## Current Status

### ✅ MILESTONE 1: COMPLETE

**What was built:** Fully functional Arena dashboard with seeded demo data.

**Delivered:**
- ✅ Next.js app (App Router + TypeScript) with Tailwind CSS
- ✅ Neon Postgres database with production-ready schema:
  - `issues`, `attempts`, `issue_agents`, `ci_metrics`, `events`
  - `agent_stats` view for leaderboard
- ✅ **Pages:**
  - `/` — Leaderboard (agent stats, acceptance %, time metrics)
  - `/issues` — Issues list with filters (date, repo, status, winner)
  - `/issues/[key]` — Issue detail with attempts timeline
  - `/agents/[name]` — Agent performance detail
- ✅ **API endpoints:** `/api/public/agents`, `/api/public/issues`, `/api/public/issues/[key]`
- ✅ Seed script (`scripts/seed.ts`) with realistic demo data
- ✅ All UI polish: empty states, loading skeletons, persistent filters
- ✅ Local development environment (`.env.local`)

**Current activity:** UI refinement with coding agent.

**Next step:** Deploy to Vercel and add Linear integration (M2).

---

## Database Schema (Production-Ready)

Already created in M1:

```sql
CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linear_id TEXT UNIQUE NOT NULL,
  linear_key TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  repo TEXT,
  status TEXT,
  arena_ready_labeled_at TIMESTAMPTZ,
  winner_attempt_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  repo TEXT NOT NULL,
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

CREATE VIEW agent_stats AS
SELECT
  agent_name,
  COUNT(*) AS attempts,
  COUNT(*) FILTER (WHERE status='merged') AS wins,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status='merged') / NULLIF(COUNT(*),0), 1) AS acceptance_pct
FROM attempts
GROUP BY agent_name;
```

---

## 🎯 MILESTONE 2: Linear Integration (Live Linking via Attachments)

**Goal:** Make the dashboard update from **Linear webhooks only**. When PRs are linked to Linear issues, Linear creates/updates **Attachments**; we parse those to create/update `attempts`.

**Duration:** ~1 day

**What you get:**
- ✅ Real-time dashboard updates from Linear events
- ✅ PR discovery via Linear attachments (no GitHub webhooks)
- ✅ Winner selection when issues move to Done
- ✅ Automatic linking via branch names or magic words
- ❌ Still manually adding `arena:ready` label (dispatch in M3)

### How It Works

#### 1. Linear Auto-Links PRs

Linear's GitHub integration auto-links PRs when:
- **Branch name** contains issue ID: `ENG-123--feature--agent-cursor`
- **PR title** contains issue ID: `ENG-123: Add search feature`
- **PR description** has magic word + ID: `Fixes ENG-123` or `Refs https://linear.app/workspace/issue/ENG-123`

([Linear GitHub Integration](https://linear.app/docs/github-integration))

#### 2. Linear Creates Attachments

When a PR is linked, Linear creates an **Attachment** on the issue with:
- `url`: `https://github.com/org/repo/pull/123`
- `title`: PR title
- `subtitle`: Repo name, PR state (e.g., "org/repo #123 • merged")
- `metadata`: Additional state info

([Linear Attachments API](https://linear.app/developers/attachments))

#### 3. Linear Sends Webhook Events

Linear webhooks fire for:
- **Issue** events: created, updated, labeled
- **Attachment** events: created, updated, deleted

Your app receives these events and processes them.

([Linear Webhooks](https://linear.app/developers/webhooks))

#### 4. You Parse & Store

- **Issue labeled `arena:ready`** → upsert `issues` table
- **Attachment created/updated** → parse URL → upsert `attempts` table
- **Issue moves to Done** → mark winner

### Schema Changes for M2

Add Linear attachment tracking:

```sql
ALTER TABLE attempts
  ADD COLUMN source_attachment_id TEXT,
  ADD COLUMN source_attachment_url TEXT;

CREATE UNIQUE INDEX attempts_issue_attachment_uq
ON attempts(issue_id, source_attachment_id)
WHERE source_attachment_id IS NOT NULL;
```

This lets us de-dupe when Linear sends multiple updates for the same PR.

### Environment Variables (New for M2)

Add to Vercel:

```bash
# Linear integration
LINEAR_WEBHOOK_SECRET=   # Generate with: openssl rand -hex 32
LINEAR_API_KEY=          # Personal API key (read-only for now)

# Switch to live mode
ARENA_MODE=live
```

**To create Linear API key:**
1. Linear Settings → API → Personal API keys
2. Create new key: "Arena Backend (read-only)"
3. Copy the key (starts with `lin_api_...`)

### Implementation Tasks

#### Task 1: Create Linear Webhook Route

**File:** `app/api/linear/webhook/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  // 1. Verify signature
  const signature = req.headers.get('linear-signature');
  const body = await req.text();

  if (!verifyLinearSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(body);

  // 2. Check idempotency
  const eventKey = `linear:${payload.type}:${payload.data.id}:${payload.updatedAt}`;
  const existing = await db.query(
    `INSERT INTO events (source, key, payload)
     VALUES ('linear', $1, $2)
     ON CONFLICT (source, key) DO NOTHING
     RETURNING id`,
    [eventKey, payload]
  );

  if (!existing.rows.length) {
    return NextResponse.json({ status: 'duplicate' });
  }

  // 3. Route by type
  if (payload.type === 'Issue') {
    await handleIssueEvent(payload);
  } else if (payload.type === 'Attachment') {
    await handleAttachmentEvent(payload);
  }

  return NextResponse.json({ success: true });
}

function verifyLinearSignature(payload: string, signature: string | null): boolean {
  if (!signature) return false;
  const hmac = crypto.createHmac('sha256', process.env.LINEAR_WEBHOOK_SECRET!);
  const digest = hmac.update(payload).digest('hex');
  return signature === digest;
}
```

#### Task 2: Handle Issue Events

```typescript
async function handleIssueEvent(payload: any) {
  const issue = payload.data;

  // Check for arena:ready label
  const hasArenaLabel = issue.labels?.some(
    (label: any) => label.name === process.env.ARENA_LABEL
  );

  if (!hasArenaLabel) return;

  // Upsert issue
  await db.query(
    `INSERT INTO issues (linear_id, linear_key, title, url, repo, status, arena_ready_labeled_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (linear_id)
     DO UPDATE SET
       status = EXCLUDED.status,
       arena_ready_labeled_at = COALESCE(issues.arena_ready_labeled_at, NOW())`,
    [issue.id, issue.identifier, issue.title, issue.url, issue.team?.key, issue.state?.name]
  );

  console.log(`Issue ${issue.identifier} labeled arena:ready`);
}
```

#### Task 3: Handle Attachment Events

```typescript
async function handleAttachmentEvent(payload: any) {
  const attachment = payload.data;

  // Only process GitHub PR attachments
  const prMatch = attachment.url?.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
  if (!prMatch) return;

  const [_, org, repoName, prNumber] = prMatch;
  const repo = `${org}/${repoName}`;

  // Get the issue this attachment belongs to
  const issueResult = await db.query(
    `SELECT id FROM issues WHERE linear_id = $1`,
    [attachment.issue.id]
  );

  if (!issueResult.rows.length) {
    console.warn(`Attachment for unknown issue: ${attachment.issue.id}`);
    return;
  }

  const issueId = issueResult.rows[0].id;

  // Parse status from subtitle (e.g., "org/repo #123 • merged")
  let status = 'open';
  let mergedAt = null;

  if (attachment.subtitle?.includes('merged')) {
    status = 'merged';
    mergedAt = new Date();
  } else if (attachment.subtitle?.includes('closed')) {
    status = 'closed';
  }

  // Guess agent from branch or title
  const agentName = guessAgent(attachment.title, attachment.metadata?.branch);

  // Upsert attempt
  await db.query(
    `INSERT INTO attempts (
      issue_id, agent_name, repo, pr_number, pr_url, branch,
      opened_at, merged_at, status, commit_count,
      source_attachment_id, source_attachment_url
    )
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, 1, $9, $10)
    ON CONFLICT (issue_id, source_attachment_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      merged_at = COALESCE(EXCLUDED.merged_at, attempts.merged_at)`,
    [issueId, agentName, repo, parseInt(prNumber), attachment.url,
     attachment.metadata?.branch, mergedAt, status, attachment.id, attachment.url]
  );

  // If merged, check for winner
  if (status === 'merged') {
    await updateWinner(issueId);
  }

  console.log(`Attempt created/updated: ${repo}#${prNumber} (${status})`);
}

function guessAgent(title: string, branch?: string): string {
  const source = (branch || title).toLowerCase();
  if (source.includes('cursor')) return 'cursor';
  if (source.includes('engine')) return 'engine';
  if (source.includes('cyrus')) return 'cyrus';
  return 'unknown';
}

async function updateWinner(issueId: string) {
  // Get first merged attempt
  const result = await db.query(
    `SELECT id FROM attempts
     WHERE issue_id = $1 AND status = 'merged'
     ORDER BY merged_at ASC NULLS LAST, opened_at ASC
     LIMIT 1`,
    [issueId]
  );

  if (result.rows.length) {
    const winnerId = result.rows[0].id;

    // Set winner
    await db.query(
      `UPDATE issues SET winner_attempt_id = $1 WHERE id = $2`,
      [winnerId, issueId]
    );

    // Close other attempts
    await db.query(
      `UPDATE attempts
       SET status = 'closed', closed_at = NOW()
       WHERE issue_id = $1 AND id != $2 AND status = 'open'`,
      [issueId, winnerId]
    );

    console.log(`Winner set for issue ${issueId}`);
  }
}
```

### Setup Checklist (M2)

**CRITICAL ORDER:**

#### Step 1: Add `pnpm add @linear/sdk`

```bash
pnpm add @linear/sdk
```

#### Step 2: Implement Webhook Route

Create `app/api/linear/webhook/route.ts` with code above.

#### Step 3: Deploy to Vercel

```bash
git add .
git commit -m "Add Linear webhook handler for M2"
git push
```

Vercel auto-deploys. Note your URL: `https://your-app.vercel.app`

#### Step 4: Add Environment Variables to Vercel

Go to Vercel → Project Settings → Environment Variables:

```bash
LINEAR_WEBHOOK_SECRET=<run: openssl rand -hex 32>
LINEAR_API_KEY=lin_api_<your-key>
ARENA_MODE=live
```

Redeploy after adding.

#### Step 5: Configure Linear Webhook

1. Go to Linear Settings → API → Webhooks
2. Click "Create new webhook"
3. **URL:** `https://your-app.vercel.app/api/linear/webhook`
4. **Secret:** Use the same `LINEAR_WEBHOOK_SECRET` from above
5. **Resources to watch:**
   - ✅ Issue
   - ✅ Attachment
6. Click "Create webhook"

Linear will send a test event. Check Recent Deliveries to confirm 200 response.

#### Step 6: Install & Configure Linear GitHub Integration

**This is critical—it's what creates the attachments.**

1. Go to [Linear GitHub Integration](https://linear.app/integrations/github)
2. Click "Add to Linear" → Authorize GitHub
3. Select your GitHub organization
4. Enable for repos in your `ALLOWED_REPOS`
5. **Enable workflow automations** (Settings → Teams → [Team] → Workflows):
   - PR opened → "In Progress"
   - PR approved + CI passing → "Ready to merge"
   - PR merged → "Done"

This makes Linear automatically update issue status based on PR state. ([Linear Workflow Updates](https://linear.app/changelog/2023-11-15-github-workflow-updates))

### Testing (M2)

#### Test 1: Issue Labeling

1. Create a Linear issue: `TEST-001: Test arena integration`
2. Add label `arena:ready`
3. **Expected:**
   - Webhook fires
   - `issues` table has new row with `linear_key='TEST-001'`
   - `arena_ready_labeled_at` is set

#### Test 2: PR Linking via Branch Name

1. Create a branch: `test-001--test-feature--agent-cursor`
2. Open a PR from that branch
3. **Expected:**
   - Linear auto-links PR (creates Attachment)
   - Attachment webhook fires
   - `attempts` table has new row with:
     - `pr_number` matches PR #
     - `agent_name='cursor'`
     - `status='open'`
     - `source_attachment_id` set

#### Test 3: PR Merge & Winner Selection

1. Merge the PR from Test 2
2. **Expected:**
   - Linear updates Attachment with "merged" status
   - Attachment webhook fires
   - `attempts` row updated: `status='merged'`, `merged_at` set
   - `issues` row updated: `winner_attempt_id` points to this attempt

#### Test 4: Multiple Competing PRs

1. On same issue, open 2 more PRs from different agents:
   - `test-001--alt-approach--agent-engine`
   - `test-001--another-way--agent-cyrus`
2. **Expected:** 3 attempts in DB, all `status='open'`
3. Merge the Engine PR
4. **Expected:**
   - Engine attempt → `status='merged'`
   - Engine is winner
   - Cursor and Cyrus attempts → `status='closed'`

### Acceptance Criteria (M2)

- ✅ Adding `arena:ready` label creates/updates `issues` row
- ✅ Opening PR with proper link creates `attempts` row via Attachment webhook
- ✅ Merging PR updates attempt status and selects winner
- ✅ Dashboard shows live data (no manual refresh needed)
- ✅ Multiple PRs per issue tracked; first merged wins
- ✅ No GitHub webhooks configured or used

---

## 🎯 MILESTONE 3: Agent Dispatch (Automation)

**Goal:** When issue is labeled `arena:ready`, automatically dispatch all configured agents via Linear comments with branch/PR templates.

**Duration:** ~1 day

**What you get:**
- ✅ Automatic agent dispatch on label
- ✅ Agents receive structured instructions
- ✅ Idempotent (won't dispatch twice)
- ✅ Full end-to-end automation

### Data Flow

1. Issue labeled `arena:ready` → Linear webhook
2. Backend creates `issue_agents` rows (one per agent)
3. Backend posts Linear comment **@mentioning each agent** with:
   - Suggested branch name
   - PR body template (with magic words)
4. Agents receive notification and start work
5. M2 logic handles the rest (PR linking → attempts → winner)

### Environment Variables (Update for M3)

**Upgrade LINEAR_API_KEY** to have **write access** (to post comments):

```bash
LINEAR_API_KEY=lin_api_<new-key-with-write-access>
AGENTS_CONFIG_JSON=[{"name":"cursor","mode":"linear_mention","handle":"@Cursor"},{"name":"engine","mode":"linear_mention","handle":"@Engine"},{"name":"cyrus","mode":"linear_mention","handle":"@Cyrus"}]
```

### Implementation Tasks

#### Task 1: Update Issue Event Handler

Extend `handleIssueEvent` from M2:

```typescript
async function handleIssueEvent(payload: any) {
  const issue = payload.data;

  // Check for arena:ready label
  const hasArenaLabel = issue.labels?.some(
    (label: any) => label.name === process.env.ARENA_LABEL
  );

  if (!hasArenaLabel) return;

  // Upsert issue
  const result = await db.query(
    `INSERT INTO issues (linear_id, linear_key, title, url, repo, status, arena_ready_labeled_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (linear_id)
     DO UPDATE SET
       status = EXCLUDED.status,
       arena_ready_labeled_at = COALESCE(issues.arena_ready_labeled_at, NOW())
     RETURNING id, arena_ready_labeled_at`,
    [issue.id, issue.identifier, issue.title, issue.url, issue.team?.key, issue.state?.name]
  );

  const issueId = result.rows[0].id;
  const isFirstTime = payload.action === 'create' ||
                       !result.rows[0].arena_ready_labeled_at;

  // Dispatch agents if first time
  if (isFirstTime) {
    await dispatchAgents(issue, issueId);
  }
}
```

#### Task 2: Implement Agent Dispatch

```typescript
import { LinearClient } from '@linear/sdk';

async function dispatchAgents(issue: any, issueId: string) {
  const agents = JSON.parse(process.env.AGENTS_CONFIG_JSON!);
  const linear = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

  // Generate branch slug
  const slug = issue.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .substring(0, 30)
    .replace(/^-|-$/g, '');

  for (const agent of agents) {
    // Create issue_agents row
    await db.query(
      `INSERT INTO issue_agents (issue_id, agent_name, status)
       VALUES ($1, $2, 'queued')
       ON CONFLICT (issue_id, agent_name) DO NOTHING`,
      [issueId, agent.name]
    );

    // Generate templates
    const branchName = `${issue.identifier.toLowerCase()}--${slug}--agent-${agent.name}`;
    const commentBody = `
${agent.handle} Arena dispatch: Please start work on this issue.

**Use this branch name:**
\`\`\`
${branchName}
\`\`\`

**Include in PR body** (for auto-linking):
\`\`\`
Refs ${issue.url}
\`\`\`

> If you want the issue to auto-complete on merge, use \`Fixes ${issue.url}\` instead.
`.trim();

    // Post comment
    try {
      await linear.createComment({
        issueId: issue.id,
        body: commentBody
      });

      // Mark triggered
      await db.query(
        `UPDATE issue_agents
         SET status = 'triggered', triggered_at = NOW()
         WHERE issue_id = $1 AND agent_name = $2`,
        [issueId, agent.name]
      );

      console.log(`Dispatched ${agent.name} for ${issue.identifier}`);
    } catch (error) {
      console.error(`Failed to dispatch ${agent.name}:`, error);
      await db.query(
        `UPDATE issue_agents SET status = 'failed' WHERE issue_id = $1 AND agent_name = $2`,
        [issueId, agent.name]
      );
    }
  }
}
```

### Magic Words Policy Decision

Choose one:

**Option A: `Refs` (Recommended)**
- Links PR to issue **without** auto-closing
- Issue moves to Done via Linear's workflow automations when PR merges
- More flexible (can manually adjust status)

**Option B: `Fixes` / `Closes` / `Resolves`**
- Links PR **and** auto-closes issue on merge
- Simpler but less flexible

**Recommendation:** Use `Refs` + Linear workflow automations for better control.

### Setup Checklist (M3)

#### Step 1: Update Linear API Key

Create a **new** Linear API key with write access:
1. Linear Settings → API → Create new Personal API key
2. Name: "Arena Backend (read + write)"
3. Copy and update in Vercel:

```bash
LINEAR_API_KEY=lin_api_<new-key>
AGENTS_CONFIG_JSON=[{"name":"cursor","mode":"linear_mention","handle":"@Cursor"},{"name":"engine","mode":"linear_mention","handle":"@Engine"},{"name":"cyrus","mode":"linear_mention","handle":"@Cyrus"}]
```

#### Step 2: Update Webhook Handler

Add dispatch logic to `app/api/linear/webhook/route.ts`.

#### Step 3: Deploy

```bash
git add .
git commit -m "Add agent dispatch for M3"
git push
```

#### Step 4: Verify Agent Handles

Test each agent responds to @mentions:
1. Create a test Linear issue
2. Post a comment: `@Cursor test`
3. Verify Cursor responds
4. Repeat for Engine and Cyrus

Update `AGENTS_CONFIG_JSON` if handles are different (case-sensitive).

### Testing (M3)

#### Test 1: Single Agent Dispatch

1. Create issue `TEST-002`
2. Add label `arena:ready`
3. **Expected:**
   - 3 `issue_agents` rows created
   - 3 Linear comments posted (one per agent)
   - Each comment has branch template and PR body template
   - All marked `status='triggered'`

#### Test 2: Idempotency

1. Remove `arena:ready` label from TEST-002
2. Re-add `arena:ready` label
3. **Expected:**
   - No new comments (already triggered)
   - `issue_agents` rows unchanged

#### Test 3: End-to-End

1. Create issue `TEST-003`
2. Add label `arena:ready`
3. Wait for agents to open PRs (or manually create PRs following templates)
4. Merge one PR
5. **Expected:**
   - All 3 agents dispatched
   - All PRs linked via branch names
   - Winner selected correctly
   - Dashboard shows full timeline

### Acceptance Criteria (M3)

- ✅ Labeling issue triggers exactly one dispatch per agent
- ✅ Agents receive proper branch and PR templates
- ✅ Re-labeling doesn't cause duplicate dispatches
- ✅ Failed dispatches marked in `issue_agents`
- ✅ Full automation: label → dispatch → PR → merge → winner

---

## 🎯 MILESTONE 4: GitHub Enrichment (Polling for Precision)

**Goal:** Add high-fidelity metrics that Linear attachments don't guarantee: **authoritative commit counts**, **exact merged_at timestamps**, and **optional CI status** by polling GitHub REST API.

**Duration:** ~1 day

**What you get:**
- ✅ Accurate commit counts (from GitHub, not guessed)
- ✅ Exact merge/close timestamps
- ✅ Optional CI pass/fail status
- ✅ Still no GitHub webhooks (just polling)
- ✅ Low API usage (only recent/open PRs)

### Why Polling Works

Linear attachments give us:
- ✅ PR URL and number
- ✅ Basic status (merged/closed from subtitle)
- ⚠️ **Not guaranteed:** exact commit count, precise timestamps

**Solution:** Poll GitHub REST API for PRs we already know about (discovered via Linear).

**Budget:** If you have 10 open PRs, that's ~10 API calls per poll. GitHub rate limit: 5,000/hour. Polling every 15 minutes = 40 calls/hour. **Plenty of headroom.**

### Schema Changes for M4

Track GitHub enrichment separately:

```sql
ALTER TABLE attempts
  ADD COLUMN gh_state TEXT,            -- 'open' | 'closed' (from GitHub)
  ADD COLUMN gh_merged BOOLEAN,        -- true if PR was merged
  ADD COLUMN gh_merged_at TIMESTAMPTZ, -- Exact merge timestamp
  ADD COLUMN gh_closed_at TIMESTAMPTZ, -- Exact close timestamp
  ADD COLUMN gh_updated_at TIMESTAMPTZ; -- Last time we polled GitHub

CREATE INDEX attempts_needs_enrichment_idx
ON attempts(gh_updated_at)
WHERE status = 'open' OR (gh_updated_at IS NOT NULL AND gh_updated_at < now() - interval '1 hour');
```

### Environment Variables (New for M4)

```bash
# GitHub API access (read-only)
GITHUB_TOKEN=<fine-grained-PAT-read-only>

# Polling configuration
POLL_INTERVAL_MINUTES=15
```

**To create GitHub token:**
1. GitHub Settings → Developer settings → Personal access tokens → Fine-grained
2. Repository access: Select repos in `ALLOWED_REPOS`
3. Permissions: `Pull requests` = **Read only** (no write needed)
4. Generate and copy

### Implementation Tasks

#### Task 1: Create Enrichment Cron Job

**File:** `app/api/cron/enrich/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sets this header)
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  // Get attempts that need enrichment
  const attempts = await db.query(
    `SELECT id, repo, pr_number, status
     FROM attempts
     WHERE status IN ('open', 'merged')
       AND (gh_updated_at IS NULL OR gh_updated_at < now() - interval '1 hour')
     ORDER BY opened_at DESC
     LIMIT 50`
  );

  let enriched = 0;
  let errors = 0;

  for (const attempt of attempts.rows) {
    try {
      await enrichAttempt(octokit, attempt);
      enriched++;
    } catch (error) {
      console.error(`Failed to enrich ${attempt.repo}#${attempt.pr_number}:`, error);
      errors++;
    }
  }

  return NextResponse.json({ enriched, errors });
}

async function enrichAttempt(octokit: Octokit, attempt: any) {
  const [owner, repo] = attempt.repo.split('/');

  // Fetch PR details
  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: attempt.pr_number
  });

  // Fetch commits
  const { data: commits } = await octokit.rest.pulls.listCommits({
    owner,
    repo,
    pull_number: attempt.pr_number
  });

  // Update attempt
  await db.query(
    `UPDATE attempts
     SET
       gh_state = $1,
       gh_merged = $2,
       gh_merged_at = $3,
       gh_closed_at = $4,
       commit_count = $5,
       last_commit_sha = $6,
       gh_updated_at = NOW()
     WHERE id = $7`,
    [
      pr.state,
      pr.merged,
      pr.merged_at,
      pr.closed_at,
      commits.length,
      commits[commits.length - 1]?.sha,
      attempt.id
    ]
  );

  // If merged but not yet marked, update status and check winner
  if (pr.merged && attempt.status !== 'merged') {
    await db.query(
      `UPDATE attempts SET status = 'merged', merged_at = $1 WHERE id = $2`,
      [pr.merged_at, attempt.id]
    );

    // Check if this should be the winner
    const issue = await db.query(
      `SELECT issue_id FROM attempts WHERE id = $1`,
      [attempt.id]
    );
    await updateWinner(issue.rows[0].issue_id);
  }

  console.log(`Enriched ${attempt.repo}#${attempt.pr_number}: ${commits.length} commits`);
}
```

#### Task 2: Configure Vercel Cron

**File:** `vercel.json` (in project root)

```json
{
  "crons": [
    {
      "path": "/api/cron/enrich",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

This runs every 15 minutes.

#### Task 3: Add Cron Secret

Generate a secret for the cron job:

```bash
openssl rand -hex 32
```

Add to Vercel:

```bash
CRON_SECRET=<generated-secret>
```

### Setup Checklist (M4)

#### Step 1: Install Octokit

```bash
pnpm add @octokit/rest
```

#### Step 2: Create Enrichment Route

Create `app/api/cron/enrich/route.ts` with code above.

#### Step 3: Add vercel.json

Create `vercel.json` in project root with cron configuration.

#### Step 4: Deploy

```bash
git add .
git commit -m "Add GitHub enrichment polling for M4"
git push
```

#### Step 5: Add Environment Variables to Vercel

```bash
GITHUB_TOKEN=<fine-grained-PAT-read-only>
CRON_SECRET=<random-hex-string>
POLL_INTERVAL_MINUTES=15
```

Redeploy.

#### Step 6: Verify Cron Job

1. Go to Vercel → Project → Deployments → Functions
2. Find `/api/cron/enrich`
3. Wait 15 minutes for first run
4. Check logs: should see "Enriched X attempts"

### Testing (M4)

#### Test 1: Manual Enrichment

1. Create an attempt (via M2/M3 flow)
2. Manually trigger cron: `curl -H "Authorization: Bearer <CRON_SECRET>" https://your-app.vercel.app/api/cron/enrich`
3. **Expected:**
   - `attempts` row updated with:
     - `commit_count` = actual count from GitHub
     - `gh_merged_at` = exact timestamp
     - `gh_updated_at` = now

#### Test 2: Commit Count Accuracy

1. Open PR with 1 commit
2. Wait for enrichment
3. Push 2 more commits (total 3)
4. Wait 15 minutes
5. **Expected:** `commit_count = 3`

#### Test 3: Merge Detection

1. Open PR (not merged)
2. Wait for enrichment → `gh_merged = false`
3. Merge PR on GitHub
4. Wait 15 minutes
5. **Expected:**
   - `gh_merged = true`
   - `gh_merged_at` set
   - `status = 'merged'`
   - Winner updated

### Acceptance Criteria (M4)

- ✅ Commit counts are authoritative from GitHub
- ✅ Merge/close timestamps are exact
- ✅ Polling runs every 15 minutes automatically
- ✅ Low API usage (only polls recent/open PRs)
- ✅ Winner selection works even if Linear missed merge signal
- ✅ Still no GitHub webhooks

---

## 🎯 MILESTONE 5 (Optional): CI Metrics & Quality Scoring

**Goal:** Enrich attempts with CI/quality data: test pass/fail, coverage deltas, performance metrics, linting.

**Duration:** ~1 day

**What you get:**
- ✅ CI pass/fail status on attempts
- ✅ Optional quality metrics (coverage, perf, size)
- ✅ Weighted leaderboard (acceptance % + quality)

### Schema (Already Created in M1)

The `ci_metrics` table is ready:

```sql
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
```

Add time-to-green:

```sql
ALTER TABLE ci_metrics
  ADD COLUMN time_to_green_seconds INTEGER,
  ADD COLUMN ci_status TEXT; -- 'passed' | 'failed' | 'pending'
```

### Implementation Strategy

#### Option A: GitHub Checks API

Read CI status from GitHub's Checks API during enrichment:

```typescript
// In enrichAttempt function
const { data: checks } = await octokit.rest.checks.listForRef({
  owner,
  repo,
  ref: pr.head.sha
});

const conclusion = checks.check_runs[0]?.conclusion; // 'success' | 'failure' | null
```

#### Option B: Workflow Artifacts

If your CI uploads a scorecard artifact:

1. CI workflow generates `arena-scorecard.json`:

```json
{
  "tests_passed": 842,
  "tests_failed": 0,
  "coverage_delta": 2.7,
  "perf_delta_ms": -6.5,
  "lint_errors": 0,
  "size_delta_bytes": 812
}
```

2. Enrichment job downloads artifact and populates `ci_metrics`.

### Acceptance Criteria (M5)

- ✅ Attempts show CI pass/fail badge
- ✅ Quality metrics available when artifact present
- ✅ Leaderboard can optionally weight by quality

---

## 🎯 MILESTONE 6 (Optional): Reputation & Trends

**Goal:** Track agent reputation over time with materialized views and trend analysis.

**Duration:** ~1 day

**What you get:**
- ✅ Agent reputation scores
- ✅ Time-series trends (acceptance % over time)
- ✅ Advanced leaderboard with reputation decay

### Implementation

Create materialized view:

```sql
CREATE MATERIALIZED VIEW agent_reputation AS
SELECT
  agent_name,
  COUNT(*) AS total_attempts,
  COUNT(*) FILTER (WHERE status='merged') AS wins,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status='merged') / NULLIF(COUNT(*),0), 1) AS acceptance_pct,
  AVG(EXTRACT(EPOCH FROM (opened_at - i.arena_ready_labeled_at))) AS avg_time_to_pr_seconds,
  AVG(EXTRACT(EPOCH FROM (merged_at - opened_at))) FILTER (WHERE merged_at IS NOT NULL) AS avg_time_to_merge_seconds,

  -- Last 30 days
  COUNT(*) FILTER (WHERE opened_at > now() - interval '30 days') AS recent_attempts,
  COUNT(*) FILTER (WHERE status='merged' AND opened_at > now() - interval '30 days') AS recent_wins,

  -- Trend
  ROUND(100.0 * COUNT(*) FILTER (WHERE status='merged' AND opened_at > now() - interval '30 days')
        / NULLIF(COUNT(*) FILTER (WHERE opened_at > now() - interval '30 days'), 0), 1) AS recent_acceptance_pct
FROM attempts a
JOIN issues i ON i.id = a.issue_id
GROUP BY agent_name;

-- Refresh nightly
CREATE OR REPLACE FUNCTION refresh_reputation()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW agent_reputation;
END;
$$ LANGUAGE plpgsql;
```

Add cron job to refresh nightly:

```typescript
// app/api/cron/refresh-reputation/route.ts
export async function GET(req: NextRequest) {
  await db.query(`SELECT refresh_reputation()`);
  return NextResponse.json({ success: true });
}
```

Add to `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/enrich", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/refresh-reputation", "schedule": "0 2 * * *" }
  ]
}
```

---

## 📊 OPTIONAL TRACK B: Add GitHub Webhooks (If Needed)

**When to use:** If you want instant updates instead of 15-minute polling, or if you want to reduce GitHub API calls.

**What changes:**
- Add GitHub webhook endpoint (similar to original M2 plan)
- Keep Linear webhooks (they're still primary for linking)
- GitHub webhooks provide instant commit/merge updates

**Implementation:** See `project-2.md` Milestone 2 for GitHub webhook details.

**Note:** This is **optional**. The Linear-first approach (M2-M4 above) works great without it.

---

## Summary: Your Revised Path to Production

| Milestone | Features | Duration | Status |
|-----------|----------|----------|--------|
| **M1: UI-First** | Dashboard with demo data | 1–2 days | ✅ **COMPLETE** |
| **M2: Linear Integration** | Live linking via attachments | 1 day | ⏳ Ready to start |
| **M3: Agent Dispatch** | Auto-dispatch on label | 1 day | ⏳ After M2 |
| **M4: GitHub Enrichment** | Polling for precision metrics | 1 day | ⏳ After M3 |
| **M5: CI Metrics** | Quality scoring (optional) | 1 day | ⏳ Optional |
| **M6: Reputation** | Trends & advanced stats (optional) | 1 day | ⏳ Optional |

**Total:** ~3-4 days for M2-M4 (full production system without GitHub webhooks).

---

## Key Decisions Before M2

1. **Magic words policy:**
   - ✅ Recommended: `Refs` (non-closing) + Linear workflow automations
   - Alternative: `Fixes` (auto-closing on merge)

2. **Agent handles:**
   - Verify exact @mention handles in Linear (case-sensitive)
   - Current: `@Cursor`, `@Engine`, `@Cyrus`

3. **Repos:**
   - List all repos for `ALLOWED_REPOS` env var

4. **Branch naming:**
   - Enforce: `<KEY>--<slug>--agent-<name>`
   - Documented in agent dispatch templates

---

## All Critical References

- [Linear GitHub Integration](https://linear.app/integrations/github) — Auto-linking & workflow automations
- [Linear Attachments API](https://linear.app/developers/attachments) — How PR links appear
- [Linear Webhooks](https://linear.app/developers/webhooks) — Event types & payload structure
- [Linear Workflow Automations](https://linear.app/changelog/2023-11-15-github-workflow-updates) — PR state → issue state
- [GitHub REST API: Pull Requests](https://docs.github.com/en/rest/pulls/pulls) — For enrichment polling

---

## Ready to Start M2?

You have everything you need:
- ✅ M1 complete and UI refined
- ✅ Database schema ready
- ✅ `.env.local` configured
- ✅ Neon connection working
- ✅ Clear implementation tasks above

Next step: Deploy to Vercel (if not already), add Linear webhook, and watch your dashboard come alive with real data!

