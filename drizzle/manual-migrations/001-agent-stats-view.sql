-- Agent stats view for leaderboard
-- This view aggregates attempt data to show each agent's performance metrics
-- IMPORTANT: This is a VIEW, not a materialized view, so it always reflects current data

DROP VIEW IF EXISTS agent_stats;

CREATE VIEW agent_stats AS
SELECT
  agent_name,
  COUNT(DISTINCT issue_id) AS issues,
  COUNT(*) AS prs,
  COUNT(*) FILTER (WHERE status='merged') AS wins,
  COUNT(*) FILTER (WHERE status='closed') AS dnf,
  COUNT(*) AS attempts,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status='merged') / NULLIF(COUNT(*),0), 1) AS acceptance_pct
FROM attempts
GROUP BY agent_name;
