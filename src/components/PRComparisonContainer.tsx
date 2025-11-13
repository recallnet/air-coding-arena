'use client'

/**
 * PR comparison container component.
 * Main container for the side-by-side PR comparison feature.
 * Manages agent selection state and renders comparison columns.
 *
 * @packageDocumentation
 */

import { useState } from 'react'

import type { AgentPRData } from '@/types/pr-comparison'

import { AgentSelector } from './AgentSelector'
import { PRComparisonColumn } from './PRComparisonColumn'
import { Badge } from './ui/Badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/Card'

/**
 * Agent data with display information.
 */
type AgentWithDisplay = AgentPRData & {
  displayName: string | null
  avatarUrl: string | null
}

/**
 * Props for PRComparisonContainer component.
 */
type PRComparisonContainerProps = {
  agents: AgentWithDisplay[]
}

/**
 * PR comparison container component.
 * Allows selecting 2 agents and viewing their PRs side-by-side.
 *
 * @param props - Component props
 * @returns PR comparison container UI
 */
export function PRComparisonContainer({
  agents,
}: PRComparisonContainerProps): React.JSX.Element {
  // Default to first 2 agents if available
  const [selectedAgents, setSelectedAgents] = useState<[string, string]>([
    agents[0]?.name ?? '',
    agents[1]?.name ?? '',
  ])

  const selectedAgentData = agents.filter((agent) =>
    selectedAgents.includes(agent.name)
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>PR Comparison</CardTitle>
            <CardDescription>
              Compare pull requests from different agents side-by-side
            </CardDescription>
          </div>
          <Badge variant="warning">Milestone 1: Mock Data</Badge>
        </div>
      </CardHeader>

      <CardContent>
        {/* Coming Soon Message */}
        <div className="mb-6 rounded-lg border border-blue-700 bg-blue-100 p-4">
          <div className="flex items-start gap-3">
            <svg
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-700"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="font-semibold text-blue-900">
                This feature is under development
              </p>
              <p className="mt-1 text-sm text-blue-800">
                Milestone 1 displays the UI with mock data. Real GitHub data and
                interactive review functionality coming in Milestones 2 & 3.
              </p>
            </div>
          </div>
        </div>

        {/* Agent Selector */}
        {agents.length >= 2 ? (
          <AgentSelector
            agents={agents.map((a) => ({
              name: a.name,
              displayName: a.displayName,
              avatarUrl: a.avatarUrl,
            }))}
            selectedAgents={selectedAgents}
            onSelectionChange={setSelectedAgents}
          />
        ) : null}

        {/* Side-by-Side Comparison */}
        {selectedAgentData.length === 2 &&
        selectedAgentData[0] &&
        selectedAgentData[1] ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PRComparisonColumn agentData={selectedAgentData[0]} />
            <PRComparisonColumn agentData={selectedAgentData[1]} />
          </div>
        ) : (
          <div className="py-8 text-center text-foreground-secondary">
            Select 2 agents to compare their pull requests
          </div>
        )}
      </CardContent>
    </Card>
  )
}
