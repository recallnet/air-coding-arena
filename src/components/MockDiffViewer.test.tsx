import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { MockDiffViewer } from './MockDiffViewer'

describe('MockDiffViewer', () => {
  const mockFile = {
    filename: 'src/lib/queries.ts',
    status: 'modified' as const,
    additions: 15,
    deletions: 3,
    changes: 18,
    patch: '@@ -36,7 +36,22 @@\n-old line\n+new line',
  }

  it('renders file header with filename', () => {
    render(<MockDiffViewer file={mockFile} />)

    expect(screen.getByText('src/lib/queries.ts')).toBeInTheDocument()
  })

  it('displays file status badge', () => {
    render(<MockDiffViewer file={mockFile} />)

    expect(screen.getByText('modified')).toBeInTheDocument()
  })

  it('shows addition and deletion counts', () => {
    render(<MockDiffViewer file={mockFile} />)

    expect(screen.getByText('+15')).toBeInTheDocument()
    expect(screen.getByText('-3')).toBeInTheDocument()
  })

  it('renders patch content', () => {
    render(<MockDiffViewer file={mockFile} />)

    expect(screen.getByText(/-old line/)).toBeInTheDocument()
    expect(screen.getByText(/\+new line/)).toBeInTheDocument()
  })
})
