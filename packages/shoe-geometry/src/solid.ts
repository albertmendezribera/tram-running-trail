/**
 * The profile of a shoe given its width: the sole as solid layers, for the 3D
 * view. The widths of the heel and the forefoot are figures; the outline between
 * them, seen from above, is not, and the solid says so. Millimetres, as the
 * profile: x from heel to toe, y up from the ground, z across the shoe.
 */
import { buildShoeProfile, type Assumption, type Point, type ShoeSpecs } from './index.ts';

export interface SolidSpecs extends ShoeSpecs {
  /** Widest point of the midsole under the forefoot and under the heel. */
  widthForefootMm: number;
  widthHeelMm: number;
}

/** Triangles ready for a GPU buffer. */
export interface Mesh {
  positions: Float32Array;
  indices: Uint32Array;
}

export interface ShoeSolid {
  lengthMm: number;
  heightMm: number;
  outsole: Mesh;
  midsole: Mesh;
  insole: Mesh;
  lugs: Mesh | null;
  plate: Mesh | null;
  upper: Mesh;
  /** The upper as a few lines, in pairs of points: some of its arches and the lines along it. */
  upperCage: number[];
  assumed: Array<Assumption | 'plan-shape'>;
}

const PLATE_MM = 1.2;
const HEEL_ROUND = 0.14;
const TOE_ROUND = 0.72;

/** Half the width of the sole at a share of its length: round at both ends, the two measured widths in between. */
export function halfWidth(t: number, heelMm: number, forefootMm: number): number {
  const heel = heelMm / 2;
  const fore = forefootMm / 2;
  let half: number;
  if (t <= HEEL_ROUND) half = heel * Math.sqrt(Math.max(0, 1 - (1 - t / HEEL_ROUND) ** 2));
  else if (t >= TOE_ROUND) half = fore * Math.sqrt(Math.max(0, 1 - ((t - TOE_ROUND) / (1 - TOE_ROUND)) ** 2));
  else {
    const s = (t - HEEL_ROUND) / (TOE_ROUND - HEEL_ROUND);
    half = heel + (fore - heel) * s * s * (3 - 2 * s);
  }
  // Never a knife edge: the ends of a sole are blunt.
  return Math.max(half, Math.min(heel, fore) * 0.12);
}

class Builder {
  positions: number[] = [];
  indices: number[] = [];
  vertex(x: number, y: number, z: number): number {
    this.positions.push(x, y, z);
    return this.positions.length / 3 - 1;
  }
  quad(a: number, b: number, c: number, d: number): void {
    this.indices.push(a, b, c, a, c, d);
  }
  /** A strip between two rows of points: its own vertices, so its shading does not bleed into its neighbours. */
  strip(first: ReadonlyArray<readonly [number, number, number]>, second: ReadonlyArray<readonly [number, number, number]>): void {
    const a = first.map((p) => this.vertex(...p));
    const b = second.map((p) => this.vertex(...p));
    for (let i = 0; i < a.length - 1; i++) this.quad(a[i]!, a[i + 1]!, b[i + 1]!, b[i]!);
  }
  mesh(): Mesh {
    return { positions: new Float32Array(this.positions), indices: new Uint32Array(this.indices) };
  }
}

type P3 = readonly [number, number, number];

/** A layer of the sole: its outline in profile, as wide as the sole at each point. */
function loft(band: readonly Point[], half: (x: number) => number): Mesh {
  const n = band.length / 2;
  const builder = new Builder();
  const bottom = band.slice(0, n);
  const top = band.slice(n).reverse();
  const row = (line: readonly Point[], side: 1 | -1): P3[] => line.map(([x, y]) => [x, y, side * half(x)]);
  builder.strip(row(bottom, 1), row(bottom, -1));
  builder.strip(row(top, -1), row(top, 1));
  builder.strip(row(top, 1), row(bottom, 1));
  builder.strip(row(bottom, -1), row(top, -1));
  // Both ends closed.
  for (const i of [0, n - 1]) {
    const [bl, br, tr, tl] = [row(bottom, -1)[i]!, row(bottom, 1)[i]!, row(top, 1)[i]!, row(top, -1)[i]!];
    if (i === 0) builder.strip([bl, br], [tl, tr]);
    else builder.strip([tl, tr], [bl, br]);
  }
  return builder.mesh();
}

