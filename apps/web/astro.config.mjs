// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig, fontProviders } from 'astro/config';
import { writeSitemaps } from './scripts/sitemap.mjs';

const SITE = 'https://tramrun.com';

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
  site: SITE,
  output: 'static',
  trailingSlash: 'always',
  fonts: [
    fontFamily('Sofia Sans Extra Condensed', '--tram-ref-font-display', 'sofia-sans-extra-condensed-latin-700-900.woff2', '700 900', 'TRAM display fallback'),
    fontFamily('Sofia Sans', '--tram-ref-font-text', 'sofia-sans-latin-400-700.woff2', '400 700', 'TRAM text fallback'),
  ],
  integrations: [
    {
      // CLAUDE.md 11: the sitemaps, one to a kind of page, and robots.txt, from the pages the build made.
      // The build with the catalogue is the test environment: it gets no sitemap.
      name: 'tram-sitemaps',
      hooks: {
        'astro:build:done': async ({ dir, logger }) => {
          const { files, urls } = await writeSitemaps(fileURLToPath(dir), SITE, { staging: process.env['TRAM_DS'] === '1' });
          logger.info(`${files.join(', ')}${urls ? `: ${urls} addresses` : ''}`);
        },
      },
    },
  ],
  vite: {
    plugins: [
      {
        // The makers' product photos, and the models made of them, are for the test environment alone
        // (CLAUDE.md 7.6, docs/revisio-legal.md): a production build takes none of them in, even on a
        // machine that has them. Every file of that folder is, to such a build, nothing.
        name: 'tram-no-brand-photos-in-production',
        enforce: 'pre',
        load(id) {
          if (process.env['TRAM_DS'] === '1' || process.env['NODE_ENV'] === 'development' || !id.includes('/content/shoes-local/')) return null;
          // A JSON file is still read as JSON after this, so it is given as JSON; a photo, or a file asked for by
          // its address (`?url`), as the module of an address that is none.
          return /\.json(\?|$)/.test(id) && !/[?&]url\b/.test(id) ? 'null' : 'export default "";';
        },
      },
    ],
  },
  i18n: {
    locales: ['ca', 'es', 'en'],
    defaultLocale: 'ca',
    routing: { prefixDefaultLocale: true },
  },
});
