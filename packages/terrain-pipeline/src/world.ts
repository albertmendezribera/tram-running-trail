/**
 * What stands along a route, for the view from the ground (E18): the buildings
 * the ICGC maps, with their own heights, and trees placed inside the woods it maps.
 * The woods and the buildings are data; where each tree stands inside a wood, and
 * how tall it is, is not: the view says so. Metres from the south-west corner of
 * the route's terrain, as the route itself.
 */
export type Point = readonly [number, number];
/** Rings of one or more polygons: a point is inside when it falls within an odd number of them. */
export type Rings = ReadonlyArray<ReadonlyArray<Point>>;

export function insideRings(point: Point, rings: Rings): boolean {
  const [x, y] = point;
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]!;
      const [xj, yj] = ring[j]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Distance from a point to a polyline, in the units of both. */
export function distanceToLine(point: Point, line: ReadonlyArray<Point>): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1]!;
    const [bx, by] = line[i]!;
    const dx = bx - ax;
    const dy = by - ay;
    const length = dx * dx + dy * dy;
    const t = length ? Math.min(1, Math.max(0, ((point[0] - ax) * dx + (point[1] - ay) * dy) / length)) : 0;
    best = Math.min(best, Math.hypot(point[0] - ax - dx * t, point[1] - ay - dy * t));
  }
  return best;
}

/** A number in [0, 1) that depends only on the cell: the same wood grows the same trees on every run. */
export function hash(a: number, b: number, salt = 0): number {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(salt, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** What kind of tree grows at a place, by the land-cover map: it sets the shape and the green of the tree drawn. */
export type TreeKind = 'pine' | 'oak' | 'deciduous' | 'olive';
export const TREE_KINDS: readonly TreeKind[] = ['pine', 'oak', 'deciduous', 'olive'];

/**
 * The canopy as LiDAR measured it (ICGC, tree variables): for each cell, the share of
 * ground under trees and their mean height. Row 0 is the north edge; x0 and y0 are the
 * south-west corner, in the metres of the route.
 */
export interface Canopy {
  cellM: number;
  cols: number;
  rows: number;
  x0: number;
  y0: number;
  /** Percent of the cell under trees, 0–100. Anything else is "no data". */
  cover: ArrayLike<number>;
  /** Mean height of the trees of the cell, in metres. */
  heightM: ArrayLike<number>;
}

export type Tree = [x: number, y: number, heightM: number, kind: TreeKind];

export interface ForestOptions {
  route: ReadonlyArray<Point>;
  canopy: Canopy;
  /** The kind of wood at a point, or null where the land-cover map has none. */
  kindAt(point: Point): TreeKind | null;
  /** Metres between trees where the canopy is closed: fewer trees than a real wood, each drawn larger. */
  spacingM?: number;
  /** Trees are placed up to this far from the route: beyond it the view from the ground does not reach. */
  corridorM?: number;
  /** No tree this close to the route: a path runs through a wood, not through its trunks. */
  clearanceM?: number;
}

/**
 * Trees where the LiDAR found them: as many in each cell as its cover asks for, as tall
 * as its mean height (give or take, as in any wood). How many and how tall is measured,
 * cell by cell; where each one stands inside its cell is not.
 */
export function forestTrees({ route, canopy, kindAt, spacingM = 8.5, corridorM = 110, clearanceM = 4 }: ForestOptions): Tree[] {
  const trees: Tree[] = [];
  const coarse = route.filter((_, i) => i % 3 === 0 || i === route.length - 1);
  const { cellM, cols, rows } = canopy;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cover = canopy.cover[r * cols + c]!;
      const mean = canopy.heightM[r * cols + c]!;
      // Under two metres it is scrub, not trees; above sixty, or over a hundred percent, the cell holds no data.
      if (!(cover >= 5 && cover <= 100 && mean >= 2 && mean <= 60)) continue;
      const west = canopy.x0 + c * cellM;
      const south = canopy.y0 + (rows - 1 - r) * cellM;
      if (distanceToLine([west + cellM / 2, south + cellM / 2], coarse) > corridorM + cellM * 1.5) continue;
      const wanted = ((cover / 100) * cellM * cellM) / (spacingM * spacingM);
      const count = Math.floor(wanted) + (hash(c, r, 9) < wanted % 1 ? 1 : 0);
      for (let k = 0; k < count; k++) {
        const point: Point = [west + hash(c, r, 10 + k * 3) * cellM, south + hash(c, r, 11 + k * 3) * cellM];
        const distance = distanceToLine(point, route);
        if (distance > corridorM || distance < clearanceM) continue;
        trees.push([Number(point[0].toFixed(1)), Number(point[1].toFixed(1)), Number((mean * (0.8 + hash(c, r, 12 + k * 3) * 0.45)).toFixed(1)), kindAt(point) ?? 'oak']);
      }
    }
  }
  return trees;
}

