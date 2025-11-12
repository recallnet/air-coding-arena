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
      expect(container.firstChild).toHaveClass('bg-gray-200')
    })
  })

  describe('when rendered with success variant', () => {
    it('should render with success styling', () => {
      const { container } = render(<Badge variant="success">Success</Badge>)
      expect(container.firstChild).toHaveClass('bg-green-100')
    })
  })

  describe('when rendered with error variant', () => {
    it('should render with error styling', () => {
      const { container } = render(<Badge variant="error">Error</Badge>)
      expect(container.firstChild).toHaveClass('bg-red-100')
    })
  })

  describe('when rendered with warning variant', () => {
    it('should render with warning styling', () => {
      const { container } = render(<Badge variant="warning">Warning</Badge>)
      expect(container.firstChild).toHaveClass('bg-amber-100')
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
