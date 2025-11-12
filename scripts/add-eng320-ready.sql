-- ============================================================================
-- Add Real Linear Issue ENG-320 to Database
-- ============================================================================
-- Generated from Linear API on 2025-11-12
-- Run with: psql $DATABASE_URL < scripts/add-eng320-ready.sql
-- ============================================================================

-- Step 1: Archive all demo/seeded issues
-- ============================================================================
UPDATE issues
SET status = 'Archived - Demo Data'
WHERE linear_id NOT LIKE 'e7376814-%'  -- Keep only ENG-320
   AND status != 'Archived - Demo Data';  -- Don't re-archive

-- Verify: Check what was archived
-- SELECT COUNT(*) as archived_count FROM issues WHERE status = 'Archived - Demo Data';


-- Step 2: Insert the real Linear issue ENG-320
-- ============================================================================
INSERT INTO issues (
  linear_id,
  linear_key,
  title,
  url,
  repo,
  status,
  arena_ready_labeled_at,
  created_at
) VALUES (
  'e7376814-a82e-48a4-bea7-55a263f88a09',
  'ENG-320',
  'Drop `uuid` package usage for native `crypto` and UUID''s',
  'https://linear.app/recall-labs/issue/ENG-320/drop-uuid-package-usage-for-native-crypto-and-uuids',
  'recall-labs/backend',
  'In Progress',
  NOW(),  -- Tagged today for arena
  '2025-09-03T16:03:38.881Z'
)
ON CONFLICT (linear_id) DO UPDATE
SET
  status = EXCLUDED.status,
  arena_ready_labeled_at = COALESCE(issues.arena_ready_labeled_at, NOW())
RETURNING id, linear_key;

-- Save the returned ID for next steps!
-- For psql, use this to capture it:
\set issue_id (SELECT id FROM issues WHERE linear_key = 'ENG-320')


-- Step 3: Create issue_agents rows (tracking agent dispatch)
-- ============================================================================
-- All 3 agents were tagged/notified based on comments in Linear

INSERT INTO issue_agents (issue_id, agent_name, status, triggered_at)
SELECT
  id,
  agent_name,
  'triggered',
  NOW()
FROM issues, (VALUES
  ('cursor'),
  ('engine'),
  ('cyrus')
) AS agents(agent_name)
WHERE linear_key = 'ENG-320'
ON CONFLICT (issue_id, agent_name) DO NOTHING;


-- Step 4: Note about attempts
-- ============================================================================
-- No PR attachments found in Linear yet.
--
-- This means PRs might exist on GitHub but aren't linked to Linear.
-- They need one of these to auto-link:
--   1. Branch name contains "ENG-320" (e.g., eng-320--fix-uuid--agent-cursor)
--   2. PR title contains "ENG-320"
--   3. PR description has magic word + key (e.g., "Refs ENG-320" or "Fixes https://linear.app/...ENG-320")
--
-- Once linked, Linear will create attachments and send webhooks (in M2).
--
-- For now, if you know the PR numbers, you can manually add attempts:
--
-- Example (update with real PR numbers):
--
-- INSERT INTO attempts (
--   issue_id, agent_name, repo, pr_number, pr_url, branch,
--   opened_at, status, commit_count
-- ) VALUES (
--   (SELECT id FROM issues WHERE linear_key = 'ENG-320'),
--   'cursor',  -- or 'engine' or 'cyrus'
--   'recall-labs/backend',
--   123,  -- Replace with real PR number
--   'https://github.com/recall-labs/backend/pull/123',
--   'eng-320--drop-uuid--agent-cursor',
--   NOW() - INTERVAL '2 hours',
--   'open',  -- or 'closed' or 'merged'
--   1
-- );


-- Step 5: Verification queries
-- ============================================================================

-- Check demo data was archived
SELECT
  COUNT(*) FILTER (WHERE status = 'Archived - Demo Data') as archived_count,
  COUNT(*) FILTER (WHERE status != 'Archived - Demo Data') as active_count
FROM issues;

-- Check ENG-320 was added
SELECT
  linear_key,
  title,
  status,
  arena_ready_labeled_at
FROM issues
WHERE linear_key = 'ENG-320';

-- Check agent dispatch tracking
SELECT
  ia.agent_name,
  ia.status,
  ia.triggered_at
FROM issue_agents ia
JOIN issues i ON i.id = ia.issue_id
WHERE i.linear_key = 'ENG-320';

-- Check attempts (should be empty until PRs are linked)
SELECT
  a.agent_name,
  a.pr_number,
  a.pr_url,
  a.status
FROM attempts a
JOIN issues i ON i.id = a.issue_id
WHERE i.linear_key = 'ENG-320';


-- ============================================================================
-- SUCCESS! ENG-320 is now in your database.
--
-- NEXT STEPS:
--
-- 1. Verify in dashboard: pnpm dev → http://localhost:3109
--    - Demo issues should be gone (or marked archived)
--    - ENG-320 should appear as "In Progress"
--    - No attempts yet (until PRs are linked)
--
-- 2. Link the PRs to Linear (if they exist):
--    - Add "ENG-320" to branch name, OR
--    - Add "Refs ENG-320" to PR description, OR
--    - Add "ENG-320" to PR title
--    - Linear will auto-create attachments
--
-- 3. When M2 webhook is implemented:
--    - Linear will send attachment events when PRs are linked
--    - Your webhook will auto-create attempts
--    - Dashboard will update in real-time!
--
-- 4. For now, you can manually add attempt rows (see Step 4 above)
--    if you know the PR numbers and don't want to wait for linking.
-- ============================================================================

