/**
 * PR review interface component.
 * Displays comment textarea and approve/request changes buttons.
 * Milestone 1: All controls are disabled with "Coming Soon" messaging.
 *
 * @packageDocumentation
 */

import { Badge } from './ui/Badge'
import { Button } from './ui/Button'

/**
 * Props for PRReviewInterface component.
 */
type PRReviewInterfaceProps = {
  agentGithubHandle: string
}

/**
 * PR review interface component.
 * Shows review UI in disabled state for Milestone 1.
 *
 * @param props - Component props
 * @returns PR review interface UI
 */
export function PRReviewInterface({
  agentGithubHandle,
}: PRReviewInterfaceProps): React.JSX.Element {
  return (
    <div className="sticky bottom-4 rounded-lg border border-border bg-background p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">
          Review for @{agentGithubHandle}
        </h4>
        <Badge variant="warning">Coming in Milestone 3</Badge>
      </div>

      <textarea
        placeholder={`@${agentGithubHandle}`}
        disabled
        className="mb-3 w-full resize-none rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm text-foreground opacity-50"
        rows={3}
      />

      <div className="mb-3 flex gap-2">
        <Button variant="primary" disabled className="flex-1">
          Approve
        </Button>
        <Button variant="secondary" disabled className="flex-1">
          Request Changes
        </Button>
      </div>

      <div className="flex items-center justify-center gap-2 text-sm text-foreground-secondary">
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <span>Sign in with GitHub to submit reviews</span>
      </div>
    </div>
  )
}
