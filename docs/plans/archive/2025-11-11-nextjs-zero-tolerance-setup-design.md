# Next.js 15 Zero-Tolerance Quality Setup - Design Document

**Date:** 2025-11-11
**Status:** Approved

## Overview

This document describes the design for a Next.js 15 application with maximum lint, type, and test coverage requirements. The setup enforces zero-tolerance quality gates through Husky hooks, extensive ESLint plugins, and strict TypeScript configuration.

## Goals

1. **Maximum Type Safety:** 100% type coverage, no implicit `any`, strict TypeScript configuration
2. **Maximum Lint Coverage:** 18+ ESLint plugins configured to maximum strictness, zero warnings policy
3. **High Test Coverage:** 90% coverage threshold across all metrics (lines, branches, functions, statements)
4. **Zero Shortcuts:** Enforcement mechanisms prevent developers from bypassing quality gates
5. **Automated Documentation:** TypeDoc generates API docs from inline TSDoc comments

## Technology Decisions

- **Framework:** Next.js 15 with App Router (React Server Components)
- **Styling:** Tailwind CSS
- **Testing:** Vitest with vitest-mock-extended (eliminates `any` in tests)
- **Documentation:** TypeDoc
- **Coverage Threshold:** 90% (strict)

## Core Architecture

### Project Structure

```
coding-arena/
├── .husky/                      # Git hooks (pre-commit, pre-push)
├── .vscode/                     # Workspace settings, extensions
├── docs/
│   ├── api/                     # TypeDoc generated API docs
│   └── plans/                   # Design documents
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── api/                 # API routes
│   ├── components/              # React components
│   │   ├── ui/                  # Generic UI components
│   │   └── features/            # Feature-specific components
│   ├── lib/                     # Utilities, helpers
│   ├── types/                   # Shared TypeScript types (CENTRALIZED)
│   │   ├── index.ts            # Central export point
│   │   ├── api/                # API request/response types
│   │   ├── domain/             # Business domain models
│   │   ├── components/         # Component prop types
│   │   └── utils/              # Utility type helpers
│   └── __tests__/              # Test utilities, global setup
├── tests/                       # Integration & E2E tests
│   ├── integration/
│   └── e2e/
└── public/                      # Static assets
```

### Type Centralization Strategy

All TypeScript types and interfaces are centralized in `src/types/`:

- Components MUST import types from `@/types`, never define them inline
- All imports go through `src/types/index.ts` (no direct subdirectory imports)
- ESLint boundaries plugin enforces architectural rules
- Prevents type duplication across the codebase

## Zero-Tolerance Enforcement

### Quality Gates (all must pass)

1. **TypeScript Compilation** - `tsc --noEmit` with strict mode
2. **Type Coverage** - 100% coverage, no implicit `any` types
3. **ESLint** - Zero warnings, zero errors policy
4. **Prettier** - Code must be formatted (check mode, not auto-fix)
5. **Tests** - 90% coverage threshold (lines, branches, functions, statements)
6. **Documentation** - TypeDoc must generate successfully

### Husky Pre-Commit Hook (7 stages, fail-fast)

1. TypeScript compilation check
2. Type coverage check (100% required)
3. ESLint check (zero warnings policy)
4. Prettier format check
5. Tests for changed files
6. Test coverage check (90% required)
7. Documentation coverage check

### Husky Pre-Push Hook

1. Complete validation suite
2. Production build test (`next build`)

### TypeScript Strict Configuration

All of these settings are **NEVER to be disabled**:

```json
{
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
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "forceConsistentCasingInFileNames": true,
  "skipLibCheck": false
}
```

### ESLint Plugin Strategy (18 plugins)

**Core TypeScript:**

- `@typescript-eslint/eslint-plugin` (strict + type-checking rules)
- `@typescript-eslint/parser`

**React/Next.js:**

- `eslint-plugin-react`
- `eslint-plugin-react-hooks`
- `@next/eslint-plugin-next`

**Code Quality:**

- `eslint-plugin-sonarjs` (code smell detection)
- `eslint-plugin-unicorn` (best practices)
- `eslint-plugin-import` (import/export rules)

**Testing:**

- `eslint-plugin-vitest`
- `eslint-plugin-testing-library`

**Accessibility:**

- `eslint-plugin-jsx-a11y`

**Security:**

- `eslint-plugin-security`
- `eslint-plugin-no-secrets`

**Additional Strictness:**

- `eslint-plugin-functional` (immutability rules)
- `eslint-plugin-promise` (promise handling)
- `eslint-plugin-jsdoc` (TSDoc enforcement)
- `eslint-plugin-boundaries` (architectural boundaries)
- `eslint-plugin-eslint-comments` (prevent unlimited disables)

### Key ESLint Rules (prevent shortcuts)

```json
{
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/no-unsafe-assignment": "error",
  "@typescript-eslint/no-unsafe-member-access": "error",
  "@typescript-eslint/no-unsafe-call": "error",
  "@typescript-eslint/no-unsafe-return": "error",
  "@typescript-eslint/no-unsafe-argument": "error",
  "@typescript-eslint/ban-ts-comment": "error",
  "@typescript-eslint/no-non-null-assertion": "error",
  "@typescript-eslint/consistent-type-imports": "error",
  "@typescript-eslint/no-duplicate-type-constituents": "error",
  "import/no-duplicates": "error",
  "import/no-cycle": "error",
  "eslint-comments/no-unlimited-disable": "error",
  "eslint-comments/no-unused-disable": "error",
  "boundaries/element-types": "error"
}
```

## Testing Strategy

### Unit Tests (co-located with source)

- Each component/module has `.test.ts(x)` file alongside it
- Use `vitest-mock-extended` for fully typed mocks
- Test organization: describe/when/it pattern
- 90% coverage required across all metrics

