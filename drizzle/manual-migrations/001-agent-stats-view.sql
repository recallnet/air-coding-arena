-- Agent stats view for leaderboard
-- This view aggregates attempt data to show each agent's performance metrics
-- IMPORTANT: This is a VIEW, not a materialized view, so it always reflects current data

CREATE OR REPLACE VIEW agent_stats AS
SELECT
  agent_name,
  COUNT(*) AS attempts,
  COUNT(*) FILTER (WHERE status='merged') AS wins,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status='merged') / NULLIF(COUNT(*),0), 1) AS acceptance_pct
FROM attempts
GROUP BY agent_name;
