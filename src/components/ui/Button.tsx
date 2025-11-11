import type { BaseProps } from '@/types'

/**
 * Button variant types.
 */
export type ButtonVariant = 'primary' | 'secondary'

/**
 * Button component props.
 */
export type ButtonProps = BaseProps & {
  /** Button text or children */
  children: React.ReactNode
  /** Click handler */
  onClick?: () => void
  /** Disabled state */
  disabled?: boolean
  /** Visual variant */
  variant?: ButtonVariant
}

/**
 * Reusable button component with multiple variants.
 *
 * @param props - Button component props
 * @returns A styled button element
 *
 * @example
 * ```tsx
 * <Button onClick={() => console.log('clicked')} variant="primary">
 *   Click Me
 * </Button>
 * ```
 */
export function Button({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  className = '',
  testId = 'button',
}: ButtonProps): React.JSX.Element {
  const baseStyles =
    'px-4 py-2 rounded font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

  const variantStyles: Record<ButtonVariant, string> = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700',
  }

  const styles = `${baseStyles} ${variantStyles[variant]} ${className}`

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={styles}
      data-testid={testId}
    >
      {children}
    </button>
  )
}
