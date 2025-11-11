import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

import './globals.css'

const inter = Inter({ subsets: ['latin'] })

/**
 * Root layout metadata configuration.
 */
export const metadata: Metadata = {
  title: 'Coding Arena',
  description: 'Next.js 15 with zero-tolerance quality gates',
}

/**
 * Root layout component for the application.
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
      <body className={inter.className}>{children}</body>
    </html>
  )
}
