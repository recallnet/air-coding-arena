import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import { AgentSelector } from './AgentSelector'

describe('AgentSelector', () => {
  it('renders agent selection interface', () => {
    const agents = [
      { name: 'cursor', displayName: 'Cursor', avatarUrl: null },
      { name: 'engine', displayName: 'Engine', avatarUrl: null },
      { name: 'cyrus', displayName: 'Cyrus', avatarUrl: null },
    ]

    render(
      <AgentSelector
        agents={agents}
        selectedAgents={['cursor', 'engine']}
        onSelectionChange={vi.fn()}
      />
    )

    expect(screen.getByText('Compare PRs (select 2):')).toBeInTheDocument()
    expect(screen.getByText('Cursor')).toBeInTheDocument()
    expect(screen.getByText('Engine')).toBeInTheDocument()
    expect(screen.getByText('Cyrus')).toBeInTheDocument()
  })

  it('shows selected state for chosen agents', () => {
    const agents = [
      { name: 'cursor', displayName: 'Cursor', avatarUrl: null },
      { name: 'engine', displayName: 'Engine', avatarUrl: null },
    ]

    render(
      <AgentSelector
        agents={agents}
        selectedAgents={['cursor', 'engine']}
        onSelectionChange={vi.fn()}
      />
    )

    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toHaveClass('selected')
    expect(buttons[1]).toHaveClass('selected')
  })

  it('disables unselected agents when 2 are already selected', () => {
    const agents = [
      { name: 'cursor', displayName: 'Cursor', avatarUrl: null },
      { name: 'engine', displayName: 'Engine', avatarUrl: null },
      { name: 'cyrus', displayName: 'Cyrus', avatarUrl: null },
    ]

    render(
      <AgentSelector
        agents={agents}
        selectedAgents={['cursor', 'engine']}
        onSelectionChange={vi.fn()}
      />
    )

    const cyrusButton = screen.getByText('Cyrus').closest('button')
    expect(cyrusButton).toBeDisabled()
  })

  it('calls onSelectionChange when unselected agent is clicked', () => {
    const agents = [
      { name: 'cursor', displayName: 'Cursor', avatarUrl: null },
      { name: 'engine', displayName: 'Engine', avatarUrl: null },
      { name: 'cyrus', displayName: 'Cyrus', avatarUrl: null },
    ]
    const onSelectionChange = vi.fn()

    render(
      <AgentSelector
        agents={agents}
        selectedAgents={['cursor', 'engine']}
        onSelectionChange={onSelectionChange}
      />
    )

    const cyrusButton = screen.getByText('Cyrus').closest('button')
    // Button is disabled so we can't click it
    expect(cyrusButton).toBeDisabled()
  })

  it('does not call onSelectionChange when selected agent is clicked', () => {
    const agents = [
      { name: 'cursor', displayName: 'Cursor', avatarUrl: null },
      { name: 'engine', displayName: 'Engine', avatarUrl: null },
    ]
    const onSelectionChange = vi.fn()

    render(
      <AgentSelector
        agents={agents}
        selectedAgents={['cursor', 'engine']}
        onSelectionChange={onSelectionChange}
      />
    )

    const cursorButton = screen.getByText('Cursor').closest('button')
    cursorButton?.click()

    // Should not be called because clicking selected agent does nothing
    expect(onSelectionChange).not.toHaveBeenCalled()
  })

  it('renders milestone badge', () => {
    const agents = [
      { name: 'cursor', displayName: 'Cursor', avatarUrl: null },
      { name: 'engine', displayName: 'Engine', avatarUrl: null },
    ]

    render(
      <AgentSelector
        agents={agents}
        selectedAgents={['cursor', 'engine']}
        onSelectionChange={vi.fn()}
      />
    )

    expect(screen.getByText('Milestone 1: Mock Data Only')).toBeInTheDocument()
  })

  it('uses agent name when displayName is null', () => {
    const agents = [
      { name: 'cursor', displayName: null, avatarUrl: null },
      { name: 'engine', displayName: null, avatarUrl: null },
    ]

    render(
      <AgentSelector
        agents={agents}
        selectedAgents={['cursor', 'engine']}
        onSelectionChange={vi.fn()}
      />
    )

    expect(screen.getByText('cursor')).toBeInTheDocument()
    expect(screen.getByText('engine')).toBeInTheDocument()
  })
})
