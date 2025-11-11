import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    // === TEST ENVIRONMENT ===
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/vitest-setup.ts'],

    // === COVERAGE THRESHOLDS - DO NOT LOWER ===
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.config.*',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/types/**',
        '.next/',
        'coverage/',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },

    // === TEST BEHAVIOR ===
    globals: true,
    restoreMocks: true,
    clearMocks: true,
    mockReset: true,

    // === PREVENT .only IN CI ===
    allowOnly: process.env['CI'] !== 'true',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/types': path.resolve(__dirname, './src/types'),
    },
  },
})
