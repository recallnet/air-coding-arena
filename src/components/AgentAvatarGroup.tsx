/**
 * Agent Avatar Group component displaying multiple agent avatars with overlap.
 * Shows agent participation in a compact, GitHub Issues-style layout.
 *
 * @packageDocumentation
 */

import * as React from 'react'

import { AgentAvatar, type AgentStatus } from './AgentAvatar'

/**
 * Props for the AgentAvatarGroup component.
 */
export type AgentAvatarGroupProps = {
  /**
   * Array of agents to display.
   */
  agents: Array<{
    agentName: string
    status: AgentStatus
  }>
  /**
   * Maximum number of avatars to show before displaying +N indicator.
   * @default 3
   */
  maxVisible?: number
}

/**
 * Agent Avatar Group component.
 * Displays multiple agent avatars in an overlapping style (GitHub Issues layout).
 * Shows +N indicator when there are more agents than maxVisible.
 * Displays "-" when no agents are present.
 *
 * @param props - Component props
 * @returns Avatar group or empty state
 */
export function AgentAvatarGroup({
  agents,
  maxVisible = 3,
}: AgentAvatarGroupProps): React.ReactElement {
  // Handle empty state
  if (agents.length === 0) {
    return <span className="text-foreground-secondary">-</span>
  }

  const visibleAgents = agents.slice(0, maxVisible)
  const remainingCount = agents.length - maxVisible

  return (
    <div className="flex -space-x-2" role="group" aria-label="Agent avatars">
      {visibleAgents.map((agent, index) => (
        <div
          key={agent.agentName}
          style={{ zIndex: visibleAgents.length - index }}
        >
          <AgentAvatar name={agent.agentName} status={agent.status} size="sm" />
        </div>
      ))}
      {remainingCount > 0 && (
        <div
          className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-700 text-xs font-semibold text-white ring-2 ring-background"
          style={{ zIndex: 0 }}
          title={`+${remainingCount} more`}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  )
}
