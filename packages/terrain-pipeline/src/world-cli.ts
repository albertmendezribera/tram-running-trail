// Terrain and route of a route folder → world.json: the buildings the ICGC maps along the route, and trees
// where its LiDAR found them, of the kind its land-cover map says (E18).
// Usage: node src/world-cli.ts <routeDir>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import sharp from 'sharp';
import { decodeTerrainRgb } from './terrain-rgb.ts';
import { toLngLat, toUtm } from './utm.ts';
import { type Canopy, distanceToLine, forestTrees, groveTrees, type Point, polygonsOf, TREE_KINDS, type TreeKind } from './world.ts';

const [dir] = process.argv.slice(2);
if (!dir) throw new Error('usage: node src/world-cli.ts <routeDir>');
const meta = JSON.parse(readFileSync(join(dir, 'terrain.json'), 'utf8')) as { x0: number; y0: number; cols: number; rows: number; cell: number };
const { data } = await sharp(join(dir, 'terrain.webp')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const heights = decodeTerrainRgb(data, 3);
/** Elevation of the ground at a point, between the four cells around it. Row 0 is the north edge. */
const groundAt = ([x, y]: Point): number => {
  const c = Math.min(meta.cols - 1.001, Math.max(0, x / meta.cell));
  const r = Math.min(meta.rows - 1.001, Math.max(0, meta.rows - 1 - y / meta.cell));
  const [c0, r0] = [Math.floor(c), Math.floor(r)];
  const at = (cc: number, rr: number): number => heights[rr * meta.cols + cc]!;
  const north = at(c0, r0) + (at(c0 + 1, r0) - at(c0, r0)) * (c - c0);
  const south = at(c0, r0 + 1) + (at(c0 + 1, r0 + 1) - at(c0, r0 + 1)) * (c - c0);
  return north + (south - north) * (r - r0);
};
const route = JSON.parse(readFileSync(join(dir, 'route.json'), 'utf8')) as Point[];

/** The ICGC base map as vector tiles (CC BY 4.0): one zoom has every building and wood. */
const TILES = 'https://geoserveis.icgc.cat/servei/catalunya/mapa-base2/vt';
const ZOOM = 14;
const TREES = { spacingM: 8.5, corridorM: 110, clearanceM: 4 };
/** ICGC map services: the tree variables measured by LiDAR (2016-2017, cells of 20 m) and the land-cover map of 2024. */
const WMS = 'https://geoserveis.icgc.cat/servei/catalunya';
const CANOPY_CELL_M = 20;
const COVER_CELL_M = 2;
const BUILDING_CORRIDOR_M = 260;
const KINDS = new Set(['residential', 'industrial', 'greenhouse']);

const scale = 2 ** ZOOM;
/** Local metres → tile and position inside it, in tile units (0–1). */
const tileOf = ([x, y]: Point): { tx: number; ty: number; u: number; v: number } => {
  const [lng, lat] = toLngLat(meta.x0 + x, meta.y0 + y);
  const fx = ((lng + 180) / 360) * scale;
  const phi = (lat * Math.PI) / 180;
  const fy = ((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * scale;
  return { tx: Math.floor(fx), ty: Math.floor(fy), u: fx - Math.floor(fx), v: fy - Math.floor(fy) };
};
/** Tile position → local metres. */
const localOf = (tx: number, ty: number, u: number, v: number): Point => {
  const lng = ((tx + u) / scale) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (ty + v)) / scale))) * 180) / Math.PI;
  const [x, y] = toUtm(lat, lng);
  return [x - meta.x0, y - meta.y0];
};

