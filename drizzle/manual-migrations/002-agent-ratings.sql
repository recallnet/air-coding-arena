-- Create agent_scores table
CREATE TABLE IF NOT EXISTS agent_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL UNIQUE,
  mu REAL NOT NULL DEFAULT 25.0,
  sigma REAL NOT NULL DEFAULT 8.333,
  ordinal REAL NOT NULL DEFAULT 0.0,
  games_played INTEGER NOT NULL DEFAULT 0,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create agent_score_history table
CREATE TABLE IF NOT EXISTS agent_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  mu REAL NOT NULL,
  sigma REAL NOT NULL,
  ordinal REAL NOT NULL,
  rank INTEGER NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
