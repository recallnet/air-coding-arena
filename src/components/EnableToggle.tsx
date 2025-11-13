/**
 * Enable toggle component for agents.
 * Client Component that allows enabling/disabling agents with optimistic UI.
 *
 * @packageDocumentation
 */

'use client'

import { useState } from 'react'

/**
 * Props for EnableToggle component
 */
export type EnableToggleProps = {
  /** Agent ID */
  agentId: string
  /** Current enabled state */
  enabled: boolean
  /** Callback when toggle changes successfully */
  onToggle?: (enabled: boolean) => void // eslint-disable-line no-unused-vars
}

/**
 * Enable toggle component.
 * Displays a checkbox styled as a toggle switch that calls PATCH /api/agents/:id.
 * Uses optimistic UI updates and reverts on error.
 *
 * @param props - Component props
 * @returns Enable toggle component
 */
export function EnableToggle({
  agentId,
  enabled: initialEnabled,
  onToggle,
}: EnableToggleProps): React.JSX.Element {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [error, setError] = useState<string | null>(null)

  /**
   * Handles toggle change
   */
  async function handleToggle() {
    const newEnabledValue = !enabled

    // Optimistic update
    setEnabled(newEnabledValue)
    setError(null)

    try {
      const response = await globalThis.fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isEnabled: newEnabledValue }),
      })

      if (!response.ok) {
        throw new Error('Failed to update agent')
      }

      // Call success callback
      onToggle?.(newEnabledValue)
    } catch (err) {
      // Revert on error
      setEnabled(enabled)
      setError(err instanceof Error ? err.message : 'Failed to update agent')
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label className="relative inline-flex cursor-pointer items-center">
        <input
          type="checkbox"
          checked={enabled}
          onChange={handleToggle}
          className="peer sr-only"
        />
        <div className="peer h-6 w-11 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-green-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-300"></div>
      </label>
      {error ? <span className="text-xs text-red-600" title={error}>
          Error
        </span> : null}
    </div>
  )
}
