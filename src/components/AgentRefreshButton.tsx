/**
 * Agent refresh button component for triggering agent discovery from Linear API.
 * Client Component that displays as an icon button.
 *
 * @packageDocumentation
 */

'use client'

import { RefreshCw } from 'lucide-react'
import { useState } from 'react'

/**
 * Discovery results from API
 */
type DiscoveryResults = {
  discovered: number
  updated: number
  deactivated: number
}

/**
 * Agent refresh button component.
 * Triggers agent discovery and refreshes the page.
 *
 * @returns Agent refresh button component
 */
export function AgentRefreshButton(): React.JSX.Element {
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Triggers agent discovery
   */
  async function handleDiscover() {
    setIsDiscovering(true)
    setError(null)

    try {
      const response = await globalThis.fetch('/api/agents/discover', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to discover agents')
      }

      ;(await response.json()) as DiscoveryResults

      // Trigger page refresh after brief delay
      globalThis.setTimeout(() => {
        globalThis.location.reload()
      }, 500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover agents')
      setIsDiscovering(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleDiscover}
        disabled={isDiscovering}
        className="inline-flex items-center justify-center rounded-md p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
        title="Discover agents from Linear"
      >
        <RefreshCw
          className={`h-4 w-4 ${isDiscovering ? 'animate-spin' : ''}`}
        />
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  )
}