interface Loaded {
  buildings: Array<{ heightM: number; polygons: Point[][][] }>;
}
const cache = new Map<string, Loaded>();
async function load(tx: number, ty: number): Promise<Loaded> {
  const key = `${tx}/${ty}`;
  const known = cache.get(key);
  if (known) return known;
  const response = await fetch(`${TILES}/${ZOOM}/${tx}/${ty}.pbf`);
  if (!response.ok) throw new Error(`ICGC tile ${key}: ${response.status}`);
  const tile = new VectorTile(new PbfReader(new Uint8Array(await response.arrayBuffer())));
  const loaded: Loaded = { buildings: [] };
  const rings = (layer: string, i: number): Point[][] => {
    const feature = tile.layers[layer]!.feature(i);
    return feature.loadGeometry().map((ring) => ring.map((p): Point => [p.x / feature.extent, p.y / feature.extent]));
  };
  const building = tile.layers['building'];
  for (let i = 0; building && i < building.length; i++) {
    const { building: kind, render_height: height } = building.feature(i).properties;
    if (building.feature(i).type !== 3 || !KINDS.has(String(kind)) || !(Number(height) >= 2)) continue;
    loaded.buildings.push({ heightM: Number(height), polygons: polygonsOf(rings('building', i)).map((polygon) => polygon.map((ring) => ring.map(([u, v]) => localOf(tx, ty, u, v)))) });
  }
  cache.set(key, loaded);
  return loaded;
}

// Every tile the corridor touches.
const reach = BUILDING_CORRIDOR_M;
const corners = route.flatMap(([x, y]): Point[] => [[x - reach, y - reach], [x + reach, y + reach]]).map(tileOf);
const tiles: Array<[number, number]> = [];
for (let tx = Math.min(...corners.map((c) => c.tx)); tx <= Math.max(...corners.map((c) => c.tx)); tx++) {
  for (let ty = Math.min(...corners.map((c) => c.ty)); ty <= Math.max(...corners.map((c) => c.ty)); ty++) tiles.push([tx, ty]);
}
for (const [tx, ty] of tiles) await load(tx, ty);

// The rasters, over the corridor of the route and snapped to the cells of the LiDAR layers.
const snap = (v: number, up: boolean): number => (up ? Math.ceil(v / CANOPY_CELL_M) : Math.floor(v / CANOPY_CELL_M)) * CANOPY_CELL_M;
const box = {
  west: snap(meta.x0 + Math.min(...route.map((p) => p[0])) - TREES.corridorM, false),
  south: snap(meta.y0 + Math.min(...route.map((p) => p[1])) - TREES.corridorM, false),
  east: snap(meta.x0 + Math.max(...route.map((p) => p[0])) + TREES.corridorM, true),
  north: snap(meta.y0 + Math.max(...route.map((p) => p[1])) + TREES.corridorM, true),
};
const query = (request: string, service: string, layer: string, width: number, height: number, more = ''): string =>
  `${WMS}/${service}/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=${request}&LAYERS=${layer}&SRS=EPSG:25831&BBOX=${box.west},${box.south},${box.east},${box.north}&WIDTH=${width}&HEIGHT=${height}&FORMAT=image/png&STYLES=${more}`;
interface Raster {
  /** Red, green, blue and alpha of each pixel. Alpha 0 is "no data". */
  rgba: Buffer;
  cols: number;
  rows: number;
}
async function raster(service: string, layer: string, cellM: number): Promise<Raster> {
  const [cols, rows] = [(box.east - box.west) / cellM, (box.north - box.south) / cellM];
  const response = await fetch(query('GetMap', service, layer, cols, rows));
  if (!response.ok) throw new Error(`ICGC ${layer}: ${response.status}`);
  const { data: rgba, info } = await sharp(Buffer.from(await response.arrayBuffer())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== cols || info.height !== rows) throw new Error(`ICGC ${layer}: ${info.width}×${info.height} instead of ${cols}×${rows}`);
  return { rgba, cols, rows };
}
/** What the service says a layer is worth at a pixel: the figure behind the grey. */
async function valueAt(service: string, layer: string, image: Raster, index: number): Promise<number> {
  const text = await (await fetch(query('GetFeatureInfo', service, layer, image.cols, image.rows, `&QUERY_LAYERS=${layer}&X=${index % image.cols}&Y=${Math.floor(index / image.cols)}&INFO_FORMAT=text/plain`))).text();
  return Number(/value_0 = '([^']+)'/.exec(text)?.[1]);
}
/**
 * A grey-scale layer as figures. The service stretches each image between the lowest and the
 * highest value it holds, so the greys of two requests do not mean the same: the line from grey
 * to figure is fitted afresh, on a dozen pixels the service is asked about, and has to hold.
 */
