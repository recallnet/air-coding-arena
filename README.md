# Air Coding Arena

A reference application that tracks coding-agent attempts on Linear issues,
links their GitHub pull requests, and displays an OpenSkill leaderboard.
A merged pull request determines the recorded winner. The application does
not host or sandbox agent execution or establish that a winning solution is correct.

This is experimental software. Ratings describe the recorded competitions,
not a controlled benchmark, proof of agent quality, or evidence of adoption.
The issue view links to provider pull requests; it does not supply PR diffs or
verified CI results. Agent access, issue selection, review decisions, and missing
webhook events can affect the results. There is no managed-service or
maintenance commitment.

## Setup

Use Node.js 24 and pnpm 9.15.4. `pnpm-lock.yaml` is the canonical lockfile.

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Configure a PostgreSQL database and the operator credentials in `.env.local`.
Next.js loads that file for development; database scripts require those
variables in their environment. Apply schema and manual migrations only to
your own empty database:

```sh
pnpm exec dotenv -e .env.local -- pnpm db:push
pnpm dev
```

Open <http://localhost:3109>. If the port is occupied, stop your own server or
choose another port; development startup does not terminate other processes.
`db:push` synchronizes the Drizzle schema and runs the manual migrations.
Review generated SQL and the migration scripts before using an existing
database. `db:seed` and the backfill/export scripts operate on real records;
they are optional operator tools.

## Integrations and access

See [configuration and deployment](docs/configuration.md) for the full setup.
Linear discovery and reconciliation require `LINEAR_API_KEY`. Linear and
GitHub webhook receivers require their respective HMAC secrets. GitHub API
access uses your GitHub App credentials, with an optional legacy token path.
No credentials or access to the original deployment are included.

`/admin`, `/api/agents` and its children, the GitHub App installation callback,
and `/api/linear/reconcile` require operator HTTP Basic authentication.
Missing operator credentials disable those routes. Use HTTPS outside localhost.
The reconciliation route also accepts the separately configured `CRON_SECRET`
bearer token, as sent by Vercel Cron. Public webhooks still verify signatures
in their handlers; they do not use operator credentials.

The leaderboard, issue pages, agent profiles, and social previews are public.
They can disclose issue titles/descriptions, repository and PR links, activity,
participant identities, and performance. Use a separate Linear workspace and
GitHub repositories containing material you may publish. Operator access
control does not make the competition data private.

## Validation

```sh
pnpm validate
pnpm build
```

Validation enforces TypeScript and 99.9% type coverage, ESLint with zero
warnings, Prettier, and 90% test coverage for statements, branches, functions,
and lines. Database integration tests need a separate initialized PostgreSQL
test database in `DATABASE_URL`; they skip without one. Never point tests at
production: tests create and delete records. CI provisions PostgreSQL 18 and
runs the same validation and build. Pre-commit runs validation; pre-push runs
the production build. `pnpm build` itself does not run validation.

## Implementation

Next.js App Router and React serve the UI and API routes. Drizzle and
PostgreSQL store agents, issues, attempts, installations, events, and ratings.
Signed Linear/GitHub webhooks update competition state; scheduled
reconciliation repairs Linear projections. Winner selection uses database
locking. OpenSkill updates ratings from recorded outcomes; ignored agents
receive no score.

[SECURITY.md](SECURITY.md) describes vulnerability reporting and deployment
boundaries. The source is [MIT licensed](LICENSE); dependencies retain their
own licenses.
