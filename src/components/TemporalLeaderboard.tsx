/**
 * Temporal leaderboard component displaying cumulative activity per agent.
 * Server Component that visualizes cumulative attempts, wins, and failures per agent over time.
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
import type { AgentTemporalStat } from '@/lib/queries'

/**
 * Props for the TemporalLeaderboard component.
 */
export type TemporalLeaderboardProps = {
  /**
   * Array of daily cumulative statistics per agent to display.
   */
  stats: AgentTemporalStat[]
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
 * Color scheme for an agent.
 */
type AgentColorScheme = {
  name: string
  base: string
  attempts: string
  wins: string
  failures: string
}

/**
 * Agent color palette - dynamically assigns colors to agents.
 */
const AGENT_COLORS: AgentColorScheme[] = [
  {
    name: 'blue',
    base: '#3b82f6',
    attempts: '#3b82f6',
    wins: '#60a5fa',
    failures: '#93c5fd',
  },
  {
    name: 'green',
    base: '#10b981',
    attempts: '#10b981',
    wins: '#34d399',
    failures: '#6ee7b7',
  },
  {
    name: 'purple',
    base: '#8b5cf6',
    attempts: '#8b5cf6',
    wins: '#a78bfa',
    failures: '#c4b5fd',
  },
  {
    name: 'orange',
    base: '#f97316',
    attempts: '#f97316',
    wins: '#fb923c',
    failures: '#fdba74',
  },
  {
    name: 'pink',
    base: '#ec4899',
    attempts: '#ec4899',
    wins: '#f472b6',
    failures: '#f9a8d4',
  },
  {
    name: 'cyan',
    base: '#06b6d4',
    attempts: '#06b6d4',
    wins: '#22d3ee',
    failures: '#67e8f9',
  },
]

/**
 * Gets color scheme for an agent.
 *
 * @param agentIndex - Index of the agent in the agent list
 * @returns Color scheme object with base, attempts, wins, and failures colors
 */
function getAgentColors(agentIndex: number): AgentColorScheme {
  const colorScheme = AGENT_COLORS[agentIndex % AGENT_COLORS.length]
  if (!colorScheme) {
    const defaultColors: AgentColorScheme = {
      name: 'blue',
      base: '#3b82f6',
      attempts: '#3b82f6',
      wins: '#60a5fa',
      failures: '#93c5fd',
    }
    return defaultColors
  }
  return colorScheme
}

/**
 * Groups stats by date and organizes by agent.
 *
 * @param stats - Array of agent temporal stats
 * @returns Object with dates as keys and agent data as values
 */
function groupStatsByDate(
  stats: AgentTemporalStat[]
): Record<string, Record<string, AgentTemporalStat>> {
  const grouped: Record<string, Record<string, AgentTemporalStat>> = {}

  for (const stat of stats) {
    grouped[stat.date] ??= {}
    const dateGroup = grouped[stat.date]
    if (dateGroup !== undefined) {
      dateGroup[stat.agentName] = stat
    }
  }

  return grouped
}

/**
 * Temporal leaderboard component.
 * Displays cumulative activity timeline with line chart visualization per agent.
 *
 * @param props - Component props
 * @returns Temporal leaderboard with cumulative line chart visualization
 */
export function TemporalLeaderboard({
  stats,
}: TemporalLeaderboardProps): React.JSX.Element {
  if (stats.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>
            Cumulative attempts, wins, and failures per agent over the last 30
            days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-foreground-secondary">
            No activity data available yet
          </div>
        </CardContent>
      </Card>
    )
  }

  // Get unique agents and sort alphabetically for consistent ordering
  const agents = Array.from(new Set(stats.map((s) => s.agentName))).sort()

  // Get unique dates in chronological order (oldest to newest)
  const dates = Array.from(new Set(stats.map((s) => s.date))).sort()

  // Group stats for easier lookup
  const groupedStats = groupStatsByDate(stats)

  // Calculate max value for Y-axis scaling
  const maxValue = Math.max(
    ...stats.map((s) =>
      Math.max(
        s.cumulativeAttempts,
        s.cumulativeWins,
        s.cumulativeFailures,
        s.ordinal
      )
    ),
    1
  )

  // Chart dimensions
  const chartWidth = 800
  const chartHeight = 300
  const padding = { top: 20, right: 20, bottom: 40, left: 50 }
  const innerWidth = chartWidth - padding.left - padding.right
  const innerHeight = chartHeight - padding.top - padding.bottom

  // Scale functions
  const xScale = (index: number): number =>
    (index / (dates.length - 1)) * innerWidth
  const yScale = (value: number): number =>
    innerHeight - (value / maxValue) * innerHeight

  // Generate line path for a metric
  const generateLinePath = (
    agentName: string,
    metric: 'attempts' | 'wins' | 'failures' | 'ordinal'
  ): string => {
    const points = dates.map((date, index) => {
      const stat = groupedStats[date]?.[agentName]
      const value = stat
        ? metric === 'attempts'
          ? stat.cumulativeAttempts
          : metric === 'wins'
            ? stat.cumulativeWins
            : metric === 'failures'
              ? stat.cumulativeFailures
              : stat.ordinal
        : 0
      return `${xScale(index)},${yScale(value)}`
    })
    return `M ${points.join(' L ')}`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Timeline</CardTitle>
        <CardDescription>
          Cumulative attempts, wins, and failures per agent over the last 30
          days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            {agents.map((agent, index) => {
              const colors = getAgentColors(index)
              return (
                <div key={agent} className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="h-3 w-3 rounded"
                      style={{ backgroundColor: colors.attempts }}
                    />
                    <span className="font-medium">{agent}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-foreground-secondary">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: colors.base }}
                    />
                    <span className="font-semibold">Rating</span>
                    <span>|</span>
                    <span>Attempts</span>
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: colors.wins }}
                    />
                    <span>Wins</span>
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: colors.failures }}
                    />
                    <span>Failures</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Chart Container with max-width to prevent overflow */}
          <div className="w-full overflow-x-auto">
            <div className="min-w-full">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full"
                style={{ maxWidth: '100%', height: 'auto' }}
              >
                {/* Grid lines */}
                <g className="text-border">
                  {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
                    const y = padding.top + yScale(maxValue * fraction)
                    return (
                      <line
                        key={fraction}
                        x1={padding.left}
                        y1={y}
                        x2={chartWidth - padding.right}
                        y2={y}
                        stroke="currentColor"
                        strokeWidth="1"
                        opacity="0.2"
                      />
                    )
                  })}
                </g>

                {/* Y-axis labels */}
                <g className="text-xs text-foreground-secondary">
                  {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
                    const value = Math.round(maxValue * fraction)
                    const y = padding.top + yScale(value)
                    return (
                      <text
                        key={fraction}
                        x={padding.left - 10}
                        y={y}
                        textAnchor="end"
                        dominantBaseline="middle"
                        fill="currentColor"
                      >
                        {value}
                      </text>
                    )
                  })}
                </g>

                {/* X-axis labels (show every 5th date) */}
                <g className="text-xs text-foreground-secondary">
                  {dates
                    .filter(
                      (_, index) =>
                        index % 5 === 0 || index === dates.length - 1
                    )
                    .map((date) => {
                      const actualIndex = dates.indexOf(date)
                      const x = padding.left + xScale(actualIndex)
                      return (
                        <text
                          key={date}
                          x={x}
                          y={chartHeight - padding.bottom + 20}
                          textAnchor="middle"
                          fill="currentColor"
                        >
                          {formatDate(date)}
                        </text>
                      )
                    })}
                </g>

                {/* Lines for each agent and metric */}
                <g transform={`translate(${padding.left}, ${padding.top})`}>
                  {agents.map((agent, agentIndex) => {
                    const colors = getAgentColors(agentIndex)
                    return (
                      <g key={agent}>
                        {/* Ordinal line (primary metric, thicker and prominent) */}
                        <path
                          d={generateLinePath(agent, 'ordinal')}
                          fill="none"
                          stroke={colors.base}
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity="0.9"
                        />
                        {/* Attempts line */}
                        <path
                          d={generateLinePath(agent, 'attempts')}
                          fill="none"
                          stroke={colors.attempts}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {/* Wins line */}
                        <path
                          d={generateLinePath(agent, 'wins')}
                          fill="none"
                          stroke={colors.wins}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {/* Failures line */}
                        <path
                          d={generateLinePath(agent, 'failures')}
                          fill="none"
                          stroke={colors.failures}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </g>
                    )
                  })}
                </g>
              </svg>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
