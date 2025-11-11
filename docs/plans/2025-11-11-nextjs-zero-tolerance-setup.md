# Next.js Zero-Tolerance Quality Setup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up a production-ready Next.js 15 application with maximum type safety, linting, test coverage, and zero-tolerance quality gates enforced via Husky hooks.

**Architecture:** Next.js 15 App Router with centralized TypeScript types, 18 ESLint plugins at maximum strictness, Vitest with vitest-mock-extended for type-safe testing, and Husky pre-commit/pre-push hooks enforcing 100% type coverage and 90% test coverage.

**Tech Stack:** Next.js 15, TypeScript 5.6 (strict mode), Tailwind CSS, Vitest, 18 ESLint plugins, Husky, TypeDoc

---

## Task 1: Initialize Package.json and Git Configuration

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.npmrc`

**Step 1: Create package.json with all dependencies**

Create `package.json`:

```json
{
  "name": "coding-arena",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "// === DEV SCRIPTS ===": "",
    "predev": "lsof -ti:3109 | xargs kill -9 2>/dev/null || true",
    "dev": "next dev -p 3109",
    "start": "next start -p 3109",

    "// === VALIDATION SCRIPTS - DO NOT MODIFY ===": "",
    "type-check": "tsc --noEmit && type-coverage --at-least 100 --strict --ignore-files '**/*.test.ts*' --ignore-files '**/*.config.*' --ignore-files '**/vitest-setup.ts'",
    "type-coverage": "type-coverage --at-least 100 --strict --ignore-files '**/*.test.ts*' --ignore-files '**/*.config.*' --ignore-files '**/vitest-setup.ts'",

    "// === LINT SCRIPTS - ZERO TOLERANCE ===": "",
    "lint": "eslint . --max-warnings 0",
    "lint:fix": "eslint . --fix --max-warnings 0",

    "// === TEST SCRIPTS - 90% COVERAGE REQUIRED ===": "",
    "test": "vitest run --coverage --coverage.lines=90 --coverage.functions=90 --coverage.branches=90 --coverage.statements=90",
    "test:watch": "vitest --coverage",
    "test:ui": "vitest --ui --coverage",

    "// === FORMAT SCRIPTS ===": "",
    "format:check": "prettier --check .",
    "format": "prettier --write .",

    "// === VALIDATION GATE - ALL CHECKS ===": "",
    "validate": "npm run type-check && npm run lint && npm run test && npm run format:check",

    "// === BUILD - RUNS VALIDATION FIRST ===": "",
    "build": "npm run validate && next build",

    "// === DOCS GENERATION ===": "",
    "docs": "typedoc",
    "docs:serve": "npm run docs && npx serve docs/api",

    "// === HUSKY SETUP ===": "",
    "prepare": "husky"
  },
  "dependencies": {
    "next": "^15.0.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@next/eslint-plugin-next": "^15.0.3",
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/node": "^22.8.6",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@typescript-eslint/eslint-plugin": "^8.11.0",
    "@typescript-eslint/parser": "^8.11.0",
    "@vitest/coverage-v8": "^2.1.3",
    "@vitest/ui": "^2.1.3",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.13.0",
    "eslint-config-next": "^15.0.3",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-boundaries": "^4.2.2",
    "eslint-plugin-eslint-comments": "^3.2.0",
    "eslint-plugin-functional": "^7.0.2",
    "eslint-plugin-import": "^2.31.0",
    "eslint-plugin-jsdoc": "^50.4.3",
    "eslint-plugin-jsx-a11y": "^6.10.0",
    "eslint-plugin-no-secrets": "^1.0.2",
    "eslint-plugin-promise": "^7.1.0",
    "eslint-plugin-react": "^7.37.1",
    "eslint-plugin-react-hooks": "^5.0.0",
    "eslint-plugin-security": "^3.0.1",
    "eslint-plugin-sonarjs": "^2.0.3",
    "eslint-plugin-testing-library": "^6.3.0",
    "eslint-plugin-unicorn": "^56.0.0",
    "eslint-plugin-vitest": "^0.5.4",
    "husky": "^9.1.6",
    "jsdom": "^25.0.1",
    "lint-staged": "^15.2.10",
    "postcss": "^8.4.47",
    "prettier": "^3.3.3",
    "prettier-plugin-tailwindcss": "^0.6.8",
    "tailwindcss": "^3.4.14",
    "type-coverage": "^2.29.1",
    "typedoc": "^0.26.10",
    "typescript": "^5.6.3",
    "vitest": "^2.1.3",
    "vitest-mock-extended": "^2.0.2"
  },
  "engines": {
    "node": ">=18.18.0",
    "npm": ">=9.0.0"
  }
}
```

**Step 2: Create .gitignore**

Create `.gitignore`:

```gitignore
# dependencies
node_modules
.pnp
.pnp.js

