import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import Home from './page'

describe('Home', () => {
  describe('when rendered', () => {
    it('should display the page title', () => {
      render(<Home />)

      expect(
        screen.getByRole('heading', { name: 'Coding Arena' })
      ).toBeInTheDocument()
    })

    it('should display the subtitle', () => {
      render(<Home />)

      expect(
        screen.getByText('Next.js 15 with Zero-Tolerance Quality Gates')
      ).toBeInTheDocument()
    })

    it('should display all quality gate features', () => {
      render(<Home />)

      expect(screen.getByText('✅ 100% Type Coverage')).toBeInTheDocument()
      expect(screen.getByText('✅ Zero ESLint Warnings')).toBeInTheDocument()
      expect(screen.getByText('✅ 90% Test Coverage')).toBeInTheDocument()
      expect(screen.getByText('✅ 18 ESLint Plugins')).toBeInTheDocument()
      expect(screen.getByText('✅ Husky Pre-Commit Hooks')).toBeInTheDocument()
    })
  })
})
