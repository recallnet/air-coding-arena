-- Agent stats view for leaderboard
-- This view aggregates data from issue_agents and attempts tables
-- IMPORTANT: This is a VIEW, not a materialized view, so it always reflects current data
--
-- Metrics explanation:
-- - issues: Total distinct issues agent was assigned to
-- - prs: Total PRs submitted (from attempts table)
-- - wins: Issues where agent's PR was accepted (merged first)
-- - dnf: Issues where agent was assigned but never submitted a PR (ignored status)
-- - attempts: Same as prs (kept for backwards compatibility)
-- - acceptance_pct: (wins / (wins + losses)) * 100, where losses = rejected status

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
