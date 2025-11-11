## STEP 1 — Your one‑time prep (human)

### 1) Linear

- [ ] Create **label** `arena:ready`.
- [ ] Ensure the **GitHub ↔ Linear integration** is installed and enabled for the repos you’ll use. Linear will **auto‑link PRs** to issues when the **branch name** or **PR title** contains the issue ID, or when the **PR description** includes a **magic word** + issue ID/URL. ([Linear][1])
- [ ] In each team’s **Workflow settings**, enable **status automations** so issues move with PR state (e.g., _In Progress_ on PR open, _Ready to merge_ when checks/approvals pass, _Done_ on merge). ([Linear][2])
- [ ] Confirm your three agents (Cursor, Engine, Cyrus) are installed in Linear and respond to **@mentions** (or document any HTTP trigger they need).

### 2) GitHub

- [ ] Add an **org‑ or repo‑level webhook** pointing to your Vercel URL:
  - Events: `pull_request` (opened, synchronize, closed[, edited]); `pull_request_review` (optional).
  - Set a **webhook secret**; you’ll verify `X‑Hub‑Signature‑256`. ([GitHub Docs][3])

- [ ] Decide your **branch naming convention** (recommended: `<KEY>--<slug>--agent-<name>`), because **branch‑based linking is automatic** in Linear. ([Linear][4])

### 3) Vercel + Neon

- [ ] Create a **Neon Postgres** database; copy the connection string.
- [ ] Create a **Vercel** project for the Next.js backend.
- [ ] Add these **environment variables** in Vercel:

  ```
  ARENA_LABEL=arena:ready
  ARENA_LABEL_ID=<optional Linear label id>
  LINEAR_WEBHOOK_SECRET=<random string>
  LINEAR_API_KEY=<Linear personal API key or OAuth token>
  GITHUB_WEBHOOK_SECRET=<random string>
  GITHUB_TOKEN=<fine-grained PAT with read/write on PRs>
  DATABASE_URL=postgres://... (Neon, sslmode=require)
  AGENTS_CONFIG_JSON=[{"name":"cursor","mode":"linear_mention","handle":"@Cursor"},
                      {"name":"engine","mode":"linear_mention","handle":"@Engine"},
                      {"name":"cyrus","mode":"linear_mention","handle":"@Cyrus"}]
  ALLOWED_REPOS=org/repo-a,org/repo-b
  ```

  _Why GITHUB_TOKEN?_ Your backend will **patch PR descriptions** when needed (see Step 3B).

- [ ] (Optional) Add a nightly **Vercel Cron** to call `/api/cron/reconcile`.

---

## STEP 2 — Data model (Neon; simple & agent‑friendly)

**Tables**

- `issues(id, linear_id, linear_key, title, url, repo, arena_ready_labeled_at, winner_attempt_id, created_at)`
- `issue_agents(id, issue_id, agent_name, status, external_job_id, triggered_at)`
  _(status: queued|triggered|failed|skipped)_
- `attempts(id, issue_id, agent_name, repo, pr_number, pr_url, branch, opened_at, merged_at, closed_at, status, commit_count, last_commit_sha)`
  _(status: open|merged|closed)_
- `events(id, source, key, payload, created_at)` for idempotency.

**Views**

- `agent_stats` for acceptance % (wins / attempts) and counts.
- Query joins for **time‑to‑PR** (issue labeled → first PR opened) and **time‑to‑merge**.

---

## STEP 3 — Webhooks & automations

### 3A) Linear → `/api/linear/webhook`

**Purpose:** when an issue gets **`arena:ready`**, dispatch **all agents**.

- Verify signature with `LINEAR_WEBHOOK_SECRET`.
- On **issue created/updated** or **label added**:
  - If `arena:ready` present (match ID if provided), upsert `issues`, insert `issue_agents` rows.
  - **Trigger agents**:
    - **Mentions**: post a Linear comment to the issue for each agent, including a **branch template** and **PR body template** (below).
    - **HTTP**: call the agent’s endpoint (if any).

  - Mark `issue_agents.status='triggered'`.

**Dispatch comment template** (agents see exactly what to do):

```
Arena trigger: Please start work on this issue.

Use branch:
  {KEY}--{slug}--agent-{name}

Include in PR body (non-closing link):
  Refs https://linear.app/<workspace>/issue/{KEY}

(Alternatively, if you want the issue to auto-complete on merge, use:)
  Fixes https://linear.app/<workspace>/issue/{KEY}
```

> Linear will link the PR to the Linear issue if the **branch name** or **PR title** contains `{KEY}`, and it will also link if the PR **description** includes a **magic word** plus the key/URL. ([Linear][4])

### 3B) GitHub → `/api/github/webhook`

**Purpose:** record PR attempts and **guarantee linking** even if agents forget.

- Verify `X‑Hub‑Signature‑256` with `GITHUB_WEBHOOK_SECRET`. ([GitHub Docs][3])

**Events**

- `pull_request.opened`
  - Find Linear issue by parsing **PR title/body** for a Linear key/URL; if found, create an `attempts` row.
  - If not found, parse **branch name** (preferred). If it contains a key, create the attempt and **PATCH the PR body** to append:
    - **Safe default**: `Refs https://linear.app/.../{KEY}` (non‑closing)
      _(links without auto‑closing; you’ll let Linear’s PR‑state automations move the issue)_. ([Linear][4])

  - If still unknown (rare: branch lacks key, no body/title link), store the attempt **unlinked** and raise a log/label for manual fix.

