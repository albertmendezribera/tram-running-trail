// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

// The cssVariable names match the ref tokens on purpose: Astro's declaration is
// unlayered, so it wins over @layer tram.tokens and adds the optimised fallbacks.
/**
 * @param {string} name
 * @param {string} cssVariable
 * @param {string} file
 * @param {string} weight
 * @param {string} standIn Fallback face of fonts/fallbacks.css, with the proportions of this font.
 */
const fontFamily = (name, cssVariable, file, weight, standIn) => ({
  name,
  cssVariable,
  provider: fontProviders.local(),
  fallbacks: [standIn, 'sans-serif'],
  options: {
    // `block`: the text waits for its font instead of swapping into it. The two files are small
    // (52 KB) and preloaded; a swap from the system font moved the whole page (CLS 0.31 on Linux).
    variants: /** @type {[{ src: [string]; weight: string; style: 'normal'; display: 'block' }]} */ ([
      { src: [`@tram/design-system/fonts/${file}`], weight, style: 'normal', display: 'block' },
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
    fontFamily('Sofia Sans Extra Condensed', '--tram-ref-font-display', 'sofia-sans-extra-condensed-latin-700-900.woff2', '700 900', 'TRAM display fallback'),
    fontFamily('Sofia Sans', '--tram-ref-font-text', 'sofia-sans-latin-400-700.woff2', '400 700', 'TRAM text fallback'),
  ],
  i18n: {
    locales: ['ca', 'es', 'en'],
    defaultLocale: 'ca',
    routing: { prefixDefaultLocale: true },
  },
});