async function measured(layer: string, tolerance: number): Promise<{ values: Float32Array; cols: number; rows: number }> {
  const service = 'variables-biofisiques-arbrat';
  const image = await raster(service, layer, CANOPY_CELL_M);
  const valid = Array.from({ length: image.cols * image.rows }, (_, i) => i).filter((i) => image.rgba[i * 4 + 3]! > 0);
  const values = new Float32Array(image.cols * image.rows).fill(Number.NaN);
  if (!valid.length) return { values, cols: image.cols, rows: image.rows };
  const byGrey = [...valid].sort((a, b) => image.rgba[a * 4]! - image.rgba[b * 4]!);
  const samples = Array.from({ length: 12 }, (_, k) => byGrey[Math.round((k / 11) * (byGrey.length - 1))]!);
  const pairs: Array<[number, number]> = [];
  for (const index of samples) pairs.push([image.rgba[index * 4]!, await valueAt(service, layer, image, index)]);
  const n = pairs.length;
  const [sg, sv] = [pairs.reduce((s, p) => s + p[0], 0), pairs.reduce((s, p) => s + p[1], 0)];
  const slope = (n * pairs.reduce((s, p) => s + p[0] * p[1], 0) - sg * sv) / (n * pairs.reduce((s, p) => s + p[0] * p[0], 0) - sg * sg || 1);
  const offset = (sv - slope * sg) / n;
  const worst = Math.max(...pairs.map(([g, v]) => Math.abs(slope * g + offset - v)));
  if (!(worst <= tolerance)) throw new Error(`ICGC ${layer}: grey does not follow the figures (off by ${worst.toFixed(2)})`);
  for (const index of valid) values[index] = slope * image.rgba[index * 4]! + offset;
  return { values, cols: image.cols, rows: image.rows };
}
const cover = await measured('recobriment_arbori_2016_2017', 2.5);
const height = await measured('alcada_mitjana_2016_2017', 0.6);
const land = await raster('cobertes-sol', 'cobertes_2024', COVER_CELL_M);
const canopy: Canopy = { cellM: CANOPY_CELL_M, cols: cover.cols, rows: cover.rows, x0: box.west - meta.x0, y0: box.south - meta.y0, cover: cover.values, heightM: height.values };

// The land-cover map comes as colours: what each one stands for is asked of the service itself,
// at a pixel well inside an area of that colour, three times over.
const colourAt = (col: number, row: number): number => (land.rgba[(row * land.cols + col) * 4]! << 16) | (land.rgba[(row * land.cols + col) * 4 + 1]! << 8) | land.rgba[(row * land.cols + col) * 4 + 2]!;
const inside = new Map<number, Array<[number, number]>>();
for (let row = 2; row < land.rows - 2; row += 3) {
  for (let col = 2; col < land.cols - 2; col += 3) {
    const colour = colourAt(col, row);
    const seen = inside.get(colour) ?? inside.set(colour, []).get(colour)!;
    if (seen.length >= 3) continue;
    let even = true;
    for (let dr = -2; dr <= 2 && even; dr++) for (let dc = -2; dc <= 2 && even; dc++) even = colourAt(col + dc, row + dr) === colour;
    if (even) seen.push([col, row]);
  }
}
const legend = new Map<number, string>();
for (const [colour, pixels] of inside) {
  const names: string[] = [];
  for (const [col, row] of pixels) {
    const text = await (await fetch(query('GetFeatureInfo', 'cobertes-sol', 'cobertes_2024', land.cols, land.rows, `&QUERY_LAYERS=cobertes_2024&X=${col}&Y=${row}&INFO_FORMAT=text/plain`))).text();
    // The name may hold an apostrophe ("Boscos densos d'aciculifolis"): it runs up to the next field.
    const name = /class = '(.*?)'\s+red = /.exec(text)?.[1];
    if (name) names.push(name);
  }
  const best = names.sort((a, b) => names.filter((n) => n === b).length - names.filter((n) => n === a).length)[0];
  if (best) legend.set(colour, best);
}
// Conifers are drawn as pines; evergreen oaks (holm, cork) as oaks; the rest of the woods, and the trees along a river, as deciduous.
const kindOf = (name: string | undefined): TreeKind | null =>
  !name ? null : /aciculifolis/i.test(name) ? 'pine' : /esclerofil/i.test(name) ? 'oak' : /caducifolis|ribera/i.test(name) ? 'deciduous' : null;
