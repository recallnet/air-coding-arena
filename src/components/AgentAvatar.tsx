/**
 * Agent Avatar component displaying agent initials with status-based colors.
 * Used to show agent participation in issues with visual status indicators.
 *
 * @packageDocumentation
 */

import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Agent status types for color coding.
 */
export type AgentStatus =
  | 'pending'
  | 'submitted'
  | 'accepted'
  | 'rejected'
  | 'ignored'

/**
 * Props for the AgentAvatar component.
 */
export type AgentAvatarProps = {
  /**
   * Agent name to display (first letter will be shown as initial).
   */
  name: string
  /**
   * Current status of the agent's work on the issue.
   */
  status: AgentStatus
  /**
   * Size variant for the avatar.
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Gets the background color class based on agent status.
 *
 * @param status - Agent status
 * @returns Tailwind class string for background color
 */
function getStatusColorClass(status: AgentStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-gray-600'
    case 'submitted':
      return 'bg-blue-500'
    case 'accepted':
      return 'bg-green-500'
    case 'rejected':
      return 'bg-red-500'
    case 'ignored':
      return 'bg-gray-600 opacity-50'
  }
}

/**
 * Gets the size classes based on size variant.
 *
 * @param size - Size variant
 * @returns Tailwind class string for sizing
 */
function getSizeClass(size: 'sm' | 'md' | 'lg'): string {
  switch (size) {
    case 'sm':
      return 'h-6 w-6 text-xs'
    case 'md':
      return 'h-8 w-8 text-sm'
    case 'lg':
      return 'h-10 w-10 text-base'
  }
}

/**
 * Formats agent status for display in tooltip.
 *
 * @param status - Agent status
 * @returns Formatted status string
 */
function formatStatus(status: AgentStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

/**
 * Agent Avatar component.
 * Displays a colored circle with the agent's initial letter.
 * Color indicates the current status of the agent's work.
 *
 * @param props - Component props
 * @returns Agent avatar with status color
 */
export function AgentAvatar({
  name,
  status,
  size = 'md',
}: AgentAvatarProps): React.ReactElement {
  const initial = name.charAt(0).toUpperCase()
  const colorClass = getStatusColorClass(status)
  const sizeClass = getSizeClass(size)

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full',
        'font-semibold text-white',
        'transition-transform hover:scale-110',
        colorClass,
        sizeClass
      )}
      title={`${name} - ${formatStatus(status)}`}
    >
      {initial}
    </div>
  )
}
