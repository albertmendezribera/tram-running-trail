/**
 * The side profile of a running shoe, drawn from its figures (E05). Everything is
 * in millimetres: x runs from the back of the heel to the tip of the toe, y rises
 * from the ground. What a figure backs is drawn as measured; what no figure backs
 * (the curve of the toe, the bevel of the heel, the upper, where a plate sits) is
 * still drawn, because a shoe needs an outline, but it is listed in `assumed` so
 * the drawing can say so and never passes it off as data.
 */
export type Plate = 'none' | 'carbon' | 'nylon' | 'pebax' | 'rock_plate';

/** The figures of `shoe_specs` the profile is built from. Null is "not known", never zero. */
export interface ShoeSpecs {
  /** Length of the inside of the shoe: measured, or the nominal length of the size. */
  lengthMm: number;
  /** Stack under the heel and the forefoot, insole included, at 12 % and 75 % of the length (World Athletics). */
  stackHeelMm: number;
  stackForefootMm: number;
  outsoleThicknessMm: number | null;
  insoleThicknessMm: number | null;
  plate: Plate;
  /** Null on road shoes. */
  lugDepthMm: number | null;
  rockerApexPct: number | null;
  toeSpringDeg: number | null;
  heelBevelDeg: number | null;
  /** Height of the toe box inside, when measured: it sets the front of the upper. */
  toeboxHeightMm: number | null;
}

export type Point = readonly [number, number];
export type Assumption = 'rocker' | 'toe-spring' | 'heel-bevel' | 'outsole' | 'insole' | 'plate-position' | 'lug-pattern' | 'upper';

export interface Dimension {
  kind: 'stack-heel' | 'stack-forefoot' | 'lug-depth' | 'length';
  /** Both ends of the dimension line, in the profile's millimetres. */
  from: Point;
  to: Point;
  valueMm: number;
}

export interface ShoeProfile {
  lengthMm: number;
  /** Highest point of the drawing, the collar of the upper. */
  heightMm: number;
  /** Lowest point: the tips of the lugs, or the ground. */
  depthMm: number;
  /** Closed outlines, bottom layer first. */
  outsole: Point[];
  midsole: Point[];
  insole: Point[];
  /** Each lug as a closed outline under the outsole. */
  lugs: Point[][];
  /** Open line inside the midsole, when the shoe has a plate. */
  plate: Point[] | null;
  /** Open line: the upper is never data. */
  upper: Point[];
  dimensions: Dimension[];
  dropMm: number;
  assumed: Assumption[];
}

/** Where the two stacks are measured, as shares of the length (World Athletics rule). */
export const HEEL_AT = 0.12;
export const FOREFOOT_AT = 0.75;

// Neutral shapes for what is not measured. They are the same for every shoe, so
// two profiles never differ by an assumption: only by their figures.
const NEUTRAL = { rockerApexPct: 62, toeSpringDeg: 14, heelBevelDeg: 22, outsoleMm: 3, insoleMm: 4 };
const STEPS = 48;
const round = (v: number): number => Number(v.toFixed(2));
const rad = (deg: number): number => (deg * Math.PI) / 180;

