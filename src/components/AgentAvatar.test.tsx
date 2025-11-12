/**
 * Tests for AgentAvatar component.
 */

import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AgentAvatar } from './AgentAvatar'

describe('AgentAvatar', () => {
  describe('rendering', () => {
    it('should render agent initials', () => {
      render(<AgentAvatar name="cursor" status="submitted" />)
      expect(screen.getByText('C')).toBeInTheDocument()
    })

    it('should render first letter uppercase for lowercase names', () => {
      render(<AgentAvatar name="engine" status="pending" />)
      expect(screen.getByText('E')).toBeInTheDocument()
    })

    it('should render first letter for multi-word names', () => {
      render(<AgentAvatar name="Claude Sonnet" status="accepted" />)
      expect(screen.getByText('C')).toBeInTheDocument()
    })
  })

  describe('status colors', () => {
    it('should apply gray background for pending status', () => {
      const { container } = render(
        <AgentAvatar name="engine" status="pending" />
      )
      const avatar = container.firstChild as HTMLElement
      expect(avatar).toHaveClass('bg-gray-600')
    })

    it('should apply blue background for submitted status', () => {
      const { container } = render(
        <AgentAvatar name="cyrus" status="submitted" />
      )
      const avatar = container.firstChild as HTMLElement
      expect(avatar).toHaveClass('bg-blue-500')
    })

    it('should apply green background for accepted status', () => {
      const { container } = render(
        <AgentAvatar name="cursor" status="accepted" />
      )
      const avatar = container.firstChild as HTMLElement
      expect(avatar).toHaveClass('bg-green-500')
    })

    it('should apply red background for rejected status', () => {
      const { container } = render(
        <AgentAvatar name="engine" status="rejected" />
      )
      const avatar = container.firstChild as HTMLElement
      expect(avatar).toHaveClass('bg-red-500')
    })

    it('should apply gray background with opacity for ignored status', () => {
      const { container } = render(
        <AgentAvatar name="cyrus" status="ignored" />
      )
      const avatar = container.firstChild as HTMLElement
      expect(avatar).toHaveClass('bg-gray-600')
      expect(avatar).toHaveClass('opacity-50')
    })
  })

  describe('size variants', () => {
    it('should apply medium size by default', () => {
      const { container } = render(
        <AgentAvatar name="cursor" status="submitted" />
      )
      const avatar = container.firstChild as HTMLElement
      expect(avatar).toHaveClass('h-8')
      expect(avatar).toHaveClass('w-8')
      expect(avatar).toHaveClass('text-sm')
    })

    it('should apply small size when specified', () => {
      const { container } = render(
        <AgentAvatar name="cursor" status="submitted" size="sm" />
      )
      const avatar = container.firstChild as HTMLElement
      expect(avatar).toHaveClass('h-6')
      expect(avatar).toHaveClass('w-6')
      expect(avatar).toHaveClass('text-xs')
    })

    it('should apply large size when specified', () => {
      const { container } = render(
        <AgentAvatar name="cursor" status="submitted" size="lg" />
      )
      const avatar = container.firstChild as HTMLElement
      expect(avatar).toHaveClass('h-10')
      expect(avatar).toHaveClass('w-10')
      expect(avatar).toHaveClass('text-base')
    })
  })

  describe('tooltip', () => {
    it('should show tooltip with agent name and status on hover', async () => {
      const user = userEvent.setup()
      render(<AgentAvatar name="cursor" status="submitted" />)

      const avatar = screen.getByText('C')
      await user.hover(avatar)

      expect(avatar).toHaveAttribute('title', 'cursor - Submitted')
    })

    it('should capitalize status in tooltip', async () => {
      const user = userEvent.setup()
      render(<AgentAvatar name="engine" status="accepted" />)

      const avatar = screen.getByText('E')
      await user.hover(avatar)

      expect(avatar).toHaveAttribute('title', 'engine - Accepted')
    })

    it('should format pending status in tooltip', () => {
      render(<AgentAvatar name="cyrus" status="pending" />)
      const avatar = screen.getByText('C')
      expect(avatar).toHaveAttribute('title', 'cyrus - Pending')
    })

    it('should format rejected status in tooltip', () => {
      render(<AgentAvatar name="engine" status="rejected" />)
      const avatar = screen.getByText('E')
      expect(avatar).toHaveAttribute('title', 'engine - Rejected')
    })

    it('should format ignored status in tooltip', () => {
      render(<AgentAvatar name="claude" status="ignored" />)
      const avatar = screen.getByText('C')
      expect(avatar).toHaveAttribute('title', 'claude - Ignored')
    })
  })

  describe('styling', () => {
    it('should have circular shape', () => {
      const { container } = render(
        <AgentAvatar name="cursor" status="submitted" />
      )
      const avatar = container.firstChild as HTMLElement
      expect(avatar).toHaveClass('rounded-full')
    })

    it('should center content', () => {
      const { container } = render(
        <AgentAvatar name="cursor" status="submitted" />
      )
      const avatar = container.firstChild as HTMLElement
      expect(avatar).toHaveClass('flex')
      expect(avatar).toHaveClass('items-center')
      expect(avatar).toHaveClass('justify-center')
    })

    it('should have white text', () => {
      const { container } = render(
        <AgentAvatar name="cursor" status="submitted" />
      )
      const avatar = container.firstChild as HTMLElement
      expect(avatar).toHaveClass('text-white')
    })

    it('should have font weight semibold', () => {
      const { container } = render(
        <AgentAvatar name="cursor" status="submitted" />
      )
      const avatar = container.firstChild as HTMLElement
      expect(avatar).toHaveClass('font-semibold')
    })

    it('should have hover scale effect', () => {
      const { container } = render(
        <AgentAvatar name="cursor" status="submitted" />
      )
      const avatar = container.firstChild as HTMLElement
      expect(avatar).toHaveClass('hover:scale-110')
    })

    it('should have transition effect', () => {
      const { container } = render(
        <AgentAvatar name="cursor" status="submitted" />
      )
      const avatar = container.firstChild as HTMLElement
      expect(avatar).toHaveClass('transition-transform')
    })
  })
})