# testing
coverage
*.lcov

# next.js
.next/
out/
build
dist

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# env files
.env
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts

# IDE
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json
.idea

# docs output
docs/api
```

**Step 3: Create .npmrc for consistent dependency resolution**

Create `.npmrc`:

```
legacy-peer-deps=false
save-exact=false
engine-strict=true
```

**Step 4: Install dependencies**

Run: `npm install`

Expected: All dependencies installed without errors

**Step 5: Commit**

Run:
```bash
git add package.json package-lock.json .gitignore .npmrc
git commit -m "chore: initialize project with dependencies and git configuration

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: TypeScript Configuration

**Files:**
- Create: `tsconfig.json`
- Auto-generate (do not commit): `next-env.d.ts`

**Step 1: Create strict TypeScript configuration**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "// === STRICT MODE - NEVER DISABLE THESE ===": "",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,
    "allowUnusedLabels": false,
    "allowUnreachableCode": false,

    "// === TYPE CHECKING - NEVER DISABLE THESE ===": "",
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "forceConsistentCasingInFileNames": true,
    "// skipLibCheck: true is the CORRECT setting for Next.js projects": "",
    "// Next.js dependencies include conflicting types that cannot be resolved": "",
    "skipLibCheck": true,

    "// === MODULE RESOLUTION ===": "",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "esModuleInterop": true,
    "allowJs": true,

    "// === PATH MAPPING ===": "",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/types": ["./src/types"]
    },

    "// === OUTPUT ===": "",
    "noEmit": true,

    "// === NEXT.JS SPECIFIC ===": "",
    "plugins": [
      {
        "name": "next"
      }
    ]
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    ".next",
    "out",
    "dist",
    "coverage"
  ]
}
```

**Step 2: Run Next.js to auto-generate next-env.d.ts**

Note: `next-env.d.ts` is auto-generated by Next.js and should NOT be manually created or committed. It is correctly excluded in `.gitignore` from Task 1.

Run: `npm run dev` (Ctrl+C after it starts successfully)

Expected: `next-env.d.ts` is auto-generated in the project root.

**Step 3: Verify TypeScript configuration**

Run: `npx tsc --noEmit`

Expected: No errors (project files not created yet, but config should parse)

**Step 4: Commit TypeScript configuration**

Note: Only `tsconfig.json` is committed. The auto-generated `next-env.d.ts` is correctly excluded by `.gitignore` and should NOT be committed.

Run:
```bash
git add tsconfig.json
git commit -m "chore: add strict TypeScript configuration

Note: skipLibCheck: true is the correct setting for Next.js projects
due to conflicting types in Next.js dependencies.

next-env.d.ts is auto-generated and correctly excluded by .gitignore.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: ESLint Configuration

**Files:**
- Create: `eslint.config.mjs`
- Create: `.eslintignore`

**Step 1: Create ESLint configuration with 18 plugins**

Create `eslint.config.mjs`:

