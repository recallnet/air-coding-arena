/**
 * Card component with Geist design system styling.
 * Displays content in a contained, minimal surface with subtle borders.
 * @packageDocumentation
 */

import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Card container component.
 * Uses Geist's minimal aesthetic with subtle borders and no shadows.
 *
 * @param props - Standard div props
 */
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-geist border border-border bg-background p-6 transition-colors hover:border-border-hover',
      className
    )}
    {...props}
  />
))
Card.displayName = 'Card'

/**
 * Card header component.
 *
 * @param props - Standard div props
 */
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-2 pb-4', className)}
    {...props}
  />
))
CardHeader.displayName = 'CardHeader'

/**
 * Card title component.
 *
 * @param props - Standard heading props
 */
const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'text-xl font-semibold leading-tight tracking-tight text-foreground',
      className
    )}
    {...props}
  />
))
CardTitle.displayName = 'CardTitle'

/**
 * Card description component.
 *
 * @param props - Standard paragraph props
 */
const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-foreground-secondary', className)}
    {...props}
  />
))
CardDescription.displayName = 'CardDescription'

/**
 * Card content component.
 *
 * @param props - Standard div props
 */
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('', className)} {...props} />
))
CardContent.displayName = 'CardContent'

/**
 * Card footer component.
 *
 * @param props - Standard div props
 */
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center pt-4', className)}
    {...props}
  />
))
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
