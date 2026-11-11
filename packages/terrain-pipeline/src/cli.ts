// GPX → terrain-RGB WebP + route for the 3D viewer.
// Usage: node src/cli.ts <track.gpx> <outDir> [cellMetres=10]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { fetchTile, ICGC_ATTRIBUTION, planTiles } from './icgc.ts';
import { parseGpx } from './gpx.ts';
import { encodeTerrainRgb } from './terrain-rgb.ts';
import { toUtm } from './utm.ts';

const [gpxPath, out, cellArg] = process.argv.slice(2);
if (!gpxPath || !out) throw new Error('usage: node src/cli.ts <track.gpx> <outDir> [cellMetres]');
const SOURCE_CELL = 5;
const cell = Number(cellArg ?? 10);
if (cell % SOURCE_CELL !== 0) throw new Error(`the output cell must be a multiple of ${SOURCE_CELL} m`);
const MARGIN = 400;

const track = parseGpx(readFileSync(gpxPath, 'utf8')).map((p) => ({ ...p, xy: toUtm(p.lat, p.lon) }));
const xs = track.map((p) => p.xy[0]);
const ys = track.map((p) => p.xy[1]);
const x0 = Math.floor((Math.min(...xs) - MARGIN) / cell) * cell;
const y0 = Math.floor((Math.min(...ys) - MARGIN) / cell) * cell;
const x1 = Math.ceil((Math.max(...xs) + MARGIN) / cell) * cell;
const y1 = Math.ceil((Math.max(...ys) + MARGIN) / cell) * cell;

// Fetch at 5 m, the model's resolution, then keep one cell in `cell / 5`.
const srcCols = (x1 - x0) / SOURCE_CELL;
const srcRows = (y1 - y0) / SOURCE_CELL;
const source = new Float32Array(srcCols * srcRows);
for (const tile of planTiles(srcCols, srcRows)) {
  const values = await fetchTile(x0, y1, SOURCE_CELL, tile);
  for (let r = 0; r < tile.rows; r++) source.set(values.subarray(r * tile.cols, (r + 1) * tile.cols), (tile.row + r) * srcCols + tile.col);
}
const stride = cell / SOURCE_CELL;
const cols = Math.floor(srcCols / stride);
const rows = Math.floor(srcRows / stride);
const heights = new Float32Array(cols * rows);
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) heights[r * cols + c] = source[r * stride * srcCols + c * stride]!;
let min = Infinity;
let max = -Infinity;
for (const h of heights) if (h > -9000) ((min = Math.min(min, h)), (max = Math.max(max, h)));

mkdirSync(out, { recursive: true });
const webp = await sharp(Buffer.from(encodeTerrainRgb(heights)), { raw: { width: cols, height: rows, channels: 3 } }).webp({ lossless: true, effort: 6 }).toBuffer();
writeFileSync(join(out, 'terrain.webp'), webp);
writeFileSync(join(out, 'terrain.json'), JSON.stringify({ crs: 'EPSG:25831', x0, y0, cell, cols, rows, min: Number(min.toFixed(1)), max: Number(max.toFixed(1)), attribution: ICGC_ATTRIBUTION }, null, 2) + '\n');
// Route in metres from the south-west corner of the terrain, one point every ~10 m of track.
const route: Array<[number, number]> = [];
let last: [number, number] | undefined;
for (const p of track) {
  const here: [number, number] = [Number((p.xy[0] - x0).toFixed(1)), Number((p.xy[1] - y0).toFixed(1))];
  if (!last || Math.hypot(here[0] - last[0], here[1] - last[1]) >= 10) route.push((last = here));
}
writeFileSync(join(out, 'route.json'), JSON.stringify(route) + '\n');
console.log(`${cols} × ${rows} cells of ${cell} m, ${min.toFixed(1)}–${max.toFixed(1)} m, terrain.webp ${(webp.length / 1024).toFixed(1)} KB, route ${route.length} points`);
