/**
 * PR comparison column component.
 * Displays a single agent's PR data in the side-by-side comparison.
 *
 * @packageDocumentation
 */

import type { AgentPRData } from '@/types/pr-comparison'

import { CIStatusIndicator } from './CIStatusIndicator'
import { MockDiffViewer } from './MockDiffViewer'
import { PRReviewInterface } from './PRReviewInterface'
import { Badge } from './ui/Badge'

/**
 * Props for PRComparisonColumn component.
 */
type PRComparisonColumnProps = {
  agentData: AgentPRData
}

/**
 * Maps PR status to badge variant.
 *
 * @param status - The PR status
 * @returns The badge variant for the status
 */
function getPRStatusVariant(
  status: AgentPRData['prStatus']
): 'default' | 'success' | 'error' | 'warning' {
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
 * PR comparison column component.
 * Shows header with agent info, CI status, file diffs, and review interface.
 *
 * @param props - Component props
 * @returns PR comparison column UI
 */
export function PRComparisonColumn({
  agentData,
}: PRComparisonColumnProps): React.JSX.Element {
  return (
    <div className="pr-comparison-column flex flex-col">
      {/* Column Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background-secondary px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">
            {agentData.name}{' '}
            <span className="text-sm font-normal text-foreground-secondary">
              (@{agentData.githubHandle})
            </span>
          </h3>
          <Badge variant={getPRStatusVariant(agentData.prStatus)}>
            {agentData.prStatus}
          </Badge>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-foreground-secondary">
            PR #{agentData.prNumber}
          </span>
          <CIStatusIndicator status={agentData.ciStatus} />
        </div>
      </div>

      {/* File Diffs */}
      <div className="flex-1 overflow-y-auto p-4">
        {agentData.files.length === 0 ? (
          <div className="py-8 text-center text-foreground-secondary">
            No files changed
          </div>
        ) : (
          agentData.files.map((file) => (
            <MockDiffViewer key={file.filename} file={file} />
          ))
        )}
      </div>

      {/* Review Interface */}
      <div className="p-4">
        <PRReviewInterface agentGithubHandle={agentData.githubHandle} />
      </div>
    </div>
  )
}
