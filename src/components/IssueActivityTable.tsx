/**
 * Issue Activity Table component displaying issues in GitHub Issues list style.
 * Shows one row per issue with agent avatars and status filtering.
 *
 * @packageDocumentation
 */

'use client'

import { ExternalLink } from '@geist-ui/icons'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import * as React from 'react'

import { Badge } from '@/components/ui/Badge'
import type { IssueWithAgents } from '@/lib/queries'

import { AgentAvatarGroup } from './AgentAvatarGroup'
import { IssueStatusFilter, type IssueFilter } from './IssueStatusFilter'

/**
 * Props for the IssueActivityTable component.
 */
export type IssueActivityTableProps = {
  /**
   * Array of issues with agent data to display.
   */
  issues: IssueWithAgents[]
}

/**
 * Issue Activity Table component.
 * Displays issues in GitHub-style list layout (not traditional table).
 * Features:
 * - One row per issue
 * - Status badges
 * - Agent avatars on right side
 * - Status filtering
 * - Hover states
 * - PR counts and metadata
 *
 * @param props - Component props
 * @returns Issue table or empty state
 *
 * @example
 * ```tsx
 * const issues = await getIssuesWithAgents()
 * <IssueActivityTable issues={issues} />
 * ```
 */
export function IssueActivityTable({
  issues,
}: IssueActivityTableProps): React.ReactElement {
  const [filter, setFilter] = React.useState<IssueFilter>('all')
  const router = useRouter()

  const filteredIssues = filterIssues(issues, filter)

  return (
    <div>
      <div className="mb-4">
        <IssueStatusFilter currentFilter={filter} onFilterChange={setFilter} />
      </div>

      {filteredIssues.length === 0 ? (
        <div className="py-8 text-center text-gray-600">No active issues</div>
      ) : (
        <div className="divide-y divide-gray-300 rounded-geist border border-gray-300 bg-background">
          {filteredIssues.map((issue) => {
            const agentProgress = getAgentProgress(issue.agents)
            const isOpen = isIssueOpen(issue.status)

            return (
              <div
                key={issue.id}
                role="button"
                tabIndex={0}
                className={`group relative flex cursor-pointer items-center gap-4 px-4 py-3.5 transition-colors hover:bg-gray-100 ${
                  isOpen
                    ? 'border-l-2 border-l-green-600'
                    : 'border-l-2 border-l-purple-600'
                }`}
                onClick={() => router.push(`/issues/${issue.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    router.push(`/issues/${issue.id}`)
                  }
                }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(issue.status)}>
                      {issue.status ?? 'Unknown'}
                    </Badge>
                    <Link
                      href={`/issues/${issue.id}`}
                      className="font-semibold text-blue-700 hover:text-blue-800 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {issue.linearKey}
                    </Link>
                    <a
                      href={issue.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 opacity-0 transition-opacity hover:text-gray-700 group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                      title="Open in Linear"
                    >
                      <ExternalLink size={14} />
                    </a>
                    <span className="text-gray-900">{issue.title}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-sm text-gray-600">
                    <span>{formatRelativeTime(issue.lastActivityAt)}</span>
                    {agentProgress !== null && <span>{agentProgress}</span>}
                    {issue.openPRCount > 0 && (
                      <span>
                        {issue.openPRCount} open PR
                        {issue.openPRCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {issue.mergedPRCount > 0 && (
                      <span>{issue.mergedPRCount} merged</span>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <AgentAvatarGroup agents={issue.agents} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * Filters issues based on the selected filter.
 * Maps filter values to database statuses:
 * - 'open' → ['Backlog', 'Todo']
 * - 'in_progress' → ['In Progress', 'In Review']
 * - 'completed' → ['Done']
 * - 'cancelled' → ['Canceled']
 *
 * @param issues - Array of issues to filter
 * @param filter - Filter to apply
 * @returns Filtered array of issues
 */
function filterIssues(
  issues: IssueWithAgents[],
  filter: IssueFilter
): IssueWithAgents[] {
  if (filter === 'all') return issues

  return issues.filter((issue) => {
    const status = (issue.status ?? '').toLowerCase()
    switch (filter) {
      case 'open':
        return status === 'todo' || status === 'backlog'
      case 'in_progress':
        return status === 'in progress' || status === 'in review'
      case 'completed':
        return status === 'done'
      case 'cancelled':
        return status === 'canceled'
      default:
        return true
    }
  })
}

/**
 * Maps issue status to badge variant for consistent styling.
 * Matches the pattern used in issues/page.tsx.
 *
 * @param status - Issue status from database
 * @returns Badge variant name
 */
function getStatusBadgeVariant(
  status: string | null
): 'default' | 'secondary' | 'success' | 'error' | 'warning' | 'outline' {
  if (!status) return 'outline'
  switch (status) {
    case 'Done':
      return 'success'
    case 'In Progress':
      return 'warning'
    case 'In Review':
      return 'secondary'
    case 'Todo':
    case 'Backlog':
      return 'outline'
    case 'Canceled':
      return 'error'
    default:
      return 'outline'
  }
}

/**
 * Formats a date as relative time (e.g., "Today", "2 days ago", "Nov 10").
 * Matches the pattern used in ActivityLog.tsx.
 *
 * @param date - Date to format
 * @returns Formatted relative time string
 */
function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Determines if an issue is open (not completed or canceled).
 *
 * @param status - Issue status from database
 * @returns True if issue is open, false otherwise
 */
function isIssueOpen(status: string | null): boolean {
  if (!status) return true
  const lowerStatus = status.toLowerCase()
  return lowerStatus !== 'done' && lowerStatus !== 'canceled'
}

/**
 * Generates agent progress text like "2/3 in progress" or "1/3 complete".
 *
 * @param agents - Array of agents assigned to the issue
 * @returns Progress string or null if no agents
 */
function getAgentProgress(
  agents: Array<{ agentName: string; status: string }>
): string | null {
  if (agents.length === 0) return null

  const total = agents.length
  const accepted = agents.filter((a) => a.status === 'accepted').length
  const submitted = agents.filter((a) => a.status === 'submitted').length
  const inProgress = agents.filter(
    (a) => a.status === 'pending' || a.status === 'submitted'
  ).length

  if (accepted > 0) {
    return `${accepted}/${total} complete`
  } else if (submitted > 0) {
    return `${submitted}/${total} in review`
  } else if (inProgress > 0) {
    return `${inProgress}/${total} in progress`
  }

  return `${total} assigned`
}
