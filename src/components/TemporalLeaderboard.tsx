/**
 * Temporal leaderboard component displaying cumulative activity per agent.
 * Server Component that visualizes cumulative attempts, wins, and failures per agent over time.
 *
 * @packageDocumentation
 */

import { AgentAvatar } from '@/components/AgentAvatar'
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
 * Exported for testing.
 *
 * @param stats - Array of agent temporal stats
 * @returns Object with dates as keys and agent data as values
 */
export function groupStatsByDate(
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
            Agent ratings (left axis) and cumulative attempts, wins, failures
            (right axis) over the last 30 days
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
  // Filter to only include agents with at least one rating > 0
  const allAgents = Array.from(new Set(stats.map((s) => s.agentName)))
  const agents = allAgents
    .filter((agent) =>
      stats.some((s) => s.agentName === agent && s.ordinal > 0)
    )
    .sort()

  // Get unique dates in chronological order (oldest to newest)
  const dates = Array.from(new Set(stats.map((s) => s.date))).sort()

  // Group stats for easier lookup
  const groupedStats = groupStatsByDate(stats)

  // Get agent metadata (avatarUrl, displayName) from first occurrence
  const agentMetadata = new Map<
    string,
    {
      avatarUrl?: string | null | undefined
      displayName?: string | null | undefined
    }
  >()
  for (const stat of stats) {
    if (!agentMetadata.has(stat.agentName)) {
      agentMetadata.set(stat.agentName, {
        avatarUrl: stat.avatarUrl,
        displayName: stat.displayName,
      })
    }
  }

  // Calculate separate max values for dual Y-axis
  // For ratings: use dynamic range based on actual data with ±50 padding
  const ratingsWithData = stats
    .filter((s) => s.ordinal > 0)
    .map((s) => s.ordinal)
  const RATING_PADDING = 10
  const ratingRangeMin =
    ratingsWithData.length > 0
      ? Math.min(...ratingsWithData) - RATING_PADDING
      : 1450 // fallback: 1500 - 50
  const ratingRangeMax =
    ratingsWithData.length > 0
      ? Math.max(...ratingsWithData) + RATING_PADDING
      : 1550 // fallback: 1500 + 50
  const ratingRange = ratingRangeMax - ratingRangeMin

  const maxCount = Math.max(
    ...stats.map((s) =>
      Math.max(s.cumulativeAttempts, s.cumulativeWins, s.cumulativeFailures)
    ),
    1
  )

  // Chart dimensions
  const chartWidth = 800
  const chartHeight = 300
  const padding = { top: 20, right: 60, bottom: 40, left: 60 }
  const innerWidth = chartWidth - padding.left - padding.right
  const innerHeight = chartHeight - padding.top - padding.bottom

  // Scale functions - dual Y-axis
  const xScale = (index: number): number =>
    dates.length > 1
      ? (index / (dates.length - 1)) * innerWidth
      : innerWidth / 2
  // Rating scale: zoom into actual data range (minRating to maxRating)
  const yScaleRating = (value: number): number =>
    innerHeight - ((value - ratingRangeMin) / ratingRange) * innerHeight
  const yScaleCount = (value: number): number =>
    innerHeight - (value / maxCount) * innerHeight

  // Extract metric value from stat
  const getMetricValue = (
    stat: AgentTemporalStat | undefined,
    metric: 'attempts' | 'wins' | 'failures' | 'ordinal'
  ): number => {
    if (!stat) return 0
    if (metric === 'attempts') return stat.cumulativeAttempts
    if (metric === 'wins') return stat.cumulativeWins
    if (metric === 'failures') return stat.cumulativeFailures
    return stat.ordinal
  }

  // Check if we need to add a synthetic 1500 starting point for rating
  const needsSyntheticStart = (
    agentName: string,
    currentValue: number,
    index: number
  ): boolean => {
    if (currentValue === 0 || index === 0) return false
    const prevDate = dates[index - 1]
    if (!prevDate) return false
    const prevStat = groupedStats[prevDate]?.[agentName]
    const prevValue = prevStat?.ordinal ?? 0
    return prevValue === 0
  }

  // Generate line path for a metric
  const generateLinePath = (
    agentName: string,
    metric: 'attempts' | 'wins' | 'failures' | 'ordinal'
  ): string => {
    const points: string[] = []

    for (const [index, date] of dates.entries()) {
      const stat = groupedStats[date]?.[agentName]
      const value = getMetricValue(stat, metric)

      // For ordinal (rating), skip dates where agent has no rating
      if (metric === 'ordinal' && value === 0) {
        continue
      }

      // For ordinal (rating), add synthetic starting point at 1500 when agent first gets rated
      if (
        metric === 'ordinal' &&
        needsSyntheticStart(agentName, value, index)
      ) {
        const syntheticY = yScaleRating(1500)
        points.push(`${xScale(index - 1)},${syntheticY}`)
      }

      // Use appropriate Y-scale: rating scale for ordinal, count scale for others
      const yValue =
        metric === 'ordinal' ? yScaleRating(value) : yScaleCount(value)
      points.push(`${xScale(index)},${yValue}`)
    }

    return `M ${points.join(' L ')}`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Timeline</CardTitle>
        <CardDescription>
          Agent ratings (left axis) and cumulative attempts, wins, failures
          (right axis) over the last 30 days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-6">
            {agents.map((agent, index) => {
              const colors = getAgentColors(index)
              const metadata = agentMetadata.get(agent)
              return (
                <div key={agent} className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <AgentAvatar
                      name={agent}
                      status="accepted"
                      size="sm"
                      avatarUrl={metadata?.avatarUrl}
                      displayName={metadata?.displayName}
                    />
                    <span className="text-sm font-semibold">
                      {metadata?.displayName ?? agent}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm text-foreground-secondary">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: colors.base }}
                    />
                    <span className="font-semibold">Rating</span>
                    <span className="text-border">|</span>
                    <span className="font-medium">Attempts</span>
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: colors.wins }}
                    />
                    <span className="font-medium">Wins</span>
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: colors.failures }}
                    />
                    <span className="font-medium">Failures</span>
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
                {/* Grid lines (using rating scale for positioning) */}
                <g className="text-border">
                  {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
                    const ratingValue = ratingRangeMin + ratingRange * fraction
                    const y = padding.top + yScaleRating(ratingValue)
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

                {/* Left Y-axis labels (Rating) */}
                <g className="text-foreground-secondary">
                  {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
                    const value = Math.round(
                      ratingRangeMin + ratingRange * fraction
                    )
                    const y = padding.top + yScaleRating(value)
                    return (
                      <text
                        key={fraction}
                        x={padding.left - 12}
                        y={y}
                        textAnchor="end"
                        dominantBaseline="middle"
                        fill="currentColor"
                        fontSize="13"
                        fontWeight="500"
                      >
                        {value}
                      </text>
                    )
                  })}
                  {/* Left axis label */}
                  <text
                    x={15}
                    y={chartHeight / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="currentColor"
                    transform={`rotate(-90, 15, ${chartHeight / 2})`}
                    fontSize="13"
                    fontWeight="600"
                  >
                    Rating
                  </text>
                </g>

                {/* Right Y-axis labels (Count) */}
                <g className="text-foreground-secondary">
                  {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
                    const value = Math.round(maxCount * fraction)
                    const y = padding.top + yScaleCount(value)
                    return (
                      <text
                        key={`count-${fraction}`}
                        x={chartWidth - padding.right + 12}
                        y={y}
                        textAnchor="start"
                        dominantBaseline="middle"
                        fill="currentColor"
                        fontSize="13"
                        fontWeight="500"
                      >
                        {value}
                      </text>
                    )
                  })}
                  {/* Right axis label */}
                  <text
                    x={chartWidth - 15}
                    y={chartHeight / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="currentColor"
                    transform={`rotate(90, ${chartWidth - 15}, ${chartHeight / 2})`}
                    fontSize="13"
                    fontWeight="600"
                  >
                    Count
                  </text>
                </g>

                {/* X-axis labels (show every 5th date) */}
                <g className="text-foreground-secondary">
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
                          y={chartHeight - padding.bottom + 24}
                          textAnchor="middle"
                          fill="currentColor"
                          fontSize="12"
                          fontWeight="500"
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
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeDasharray="4 3"
                          opacity="0.5"
                        />
                        {/* Wins line */}
                        <path
                          d={generateLinePath(agent, 'wins')}
                          fill="none"
                          stroke={colors.wins}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeDasharray="4 3"
                          opacity="0.5"
                        />
                        {/* Failures line */}
                        <path
                          d={generateLinePath(agent, 'failures')}
                          fill="none"
                          stroke={colors.failures}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeDasharray="4 3"
                          opacity="0.5"
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
