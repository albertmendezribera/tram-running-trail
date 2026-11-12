// Performance budget of CLAUDE.md section 10, checked on the built site:
//   · JavaScript a page loads at once: under 30 KB gzip;
//   · a 3D island, loaded on demand: under 250 KB gzip, with the one exception
//     accepted for the realistic route viewer (MapLibre GL JS);
//   · terrain of the first view: under 1.5 MB.
// Usage: node scripts/check-budget.mjs [distDir]. Exits with 1 when over budget.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = process.argv[2] ?? new URL('../dist', import.meta.url).pathname;
const KB = 1000;
const BUDGET = { initial: 30 * KB, island: 250 * KB, realistic: 470 * KB, terrain: 1500 * KB };

const walk = (dir) => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]));
const gzip = (buffer) => gzipSync(buffer, { level: 9 }).length;
const kb = (bytes) => `${(bytes / KB).toFixed(1)} KB`;

const files = walk(dist);
const pages = files.filter((f) => f.endsWith('.html'));
const failures = [];
const referenced = new Set();

console.log('JavaScript loaded at once, per page (budget 30 KB gzip)');
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  let total = 0;
  for (const [, src] of html.matchAll(/<(?:script[^>]*\ssrc|link[^>]*rel="modulepreload"[^>]*\shref)="([^"]+\.m?js)"/g)) {
    referenced.add(src);
    total += gzip(readFileSync(join(dist, src)));
  }
  // Inline scripts count too; JSON data blocks are data, not code.
  for (const [, attrs, body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (!/\ssrc=/.test(attrs) && !/application\/json/.test(attrs) && body.trim()) total += gzip(Buffer.from(body));
  }
  const name = `/${relative(dist, page).replace(/index\.html$/, '')}`;
  console.log(`  ${total > BUDGET.initial ? '✖' : '✔'} ${kb(total).padStart(9)}  ${name}`);
  if (total > BUDGET.initial) failures.push(`${name} loads ${kb(total)} of JavaScript at once`);
}

console.log('\nIslands loaded on demand (budget 250 KB gzip each)');
let realistic = 0;
for (const file of files.filter((f) => /\.m?js$/.test(f))) {
  const src = `/${relative(dist, file)}`;
  if (referenced.has(src)) continue;
  const content = readFileSync(file);
  const size = gzip(content);
  // The accepted exception (E02): MapLibre GL JS, loaded only when the realistic view is chosen.
  const isRealistic = content.includes('MapLibre GL JS') || content.includes('maplibregl-');
  if (isRealistic) realistic += size;
  const over = !isRealistic && size > BUDGET.island;
  console.log(`  ${over ? '✖' : '✔'} ${kb(size).padStart(9)}  ${src}${isRealistic ? '  (realistic viewer)' : ''}`);
  if (over) failures.push(`${src} is ${kb(size)}`);
}
if (realistic > 0) {
  console.log(`  ${realistic > BUDGET.realistic ? '✖' : '✔'} ${kb(realistic).padStart(9)}  realistic viewer in all (accepted exception, capped at ${kb(BUDGET.realistic)})`);
  if (realistic > BUDGET.realistic) failures.push(`the realistic viewer is ${kb(realistic)}`);
}

console.log('\nTerrain of the first view (budget 1.5 MB)');
for (const file of files.filter((f) => /terrain[^/]*\.(webp|png)$/.test(f))) {
  const size = statSync(file).size;
  console.log(`  ${size > BUDGET.terrain ? '✖' : '✔'} ${kb(size).padStart(9)}  /${relative(dist, file)}`);
  if (size > BUDGET.terrain) failures.push(`/${relative(dist, file)} is ${kb(size)}`);
}

if (failures.length > 0) {
  console.error(`\nOver budget:\n${failures.map((f) => `  · ${f}`).join('\n')}`);
  process.exit(1);
}
console.log('\nWithin budget.');
