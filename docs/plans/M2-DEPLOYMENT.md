# Milestone 2: Linear Integration - Deployment Guide

**Status:** Ready to deploy
**Duration:** ~30 minutes
**Prerequisites:** M1 complete, Vercel account, Linear workspace

---

## What M2 Adds

- ✅ Real-time dashboard updates from Linear webhooks
- ✅ PR discovery via Linear attachments (no GitHub webhooks needed)
- ✅ Automatic winner selection when PRs merge
- ✅ Issue tracking when `arena:ready` label is added
- ❌ Manual agent dispatch (automated in M3)

---

## Deployment Steps

### 1. Generate Secrets

```bash
# Generate Linear webhook secret
openssl rand -hex 32
# Save this as LINEAR_WEBHOOK_SECRET
```

### 2. Create Linear API Key

1. Go to Linear → Settings → API → Personal API keys
2. Click "Create new key"
3. Name: "Arena Backend (M2 - read only)"
4. Permissions: Default (read access is sufficient for M2)
5. Copy the key (starts with `lin_api_`)
6. Save as `LINEAR_API_KEY`

### 3. Deploy to Vercel

If not already deployed:

```bash
git add .
git commit -m "Add M2: Linear webhook integration"
git push

# Install Vercel CLI if needed
npm install -g vercel

# Deploy
vercel

# Or link to existing project
vercel --prod
```

Note your production URL: `https://your-app.vercel.app`

### 4. Add Environment Variables to Vercel

Go to Vercel → Project → Settings → Environment Variables:

Add these variables for **Production, Preview, and Development**:

```bash
# Database (already set from M1)
DATABASE_URL=postgresql://...

# Mode
ARENA_MODE=live
NODE_ENV=production

# Linear Integration (NEW for M2)
LINEAR_WEBHOOK_SECRET=<your-generated-secret>
LINEAR_API_KEY=lin_api_<your-key>

# Existing from M1
ARENA_LABEL=arena:ready
ALLOWED_REPOS=your-org/repo1,your-org/repo2
```

After adding, redeploy:
- Go to Deployments tab
- Click on latest deployment → ⋯ → Redeploy

### 5. Configure Linear Webhook

1. Go to Linear → Settings → API → Webhooks
2. Click "Create new webhook"
3. Fill in:
   - **URL:** `https://your-app.vercel.app/api/linear/webhook`
   - **Secret:** Use the same `LINEAR_WEBHOOK_SECRET` from step 1
   - **Label:** "Arena Backend"
4. **Resources to watch:**
   - ✅ Issue
   - ✅ Attachment
   - ⬜ (leave others unchecked)
5. Click "Create webhook"

### 6. Test the Webhook

Linear will send a test event. Check:
- Webhook → Recent Deliveries tab
- Should show 200 response
- If you see 401: webhook secret mismatch
- If you see 500: check Vercel logs

### 7. Install Linear GitHub Integration

**This is critical** - it creates the attachments that M2 relies on.

1. Go to https://linear.app/integrations/github
2. Click "Add to Linear"
3. Authorize GitHub access
4. Select your GitHub organization
5. Enable for repos in your `ALLOWED_REPOS`
6. **Enable workflow automations** (Settings → Teams → [Team] → Workflows):
   - ☑ When PR opens → "In Progress"
   - ☑ When PR approved + CI passing → "Ready to merge"
   - ☑ When PR merges → "Done"

### 8. Test End-to-End

#### Test 1: Issue Labeling

1. Create a Linear issue: `TEST-M2-001: Test webhook integration`
2. Add label `arena:ready`
3. **Expected:**
   - Check Vercel logs: should see "Issue TEST-M2-001 labeled arena:ready"
   - Check database: `issues` table should have new row
   - Dashboard should show the issue (might need refresh)

Query to verify:
```sql
SELECT linear_key, title, arena_ready_labeled_at
FROM issues
WHERE linear_key LIKE 'TEST-M2%';
```

#### Test 2: PR Linking via Branch Name

1. Create a branch: `test-m2-001--webhook-test--agent-cursor`
2. Make a commit and open a PR
3. **Expected:**
   - Linear auto-links PR (creates Attachment)
   - Check Linear: issue should show PR in sidebar
   - Check Vercel logs: "Attempt created/updated: org/repo#123 (open)"
   - Check database: `attempts` table should have new row

Query to verify:
```sql
SELECT a.agent_name, a.pr_number, a.status, i.linear_key
FROM attempts a
JOIN issues i ON a.issue_id = i.id
WHERE i.linear_key LIKE 'TEST-M2%';
```

#### Test 3: PR Merge & Winner Selection

1. Merge the PR from Test 2
2. **Expected:**
   - Linear updates Attachment with "merged" status
   - Check Vercel logs: "Winner set for issue ..."
   - Check database: `issues.winner_attempt_id` should be set

Query to verify:
```sql
SELECT
  i.linear_key,
  i.winner_attempt_id,
  a.agent_name as winner,
  a.pr_number
FROM issues i
LEFT JOIN attempts a ON i.winner_attempt_id = a.id
WHERE i.linear_key LIKE 'TEST-M2%';
```

#### Test 4: Multiple Competing PRs

1. On same issue `TEST-M2-001`, open 2 more PRs:
   - `test-m2-001--approach-two--agent-engine`
   - `test-m2-001--approach-three--agent-cyrus`
