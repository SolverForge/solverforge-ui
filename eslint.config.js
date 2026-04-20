const globals = require('globals');

const correctnessRules = {
  'no-dupe-keys': 'error',
  'no-redeclare': 'error',
  'no-unreachable': 'error',
  'no-undef': 'error',
  'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
  'valid-typeof': 'error',
};

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'static/**',
      'target/**',
    ],
  },
  {
    files: ['js-src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',
      globals: {
        SF: 'readonly',
        Split: 'readonly',
        Gantt: 'readonly',
        ...globals.browser,
      },
    },
    rules: correctnessRules,
  },
  {
    files: ['js-src/00-core.js'],
    rules: {
      'no-redeclare': 'off',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^SF$' }],
    },
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
    rules: correctnessRules,
  },
];
