// Terrain and route of a route folder → world.json: the buildings the ICGC maps along the route, and trees
// where its LiDAR found them, of the kind its land-cover map says (E18).
// Usage: node src/world-cli.ts <routeDir>
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import sharp from 'sharp';
import { CADASTRE_ATTRIBUTION, fetchCadastre, tilesNear } from './cadastre.ts';
import { fetchOsmPlaces, OSM_ATTRIBUTION } from './osm.ts';
import { decodeTerrainRgb } from './terrain-rgb.ts';
import { toLngLat, toUtm } from './utm.ts';
import { type Canopy, crownOf, distanceToLine, forestTrees, groveTrees, housesOf, insideRings, type Point, polygonsOf, townTrees, TREE_KINDS, type TreeKind } from './world.ts';

const [dir] = process.argv.slice(2);
if (!dir) throw new Error('usage: node src/world-cli.ts <routeDir>');
const meta = JSON.parse(readFileSync(join(dir, 'terrain.json'), 'utf8')) as { x0: number; y0: number; cols: number; rows: number; cell: number; seaBedM?: number };
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
// Six metres clear of the path: the camera of the view from the ground runs along it, under the crowns.
const TREES = { spacingM: 8.5, corridorM: 110, clearanceM: 6 };
/** ICGC map services: the tree variables measured by LiDAR (2016-2017, cells of 20 m) and the land-cover map of 2024. */
const WMS = 'https://geoserveis.icgc.cat/servei/catalunya';
const CANOPY_CELL_M = 20;
const COVER_CELL_M = 2;
/** The photograph of the ground, over the whole terrain of the route, and the kinds of ground near it, as textures. */
// The photograph is asked for as fine as a phone can hold in one texture (4,096 pixels a side): a metre
// to the pixel for a small terrain, and no more pixels in all than a megabyte and a half or so of image.
// From the ground every pixel counts: a zebra crossing, a strip of grass.
const ORTHO_SIDE = 4096;
const ORTHO_PIXELS = 7.2e6;
const orthoCellM =
  [1, 1.25, 2, 2.5].find((cellM) => [meta.cols, meta.rows].every((cells) => Number.isInteger((cells * meta.cell) / cellM) && (cells * meta.cell) / cellM <= ORTHO_SIDE) && (meta.cols * meta.rows * meta.cell ** 2) / cellM ** 2 <= ORTHO_PIXELS) ?? 5;
