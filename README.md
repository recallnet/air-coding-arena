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

### TypeScript Incremental Compilation

Repeated `npm run type-check` runs reuse the cached `.tsbuildinfo` file to avoid full recompilation. The cache is stored at the project root (ignored by git) and is restored automatically in CI. See [docs/typescript-incremental-compilation.md](docs/typescript-incremental-compilation.md) for configuration details and benchmarks.

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

## 🤖 State Machines

The coding arena uses XState to model agent and issue lifecycles. State machines are defined in TypeScript and diagrams are auto-generated in CI.

**View diagrams:**

- [Agent Lifecycle](docs/diagrams/agent-state-machine.md)
- [Issue Lifecycle](docs/diagrams/issue-state-machine.md)

**Source code:**

- `src/machines/agentMachine.ts` - Agent state machine definition
- `src/machines/issueMachine.ts` - Issue state machine definition

**Generate diagrams manually:**

```bash
npm run generate-diagrams
```

Diagrams are automatically regenerated:

- On every commit (pre-commit hook)
- During build (`npm run build`)

## 📖 Documentation

All public functions and components require TSDoc comments:

````typescript
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
````

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