- `pull_request.synchronize`
  - Update `commit_count` using **“List commits on a pull request”** (authoritative). ([GitHub Docs][5])
  - Update `last_commit_sha`.

- `pull_request.closed`
  - If `merged=true`: mark attempt `merged`, set `issues.winner_attempt_id` to that attempt; mark other attempts on same issue `closed`.
  - Else: mark attempt `closed`.

> Once PRs are linked, Linear’s **workflow automations** will move the issue as PR state changes (including the **“Ready to merge”** step). Magic words are **not required** if you rely on PR‑state automations, but they’re another path to link/close. ([Linear][1])

---

## STEP 4 — Frontend (Next.js on Vercel)

- `/` — **Leaderboard** by agent: attempts, wins, **acceptance %**, avg **time‑to‑PR**, **time‑to‑merge**.
- `/issues` — recent issues: key/title, winner PR, per‑agent attempts (with `commit_count`).
- `/agents/:name` — simple trendlines (table or minimal chart later).

Provide matching **JSON endpoints** under `/api/public/*` for scripting.

---

## STEP 5 — Security, idempotency, routing

- Verify all webhooks (Linear + GitHub) with HMAC. ([GitHub Docs][3])
- Use `events(source, key)` to drop duplicates.
- Respect `ALLOWED_REPOS` to avoid noisy repos.
- Keep the backend **read/write only to PR metadata** (no deploy secrets in PR CI).

---

## STEP 6 — Test plan (end‑to‑end)

1. **Linking behavior (no code):**
   - Create a branch `ENG-123--test--agent-cursor`; open a PR. Confirm Linear auto‑links due to **branch name**. ([Linear][4])

2. **Linear trigger → agents:**
   - Create Linear issue `ENG-124`; add `arena:ready`. Confirm the backend posts **agent mentions** with branch + PR templates.

3. **PR open (backend fallback):**
   - Open a PR from a branch with the key but with **empty body** → confirm the backend **appends** `Refs <issue URL>`.

4. **Attempts metric:**
   - Push two additional commits → confirm `commit_count` is 3 via the **List commits on a PR** endpoint. ([GitHub Docs][5])

5. **Winner selection:**
   - Merge one agent’s PR; confirm:
     - Attempt marked `merged` and issue shows **winner**.
     - Other attempts for the same issue marked `closed`.
     - Linear moves issue to **Done** via automation. ([Linear][1])

6. **Negative case:**
   - Open a PR without key in branch/title/body → backend flags unlinked; manually edit PR title to include `{KEY}`; confirm link appears.

---

## STEP 7 — Acceptance criteria (v1)

- Adding **`arena:ready`** to a Linear issue **triggers Cursor, Engine, Cyrus** once (idempotent).
- Each PR from agents creates an **attempt**, and **commit pushes** increase `commit_count`.
- **PR↔Linear linking** is automatic (branch/title or auto‑patched PR body). ([Linear][4])
- When engineers merge a PR, the system records the **winner** and Linear **moves the issue** according to PR state automations. ([Linear][1])
- Dashboard shows **acceptance %**, **time‑to‑PR**, **time‑to‑merge** per agent.

---

## STEP 8 — Notes & options

- **Closing vs non‑closing phrases:** “Fixes/Closes/Resolves” will mark the Linear issue **Done on merge**; “Refs/Related to” links without closing. Pick one policy. ([Linear][4])
- **Forked PRs:** If an agent opens PRs from forks and disallows “edits from maintainers,” the backend may not be able to patch the PR body; flag these for manual edit.
- **Optional GitHub Action:** You can also enforce linking with a tiny Action that patches the PR body on `pull_request`—but doing it in the webhook keeps everything in one place.

---

### What the coding agent will implement (at a glance)

- Neon schema & migrations for the tables above.
- Next.js API routes:
  - `/api/linear/webhook` (dispatch + comments with branch/PR templates),
  - `/api/github/webhook` (attempt tracking + PR body autopatch),
  - `/api/cron/reconcile` (nightly hygiene; optional),
  - `/api/public/*` (stats JSON).

- Minimal pages for **leaderboard**, **issues**, and **agent detail**.

This plan removes manual linking and leans on **Linear’s native GitHub integration** plus a **small safety fallback** so your engineers can just review and merge. ([Linear][1])

If you want, I can also drop in a ready‑to‑paste **dispatch comment template** and a **GitHub PR autopatch snippet** for your backend.

[1]: https://linear.app/integrations/github?utm_source=chatgpt.com 'GitHub Integration'
[2]: https://linear.app/changelog/2023-11-15-github-workflow-updates?utm_source=chatgpt.com 'New Git automation: Ready for merge – Changelog'
[3]: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries?utm_source=chatgpt.com 'Validating webhook deliveries'
[4]: https://linear.app/docs/github-integration?utm_source=chatgpt.com 'GitHub – Linear Docs'
[5]: https://docs.github.com/en/rest/pulls/pulls?utm_source=chatgpt.com 'REST API endpoints for pull requests'
