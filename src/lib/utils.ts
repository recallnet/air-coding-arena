/**
 * Utility functions for Geist components.
 * @packageDocumentation
 */

/**
 * Combines multiple class names into a single string.
 * Filters out falsy values for conditional classes.
 *
 * @param classes - Class names or conditional class values
 * @returns Combined class string
 *
 * @example
 * ```typescript
 * cn('px-4 py-2', 'bg-blue-500')
 * cn('px-4', isActive && 'bg-blue-500')
 * cn('base-class', undefined, 'another-class')
 * ```
 */
export function cn(
  ...classes: Array<string | undefined | null | false>
): string {
  return classes.filter(Boolean).join(' ')
}