```javascript
import { FlatCompat } from '@eslint/eslintrc'
import js from '@eslint/js'
import typescriptParser from '@typescript-eslint/parser'
import typescriptPlugin from '@typescript-eslint/eslint-plugin'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y'
import importPlugin from 'eslint-plugin-import'
import unicornPlugin from 'eslint-plugin-unicorn'
import sonarjsPlugin from 'eslint-plugin-sonarjs'
import securityPlugin from 'eslint-plugin-security'
import noSecretsPlugin from 'eslint-plugin-no-secrets'
import promisePlugin from 'eslint-plugin-promise'
import vitestPlugin from 'eslint-plugin-vitest'
import testingLibraryPlugin from 'eslint-plugin-testing-library'
import jsdocPlugin from 'eslint-plugin-jsdoc'
import functionalPlugin from 'eslint-plugin-functional'
import boundariesPlugin from 'eslint-plugin-boundaries'
import eslintCommentsPlugin from 'eslint-plugin-eslint-comments'
import nextPlugin from '@next/eslint-plugin-next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

export default [
  js.configs.recommended,
  {
    ignores: [
      '.next/**',
      'out/**',
      'node_modules/**',
      'coverage/**',
      'dist/**',
      'build/**',
      'docs/api/**',
    ],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        project: './tsconfig.json',
      },
      globals: {
        React: 'readonly',
        JSX: 'readonly',
        NodeJS: 'readonly',
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
        node: true,
      },
      boundaries: {
        elements: [
          {
            type: 'components',
            pattern: 'src/components/**',
          },
          {
            type: 'types',
            pattern: 'src/types/**',
          },
          {
            type: 'lib',
            pattern: 'src/lib/**',
          },
        ],
      },
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': jsxA11yPlugin,
      import: importPlugin,
      unicorn: unicornPlugin,
      sonarjs: sonarjsPlugin,
      security: securityPlugin,
      'no-secrets': noSecretsPlugin,
      promise: promisePlugin,
      vitest: vitestPlugin,
      'testing-library': testingLibraryPlugin,
      jsdoc: jsdocPlugin,
      functional: functionalPlugin,
      boundaries: boundariesPlugin,
      'eslint-comments': eslintCommentsPlugin,
      '@next/next': nextPlugin,
    },
    rules: {
      // === TYPE SAFETY - NEVER DISABLE ===
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true,
          'ts-nocheck': true,
          minimumDescriptionLength: 10,
        },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',

      // === TYPE IMPORTS - ENFORCES CENTRALIZATION ===
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
          disallowTypeAnnotations: false,
        },
      ],

      // === PREVENTS TYPE DUPLICATION ===
      'import/no-duplicates': ['error', { 'prefer-inline': false }],
      '@typescript-eslint/no-duplicate-type-constituents': 'error',

      // === TYPESCRIPT BEST PRACTICES ===
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // === REACT ===
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react/jsx-no-leaked-render': 'error',
      'react/jsx-curly-brace-presence': ['error', 'never'],

      // === ACCESSIBILITY ===
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-is-valid': 'error',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/no-static-element-interactions': 'error',

      // === IMPORTS ===
      'import/no-cycle': 'error',
      'import/no-self-import': 'error',
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],

      // === CODE QUALITY ===
      'unicorn/prefer-node-protocol': 'error',
      'unicorn/prefer-module': 'error',
      'unicorn/no-array-for-each': 'error',
      'unicorn/no-null': 'off',
      'sonarjs/cognitive-complexity': ['error', 15],
      'sonarjs/no-duplicate-string': ['error', { threshold: 3 }],
      'sonarjs/no-identical-functions': 'error',

      // === SECURITY ===
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-regexp': 'error',
      'no-secrets/no-secrets': 'error',

      // === PROMISES ===
      'promise/always-return': 'error',
      'promise/catch-or-return': 'error',
      'promise/no-nesting': 'error',

      // === DOCUMENTATION ===
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
          contexts: [
            'TSInterfaceDeclaration',
            'TSTypeAliasDeclaration',
            'TSEnumDeclaration',
          ],
        },
      ],
      'jsdoc/require-param': 'error',
      'jsdoc/require-returns': 'error',
      'jsdoc/require-description': 'error',

      // === ESLINT COMMENTS - PREVENT UNLIMITED DISABLES ===
      'eslint-comments/no-unlimited-disable': 'error',
      'eslint-comments/no-unused-disable': 'error',

      // === NEXT.JS ===
      '@next/next/no-html-link-for-pages': 'error',
      '@next/next/no-img-element': 'error',

      // === FUNCTIONAL PROGRAMMING (SELECTIVE) ===
      'functional/no-let': 'off',
      'functional/prefer-readonly-type': 'off',
      'functional/immutable-data': 'off',

      // === BOUNDARIES - ARCHITECTURAL RULES ===
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            {
              from: 'components',
              allow: ['components', 'lib', 'types'],
            },
            {
              from: 'lib',
              allow: ['lib', 'types'],
            },
            {
              from: 'types',
              allow: ['types'],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      'vitest/expect-expect': 'error',
      'vitest/no-disabled-tests': 'warn',
      'vitest/no-focused-tests': 'error',
      'vitest/valid-expect': 'error',
      'testing-library/await-async-queries': 'error',
      'testing-library/no-wait-for-multiple-assertions': 'error',
      'jsdoc/require-jsdoc': 'off',
    },
  },
]
```

**Step 2: Create .eslintignore**

Create `.eslintignore`:

