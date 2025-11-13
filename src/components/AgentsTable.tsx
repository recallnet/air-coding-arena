/**
 * Agents table component for displaying all agents.
 * Client Component that shows agents with avatar, status, and enable toggle.
 *
 * @packageDocumentation
 */

'use client'

import { useState } from 'react'

import { Badge } from '@/components/ui/Badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import { EnableToggle } from '@/components/EnableToggle'

/**
 * Agent type
 */
export type Agent = {
  id: string
  name: string
  displayName: string
  linearUserId: string
  email: string | null
  avatarUrl: string | null
  isActive: boolean
  isEnabled: boolean
  discoveredAt: string
  lastSeenAt: string
}

/**
 * Props for AgentsTable component
 */
export type AgentsTableProps = {
  /** Initial agents data from server */
  initialAgents: Agent[]
}

/**
 * Formats a timestamp to a relative time string.
 *
 * @param dateStr - ISO date string to format
 * @returns Relative time string (e.g., "2 hours ago", "3 days ago")
 */
function formatRelativeTime(dateStr: string): string {
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
 * Agents table component.
 * Displays all agents with their status and configuration options.
 *
 * @param props - Component props
 * @returns Agents table component
 */
export function AgentsTable({
  initialAgents,
}: AgentsTableProps): React.JSX.Element {
  const [agents] = useState<Agent[]>(initialAgents)

  if (agents.length === 0) {
    return (
      <div className="py-8 text-center text-foreground-secondary">
        No agents discovered yet. Click &quot;Discover Agents&quot; to find
        agents in your Linear workspace.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Agent</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last Seen</TableHead>
          <TableHead>Enabled</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {agents.map((agent) => (
          <TableRow key={agent.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                {agent.avatarUrl ? (
                  <img
                    src={agent.avatarUrl}
                    alt={agent.displayName}
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600">
                    {agent.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="font-medium text-foreground">
                    {agent.displayName}
                  </div>
                  <div className="text-sm text-foreground-secondary">
                    {agent.name}
                  </div>
                </div>
              </div>
            </TableCell>
            <TableCell className="text-foreground-secondary">
              {agent.email || '-'}
            </TableCell>
            <TableCell>
              <Badge variant={agent.isActive ? 'success' : 'secondary'}>
                {agent.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </TableCell>
            <TableCell className="text-foreground-secondary">
              {formatRelativeTime(agent.lastSeenAt)}
            </TableCell>
            <TableCell>
              <EnableToggle agentId={agent.id} enabled={agent.isEnabled} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
