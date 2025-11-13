import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { describe, expect, it, vi } from 'vitest'

import RootLayout, { metadata } from './layout'

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}))

describe('RootLayout', () => {
  describe('when rendered', () => {
    it('should render children', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      const { container } = render(
        <RootLayout>
          <div>Test Content</div>
        </RootLayout>
      )

      expect(container.textContent).toContain('Test Content')
    })

    it('should have html lang attribute set to en', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      const { container } = render(
        <RootLayout>
          <div>Test</div>
        </RootLayout>
      )

      const html = container.querySelector('html')
      expect(html).toHaveAttribute('lang', 'en')
    })

    it('should include body element', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      const { container } = render(
        <RootLayout>
          <div>Test</div>
        </RootLayout>
      )

      const body = container.querySelector('body')
      expect(body).toBeInTheDocument()
    })
  })

  describe('navigation', () => {
    it('should render navigation component', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      render(
        <RootLayout>
          <div>Test</div>
        </RootLayout>
      )

      const brandLink = screen.getByRole('link', { name: /air coding arena/i })
      expect(brandLink).toBeInTheDocument()
    })

    it('should have navigation links', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      render(
        <RootLayout>
          <div>Test</div>
        </RootLayout>
      )

      const dashboardLink = screen.getByRole('link', { name: /^dashboard$/i })
      const issuesLink = screen.getByRole('link', { name: /^issues$/i })

      expect(dashboardLink).toBeInTheDocument()
      expect(issuesLink).toBeInTheDocument()
    })
  })

  describe('footer', () => {
    it('should render footer with demo mode warning', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      const { container } = render(
        <RootLayout>
          <div>Test</div>
        </RootLayout>
      )

      expect(container.textContent).toContain('Demo Mode (Milestone 1)')
    })

    it('should mention sample data in footer', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      const { container } = render(
        <RootLayout>
          <div>Test</div>
        </RootLayout>
      )

      expect(container.textContent).toContain('sample data')
    })

    it('should mention webhook integration coming in Milestone 2', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      const { container } = render(
        <RootLayout>
          <div>Test</div>
        </RootLayout>
      )

      expect(container.textContent).toContain('Milestone 2')
    })

    it('should have footer element', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      const { container } = render(
        <RootLayout>
          <div>Test</div>
        </RootLayout>
      )

      const footer = container.querySelector('footer')
      expect(footer).toBeInTheDocument()
    })
  })

  describe('layout structure', () => {
    it('should have main content area', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      const { container } = render(
        <RootLayout>
          <div>Test</div>
        </RootLayout>
      )

      const main = container.querySelector('main')
      expect(main).toBeInTheDocument()
    })

    it('should render children inside main element', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      const { container } = render(
        <RootLayout>
          <div data-testid="child-content">Test Content</div>
        </RootLayout>
      )

      const main = container.querySelector('main')
      expect(main?.textContent).toContain('Test Content')
    })

    it('should have flexbox layout for full height', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      const { container } = render(
        <RootLayout>
          <div>Test</div>
        </RootLayout>
      )

      const layoutDiv = container.querySelector('body > div')
      expect(layoutDiv?.className).toContain('flex')
      expect(layoutDiv?.className).toContain('min-h-screen')
      expect(layoutDiv?.className).toContain('flex-col')
    })
  })

  describe('metadata', () => {
    it('should have correct title', () => {
      expect(metadata.title).toBe('Air Coding Arena')
    })

    it('should have correct description', () => {
      expect(metadata.description).toBe(
        'AI Agent coding arena dashboard for tracking issues and performance'
      )
    })
  })
})
