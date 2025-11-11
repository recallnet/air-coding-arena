import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Button } from './Button'

describe('Button', () => {
  describe('when rendered with text', () => {
    it('should display the button text', () => {
      render(<Button>Click me</Button>)

      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
    })
  })

  describe('when clicked', () => {
    it('should call onClick handler', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()

      render(<Button onClick={handleClick}>Click me</Button>)

      await user.click(screen.getByRole('button', { name: 'Click me' }))

      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('when disabled', () => {
    it('should not call onClick handler', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()

      render(<Button onClick={handleClick} disabled>Click me</Button>)

      await user.click(screen.getByRole('button', { name: 'Click me' }))

      expect(handleClick).not.toHaveBeenCalled()
    })

    it('should have disabled attribute', () => {
      render(<Button disabled>Click me</Button>)

      expect(screen.getByRole('button', { name: 'Click me' })).toBeDisabled()
    })
  })

  describe('when variant is primary', () => {
    it('should have primary styles', () => {
      render(<Button variant="primary">Click me</Button>)

      const button = screen.getByRole('button', { name: 'Click me' })
      expect(button).toHaveClass('bg-blue-600')
    })
  })

  describe('when variant is secondary', () => {
    it('should have secondary styles', () => {
      render(<Button variant="secondary">Click me</Button>)

      const button = screen.getByRole('button', { name: 'Click me' })
      expect(button).toHaveClass('bg-gray-600')
    })
  })
})
