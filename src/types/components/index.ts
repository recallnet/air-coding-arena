/**
 * React component prop type definitions.
 *
 * @packageDocumentation
 */

/**
 * Base props for all components.
 */
export type BaseProps = {
  /** Optional CSS class name */
  className?: string
  /** Optional test ID for testing */
  testId?: string
}

/**
 * Props for components with children.
 */
export type WithChildren<T = Record<string, never>> = T & {
  /** React children */
  children: React.ReactNode
}
