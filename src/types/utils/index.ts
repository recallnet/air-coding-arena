/**
 * Utility type helpers.
 *
 * @packageDocumentation
 */

/**
 * Makes all properties of T optional recursively.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * Makes all properties of T required recursively.
 */
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P]
}

/**
 * Extracts keys from T where value is of type V.
 */
export type KeysOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never
}[keyof T]
