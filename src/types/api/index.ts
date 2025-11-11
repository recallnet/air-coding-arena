/**
 * API request and response type definitions.
 *
 * @packageDocumentation
 */

/**
 * Standard API response wrapper.
 *
 * @typeParam T - The type of the response data
 */
export type ApiResponse<T> = {
  /** Response data */
  data: T
  /** Response status code */
  status: number
  /** Optional error message */
  error?: string
}

/**
 * API error response.
 */
export type ApiError = {
  /** Error message */
  message: string
  /** Error code */
  code: string
  /** HTTP status code */
  status: number
}
