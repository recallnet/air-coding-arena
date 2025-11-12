-- ============================================================================
-- Manual Migration: Add Real Linear Issue ENG-320
-- ============================================================================
-- This script transitions from demo data to real Linear issue tracking.
-- Update the PLACEHOLDER values below with actual data from the Linear issue.
-- ============================================================================

-- Step 1: Archive all demo/seeded issues
-- ============================================================================
UPDATE issues
SET status = 'Archived - Demo Data'
WHERE linear_id NOT LIKE 'lin_%'  -- Real Linear IDs start with lin_
   OR linear_id IS NULL;

-- Verify: Check what was archived
SELECT linear_key, title, status FROM issues WHERE status = 'Archived - Demo Data';


-- Step 2: Insert the real Linear issue ENG-320
-- ============================================================================
-- TODO: Get the actual linear_id from Linear (looks like: lin_abc123def456)
-- You can get this from the Linear API or webhook payload

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
  'lin_PLACEHOLDER',  -- TODO: Replace with actual Linear issue ID
  'ENG-320',
  'Drop uuid package usage for native crypto and UUIDs',
  'https://linear.app/recall-labs/issue/ENG-320/drop-uuid-package-usage-for-native-crypto-and-uuids',
  'recall-labs/backend',  -- TODO: Update if different repo
  'In Progress',
  NOW(),
  NOW()
)
ON CONFLICT (linear_id) DO UPDATE
SET
  status = EXCLUDED.status,
  arena_ready_labeled_at = EXCLUDED.arena_ready_labeled_at
RETURNING id, linear_key;

-- Save the returned ID for next steps!
-- Let's say the returned ID is stored in a variable for the next queries


-- Step 3: Create issue_agents rows (tracking agent dispatch)
-- ============================================================================
-- TODO: Replace <ISSUE_ID> with the UUID returned from Step 2

INSERT INTO issue_agents (issue_id, agent_name, status, triggered_at)
VALUES
  ('<ISSUE_ID>', 'cursor', 'triggered', NOW()),
  ('<ISSUE_ID>', 'engine', 'triggered', NOW()),
  ('<ISSUE_ID>', 'cyrus', 'triggered', NOW())
ON CONFLICT (issue_id, agent_name) DO NOTHING;


-- Step 4: Create attempts for agents with PRs
-- ============================================================================

-- CURSOR - Has a PR open
-- TODO: Update pr_number, pr_url, and branch with actual values from GitHub/Linear

INSERT INTO attempts (
  issue_id,
  agent_name,
  repo,
  pr_number,
  pr_url,
  branch,
  opened_at,
  status,
  commit_count
) VALUES (
  '<ISSUE_ID>',  -- TODO: Replace with actual issue ID from Step 2
  'cursor',
  'recall-labs/backend',
  999,  -- TODO: Replace with actual PR number
  'https://github.com/recall-labs/backend/pull/999',  -- TODO: Replace with actual PR URL
  'eng-320--drop-uuid--agent-cursor',  -- TODO: Update if different branch name
  NOW() - INTERVAL '2 hours',  -- Adjust as needed
  'open',
  1  -- Will be updated by enrichment job
)
ON CONFLICT (issue_id, agent_name, pr_number) DO UPDATE
SET status = EXCLUDED.status;


-- ENGINE - Failed (no PR created)
-- Only run this if Engine actually failed and won't create a PR
-- Skip if Engine is still working on it

-- UPDATE issue_agents
-- SET status = 'failed'
-- WHERE issue_id = '<ISSUE_ID>' AND agent_name = 'engine';


-- CYRUS - Still working on it (no PR yet)
-- No action needed - attempt will be created when PR is opened


-- Step 5: Verification queries
-- ============================================================================

-- Check the issue was added
SELECT * FROM issues WHERE linear_key = 'ENG-320';

-- Check agent dispatch tracking
SELECT * FROM issue_agents WHERE issue_id IN (
  SELECT id FROM issues WHERE linear_key = 'ENG-320'
);

-- Check attempts
SELECT
  a.agent_name,
  a.pr_number,
  a.pr_url,
  a.status,
  a.commit_count,
  a.opened_at
FROM attempts a
JOIN issues i ON i.id = a.issue_id
WHERE i.linear_key = 'ENG-320';


-- ============================================================================
-- NEXT STEPS AFTER RUNNING THIS SCRIPT:
-- ============================================================================
-- 1. Verify the data looks correct in your dashboard
-- 2. When you enable Linear webhooks in M2, attachment events will:
--    - Auto-populate source_attachment_id and source_attachment_url
--    - Update PR status when merged/closed
--    - Set winner when a PR is merged
-- 3. When you enable GitHub polling in M4, it will:
--    - Update commit_count with accurate values
--    - Add precise merged_at/closed_at timestamps
-- ============================================================================

