import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { PRComparisonColumn } from './PRComparisonColumn'

describe('PRComparisonColumn', () => {
  const mockAgentData = {
    name: 'cursor',
    githubHandle: 'cursor-agent',
    prNumber: 1234,
    prStatus: 'open' as const,
    ciStatus: 'passing' as const,
    files: [
      {
        filename: 'src/test.ts',
        status: 'modified' as const,
        additions: 10,
        deletions: 2,
        changes: 12,
        patch: '@@ -1,1 +1,1 @@\n-old\n+new',
      },
    ],
  }

  it('renders agent name and PR number', () => {
    render(<PRComparisonColumn agentData={mockAgentData} />)

    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(
      'cursor'
    )
    expect(screen.getByText(/PR #1234/)).toBeInTheDocument()
  })

  it('displays CI status indicator', () => {
    render(<PRComparisonColumn agentData={mockAgentData} />)

    expect(screen.getByText('Passing')).toBeInTheDocument()
  })

  it('renders file diffs', () => {
    render(<PRComparisonColumn agentData={mockAgentData} />)

    expect(screen.getByText('src/test.ts')).toBeInTheDocument()
  })

  it('includes review interface at bottom', () => {
    render(<PRComparisonColumn agentData={mockAgentData} />)

    expect(screen.getByText(/Review for @cursor-agent/)).toBeInTheDocument()
  })

  it('renders merged PR status with success badge', () => {
    const mergedData = { ...mockAgentData, prStatus: 'merged' as const }
    render(<PRComparisonColumn agentData={mergedData} />)

    expect(screen.getByText('merged')).toBeInTheDocument()
  })

  it('renders closed PR status with error badge', () => {
    const closedData = { ...mockAgentData, prStatus: 'closed' as const }
    render(<PRComparisonColumn agentData={closedData} />)

    expect(screen.getByText('closed')).toBeInTheDocument()
  })

  it('renders empty state when no files', () => {
    const noFilesData = { ...mockAgentData, files: [] }
    render(<PRComparisonColumn agentData={noFilesData} />)

    expect(screen.getByText('No files changed')).toBeInTheDocument()
  })
})
