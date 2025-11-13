import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { PRReviewInterface } from './PRReviewInterface'

describe('PRReviewInterface', () => {
  it('renders review interface with agent handle', () => {
    render(<PRReviewInterface agentGithubHandle="cursor-agent" />)

    expect(screen.getByPlaceholderText('@cursor-agent')).toBeInTheDocument()
  })

  it('shows disabled approve button', () => {
    render(<PRReviewInterface agentGithubHandle="cursor-agent" />)

    const approveButton = screen.getByText('Approve')
    expect(approveButton).toBeDisabled()
  })

  it('shows disabled request changes button', () => {
    render(<PRReviewInterface agentGithubHandle="cursor-agent" />)

    const requestButton = screen.getByText('Request Changes')
    expect(requestButton).toBeDisabled()
  })

  it('displays sign in message', () => {
    render(<PRReviewInterface agentGithubHandle="cursor-agent" />)

    expect(
      screen.getByText('Sign in with GitHub to submit reviews')
    ).toBeInTheDocument()
  })

  it('shows milestone 3 badge', () => {
    render(<PRReviewInterface agentGithubHandle="cursor-agent" />)

    expect(screen.getByText('Coming in Milestone 3')).toBeInTheDocument()
  })
})
