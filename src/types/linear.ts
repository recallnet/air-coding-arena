/**
 * Linear API type definitions
 * Based on @linear/sdk v63.4.0
 * @packageDocumentation
 */

/**
 * Linear label
 */
export type LinearLabel = {
  id: string
  name: string
  color?: string | null
  description?: string | null
}

/**
 * Linear user (assignee or creator)
 */
export type LinearUser = {
  id: string
  name: string
  email?: string | null
  displayName?: string | null
  avatarUrl?: string | null
}

/**
 * Linear project
 */
export type LinearProject = {
  id: string
  name: string
  description?: string | null
  state: string
  url?: string | null
}

/**
 * Linear cycle (sprint/iteration)
 */
export type LinearCycle = {
  id: string
  name: string
  number?: number | null
  startsAt?: string | null
  endsAt?: string | null
}

/**
 * Linear team
 */
export type LinearTeam = {
  id: string
  key: string
  name: string
}

/**
 * Linear issue state
 */
export type LinearState = {
  id: string
  name: string
  type: string
  color?: string | null
}

/**
 * Linear parent issue (for sub-issues)
 */
export type LinearParent = {
  id: string
  identifier: string
  title: string
}

/**
 * Complete Linear issue metadata
 * All fields that we want to store from Linear API
 */
export type LinearIssueMetadata = {
  id: string
  identifier: string
  title: string
  description?: string | null
  descriptionData?: string | null
  url: string
  estimate?: number | null
  priority?: number | null
  labels?: LinearLabel[] | null
  assignee?: LinearUser | null
  creator?: LinearUser | null
  project?: LinearProject | null
  cycle?: LinearCycle | null
  dueDate?: string | null
  createdAt: string
  updatedAt: string
  parent?: LinearParent | null
  team?: LinearTeam | null
  state?: LinearState | null
}

/**
 * Linear webhook Issue payload (limited fields)
 */
export type LinearWebhookIssue = {
  id: string
  identifier: string
  title: string
  url: string
  team?: { key: string }
  state?: { name: string }
  labels?: Array<{ name: string }>
}
