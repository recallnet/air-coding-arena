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
      'next.config.js',
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
        process: 'readonly',
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
      'jsdoc/require-param': [
        'error',
        {
          checkDestructured: false,
        },
      ],
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
  {
    files: ['scripts/**/*.ts'],
    languageOptions: {
      globals: {
        console: 'readonly',
        fetch: 'readonly',
      },
    },
    rules: {
      'jsdoc/require-jsdoc': 'off',
      'no-console': 'off',
    },
  },
]