const landAt = ([x, y]: Point): string | undefined => {
  const col = Math.floor((meta.x0 + x - box.west) / COVER_CELL_M);
  const row = Math.floor((box.north - (meta.y0 + y)) / COVER_CELL_M);
  return col < 0 || row < 0 || col >= land.cols || row >= land.rows ? undefined : legend.get(colourAt(col, row));
};
const forest = forestTrees({ route, canopy, kindAt: (point) => kindOf(landAt(point)), ...TREES });
// Olive groves are a crop: the LiDAR tree layers leave them out. Planted in rows about 7 m apart, some 4 m tall.
const groves = groveTrees({ route, planted: (point) => /oliverars/i.test(landAt(point) ?? ''), kind: 'olive', spacingM: 7, heightM: 4, corridorM: TREES.corridorM });
const trees = [...forest, ...groves];
// What the land-cover map has within reach of the route, for the record of each run.
const near = new Map<string, number>();
for (let i = 0; i < route.length; i += 4) for (const d of [-40, 0, 40]) {
  const name = landAt([route[i]![0] + d, route[i]![1] + d]) ?? '?';
  near.set(name, (near.get(name) ?? 0) + 1);
}
console.log([...near].sort((a, b) => b[1] - a[1]).slice(0, 9).map(([name, n]) => `${n} ${name}`).join(' · '));

const tenths = (v: number): number => Math.round(v * 10);
const buildings = [...cache.values()]
  .flatMap((tile) => tile.buildings)
  .flatMap((b) => b.polygons.map((polygon) => ({ heightM: b.heightM, polygon })))
  .filter((b) => b.polygon[0]!.some((p) => distanceToLine(p, route) <= BUILDING_CORRIDOR_M))
  .map((b) => ({ h: b.heightM, rings: b.polygon.map((ring) => ring.flatMap(([x, y]) => [tenths(x), tenths(y)])) }));

const world = {
  attribution: 'Edificis, variables de l’arbrat (LiDAR 2016-2017) i cobertes del sòl (2024): © Institut Cartogràfic i Geològic de Catalunya (ICGC), CC BY 4.0',
  kinds: TREE_KINDS,
  // Tenths of a metre from the south-west corner of the terrain. Trees: x, y, height, elevation of the ground under it, kind (index of `kinds`).
  treeSpacingM: TREES.spacingM,
  treeCorridorM: TREES.corridorM,
  buildingCorridorM: BUILDING_CORRIDOR_M,
  trees: trees.flatMap(([x, y, h, kind]) => [tenths(x), tenths(y), tenths(h), tenths(groundAt([x, y])), TREE_KINDS.indexOf(kind)]),
  buildings,
};
const json = JSON.stringify(world);
writeFileSync(join(dir, 'world.json'), json + '\n');
const count = (kind: TreeKind): number => trees.filter((tree) => tree[3] === kind).length;
console.log(`${trees.length} trees (${TREE_KINDS.map((kind) => `${count(kind)} ${kind}`).join(', ')}), ${buildings.length} buildings, world.json ${(json.length / 1024).toFixed(1)} KB`);
