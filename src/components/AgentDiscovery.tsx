/**
 * Agent discovery component for triggering agent discovery from Linear API.
 * Client Component that displays last discovery time and trigger button.
 *
 * @packageDocumentation
 */

'use client'

import { useState, useEffect } from 'react'

import { Button } from '@/components/ui/Button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'

/**
 * Discovery results from API
 */
type DiscoveryResults = {
  discovered: number
  updated: number
  deactivated: number
}

/**
 * Formats a timestamp to a relative time string.
 *
 * @param dateStr - ISO date string to format
 * @returns Relative time string (e.g., "2 hours ago", "3 days ago")
 */
function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) {
    return 'Never'
  }

  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMinutes < 1) {
    return 'Just now'
  } else if (diffMinutes < 60) {
    return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`
  } else if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
  } else if (diffDays < 7) {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
  }
}

/**
 * Agent discovery component.
 * Shows last discovery time and button to trigger discovery.
 *
 * @returns Agent discovery component
 */
export function AgentDiscovery(): React.JSX.Element {
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [lastDiscovery, setLastDiscovery] = useState<string | null>(null)
  const [results, setResults] = useState<DiscoveryResults | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch last discovery time on mount
  useEffect(() => {
    async function fetchLastDiscovery() {
      try {
        const response = await globalThis.fetch('/api/agents/config')
        if (response.ok) {
          const data = (await response.json()) as {
            lastDiscoveryAt: string | null
          }
          setLastDiscovery(data.lastDiscoveryAt)
        }
      } catch (err) {
        globalThis.console.error('Failed to fetch last discovery time:', err)
      }
    }

    void fetchLastDiscovery()
  }, [])

  /**
   * Triggers agent discovery
   */
  async function handleDiscover() {
    setIsDiscovering(true)
    setError(null)
    setResults(null)

    try {
      const response = await globalThis.fetch('/api/agents/discover', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to discover agents')
      }

      const data = (await response.json()) as DiscoveryResults
      setResults(data)
      setLastDiscovery(new Date().toISOString())

      // Trigger page refresh after 1 second
      globalThis.setTimeout(() => {
        globalThis.location.reload()
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover agents')
    } finally {
      setIsDiscovering(false)
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Discovery Status</CardTitle>
        <CardDescription>
          Last discovered: {formatRelativeTime(lastDiscovery)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            {results ? (
              <div className="text-sm text-foreground-secondary">
                <span className="font-medium text-foreground">
                  {results.discovered} discovered
                </span>
                , {results.updated} updated, {results.deactivated} deactivated
              </div>
            ) : null}
            {error ? (
              <div className="text-sm text-red-600">Error: {error}</div>
            ) : null}
          </div>
          <Button
            onClick={handleDiscover}
            disabled={isDiscovering}
            className="ml-4"
          >
            {isDiscovering ? 'Discovering...' : 'Discover Agents'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
