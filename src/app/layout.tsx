import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import type { Metadata } from 'next'

import { Navigation } from '@/components/Navigation'

import './globals.css'

/**
 * Root layout metadata configuration.
 */
export const metadata: Metadata = {
  title: {
    default: 'Air Coding Arena',
    template: '%s | Air Coding Arena',
  },
  description:
    'AI Agent coding arena dashboard for tracking issues and performance',
  keywords: [
    'AI agents',
    'coding arena',
    'agent performance',
    'GitHub integration',
    'Linear workflow',
    'developer tools',
  ],
  authors: [{ name: 'Air Coding Arena Team' }],
  creator: 'Air Coding Arena Team',
  applicationName: 'Air Coding Arena',
  generator: 'Next.js',
  metadataBase: new URL('https://coding-arena.vercel.app'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://coding-arena.vercel.app',
    title: 'Air Coding Arena',
    description:
      'AI Agent coding arena dashboard for tracking issues and performance',
    siteName: 'Air Coding Arena',
  },
  twitter: {
    card: 'summary',
    title: 'Air Coding Arena',
    description:
      'AI Agent coding arena dashboard for tracking issues and performance',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

/**
 * Root layout component for the application.
 * Includes navigation header, main content area, and footer.
 *
 * @param props - Component props
 * @param props.children - Child components to render
 * @returns The root layout
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>): React.JSX.Element {
  return (
    <html
      lang="en"
      className={`dark ${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="antialiased">
        <div className="flex min-h-screen flex-col">
          <Navigation />
          <main className="container mx-auto flex-1 px-4 py-8">{children}</main>
          <footer className="border-t border-border bg-gray-100 py-6">
            <div className="container mx-auto px-4 text-center">
              <p className="text-sm text-foreground-secondary">
                Air Coding Arena - Real-time AI agent performance tracking
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
