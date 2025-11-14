'use client'

import { useSearchParams } from 'next/navigation'

/**
 * Client component for displaying GitHub setup status messages.
 * Reads URL query parameters to show success, error, or suspended messages.
 *
 * @returns Status messages based on URL params
 */
export function GitHubSetupMessages() {
  const searchParams = useSearchParams()
  const success = searchParams?.get('success')
  const error = searchParams?.get('error')
  const suspended = searchParams?.get('suspended')

  return (
    <>
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
    </>
  )
}