export interface GroveOptions {
  route: ReadonlyArray<Point>;
  /** True where the land-cover map has this crop. */
  planted(point: Point): boolean;
  kind: TreeKind;
  /** Metres between trees of the grove, and how tall they are: typical of the crop, not measured. */
  spacingM: number;
  heightM: number;
  corridorM?: number;
  clearanceM?: number;
}

/** A crop of trees (an olive grove) as rows of them: the LiDAR tree layers leave crops out, the land-cover map does not. */
export function groveTrees({ route, planted, kind, spacingM, heightM, corridorM = 110, clearanceM = 3 }: GroveOptions): Tree[] {
  const xs = route.map((p) => p[0]);
  const ys = route.map((p) => p[1]);
  const coarse = route.filter((_, i) => i % 3 === 0 || i === route.length - 1);
  const trees: Tree[] = [];
  for (let i = Math.floor((Math.min(...xs) - corridorM) / spacingM); i <= Math.ceil((Math.max(...xs) + corridorM) / spacingM); i++) {
    for (let j = Math.floor((Math.min(...ys) - corridorM) / spacingM); j <= Math.ceil((Math.max(...ys) + corridorM) / spacingM); j++) {
      // Rows, as planted: almost on the grid.
      const point: Point = [(i + 0.4 + hash(i, j, 1) * 0.2) * spacingM, (j + 0.4 + hash(i, j, 2) * 0.2) * spacingM];
      if (distanceToLine(point, coarse) > corridorM + spacingM) continue;
      const distance = distanceToLine(point, route);
      if (distance > corridorM || distance < clearanceM || !planted(point)) continue;
      trees.push([Number(point[0].toFixed(1)), Number(point[1].toFixed(1)), Number((heightM * (0.85 + hash(i, j, 3) * 0.3)).toFixed(1)), kind]);
    }
  }
  return trees;
}

/** Splits the rings of a vector-tile polygon into polygons: an outer ring (positive area, y down) and its holes. */
export function polygonsOf(rings: Rings): Point[][][] {
  const area = (ring: ReadonlyArray<Point>): number => ring.reduce((sum, [x, y], i) => sum + (ring[(i + 1) % ring.length]![0] - x) * (ring[(i + 1) % ring.length]![1] + y), 0);
  const polygons: Point[][][] = [];
  for (const ring of rings) {
    if (ring.length < 3) continue;
    // In tile coordinates (y down) an outer ring runs clockwise: this sum is negative for it.
    if (area(ring) < 0 || !polygons.length) polygons.push([[...ring]]);
    else polygons.at(-1)!.push([...ring]);
  }
  return polygons;
}

/** A building as the ICGC maps it: a whole block of houses is often one outline, with one height. */
export interface Block {
  heightM: number;
  /** Outline and courtyards. */
  polygon: Point[][];
}
/** A part of a building as the cadastre has it: one house, or one wing of it, with its floors. */
export interface HousePart {
  floors: number;
  rings: Point[][];
  use: string | null;
  year: number | null;
}
export interface Built {
  heightM: number;
  rings: Point[][];
  /** Floors above ground, use and year built, where the cadastre gives them. */
  floors?: number;
  use?: string;
  year?: number;
}
/** What a floor is taken to measure where the height comes from the count of floors. */
export const FLOOR_HEIGHT_M = 3;

