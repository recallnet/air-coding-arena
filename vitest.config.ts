import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react()],
  test: {
    // === TEST ENVIRONMENT ===
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/vitest-setup.ts'],

    // === WORKER POOL CONFIGURATION ===
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 8,
        minThreads: 1,
      },
    },
    testTimeout: 10000, // 10s max per test
    teardownTimeout: 5000, // 5s to cleanup workers

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
        'src/db/**',
        'scripts/**',
        'drizzle/**',
        '.next/',
        'coverage/',
        'docs/',
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
