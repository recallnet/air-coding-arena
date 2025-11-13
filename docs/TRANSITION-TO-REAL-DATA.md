# Transitioning from Demo Data to Real Linear Issue

This guide walks you through migrating from the seeded demo data to tracking the real Linear issue **ENG-320** in real-time.

## Current State

- ✅ **M1 Complete:** UI is built and refined with demo data
- 🎯 **Next:** Add real Linear issue to database for M2 development
- 📋 **Issue:** [ENG-320 - Drop uuid package usage for native crypto and UUIDs](https://linear.app/recall-labs/issue/ENG-320/drop-uuid-package-usage-for-native-crypto-and-uuids)

## Why Do This Now?

1. **Test with real data** while building M2 (Linear webhook integration)
2. **Track actual agent behavior** on a real issue
3. **Keep demo data archived** so it doesn't interfere
4. **Learn from reality** - see how agents actually behave vs mocked data

## Steps

### Option 1: Automated (Recommended)

#### Step 1: Fetch Real Data from Linear

```bash
# This queries Linear API and generates ready-to-use SQL
pnpm fetch:eng320
```

**What this does:**
- Fetches ENG-320 details from Linear API
- Shows current state (PRs, agent activity, etc.)
- Generates SQL INSERT statements with real data
- Shows attachment IDs, PR numbers, etc.

**Output:** Copy the generated SQL from the terminal.

#### Step 2: Run the SQL

Copy the SQL output from Step 1 and run it against your database:

**Option A: Using Drizzle Studio**
```bash
pnpm db:studio
# Paste SQL in the SQL tab and execute
```

**Option B: Using psql**
```bash
psql $DATABASE_URL
# Paste SQL and execute
```

**Option C: Save to file and run**
```bash
# Save the SQL to a file, then:
psql $DATABASE_URL < scripts/add-eng320-custom.sql
```

### Option 2: Manual SQL (If you know the details)

If you already know the PR numbers and agent states:

1. Edit `scripts/add-eng320-manual.sql`
2. Replace all `PLACEHOLDER` and `TODO` values with real data
3. Run the SQL:

```bash
psql $DATABASE_URL < scripts/add-eng320-manual.sql
```

### Option 3: Use the Migration Script (Placeholder data)

**⚠️ Warning:** This uses placeholder data that you'll need to update manually.

```bash
pnpm migrate:real-data
```

This will:
- Archive all demo issues
- Insert ENG-320 with placeholder values
- Create basic agent tracking

You'll need to manually update PR numbers and states afterward.

## Verification

After running any option, verify the data:

### Check in Dashboard

1. Start dev server: `pnpm dev`
2. Go to `http://localhost:3109`
3. You should see:
   - Demo issues marked as "Archived - Demo Data" (or filtered out)
   - ENG-320 visible with current state
   - Agent attempts showing correctly

### Check in Database

```sql
-- View the issue
SELECT * FROM issues WHERE linear_key = 'ENG-320';

-- View agent dispatch tracking
SELECT
  ia.agent_name,
  ia.status,
  ia.triggered_at
FROM issue_agents ia
JOIN issues i ON i.id = ia.issue_id
WHERE i.linear_key = 'ENG-320';

-- View attempts (PRs)
SELECT
  a.agent_name,
  a.pr_number,
  a.pr_url,
  a.status,
  a.opened_at,
  a.merged_at
FROM attempts a
JOIN issues i ON i.id = a.issue_id
WHERE i.linear_key = 'ENG-320';
```

## Understanding the Current State

Based on your description, ENG-320 should have:

| Agent | State | What this means in DB |
|-------|-------|----------------------|
| **Cursor** | Has PR open | `attempts` row with `status='open'`, `pr_number` set |
| **Engine** | Failed | `issue_agents` row with `status='failed'`, OR no `attempts` row |
| **Cyrus** | Working on it | `issue_agents` row only (no `attempts` row until PR opens) |

## What Happens Next (As You Build M2)

Once you implement the Linear webhook in M2:

1. **Attachments arrive** - When agents open/update PRs, Linear sends attachment webhooks
2. **Auto-updates** - Your webhook handler will:
   - Create new `attempts` rows when PRs are linked
   - Update existing `attempts` when PR status changes
   - Set winner when a PR is merged
   - Populate `source_attachment_id` automatically

3. **Real-time tracking** - Dashboard will update live as agents work

## Marking Issues as Demo Data

The scripts automatically mark demo issues with:
```sql
status = 'Archived - Demo Data'
```

To filter them out in your queries:
```sql
WHERE status != 'Archived - Demo Data'
-- OR
WHERE linear_id LIKE 'lin_%'  -- Real Linear IDs start with lin_
```

## Troubleshooting

### "LINEAR_API_KEY not found"

The `fetch:eng320` script needs a Linear API key. Add to `.env.local`:

```bash
LINEAR_API_KEY=lin_api_your_key_here
```

Get one from: Linear Settings → API → Personal API keys

### "Issue not found"

Make sure you have access to the `recall-labs` workspace and the ENG-320 issue.

### Wrong agent states

If the automated fetch guesses wrong, manually edit the SQL before running:

```sql
-- Change agent name if needed
UPDATE attempts SET agent_name = 'engine' WHERE pr_number = 123;

-- Change status if needed
UPDATE attempts SET status = 'closed' WHERE pr_number = 123;
```

### Want to re-import

To start fresh:

```bash
# Delete ENG-320 (cascades to attempts and issue_agents)
psql $DATABASE_URL -c "DELETE FROM issues WHERE linear_key = 'ENG-320';"

# Re-run the fetch and import
pnpm fetch:eng320
# Copy SQL and run it
```

## Next Steps After Import

1. ✅ **Verify** dashboard shows ENG-320 correctly
2. ✅ **Continue M1 refinement** if needed
3. 🚀 **Start M2** - Implement Linear webhook to make it live!

When M2 is complete, this issue will update in real-time as agents work on it.

## Reference

- **Linear Issue:** https://linear.app/recall-labs/issue/ENG-320/drop-uuid-package-usage-for-native-crypto-and-uuids
- **Scripts:**
  - `scripts/fetch-eng320-details.ts` - Fetches from Linear API
  - `scripts/add-eng320-manual.sql` - Manual SQL template
  - `scripts/migrate-to-real-data.ts` - Automated migration (placeholders)
- **Database schema:** See `project-3-linear-first.md` → Database Schema section

