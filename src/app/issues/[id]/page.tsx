/**
 * Issue detail page displaying a single issue with all its attempts.
 * Server Component that fetches and displays issue data with attempt history.
 *
 * @packageDocumentation
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AgentAvatar } from '@/components/AgentAvatar'
import { PRComparisonContainer } from '@/components/PRComparisonContainer'
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
import { generateMockPRComparison } from '@/lib/mock-pr-data'
import { getIssueById } from '@/lib/queries'
import type { AttemptStatus, IssueStatus } from '@/types/database'

/**
 * Page props type for dynamic route parameter.
 */
type PageProps = {
  params: {
    id: string
  }
}

/**
 * Type guard to check if a string is a valid IssueStatus.
 *
 * @param status - Status string to check
 * @returns True if status is a valid IssueStatus, false otherwise
 */
function isIssueStatus(status: string | null): status is IssueStatus {
  if (status === null) {
    return false
  }

  const validStatuses: readonly string[] = [
    'Done',
    'In Progress',
    'In Review',
    'Todo',
    'Backlog',
    'Canceled',
  ] as const

  return validStatuses.includes(status)
}

/**
 * Maps issue status to Badge variant for consistent color coding.
 *
 * @param status - Issue status from Linear
 * @returns Badge variant for the status
 */
function getIssueStatusBadgeVariant(
  status: string | null
): 'default' | 'secondary' | 'success' | 'error' | 'warning' | 'outline' {
  if (!isIssueStatus(status)) {
    return 'outline'
  }

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
 * Issue detail page component.
 * Displays a single issue with all its attempts.
 *
 * @param props - Page props with dynamic route parameter
 * @returns Issue detail page with issue info and attempts table
 */
export default async function IssuePage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params
  const issue = await getIssueById(id)

  if (!issue) {
    notFound()
  }

  // Find the winner attempt if there is one
  const winnerAttempt = issue.winnerAttemptId
    ? issue.attempts.find((attempt) => attempt.id === issue.winnerAttemptId)
    : null

  return (
    <main className="container mx-auto p-6 md:p-8 lg:p-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Issue Details
        </h1>
        <p className="mt-2 text-lg text-foreground-secondary">
          View issue information and attempt history
        </p>
      </div>

      {/* Issue Information Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>
            <a
              href={issue.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-900 transition-colors hover:underline"
            >
              {issue.linearKey}
            </a>
          </CardTitle>
          <CardDescription>{issue.title}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <span className="text-sm font-medium text-foreground-secondary">
                Status
              </span>
              <div className="mt-1">
                <Badge variant={getIssueStatusBadgeVariant(issue.status)}>
                  {issue.status ?? 'Unknown'}
                </Badge>
              </div>
            </div>

            {issue.repo ? (
              <div>
                <span className="text-sm font-medium text-foreground-secondary">
                  Repository
                </span>
                <div className="mt-1 text-sm">{issue.repo}</div>
              </div>
            ) : null}

            <div>
              <span className="text-sm font-medium text-foreground-secondary">
                Arena Ready Labeled Date
              </span>
              <div className="mt-1 text-sm">
                {formatDate(issue.arenaReadyLabeledAt)}
              </div>
            </div>

            {winnerAttempt ? (
              <div>
                <span className="text-sm font-medium text-foreground-secondary">
                  Winner
                </span>
                <div className="mt-1 text-sm">
                  <Link
                    href={`/agents/${winnerAttempt.agentName}`}
                    className="text-blue-900 transition-colors hover:underline"
                  >
                    {winnerAttempt.agentName}
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Agents Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Agents</CardTitle>
          <CardDescription>
            All agents assigned to this issue with their current status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {issue.agents.length === 0 ? (
            <div className="py-8 text-center text-foreground-secondary">
              No agents assigned yet
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {issue.agents.map((agent) => (
                <div
                  key={agent.agentName}
                  className="bg-background-subtle flex items-center gap-2 rounded-lg border border-border px-4 py-2"
                >
                  <AgentAvatar
                    name={agent.agentName}
                    status={agent.status}
                    size="sm"
                    avatarUrl={agent.avatarUrl}
                    displayName={agent.displayName}
                  />
                  <Link
                    href={`/agents/${agent.agentName}`}
                    className="font-medium text-blue-900 transition-colors hover:underline"
                  >
                    {agent.displayName ?? agent.agentName}
                  </Link>
                  <Badge
                    variant={
                      agent.status === 'accepted'
                        ? 'success'
                        : agent.status === 'submitted'
                          ? 'warning'
                          : agent.status === 'rejected'
                            ? 'error'
                            : 'outline'
                    }
                  >
                    {agent.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attempts Card */}
      <Card>
        <CardHeader>
          <CardTitle>Attempts</CardTitle>
          <CardDescription>
            All pull request attempts for this issue
          </CardDescription>
        </CardHeader>
        <CardContent>
          {issue.attempts.length === 0 ? (
            <div className="py-8 text-center text-foreground-secondary">
              No attempts yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent Name</TableHead>
                  <TableHead>PR Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Opened Date</TableHead>
                  <TableHead>Merged Date</TableHead>
                  <TableHead className="text-right">Commit Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issue.attempts.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/agents/${attempt.agentName}`}
                        className="text-blue-900 transition-colors hover:underline"
                      >
                        {attempt.agentName}
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
          )}
        </CardContent>
      </Card>

      {/* PR Comparison Section - Milestone 1 */}
      {issue.agents.length >= 2 && (
        <div className="mt-6">
          <PRComparisonContainer
            agents={(() => {
              // Generate mock PR data for agents with attempts
              const agentsWithAttempts = issue.agents.filter((agent) =>
                issue.attempts.some(
                  (attempt) => attempt.agentName === agent.agentName
                )
              )

              if (agentsWithAttempts.length < 2) {
                return []
              }

              const mockComparison = generateMockPRComparison(
                agentsWithAttempts.map((a) => a.agentName)
              )

              return mockComparison.agents.map((agentData, index) => {
                const agent = agentsWithAttempts[index]
                if (!agent) {
                  return {
                    ...agentData,
                    displayName: null,
                    avatarUrl: null,
                  }
                }
                return {
                  ...agentData,
                  displayName: agent.displayName ?? null,
                  avatarUrl: agent.avatarUrl ?? null,
                }
              })
            })()}
          />
        </div>
      )}
    </main>
  )
}
