import globals from 'globals';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

const baseRules = {
  'no-dupe-keys': 'error',
  'no-redeclare': 'error',
  'no-unreachable': 'error',
  'valid-typeof': 'error',
};

const tsRules = {
  ...baseRules,
  ...ts.configs.recommended.rules,

  // Disable JS version (important)
  'no-unused-vars': 'off',

  // Use TS-aware version
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      args: 'all',
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrors: 'none',
    },
  ],
};

export default [
  {
    ignores: [
      'node_modules/**',
      'static/**',
      'target/**',
    ],
  },

  // =========================
  // TypeScript files
  // =========================
  {
    files: ['ts-src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
      },
      globals: {
        SF: 'readonly',
        Split: 'readonly',
        Gantt: 'readonly',
        ...globals.browser,
      },
    },
    plugins: {
      '@typescript-eslint': ts,
    },
    rules: tsRules,
  },

  // =========================
  // JS tests & scripts (Node)
  // =========================
  {
    files: ['tests/**/*.js', 'scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      ...baseRules,

      // Re-enable JS-native checks in Node files
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
    },
  },
];
