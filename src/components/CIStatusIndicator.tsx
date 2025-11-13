/**
 * CI status indicator component.
 * Displays CI check status with colored dot indicator.
 *
 * @packageDocumentation
 */

import type { CIStatus } from '@/types/pr-comparison'

/**
 * Props for CIStatusIndicator component.
 */
type CIStatusIndicatorProps = {
  status: CIStatus
}

/**
 * Maps CI status to display text.
 * @param status - The CI status
 * @returns Display text for the status
 */
function getStatusText(status: CIStatus): string {
  switch (status) {
    case 'passing':
      return 'Passing'
    case 'failing':
      return 'Failing'
    case 'pending':
      return 'Pending'
    case 'none':
      return 'No Checks'
  }
}

/**
 * Maps CI status to dot color class.
 * @param status - The CI status
 * @returns Tailwind CSS class for dot color
 */
function getStatusColor(status: CIStatus): string {
  switch (status) {
    case 'passing':
      return 'bg-green-700'
    case 'failing':
      return 'bg-red-700'
    case 'pending':
      return 'bg-amber-700'
    case 'none':
      return 'bg-gray-400'
  }
}

/**
 * CI status indicator component.
 * Shows colored dot and status text.
 *
 * @param props - Component props
 * @returns CI status indicator UI
 */
export function CIStatusIndicator({
  status,
}: CIStatusIndicatorProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <div
        className={'h-2.5 w-2.5 rounded-full ' + getStatusColor(status)}
        aria-label={'CI status: ' + getStatusText(status)}
      />
      <span className="text-sm font-medium text-foreground-secondary">
        {getStatusText(status)}
      </span>
    </div>
  )
}
