# Configuration and deployment

Copy `.env.example` to `.env.local` for local work. Supply environment values
explicitly to scripts; Next.js automatically reads `.env.local`, while Drizzle
and standalone scripts do not. Never commit populated environment files.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection; required for data pages, APIs and migrations |
| `OPERATOR_USERNAME`, `OPERATOR_PASSWORD` | Required together for admin pages and operator APIs; unique shared account |
| `CRON_SECRET` | Optional dedicated bearer token for `GET /api/linear/reconcile`; configure for Vercel Cron |
| `LINEAR_API_KEY` | Workspace discovery, reconciliation and agent dispatch; can write comments |
| `LINEAR_WEBHOOK_SECRET` | HMAC verification for `/api/linear/webhook` |
| `GITHUB_WEBHOOK_SECRET` | HMAC verification for `/api/github/webhook` |
| `GITHUB_APP_ID` | GitHub App identifier |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App private PEM key, with escaped newline support |
| `GITHUB_APP_PRIVATE_KEY_BASE64` | Alternative base64 representation of the PEM key |
| `NEXT_PUBLIC_GITHUB_APP_NAME` | Slug of your own App for the setup link; missing configuration disables the link |
| `NEXT_PUBLIC_GITHUB_APP_ID` | Optional public App identifier for setup UI; never a secret |
| `GITHUB_TOKEN` | Optional legacy GitHub API token when an installation token is unavailable |
| `ARENA_LABEL`, `ARENA_LABEL_ID` | Linear issue label name and optional exact identifier |
| `AGENTS_CONFIG_JSON` | Optional agent mention configuration; inspect the documented example in `.env.example` |

Register the webhook URLs on your own Linear workspace and GitHub App. Use
separate random secrets and only the provider permissions needed for issue
reads, agent comments, PR metadata reads, and any enabled PR body updates.
Install the GitHub App only on repositories you intend to expose. Its callback
at `/api/github/app/callback` requires operator authentication before recording
an installation. Browser redirects from GitHub show a confirmation link; follow
it only after your own installation or update. It is an operator installation flow, not user OAuth login.

Vercel runs `pnpm vercel-build`, which applies database migrations before the
Next.js build. A deployment therefore needs a database credential with schema
write permissions; use distinct runtime and migration credentials in a custom
pipeline if tighter separation is needed. The included hourly cron calls the
reconciliation route, which writes discovery and issue state and may trigger
normal application behavior. Configure `CRON_SECRET` in Vercel; no anonymous
reconciliation is permitted. Vercel Cron schedule availability depends on your
hosting plan.

For another host, run migrations deliberately, `pnpm build`, then `pnpm start`.
Terminate TLS at the host and keep the database off the public application
network where possible. The application is not a sandbox for untrusted agents
and does not provision agent execution. Check webhook delivery, logs, dataset
disclosure, and reconciliation behavior on a disposable workspace before
connecting a real project.
