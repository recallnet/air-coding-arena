-- NOTE: agent_scores and agent_score_history tables are created by Drizzle migration 0004
-- This migration only adds indexes and seed data

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_scores_agent_name ON agent_scores(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_score_history_agent_name ON agent_score_history(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_score_history_issue_id ON agent_score_history(issue_id);
CREATE INDEX IF NOT EXISTS idx_agent_score_history_completed_at ON agent_score_history(completed_at DESC);

-- Insert default ratings for existing agents
INSERT INTO agent_scores (agent_name, mu, sigma, ordinal, games_played)
VALUES
  ('cursor', 25.0, 8.333, 0.0, 0),
  ('engine', 25.0, 8.333, 0.0, 0),
  ('cyrus', 25.0, 8.333, 0.0, 0),
  ('factory', 25.0, 8.333, 0.0, 0)
ON CONFLICT (agent_name) DO NOTHING;
