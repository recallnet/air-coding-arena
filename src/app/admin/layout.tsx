/**
 * Admin layout with sub-navigation tabs.
 * Provides consistent navigation across admin pages.
 * @packageDocumentation
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

/**
 * Admin navigation link configuration.
 */
type AdminNavLink = {
  /** Display label for the navigation link */
  label: string
  /** URL path for the navigation link */
  href: string
}

/**
 * Array of admin navigation links displayed as tabs.
 */
const adminNavLinks: readonly AdminNavLink[] = [
  { label: 'Agents', href: '/admin/agents' },
  { label: 'GitHub Setup', href: '/admin/github/setup' },
]

/**
 * Admin layout component with tab navigation.
 *
 * @param props - Component props
 * @param props.children - Child components to render
 * @returns Admin layout with navigation
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const pathname = usePathname()

  /**
   * Determines if a link is currently active.
   *
   * @param href - The link href to check
   * @returns True if the link is active
   */
  const isActive = (href: string): boolean => {
    return pathname.startsWith(href)
  }

  return (
    <main className="container mx-auto p-6 md:p-8 lg:p-12">
      {/* Admin Tab Navigation */}
      <div className="mb-8 border-b border-border">
        <nav className="flex space-x-8" aria-label="Admin sections">
          {adminNavLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'border-b-2 px-1 py-4 text-sm font-medium transition-colors',
                isActive(link.href)
                  ? 'border-blue-900 text-foreground'
                  : 'border-transparent text-foreground-secondary hover:border-border-hover hover:text-foreground'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Admin Page Content */}
      {children}
    </main>
  )
}
