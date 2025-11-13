'use client'

import { useSearchParams } from 'next/navigation'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'

/**
 * GitHub App setup page
 *
 * @returns GitHub setup page component
 */
export default function GitHubSetupPage() {
  const searchParams = useSearchParams()
  const success = searchParams?.get('success')
  const error = searchParams?.get('error')
  const suspended = searchParams?.get('suspended')

  // Use env var for GitHub App name, fallback to air-coding-dev
  const appName = process.env['NEXT_PUBLIC_GITHUB_APP_NAME'] ?? 'air-coding-dev'
  const installUrl = `https://github.com/apps/${appName}`

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

      {success ? (
        <div className="mb-6 rounded-geist border border-green-600 bg-green-50 px-4 py-3 text-sm text-green-900">
          Successfully connected to GitHub! Your organization can now receive
          webhooks and the app can access repositories.
        </div>
      ) : null}

      {suspended ? (
        <div className="mb-6 rounded-geist border border-yellow-600 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          GitHub App installation suspended. Please reinstall to restore access.
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 rounded-geist border border-red-600 bg-red-50 px-4 py-3 text-sm text-red-900">
          Error: {decodeURIComponent(error)}
        </div>
      ) : null}

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

          <a
            href={installUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-geist bg-blue-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800"
          >
            Install GitHub App
          </a>

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
          <div className="text-foreground-secondary">
            {/* TODO: Fetch and display current installations from database */}
            <p>No installations configured yet.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
