import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { CIStatusIndicator } from './CIStatusIndicator'

describe('CIStatusIndicator', () => {
  it('renders passing status with green indicator', () => {
    render(<CIStatusIndicator status="passing" />)

    const indicator = screen.getByText('Passing').previousElementSibling
    expect(indicator).toHaveClass('bg-green-700')
  })

  it('renders failing status with red indicator', () => {
    render(<CIStatusIndicator status="failing" />)

    const indicator = screen.getByText('Failing').previousElementSibling
    expect(indicator).toHaveClass('bg-red-700')
  })

  it('renders pending status with yellow indicator', () => {
    render(<CIStatusIndicator status="pending" />)

    const indicator = screen.getByText('Pending').previousElementSibling
    expect(indicator).toHaveClass('bg-amber-700')
  })

  it('renders none status with gray indicator', () => {
    render(<CIStatusIndicator status="none" />)

    const indicator = screen.getByText('No Checks').previousElementSibling
    expect(indicator).toHaveClass('bg-gray-400')
  })
})
