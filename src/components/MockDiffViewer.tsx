/**
 * Mock diff viewer component.
 * Displays file diffs in a GitHub-like format using mock data.
 * Milestone 1: Simple rendering without advanced diff parsing.
 *
 * @packageDocumentation
 */

import type { PRFile } from '@/types/pr-comparison'

import { Badge } from './ui/Badge'

/**
 * Props for MockDiffViewer component.
 */
type MockDiffViewerProps = {
  file: PRFile
}

/**
 * Gets badge variant for file status.
 *
 * @param status - File status
 * @returns Badge variant
 */
function getStatusVariant(
  status: PRFile['status']
): 'default' | 'success' | 'error' | 'warning' {
  switch (status) {
    case 'added':
      return 'success'
    case 'removed':
      return 'error'
    case 'modified':
      return 'warning'
    case 'renamed':
      return 'default'
  }
}

/**
 * Mock diff viewer component.
 * Renders file header and patch content.
 *
 * @param props - Component props
 * @returns Mock diff viewer UI
 */
export function MockDiffViewer({
  file,
}: MockDiffViewerProps): React.JSX.Element {
  // Split patch into lines for rendering
  const patchLines = file.patch.split('\n')

  return (
    <div className="mock-diff-viewer mb-4 overflow-hidden rounded-lg border border-border">
      {/* File Header */}
      <div className="flex items-center justify-between border-b border-border bg-background-secondary px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium text-foreground">
            {file.filename}
          </span>
          <Badge variant={getStatusVariant(file.status)}>{file.status}</Badge>
        </div>
        <div className="flex items-center gap-3 text-xs font-medium">
          <span className="text-green-700">+{file.additions}</span>
          <span className="text-red-700">-{file.deletions}</span>
        </div>
      </div>

      {/* Patch Content */}
      <div className="bg-background font-mono text-xs">
        {patchLines.map((line, index) => {
          let bgColor = 'bg-background'
          let textColor = 'text-foreground'

          if (line.startsWith('+')) {
            bgColor = 'bg-green-100'
            textColor = 'text-green-900'
          } else if (line.startsWith('-')) {
            bgColor = 'bg-red-100'
            textColor = 'text-red-900'
          } else if (line.startsWith('@@')) {
            bgColor = 'bg-blue-100'
            textColor = 'text-blue-900'
          }

          return (
            <div
              key={index}
              className={`${bgColor} ${textColor} px-4 py-0.5`}
            >
              {line || ' '}
            </div>
          )
        })}
      </div>
    </div>
  )
}
