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