const areaOf = (ring: ReadonlyArray<Point>): number => {
  let area = 0;
  for (let i = 0; i < ring.length; i++) area += ring[i]![0] * ring[(i + 1) % ring.length]![1] - ring[(i + 1) % ring.length]![0] * ring[i]![1];
  return area / 2;
};
/** A point inside a ring: its centre of mass, or failing that a point between it and a corner. */
function heartOf(ring: ReadonlyArray<Point>): Point {
  const area = areaOf(ring) || 1;
  let [cx, cy] = [0, 0];
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i]!;
    const [bx, by] = ring[(i + 1) % ring.length]!;
    const cross = ax * by - bx * ay;
    cx += (ax + bx) * cross;
    cy += (ay + by) * cross;
  }
  const centre: Point = [cx / (6 * area), cy / (6 * area)];
  if (insideRings(centre, [ring])) return centre;
  for (let i = 0; i < ring.length; i++) {
    for (let j = i + 2; j < ring.length; j++) {
      const middle: Point = [(ring[i]![0] + ring[j]![0]) / 2, (ring[i]![1] + ring[j]![1]) / 2];
      if (insideRings(middle, [ring])) return middle;
    }
  }
  return centre;
}
/** A ring without its closing point, without points doubled or lying on the line between their neighbours. */
export function tidyRing(ring: ReadonlyArray<Point>, slackM = 0.12): Point[] {
  let points = ring.filter((p, i) => i === 0 || Math.hypot(p[0] - ring[i - 1]![0], p[1] - ring[i - 1]![1]) > 0.05);
  if (points.length > 1 && Math.hypot(points[0]![0] - points.at(-1)![0], points[0]![1] - points.at(-1)![1]) <= 0.05) points = points.slice(0, -1);
  for (let changed = true; changed && points.length > 3; ) {
    changed = false;
    for (let i = 0; i < points.length && points.length > 3; i++) {
      const [a, b, c] = [points[(i + points.length - 1) % points.length]!, points[i]!, points[(i + 1) % points.length]!];
      if (distanceToLine(b, [a, c]) < slackM) {
        points.splice(i, 1);
        changed = true;
      }
    }
  }
  return points;
}

export interface HousesOptions {
  blocks: ReadonlyArray<Block>;
  parts: ReadonlyArray<HousePart>;
  route: ReadonlyArray<Point>;
  /** How far from the route a block is told apart into its houses, in metres. */
  detailM: number;
  /** The smallest part worth drawing, in square metres. */
  smallestM2?: number;
}

/**
 * The buildings along a route, house by house where the cadastre tells them apart. The ICGC says
 * where there is a building; near the route, each of its blocks is replaced by the parts the
 * cadastre has inside it, each with its own floors. A block the cadastre has nothing in, or one
 * far from the route, stays as the ICGC drew it, with the height it measured.
 */
export function housesOf({ blocks, parts, route, detailM, smallestM2 = 8 }: HousesOptions): Built[] {
  const CELL = 40;
  const hearts = new Map<string, Array<{ part: HousePart; heart: Point }>>();
  for (const part of parts) {
    if (part.floors < 1 || !part.rings[0] || Math.abs(areaOf(part.rings[0])) < smallestM2) continue;
    const heart = heartOf(part.rings[0]);
    const key = `${Math.floor(heart[0] / CELL)},${Math.floor(heart[1] / CELL)}`;
    (hearts.get(key) ?? hearts.set(key, []).get(key)!).push({ part, heart });
  }
  const built: Built[] = [];
  for (const block of blocks) {
    const outer = block.polygon[0]!;
    const xs = outer.map((p) => p[0]);
    const ys = outer.map((p) => p[1]);
    const inside: HousePart[] = [];
    if (outer.some((p) => distanceToLine(p, route) <= detailM)) {
      for (let i = Math.floor(Math.min(...xs) / CELL); i <= Math.floor(Math.max(...xs) / CELL); i++) {
        for (let j = Math.floor(Math.min(...ys) / CELL); j <= Math.floor(Math.max(...ys) / CELL); j++) {
          for (const { part, heart } of hearts.get(`${i},${j}`) ?? []) if (insideRings(heart, block.polygon)) inside.push(part);
        }
      }
    }
    if (!inside.length) {
      built.push({ heightM: block.heightM, rings: block.polygon.map((ring) => tidyRing(ring)) });
      continue;
    }
    for (const part of inside) {
      const rings = part.rings.map((ring) => tidyRing(ring)).filter((ring) => ring.length >= 3);
      if (!rings.length) continue;
      built.push({ heightM: part.floors * FLOOR_HEIGHT_M, rings, floors: part.floors, ...(part.use ? { use: part.use } : {}), ...(part.year ? { year: part.year } : {}) });
    }
  }
  return built;
}

/**
 * How much a pixel of the orthophoto looks like the crown of a tree, from 0 to 1. In the ICGC's
 * photograph a crown is dark and olive rather than green: more green than blue, not much redder
 * than it is green. A lawn has the hue and is light; a shadow is dark and grey; tile is red;
 * tarmac and the sea have no more green than blue. None of them is a crown.
 */
