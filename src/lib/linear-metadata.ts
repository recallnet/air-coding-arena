/**
 * Linear issue metadata extraction utilities
 * @packageDocumentation
 */

/**
 * Linear SDK Issue type (simplified for our extraction needs)
 */
export type LinearIssue = {
  /** Unique Linear issue ID */
  id: string
  /** Human-readable issue identifier (e.g., 'CA-123') */
  identifier: string
  /** Issue title */
  title: string
  /** Issue description in plain text */
  description?: string | null
  /** Issue description in markdown format (ProseMirror JSON) */
  descriptionData?: string | null
  /** Direct URL to view issue in Linear */
  url: string
  /** Estimated complexity or story points */
  estimate?: number | null
  /** Priority level (0=None, 1=Urgent, 2=High, 3=Normal, 4=Low) */
  priority?: number | null
  /** Array of labels attached to this issue */
  labels?: Array<{
    /** Label unique ID */
    id: string
    /** Label display name */
    name: string
    /** Label hex color code (e.g., '#FF5733') */
    color?: string | null
    /** Label description text */
    description?: string | null
  }> | null
  /** User assigned to this issue */
  assignee?: {
    /** Assignee Linear user ID */
    id: string
    /** Assignee display name */
    name: string
    /** Assignee email address */
    email?: string | null
  } | null
  /** User who created this issue */
  creator?: {
    /** Creator Linear user ID */
    id: string
    /** Creator display name */
    name: string
    /** Creator email address */
    email?: string | null
  } | null
  /** Project this issue belongs to */
  project?: {
    /** Project unique ID */
    id: string
    /** Project display name */
    name: string
  } | null
  /** Cycle/sprint this issue is part of */
  cycle?: {
    /** Cycle unique ID */
    id: string
    /** Cycle display name */
    name: string
    /** Cycle sequential number */
    number?: number | null
  } | null
  /** ISO 8601 date string for issue due date */
  dueDate?: string | null
  /** ISO 8601 timestamp when issue was created in Linear */
  createdAt: string
  /** ISO 8601 timestamp when issue was last updated in Linear */
  updatedAt: string
  /** Parent issue if this is a sub-issue */
  parent?: {
    /** Parent issue unique ID */
    id: string
    /** Parent issue identifier (e.g., 'CA-100') */
    identifier: string
  } | null
  /** Team this issue belongs to */
  team?: {
    /** Team unique ID */
    id: string
    /** Team key prefix used in issue identifiers (e.g., 'CA') */
    key: string
    /** Team display name */
    name: string
  } | null
  /** Current workflow state of the issue */
  state?: {
    /** State unique ID */
    id: string
    /** State display name (e.g., 'Done', 'In Progress') */
    name: string
    /** State type (e.g., 'completed', 'started', 'unstarted') */
    type: string
  } | null
}

/**
 * Database-compatible issue metadata extracted from Linear
 */
export type IssueMetadata = {
  /** Unique Linear issue ID */
  linearId: string
  /** Human-readable Linear issue identifier (e.g., 'CA-123') */
  linearKey: string
  /** Issue title */
  title: string
  /** Direct URL to view issue in Linear */
  url: string
  /** GitHub repository key derived from Linear team (e.g., 'CA') */
  repo?: string
  /** Current Linear workflow state name (e.g., 'Done', 'In Progress') */
  status?: string
  /** Issue description in plain text */
  description?: string
  /** Issue description in markdown format (ProseMirror JSON string) */
  descriptionMarkdown?: string
  /** Estimated complexity or story points */
  estimate?: number
  /** Priority level (0=None, 1=Urgent, 2=High, 3=Normal, 4=Low) */
  priority?: number
  /** Array of labels with full metadata as JSON */
  labelsJson?: Array<{
    /** Label unique ID */
    id: string
    /** Label display name */
    name: string
    /** Label hex color code (e.g., '#FF5733') */
    color?: string | null
    /** Label description text */
    description?: string | null
  }>
  /** Linear user ID of assignee */
  assigneeId?: string
  /** Display name of assignee */
  assigneeName?: string
  /** Email address of assignee */
  assigneeEmail?: string
  /** Linear user ID of issue creator */
  creatorId?: string
  /** Display name of issue creator */
  creatorName?: string
  /** Email address of issue creator */
  creatorEmail?: string
  /** Linear project ID */
  projectId?: string
  /** Project display name */
  projectName?: string
  /** Linear cycle/sprint ID */
  cycleId?: string
  /** Cycle/sprint display name */
  cycleName?: string
  /** Cycle sequential number */
  cycleNumber?: number
  /** Due date as Date object */
  dueDate?: Date
  /** When issue was created in Linear */
  linearCreatedAt: Date
  /** When issue was last updated in Linear */
  linearUpdatedAt: Date
  /** Linear ID of parent issue (for sub-issues) */
  parentId?: string
}

/**
 * Extracts issue metadata from Linear SDK Issue object
 * Converts to database-compatible format
 *
 * @param issue - Issue object from @linear/sdk
 * @returns Database-compatible metadata object
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export function extractIssueMetadata(issue: LinearIssue): IssueMetadata {
  // Core fields (always present)
  const metadata: IssueMetadata = {
    linearId: issue.id,
    linearKey: issue.identifier,
    title: issue.title,
    url: issue.url,
    linearCreatedAt: new Date(issue.createdAt),
    linearUpdatedAt: new Date(issue.updatedAt),
  }

  // Optional: team (repo)
  if (issue.team?.key) {
    metadata.repo = issue.team.key
  }

  // Optional: state (status)
  if (issue.state?.name) {
    metadata.status = issue.state.name
  }

  // Optional: description
  if (issue.description) {
    metadata.description = issue.description
  }

  // Optional: description markdown data
  if (issue.descriptionData) {
    metadata.descriptionMarkdown = issue.descriptionData
  }

  // Optional: estimate
  if (typeof issue.estimate === 'number') {
    metadata.estimate = issue.estimate
  }

  // Optional: priority
  if (typeof issue.priority === 'number') {
    metadata.priority = issue.priority
  }

  // Optional: labels (store as JSONB with full metadata)
  if (issue.labels && Array.isArray(issue.labels)) {
    metadata.labelsJson = issue.labels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color ?? null,
      description: label.description ?? null,
    }))
  }

  // Optional: assignee
  if (issue.assignee) {
    metadata.assigneeId = issue.assignee.id
    metadata.assigneeName = issue.assignee.name
    if (issue.assignee.email) {
      metadata.assigneeEmail = issue.assignee.email
    }
  }

  // Optional: creator
  if (issue.creator) {
    metadata.creatorId = issue.creator.id
    metadata.creatorName = issue.creator.name
    if (issue.creator.email) {
      metadata.creatorEmail = issue.creator.email
    }
  }

  // Optional: project
  if (issue.project) {
    metadata.projectId = issue.project.id
    metadata.projectName = issue.project.name
  }

  // Optional: cycle
  if (issue.cycle) {
    metadata.cycleId = issue.cycle.id
    metadata.cycleName = issue.cycle.name
    if (typeof issue.cycle.number === 'number') {
      metadata.cycleNumber = issue.cycle.number
    }
  }

  // Optional: due date
  if (issue.dueDate) {
    metadata.dueDate = new Date(issue.dueDate)
  }

  // Optional: parent (epic/sub-issue relationship)
  if (issue.parent?.id) {
    metadata.parentId = issue.parent.id
  }

  return metadata
}
