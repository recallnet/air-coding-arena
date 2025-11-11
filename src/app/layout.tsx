import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

import { Navigation } from '@/components/Navigation'

import './globals.css'

const inter = Inter({ subsets: ['latin'] })

/**
 * Root layout metadata configuration.
 */
export const metadata: Metadata = {
  title: 'Arena Dashboard',
  description:
    'AI Agent coding arena dashboard for tracking issues and performance',
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
    <html lang="en">
      <body className={inter.className}>
        <div className="flex min-h-screen flex-col">
          <Navigation />
          <main className="container mx-auto flex-1 px-4 py-8">{children}</main>
          <footer className="border-t bg-muted/50 py-6">
            <div className="container mx-auto px-4 text-center">
              <p className="text-sm text-muted-foreground">
                Demo Mode (Milestone 1): Currently displaying sample data.
                Real-time webhook integration coming in Milestone 2.
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