export function buildShoeProfile(specs: ShoeSpecs): ShoeProfile {
  const L = specs.lengthMm;
  if (!(L > 0) || !(specs.stackHeelMm > 0) || !(specs.stackForefootMm > 0)) throw new Error('a shoe profile needs its length and both stacks');
  const assumed: Assumption[] = [];
  const pick = (value: number | null, fallback: number, what: Assumption): number => {
    if (value !== null) return value;
    assumed.push(what);
    return fallback;
  };
  const apex = (pick(specs.rockerApexPct, NEUTRAL.rockerApexPct, 'rocker') / 100) * L;
  const toeSpring = pick(specs.toeSpringDeg, NEUTRAL.toeSpringDeg, 'toe-spring');
  const heelBevel = pick(specs.heelBevelDeg, NEUTRAL.heelBevelDeg, 'heel-bevel');
  const outsoleT = pick(specs.outsoleThicknessMm, NEUTRAL.outsoleMm, 'outsole');
  const insoleT = pick(specs.insoleThicknessMm, NEUTRAL.insoleMm, 'insole');
  assumed.push('upper');

  // The bevel ends before the point where the heel stack is measured, so that stack stands on flat ground.
  const bevelEnd = HEEL_AT * L * 0.8;
  const toeRise = (L - apex) * Math.tan(rad(toeSpring));
  /** How far the forefoot curves up from the ground: nothing behind the apex of the rocker. */
  const rocker = (x: number): number => {
    if (x <= apex) return 0;
    const t = (x - apex) / (L - apex);
    return toeRise * t * t;
  };
  /** Underside of the outsole, lugs apart: the bevel cuts the heel, the rocker lifts the toe. */
  const ground = (x: number): number => (x < bevelEnd ? (bevelEnd - x) * Math.tan(rad(heelBevel)) : rocker(x));
  /** Thickness of the whole sole: the line through both stacks, held behind the heel point and thinned out to the toe. */
  const thickness = (x: number): number => {
    const a = HEEL_AT * L;
    const b = FOREFOOT_AT * L;
    if (x <= a) return specs.stackHeelMm;
    if (x <= b) return specs.stackHeelMm + ((specs.stackForefootMm - specs.stackHeelMm) * (x - a)) / (b - a);
    const t = (x - b) / (L - b);
    return specs.stackForefootMm * (1 - 0.6 * t * t);
  };
  const xs = Array.from({ length: STEPS + 1 }, (_, i) => (i / STEPS) * L);
  const line = (y: (x: number) => number): Point[] => xs.map((x): Point => [round(x), round(y(x))]);
  const band = (from: (x: number) => number, to: (x: number) => number): Point[] => [...line(from), ...line(to).reverse()];
  // The foot rests on a line the heel bevel does not touch: the bevel takes foam from below.
  const top = (x: number): number => rocker(x) + thickness(x);
  const overOutsole = (x: number): number => Math.min(top(x), ground(x) + outsoleT);
  const underInsole = (x: number): number => Math.max(overOutsole(x), top(x) - insoleT);

  const outsole = band(ground, overOutsole);
  const midsole = band(overOutsole, underInsole);
  const insole = band(underInsole, top);

  // Lugs: their depth is the figure; how many and how wide is the drawing's choice.
  const lugs: Point[][] = [];
  const depth = specs.lugDepthMm ?? 0;
  if (depth > 0) {
    assumed.push('lug-pattern');
    const pitch = 15;
    const width = 7;
    for (let x = bevelEnd * 0.4; x + width < L * 0.97; x += pitch) {
      const a = ground(x);
      const b = ground(x + width);
      lugs.push([[round(x), round(a)], [round(x + width), round(b)], [round(x + width - 1.2), round(b - depth)], [round(x + 1.2), round(a - depth)]]);
    }
  }

  // A plate runs inside the foam from heel to toe; where exactly is not a published figure.
  let plate: Point[] | null = null;
  if (specs.plate !== 'none') {
    assumed.push('plate-position');
    plate = xs
      .filter((x) => x >= L * 0.06 && x <= L * 0.94)
      .map((x): Point => {
        const t = x / L;
        // High under the heel, low under the ball of the foot: the spoon shape plates share.
        const share = 0.62 - 0.34 * Math.sin(Math.PI * Math.min(1, t / 0.8)) ** 2 * (t < 0.8 ? 1 : 1 - (t - 0.8) / 0.4);
        return [round(x), round(overOutsole(x) + (underInsole(x) - overOutsole(x)) * share)];
      });
  }

  // The upper: a heel tab, the collar, the tongue, and a toe box as high as measured.
  const toebox = specs.toeboxHeightMm ?? 26;
  const over = (share: number, rise: number): Point => [round(L * share), round(top(L * share) + rise)];
  const upper: Point[] = [
    over(0, 0),
    [round(-L * 0.014), round(top(0) + 30)],
    over(0.005, 58),
    over(0.05, 63),
    over(0.13, 45),
    over(0.23, 46),
    over(0.33, 66),
    over(0.41, 60),
    over(0.62, toebox + 12),
    over(0.82, toebox),
    over(0.95, toebox * 0.6),
    [round(L * 1.012), round(top(L) + 9)],
    over(1, 0),
  ];

  const heelX = round(HEEL_AT * L);
  const foreX = round(FOREFOOT_AT * L);
  const dimensions: Dimension[] = [
    { kind: 'stack-heel', from: [heelX, 0], to: [heelX, specs.stackHeelMm], valueMm: specs.stackHeelMm },
    { kind: 'stack-forefoot', from: [foreX, round(ground(foreX))], to: [foreX, round(top(foreX))], valueMm: specs.stackForefootMm },
    { kind: 'length', from: [0, 0], to: [L, 0], valueMm: L },
  ];
  if (depth > 0) {
    const x = round(L * 0.25);
    dimensions.push({ kind: 'lug-depth', from: [x, -depth], to: [x, 0], valueMm: depth });
  }

  return {
    lengthMm: L,
    heightMm: round(Math.max(...upper.map((p) => p[1]))),
    depthMm: depth,
    outsole,
    midsole,
    insole,
    lugs,
    plate,
    upper,
    dimensions,
    dropMm: round(specs.stackHeelMm - specs.stackForefootMm),
    assumed,
  };
}

/** A closed or open SVG path of a line of the profile, y turned over: SVG grows downwards. */
export function toPath(points: readonly Point[], closed = true): string {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${round(x)} ${round(-y)}`).join('') + (closed ? 'Z' : '');
}

/** A smooth open path through the points (Catmull-Rom as cubic Béziers), for the upper and the plate. */
export function toCurve(points: readonly Point[]): string {
  let d = `M${round(points[0]![0])} ${round(-points[0]![1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${round(c1[0])} ${round(-c1[1])} ${round(c2[0])} ${round(-c2[1])} ${round(p2[0])} ${round(-p2[1])}`;
  }
  return d;
}

export interface SpecDifference {
  key: 'stackHeelMm' | 'stackForefootMm' | 'dropMm' | 'lugDepthMm' | 'lengthMm';
  a: number | null;
  b: number | null;
  /** b − a; null when either is unknown: a difference is never taken against a guess. */
  delta: number | null;
}

/** The figures two profiles can be compared on, and how far apart they are. */
export function compareSpecs(a: ShoeSpecs, b: ShoeSpecs): SpecDifference[] {
  const row = (key: SpecDifference['key'], va: number | null, vb: number | null): SpecDifference => ({ key, a: va, b: vb, delta: va === null || vb === null ? null : round(vb - va) });
  return [
    row('stackHeelMm', a.stackHeelMm, b.stackHeelMm),
    row('stackForefootMm', a.stackForefootMm, b.stackForefootMm),
    row('dropMm', round(a.stackHeelMm - a.stackForefootMm), round(b.stackHeelMm - b.stackForefootMm)),
    row('lugDepthMm', a.lugDepthMm, b.lugDepthMm),
    row('lengthMm', a.lengthMm, b.lengthMm),
  ];
}
