import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { PRComparisonContainer } from './PRComparisonContainer'

describe('PRComparisonContainer', () => {
  const mockAgents = [
    {
      name: 'cursor',
      displayName: 'Cursor',
      avatarUrl: null,
      githubHandle: 'cursor-agent',
      prNumber: 1234,
      prStatus: 'open' as const,
      ciStatus: 'passing' as const,
      files: [],
    },
    {
      name: 'engine',
      displayName: 'Engine',
      avatarUrl: null,
      githubHandle: 'engine-agent',
      prNumber: 1235,
      prStatus: 'open' as const,
      ciStatus: 'failing' as const,
      files: [],
    },
  ]

  it('renders agent selector', () => {
    render(<PRComparisonContainer agents={mockAgents} />)

    expect(screen.getByText('Compare PRs (select 2):')).toBeInTheDocument()
  })

  it('renders two comparison columns side by side', () => {
    render(<PRComparisonContainer agents={mockAgents} />)

    expect(screen.getByText('cursor')).toBeInTheDocument()
    expect(screen.getByText('engine')).toBeInTheDocument()
  })

  it('shows coming soon message', () => {
    render(<PRComparisonContainer agents={mockAgents} />)

    expect(
      screen.getByText(/This feature is under development/)
    ).toBeInTheDocument()
  })

  it('does not render agent selector when less than 2 agents', () => {
    const singleAgent = mockAgents[0]
    if (!singleAgent) throw new Error('Mock agent not found')

    render(<PRComparisonContainer agents={[singleAgent]} />)

    expect(
      screen.queryByText('Compare PRs (select 2):')
    ).not.toBeInTheDocument()
  })

  it('shows message when no agents selected', () => {
    render(<PRComparisonContainer agents={[]} />)

    expect(
      screen.getByText('Select 2 agents to compare their pull requests')
    ).toBeInTheDocument()
  })

  it('renders PR Comparison title', () => {
    render(<PRComparisonContainer agents={mockAgents} />)

    expect(screen.getByText('PR Comparison')).toBeInTheDocument()
  })

  it('renders Milestone 1 badge', () => {
    render(<PRComparisonContainer agents={mockAgents} />)

    expect(screen.getByText('Milestone 1: Mock Data')).toBeInTheDocument()
  })
})
