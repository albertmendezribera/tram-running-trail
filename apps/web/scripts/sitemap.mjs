// The sitemaps and the robots.txt of the site (CLAUDE.md 11), written when a build is done, from the
// pages the build made: a page is in a sitemap when it is offered to search engines, and what says
// whether it is offered is the page itself (its `robots` meta and its canonical address). Nothing is
// listed by hand, so a page kept from search engines can never be in a sitemap by mistake.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

/** The sitemap each part of the site goes to, by the first step of its address after the language. */
const KINDS = {
  curses: 'curses',
  carreras: 'curses',
  races: 'curses',
  rutes: 'rutes',
  rutas: 'rutes',
  routes: 'rutes',
  sabatilles: 'sabatilles',
  zapatillas: 'sabatilles',
  shoes: 'sabatilles',
  comparar: 'comparar',
  compare: 'comparar',
};
/** Where everything else goes: the home page, and any page that is one of a kind. */
const OTHER = 'pagines';
export const INDEX = 'sitemap-index.xml';

const escaped = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const attribute = (tag, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

/**
 * What a page says of itself to search engines: its canonical address, or nothing when it asks not to
 * be listed (`noindex`) or names no address of its own.
 * @param {string} html
 * @returns {string | undefined}
 */
export function offered(html) {
  const head = html.slice(0, html.indexOf('</head>') + 1 || undefined);
  const robots = [...head.matchAll(/<meta\b[^>]*>/g)].map(([tag]) => tag).find((tag) => attribute(tag, 'name') === 'robots');
  if (robots && /noindex/i.test(attribute(robots, 'content') ?? '')) return undefined;
  const canonical = [...head.matchAll(/<link\b[^>]*>/g)].map(([tag]) => tag).find((tag) => attribute(tag, 'rel') === 'canonical');
  return canonical ? attribute(canonical, 'href')?.replace(/&amp;/g, '&') : undefined;
}

/** The sitemap an address goes to. */
export const kindOf = (url) => KINDS[new URL(url).pathname.split('/')[2] ?? ''] ?? OTHER;

/**
 * The files to write for a list of addresses: one sitemap to a kind of page, and the index of them.
 * @param {readonly string[]} urls Canonical addresses of the pages offered to search engines.
 * @param {string} site The origin of the site, e.g. `https://tramrun.com`.
 * @returns {Record<string, string>} File name → content.
 */
export function sitemapsOf(urls, site) {
  const origin = new URL(site).origin;
  const stray = urls.find((url) => new URL(url).origin !== origin);
  if (stray) throw new Error(`A page gives ${stray} as its address, which is not on ${origin}`);
  const groups = new Map();
  for (const url of [...new Set(urls)].sort()) groups.set(kindOf(url), [...(groups.get(kindOf(url)) ?? []), url]);
  const files = {};
  for (const [kind, list] of groups) {
    files[`sitemap-${kind}.xml`] = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${list.map((url) => `  <url><loc>${escaped(url)}</loc></url>`).join('\n')}\n</urlset>\n`;
  }
  files[INDEX] = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Object.keys(files)
    .sort()
    .map((name) => `  <sitemap><loc>${escaped(`${origin}/${name}`)}</loc></sitemap>`)
    .join('\n')}\n</sitemapindex>\n`;
  return files;
}

/**
 * The robots.txt of a build. The site itself is open to every crawler and names its sitemaps. The test
 * environment names none: it lets crawlers in, so that they read on every response that nothing there
 * is to be listed (`X-Robots-Tag`, set when it is published), which a closed door would keep them from reading.
 */
export const robotsOf = (site, { staging = false } = {}) =>
  staging
    ? '# Test environment of TRAM. Nothing here is for search engines: every response says so (X-Robots-Tag: noindex).\nUser-agent: *\nDisallow:\n'
    : `User-agent: *\nAllow: /\n\nSitemap: ${new URL(INDEX, site).href}\n`;

/** Every page of a build, as its path under the build's folder and its HTML. */
export async function pagesIn(dist) {
  const pages = [];
  for (const entry of await readdir(dist, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.html')) continue;
    const file = join(entry.parentPath, entry.name);
    pages.push({ path: relative(dist, file).split(sep).join('/'), html: await readFile(file, 'utf8') });
  }
  return pages;
}

/** Writes robots.txt and, for the site itself, its sitemaps. Says what it wrote. */
export async function writeSitemaps(dist, site, { staging = false } = {}) {
  await writeFile(join(dist, 'robots.txt'), robotsOf(site, { staging }));
  if (staging) return { files: ['robots.txt'], urls: 0 };
  const urls = (await pagesIn(dist)).map((page) => offered(page.html)).filter(Boolean);
  if (!urls.length) throw new Error('No page of the build is offered to search engines: there would be no sitemap');
  const files = sitemapsOf(urls, site);
  for (const [name, content] of Object.entries(files)) await writeFile(join(dist, name), content);
  return { files: ['robots.txt', ...Object.keys(files)], urls: new Set(urls).size };
}
