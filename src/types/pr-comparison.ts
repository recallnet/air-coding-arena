/**
 * PR comparison types for Milestone 1 mock data.
 *
 * @packageDocumentation
 */

/**
 * CI check status for a PR.
 */
export type CIStatus = 'passing' | 'failing' | 'pending' | 'none'

/**
 * File status in a PR.
 */
export type FileStatus = 'modified' | 'added' | 'removed' | 'renamed'

/**
 * PR status.
 */
export type PRStatus = 'open' | 'merged' | 'closed'

/**
 * Single file change in a PR.
 */
export type PRFile = {
  /** The path to the file relative to repository root */
  filename: string
  /** The type of change made to the file */
  status: FileStatus
  /** Number of lines added to the file */
  additions: number
  /** Number of lines deleted from the file */
  deletions: number
  /** Total number of lines changed (additions + deletions) */
  changes: number
  /** The unified diff patch content for this file */
  patch: string
}

/**
 * Agent's PR data for comparison.
 */
export type AgentPRData = {
  /** The display name of the agent */
  name: string
  /** The agent's GitHub username */
  githubHandle: string
  /** The pull request number */
  prNumber: number
  /** The current status of the pull request */
  prStatus: PRStatus
  /** The status of CI checks for this PR */
  ciStatus: CIStatus
  /** List of files changed in this PR */
  files: PRFile[]
}

/**
 * Complete PR comparison data structure.
 */
export type PRComparison = {
  /** Array of agent PR data for side-by-side comparison */
  agents: AgentPRData[]
}
