// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

// The cssVariable names match the ref tokens on purpose: Astro's declaration is
// unlayered, so it wins over @layer tram.tokens and adds the optimised fallbacks.
/**
 * @param {string} name
 * @param {string} cssVariable
 * @param {string} file
 * @param {string} weight
 */
const fontFamily = (name, cssVariable, file, weight) => ({
  name,
  cssVariable,
  provider: fontProviders.local(),
  fallbacks: ['sans-serif'],
  options: {
    variants: /** @type {[{ src: [string]; weight: string; style: 'normal' }]} */ ([
      { src: [`@tram/design-system/fonts/${file}`], weight, style: 'normal' },
    ]),
  },
});

// CLAUDE.md 3: prerender by default; on-demand rendering only where needed.
// The Cloudflare adapter is added with the first server island.
export default defineConfig({
  site: 'https://tramrun.com',
  output: 'static',
  trailingSlash: 'always',
  fonts: [
    fontFamily('Sofia Sans Extra Condensed', '--tram-ref-font-display', 'sofia-sans-extra-condensed-latin-700-900.woff2', '700 900'),
    fontFamily('Sofia Sans', '--tram-ref-font-text', 'sofia-sans-latin-400-700.woff2', '400 700'),
  ],
  i18n: {
    locales: ['ca', 'es', 'en'],
    defaultLocale: 'ca',
    routing: { prefixDefaultLocale: true },
  },
});
