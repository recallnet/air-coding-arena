/**
 * Agent detail page displaying an agent's performance and all their attempts.
 * Server Component that fetches and displays agent stats and attempt history.
 *
 * @packageDocumentation
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'

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
import { getAgentStats, getAttemptsByAgent } from '@/lib/queries'
import type { AttemptStatus } from '@/types/database'

/**
 * Page props type for dynamic route parameter.
 */
type PageProps = {
  params: {
    agentName: string
  }
}

/**
 * Type guard to check if a string is a valid AttemptStatus.
 *
 * @param status - Status string to check
 * @returns True if status is a valid AttemptStatus, false otherwise
 */
function isAttemptStatus(status: string): status is AttemptStatus {
  const validStatuses: readonly string[] = ['open', 'merged', 'closed'] as const
  return validStatuses.includes(status)
}

/**
 * Maps attempt status to Badge variant for consistent color coding.
 *
 * @param status - Attempt status (open, merged, closed)
 * @returns Badge variant for the status
 */
function getAttemptStatusBadgeVariant(
  status: string
): 'default' | 'secondary' | 'success' | 'error' | 'warning' | 'outline' {
  if (!isAttemptStatus(status)) {
    return 'secondary'
  }

  switch (status) {
    case 'merged':
      return 'success'
    case 'open':
      return 'warning'
    case 'closed':
      return 'error'
  }
}

/**
 * Formats a date to a readable string like "Jan 15, 2025".
 *
 * @param date - Date to format
 * @returns Formatted date string, or "-" if date is null
 */
function formatDate(date: Date | null): string {
  if (date === null) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

/**
 * Agent detail page component.
 * Displays an agent's performance stats and all their attempts.
 *
 * @param props - Page props with dynamic route parameter
 * @returns Agent detail page with stats and attempts table
 */
export default async function AgentPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { agentName } = await params

  // Fetch all attempts for this agent
  const attempts = await getAttemptsByAgent(agentName)

  // If no attempts, return 404
  if (attempts.length === 0) {
    notFound()
  }

  // Fetch all agent stats and find this agent's stats
  const allStats = await getAgentStats()
  const agentStats = allStats.find((stats) => stats.agentName === agentName)

  // Calculate stats (should always exist if attempts exist, but handle null safely)
  const totalAttempts = agentStats?.attempts ?? attempts.length
  const wins = agentStats?.wins ?? 0
  const acceptanceRate = agentStats?.acceptancePct ?? 0
  const isTopPerformer = acceptanceRate > 75

  return (
    <main className="container mx-auto p-6 md:p-8 lg:p-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Agent Details
        </h1>
        <p className="mt-2 text-lg text-foreground-secondary">
          Performance metrics and attempt history for {params.agentName}
        </p>
      </div>

      {/* Agent Stats Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{agentName}</span>
              {isTopPerformer === true ? (
                <Badge variant="success">Top Performer</Badge>
              ) : (
                <Badge variant="secondary">Active</Badge>
              )}
            </div>
          </CardTitle>
          <CardDescription>Agent performance summary</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <span className="text-sm font-medium text-foreground-secondary">
                Total Attempts
              </span>
              <div className="mt-1 text-2xl font-semibold">{totalAttempts}</div>
            </div>

            <div>
              <span className="text-sm font-medium text-foreground-secondary">
                Wins (Merged PRs)
              </span>
              <div className="mt-1 text-2xl font-semibold">{wins}</div>
            </div>

            <div>
              <span className="text-sm font-medium text-foreground-secondary">
                Acceptance Rate
              </span>
              <div className="mt-1 text-2xl font-semibold">
                {acceptanceRate.toFixed(1)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attempts Card */}
      <Card>
        <CardHeader>
          <CardTitle>Attempts</CardTitle>
          <CardDescription>
            All pull request attempts by {params.agentName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Issue</TableHead>
                <TableHead>PR Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Opened Date</TableHead>
                <TableHead>Merged Date</TableHead>
                <TableHead className="text-right">Commit Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attempts.map((attempt) => (
                <TableRow key={attempt.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/issues/${attempt.issueId}`}
                      className="text-blue-900 transition-colors hover:underline"
                    >
                      {attempt.issueLinearKey}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <a
                      href={attempt.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-900 transition-colors hover:underline"
                    >
                      #{attempt.prNumber}
                    </a>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={getAttemptStatusBadgeVariant(attempt.status)}
                    >
                      {attempt.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(attempt.openedAt)}</TableCell>
                  <TableCell>{formatDate(attempt.mergedAt)}</TableCell>
                  <TableCell className="text-right">
                    {attempt.commitCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  )
}
