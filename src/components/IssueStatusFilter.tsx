/**
 * Issue Status Filter component for filtering issues by status.
 * Provides pill-style filter buttons matching GitHub's design pattern.
 *
 * @packageDocumentation
 */

'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Issue filter types matching issue statuses.
 */
export type IssueFilter =
  'all' | 'open' | 'in_progress' | 'completed' | 'cancelled'

/**
 * Props for the IssueStatusFilter component.
 */
export type IssueStatusFilterProps = {
  /**
   * Currently selected filter.
   */
  currentFilter: IssueFilter
  /**
   * Callback fired when a filter button is clicked.
   */
  // eslint-disable-next-line no-unused-vars
  onFilterChange: (filter: IssueFilter) => void
}

/**
 * Available filter options with labels.
 */
const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const

/**
 * Issue Status Filter component.
 * Displays pill-style filter buttons for issue status filtering.
 * Active filter is highlighted with blue background, inactive with gray.
 * Supports keyboard navigation and hover states.
 *
 * @param props - Component props
 * @returns Filter button group
 *
 * @example
 * ```tsx
 * const [filter, setFilter] = useState<IssueFilter>('all')
 * <IssueStatusFilter currentFilter={filter} onFilterChange={setFilter} />
 * ```
 */
export function IssueStatusFilter({
  currentFilter,
  onFilterChange,
}: IssueStatusFilterProps): React.ReactElement {
  return (
    <div className="flex gap-2">
      {FILTERS.map((filterOption) => {
        const isActive = currentFilter === filterOption.value
        return (
          <button
            key={filterOption.value}
            onClick={() => onFilterChange(filterOption.value as IssueFilter)}
            className={cn(
              'rounded-geist-sm border px-3 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'border-gray-500 bg-gray-200 text-gray-1000 hover:bg-gray-300'
                : 'border-gray-300 bg-transparent text-gray-700 hover:border-gray-400 hover:bg-gray-100'
            )}
          >
            {filterOption.label}
          </button>
        )
      })}
    </div>
  )
}
