/**
 * Tests for the Navigation component.
 * @packageDocumentation
 */

import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { describe, expect, it, vi } from 'vitest'

import { Navigation } from './Navigation'

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}))

describe('Navigation', () => {
  describe('Component Rendering', () => {
    it('renders the Arena Dashboard brand link', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      render(<Navigation />)

      const brandLink = screen.getByRole('link', { name: /arena dashboard/i })
      expect(brandLink).toBeInTheDocument()
      expect(brandLink).toHaveAttribute('href', '/')
    })

    it('renders all navigation links', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      render(<Navigation />)

      const dashboardLink = screen.getByRole('link', { name: /^dashboard$/i })
      const issuesLink = screen.getByRole('link', { name: /^issues$/i })

      expect(dashboardLink).toBeInTheDocument()
      expect(issuesLink).toBeInTheDocument()
    })
  })

  describe('Link Attributes', () => {
    const DASHBOARD_LINK_REGEX = /^dashboard$/i
    const ISSUES_LINK_REGEX = /^issues$/i

    it('has correct href for Dashboard link', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      render(<Navigation />)

      const dashboardLink = screen.getByRole('link', {
        name: DASHBOARD_LINK_REGEX,
      })
      expect(dashboardLink).toHaveAttribute('href', '/')
    })

    it('has correct href for Issues link', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      render(<Navigation />)

      const issuesLink = screen.getByRole('link', { name: ISSUES_LINK_REGEX })
      expect(issuesLink).toHaveAttribute('href', '/issues')
    })
  })

  describe('Active Link Styling', () => {
    const DASHBOARD_LINK_REGEX = /^dashboard$/i
    const ISSUES_LINK_REGEX = /^issues$/i
    const ACTIVE_CLASS = 'text-foreground'
    const INACTIVE_CLASS = 'text-muted-foreground'

    it('highlights Dashboard link when on home page', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      render(<Navigation />)

      const dashboardLink = screen.getByRole('link', {
        name: DASHBOARD_LINK_REGEX,
      })
      const issuesLink = screen.getByRole('link', { name: ISSUES_LINK_REGEX })

      // Active link has text-foreground, inactive has text-muted-foreground
      expect(dashboardLink.className).toContain(ACTIVE_CLASS)
      expect(issuesLink.className).toContain(INACTIVE_CLASS)
    })

    it('highlights Issues link when on issues page', () => {
      vi.mocked(usePathname).mockReturnValue('/issues')

      render(<Navigation />)

      const dashboardLink = screen.getByRole('link', {
        name: DASHBOARD_LINK_REGEX,
      })
      const issuesLink = screen.getByRole('link', { name: ISSUES_LINK_REGEX })

      expect(dashboardLink.className).toContain(INACTIVE_CLASS)
      expect(issuesLink.className).toContain(ACTIVE_CLASS)
    })

    it('highlights Issues link when on issue detail page', () => {
      vi.mocked(usePathname).mockReturnValue('/issues/123')

      render(<Navigation />)

      const dashboardLink = screen.getByRole('link', {
        name: DASHBOARD_LINK_REGEX,
      })
      const issuesLink = screen.getByRole('link', { name: ISSUES_LINK_REGEX })

      expect(dashboardLink.className).toContain(INACTIVE_CLASS)
      expect(issuesLink.className).toContain(ACTIVE_CLASS)
    })

    it('highlights Dashboard only on exact home path', () => {
      vi.mocked(usePathname).mockReturnValue('/agents/1')

      render(<Navigation />)

      const dashboardLink = screen.getByRole('link', {
        name: DASHBOARD_LINK_REGEX,
      })
      const issuesLink = screen.getByRole('link', { name: ISSUES_LINK_REGEX })

      // Neither should be highlighted when on /agents path
      expect(dashboardLink.className).toContain(INACTIVE_CLASS)
      expect(issuesLink.className).toContain(INACTIVE_CLASS)
    })
  })

  describe('Accessibility', () => {
    it('uses semantic nav element', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      const { container } = render(<Navigation />)

      const navElements = container.querySelectorAll('nav')
      expect(navElements.length).toBeGreaterThan(0)
    })

    it('all links are keyboard accessible', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      render(<Navigation />)

      const allLinks = screen.getAllByRole('link')
      for (const link of allLinks) {
        expect(link).toBeVisible()
      }
    })
  })

  describe('Visual Design', () => {
    it('has sticky header styling', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      const { container } = render(<Navigation />)

      const nav = container.querySelector('nav')
      expect(nav?.className).toContain('sticky')
      expect(nav?.className).toContain('top-0')
    })

    it('has border and background styling', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      const { container } = render(<Navigation />)

      const nav = container.querySelector('nav')
      expect(nav?.className).toContain('border-b')
      expect(nav?.className).toContain('bg-background')
    })
  })
})
