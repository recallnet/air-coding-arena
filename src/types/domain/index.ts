/**
 * Business domain model type definitions.
 *
 * @packageDocumentation
 */

/**
 * Example user entity.
 */
export type User = {
  /** Unique user identifier */
  id: string
  /** User's display name */
  name: string
  /** User's email address */
  email: string
  /** Account creation timestamp */
  createdAt: Date
}
