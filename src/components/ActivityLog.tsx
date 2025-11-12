/**
 * Activity log component displaying recent PR activity.
 * Server Component that shows recent attempts with issue details.
 *
 * @packageDocumentation
 */

import Link from 'next/link'

import { Badge } from '@/components/ui/Badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import type { RecentActivity } from '@/lib/queries'

/**
 * Props for the ActivityLog component.
 */
export type ActivityLogProps = {
  /**
   * Array of recent activity entries to display.
   */
  activities: RecentActivity[]
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
 * Gets badge variant for PR status.
 *
 * @param status - PR status string
 * @returns Badge variant
 */
function getStatusVariant(status: string): 'success' | 'error' | 'default' {
  if (status === 'merged') {
    return 'success'
  } else if (status === 'closed') {
    return 'error'
  }
  return 'default'
}

/**
 * Formats PR status for display.
 *
 * @param status - PR status string
 * @returns Formatted status string
 */
function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

/**
 * Activity log component.
 * Displays recent PR activity in a table format.
 *
 * @param props - Component props
 * @returns Activity log with recent PR activity
 */
export function ActivityLog({
  activities,
}: ActivityLogProps): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>
          Latest pull request attempts across all agents
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="py-8 text-center text-foreground-secondary">
            No activity data available yet
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>PR</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell className="text-foreground-secondary">
                    {formatRelativeTime(activity.openedAt)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/agents/${activity.agentName}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {activity.agentName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/issues/${activity.issueId}`}
                      className="text-foreground hover:underline"
                    >
                      {activity.issueLinearKey}: {activity.issueTitle}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <a
                      href={activity.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      #{activity.prNumber}
                    </a>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(activity.status)}>
                      {formatStatus(activity.status)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
