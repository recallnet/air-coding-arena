/**
 * Utility functions for shadcn/ui components.
 * @packageDocumentation
 */

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges Tailwind CSS classes with proper precedence.
 * Combines clsx for conditional classes and tailwind-merge for deduplication.
 *
 * @param inputs - Class names or conditional class objects
 * @returns Merged class string
 *
 * @example
 * ```typescript
 * cn('px-4 py-2', 'bg-blue-500')
 * cn('px-4', isActive && 'bg-blue-500')
 * ```
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
