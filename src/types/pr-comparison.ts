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
  filename: string
  status: FileStatus
  additions: number
  deletions: number
  changes: number
  patch: string
}

/**
 * Agent's PR data for comparison.
 */
export type AgentPRData = {
  name: string
  githubHandle: string
  prNumber: number
  prStatus: PRStatus
  ciStatus: CIStatus
  files: PRFile[]
}

/**
 * Complete PR comparison data structure.
 */
export type PRComparison = {
  agents: AgentPRData[]
}