export function crownOf(red: number, green: number, blue: number): number {
  const light = 0.3 * red + 0.59 * green + 0.11 * blue;
  const unit = (value: number): number => Math.min(1, Math.max(0, value));
  return unit((green - blue - 10) / 12) * unit((18 - (red - green)) / 12) * unit((132 - light) / 30);
}

export interface TownTreesOptions {
  route: ReadonlyArray<Point>;
  /** How much each cell of the photograph looks like a crown (`crownOf`). Row 0 is the north edge; the south-west corner is the origin of the route. */
  crowns: { cellM: number; cols: number; rows: number; values: Float32Array };
  /** Where a street tree may stand: among houses or in a park, and not inside a building. */
  allowed: (point: Point) => boolean;
  spacingM?: number;
  corridorM?: number;
  clearanceM?: number;
  /** The height given to a tree whose height nobody measured. */
  heightM?: number;
}

/**
 * The trees of a street, a square or a promenade, which the LiDAR tree layers leave out: they only
 * cover woods. A tree is stood where the photograph shows the dark green of a crown over a few
 * pixels, one to each patch of ground. That there are trees there is read from the photograph;
 * which tree, how many to a row and how tall is not known: the height is a usual one.
 */
export function townTrees({ route, crowns, allowed, spacingM = 7, corridorM = 70, clearanceM = 3.5, heightM = 9 }: TownTreesOptions): Tree[] {
  const { cellM, cols, rows, values } = crowns;
  const at = (col: number, row: number): number => (col < 0 || row < 0 || col >= cols || row >= rows ? 0 : values[row * cols + col]!);
  const per = Math.max(1, Math.round(spacingM / cellM));
  const xs = route.map((p) => p[0]);
  const ys = route.map((p) => p[1]);
  const [firstCol, lastCol] = [Math.max(0, Math.floor((Math.min(...xs) - corridorM) / cellM)), Math.min(cols - 1, Math.ceil((Math.max(...xs) + corridorM) / cellM))];
  const [firstRow, lastRow] = [Math.max(0, Math.floor(rows - (Math.max(...ys) + corridorM) / cellM)), Math.min(rows - 1, Math.ceil(rows - (Math.min(...ys) - corridorM) / cellM))];
  const trees: Tree[] = [];
  const stood = new Map<string, Point[]>();
  const cellOf = (p: Point): string => `${Math.floor(p[0] / spacingM)},${Math.floor(p[1] / spacingM)}`;
  for (let row0 = firstRow - (firstRow % per); row0 <= lastRow; row0 += per) {
    for (let col0 = firstCol - (firstCol % per); col0 <= lastCol; col0 += per) {
      // The pixel of this patch that looks most like a crown.
      let [best, col, row] = [0, 0, 0];
      for (let r = row0; r < row0 + per; r++) for (let c = col0; c < col0 + per; c++) if (at(c, r) > best) [best, col, row] = [at(c, r), c, r];
      if (best < 0.5) continue;
      // A crown is several pixels across: one dark green pixel on its own is a shutter, or a car.
      let around = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) around += at(col + dc, row + dr) / 9;
      if (around < 0.4) continue;
      const point: Point = [(col + 0.2 + 0.6 * hash(col, row, 31)) * cellM, (rows - row - 0.8 + 0.6 * hash(col, row, 32)) * cellM];
      const away = distanceToLine(point, route);
      if (away < clearanceM || away > corridorM || !allowed(point)) continue;
      // Not two trees in one crown, where it lies across two patches.
      const [i, j] = cellOf(point).split(',').map(Number) as [number, number];
      let crowded = false;
      for (let di = -1; di <= 1 && !crowded; di++) for (let dj = -1; dj <= 1 && !crowded; dj++) crowded = (stood.get(`${i + di},${j + dj}`) ?? []).some((other) => Math.hypot(other[0] - point[0], other[1] - point[1]) < spacingM * 0.7);
      if (crowded) continue;
      (stood.get(cellOf(point)) ?? stood.set(cellOf(point), []).get(cellOf(point))!).push(point);
      trees.push([point[0], point[1], heightM * (0.8 + 0.4 * hash(col, row, 33)), 'deciduous']);
    }
  }
  return trees;
}
