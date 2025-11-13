# Vercel Deployment Guide

## Overview

This project is configured for automatic database setup on first deploy to Vercel. The `vercel-build` command will:

1. Run Drizzle migrations to create all tables
2. Run manual SQL migrations for views and additional tables
3. Build the Next.js application

## Pre-Deployment Checklist

### 1. Database Setup

Create a production Postgres database (recommended: [Neon](https://neon.tech) or [Supabase](https://supabase.com))

**Why Neon?**
- Serverless Postgres optimized for Vercel
- Automatic connection pooling
- Free tier suitable for production
- Branch databases for preview deployments

### 2. Environment Variables

Set these in Vercel Project Settings → Environment Variables:

#### Required for App

- `DATABASE_URL` - Postgres connection string (with connection pooling)
  - Example: `postgres://user:pass@host/db?sslmode=require`
  - For Neon: Use the "Pooled connection" string

- `LINEAR_API_KEY` - Linear API key for issue sync
  - Get from: Linear Settings → API → Personal API Keys

- `LINEAR_WEBHOOK_SECRET` - Secret for verifying Linear webhooks
  - Get from: Linear Settings → Webhooks → Create webhook → Copy signing secret

- `GITHUB_WEBHOOK_SECRET` - Secret for verifying GitHub webhooks
  - Set when creating GitHub webhook in repository settings

- `GITHUB_TOKEN` - GitHub personal access token
  - Required permissions: `repo`, `read:org`
  - Get from: GitHub Settings → Developer settings → Personal access tokens

#### Optional

- `ARENA_LABEL` - Linear label to track arena issues (default: `arena:ready`)
- `NODE_ENV` - Set to `production` (Vercel sets this automatically)

### 3. Webhook Setup (After First Deploy)

#### Linear Webhook

1. Go to Linear Settings → API → Webhooks
2. Create new webhook with URL: `https://your-domain.vercel.app/api/linear/webhook`
3. Enable events:
   - Issue: `create`, `update`, `remove`
   - Comment: `create`, `update`
   - Attachment: `create`, `update`
4. Copy the signing secret to `LINEAR_WEBHOOK_SECRET` env var

#### GitHub Webhook

1. Go to Repository Settings → Webhooks → Add webhook
2. Payload URL: `https://your-domain.vercel.app/api/github/webhook`
3. Content type: `application/json`
4. Secret: (generate a random string and set as `GITHUB_WEBHOOK_SECRET`)
5. Events: Select "Let me select individual events"
   - Pull requests
   - Pull request reviews

## Deployment Process

### First Deploy

```bash
# Initialize Vercel project (if not already done)
vercel init

# Or link to existing project
vercel link

# Deploy to production
vercel --prod
```

**What happens during build:**

1. ✅ Install dependencies
2. ✅ Run `npm run vercel-build`:
   - Execute Drizzle migrations → Creates all tables from schema
   - Execute manual migrations → Creates views and rating tables
   - Build Next.js app
3. ✅ Deploy to production

### Subsequent Deploys

```bash
git push origin main
```

Vercel will automatically:
- Build and deploy on push
- Run migrations (idempotent, safe to re-run)

## Database Migrations

### Schema Tables (via Drizzle)

Created automatically from `src/db/schema.ts`:

- `issues` - Linear issues with arena:ready label
- `attempts` - PR attempts by agents
- `issue_agents` - Agent assignments to issues
- `ci_metrics` - CI/CD metrics for PRs
- `events` - Webhook event deduplication
- `agents` - Agent profiles from Linear
- `agent_config` - Agent configuration (unused, legacy)

### Manual Migrations

Located in `drizzle/manual-migrations/`:

**001-agent-stats-view.sql**
- Creates `agent_stats` VIEW
- Aggregates attempt data for leaderboard

**002-agent-ratings.sql**
- Creates `agent_scores` table (OpenSkill ratings)
- Creates `agent_score_history` table (rating changes over time)
- Creates performance indexes
- Seeds initial ratings for known agents

### Migration Files

All migrations are in `/drizzle/`:
- `0000_*.sql` through `0003_*.sql` - Drizzle auto-generated
- `manual-migrations/*.sql` - Custom SQL (views, etc.)

## Verifying Deployment

### 1. Check Build Logs

In Vercel dashboard, check deployment logs for:

```
🔧 Running manual migrations...
▶ Running: 001-agent-stats-view.sql
✅ Success: 001-agent-stats-view.sql
▶ Running: 002-agent-ratings.sql
✅ Success: 002-agent-ratings.sql
✅ All manual migrations completed
```

### 2. Verify Database

Connect to your production database and check:

```sql
-- Should list all tables
\dt

-- Should show: issues, attempts, issue_agents, ci_metrics,
--              agent_scores, agent_score_history, events, agents
```

### 3. Test Application

1. Visit your Vercel URL
2. Should see homepage (may be empty initially)
3. Check `/admin/agents` page
4. Run agent discovery to populate agents table

### 4. Test Webhooks

Send a test webhook from Linear/GitHub to verify connectivity.

## Troubleshooting

### "DATABASE_URL is not set" during build

- Verify env var is set in Vercel project settings
- Env vars must be set for "Production" environment
- May need to redeploy after setting env vars

### "relation does not exist" errors

- Check migration logs in build output
- Verify migrations ran successfully
- May need to manually run migrations against production DB:
  ```bash
  DATABASE_URL="prod-url" npm run db:migrate
  DATABASE_URL="prod-url" npm run db:migrate:manual
  ```

### Webhook 401/403 errors

- Verify webhook secrets match exactly
- Check that secrets are set for production environment
- Test webhook delivery in Linear/GitHub settings

### Build timeout

- Neon free tier may have slower cold starts
- Consider upgrading to paid tier for faster connections
- Build typically completes in 2-3 minutes

## Cron Jobs

The following cron job runs automatically:

- **Linear Reconciliation**: Hourly sync with Linear API
  - Path: `/api/linear/reconcile`
  - Schedule: `0 * * * *` (every hour)
  - Purpose: Syncs deleted issues, status changes

## Monitoring

### Vercel Dashboard

- Deployment logs
- Function logs (for webhook debugging)
- Analytics (traffic, performance)

### Database Monitoring

- Check connection pooling usage (Neon dashboard)
- Monitor query performance
- Watch for connection limit issues

## Rollback

If something goes wrong:

```bash
# Rollback to previous deployment
vercel rollback
```

Note: Database schema changes are NOT rolled back. You may need to manually revert migrations.

## Local Development vs Production

**Local (SQLite):**
- Uses `test.db` file
- Fast, no network latency
- Data cleared on schema changes

**Production (Postgres):**
- Persistent data
- Connection pooling required
- Migrations run automatically on deploy

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Neon Documentation](https://neon.tech/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