```
.next
out
node_modules
coverage
dist
build
docs/api
*.config.js
*.config.mjs
next-env.d.ts
```

**Step 3: Verify ESLint configuration**

Run: `npm run lint`

Expected: ESLint runs (may show errors if no source files exist yet)

**Step 4: Commit**

Run:
```bash
git add eslint.config.mjs .eslintignore
git commit -m "chore: add ESLint configuration with 18 plugins

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Prettier Configuration

**Files:**
- Create: `.prettierrc`
- Create: `.prettierignore`

**Step 1: Create Prettier configuration**

Create `.prettierrc`:

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 80,
  "arrowParens": "always",
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

**Step 2: Create .prettierignore**

Create `.prettierignore`:

```
.next
out
node_modules
coverage
dist
build
docs/api
package-lock.json
pnpm-lock.yaml
yarn.lock
*.min.js
```

**Step 3: Verify Prettier configuration**

Run: `npm run format:check`

Expected: Prettier runs successfully

**Step 4: Commit**

Run:
```bash
git add .prettierrc .prettierignore
git commit -m "chore: add Prettier configuration

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Vitest Configuration

**Files:**
- Create: `vitest.config.ts`
- Create: `src/__tests__/vitest-setup.ts`

**Step 1: Create Vitest configuration**

Create `vitest.config.ts`:

```typescript
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
    allowOnly: process.env.CI !== 'true',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/types': path.resolve(__dirname, './src/types'),
    },
  },
})
```

**Step 2: Create Vitest setup file**

Create `src/__tests__/vitest-setup.ts`:

```typescript
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

/**
 * Cleanup after each test automatically.
 * Ensures no test pollution between test cases.
 */
afterEach(() => {
  cleanup()
})
```

**Step 3: Verify Vitest configuration**

Run: `npm run test -- --run`

Expected: Vitest runs (no tests to run yet, but should not error)

**Step 4: Commit**

Run:
```bash
git add vitest.config.ts src/__tests__/vitest-setup.ts
git commit -m "chore: add Vitest configuration with 90% coverage threshold

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Tailwind CSS Configuration

**Files:**
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`

**Step 1: Create Tailwind configuration**

Create `tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      },
    },
  },
  plugins: [],
}

export default config
```

**Step 2: Create PostCSS configuration**

Create `postcss.config.mjs`:

```javascript
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}

export default config
```

**Step 3: Commit**

Run:
```bash
git add tailwind.config.ts postcss.config.mjs
git commit -m "chore: add Tailwind CSS configuration

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: TypeDoc Configuration

**Files:**
- Create: `typedoc.json`

**Step 1: Create TypeDoc configuration**

Create `typedoc.json`:

```json
{
  "// DO NOT MODIFY - TypeDoc configuration for API documentation": "",
  "entryPoints": ["./src"],
  "entryPointStrategy": "expand",
  "out": "./docs/api",
  "exclude": [
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.spec.ts",
    "**/*.spec.tsx",
    "**/__tests__/**",
    "**/node_modules/**"
  ],
  "excludePrivate": true,
  "excludeProtected": false,
  "excludeExternals": true,
  "readme": "none",
  "plugin": [],
  "validation": {
    "notExported": true,
    "invalidLink": true,
    "notDocumented": true
  },
  "treatWarningsAsErrors": true,
  "categorizeByGroup": true,
  "sort": ["source-order"],
  "kindSortOrder": [
    "Project",
    "Module",
    "Namespace",
    "Enum",
    "Interface",
    "TypeAlias",
    "Class",
    "Function",
    "Variable"
  ]
}
```

**Step 2: Commit**

Run:
```bash
git add typedoc.json
git commit -m "chore: add TypeDoc configuration

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Centralized Types Structure

**Files:**
- Create: `src/types/index.ts`
- Create: `src/types/api/index.ts`
- Create: `src/types/domain/index.ts`
- Create: `src/types/components/index.ts`
- Create: `src/types/utils/index.ts`

**Step 1: Create central types export**

Create `src/types/index.ts`:

```typescript
/**
 * Central type definitions export.
 *
 * DO NOT IMPORT FROM SUBDIRECTORIES.
 * Always import from '@/types' or 'src/types'.
 *
 * @packageDocumentation
 */

export type * from './api'
export type * from './domain'
export type * from './components'
export type * from './utils'
```

**Step 2: Create API types directory**

Create `src/types/api/index.ts`:

```typescript
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
```

**Step 3: Create domain types directory**

Create `src/types/domain/index.ts`:

