/**
 * Tests for IssueStatusFilter component.
 */

import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { IssueStatusFilter } from './IssueStatusFilter'

// Test constants
const FILTER_ALL = 'all'
const FILTER_OPEN = 'open'
const TEXT_ALL = 'All'
const TEXT_OPEN = 'Open'
const TEXT_IN_PROGRESS = 'In Progress'
const TEXT_COMPLETED = 'Completed'
const TEXT_CANCELLED = 'Cancelled'
const CLASS_BG_BLUE = 'bg-blue-700'
const CLASS_TEXT_WHITE = 'text-white'
const CLASS_BG_SECONDARY = 'bg-gray-200'

describe('IssueStatusFilter', () => {
  describe('rendering', () => {
    it('should render all filter buttons', () => {
      const onFilterChange = vi.fn()
      render(
        <IssueStatusFilter
          currentFilter={FILTER_ALL}
          onFilterChange={onFilterChange}
        />
      )

      expect(screen.getByText(TEXT_ALL)).toBeInTheDocument()
      expect(screen.getByText(TEXT_OPEN)).toBeInTheDocument()
      expect(screen.getByText(TEXT_IN_PROGRESS)).toBeInTheDocument()
      expect(screen.getByText(TEXT_COMPLETED)).toBeInTheDocument()
      expect(screen.getByText(TEXT_CANCELLED)).toBeInTheDocument()
    })

    it('should render buttons in correct order', () => {
      const onFilterChange = vi.fn()
      const { container } = render(
        <IssueStatusFilter
          currentFilter={FILTER_ALL}
          onFilterChange={onFilterChange}
        />
      )

      const buttons = container.querySelectorAll('button')
      expect(buttons).toHaveLength(5)
      expect(buttons[0]).toHaveTextContent(TEXT_ALL)
      expect(buttons[1]).toHaveTextContent(TEXT_OPEN)
      expect(buttons[2]).toHaveTextContent(TEXT_IN_PROGRESS)
      expect(buttons[3]).toHaveTextContent(TEXT_COMPLETED)
      expect(buttons[4]).toHaveTextContent(TEXT_CANCELLED)
    })
  })

  describe('interaction', () => {
    it('should call onFilterChange with "open" when Open button clicked', async () => {
      const user = userEvent.setup()
      const onFilterChange = vi.fn()
      render(
        <IssueStatusFilter
          currentFilter={FILTER_ALL}
          onFilterChange={onFilterChange}
        />
      )

      await user.click(screen.getByText(TEXT_OPEN))
      expect(onFilterChange).toHaveBeenCalledWith(FILTER_OPEN)
      expect(onFilterChange).toHaveBeenCalledTimes(1)
    })

    it('should call onFilterChange with "in_progress" when In Progress button clicked', async () => {
      const user = userEvent.setup()
      const onFilterChange = vi.fn()
      render(
        <IssueStatusFilter
          currentFilter={FILTER_ALL}
          onFilterChange={onFilterChange}
        />
      )

      await user.click(screen.getByText(TEXT_IN_PROGRESS))
      expect(onFilterChange).toHaveBeenCalledWith('in_progress')
      expect(onFilterChange).toHaveBeenCalledTimes(1)
    })

    it('should call onFilterChange with "completed" when Completed button clicked', async () => {
      const user = userEvent.setup()
      const onFilterChange = vi.fn()
      render(
        <IssueStatusFilter
          currentFilter={FILTER_ALL}
          onFilterChange={onFilterChange}
        />
      )

      await user.click(screen.getByText(TEXT_COMPLETED))
      expect(onFilterChange).toHaveBeenCalledWith('completed')
      expect(onFilterChange).toHaveBeenCalledTimes(1)
    })

    it('should call onFilterChange with "cancelled" when Cancelled button clicked', async () => {
      const user = userEvent.setup()
      const onFilterChange = vi.fn()
      render(
        <IssueStatusFilter
          currentFilter={FILTER_ALL}
          onFilterChange={onFilterChange}
        />
      )

      await user.click(screen.getByText(TEXT_CANCELLED))
      expect(onFilterChange).toHaveBeenCalledWith('cancelled')
      expect(onFilterChange).toHaveBeenCalledTimes(1)
    })

    it('should call onFilterChange with "all" when All button clicked', async () => {
      const user = userEvent.setup()
      const onFilterChange = vi.fn()
      render(
        <IssueStatusFilter
          currentFilter={FILTER_OPEN}
          onFilterChange={onFilterChange}
        />
      )

      await user.click(screen.getByText(TEXT_ALL))
      expect(onFilterChange).toHaveBeenCalledWith(FILTER_ALL)
      expect(onFilterChange).toHaveBeenCalledTimes(1)
    })
  })

  describe('active state', () => {
    it('should highlight All filter when currentFilter is "all"', () => {
      const onFilterChange = vi.fn()
      render(
        <IssueStatusFilter
          currentFilter={FILTER_ALL}
          onFilterChange={onFilterChange}
        />
      )

      const allButton = screen.getByText(TEXT_ALL)
      expect(allButton).toHaveClass(CLASS_BG_BLUE)
      expect(allButton).toHaveClass(CLASS_TEXT_WHITE)

      const openButton = screen.getByText(TEXT_OPEN)
      expect(openButton).not.toHaveClass(CLASS_BG_BLUE)
      expect(openButton).toHaveClass(CLASS_BG_SECONDARY)
    })

    it('should highlight Open filter when currentFilter is "open"', () => {
      const onFilterChange = vi.fn()
      render(
        <IssueStatusFilter
          currentFilter={FILTER_OPEN}
          onFilterChange={onFilterChange}
        />
      )

      const openButton = screen.getByText(TEXT_OPEN)
      expect(openButton).toHaveClass(CLASS_BG_BLUE)
      expect(openButton).toHaveClass(CLASS_TEXT_WHITE)

      const allButton = screen.getByText(TEXT_ALL)
      expect(allButton).not.toHaveClass(CLASS_BG_BLUE)
      expect(allButton).toHaveClass(CLASS_BG_SECONDARY)
    })

    it('should highlight In Progress filter when currentFilter is "in_progress"', () => {
      const onFilterChange = vi.fn()
      render(
        <IssueStatusFilter
          currentFilter="in_progress"
          onFilterChange={onFilterChange}
        />
      )

      const inProgressButton = screen.getByText(TEXT_IN_PROGRESS)
      expect(inProgressButton).toHaveClass(CLASS_BG_BLUE)
      expect(inProgressButton).toHaveClass(CLASS_TEXT_WHITE)

      const allButton = screen.getByText(TEXT_ALL)
      expect(allButton).not.toHaveClass(CLASS_BG_BLUE)
    })

    it('should highlight Completed filter when currentFilter is "completed"', () => {
      const onFilterChange = vi.fn()
      render(
        <IssueStatusFilter
          currentFilter="completed"
          onFilterChange={onFilterChange}
        />
      )

      const completedButton = screen.getByText(TEXT_COMPLETED)
      expect(completedButton).toHaveClass(CLASS_BG_BLUE)
      expect(completedButton).toHaveClass(CLASS_TEXT_WHITE)

      const allButton = screen.getByText(TEXT_ALL)
      expect(allButton).not.toHaveClass(CLASS_BG_BLUE)
    })

    it('should highlight Cancelled filter when currentFilter is "cancelled"', () => {
      const onFilterChange = vi.fn()
      render(
        <IssueStatusFilter
          currentFilter="cancelled"
          onFilterChange={onFilterChange}
        />
      )

      const cancelledButton = screen.getByText(TEXT_CANCELLED)
      expect(cancelledButton).toHaveClass(CLASS_BG_BLUE)
      expect(cancelledButton).toHaveClass(CLASS_TEXT_WHITE)

      const allButton = screen.getByText(TEXT_ALL)
      expect(allButton).not.toHaveClass(CLASS_BG_BLUE)
    })
  })

  describe('styling', () => {
    it('should apply base button styles to all buttons', () => {
      const onFilterChange = vi.fn()
      const { container } = render(
        <IssueStatusFilter
          currentFilter={FILTER_ALL}
          onFilterChange={onFilterChange}
        />
      )

      const buttons = container.querySelectorAll('button')
      for (const button of buttons) {
        const htmlButton = button as HTMLElement
        expect(htmlButton).toHaveClass('rounded-md')
        expect(htmlButton).toHaveClass('px-3')
        expect(htmlButton).toHaveClass('py-1.5')
        expect(htmlButton).toHaveClass('text-sm')
        expect(htmlButton).toHaveClass('font-medium')
        expect(htmlButton).toHaveClass('transition-colors')
      }
    })

    it('should apply inactive styles to non-active buttons', () => {
      const onFilterChange = vi.fn()
      render(
        <IssueStatusFilter
          currentFilter={FILTER_ALL}
          onFilterChange={onFilterChange}
        />
      )

      const openButton = screen.getByText(TEXT_OPEN)
      expect(openButton).toHaveClass(CLASS_BG_SECONDARY)
      expect(openButton).toHaveClass('text-gray-900')
      expect(openButton).toHaveClass('hover:bg-gray-300')
    })

    it('should have button semantic', () => {
      const onFilterChange = vi.fn()
      const { container } = render(
        <IssueStatusFilter
          currentFilter={FILTER_ALL}
          onFilterChange={onFilterChange}
        />
      )

      const buttons = container.querySelectorAll('button')
      expect(buttons.length).toBeGreaterThan(0)
      for (const button of buttons) {
        expect(button.tagName).toBe('BUTTON')
      }
    })
  })

  describe('accessibility', () => {
    it('should have keyboard navigation support', async () => {
      const user = userEvent.setup()
      const onFilterChange = vi.fn()
      render(
        <IssueStatusFilter
          currentFilter={FILTER_ALL}
          onFilterChange={onFilterChange}
        />
      )

      const allButton = screen.getByText(TEXT_ALL)
      allButton.focus()
      expect(allButton).toHaveFocus()

      await user.keyboard('{Tab}')
      expect(screen.getByText(TEXT_OPEN)).toHaveFocus()

      await user.keyboard('{Tab}')
      expect(screen.getByText(TEXT_IN_PROGRESS)).toHaveFocus()
    })

    it('should allow activation with Enter key', async () => {
      const user = userEvent.setup()
      const onFilterChange = vi.fn()
      render(
        <IssueStatusFilter
          currentFilter={FILTER_ALL}
          onFilterChange={onFilterChange}
        />
      )

      const openButton = screen.getByText(TEXT_OPEN)
      openButton.focus()
      await user.keyboard('{Enter}')

      expect(onFilterChange).toHaveBeenCalledWith(FILTER_OPEN)
    })

    it('should allow activation with Space key', async () => {
      const user = userEvent.setup()
      const onFilterChange = vi.fn()
      render(
        <IssueStatusFilter
          currentFilter={FILTER_ALL}
          onFilterChange={onFilterChange}
        />
      )

      const openButton = screen.getByText(TEXT_OPEN)
      openButton.focus()
      await user.keyboard(' ')

      expect(onFilterChange).toHaveBeenCalledWith(FILTER_OPEN)
    })
  })

  describe('container layout', () => {
    it('should render buttons in a flex container with gap', () => {
      const onFilterChange = vi.fn()
      const { container } = render(
        <IssueStatusFilter
          currentFilter={FILTER_ALL}
          onFilterChange={onFilterChange}
        />
      )

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper).toHaveClass('flex')
      expect(wrapper).toHaveClass('gap-2')
    })
  })
})
