/**
 * Tests for Badge component.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Badge } from './Badge'

describe('Badge', () => {
  describe('when rendered with default variant', () => {
    it('should render badge text', () => {
      render(<Badge>Badge</Badge>)
      expect(screen.getByText('Badge')).toBeInTheDocument()
    })
  })

  describe('when rendered with secondary variant', () => {
    it('should render with secondary styling', () => {
      const { container } = render(<Badge variant="secondary">Secondary</Badge>)
      expect(container.firstChild).toHaveClass('bg-secondary')
    })
  })

  describe('when rendered with destructive variant', () => {
    it('should render with destructive styling', () => {
      const { container } = render(
        <Badge variant="destructive">Destructive</Badge>
      )
      expect(container.firstChild).toHaveClass('bg-destructive')
    })
  })

  describe('when rendered with outline variant', () => {
    it('should render with outline styling', () => {
      const { container } = render(<Badge variant="outline">Outline</Badge>)
      expect(container.firstChild).toHaveClass('text-foreground')
    })
  })

  describe('when rendered with custom className', () => {
    it('should apply custom class', () => {
      const { container } = render(<Badge className="custom">Custom</Badge>)
      expect(container.firstChild).toHaveClass('custom')
    })
  })
})
