/**
 * GitHub App setup page
 * Server Component that displays GitHub App installation status.
 *
 * @packageDocumentation
 */

import { GitHubSetupMessages } from '@/components/GitHubSetupMessages'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { getGitHubAppInstallations } from '@/lib/queries'
import type { GitHubInstallation } from '@/lib/queries'

/**
 * Forces dynamic rendering (no static generation).
 * Required for admin pages that fetch real-time data from database.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#dynamic
 */
export const dynamic = 'force-dynamic'

/**
 * Cache revalidation interval in seconds.
 * 0 means no caching - always fetch fresh data.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#revalidate
 */
export const revalidate = 0

/**
 * Formats a date to a readable string.
 *
 * @param date - Date to format
 * @returns Formatted date string
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

/**
 * Installation row component for displaying a single installation.
 *
 * @param props - Component props
 * @param props.installation - GitHub installation data
 * @returns Installation row
 */
function InstallationRow({
  installation,
}: {
  installation: GitHubInstallation
}) {
  const isSuspended = !installation.isActive

  return (
    <div
      className={`flex items-center justify-between rounded-geist border p-4 ${
        isSuspended
          ? 'border-yellow-300 bg-yellow-50'
          : 'border-border bg-background'
      }`}
    >
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <div>
            <div className="font-medium text-foreground">
              {installation.accountLogin}
            </div>
            <div className="text-sm text-foreground-secondary">
              {installation.accountType}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="text-right">
          <div className="text-sm text-foreground-secondary">Installed</div>
          <div className="text-sm text-foreground">
            {formatDate(installation.installedAt)}
          </div>
        </div>

        <div className="min-w-[100px] text-right">
          {isSuspended ? (
            <div className="flex flex-col items-end">
              <span className="inline-block rounded-full bg-yellow-600 px-3 py-1 text-xs font-medium text-white">
                Suspended
              </span>
              {installation.suspendedAt ? (
                <span className="mt-1 text-xs text-foreground-secondary">
                  {formatDate(installation.suspendedAt)}
                </span>
              ) : null}
            </div>
          ) : (
            <span className="inline-block rounded-full bg-green-600 px-3 py-1 text-xs font-medium text-white">
              Active
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * GitHub App setup page component.
 * Displays installation instructions and current installation status.
 *
 * @returns GitHub setup page
 */
export default async function GitHubSetupPage(): Promise<React.JSX.Element> {
  const installations = await getGitHubAppInstallations()

  const appName = process.env['NEXT_PUBLIC_GITHUB_APP_NAME']
  const installUrl = appName ? `https://github.com/apps/${appName}` : null

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          GitHub App Setup
        </h1>
        <p className="mt-2 text-lg text-foreground-secondary">
          Connect your GitHub organization to enable webhooks and API access
        </p>
      </div>

      <GitHubSetupMessages />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Connect GitHub Organization</CardTitle>
          <CardDescription>
            Install the Air Coding Arena GitHub App to enable:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="mb-6 list-inside list-disc space-y-2 text-foreground-secondary">
            <li>Automatic webhook registration for PR events</li>
            <li>Secure, short-lived API tokens (1-hour expiry)</li>
            <li>Organization-level permissions (survives user changes)</li>
            <li>3x better rate limits (15,000 requests/hour)</li>
          </ul>

          {installUrl ? (
            <a
              href={installUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-geist bg-blue-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800"
            >
              Install GitHub App
            </a>
          ) : (
            <p>Configure your GitHub App name before installing.</p>
          )}

          <p className="mt-4 text-sm text-foreground-secondary">
            After installation, you'll be redirected back here to confirm the
            connection.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Status</CardTitle>
          <CardDescription>
            GitHub App installations for this organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {installations.length === 0 ? (
            <div className="text-foreground-secondary">
              <p>No installations configured yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {installations.map((installation) => (
                <InstallationRow
                  key={installation.id}
                  installation={installation}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