const ORTHO = { url: 'https://geoserveis.icgc.cat/servei/catalunya/mapa-base/wms/service', layer: 'orto', cellM: orthoCellM, tile: 1800 };
const LAND_CELL_M = 4;
const BUILDING_CORRIDOR_M = 260;
/** Within this distance of the route a block of the map is told apart into the houses the cadastre has in it. */
const HOUSE_CORRIDOR_M = 130;
/** Within this distance of the route the names the map writes are kept: churches, farmhouses, beaches, squares. */
const PLACE_CORRIDOR_M = 200;
/** A bar or a shop is named when the route passes its door. */
const SHOP_CORRIDOR_M = 35;
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
  /** Roads and paths with a known surface, as lines in tile units. `walk` is one for people on foot: a promenade, a square, a path. */
  roads: Array<{ paved: boolean; walk: boolean; lines: Point[][] }>;
  /** Beaches, as the rings of each in the metres of the route. */
  beaches: Point[][][];
  buildings: Array<{ heightM: number; polygons: Point[][][] }>;
  /** What the map names: the name, the class the ICGC gives it, where it is, and the size it writes it in. */
  places: Array<{ name: string; kind: string; at: Point; size: number }>;
}
const cache = new Map<string, Loaded>();
async function load(tx: number, ty: number): Promise<Loaded> {
  const key = `${tx}/${ty}`;
  const known = cache.get(key);
  if (known) return known;
  const response = await fetch(`${TILES}/${ZOOM}/${tx}/${ty}.pbf`);
  if (!response.ok) throw new Error(`ICGC tile ${key}: ${response.status}`);
  const tile = new VectorTile(new PbfReader(new Uint8Array(await response.arrayBuffer())));
  const loaded: Loaded = { roads: [], buildings: [], places: [], beaches: [] };
  const rings = (layer: string, i: number): Point[][] => {
    const feature = tile.layers[layer]!.feature(i);
    return feature.loadGeometry().map((ring) => ring.map((p): Point => [p.x / feature.extent, p.y / feature.extent]));
  };
  const transportation = tile.layers['transportation'];
  for (let i = 0; transportation && i < transportation.length; i++) {
    const { surface, class: kind } = transportation.feature(i).properties;
    if (transportation.feature(i).type !== 2 || (surface !== 'paved' && surface !== 'unpaved')) continue;
    loaded.roads.push({ paved: surface === 'paved', walk: kind === 'pedestrian' || kind === 'path' || kind === 'square', lines: rings('transportation', i) });
  }
  const landcover = tile.layers['landcover'];
  for (let i = 0; landcover && i < landcover.length; i++) {
    if (landcover.feature(i).type !== 3 || landcover.feature(i).properties['class'] !== 'beach') continue;
    loaded.beaches.push(rings('landcover', i).map((ring) => ring.map(([u, v]) => localOf(tx, ty, u, v))));
  }
  const building = tile.layers['building'];
  for (let i = 0; building && i < building.length; i++) {
    const { building: kind, render_height: height } = building.feature(i).properties;
    if (building.feature(i).type !== 3 || !KINDS.has(String(kind)) || !(Number(height) >= 2)) continue;
    loaded.buildings.push({ heightM: Number(height), polygons: polygonsOf(rings('building', i)).map((polygon) => polygon.map((ring) => ring.map(([u, v]) => localOf(tx, ty, u, v)))) });
  }
  // Names: of a point as it is; of a line (a beach, a stream), at its middle; of an area (a port, a school), at the middle of its box.
  for (const name of ['place', 'landuse', 'mountain_peak', 'water_name', 'poi']) {
    const layer = tile.layers[name];
    for (let i = 0; layer && i < layer.length; i++) {
      const feature = layer.feature(i);
      const properties = feature.properties;
      const label = String(properties['name'] ?? '').trim();
      const kind = String(properties['classicgc'] ?? properties['descripcio'] ?? properties['class'] ?? '').trim();
      if (!label || kind === 'parada_autobus' || kind === 'recinte') continue;
      const points = rings(name, i).flat();
      if (!points.length) continue;
      const us = points.map((p) => p[0]);
      const vs = points.map((p) => p[1]);
      const [u, v] = feature.type === 1 ? points[0]! : feature.type === 2 ? points[Math.floor(points.length / 2)]! : [(Math.min(...us) + Math.max(...us)) / 2, (Math.min(...vs) + Math.max(...vs)) / 2];
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;
      loaded.places.push({ name: label, kind, at: localOf(tx, ty, u, v), size: Number(properties['fontsize']) || 6 });
    }
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
const wild = [...forest, ...groves];
// What the land-cover map has within reach of the route, for the record of each run.
const near = new Map<string, number>();
for (let i = 0; i < route.length; i += 4) for (const d of [-40, 0, 40]) {
  const name = landAt([route[i]![0] + d, route[i]![1] + d]) ?? '?';
  near.set(name, (near.get(name) ?? 0) + 1);
}
console.log([...near].sort((a, b) => b[1] - a[1]).slice(0, 9).map(([name, n]) => `${n} ${name}`).join(' · '));

// What is underfoot along the route: the surface of the nearest road or path of the map, when one runs
// within a few metres of the track. Where the map has none, nothing is said.
const tileM = (40075016.686 * Math.cos(((toLngLat(meta.x0, meta.y0)[1]) * Math.PI) / 180)) / scale;
const lengths = [0];
for (let i = 1; i < route.length; i++) lengths.push(lengths[i - 1]! + Math.hypot(route[i]![0] - route[i - 1]![0], route[i]![1] - route[i - 1]![1]));
const nearestRoad = route.map((point) => {
  const { tx, ty, u, v } = tileOf(point);
  let best = 10 / tileM;
  let found: { paved: boolean; walk: boolean } | null = null;
  for (const road of cache.get(`${tx}/${ty}`)?.roads ?? []) {
    for (const line of road.lines) {
      const d = distanceToLine([u, v], line);
      if (d < best) [best, found] = [d, road];
    }
  }
  return found;
});
const surfaces = nearestRoad.map((road) => road?.paved ?? null);
// A stretch is paved when most of what the map knows within 25 m either way is: one stray point changes nothing.
const pavedAt = route.map((_, i) => {
  let [yes, no] = [0, 0];
  for (let k = 0; k < route.length; k++) {
    if (Math.abs(lengths[k]! - lengths[i]!) > 25 || surfaces[k] === null) continue;
    if (surfaces[k]) yes++;
    else no++;
  }
  return yes > no;
});
/** The stretches where something holds, as shares of the route: from, to, from, to… */
const stretchesOf = (holds: readonly boolean[]): number[] => {
  const shares: number[] = [];
  for (let i = 0; i < route.length; i++) {
    if (holds[i] && !holds[i - 1]) shares.push(Number((lengths[i]! / lengths.at(-1)!).toFixed(4)));
    if (holds[i] && !holds[i + 1]) shares.push(Number((lengths[i]! / lengths.at(-1)!).toFixed(4)));
  }
  return shares;
};
const paved = stretchesOf(pavedAt);
// Of the paved stretches, the ones for people on foot: a promenade, a square. No cars, no lines on the ground.
const walkedAt = route.map((_, i) => {
  let [yes, no] = [0, 0];
  for (let k = 0; k < route.length; k++) {
    if (Math.abs(lengths[k]! - lengths[i]!) > 25 || !nearestRoad[k]) continue;
    if (nearestRoad[k]!.walk) yes++;
    else no++;
  }
  return pavedAt[i]! && yes > no;
});
const walked = stretchesOf(walkedAt);

// The kinds of ground the view tells apart, from the land-cover map: each gets its own grain up close, and scrub its bushes.
const GROUND: Array<[RegExp, number]> = [
  [/boscos densos|ribera/i, 1],
  [/boscos clars|matollar/i, 2],
  [/prats|zones verdes/i, 3],
  [/conreus|horta|vinyes|oliverars|fruiters/i, 4],
  [/urb|casc|eixample|industrial|vi[àa]ria|ferrovi|residencial|portu/i, 5],
  [/platg/i, 8],
  [/s[òo]l nu|roquissar/i, 6],
  [/llacs|rius|mar |humides|embassament/i, 7],
];
const groundOf = (name: string | undefined): number => GROUND.find(([pattern]) => name && pattern.test(name))?.[1] ?? 0;
const step = LAND_CELL_M / COVER_CELL_M;
const [landCols, landRows] = [Math.floor(land.cols / step), Math.floor(land.rows / step)];
const kinds = Buffer.alloc(landCols * landRows);
// The land-cover map stops at the shore: the sea is where the model holds no elevation, and the beaches are the map's own.
const beaches = [...cache.values()].flatMap((tile) => tile.beaches).map((rings) => {
  const all = rings.flat();
  return { rings, west: Math.min(...all.map((p) => p[0])), east: Math.max(...all.map((p) => p[0])), south: Math.min(...all.map((p) => p[1])), north: Math.max(...all.map((p) => p[1])) };
});
for (let row = 0; row < landRows; row++) {
  for (let col = 0; col < landCols; col++) {
    const at: Point = [box.west - meta.x0 + (col + 0.5) * LAND_CELL_M, box.north - meta.y0 - (row + 0.5) * LAND_CELL_M];
    const inTerrain = at[0] >= 0 && at[1] >= 0 && at[0] <= (meta.cols - 1) * meta.cell && at[1] <= (meta.rows - 1) * meta.cell;
    const kind =
      meta.seaBedM !== undefined && inTerrain && groundAt(at) <= meta.seaBedM / 2
        ? 7
        : beaches.some((beach) => at[0] >= beach.west && at[0] <= beach.east && at[1] >= beach.south && at[1] <= beach.north && insideRings(at, beach.rings))
          ? 8
          : groundOf(legend.get(colourAt(col * step, row * step)));
    // Between the last thing the land-cover map names and the water there is a strip it leaves blank: the shore, taken for beach.
    const shore = kind === 0 && meta.seaBedM !== undefined && inTerrain && groundAt(at) < 3;
    kinds[row * landCols + col] = (shore ? 8 : kind) * 30;
  }
}
await sharp(kinds, { raw: { width: landCols, height: landRows, channels: 1 } }).png({ compressionLevel: 9 }).toFile(join(dir, 'land.png'));

// The orthophoto over the whole terrain, in the terrain's own coordinates: asked for in pieces the service accepts.
const [orthoCols, orthoRows] = [(meta.cols * meta.cell) / ORTHO.cellM, (meta.rows * meta.cell) / ORTHO.cellM];
const pieces: Array<{ input: Buffer; left: number; top: number }> = [];
for (let top = 0; top < orthoRows; top += ORTHO.tile) {
  for (let left = 0; left < orthoCols; left += ORTHO.tile) {
    const [w, h] = [Math.min(ORTHO.tile, orthoCols - left), Math.min(ORTHO.tile, orthoRows - top)];
    const north = meta.y0 + meta.rows * meta.cell - top * ORTHO.cellM;
    const west = meta.x0 + left * ORTHO.cellM;
    const response = await fetch(`${ORTHO.url}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${ORTHO.layer}&SRS=EPSG:25831&BBOX=${west},${north - h * ORTHO.cellM},${west + w * ORTHO.cellM},${north}&WIDTH=${w}&HEIGHT=${h}&FORMAT=image/jpeg&STYLES=`);
    if (!response.ok) throw new Error(`ICGC orthophoto: ${response.status}`);
    pieces.push({ input: Buffer.from(await response.arrayBuffer()), left, top });
  }
}
const ortho = await sharp({ create: { width: orthoCols, height: orthoRows, channels: 3, background: '#000' } }).composite(pieces).webp({ quality: 72, effort: 5 }).toBuffer();
writeFileSync(join(dir, 'ortho.webp'), ortho);

const tenths = (v: number): number => Math.round(v * 10);
const blocks = [...cache.values()]
  .flatMap((tile) => tile.buildings)
  .flatMap((b) => b.polygons.map((polygon) => ({ heightM: b.heightM, polygon })))
  .filter((b) => b.polygon[0]!.some((p) => distanceToLine(p, route) <= BUILDING_CORRIDOR_M));
// The cadastre, near the route: each house on its own, with its floors, instead of the block it stands in.
const kept = process.env['TRAM_WORLD_CACHE'] ?? join(tmpdir(), 'tram-world');
const cadastre = await fetchCadastre(tilesNear(route.map(([x, y]): [number, number] => [meta.x0 + x, meta.y0 + y]), HOUSE_CORRIDOR_M), kept);
const parts = cadastre.parts.map((part) => ({
  building: part.building,
  floors: part.floors,
  rings: part.rings.map((ring) => ring.map(([x, y]): Point => [x - meta.x0, y - meta.y0])),
  use: cadastre.buildings.get(part.building)?.use ?? null,
  year: cadastre.buildings.get(part.building)?.year ?? null,
}));
const USES = ['residential', 'agriculture', 'industrial', 'office', 'retail', 'public'];
const houses = housesOf({ blocks, parts, route, detailM: HOUSE_CORRIDOR_M });

// The trees of streets, squares and promenades: the LiDAR layers only cover woods, so these are read
// from the photograph, where it shows the dark green of a crown among houses or in a park.
const { data: photo } = await sharp(ortho).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const crowns = new Float32Array(orthoCols * orthoRows);
for (let i = 0; i < crowns.length; i++) crowns[i] = crownOf(photo[i * 3]!, photo[i * 3 + 1]!, photo[i * 3 + 2]!);
const roofed = new Map<string, Point[][]>();
for (const house of houses) {
  const outer = house.rings[0]!;
  for (let i = Math.floor(Math.min(...outer.map((p) => p[0])) / 30); i <= Math.floor(Math.max(...outer.map((p) => p[0])) / 30); i++) {
    for (let j = Math.floor(Math.min(...outer.map((p) => p[1])) / 30); j <= Math.floor(Math.max(...outer.map((p) => p[1])) / 30); j++) (roofed.get(`${i},${j}`) ?? roofed.set(`${i},${j}`, []).get(`${i},${j}`)!).push(outer);
  }
}
const landKindAt = ([x, y]: Point): number => {
  const col = Math.floor((meta.x0 + x - box.west) / LAND_CELL_M);
  const row = Math.floor((box.north - (meta.y0 + y)) / LAND_CELL_M);
  return col < 0 || row < 0 || col >= landCols || row >= landRows ? -1 : kinds[row * landCols + col]! / 30;
};
// Built ground, a park, or ground the land-cover map leaves blank by the shore. Woods and scrub have their own trees; crops are not guessed at.
const TOWN = new Set([0, 3, 5]);
const street = townTrees({
  route,
  crowns: { cellM: ORTHO.cellM, cols: orthoCols, rows: orthoRows, values: crowns },
  allowed: (point) => TOWN.has(landKindAt(point)) && !(roofed.get(`${Math.floor(point[0] / 30)},${Math.floor(point[1] / 30)}`) ?? []).some((outer) => insideRings(point, [outer])),
});
const trees = [...wild, ...street];
const buildings = houses.map((b) => ({
  h: b.heightM,
  ...(b.floors ? { f: b.floors } : {}),
  ...(b.tallest ? { t: b.tallest } : {}),
  ...(b.use ? { u: USES.indexOf(b.use) } : {}),
  ...(b.year ? { y: b.year } : {}),
  rings: b.rings.map((ring) => ring.flatMap(([x, y]) => [tenths(x), tenths(y)])),
}));

// The names the map writes near the route, each once: the nearest of those that share a name, and of
// those the class that says most (a church before "a building").
const VAGUE = new Set(['isolated_dwelling', 'other', 'service', '-', '']);
const named = new Map<string, { name: string; kind: string; at: Point; size: number; away: number }>();
for (const place of [...cache.values()].flatMap((tile) => tile.places)) {
  const away = distanceToLine(place.at, route);
  if (away > PLACE_CORRIDOR_M) continue;
  const key = place.name.toLocaleLowerCase('ca');
  const known = named.get(key);
  if (!known) named.set(key, { ...place, away });
  else if (VAGUE.has(known.kind) && !VAGUE.has(place.kind)) named.set(key, { ...known, kind: place.kind, size: Math.max(known.size, place.size) });
  else if (VAGUE.has(place.kind) === VAGUE.has(known.kind) && away < known.away) named.set(key, { ...place, kind: known.kind, away });
}
const places: Array<{ n: string; k: string; x: number; y: number; s: number; o?: 1 }> = [...named.values()].sort((a, b) => a.away - b.away).map((p) => ({ n: p.name, k: p.kind, x: tenths(p.at[0]), y: tenths(p.at[1]), s: p.size }));
// What OpenStreetMap names at the side of the route and the ICGC does not: bars, shops, a sculpture.
const [west, south] = toLngLat(meta.x0 + Math.min(...route.map((p) => p[0])) - 60, meta.y0 + Math.min(...route.map((p) => p[1])) - 60);
const [east, north] = toLngLat(meta.x0 + Math.max(...route.map((p) => p[0])) + 60, meta.y0 + Math.max(...route.map((p) => p[1])) + 60);
const doors = new Map<string, { name: string; kind: string; at: Point; away: number }>();
for (const place of await fetchOsmPlaces({ south, west, north, east }, kept)) {
  const [x, y] = toUtm(place.lat, place.lon);
  const at: Point = [x - meta.x0, y - meta.y0];
  const away = distanceToLine(at, route);
  const key = place.name.toLocaleLowerCase('ca');
  if (away > SHOP_CORRIDOR_M || named.has(key) || (doors.get(key)?.away ?? Infinity) <= away) continue;
  doors.set(key, { name: place.name, kind: place.kind, at, away });
}
for (const door of [...doors.values()].sort((a, b) => a.away - b.away)) places.push({ n: door.name, k: door.kind, x: tenths(door.at[0]), y: tenths(door.at[1]), s: 4, o: 1 });

const world = {
  attribution: `Edificis, topònims, variables de l’arbrat (LiDAR 2016-2017) i cobertes del sòl (2024): © Institut Cartogràfic i Geològic de Catalunya (ICGC), CC BY 4.0. ${CADASTRE_ATTRIBUTION}. ${OSM_ATTRIBUTION}`,
  kinds: TREE_KINDS,
  // Stretches of the route on a paved road, as shares of its length: from, to, from, to…
  paved,
  // Of those, the stretches for people on foot (a promenade, a square): from, to, from, to…
  walked,
  // Where land.png lies: its south-west corner in metres from the corner of the terrain, and the size of its cells.
  land: { x0: box.west - meta.x0, y0: box.south - meta.y0, cols: landCols, rows: landRows, cellM: LAND_CELL_M },
  // Tenths of a metre from the south-west corner of the terrain. Trees: x, y, height, elevation of the ground under it, kind (index of `kinds`).
  // The last `streetTrees` of them are street trees read from the photograph, of a usual height.
  streetTrees: street.length,
  treeSpacingM: TREES.spacingM,
  treeCorridorM: TREES.corridorM,
  buildingCorridorM: BUILDING_CORRIDOR_M,
  trees: trees.flatMap(([x, y, h, kind]) => [tenths(x), tenths(y), tenths(h), tenths(groundAt([x, y])), TREE_KINDS.indexOf(kind)]),
  // Height in metres; where the cadastre tells the house apart: `f` floors above ground (the height is then three metres a floor), `t` the floors of the tallest part of its building when that is more, `u` its use (index of `uses`) and `y` the year it was built.
  uses: USES,
  buildings,
  // What is named within reach of the route: name, class, place in tenths of a metre, and the size the ICGC's map writes it in.
  // `o` marks the ones that come from OpenStreetMap (ODbL), with its own tags for a class.
  places,
};
const json = JSON.stringify(world);
writeFileSync(join(dir, 'world.json'), json + '\n');
const count = (kind: TreeKind): number => trees.filter((tree) => tree[3] === kind).length;
const pavedShare = paved.reduce((sum, share, i) => sum + (i % 2 ? share - paved[i - 1]! : 0), 0);
console.log(`paved ${(pavedShare * 100).toFixed(0)} % of the route, in ${paved.length / 2} stretches`);
console.log(`ortho.webp ${orthoCols}×${orthoRows}, ${(ortho.length / 1024).toFixed(0)} KB · land.png ${landCols}×${landRows}`);
console.log(`${trees.length} trees (${TREE_KINDS.map((kind) => `${count(kind)} ${kind}`).join(', ')}; ${street.length} of them street trees from the photograph), ${buildings.length} buildings (${buildings.filter((b) => 'f' in b).length} houses of the cadastre in ${blocks.length} blocks of the map), ${places.length} names (${doors.size} from OpenStreetMap), world.json ${(json.length / 1024).toFixed(1)} KB`);
