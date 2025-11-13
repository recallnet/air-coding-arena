/**
 * Tests for AgentConfigPlaceholder component.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AgentConfigPlaceholder } from './AgentConfigPlaceholder'

describe('AgentConfigPlaceholder', () => {
  describe('Rendering', () => {
    it('should render card with title', () => {
      render(<AgentConfigPlaceholder />)

      expect(screen.getByText('Configuration')).toBeInTheDocument()
      expect(screen.getByText('Agent assignment settings')).toBeInTheDocument()
    })

    it('should show "Coming in Milestone 3" badge', () => {
      render(<AgentConfigPlaceholder />)

      expect(screen.getByText('Coming in Milestone 3')).toBeInTheDocument()
    })
  })

  describe('Configuration Options', () => {
    it('should render all three mode options', () => {
      render(<AgentConfigPlaceholder />)

      expect(screen.getByText('Run all agents')).toBeInTheDocument()
      expect(screen.getByText('Max N agents')).toBeInTheDocument()
      expect(screen.getByText('Manual assignment only')).toBeInTheDocument()
    })

    it('should show description for Run all agents', () => {
      render(<AgentConfigPlaceholder />)

      expect(
        screen.getByText('Assign all enabled agents to every issue')
      ).toBeInTheDocument()
    })

    it('should show description for Max N agents', () => {
      render(<AgentConfigPlaceholder />)

      expect(
        screen.getByText(
          'Random sample of N enabled agents per issue (minimum 2)'
        )
      ).toBeInTheDocument()
    })

    it('should show description for Manual assignment', () => {
      render(<AgentConfigPlaceholder />)

      expect(
        screen.getByText('No auto-assignment, listen for @mentions in comments')
      ).toBeInTheDocument()
    })
  })

  describe('Disabled State', () => {
    it('should have all radio buttons disabled', () => {
      render(<AgentConfigPlaceholder />)

      const radios = screen.getAllByRole('radio')
      expect(radios).toHaveLength(3)
      for (const radio of radios) {
        expect(radio).toBeDisabled()
      }
    })

    it('should have max agents number input disabled', () => {
      render(<AgentConfigPlaceholder />)

      const numberInput = screen.getByRole('spinbutton')
      expect(numberInput).toBeDisabled()
      expect(numberInput).toHaveValue(5)
    })

    it('should have opacity styling to indicate disabled state', () => {
      const { container } = render(<AgentConfigPlaceholder />)

      const disabledSection = container.querySelector('.opacity-50')
      expect(disabledSection).toBeInTheDocument()
    })
  })

  describe('Max Agents Input', () => {
    it('should show max agents label', () => {
      render(<AgentConfigPlaceholder />)

      expect(screen.getByText('Max agents:')).toBeInTheDocument()
    })

    it('should have min value of 2', () => {
      render(<AgentConfigPlaceholder />)

      const numberInput = screen.getByRole('spinbutton')
      expect(numberInput).toHaveAttribute('min', '2')
    })

    it('should have default value of 5', () => {
      render(<AgentConfigPlaceholder />)

      const numberInput = screen.getByRole('spinbutton')
      expect(numberInput).toHaveValue(5)
    })
  })
})
