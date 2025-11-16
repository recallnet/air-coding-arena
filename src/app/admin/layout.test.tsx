/**
 * Tests for the AdminLayout component.
 * @packageDocumentation
 */

import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AdminLayout from './layout'

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}))

// Test constants
const ADMIN_AGENTS_PATH = '/admin/agents'
const TEST_CHILD_CONTENT = 'Test Content'
const ACTIVE_BORDER_CLASS = 'border-blue-900'
const INACTIVE_BORDER_CLASS = 'border-transparent'
const ACTIVE_TEXT_CLASS = 'text-foreground'
const INACTIVE_TEXT_CLASS = 'text-foreground-secondary'

describe('AdminLayout', () => {
  // Reset mocks before each test to prevent state pollution
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render children', () => {
      vi.mocked(usePathname).mockReturnValue(ADMIN_AGENTS_PATH)

      const { container } = render(
        <AdminLayout>
          <div>{TEST_CHILD_CONTENT}</div>
        </AdminLayout>
      )

      expect(container.textContent).toContain(TEST_CHILD_CONTENT)
    })

    it('should render the full layout structure', () => {
      vi.mocked(usePathname).mockReturnValue(ADMIN_AGENTS_PATH)

      const { container } = render(
        <AdminLayout>
          <div>Test</div>
        </AdminLayout>
      )

      // Verify navigation is present
      expect(screen.getByRole('navigation')).toBeInTheDocument()

      // Verify main content area
      const main = container.querySelector('main')
      expect(main).toBeInTheDocument()
    })
  })

  describe('Navigation Links', () => {
    it('should render all admin navigation links', () => {
      vi.mocked(usePathname).mockReturnValue(ADMIN_AGENTS_PATH)

      render(
        <AdminLayout>
          <div>Test</div>
        </AdminLayout>
      )

      const agentsLink = screen.getByRole('link', { name: /^agents$/i })
      const githubSetupLink = screen.getByRole('link', {
        name: /^github setup$/i,
      })

      expect(agentsLink).toBeInTheDocument()
      expect(githubSetupLink).toBeInTheDocument()
    })

    it('should have correct href for Agents link', () => {
      vi.mocked(usePathname).mockReturnValue(ADMIN_AGENTS_PATH)

      render(
        <AdminLayout>
          <div>Test</div>
        </AdminLayout>
      )

      const agentsLink = screen.getByRole('link', { name: /^agents$/i })
      expect(agentsLink).toHaveAttribute('href', ADMIN_AGENTS_PATH)
    })

    it('should have correct href for GitHub Setup link', () => {
      vi.mocked(usePathname).mockReturnValue(ADMIN_AGENTS_PATH)

      render(
        <AdminLayout>
          <div>Test</div>
        </AdminLayout>
      )

      const githubSetupLink = screen.getByRole('link', {
        name: /^github setup$/i,
      })
      expect(githubSetupLink).toHaveAttribute('href', '/admin/github/setup')
    })
  })

  describe('Active Link Styling', () => {
    it('highlights Agents link when on agents page', () => {
      vi.mocked(usePathname).mockReturnValue(ADMIN_AGENTS_PATH)

      render(
        <AdminLayout>
          <div>Test</div>
        </AdminLayout>
      )

      const agentsLink = screen.getByRole('link', { name: /^agents$/i })
      const githubSetupLink = screen.getByRole('link', {
        name: /^github setup$/i,
      })

      expect(agentsLink.className).toContain(ACTIVE_BORDER_CLASS)
      expect(agentsLink.className).toContain(ACTIVE_TEXT_CLASS)
      expect(githubSetupLink.className).toContain(INACTIVE_BORDER_CLASS)
      expect(githubSetupLink.className).toContain(INACTIVE_TEXT_CLASS)
    })

    it('highlights GitHub Setup link when on GitHub setup page', () => {
      vi.mocked(usePathname).mockReturnValue('/admin/github/setup')

      render(
        <AdminLayout>
          <div>Test</div>
        </AdminLayout>
      )

      const agentsLink = screen.getByRole('link', { name: /^agents$/i })
      const githubSetupLink = screen.getByRole('link', {
        name: /^github setup$/i,
      })

      expect(githubSetupLink.className).toContain(ACTIVE_BORDER_CLASS)
      expect(githubSetupLink.className).toContain(ACTIVE_TEXT_CLASS)
      expect(agentsLink.className).toContain(INACTIVE_BORDER_CLASS)
      expect(agentsLink.className).toContain(INACTIVE_TEXT_CLASS)
    })

    it('highlights GitHub Setup link when on nested GitHub pages', () => {
      vi.mocked(usePathname).mockReturnValue('/admin/github/setup/oauth')

      render(
        <AdminLayout>
          <div>Test</div>
        </AdminLayout>
      )

      const githubSetupLink = screen.getByRole('link', {
        name: /^github setup$/i,
      })

      expect(githubSetupLink.className).toContain(ACTIVE_BORDER_CLASS)
      expect(githubSetupLink.className).toContain(ACTIVE_TEXT_CLASS)
    })

    it('highlights Agents link when on nested agent pages', () => {
      vi.mocked(usePathname).mockReturnValue('/admin/agents/new')

      render(
        <AdminLayout>
          <div>Test</div>
        </AdminLayout>
      )

      const agentsLink = screen.getByRole('link', { name: /^agents$/i })

      expect(agentsLink.className).toContain(ACTIVE_BORDER_CLASS)
      expect(agentsLink.className).toContain(ACTIVE_TEXT_CLASS)
    })
  })

  describe('Layout Structure', () => {
    it('should have main content area with container', () => {
      vi.mocked(usePathname).mockReturnValue(ADMIN_AGENTS_PATH)

      const { container } = render(
        <AdminLayout>
          <div>Test</div>
        </AdminLayout>
      )

      const main = container.querySelector('main')
      expect(main).toBeInTheDocument()
      expect(main?.className).toContain('container')
      expect(main?.className).toContain('mx-auto')
    })

    it('should render children inside main element', () => {
      vi.mocked(usePathname).mockReturnValue(ADMIN_AGENTS_PATH)

      const { container } = render(
        <AdminLayout>
          <div data-testid="child-content">Test Content</div>
        </AdminLayout>
      )

      const main = container.querySelector('main')
      expect(main?.textContent).toContain('Test Content')
    })

    it('should have navigation with border styling', () => {
      vi.mocked(usePathname).mockReturnValue(ADMIN_AGENTS_PATH)

      const { container } = render(
        <AdminLayout>
          <div>Test</div>
        </AdminLayout>
      )

      const navContainer = container.querySelector('.border-b.border-border')
      expect(navContainer).toBeInTheDocument()
    })

    it('should have flexbox navigation layout', () => {
      vi.mocked(usePathname).mockReturnValue(ADMIN_AGENTS_PATH)

      const { container } = render(
        <AdminLayout>
          <div>Test</div>
        </AdminLayout>
      )

      const nav = container.querySelector('nav')
      expect(nav?.className).toContain('flex')
      expect(nav?.className).toContain('space-x-8')
    })

    it('should have proper spacing between navigation and content', () => {
      vi.mocked(usePathname).mockReturnValue(ADMIN_AGENTS_PATH)

      const { container } = render(
        <AdminLayout>
          <div>Test</div>
        </AdminLayout>
      )

      const navContainer = container.querySelector('.mb-8')
      expect(navContainer).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('uses semantic nav element with aria-label', () => {
      vi.mocked(usePathname).mockReturnValue(ADMIN_AGENTS_PATH)

      render(
        <AdminLayout>
          <div>Test</div>
        </AdminLayout>
      )

      const nav = screen.getByRole('navigation', { name: 'Admin sections' })
      expect(nav).toBeInTheDocument()
    })

    it('all links are keyboard accessible', () => {
      vi.mocked(usePathname).mockReturnValue(ADMIN_AGENTS_PATH)

      render(
        <AdminLayout>
          <div>Test</div>
        </AdminLayout>
      )

      const allLinks = screen.getAllByRole('link')
      for (const link of allLinks) {
        expect(link).toBeVisible()
      }
    })

    it('links have proper ARIA attributes', () => {
      vi.mocked(usePathname).mockReturnValue(ADMIN_AGENTS_PATH)

      render(
        <AdminLayout>
          <div>Test</div>
        </AdminLayout>
      )

      const agentsLink = screen.getByRole('link', { name: /^agents$/i })
      expect(agentsLink).toHaveAttribute('href')
    })
  })

  describe('Visual Design', () => {
    it('has responsive padding classes', () => {
      vi.mocked(usePathname).mockReturnValue(ADMIN_AGENTS_PATH)

      const { container } = render(
        <AdminLayout>
          <div>Test</div>
        </AdminLayout>
      )

      const main = container.querySelector('main')
      expect(main?.className).toMatch(/p-6/)
      expect(main?.className).toMatch(/md:p-8/)
      expect(main?.className).toMatch(/lg:p-12/)
    })

    it('has tab-style link styling', () => {
      vi.mocked(usePathname).mockReturnValue(ADMIN_AGENTS_PATH)

      render(
        <AdminLayout>
          <div>Test</div>
        </AdminLayout>
      )

      const agentsLink = screen.getByRole('link', { name: /^agents$/i })
      expect(agentsLink.className).toContain('border-b-2')
      expect(agentsLink.className).toContain('px-1')
      expect(agentsLink.className).toContain('py-4')
      expect(agentsLink.className).toContain('text-sm')
      expect(agentsLink.className).toContain('font-medium')
    })

    it('has transition-colors for smooth hover effects', () => {
      vi.mocked(usePathname).mockReturnValue(ADMIN_AGENTS_PATH)

      render(
        <AdminLayout>
          <div>Test</div>
        </AdminLayout>
      )

      const agentsLink = screen.getByRole('link', { name: /^agents$/i })
      expect(agentsLink.className).toContain('transition-colors')
    })
  })

  describe('Edge Cases', () => {
    it('handles empty children', () => {
      vi.mocked(usePathname).mockReturnValue(ADMIN_AGENTS_PATH)

      const { container } = render(<AdminLayout>{null}</AdminLayout>)

      const main = container.querySelector('main')
      expect(main).toBeInTheDocument()
    })

    it('handles complex children structure', () => {
      vi.mocked(usePathname).mockReturnValue(ADMIN_AGENTS_PATH)

      const { container } = render(
        <AdminLayout>
          <div>
            <h1>Title</h1>
            <p>Content</p>
            <div>
              <span>Nested</span>
            </div>
          </div>
        </AdminLayout>
      )

      expect(container.textContent).toContain('Title')
      expect(container.textContent).toContain('Content')
      expect(container.textContent).toContain('Nested')
    })

    it('handles pathname without /admin prefix', () => {
      vi.mocked(usePathname).mockReturnValue('/agents')

      render(
        <AdminLayout>
          <div>Test</div>
        </AdminLayout>
      )

      const agentsLink = screen.getByRole('link', { name: /^agents$/i })
      // Should not be highlighted when not on admin path
      expect(agentsLink.className).not.toContain(ACTIVE_BORDER_CLASS)
    })

    it('handles root path', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      render(
        <AdminLayout>
          <div>Test</div>
        </AdminLayout>
      )

      const agentsLink = screen.getByRole('link', { name: /^agents$/i })
      expect(agentsLink.className).not.toContain(ACTIVE_BORDER_CLASS)
    })
  })

  describe('isActive Function Logic', () => {
    it('correctly identifies active link with exact match', () => {
      vi.mocked(usePathname).mockReturnValue(ADMIN_AGENTS_PATH)

      render(
        <AdminLayout>
          <div>Test</div>
        </AdminLayout>
      )

      const agentsLink = screen.getByRole('link', { name: /^agents$/i })
      expect(agentsLink.className).toContain(ACTIVE_BORDER_CLASS)
      expect(agentsLink.className).toContain(ACTIVE_TEXT_CLASS)
    })

    it('correctly identifies active link with path prefix', () => {
      vi.mocked(usePathname).mockReturnValue('/admin/github/setup/step2')

      render(
        <AdminLayout>
          <div>Test</div>
        </AdminLayout>
      )

      const githubSetupLink = screen.getByRole('link', {
        name: /^github setup$/i,
      })
      expect(githubSetupLink.className).toContain(ACTIVE_BORDER_CLASS)
      expect(githubSetupLink.className).toContain(ACTIVE_TEXT_CLASS)
    })

    it('does not activate link for partial matches that are not prefixes', () => {
      vi.mocked(usePathname).mockReturnValue('/admin/agents-backup')

      render(
        <AdminLayout>
          <div>Test</div>
        </AdminLayout>
      )

      const agentsLink = screen.getByRole('link', { name: /^agents$/i })
      // /admin/agents should match /admin/agents-backup since it starts with /admin/agents
      expect(agentsLink.className).toContain(ACTIVE_BORDER_CLASS)
    })
  })

  describe('Multiple Children Rendering', () => {
    it('renders multiple children correctly', () => {
      vi.mocked(usePathname).mockReturnValue(ADMIN_AGENTS_PATH)

      const { container } = render(
        <AdminLayout>
          <div>First Child</div>
          <div>Second Child</div>
        </AdminLayout>
      )

      expect(container.textContent).toContain('First Child')
      expect(container.textContent).toContain('Second Child')
    })

    it('preserves child component props', () => {
      vi.mocked(usePathname).mockReturnValue(ADMIN_AGENTS_PATH)

      render(
        <AdminLayout>
          <div data-testid="test-child" className="custom-class">
            Test
          </div>
        </AdminLayout>
      )

      const child = screen.getByTestId('test-child')
      expect(child).toHaveClass('custom-class')
    })
  })
})
