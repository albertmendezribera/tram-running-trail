// The map of the comarques of Catalonia, as a drawing: the outlines `scripts/import-comarques.mjs` reads
// from the ICGC, turned into SVG paths, and the way to put a place on them. One unit of the drawing is a
// hundred metres on the ground (UTM 31N), with the north at the top.
import { toUtm } from '@tram/terrain-pipeline/utm';
import data from './comarques.json';

const UNIT_M = 100;
/** Room left around the land, in units of the drawing: a dot on the coast is not cut. */
const MARGIN = 60;

const all = data.comarques.flatMap((comarca) => comarca.rings);
const xs = all.flatMap((ring) => ring.filter((_, i) => i % 2 === 0));
const ys = all.flatMap((ring) => ring.filter((_, i) => i % 2 === 1));
const [west, north] = [Math.min(...xs), Math.max(...ys)];
const at = (x: number, y: number): [number, number] => [Math.round((x - west) / UNIT_M) + MARGIN, Math.round((north - y) / UNIT_M) + MARGIN];

// Each outline as a first point and steps from one to the next: half the text of naming every point.
function pathOf(ring: readonly number[]): string {
  let [px, py] = at(ring[0]!, ring[1]!);
  let d = `M${px} ${py}`;
  for (let i = 2; i < ring.length; i += 2) {
    const [x, y] = at(ring[i]!, ring[i + 1]!);
    if (x === px && y === py) continue;
    d += `l${x - px} ${y - py}`;
    [px, py] = [x, y];
  }
  return `${d}z`;
}

export const COMARCA_MAP = {
  width: Math.round((Math.max(...xs) - west) / UNIT_M) + MARGIN * 2,
  height: Math.round((north - Math.min(...ys)) / UNIT_M) + MARGIN * 2,
  areas: data.comarques.map((comarca) => ({ name: comarca.name, d: comarca.rings.map(pathOf).join('') })),
};

/** A comarca fills this share of the side of its own view: the rest is its neighbours, to say where it is. */
const SHARE = 0.45;
/** No view is narrower than this, in units of the drawing: the smallest comarca is still seen among others. */
const NARROWEST = 350;

/** The square of the drawing to show for one comarca: itself in the middle, its neighbours around. */
export function viewOf(name: string): [x: number, y: number, width: number, height: number] | undefined {
  const comarca = data.comarques.find((other) => other.name === name);
  if (!comarca) return undefined;
  const corners = comarca.rings.flatMap((ring) => ring.flatMap((_, i) => (i % 2 === 0 ? [at(ring[i]!, ring[i + 1]!)] : [])));
  const [x0, x1] = [Math.min(...corners.map((c) => c[0])), Math.max(...corners.map((c) => c[0]))];
  const [y0, y1] = [Math.min(...corners.map((c) => c[1])), Math.max(...corners.map((c) => c[1]))];
  const side = Math.round(Math.max(NARROWEST, Math.max(x1 - x0, y1 - y0) / SHARE));
  return [Math.round((x0 + x1 - side) / 2), Math.round((y0 + y1 - side) / 2), side, side];
}

/** Where a place is on the drawing, from its latitude and longitude. */
export const onMap = (lat: number, lon: number): { x: number; y: number } => {
  const [x, y] = at(...toUtm(lat, lon));
  return { x, y };
};

export const COMARQUES_SOURCE = data.source as { name: string; url: string; terms: string };
export const COMARQUES_CREDIT = 'Límits de comarca: © Institut Cartogràfic i Geològic de Catalunya (ICGC), CC BY 4.0';
