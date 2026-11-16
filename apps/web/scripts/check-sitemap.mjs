// Checks the sitemaps of a production build against the build itself: `pnpm --filter @tram/web check-sitemap`,
// after `build`. Every address listed has to be a page of the build that offers itself at that address,
// every page that offers itself has to be listed, and robots.txt has to name the index. The catalogue of
// the design system and the pages kept from search engines must not be in any sitemap.
import { readFile } from 'node:fs/promises';
import { INDEX, offered, pagesIn } from './sitemap.mjs';

const dist = new URL('../dist/', import.meta.url).pathname;
const read = (name) => readFile(`${dist}${name}`, 'utf8');
const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
const problems = [];

const robots = await read('robots.txt');
const named = /^Sitemap: (\S+)$/m.exec(robots)?.[1];
if (!named?.endsWith(`/${INDEX}`)) problems.push(`robots.txt does not name ${INDEX}`);
if (/^Disallow: \/\s*$/m.test(robots)) problems.push('robots.txt shuts every crawler out of the site');

const listed = [];
for (const sitemap of locs(await read(INDEX))) listed.push(...locs(await read(new URL(sitemap).pathname.slice(1))));
const pages = await pagesIn(dist);
const offers = new Map(pages.map((page) => [offered(page.html), page.path]).filter(([url]) => url));

for (const url of listed) {
  if (!offers.has(url)) problems.push(`${url} is in a sitemap, and no page of the build offers itself there`);
  else if (`${new URL(url).pathname.slice(1)}index.html` !== offers.get(url)) problems.push(`${url} is offered by ${offers.get(url)}, which is not the page at that address`);
  if (new URL(url).pathname.startsWith('/ds/')) problems.push(`${url} is the catalogue of the design system`);
}
for (const [url, path] of offers) if (!listed.includes(url)) problems.push(`${path} offers itself at ${url} and is in no sitemap`);
if (new Set(listed).size !== listed.length) problems.push('An address is listed twice');
if (!listed.length) problems.push('The sitemaps are empty');

if (problems.length) {
  console.error(problems.map((problem) => `  ✖ ${problem}`).join('\n'));
  process.exit(1);
}
console.log(`Sitemaps: ${listed.length} addresses, the ${offers.size} pages that offer themselves, of ${pages.length} in the build.`);