### Mock Strategy

```typescript
import { mock } from 'vitest-mock-extended'
import type { UserService } from '@/types'

const mockUserService = mock<UserService>()
mockUserService.getUser.mockResolvedValue({ id: '1', name: 'Test' })
// Fully typed - TypeScript errors if interface changes
```

### Coverage Requirements

- 90% lines, branches, functions, statements
- No coverage exclusions allowed (no `/* istanbul ignore */`)
- Tests must cover error paths, not just happy paths
- CI fails if coverage drops below threshold

## Documentation

### TypeDoc Configuration

- All public functions/components require TSDoc comments
- ESLint enforces documentation with `eslint-plugin-jsdoc`
- TypeDoc generates HTML docs to `docs/api/`
- CI fails if public API lacks documentation
- Docs served via `npm run docs:serve`

### TSDoc Comment Format

````typescript
/**
 * Brief description of the function.
 *
 * @param param1 - Description of param1
 * @param param2 - Description of param2
 * @returns Description of return value
 * @throws {ErrorType} Description of when error is thrown
 * @example
 * ```typescript
 * const result = myFunction('value1', 'value2')
 * ```
 */
````

## Package Scripts

All scripts include enforcement mechanisms:

```json
{
  "type-check": "tsc --noEmit && type-coverage --at-least 100 --strict",
  "lint": "eslint . --max-warnings 0",
  "lint:fix": "eslint . --fix --max-warnings 0",
  "test": "vitest run --coverage --coverage.lines=90 --coverage.functions=90 --coverage.branches=90 --coverage.statements=90",
  "format:check": "prettier --check .",
  "format": "prettier --write .",
  "validate": "npm run type-check && npm run lint && npm run test && npm run format:check",
  "build": "npm run validate && next build",
  "docs": "typedoc --out docs/api src",
  "docs:serve": "npm run docs && npx serve docs/api"
}
```

## VS Code Integration

### Workspace Settings

- Auto-format on save disabled (requires manual formatting)
- ESLint integration enabled
- TypeScript strict mode indicators
- Test coverage highlighting

### Required Extensions

- ESLint
- Prettier
- TypeScript
- Vitest
- Tailwind CSS IntelliSense

## Dependencies

### Core Framework

- `next@^15.0.0`
- `react@^18.3.0`, `react-dom@^18.3.0`
- `typescript@^5.6.0`

### Styling

- `tailwindcss@^3.4.0`
- `postcss@^8.4.0`
- `autoprefixer@^10.4.0`

### Testing (8 packages)

- `vitest@^2.0.0`
- `@vitest/ui@^2.0.0`
- `@vitest/coverage-v8@^2.0.0`
- `vitest-mock-extended@^2.0.0`
- `@testing-library/react@^16.0.0`
- `@testing-library/jest-dom@^6.0.0`
- `@testing-library/user-event@^14.5.0`
- `jsdom@^25.0.0`
- `type-coverage@^2.27.0`

### ESLint (18 plugins)

- `eslint@^9.0.0`
- `@typescript-eslint/eslint-plugin@^8.0.0`
- `@typescript-eslint/parser@^8.0.0`
- `eslint-plugin-react@^7.35.0`
- `eslint-plugin-react-hooks@^5.0.0`
- `eslint-plugin-jsx-a11y@^6.9.0`
- `eslint-plugin-import@^2.29.0`
- `eslint-plugin-unicorn@^55.0.0`
- `eslint-plugin-sonarjs@^2.0.0`
- `eslint-plugin-security@^3.0.0`
- `eslint-plugin-no-secrets@^1.0.0`
- `eslint-plugin-promise@^7.0.0`
- `eslint-plugin-vitest@^0.5.0`
- `eslint-plugin-testing-library@^6.0.0`
- `eslint-plugin-jsdoc@^50.0.0`
- `eslint-plugin-functional@^7.0.0`
- `eslint-plugin-boundaries@^4.2.0`
- `eslint-plugin-eslint-comments@^3.2.0`
- `@next/eslint-plugin-next@^15.0.0`

### Code Quality

- `prettier@^3.3.0`
- `husky@^9.0.0`
- `lint-staged@^15.0.0`

### Documentation

- `typedoc@^0.26.0`

## Implementation Phases

1. **Initial Setup**
   - Git initialization
   - Package.json with all dependencies
   - Configuration files (tsconfig, eslint, prettier, vitest, tailwind, typedoc)

2. **Husky Hooks**
   - Install and configure Husky
   - Pre-commit hook with 7 stages
   - Pre-push hook with validation + build

3. **Project Structure**
   - Directory structure creation
   - Centralized types directory
   - Basic Next.js App Router setup

4. **Example Implementation**
   - Sample component with tests
   - Demonstrates vitest-mock-extended
   - Shows TSDoc documentation
   - Passes all quality gates

5. **Documentation**
   - README with setup instructions
   - Quality gate documentation
   - VS Code workspace configuration

## Success Criteria

- [ ] All configuration files in place with permanent comments
- [ ] Husky hooks prevent commits/pushes that fail quality gates
- [ ] TypeScript strict mode catches all type issues
- [ ] ESLint catches code quality issues with zero warnings
- [ ] Tests achieve 90% coverage threshold
- [ ] TypeDoc generates documentation successfully
- [ ] Example component demonstrates all patterns
- [ ] Developer cannot bypass quality gates without modifying hook files

## Maintenance Notes

- Configuration files include "DO NOT CHANGE" comments for critical settings
- Any attempt to lower standards requires explicit code review
- Hook files should be read-only after initial setup
- Coverage thresholds can only increase, never decrease