/** Height of a line of the profile at x, between its points. */
function heightAt(line: readonly Point[], x: number): number {
  const sorted = [...line].sort((a, b) => a[0] - b[0]);
  if (x <= sorted[0]![0]) return sorted[0]![1];
  for (let i = 1; i < sorted.length; i++) {
    const [x0, y0] = sorted[i - 1]!;
    const [x1, y1] = sorted[i]!;
    if (x <= x1) return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return sorted.at(-1)![1];
}

export function buildShoeSolid(specs: SolidSpecs): ShoeSolid {
  if (!(specs.widthForefootMm > 0) || !(specs.widthHeelMm > 0)) throw new Error('a shoe solid needs the width of the heel and of the forefoot');
  const profile = buildShoeProfile(specs);
  const L = profile.lengthMm;
  const half = (x: number): number => halfWidth(Math.min(1, Math.max(0, x / L)), specs.widthHeelMm, specs.widthForefootMm);
  const n = profile.insole.length / 2;
  const footbed = profile.insole.slice(n).reverse();

  let lugs: Mesh | null = null;
  if (profile.lugs.length) {
    const builder = new Builder();
    for (const lug of profile.lugs) {
      const w = half((lug[0]![0] + lug[1]![0]) / 2);
      // Three across: how many is the drawing's choice, as in the profile.
      for (const centre of [-0.58, 0, 0.58]) {
        const [z0, z1] = [(centre - 0.2) * w, (centre + 0.2) * w];
        const at = (z: number): P3[] => lug.map(([x, y]) => [x, y, z]);
        const [near, far] = [at(z1), at(z0)];
        builder.strip([near[0]!, near[1]!], [near[3]!, near[2]!]);
        builder.strip([far[1]!, far[0]!], [far[2]!, far[3]!]);
        builder.strip([near[3]!, near[2]!], [far[3]!, far[2]!]);
        builder.strip([near[1]!, far[1]!], [near[2]!, far[2]!]);
        builder.strip([far[0]!, near[0]!], [far[3]!, near[3]!]);
      }
    }
    lugs = builder.mesh();
  }

  let plate: Mesh | null = null;
  if (profile.plate) {
    // A plate is about a millimetre thick: thin, but a body, so it shows from the side.
    const band = [...profile.plate.map(([x, y]): Point => [x, y - PLATE_MM / 2]), ...profile.plate.map(([x, y]): Point => [x, y + PLATE_MM / 2]).reverse()];
    plate = loft(band, (x) => half(x) * 0.82);
  }

  // The upper: an arch over the footbed at each point, as high as the profile draws it.
  const ARC = 12;
  const upperBuilder = new Builder();
  const rings = footbed.map(([x, y]) => {
    const w = half(x);
    const rise = Math.max(0, heightAt(profile.upper, x) - y);
    return Array.from({ length: ARC + 1 }, (_, k): P3 => {
      const angle = (k / ARC) * Math.PI;
      return [x, y + rise * Math.sin(angle) ** 0.7, -w * Math.cos(angle)];
    });
  });
  const ringIds = rings.map((ring) => ring.map((p) => upperBuilder.vertex(...p)));
  for (let i = 0; i < ringIds.length - 1; i++) for (let k = 0; k < ARC; k++) upperBuilder.quad(ringIds[i]![k]!, ringIds[i]![k + 1]!, ringIds[i + 1]![k + 1]!, ringIds[i + 1]![k]!);

  const upperCage: number[] = [];
  const segment = (a: P3, b: P3): void => void upperCage.push(...a, ...b);
  for (let i = 0; i < rings.length; i += 4) for (let k = 0; k < ARC; k++) segment(rings[i]![k]!, rings[i]![k + 1]!);
  for (const k of [0, ARC / 4, ARC / 2, (ARC * 3) / 4, ARC]) for (let i = 0; i < rings.length - 1; i++) segment(rings[i]![k]!, rings[i + 1]![k]!);

  return {
    lengthMm: L,
    heightMm: profile.heightMm,
    outsole: loft(profile.outsole, half),
    midsole: loft(profile.midsole, half),
    insole: loft(profile.insole, half),
    lugs,
    plate,
    upper: upperBuilder.mesh(),
    upperCage,
    assumed: [...profile.assumed, 'plan-shape'],
  };
}
