/**
 * Tests for Card component.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './Card'

describe('Card', () => {
  describe('when rendered with content', () => {
    it('should render card container', () => {
      render(<Card>Content</Card>)
      expect(screen.getByText('Content')).toBeInTheDocument()
    })

    it('should render with custom className', () => {
      const { container } = render(<Card className="custom">Content</Card>)
      expect(container.firstChild).toHaveClass('custom')
    })
  })

  describe('CardHeader', () => {
    it('should render header', () => {
      render(<CardHeader>Header</CardHeader>)
      expect(screen.getByText('Header')).toBeInTheDocument()
    })
  })

  describe('CardTitle', () => {
    it('should render title', () => {
      render(<CardTitle>Title</CardTitle>)
      expect(screen.getByText('Title')).toBeInTheDocument()
    })
  })

  describe('CardDescription', () => {
    it('should render description', () => {
      render(<CardDescription>Description</CardDescription>)
      expect(screen.getByText('Description')).toBeInTheDocument()
    })
  })

  describe('CardContent', () => {
    it('should render content', () => {
      render(<CardContent>Content</CardContent>)
      expect(screen.getByText('Content')).toBeInTheDocument()
    })
  })

  describe('CardFooter', () => {
    it('should render footer', () => {
      render(<CardFooter>Footer</CardFooter>)
      expect(screen.getByText('Footer')).toBeInTheDocument()
    })
  })
})
