/**
 * Linear API type definitions
 * Based on @linear/sdk v63.4.0
 * @packageDocumentation
 */

/**
 * Linear label
 */
export type LinearLabel = {
  /** The unique identifier for this label in Linear */
  id: string
  /** The display name of the label */
  name: string
  /** The hex color code for the label (e.g., '#FF0000') */
  color?: string | null
  /** Optional description text for the label */
  description?: string | null
}

/**
 * Linear user (assignee or creator)
 */
export type LinearUser = {
  /** The unique identifier for this user in Linear */
  id: string
  /** The user's full name */
  name: string
  /** The user's email address */
  email?: string | null
  /** The user's preferred display name */
  displayName?: string | null
  /** URL to the user's avatar image */
  avatarUrl?: string | null
}

/**
 * Linear project
 */
export type LinearProject = {
  /** The unique identifier for this project in Linear */
  id: string
  /** The name of the project */
  name: string
  /** Optional project description */
  description?: string | null
  /** The current state of the project (e.g., 'planned', 'started', 'completed') */
  state: string
  /** URL to view the project in Linear */
  url?: string | null
}

/**
 * Linear cycle (sprint/iteration)
 */
export type LinearCycle = {
  /** The unique identifier for this cycle in Linear */
  id: string
  /** The name of the cycle */
  name: string
  /** The sequential cycle number */
  number?: number | null
  /** ISO 8601 timestamp when the cycle starts */
  startsAt?: string | null
  /** ISO 8601 timestamp when the cycle ends */
  endsAt?: string | null
}

/**
 * Linear team
 */
export type LinearTeam = {
  /** The unique identifier for this team in Linear */
  id: string
  /** The short team key used in issue identifiers (e.g., 'ENG' in 'ENG-123') */
  key: string
  /** The full name of the team */
  name: string
}

/**
 * Linear issue state
 */
export type LinearState = {
  /** The unique identifier for this state in Linear */
  id: string
  /** The display name of the state (e.g., 'In Progress', 'Done') */
  name: string
  /** The state type category (e.g., 'started', 'completed', 'canceled') */
  type: string
  /** The hex color code for the state */
  color?: string | null
}

/**
 * Linear parent issue (for sub-issues)
 */
export type LinearParent = {
  /** The unique identifier for the parent issue in Linear */
  id: string
  /** The human-readable identifier for the parent issue (e.g., 'ENG-123') */
  identifier: string
  /** The title of the parent issue */
  title: string
}

/**
 * Complete Linear issue metadata
 * All fields that we want to store from Linear API
 */
export type LinearIssueMetadata = {
  /** The unique identifier for this issue in Linear */
  id: string
  /** The human-readable identifier for the issue (e.g., 'ENG-123') */
  identifier: string
  /** The title of the issue */
  title: string
  /** The issue description in plain text or markdown */
  description?: string | null
  /** The issue description in Linear's structured data format */
  descriptionData?: string | null
  /** URL to view the issue in Linear */
  url: string
  /** Estimated story points or time for the issue */
  estimate?: number | null
  /** Priority level (0=No priority, 1=Urgent, 2=High, 3=Normal, 4=Low) */
  priority?: number | null
  /** Labels attached to the issue */
  labels?: LinearLabel[] | null
  /** The user assigned to work on the issue */
  assignee?: LinearUser | null
  /** The user who created the issue */
  creator?: LinearUser | null
  /** The project this issue belongs to */
  project?: LinearProject | null
  /** The cycle/sprint this issue is scheduled in */
  cycle?: LinearCycle | null
  /** ISO 8601 timestamp when the issue is due */
  dueDate?: string | null
  /** ISO 8601 timestamp when the issue was created */
  createdAt: string
  /** ISO 8601 timestamp when the issue was last updated */
  updatedAt: string
  /** The parent issue if this is a sub-issue */
  parent?: LinearParent | null
  /** The team that owns this issue */
  team?: LinearTeam | null
  /** The current state of the issue */
  state?: LinearState | null
}

/**
 * Linear webhook Issue payload (limited fields)
 */
export type LinearWebhookIssue = {
  /** The unique identifier for this issue in Linear */
  id: string
  /** The human-readable identifier for the issue (e.g., 'ENG-123') */
  identifier: string
  /** The title of the issue */
  title: string
  /** URL to view the issue in Linear */
  url: string
  /** The team that owns this issue */
  team?: {
    /** The short team key used in issue identifiers */
    key: string
  }
  /** The current state of the issue */
  state?: {
    /** The display name of the state */
    name: string
  }
  /** Labels attached to the issue */
  labels?: Array<{
    /** The display name of the label */
    name: string
  }>
}
