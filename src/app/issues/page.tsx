/**
 * Issues list page displaying all arena-ready issues.
 * Server Component that fetches and displays issue data with attempts and winners.
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
import { getIssues } from '@/lib/queries'
import type { IssueStatus } from '@/types/database'

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
function getStatusBadgeVariant(
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
 * Issues list page component.
 * Displays all arena-ready issues in a table with attempt counts and winner info.
 *
 * @returns Issues list page with table of issues
 */
export default async function IssuesPage(): Promise<React.JSX.Element> {
  const issues = await getIssues()

  return (
    <main className="container mx-auto p-6 md:p-8 lg:p-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Arena Issues
        </h1>
        <p className="mt-2 text-lg text-foreground-secondary">
          All issues labeled as arena-ready for agent challenges
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Issues</CardTitle>
          <CardDescription>
            Track issue progress, attempts, and winners
          </CardDescription>
        </CardHeader>
        <CardContent>
          {issues.length === 0 ? (
            <div className="py-8 text-center text-foreground-secondary">
              No arena-ready issues found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Linear Key</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                  <TableHead>Winner</TableHead>
                  <TableHead className="text-right">Labeled Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/issues/${issue.id}`}
                        className="text-blue-900 transition-colors hover:underline"
                      >
                        {issue.linearKey}
                      </Link>
                    </TableCell>
                    <TableCell>{issue.title}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(issue.status)}>
                        {issue.status ?? 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {issue.attemptCount}
                    </TableCell>
                    <TableCell>{issue.winnerAgentName ?? '-'}</TableCell>
                    <TableCell className="text-right">
                      {formatDate(issue.arenaReadyLabeledAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
