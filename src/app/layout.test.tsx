import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import RootLayout, { metadata } from './layout'

describe('RootLayout', () => {
  describe('when rendered', () => {
    it('should render children', () => {
      const { container } = render(
        <RootLayout>
          <div>Test Content</div>
        </RootLayout>
      )

      expect(container.textContent).toContain('Test Content')
    })

    it('should have html lang attribute set to en', () => {
      const { container } = render(
        <RootLayout>
          <div>Test</div>
        </RootLayout>
      )

      const html = container.querySelector('html')
      expect(html).toHaveAttribute('lang', 'en')
    })

    it('should include body element', () => {
      const { container } = render(
        <RootLayout>
          <div>Test</div>
        </RootLayout>
      )

      const body = container.querySelector('body')
      expect(body).toBeInTheDocument()
    })
  })

  describe('metadata', () => {
    it('should have correct title', () => {
      expect(metadata.title).toBe('Coding Arena')
    })

    it('should have correct description', () => {
      expect(metadata.description).toBe(
        'Next.js 15 with zero-tolerance quality gates'
      )
    })
  })
})
