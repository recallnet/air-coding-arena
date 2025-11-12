/**
 * Navigation component for the Arena Dashboard.
 * Provides consistent navigation across all pages with active link highlighting.
 * @packageDocumentation
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

/**
 * Navigation link configuration.
 */
type NavLink = {
  /** Display label for the navigation link */
  label: string
  /** URL path for the navigation link */
  href: string
}

/**
 * Array of navigation links displayed in the header.
 */
const navLinks: readonly NavLink[] = [
  { label: 'Dashboard', href: '/' },
  { label: 'Issues', href: '/issues' },
]

/**
 * Navigation component with active link detection.
 * Uses Next.js usePathname hook to highlight the current page.
 *
 * @returns Navigation header component
 */
export function Navigation(): React.JSX.Element {
  const pathname = usePathname()

  /**
   * Determines if a link is currently active.
   * Home route ("/") is active only on exact match.
   * Other routes are active if pathname starts with the href.
   *
   * @param href - The link href to check
   * @returns True if the link is active
   */
  const isActive = (href: string): boolean => {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(href)
  }

  return (
    <nav className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b border-border backdrop-blur">
      <div className="container mx-auto flex h-14 max-w-7xl items-center px-4">
        <div className="mr-8 flex items-center">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-foreground transition-colors hover:text-blue-900"
          >
            Arena Dashboard
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <nav className="flex items-center space-x-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-foreground',
                  isActive(link.href)
                    ? 'text-foreground'
                    : 'text-foreground-secondary'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </nav>
  )
}
