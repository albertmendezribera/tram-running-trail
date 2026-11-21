// The poster of a route's «a peu» page: a capture taken inside the game (a real render of it, never a
// generated image) made light enough to be the first thing the page paints.
// Usage (from apps/web): node scripts/world-poster.mjs <capture.png> [slug] [focus]
//   slug   the route it belongs to (default: palamos); the files go to src/content/routes/<slug>/
//   focus  where the tall cut for phones looks, from 0 (left edge) to 1 (right edge); default 0.5
// Writes on-foot-wide.{avif,webp} (16:9, 1600 px wide) and on-foot-tall.{avif,webp} (3:4, for phones).
// The page reads their sizes from the files, so nothing else has to change.
import { mkdir, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import sharp from 'sharp';

const [source, slug = 'palamos', focusArg = '0.5'] = process.argv.slice(2);
if (!source) {
  console.error('Usage: node scripts/world-poster.mjs <capture.png> [slug] [focus 0–1]');
  process.exit(1);
}
const focus = Number(focusArg);
if (!(focus >= 0 && focus <= 1)) {
  console.error(`focus is a number from 0 to 1, not "${focusArg}"`);
  process.exit(1);
}

const WIDE = { width: 1600, height: 900 };
const TALL_RATIO = 3 / 4;
const out = new URL(`../src/content/routes/${slug}/`, import.meta.url);
await mkdir(out, { recursive: true });

// Every capture is brought to the same wide frame first; the tall one is a cut of it, as high as it is.
const wide = await sharp(source).resize({ ...WIDE, fit: 'cover' }).toBuffer();
const tallWidth = Math.round(WIDE.height * TALL_RATIO);
const tall = await sharp(wide)
  .extract({ left: Math.round((WIDE.width - tallWidth) * focus), top: 0, width: tallWidth, height: WIDE.height })
  .toBuffer();

for (const [name, image] of [['on-foot-wide', wide], ['on-foot-tall', tall]]) {
  for (const [format, options] of [['avif', { quality: 52, effort: 7 }], ['webp', { quality: 76, effort: 6 }]]) {
    const file = new URL(`${name}.${format}`, out);
    await sharp(image)[format](options).toFile(file.pathname);
    console.log(`  ${String(Math.round((await stat(file)).size / 1000)).padStart(4)} KB  src/content/routes/${slug}/${basename(file.pathname)}`);
  }
}
