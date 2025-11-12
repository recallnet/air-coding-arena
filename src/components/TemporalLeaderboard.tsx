/**
 * Temporal leaderboard component displaying daily activity timeline.
 * Server Component that visualizes attempts, wins, and failures over time.
 *
 * @packageDocumentation
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import type { TemporalStat } from '@/lib/queries'

/**
 * Props for the TemporalLeaderboard component.
 */
export type TemporalLeaderboardProps = {
  /**
   * Array of daily statistics to display.
   */
  stats: TemporalStat[]
}

/**
 * Formats date string from YYYY-MM-DD to "Mon DD" format.
 *
 * @param dateStr - ISO date string (YYYY-MM-DD)
 * @returns Formatted date string (e.g., "Jan 15")
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Temporal leaderboard component.
 * Displays daily activity timeline with bar chart visualization.
 *
 * @param props - Component props
 * @returns Temporal leaderboard with visualization
 */
export function TemporalLeaderboard({
  stats,
}: TemporalLeaderboardProps): React.JSX.Element {
  // Reverse to show oldest to newest (left to right)
  const reversedStats = [...stats].reverse()

  // Calculate max value for scaling
  const maxValue = Math.max(
    ...reversedStats.map((stat) =>
      Math.max(stat.attempts, stat.wins, stat.failures)
    ),
    1 // Minimum of 1 to avoid division by zero
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Timeline</CardTitle>
        <CardDescription>
          Daily attempts, wins, and failures over the last 30 days
        </CardDescription>
      </CardHeader>
      <CardContent>
        {stats.length === 0 ? (
          <div className="py-8 text-center text-foreground-secondary">
            No activity data available yet
          </div>
        ) : (
          <div className="space-y-6">
            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-blue-700" />
                <span>Attempts</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-green-700" />
                <span>Wins</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-red-700" />
                <span>Failures</span>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="relative">
              <div className="flex h-64 items-end justify-between gap-1">
                {reversedStats.map((stat) => {
                  const attemptHeight = (stat.attempts / maxValue) * 100
                  const winHeight = (stat.wins / maxValue) * 100
                  const failureHeight = (stat.failures / maxValue) * 100

                  return (
                    <div
                      key={stat.date}
                      className="flex flex-1 flex-col items-center gap-2"
                    >
                      {/* Bars container */}
                      <div className="relative flex h-48 w-full items-end justify-center gap-0.5">
                        {/* Attempts bar */}
                        <div
                          className="w-1/3 rounded-t bg-blue-700 transition-all hover:bg-blue-800"
                          style={{ height: `${attemptHeight}%` }}
                          title={`Attempts: ${stat.attempts}`}
                        />
                        {/* Wins bar */}
                        <div
                          className="w-1/3 rounded-t bg-green-700 transition-all hover:bg-green-800"
                          style={{ height: `${winHeight}%` }}
                          title={`Wins: ${stat.wins}`}
                        />
                        {/* Failures bar */}
                        <div
                          className="w-1/3 rounded-t bg-red-700 transition-all hover:bg-red-800"
                          style={{ height: `${failureHeight}%` }}
                          title={`Failures: ${stat.failures}`}
                        />
                      </div>
                      {/* Date label */}
                      <div className="mt-4 origin-top-left -rotate-45 transform whitespace-nowrap text-center text-xs text-foreground-secondary">
                        {formatDate(stat.date)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4 border-t border-border pt-4">
              <div className="text-center">
                <div className="text-2xl font-semibold text-blue-900">
                  {stats.reduce((sum, stat) => sum + stat.attempts, 0)}
                </div>
                <div className="text-sm text-foreground-secondary">
                  Total Attempts
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-green-900">
                  {stats.reduce((sum, stat) => sum + stat.wins, 0)}
                </div>
                <div className="text-sm text-foreground-secondary">
                  Total Wins
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-red-900">
                  {stats.reduce((sum, stat) => sum + stat.failures, 0)}
                </div>
                <div className="text-sm text-foreground-secondary">
                  Total Failures
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
