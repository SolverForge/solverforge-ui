const globals = require('globals');
const ts = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

const baseRules = {
  'no-dupe-keys': 'error',
  'no-redeclare': 'error',
  'no-unreachable': 'error',
  'no-undef': 'error',
  'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
  'valid-typeof': 'error',
};

const correctnessRules = {
  ...baseRules,
  ...ts.configs.recommended.rules,
};

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'static/**',
      'target/**'
    ],
  },
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
    rules: correctnessRules,
  },
  {
    files: ['tests/**/*.js', 'scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: baseRules,
  },
];
