/**
 * Badge component with Geist design system styling.
 * Displays a small status indicator or label with minimal, clean styling.
 * @packageDocumentation
 */

import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Badge component props.
 */
export type BadgeProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?:
    | 'default'
    | 'secondary'
    | 'success'
    | 'error'
    | 'warning'
    | 'outline'
}

/**
 * Badge component for status indicators.
 * Uses Geist's color system and minimal design aesthetic.
 *
 * @param props - Badge props with variant option
 * @returns Badge component
 */
function Badge({
  className,
  variant = 'default',
  ...props
}: BadgeProps): React.ReactElement {
  const baseClasses =
    'inline-flex items-center rounded-geist px-2 py-0.5 text-xs font-medium transition-colors'

  const variantClasses = {
    default: 'bg-gray-200 text-gray-900 border border-gray-300',
    secondary: 'bg-blue-200 text-blue-900 border border-blue-300',
    success: 'bg-green-200 text-green-900 border border-green-300',
    error: 'bg-red-200 text-red-900 border border-red-300',
    warning: 'bg-amber-200 text-amber-900 border border-amber-300',
    outline: 'bg-transparent text-gray-700 border border-gray-300',
  }

  return (
    <div
      className={cn(baseClasses, variantClasses[variant], className)}
      {...props}
    />
  )
}

export { Badge }
