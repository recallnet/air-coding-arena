-- Performance indexes for common query patterns
-- This migration adds indexes to optimize the most frequently used queries in queries.ts

-- Issues table indexes
-- Used in getIssues() ORDER BY and temporal queries WHERE clauses
CREATE INDEX IF NOT EXISTS idx_issues_arena_ready_labeled_at ON issues(arena_ready_labeled_at DESC NULLS LAST);

-- Used for looking up issues by Linear ID (webhook processing)
CREATE INDEX IF NOT EXISTS idx_issues_linear_id ON issues(linear_id);

-- Attempts table indexes
-- Foreign key joins are the most common pattern - issue_id is already indexed by unique constraint
-- on (issue_id, agent_name, pr_number), but we add individual indexes for other query patterns

-- Used in getAgentAttempts() ORDER BY and temporal date filtering
CREATE INDEX IF NOT EXISTS idx_attempts_opened_at ON attempts(opened_at DESC);

-- Used in WHERE status = 'merged'/'closed' filters in aggregations
CREATE INDEX IF NOT EXISTS idx_attempts_status ON attempts(status);

-- Used in agent-specific queries and JOINs with agents table
CREATE INDEX IF NOT EXISTS idx_attempts_agent_name ON attempts(agent_name);

-- Issue Agents table indexes
-- Foreign key for issue_id is already indexed by unique constraint (issue_id, agent_name)
-- But we need agent_name for JOINs with agents table
CREATE INDEX IF NOT EXISTS idx_issue_agents_agent_name ON issue_agents(agent_name);

-- Used in temporal queries to filter recent dispatches
CREATE INDEX IF NOT EXISTS idx_issue_agents_triggered_at ON issue_agents(triggered_at DESC);

-- CI Metrics table indexes
-- Foreign key joins
CREATE INDEX IF NOT EXISTS idx_ci_metrics_attempt_id ON ci_metrics(attempt_id);
