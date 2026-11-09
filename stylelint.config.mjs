// CLAUDE.md 6.6: outside packages/design-system, only sys and comp tokens.
// The `lint` script only points this at apps/, which is what keeps the package exempt.
export default {
  ignoreFiles: ['**/dist/**', '**/node_modules/**', '**/.astro/**'],
  overrides: [{ files: ['**/*.astro'], customSyntax: 'postcss-html' }],
  rules: {
    'color-no-hex': true,
    'color-named': 'never',
    'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color'],
    'unit-disallowed-list': ['px'],
    'declaration-property-value-disallowed-list': {
      'z-index': ['/^-?\\d+$/'],
      '/.*/': ['/var\\(--tram-ref-/'],
    },
  },
};
