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
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors'

  const variantClasses = {
    default: 'bg-gray-100 text-gray-900 border border-gray-400',
    secondary: 'bg-gray-200 text-gray-1000 border border-gray-400',
    success: 'bg-green-100 text-green-1000 border border-green-300',
    error: 'bg-red-100 text-red-1000 border border-red-300',
    warning: 'bg-amber-100 text-amber-1000 border border-amber-300',
    outline: 'bg-transparent text-foreground border border-border',
  }

  return (
    <div
      className={cn(baseClasses, variantClasses[variant], className)}
      {...props}
    />
  )
}

export { Badge }