2. **Expected:** 3 attempts in database, all `status='open'`
3. Merge the Engine PR
4. **Expected:**
   - Engine attempt → `status='merged'`
   - Engine is winner
   - Cursor and Cyrus attempts → `status='closed'`

Query to verify:
```sql
SELECT agent_name, pr_number, status, merged_at, closed_at
FROM attempts a
JOIN issues i ON a.issue_id = i.id
WHERE i.linear_key = 'TEST-M2-001'
ORDER BY opened_at ASC;
```

---

## Troubleshooting

### Webhook Returns 401

**Cause:** Signature verification failed

**Fix:**
1. Verify `LINEAR_WEBHOOK_SECRET` matches in:
   - Linear webhook configuration
   - Vercel environment variables
2. Make sure you redeployed after adding env vars
3. Check Vercel logs for "LINEAR_WEBHOOK_SECRET not configured"

### Webhook Returns 500

**Cause:** Server error processing webhook

**Fix:**
1. Check Vercel → Functions → Logs
2. Look for error details
3. Common issues:
   - `DATABASE_URL` not set or invalid
   - Missing required fields in webhook payload
   - Database connection timeout

### PR Not Creating Attempt

**Causes:**
1. Linear GitHub integration not installed
2. Branch name doesn't match Linear's auto-link pattern
3. Issue not in database (didn't have `arena:ready` label)

**Fix:**
1. Verify Linear GitHub integration is active
2. Check branch name contains issue key (e.g., `ENG-123--...`)
3. Check issue exists in database first:
   ```sql
   SELECT * FROM issues WHERE linear_key = 'YOUR-ISSUE-KEY';
   ```
4. Check Linear webhook Recent Deliveries for Attachment events

### No Attachment Events in Linear

**Cause:** Linear GitHub integration might not be triggering

**Fix:**
1. Verify integration is installed: Linear → Settings → Integrations → GitHub
2. Check integration has access to the repo
3. Try adding issue key to PR title instead: `ENG-123: Feature name`
4. Or add to PR description: `Fixes ENG-123` or `Refs https://linear.app/...`

### Winner Not Being Set

**Causes:**
1. Multiple PRs merged at same time
2. Attachment webhook delayed
3. Database constraint violation

**Fix:**
1. Check Vercel logs for "Winner set for issue" message
2. Manually verify first merge:
   ```sql
   SELECT * FROM attempts
   WHERE issue_id = (SELECT id FROM issues WHERE linear_key = 'YOUR-KEY')
   ORDER BY merged_at ASC NULLS LAST;
   ```
3. If needed, manually set winner:
   ```sql
   UPDATE issues
   SET winner_attempt_id = (
     SELECT id FROM attempts
     WHERE issue_id = issues.id AND status = 'merged'
     ORDER BY merged_at ASC LIMIT 1
   )
   WHERE linear_key = 'YOUR-KEY';
   ```

---

## Verification Checklist

Before marking M2 complete:

- ✅ Webhook endpoint returns 200 for test events
- ✅ Adding `arena:ready` label creates issue in database
- ✅ Opening PR creates attempt in database
- ✅ Merging PR updates attempt status and sets winner
- ✅ Dashboard shows live data (no manual refresh needed after events)
- ✅ Multiple PRs per issue are tracked correctly
- ✅ First merged PR wins, others are closed

---

## Monitoring

### Vercel Logs

```bash
vercel logs --follow
```

Or visit: Vercel → Project → Functions → /api/linear/webhook

### Database Queries

```sql
-- Recent webhook events
SELECT source, key, created_at
FROM events
ORDER BY created_at DESC
LIMIT 10;

-- Recent attempts
SELECT
  i.linear_key,
  a.agent_name,
  a.pr_number,
  a.status,
  a.opened_at
FROM attempts a
JOIN issues i ON a.issue_id = i.id
ORDER BY a.opened_at DESC
LIMIT 10;

-- Issues with winners
SELECT
  i.linear_key,
  i.title,
  a.agent_name as winner,
  a.pr_number as winning_pr
FROM issues i
LEFT JOIN attempts a ON i.winner_attempt_id = a.id
WHERE i.winner_attempt_id IS NOT NULL
ORDER BY a.merged_at DESC;
```

---

## Next Steps

Once M2 is verified and working:

1. **Clean up test data:**
   ```sql
   DELETE FROM issues WHERE linear_key LIKE 'TEST-M2%';
   ```

2. **Ready for M3:** Agent dispatch automation
   - Upgrade `LINEAR_API_KEY` to read+write permissions
   - Add `AGENTS_CONFIG_JSON` env var
   - Deploy M3 webhook handler updates

3. **Optional:** Add more repos to `ALLOWED_REPOS` and enable GitHub integration for them

---

## Rollback Plan

If M2 causes issues:

1. **Disable Linear webhook:**
   - Linear → Settings → API → Webhooks → [Your webhook] → Disable

2. **Revert env vars:**
   ```bash
   ARENA_MODE=demo
   ```

3. **Keep database changes:**
   - M2 schema changes are backward compatible
   - `source_attachment_id` and `source_attachment_url` are nullable

4. **Redeploy previous version:**
   ```bash
   git revert HEAD
   git push
   ```

Dashboard will continue working with demo data until issues are resolved.
