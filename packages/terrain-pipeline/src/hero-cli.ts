// The first frame of the home (M1, "De la quadrícula a la corba de nivell"): the plan of a town a real
// route runs through, as lines. Its blocks are the ICGC's (the `illa` of its base map), its shore is
// where the elevation model stops, and the route is the stretch of the track that crosses it.
// Usage: node src/hero-cli.ts <townRouteDir> <mountainRouteDir> <out.json> [fromShare=0.75] [toShare=0.25] [northM=0]
// `northM` moves the window north: a town by the sea has half its box in the water.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import sharp from 'sharp';
import { contourLines, simplify } from './plate.ts';
import { decodeTerrainRgb } from './terrain-rgb.ts';
import { toLngLat, toUtm } from './utm.ts';
import { type Point, tidyRing } from './world.ts';

const [townDir, mountainDir, out, fromArg = '0.75', toArg = '0.25', northArg = '0'] = process.argv.slice(2);
if (!townDir || !mountainDir || !out) throw new Error('usage: node src/hero-cli.ts <townRouteDir> <mountainRouteDir> <out.json> [fromShare] [toShare]');
interface Meta { x0: number; y0: number; cols: number; rows: number; cell: number; seaBedM?: number }
const read = <T,>(dir: string, file: string): T => JSON.parse(readFileSync(join(dir, file), 'utf8')) as T;
const town = read<Meta>(townDir, 'terrain.json');
const mountain = read<Meta>(mountainDir, 'terrain.json');
const route = read<Point[]>(townDir, 'route.json');

// The stretch of the route the plan shows: from one share of it, through the finish and the start, to another.
const lengths = [0];
for (let i = 1; i < route.length; i++) lengths.push(lengths[i - 1]! + Math.hypot(route[i]![0] - route[i - 1]![0], route[i]![1] - route[i - 1]![1]));
const shareOf = (i: number): number => lengths[i]! / lengths.at(-1)!;
const [from, to] = [Number(fromArg), Number(toArg)];
const stretch = from < to ? route.filter((_, i) => shareOf(i) >= from && shareOf(i) <= to) : [...route.filter((_, i) => shareOf(i) >= from), ...route.filter((_, i) => shareOf(i) <= to)];

// The window: the box of that stretch with some air, widened or heightened to the shape of the mountain's terrain,
// since the plan is laid over it.
const AIR_M = 140;
const shape = (mountain.cols * mountain.cell) / (mountain.rows * mountain.cell);
let [west, south, east, north] = [Math.min(...stretch.map((p) => p[0])) - AIR_M, Math.min(...stretch.map((p) => p[1])) - AIR_M, Math.max(...stretch.map((p) => p[0])) + AIR_M, Math.max(...stretch.map((p) => p[1])) + AIR_M];
if ((east - west) / (north - south) < shape) {
  const more = ((north - south) * shape - (east - west)) / 2;
  [west, east] = [west - more, east + more];
} else {
  const more = ((east - west) / shape - (north - south)) / 2;
  [south, north] = [south - more, north + more];
}
[south, north] = [south + Number(northArg), north + Number(northArg)];
const [width, height] = [east - west, north - south];

/** The pieces of a line that lie inside the window, in the window's own metres. */
function clipped(line: ReadonlyArray<Point>): Point[][] {
  const pieces: Point[][] = [];
  let piece: Point[] = [];
  for (let i = 1; i < line.length; i++) {
    let [ax, ay, bx, by] = [line[i - 1]![0] - west, line[i - 1]![1] - south, line[i]![0] - west, line[i]![1] - south];
    // Liang–Barsky: the part of the segment between the four sides.
    let [t0, t1] = [0, 1];
    const [dx, dy] = [bx - ax, by - ay];
    let inside = true;
    for (const [p, q] of [[-dx, ax], [dx, width - ax], [-dy, ay], [dy, height - ay]] as const) {
      if (p === 0) inside &&= q >= 0;
      else if (p < 0) t0 = Math.max(t0, q / p);
      else t1 = Math.min(t1, q / p);
    }
    if (!inside || t0 > t1) {
      if (piece.length > 1) pieces.push(piece);
      piece = [];
      continue;
    }
    [ax, ay, bx, by] = [ax + dx * t0, ay + dy * t0, ax + dx * t1, ay + dy * t1];
    if (!piece.length) piece.push([ax, ay]);
    piece.push([bx, by]);
    if (t1 < 1) {
      pieces.push(piece);
      piece = [];
    }
  }
  if (piece.length > 1) pieces.push(piece);
  return pieces;
}

