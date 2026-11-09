import astro from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';
import measureRequired from './eslint/measure-required.mjs';

// CLAUDE.md 6.6: only the rules the design system depends on.
const noRefTokens = [
  'error',
  {
    patterns: [
      {
        group: ['**/tokens/ref/*', '@tram/design-system/tokens/*'],
        message: 'Use sys tokens: ref tokens are private to the design system (CLAUDE.md 6.2).',
      },
    ],
  },
];

export default [
  { ignores: ['**/dist/**', '**/.astro/**', '**/node_modules/**', '**/playwright-report/**', '**/test-results/**'] },
  ...astro.configs['flat/base'],
  {
    files: ['**/*.astro'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
    plugins: { tram: { rules: { 'measure-required': measureRequired } } },
    rules: { 'tram/measure-required': 'error' },
  },
  {
    files: ['apps/**/*.ts'],
    languageOptions: { parser: tseslint.parser },
  },
  {
    files: ['apps/**/*.astro', 'apps/**/*.ts'],
    rules: { 'no-restricted-imports': noRefTokens },
  },
];
