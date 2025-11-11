/**
 * Dashboard home page displaying agent leaderboard.
 * Server Component that fetches and displays agent performance statistics.
 *
 * @packageDocumentation
 */

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
import { getAgentStats } from '@/lib/queries'
import type { AgentStats } from '@/types/database'

/**
 * Dashboard home page component.
 * Displays agent leaderboard with performance metrics.
 *
 * @returns Dashboard home page with agent leaderboard
 */
export default async function Home(): Promise<React.JSX.Element> {
  const agentStats = await getAgentStats()

  // Find the top performer (highest acceptance rate)
  const topPerformer =
    agentStats.length > 0
      ? agentStats.reduce((top: AgentStats, current: AgentStats) =>
          current.acceptancePct > top.acceptancePct ? current : top
        )
      : null

  return (
    <main className="container mx-auto p-6 md:p-8 lg:p-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Arena Dashboard</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Track and compare AI coding agent performance across challenges
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agent Leaderboard</CardTitle>
          <CardDescription>
            Performance rankings based on merged pull requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agentStats.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No agent statistics available yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent Name</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                  <TableHead className="text-right">Wins</TableHead>
                  <TableHead className="text-right">Acceptance Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentStats.map((stat: AgentStats) => (
                  <TableRow key={stat.agentName}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {stat.agentName}
                        {topPerformer !== null &&
                          stat.agentName === topPerformer.agentName && (
                            <Badge variant="default">Top Performer</Badge>
                          )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {stat.attempts}
                    </TableCell>
                    <TableCell className="text-right">{stat.wins}</TableCell>
                    <TableCell className="text-right">
                      {stat.acceptancePct.toFixed(1)}%
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
