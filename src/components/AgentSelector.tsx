'use client'

/**
 * Agent selector component for PR comparison.
 * Allows users to select 2 agents to compare side-by-side.
 *
 * @packageDocumentation
 */

import { AgentAvatar } from './AgentAvatar'
import { Badge } from './ui/Badge'

/**
 * Agent data for selector.
 */
type AgentOption = {
  name: string
  displayName: string | null
  avatarUrl: string | null
}

/**
 * Props for AgentSelector component.
 */
type AgentSelectorProps = {
  agents: AgentOption[]
  selectedAgents: [string, string]
  // eslint-disable-next-line no-unused-vars
  onSelectionChange: (agents: [string, string]) => void
}

/**
 * Agent selector component.
 * Displays agent chips with ability to toggle selection.
 * Enforces exactly 2 agents selected at a time.
 *
 * @param props - Component props
 * @param props.agents - Array of agent options to display
 * @param props.selectedAgents - Currently selected agent names
 * @param props.onSelectionChange - Callback when selection changes
 * @returns Agent selector UI
 */
export function AgentSelector({
  agents,
  selectedAgents,
  onSelectionChange,
}: AgentSelectorProps): React.JSX.Element {
  const handleToggle = (agentName: string): void => {
    const isSelected = selectedAgents.includes(agentName)

    if (isSelected) {
      // Can't deselect if only 2 selected (would break comparison)
      return
    }

    // Replace first selected agent with newly selected one
    onSelectionChange([selectedAgents[1], agentName])
  }

  return (
    <div className="agent-selector mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          Compare PRs (select 2):
        </h3>
        <Badge variant="outline">Milestone 1: Mock Data Only</Badge>
      </div>

      <div className="flex flex-wrap gap-3">
        {agents.map((agent) => {
          const isSelected = selectedAgents.includes(agent.name)
          const isDisabled = !isSelected && selectedAgents.length >= 2

          return (
            <button
              key={agent.name}
              onClick={() => handleToggle(agent.name)}
              disabled={isDisabled}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 transition-all ${
                isSelected
                  ? 'selected border-blue-700 bg-blue-100'
                  : 'border-border bg-background hover:border-border-hover'
              } ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} `}
            >
              <AgentAvatar
                name={agent.name}
                status="submitted"
                size="sm"
                avatarUrl={agent.avatarUrl}
                displayName={agent.displayName}
              />
              <span className="font-medium">
                {agent.displayName ?? agent.name}
              </span>
              {isSelected ? (
                <svg
                  className="h-4 w-4 text-blue-700"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
