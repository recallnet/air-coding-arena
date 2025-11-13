'use client'

import { useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/Card'

export default function GitHubSetupPage() {
  const searchParams = useSearchParams()
  const success = searchParams?.get('success')
  const error = searchParams?.get('error')
  const suspended = searchParams?.get('suspended')

  const appId = process.env['NEXT_PUBLIC_GITHUB_APP_ID'] || '2287430'
  const installUrl = `https://github.com/apps/air-coding-arena/installations/new`

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">GitHub App Setup</h1>

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
          Successfully connected to GitHub! Your organization can now receive webhooks and the app can access repositories.
        </div>
      )}

      {suspended && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6">
          GitHub App installation suspended. Please reinstall to restore access.
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          Error: {decodeURIComponent(error)}
        </div>
      )}

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Connect GitHub Organization</h2>
        <p className="text-gray-600 mb-6">
          Install the Air Coding Arena GitHub App to enable:
        </p>
        <ul className="list-disc list-inside text-gray-600 mb-6 space-y-2">
          <li>Automatic webhook registration for PR events</li>
          <li>Secure, short-lived API tokens (1-hour expiry)</li>
          <li>Organization-level permissions (survives user changes)</li>
          <li>3x better rate limits (15,000 requests/hour)</li>
        </ul>

        <a
          href={installUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 rounded font-semibold transition-colors bg-blue-600 text-white hover:bg-blue-700"
        >
          Install GitHub App
        </a>

        <p className="text-sm text-gray-500 mt-4">
          After installation, you'll be redirected back here to confirm the connection.
        </p>
      </Card>

      <Card className="p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">Current Status</h2>
        <div className="text-gray-600">
          {/* TODO: Fetch and display current installations from database */}
          <p>No installations configured yet.</p>
        </div>
      </Card>
    </div>
  )
}
