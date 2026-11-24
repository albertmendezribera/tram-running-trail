// The ground under a visitor's track: the frame of the plate, the track inside it, and what to do with
// the cells the elevation model has nothing for. Pure sums: the model itself is asked for elsewhere.
import { toUtm } from '@tram/terrain-pipeline/utm';

export type Point = [x: number, y: number];

/** A grid of square cells over the ground, in UTM metres. Row 0 is its north edge. */
export interface Frame {
  /** The UTM zone the metres are of. */
  zone: number;
  x0: number;
  y0: number;
  cell: number;
  cols: number;
  rows: number;
}

/** The ICGC's model is of Catalonia, in the metres of zone 31 (EPSG:25831). */
export const ICGC_ZONE = 31;
const CATALONIA = { south: 40.4, north: 42.95, west: 0.1, east: 3.4 };
/** Metres of ground left around the track, as around the routes of the site. */
const MARGIN_M = 400;
/** The cells along the longer side of the frame, at most: what a phone can ask for and draw at once. */
const MOST_CELLS = 200;

/** The UTM zone a longitude falls in. */
export const zoneOf = (lon: number): number => Math.min(60, Math.max(1, Math.floor((lon + 180) / 6) + 1));

/** Whether every point is where the ICGC's model can be: a first sieve, not a border. */
export const inCatalonia = (points: ReadonlyArray<{ lat: number; lon: number }>): boolean =>
  points.every((p) => p.lat >= CATALONIA.south && p.lat <= CATALONIA.north && p.lon >= CATALONIA.west && p.lon <= CATALONIA.east);

/** The track in the metres of one zone: the ICGC's in Catalonia, its own anywhere else. */
export function project(points: ReadonlyArray<{ lat: number; lon: number }>): { zone: number; xy: Point[] } {
  const middle = points[Math.floor(points.length / 2)]!;
  const zone = inCatalonia(points) ? ICGC_ZONE : zoneOf(middle.lon);
  return { zone, xy: points.map((p) => toUtm(p.lat, p.lon, zone)) };
}

/**
 * The frame of a track: its bounds and a margin, in cells of a size that keeps the longer side under
 * `MOST_CELLS`. The cell is a multiple of five metres, ten at the least: the model has a point every five.
 * With `aspect` (width over height) the frame grows, evenly at both sides, to that shape: the ground a
 * design shows through a window of its own.
 */
export function frameOf(xy: readonly Point[], zone: number, aspect?: number): Frame {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of xy) [minX, minY, maxX, maxY] = [Math.min(minX, x), Math.min(minY, y), Math.max(maxX, x), Math.max(maxY, y)];
  let [width, height] = [maxX - minX + MARGIN_M * 2, maxY - minY + MARGIN_M * 2];
  if (aspect) [width, height] = width / height < aspect ? [height * aspect, height] : [width, width / aspect];
  const cell = Math.max(10, Math.ceil(Math.max(width, height) / MOST_CELLS / 5) * 5);
  const x0 = Math.floor(((minX + maxX) / 2 - width / 2) / cell) * cell;
  const y0 = Math.floor(((minY + maxY) / 2 - height / 2) / cell) * cell;
  return { zone, x0, y0, cell, cols: Math.ceil(width / cell), rows: Math.ceil(height / cell) };
}

/** The track in metres from the south-west corner of its frame, a point every ten metres or every third of a cell. */
export function routeIn(frame: Frame, xy: readonly Point[]): Point[] {
  const apart = Math.max(10, frame.cell / 3);
  const route: Point[] = [];
  let last: Point | undefined;
  xy.forEach(([x, y], i) => {
    const here: Point = [Number((x - frame.x0).toFixed(1)), Number((y - frame.y0).toFixed(1))];
    if (!last || i === xy.length - 1 || Math.hypot(here[0] - last[0], here[1] - last[1]) >= apart) route.push((last = here));
  });
  return route;
}

/** Under this the model holds nothing: -9999 in the ICGC's answers. */
const NOTHING = -1000;
/** The bed given to the sea, just under the water, so the shore dips into it. It is not a sounding. */
const SEA_BED_M = -2;

/**
 * What to make of the cells with no elevation. Next to land at sea level they are the sea, as for the
 * routes of the site. With no land at sea level the track leaves what the model covers, and there is
 * no relief to draw: null.
 */
export function settle(heights: Float32Array): Float32Array | null {
  let [empty, lowest] = [0, Infinity];
  for (const h of heights) h < NOTHING ? empty++ : (lowest = Math.min(lowest, h));
  if (empty === 0) return heights;
  if (empty === heights.length || lowest > 5) return null;
  return heights.map((h) => (h < NOTHING ? SEA_BED_M : h));
}

/** The elevation of the ground at a point of the frame, between the four cells around it: for a track that brings no heights. */
export function heightAt(frame: Frame, heights: Float32Array, [x, y]: Point): number {
  const c = Math.min(frame.cols - 1.001, Math.max(0, (x - frame.x0) / frame.cell - 0.5));
  const r = Math.min(frame.rows - 1.001, Math.max(0, frame.rows - 0.5 - (y - frame.y0) / frame.cell));
  const [c0, r0] = [Math.floor(c), Math.floor(r)];
  const at = (col: number, row: number): number => heights[row * frame.cols + col]!;
  const [fx, fy] = [c - c0, r - r0];
  return (at(c0, r0) * (1 - fx) + at(c0 + 1, r0) * fx) * (1 - fy) + (at(c0, r0 + 1) * (1 - fx) + at(c0 + 1, r0 + 1) * fx) * fy;
}
