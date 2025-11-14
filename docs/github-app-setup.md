# GitHub App Setup Guide

## Overview

The Air Coding Arena uses a GitHub App for authentication instead of Personal Access Tokens (PATs). This provides:

- **Security**: Short-lived tokens (1 hour) instead of perpetual PATs
- **Scalability**: Works across multiple organizations
- **Reliability**: Organization-level installation survives user changes
- **Performance**: 3x better rate limits (15,000 vs 5,000 requests/hour)

## Prerequisites

1. GitHub organization with admin access
2. Deployed Next.js application with public URL

## Creating the GitHub App

### 1. Register the App

Visit: https://github.com/organizations/YOUR_ORG/settings/apps/new

### 2. Configure Settings

**GitHub App name:** `air-coding-arena` (or your preferred name)

**Homepage URL:** `https://your-domain.com`

**Callback URL:**
```
https://your-domain.com/api/github/app/callback
```

**Setup URL (optional):**
```
https://your-domain.com/admin/github/setup
```

**Webhook:**
- Active
- **Webhook URL:** `https://your-domain.com/api/github/webhook`
- **Webhook secret:** Generate with `openssl rand -hex 32`

**Permissions:**
- **Repository permissions:**
  - Contents: Read-only
  - Pull requests: Read & Write
  - Metadata: Read-only (auto-included)

**Subscribe to events:**
- Pull request
- Check suite

**Where can this GitHub App be installed?**
- Only on this account (for production, can enable "Any account" later)

### 3. Generate Private Key

After creating the app:

1. Scroll to bottom of app settings page
2. Click "Generate a private key"
3. Save the downloaded `.pem` file securely
4. Note the **App ID** from the top of the settings page

## Environment Configuration

Add these to your `.env.local`:

```bash
# GitHub App Configuration
GITHUB_APP_ID=<your-app-id>
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
<your-private-key-contents-with-\n-for-newlines>
-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=<your-webhook-secret>

# For client-side (optional, for UI)
NEXT_PUBLIC_GITHUB_APP_ID=<your-app-id>

# GitHub App name for install URL (defaults to 'air-coding' for production)
# Use 'air-coding-dev' for development environment
NEXT_PUBLIC_GITHUB_APP_NAME=air-coding-dev
```

**Important:** The private key must have literal `\n` characters for newlines, not actual newlines.

## Installation

### Admin Installation

1. Navigate to `/admin/github/setup` in your application
2. Click "Install GitHub App"
3. Select which repositories to grant access
4. Confirm installation
5. You'll be redirected back with a success message

### Programmatic Installation

Installation data is automatically stored in the `github_app_installations` table:

```sql
SELECT * FROM github_app_installations;
```

## Verification

### Check Installation Status

```bash
curl -X GET https://api.github.com/app/installations \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Accept: application/vnd.github+json"
```

### Test Webhook

1. Create a test PR in an installed repository
2. Check application logs for webhook events
3. Verify commit count is fetched successfully

### Test Installation Token

```typescript
import { getInstallationToken } from '@/lib/github-app-auth'

const token = await getInstallationToken('12345')
console.log('Token:', token.substring(0, 10) + '...')
```

## Troubleshooting

### "No GitHub App installation found for org"

**Cause:** App not installed for the organization containing the repository

**Solution:** Install the app via `/admin/github/setup`

### "Failed to get installation token: 403 Forbidden"

**Cause:** Invalid private key or App ID

**Solution:**
1. Verify `GITHUB_APP_ID` matches your app
2. Regenerate private key and update `.env.local`
3. Ensure newlines are escaped as `\n`

### "JWT expired"

**Cause:** System clock skew

**Solution:** Sync system time with NTP server

### Webhook Not Receiving Events

**Cause:** Webhook secret mismatch or incorrect URL

**Solution:**
1. Verify `GITHUB_WEBHOOK_SECRET` matches GitHub App settings
2. Ensure webhook URL is publicly accessible
3. Check webhook delivery logs in GitHub App settings

## Migration from PAT

If you're migrating from `GITHUB_TOKEN` (PAT):

1. Install GitHub App for your organization
2. Verify webhooks work with installation tokens
3. Remove `GITHUB_TOKEN` from `.env.local` (optional - kept as fallback)
4. Monitor logs for any "falling back to PAT" messages

## Rate Limits

Check your current rate limit:

```bash
curl -X GET https://api.github.com/rate_limit \
  -H "Authorization: Bearer <installation-token>"
```

**Expected limits:**
- **PAT:** 5,000 requests/hour
- **GitHub App:** 15,000 requests/hour

## Security Best Practices

1. **Private Key Storage:**
   - Never commit `.pem` files to git
   - Store in environment variables only
   - Rotate keys periodically

2. **Webhook Secret:**
   - Use cryptographically random secrets
   - Rotate if compromised
   - Never log the secret value

3. **Permissions:**
   - Grant minimum required permissions
   - Review permission requests periodically
   - Use read-only when write access not needed

## Support

For issues with GitHub App setup:

1. Check GitHub App installation logs: `https://github.com/settings/installations`
2. Review webhook delivery logs in app settings
3. Check application server logs for authentication errors
4. Verify environment variables are set correctly