```typescript
/**
 * Business domain model type definitions.
 *
 * @packageDocumentation
 */

/**
 * Example user entity.
 */
export type User = {
  /** Unique user identifier */
  id: string
  /** User's display name */
  name: string
  /** User's email address */
  email: string
  /** Account creation timestamp */
  createdAt: Date
}
```

**Step 4: Create component types directory**

Create `src/types/components/index.ts`:

```typescript
/**
 * React component prop type definitions.
 *
 * @packageDocumentation
 */

/**
 * Base props for all components.
 */
export type BaseProps = {
  /** Optional CSS class name */
  className?: string
  /** Optional test ID for testing */
  testId?: string
}

/**
 * Props for components with children.
 */
export type WithChildren<T = Record<string, never>> = T & {
  /** React children */
  children: React.ReactNode
}
```

**Step 5: Create utility types directory**

Create `src/types/utils/index.ts`:

```typescript
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
```

**Step 6: Commit**

Run:
```bash
git add src/types/
git commit -m "feat: add centralized type definitions structure

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: Next.js App Router Setup

**Files:**
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`

**Step 1: Create root layout**

Create `src/app/layout.tsx`:

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

import './globals.css'

const inter = Inter({ subsets: ['latin'] })

/**
 * Root layout metadata configuration.
 */
export const metadata: Metadata = {
  title: 'Coding Arena',
  description: 'Next.js 15 with zero-tolerance quality gates',
}

/**
 * Root layout component for the application.
 *
 * @param props - Component props
 * @param props.children - Child components to render
 * @returns The root layout
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>): React.JSX.Element {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

**Step 2: Create home page**

Create `src/app/page.tsx`:

```typescript
/**
 * Home page component.
 *
 * @returns The home page
 */
export default function Home(): React.JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="flex flex-col items-center gap-8">
        <h1 className="text-4xl font-bold">Coding Arena</h1>
        <p className="text-xl text-gray-600">
          Next.js 15 with Zero-Tolerance Quality Gates
        </p>
        <div className="flex flex-col gap-2 text-sm text-gray-500">
          <div>✅ 100% Type Coverage</div>
          <div>✅ Zero ESLint Warnings</div>
          <div>✅ 90% Test Coverage</div>
          <div>✅ 18 ESLint Plugins</div>
          <div>✅ Husky Pre-Commit Hooks</div>
        </div>
      </div>
    </main>
  )
}
```

**Step 3: Create global CSS with Tailwind directives**

Create `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

body {
  color: var(--foreground);
  background: var(--background);
  font-family: Arial, Helvetica, sans-serif;
}
```

**Step 4: Create Next.js configuration**

Create `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // DO NOT MODIFY - TypeScript errors must be fixed, not ignored
    ignoreBuildErrors: false,
  },
  eslint: {
    // DO NOT MODIFY - ESLint errors must be fixed, not ignored
    ignoreDuringBuilds: false,
  },
}

module.exports = nextConfig
```

**Step 5: Verify app compiles**

Run: `npm run type-check`

Expected: TypeScript compilation succeeds

**Step 6: Commit**

Run:
```bash
git add src/app/ next.config.js
git commit -m "feat: add Next.js App Router setup with home page

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10: Example Component with Tests

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Button.test.tsx`

**Step 1: Write failing test for Button component**

Create `src/components/ui/Button.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Button } from './Button'

