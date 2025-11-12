/**
 * Tests for AgentAvatarGroup component.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AgentAvatarGroup } from './AgentAvatarGroup'

describe('AgentAvatarGroup', () => {
  describe('rendering multiple avatars', () => {
    it('should render multiple avatars', () => {
      const agents = [
        { agentName: 'cursor', status: 'submitted' as const },
        { agentName: 'engine', status: 'accepted' as const },
      ]
      render(<AgentAvatarGroup agents={agents} />)
      expect(screen.getByText('C')).toBeInTheDocument()
      expect(screen.getByText('E')).toBeInTheDocument()
    })

    it('should render avatars with correct statuses', () => {
      const agents = [
        { agentName: 'cursor', status: 'submitted' as const },
        { agentName: 'engine', status: 'accepted' as const },
        { agentName: 'cyrus', status: 'rejected' as const },
      ]
      const { container } = render(<AgentAvatarGroup agents={agents} />)

      // Check that we have 3 avatars with different colors
      const avatars = container.querySelectorAll('[role="img"]')
      expect(avatars).toHaveLength(3)
    })

    it('should render single avatar', () => {
      const agents = [{ agentName: 'cursor', status: 'submitted' as const }]
      render(<AgentAvatarGroup agents={agents} />)
      expect(screen.getByText('C')).toBeInTheDocument()
    })
  })

  describe('overflow indicator', () => {
    it('should show +N indicator when more than maxVisible (default 3) agents', () => {
      const agents = [
        { agentName: 'cursor', status: 'submitted' as const },
        { agentName: 'engine', status: 'accepted' as const },
        { agentName: 'cyrus', status: 'pending' as const },
        { agentName: 'claude', status: 'pending' as const },
      ]
      render(<AgentAvatarGroup agents={agents} />)
      expect(screen.getByText('+1')).toBeInTheDocument()
    })

    it('should show +2 when 5 agents with default maxVisible', () => {
      const agents = [
        { agentName: 'cursor', status: 'submitted' as const },
        { agentName: 'engine', status: 'accepted' as const },
        { agentName: 'cyrus', status: 'pending' as const },
        { agentName: 'claude', status: 'pending' as const },
        { agentName: 'gemini', status: 'ignored' as const },
      ]
      render(<AgentAvatarGroup agents={agents} />)
      expect(screen.getByText('+2')).toBeInTheDocument()
    })

    it('should not show +N when exactly maxVisible agents', () => {
      const agents = [
        { agentName: 'cursor', status: 'submitted' as const },
        { agentName: 'engine', status: 'accepted' as const },
        { agentName: 'cyrus', status: 'pending' as const },
      ]
      render(<AgentAvatarGroup agents={agents} />)
      expect(screen.queryByText(/^\+/)).not.toBeInTheDocument()
    })

    it('should not show +N when fewer than maxVisible agents', () => {
      const agents = [
        { agentName: 'cursor', status: 'submitted' as const },
        { agentName: 'engine', status: 'accepted' as const },
      ]
      render(<AgentAvatarGroup agents={agents} />)
      expect(screen.queryByText(/^\+/)).not.toBeInTheDocument()
    })

    it('should respect custom maxVisible prop', () => {
      const agents = [
        { agentName: 'cursor', status: 'submitted' as const },
        { agentName: 'engine', status: 'accepted' as const },
        { agentName: 'cyrus', status: 'pending' as const },
      ]
      render(<AgentAvatarGroup agents={agents} maxVisible={2} />)
      expect(screen.getByText('+1')).toBeInTheDocument()
    })

    it('should have tooltip on +N indicator', () => {
      const agents = [
        { agentName: 'cursor', status: 'submitted' as const },
        { agentName: 'engine', status: 'accepted' as const },
        { agentName: 'cyrus', status: 'pending' as const },
        { agentName: 'claude', status: 'pending' as const },
      ]
      render(<AgentAvatarGroup agents={agents} />)
      const indicator = screen.getByText('+1')
      expect(indicator).toHaveAttribute('title', '+1 more')
    })
  })

  describe('empty state', () => {
    it('should render empty state when no agents', () => {
      const { container } = render(<AgentAvatarGroup agents={[]} />)
      expect(container.firstChild).toHaveTextContent('-')
    })

    it('should render hyphen with secondary text color for empty state', () => {
      const { container } = render(<AgentAvatarGroup agents={[]} />)
      const emptyState = container.firstChild as HTMLElement
      expect(emptyState).toHaveClass('text-foreground-secondary')
    })
  })

  describe('styling', () => {
    it('should apply overlapping style with negative margin', () => {
      const agents = [
        { agentName: 'cursor', status: 'submitted' as const },
        { agentName: 'engine', status: 'accepted' as const },
      ]
      const { container } = render(<AgentAvatarGroup agents={agents} />)
      const group = container.querySelector('.flex')
      expect(group).toHaveClass('-space-x-2')
    })

    it('should have proper z-index layering for overlapping avatars', () => {
      const agents = [
        { agentName: 'cursor', status: 'submitted' as const },
        { agentName: 'engine', status: 'accepted' as const },
        { agentName: 'cyrus', status: 'pending' as const },
      ]
      const { container } = render(<AgentAvatarGroup agents={agents} />)

      // First avatar should have highest z-index
      const wrappers = container.querySelectorAll('[style*="z-index"]')
      expect(wrappers).toHaveLength(3)

      // Check z-index values are in descending order
      const firstWrapper = wrappers[0] as HTMLElement
      const secondWrapper = wrappers[1] as HTMLElement
      const thirdWrapper = wrappers[2] as HTMLElement

      const firstZ = parseInt(firstWrapper.style.zIndex)
      const secondZ = parseInt(secondWrapper.style.zIndex)
      const thirdZ = parseInt(thirdWrapper.style.zIndex)

      expect(firstZ).toBeGreaterThan(secondZ)
      expect(secondZ).toBeGreaterThan(thirdZ)
    })

    it('should use small size avatars', () => {
      const agents = [{ agentName: 'cursor', status: 'submitted' as const }]
      const { container } = render(<AgentAvatarGroup agents={agents} />)
      const avatar = container.querySelector('.h-6')
      expect(avatar).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should have role="img" on each avatar', () => {
      const agents = [
        { agentName: 'cursor', status: 'submitted' as const },
        { agentName: 'engine', status: 'accepted' as const },
      ]
      const { container } = render(<AgentAvatarGroup agents={agents} />)
      const avatars = container.querySelectorAll('[role="img"]')
      expect(avatars).toHaveLength(2)
    })

    it('should have aria-label on each avatar', () => {
      const agents = [
        { agentName: 'cursor', status: 'submitted' as const },
        { agentName: 'engine', status: 'accepted' as const },
      ]
      const { container } = render(<AgentAvatarGroup agents={agents} />)

      const ariaLabelAttr = 'aria-label'
      const avatars = container.querySelectorAll(
        `[role="img"][${ariaLabelAttr}]`
      )
      expect(avatars).toHaveLength(2)

      const firstAvatar = avatars[0]
      const secondAvatar = avatars[1]
      expect(firstAvatar).toBeDefined()
      expect(secondAvatar).toBeDefined()

      if (firstAvatar && secondAvatar) {
        expect(firstAvatar).toHaveAttribute(
          ariaLabelAttr,
          `${agents[0]?.agentName} - Submitted`
        )
        expect(secondAvatar).toHaveAttribute(
          ariaLabelAttr,
          `${agents[1]?.agentName} - Accepted`
        )
      }
    })

    it('should have role="group" on the container', () => {
      const agents = [
        { agentName: 'cursor', status: 'submitted' as const },
        { agentName: 'engine', status: 'accepted' as const },
      ]
      const { container } = render(<AgentAvatarGroup agents={agents} />)
      const group = container.querySelector('[role="group"]')
      expect(group).toBeInTheDocument()
    })

    it('should have aria-label describing the group', () => {
      const agents = [
        { agentName: 'cursor', status: 'submitted' as const },
        { agentName: 'engine', status: 'accepted' as const },
      ]
      const { container } = render(<AgentAvatarGroup agents={agents} />)
      const group = container.querySelector('[role="group"]')
      expect(group).toHaveAttribute('aria-label', 'Agent avatars')
    })
  })
})