// The blocks of the town, from the tiles of the base map the window touches.
const scale = 2 ** 14;
const tileOf = (x: number, y: number): [number, number] => {
  const [lng, lat] = toLngLat(town.x0 + x, town.y0 + y);
  const phi = (lat * Math.PI) / 180;
  return [Math.floor(((lng + 180) / 360) * scale), Math.floor(((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * scale)];
};
const localOf = (tx: number, ty: number, u: number, v: number): Point => {
  const lng = ((tx + u) / scale) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (ty + v)) / scale))) * 180) / Math.PI;
  const [x, y] = toUtm(lat, lng);
  return [x - town.x0, y - town.y0];
};
const corners = [tileOf(west, south), tileOf(east, north), tileOf(west, north), tileOf(east, south)];
const blocks: Point[][] = [];
for (let tx = Math.min(...corners.map((c) => c[0])); tx <= Math.max(...corners.map((c) => c[0])); tx++) {
  for (let ty = Math.min(...corners.map((c) => c[1])); ty <= Math.max(...corners.map((c) => c[1])); ty++) {
    const response = await fetch(`https://geoserveis.icgc.cat/servei/catalunya/mapa-base2/vt/14/${tx}/${ty}.pbf`);
    if (!response.ok) throw new Error(`ICGC tile ${tx}/${ty}: ${response.status}`);
    const layer = new VectorTile(new PbfReader(new Uint8Array(await response.arrayBuffer()))).layers['building'];
    for (let i = 0; layer && i < layer.length; i++) {
      const feature = layer.feature(i);
      if (feature.type !== 3 || feature.properties['building'] !== 'illa') continue;
      for (const ring of feature.loadGeometry()) {
        // A block cut by the edge of a tile is drawn again by the next tile: only whole ones are kept.
        if (ring.some((p) => p.x <= 0 || p.y <= 0 || p.x >= feature.extent || p.y >= feature.extent)) continue;
        const outline = tidyRing(ring.map((p) => localOf(tx, ty, p.x / feature.extent, p.y / feature.extent)), 0.6);
        if (outline.length >= 3) blocks.push(...clipped([...outline, outline[0]!]));
      }
    }
  }
}

// The shore: where the elevation model stops holding anything, which the pipeline has given a bed under the water.
const { data } = await sharp(join(townDir, 'terrain.webp')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const heights = decodeTerrainRgb(data, 3);
/** Corners cut twice over: the model has a cell every ten metres, and a shore drawn cell by cell is a staircase. */
const rounded = (line: ReadonlyArray<Point>): Point[] => {
  let points = [...line];
  for (let pass = 0; pass < 2; pass++) {
    const next: Point[] = [points[0]!];
    for (let i = 1; i < points.length; i++) {
      const [a, b] = [points[i - 1]!, points[i]!];
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    next.push(points.at(-1)!);
    points = next;
  }
  return points;
};
const coast =
  town.seaBedM === undefined
    ? []
    : contourLines(heights, town.cols, town.rows, town.seaBedM / 2).flatMap((line) => clipped(simplify(rounded(line.map(([col, row]): Point => [col * town.cell, (town.rows - 1 - row) * town.cell])).map(([x, y]): [number, number] => [x, y]), 1.2)));

const flat = (line: ReadonlyArray<Point>): number[] => line.flatMap(([x, y]) => [Number(x.toFixed(1)), Number(y.toFixed(1))]);
const plan = {
  attribution: 'Illes de cases i model d’elevacions: © Institut Cartogràfic i Geològic de Catalunya (ICGC), CC BY 4.0',
  // Metres from the south-west corner of the window, north up. Every line is x, y, x, y…
  widthM: Number(width.toFixed(1)),
  heightM: Number(height.toFixed(1)),
  blocks: blocks.map(flat),
  coast: coast.map(flat),
  route: clipped(stretch).map(flat),
};
const json = JSON.stringify(plan);
writeFileSync(out, json + '\n');
console.log(`${width.toFixed(0)} × ${height.toFixed(0)} m, ${blocks.length} block outlines, ${coast.length} lines of shore, route in ${plan.route.length} pieces, ${(json.length / 1024).toFixed(1)} KB`);