describe('Button', () => {
  describe('when rendered with text', () => {
    it('should display the button text', () => {
      render(<Button>Click me</Button>)

      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
    })
  })

  describe('when clicked', () => {
    it('should call onClick handler', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()

      render(<Button onClick={handleClick}>Click me</Button>)

      await user.click(screen.getByRole('button', { name: 'Click me' }))

      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('when disabled', () => {
    it('should not call onClick handler', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()

      render(<Button onClick={handleClick} disabled>Click me</Button>)

      await user.click(screen.getByRole('button', { name: 'Click me' }))

      expect(handleClick).not.toHaveBeenCalled()
    })

    it('should have disabled attribute', () => {
      render(<Button disabled>Click me</Button>)

      expect(screen.getByRole('button', { name: 'Click me' })).toBeDisabled()
    })
  })

  describe('when variant is primary', () => {
    it('should have primary styles', () => {
      render(<Button variant="primary">Click me</Button>)

      const button = screen.getByRole('button', { name: 'Click me' })
      expect(button).toHaveClass('bg-blue-600')
    })
  })

  describe('when variant is secondary', () => {
    it('should have secondary styles', () => {
      render(<Button variant="secondary">Click me</Button>)

      const button = screen.getByRole('button', { name: 'Click me' })
      expect(button).toHaveClass('bg-gray-600')
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- Button.test.tsx`

Expected: Test fails with "Cannot find module './Button'"

**Step 3: Write minimal Button implementation**

Create `src/components/ui/Button.tsx`:

```typescript
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
  const baseStyles = 'px-4 py-2 rounded font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

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
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- Button.test.tsx`

Expected: All tests pass

**Step 5: Verify coverage**

Run: `npm run test -- --coverage Button.test.tsx`

Expected: 100% coverage for Button.tsx

**Step 6: Commit**

Run:
```bash
git add src/components/ui/
git commit -m "feat: add Button component with comprehensive tests

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 11: Husky Hooks Setup

**Files:**
- Create: `.husky/pre-commit`
- Create: `.husky/pre-push`
- Create: `.lintstagedrc.json`

**Step 1: Initialize Husky**

Run: `npx husky init`

Expected: `.husky/` directory created

**Step 2: Create pre-commit hook**

Create `.husky/pre-commit`:

```bash
#!/usr/bin/env sh
# === PRE-COMMIT HOOK - DO NOT MODIFY ===
# This hook runs on every commit and enforces zero-tolerance quality gates.
# All checks must pass. No exceptions.

echo "🔒 Running pre-commit quality gates..."

# Stage 1: Type check
echo "\n📘 Stage 1/7: TypeScript compilation check..."
npm run type-check || {
  echo "❌ TypeScript compilation failed. Fix type errors before committing."
  exit 1
}

# Stage 2: Type coverage check
echo "\n📊 Stage 2/7: Type coverage check (100% required)..."
npm run type-coverage || {
  echo "❌ Type coverage below 100%. No implicit 'any' types allowed."
  exit 1
}

# Stage 3: ESLint (zero warnings)
echo "\n🔍 Stage 3/7: ESLint check (zero warnings policy)..."
npm run lint || {
  echo "❌ ESLint errors found. Run 'npm run lint:fix' to attempt auto-fix."
  exit 1
}

# Stage 4: Prettier check (must be formatted)
echo "\n✨ Stage 4/7: Prettier format check..."
npm run format:check || {
  echo "❌ Code not formatted. Run 'npm run format' before committing."
  exit 1
}

# Stage 5: Tests
echo "\n🧪 Stage 5/7: Running all tests..."
npm run test || {
  echo "❌ Tests failed. All tests must pass before committing."
  exit 1
}

# Stage 6: Documentation check
echo "\n📚 Stage 6/7: Documentation coverage check..."
npm run docs || {
  echo "❌ Documentation generation failed. Ensure all public APIs have TSDoc comments."
  exit 1
}

# Stage 7: Build check
echo "\n🏗️  Stage 7/7: Build check..."
npm run build || {
  echo "❌ Build failed. Code must build successfully before committing."
  exit 1
}

echo "\n✅ All pre-commit checks passed!"
```

**Step 3: Create pre-push hook**

Create `.husky/pre-push`:

```bash
#!/usr/bin/env sh
# === PRE-PUSH HOOK - DO NOT MODIFY ===
# This hook runs before pushing and ensures production-ready code.

echo "🚀 Running pre-push validation..."

# Full validation suite
echo "\n🔬 Running complete validation suite..."
npm run validate || {
  echo "❌ Validation failed. Code must pass all checks before pushing."
  exit 1
}

# Production build test
echo "\n🏗️  Testing production build..."
npm run build || {
  echo "❌ Production build failed. Fix build errors before pushing."
  exit 1
}

echo "\n✅ All pre-push checks passed! Safe to push."
```

**Step 4: Make hooks executable**

Run: `chmod +x .husky/pre-commit .husky/pre-push`

Expected: Hooks are now executable

**Step 5: Create lint-staged configuration**

Create `.lintstagedrc.json`:

```json
{
  "*.{ts,tsx}": [
    "eslint --max-warnings 0 --fix",
    "prettier --write"
  ],
  "*.{json,md,css}": [
    "prettier --write"
  ]
}
```

**Step 6: Commit**

Run:
```bash
git add .husky/ .lintstagedrc.json
git commit -m "chore: add Husky hooks with zero-tolerance quality gates

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 12: VS Code Workspace Configuration

**Files:**
- Create: `.vscode/settings.json`
- Create: `.vscode/extensions.json`

**Step 1: Create VS Code settings**

Create `.vscode/settings.json`:

```json
{
  "// === EDITOR SETTINGS ===": "",
  "editor.formatOnSave": false,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "editor.defaultFormatter": "esbenp.prettier-vscode",

  "// === TYPESCRIPT SETTINGS ===": "",
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "typescript.preferences.includePackageJsonAutoImports": "on",

  "// === ESLINT SETTINGS ===": "",
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],

  "// === FILE SETTINGS ===": "",
  "files.eol": "\n",
  "files.insertFinalNewline": true,
  "files.trimTrailingWhitespace": true,

  "// === SEARCH EXCLUSIONS ===": "",
  "search.exclude": {
    "**/node_modules": true,
    "**/.next": true,
    "**/coverage": true,
    "**/dist": true,
    "**/build": true
  },

  "// === TAILWIND ===": "",
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

**Step 2: Create VS Code extensions recommendations**

Create `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "vitest.explorer",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

**Step 3: Commit**

Run:
```bash
git add .vscode/
git commit -m "chore: add VS Code workspace configuration

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 13: Documentation and README

**Files:**
- Create: `README.md`

**Step 1: Create comprehensive README**

Create `README.md`:

```markdown
# Coding Arena

Next.js 15 application with zero-tolerance quality gates enforcing maximum type safety, linting, and test coverage.

## 🔒 Quality Standards

- ✅ **100% Type Coverage** - No implicit `any` types allowed
- ✅ **Zero ESLint Warnings** - 18 plugins at maximum strictness
- ✅ **90% Test Coverage** - Enforced across lines, branches, functions, statements
- ✅ **Husky Pre-Commit Hooks** - 7 quality gates before every commit
- ✅ **TypeDoc Documentation** - All public APIs must be documented

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.18.0
- npm >= 9.0.0

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3109](http://localhost:3109) to view the application.

## 📝 Available Scripts

### Development
- `npm run dev` - Start development server
- `npm run build` - Build production application (runs validation first)
- `npm start` - Start production server

### Quality Checks
- `npm run type-check` - TypeScript compilation + type coverage
- `npm run lint` - ESLint with zero warnings policy
- `npm run lint:fix` - Auto-fix ESLint errors where possible
- `npm run test` - Run tests with coverage (90% threshold)
- `npm run test:watch` - Run tests in watch mode
- `npm run test:ui` - Open Vitest UI
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run validate` - Run all quality checks
- `npm run docs` - Generate API documentation
- `npm run docs:serve` - Generate and serve documentation

## 🛡️ Quality Gates

### Pre-Commit Hook (7 Stages)

Every commit must pass:

1. **TypeScript Compilation** - All type errors must be fixed
2. **Type Coverage** - 100% coverage, no implicit `any`
3. **ESLint** - Zero warnings, zero errors
4. **Prettier** - Code must be formatted
5. **Tests** - All tests must pass
6. **Documentation** - TypeDoc must generate successfully
7. **Build** - Production build must succeed

### Pre-Push Hook

Before pushing:

1. **Complete Validation** - All quality checks pass
2. **Production Build** - Build succeeds without errors

## 🏗️ Project Structure

```
coding-arena/
├── src/
│   ├── app/                 # Next.js App Router
│   ├── components/          # React components
│   │   ├── ui/             # Generic UI components
│   │   └── features/       # Feature-specific components
│   ├── lib/                # Utilities and helpers
│   ├── types/              # Centralized TypeScript types
│   │   ├── api/           # API types
│   │   ├── domain/        # Domain models
│   │   ├── components/    # Component prop types
│   │   └── utils/         # Utility types
│   └── __tests__/         # Test utilities
├── docs/
│   ├── api/               # Generated TypeDoc documentation
│   └── plans/             # Design documents
└── public/                # Static assets
```

## 📚 Type Centralization

All TypeScript types are centralized in `src/types/`:

```typescript
// ✅ Correct - Import from central types
import type { User, ApiResponse } from '@/types'

// ❌ Wrong - Direct subdirectory import
import type { User } from '@/types/domain'
```

Components must import types, never define them inline. ESLint boundaries enforce this rule.

## 🧪 Testing

### Writing Tests

Tests are co-located with source files:

```
src/components/Button.tsx
src/components/Button.test.tsx
```

### Using vitest-mock-extended

For type-safe mocks:

```typescript
import { mock } from 'vitest-mock-extended'
import type { UserService } from '@/types'

const mockUserService = mock<UserService>()
mockUserService.getUser.mockResolvedValue({ id: '1', name: 'Test' })
```

### Coverage Requirements

- 90% lines
- 90% branches
- 90% functions
- 90% statements

## 📖 Documentation

All public functions and components require TSDoc comments:

```typescript
/**
 * Brief description of the function.
 *
 * @param param1 - Description of param1
 * @returns Description of return value
 * @example
 * ```typescript
 * const result = myFunction('value')
 * ```
 */
export function myFunction(param1: string): string {
  return param1
}
```

Generate documentation:

```bash
npm run docs
npm run docs:serve
```

## 🔧 ESLint Plugins

This project uses 18 ESLint plugins:

1. **@typescript-eslint** - TypeScript-specific rules
2. **eslint-plugin-react** - React best practices
3. **eslint-plugin-react-hooks** - React Hooks rules
4. **eslint-plugin-jsx-a11y** - Accessibility rules
5. **eslint-plugin-import** - Import/export validation
6. **eslint-plugin-unicorn** - Code quality rules
7. **eslint-plugin-sonarjs** - Code smell detection
8. **eslint-plugin-security** - Security rules
9. **eslint-plugin-no-secrets** - Prevent secret commits
10. **eslint-plugin-promise** - Promise handling
11. **eslint-plugin-vitest** - Vitest testing rules
12. **eslint-plugin-testing-library** - Testing Library rules
13. **eslint-plugin-jsdoc** - JSDoc/TSDoc enforcement
14. **eslint-plugin-functional** - Functional programming patterns
15. **eslint-plugin-boundaries** - Architectural boundaries
16. **eslint-plugin-eslint-comments** - ESLint directive rules
17. **@next/eslint-plugin-next** - Next.js specific rules
18. **eslint-config-prettier** - Prettier compatibility

## ⚠️ Configuration Files

Critical configuration files include comments like:

```typescript
// === STRICT MODE - NEVER DISABLE THESE ===
```

These settings enforce quality standards and should not be modified without team review.

## 📄 License

MIT
```

**Step 2: Commit**

Run:
```bash
git add README.md
git commit -m "docs: add comprehensive README with setup and quality gate documentation

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 14: Verify Complete Setup

**Step 1: Run full validation**

Run: `npm run validate`

Expected: All checks pass (type-check, lint, test, format:check)

**Step 2: Test development server**

Run: `npm run dev` (in background or separate terminal)

Expected: Server starts on http://localhost:3109, page loads successfully

**Step 3: Test production build**

Run: `npm run build`

Expected: Build completes successfully

**Step 4: Generate documentation**

Run: `npm run docs`

Expected: Documentation generated in `docs/api/`

**Step 5: Verify Husky hooks are active**

Run: `git commit --allow-empty -m "test commit"`

Expected: Pre-commit hook runs and executes all 7 stages

**Step 6: Final commit**

Run:
```bash
git commit --allow-empty -m "chore: verify complete setup with all quality gates

All validation passes:
- TypeScript compilation ✅
- Type coverage 100% ✅
- ESLint zero warnings ✅
- Tests 90% coverage ✅
- Build succeeds ✅
- Docs generate ✅
- Husky hooks active ✅

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Success Criteria

- ✅ All configuration files created with "DO NOT MODIFY" comments
- ✅ TypeScript strict mode enforced (100% type coverage)
- ✅ ESLint with 18 plugins configured to maximum strictness
- ✅ Vitest with 90% coverage threshold
- ✅ Husky hooks prevent commits that fail quality gates
- ✅ Example Button component demonstrates patterns
- ✅ TypeDoc generates documentation
- ✅ Next.js app builds and runs successfully
- ✅ README documents all features and requirements
- ✅ VS Code workspace configured for optimal DX

## Notes for Engineers

1. **DO NOT modify configuration files** marked with "NEVER DISABLE" or "DO NOT MODIFY" comments
2. **Types must be centralized** in `src/types/` - components cannot define types inline
3. **Coverage thresholds cannot be lowered** - can only increase
4. **Husky hooks will block commits** that don't pass all gates
5. **Use vitest-mock-extended** for all test mocks to maintain type safety
6. **All public APIs require TSDoc comments** - enforced by ESLint and TypeDoc

If quality gates are blocking you, the code needs to be fixed - not the gates.
