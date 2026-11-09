// @ts-check
import { defineConfig } from 'astro/config';

// CLAUDE.md 3: prerender by default; on-demand rendering only where needed.
// The Cloudflare adapter is added with the first server island.
export default defineConfig({
  site: 'https://tramrun.com',
  output: 'static',
  trailingSlash: 'always',
  i18n: {
    locales: ['ca', 'es', 'en'],
    defaultLocale: 'ca',
    routing: { prefixDefaultLocale: true },
  },
});
