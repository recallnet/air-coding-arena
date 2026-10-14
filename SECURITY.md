# Security

This experimental reference application has no security response service or
supported release schedule. Fixes target the current default branch.

Do not post vulnerabilities, credentials, workspace exports, or private issue
content in public issues. Use the repository's GitHub private vulnerability
reporting form when enabled, or contact a repository maintainer privately.
Include the affected commit, impact, and a safe minimal reproduction. No
response or resolution deadline is promised.

## Operator boundary

Set unique `OPERATOR_USERNAME` and `OPERATOR_PASSWORD` values before using the
admin UI or operator APIs. No default credentials exist. Missing configuration
returns 503; missing or invalid credentials return 401. Credentials are sent
with HTTP Basic authentication, so HTTPS is required outside localhost. The
shared operator account has full administrative authority; this is not a
multi-user identity or role-management system. Rotate both values after
suspected exposure and restrict access at the hosting/network layer where
possible. Browsers may cache Basic credentials until closed.

`CRON_SECRET` authorizes only reconciliation. Do not reuse the operator
password or a webhook secret as the cron token. Cross-origin operator requests
are denied; non-browser automation must protect its credentials too.

Keep webhook signing secrets separate from API keys. Webhooks remain publicly
reachable and authenticate their payloads using HMAC. Never expose database,
Linear, GitHub App, or cron credentials with a `NEXT_PUBLIC_` name. Store
production values in the hosting platform's secret settings. Revoke exposed
credentials even if Git history is later cleaned.

## Public data and operations

Leaderboard, issue, activity, profile, and preview pages are public. Only
connect datasets you may disclose. Admin authentication does not hide those
pages. Logs may contain issue identifiers, event details, and service errors;
restrict log access and retention, and review imported data before publishing.

Use a separate database for tests and development. Migration, reconciliation,
seed, and backfill commands write data. Deployment runs migrations through
`vercel-build`; do not connect a deployment to a database you do not own.
Dependency scans supplement code review and tests. They do not establish the
absence of vulnerabilities.
