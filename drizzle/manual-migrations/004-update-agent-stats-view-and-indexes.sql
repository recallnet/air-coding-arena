-- Update agent_stats view with correct DNF calculation and add performance indexes
-- This migration:
-- 1. Fixes DNF to count issue_agents with status='ignored' (assigned but never submitted)
-- 2. Adds missing indexes for issue_agents status and composite queries

-- ============================================================================
-- PART 1: Update agent_stats view
-- ============================================================================

DROP VIEW IF EXISTS agent_stats;

CREATE VIEW agent_stats AS
SELECT
  ia.agent_name,
  COUNT(DISTINCT ia.issue_id) AS issues,
  COUNT(DISTINCT a.id) AS prs,
  COUNT(*) FILTER (WHERE ia.status = 'accepted') AS wins,
  COUNT(*) FILTER (WHERE ia.status = 'ignored') AS dnf,
  COUNT(DISTINCT a.id) AS attempts,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE ia.status = 'accepted') /
    NULLIF(COUNT(*) FILTER (WHERE ia.status IN ('accepted', 'rejected')), 0),
    1
  ) AS acceptance_pct
FROM issue_agents ia
LEFT JOIN attempts a ON ia.issue_id = a.issue_id AND ia.agent_name = a.agent_name
GROUP BY ia.agent_name;

-- ============================================================================
-- PART 2: Add performance indexes
-- ============================================================================

-- Issue Agents status index
-- Used heavily in:
-- - agent_stats view (FILTER WHERE ia.status = 'accepted'/'rejected'/'ignored')
-- - markIgnoredOnIssueClosed (WHERE status = 'pending')
-- - updateAgentStatusOnPRClose (WHERE status = 'submitted')
CREATE INDEX IF NOT EXISTS idx_issue_agents_status ON issue_agents(status);

-- Composite index for issue_agents (issue_id, status)
-- Optimizes queries that filter by both issue and status
-- Used in: updateAgentStatusOnPRClose, update-winner logic
CREATE INDEX IF NOT EXISTS idx_issue_agents_issue_status ON issue_agents(issue_id, status);

-- Composite index for attempts (issue_id, agent_name)
-- Critical for the JOIN in agent_stats view
-- Also used in attempt lookup queries
CREATE INDEX IF NOT EXISTS idx_attempts_issue_agent ON attempts(issue_id, agent_name);

-- Issues status index
-- Used in queries that filter issues by Linear status (Done, Canceled, In Progress, etc.)
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);

-- Issues winner_attempt_id index
-- Used in queries that fetch winner information
-- Frequently accessed in issue detail and leaderboard queries
CREATE INDEX IF NOT EXISTS idx_issues_winner_attempt_id ON issues(winner_attempt_id);
