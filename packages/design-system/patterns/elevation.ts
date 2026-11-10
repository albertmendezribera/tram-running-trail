/** A point of a route: kilometre and elevation in metres. */
export type ProfilePoint = readonly [km: number, elevation: number];

export interface GradeBand {
  from: number;
  to: number;
  /** 0: below 5 %, 1: 5–10 %, 2: 10–15 %, 3: 15 % or more, climbing or descending. */
  level: 0 | 1 | 2 | 3;
}

const levelFor = (grade: number): GradeBand['level'] => (grade < 5 ? 0 : grade < 10 ? 1 : grade < 15 ? 2 : 3);

function mergeEqualNeighbours(bands: GradeBand[]): GradeBand[] {
  const out: GradeBand[] = [];
  for (const b of bands) {
    const last = out.at(-1);
    if (last?.level === b.level) last.to = b.to;
    else out.push({ ...b });
  }
  return out;
}

/** Discrete grade bands (CLAUDE.md 9.3). Bands shorter than `minKm` join a neighbour, so a route never reads as a barcode. */
export function gradeBands(points: readonly ProfilePoint[], windowKm = 0.25, minKm?: number): GradeBand[] {
  if (points.length < 2) return [];
  const total = points.at(-1)![0] - points[0]![0];
  const minLength = minKm ?? Math.max(0.5, total * 0.02);

  const raw: GradeBand[] = [];
  let i = 0;
  while (i < points.length - 1) {
    let j = i + 1;
    while (j < points.length - 1 && points[j]![0] - points[i]![0] < windowKm) j++;
    const [fromKm, fromEle] = points[i]!;
    const [toKm, toEle] = points[j]!;
    const metres = (toKm - fromKm) * 1000;
    raw.push({ from: fromKm, to: toKm, level: levelFor(metres > 0 ? (Math.abs(toEle - fromEle) / metres) * 100 : 0) });
    i = j;
  }

  let bands = mergeEqualNeighbours(raw);
  while (bands.length > 1) {
    let shortest = -1;
    bands.forEach((b, k) => {
      const length = b.to - b.from;
      if (length < minLength && (shortest < 0 || length < bands[shortest]!.to - bands[shortest]!.from)) shortest = k;
    });
    if (shortest < 0) break;
    const band = bands[shortest]!;
    const prev = bands[shortest - 1];
    const next = bands[shortest + 1];
    // Join the neighbour closest in grade; on a tie, the steeper one, which is the safer reading.
    const target =
      !prev ? next! : !next ? prev : Math.abs(prev.level - band.level) < Math.abs(next.level - band.level) ? prev : Math.abs(prev.level - band.level) > Math.abs(next.level - band.level) ? next : prev.level >= next.level ? prev : next;
    if (target === prev) prev.to = band.to;
    else target.from = band.from;
    bands.splice(shortest, 1);
    bands = mergeEqualNeighbours(bands);
  }
  return bands;
}

function niceStep(span: number, count: number): number {
  const rough = span / Math.max(1, count);
  const power = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / power;
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
}

/** Round tick values inside [min, max]. */
export function ticks(min: number, max: number, count: number): number[] {
  const step = niceStep(max - min, count);
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

/** Vertical range of the chart. A minimum span keeps a flat course from looking like a mountain. */
export function elevationDomain(points: readonly ProfilePoint[], minSpan = 100): [number, number] {
  const values = points.map((p) => p[1]);
  let low = Math.min(...values);
  let high = Math.max(...values);
  if (high - low < minSpan) {
    const middle = (high + low) / 2;
    low = middle - minSpan / 2;
    high = middle + minSpan / 2;
    // The padding must not suggest that a course goes below sea level.
    if (low < 0 && Math.min(...values) >= 0) {
      low = 0;
      high = minSpan;
    }
  }
  const step = niceStep(high - low, 4);
  return [Math.floor(low / step) * step, Math.ceil(high / step) * step];
}

export interface Plot {
  x(km: number): number;
  y(elevation: number): number;
  width: number;
  height: number;
}

export function createPlot(points: readonly ProfilePoint[], domain: readonly [number, number], width: number, height: number): Plot {
  const first = points[0]![0];
  const span = points.at(-1)![0] - first;
  const [low, high] = domain;
  return {
    width,
    height,
    x: (km) => ((km - first) / span) * width,
    y: (elevation) => height - ((elevation - low) / (high - low)) * height,
  };
}

const n = (v: number): string => String(Number(v.toFixed(1)));

export function linePath(points: readonly ProfilePoint[], plot: Plot): string {
  return `M${points.map(([km, e]) => `${n(plot.x(km))} ${n(plot.y(e))}`).join('L')}`;
}

export function areaPath(points: readonly ProfilePoint[], plot: Plot): string {
  const first = points[0]!;
  const last = points.at(-1)!;
  return `${linePath(points, plot)}L${n(plot.x(last[0]))} ${plot.height}L${n(plot.x(first[0]))} ${plot.height}Z`;
}

export const pointsIn = (points: readonly ProfilePoint[], band: GradeBand): ProfilePoint[] =>
  points.filter(([km]) => km >= band.from && km <= band.to);

export function nearestPoint(points: readonly ProfilePoint[], km: number): ProfilePoint {
  return points.reduce((best, p) => (Math.abs(p[0] - km) < Math.abs(best[0] - km) ? p : best));
}

let instances = 0;

/** SVG patterns take their colours from where they are defined, so each chart needs its own. */
export const nextPatternPrefix = (): string => `elevation-${++instances}`;

export interface ProfileSummary {
  distanceKm: number;
  gainM: number;
  lossM: number;
  highest: ProfilePoint;
  lowest: ProfilePoint;
  /** The stretch of at least `windowKm` with the largest grade, climbing or descending. */
  steepest: { from: number; to: number; grade: number } | undefined;
}

/** Positive and negative elevation, ignoring changes smaller than `threshold` (GPS noise). */
function gainAndLoss(points: readonly ProfilePoint[], threshold: number): [number, number] {
  let gain = 0;
  let loss = 0;
  let reference = points[0]![1];
  for (const [, e] of points) {
    if (e - reference >= threshold) {
      gain += e - reference;
      reference = e;
    } else if (reference - e >= threshold) {
      loss += reference - e;
      reference = e;
    }
  }
  return [gain, loss];
}

export function summarize(points: readonly ProfilePoint[], windowKm = 0.5, threshold = 3): ProfileSummary {
  const [gainM, lossM] = gainAndLoss(points, threshold);
  const highest = points.reduce((a, b) => (b[1] > a[1] ? b : a));
  const lowest = points.reduce((a, b) => (b[1] < a[1] ? b : a));
  let steepest: ProfileSummary['steepest'];
  let j = 0;
  for (let i = 0; i < points.length; i++) {
    while (j < points.length - 1 && points[j]![0] - points[i]![0] < windowKm) j++;
    const length = points[j]![0] - points[i]![0];
    if (length < windowKm) break;
    const grade = ((points[j]![1] - points[i]![1]) / (length * 1000)) * 100;
    if (!steepest || Math.abs(grade) > Math.abs(steepest.grade)) steepest = { from: points[i]![0], to: points[j]![0], grade };
  }
  return { distanceKm: points.at(-1)![0] - points[0]![0], gainM, lossM, highest, lowest, steepest };
}

export interface KmStretch {
  /** Kilometre where the stretch ends, as on a course marker. */
  km: number;
  gainM: number;
  lossM: number;
  /** Net grade of the stretch, in %. */
  grade: number;
}

/** One row per kilometre, the last one shorter if the route does not end on a whole km. */
export function kmStretches(points: readonly ProfilePoint[], threshold = 3): KmStretch[] {
  const end = points.at(-1)![0];
  const out: KmStretch[] = [];
  for (let start = 0; start < end - 1e-9; start++) {
    const stop = Math.min(start + 1, end);
    const inside = points.filter(([km]) => km >= start && km <= stop);
    if (inside.length < 2) continue;
    const [gainM, lossM] = gainAndLoss(inside, threshold);
    const first = inside[0]!;
    const last = inside.at(-1)!;
    out.push({ km: Number(stop.toFixed(2)), gainM, lossM, grade: ((last[1] - first[1]) / ((last[0] - first[0]) * 1000)) * 100 });
  }
  return out;
}

export interface Climb {
  from: number;
  to: number;
  gainM: number;
  /** Average grade over the whole climb, in %. */
  grade: number;
  /** Steepest 100 m inside the climb, in %. */
  maxGrade: number;
}

/**
 * Climbs worth naming: from a low point to the highest point before the route
 * drops by more than `tolerance` (10 m, or 20 % of what was gained). Short dips
 * inside a climb do not split it, as on a real course.
 */
export function detectClimbs(points: readonly ProfilePoint[], minGainM = 40, minGrade = 3): Climb[] {
  const climbs: Climb[] = [];
  let start = 0;
  let peak = 0;
  const close = (): void => {
    // The foot of the climb: where the next 300 m reach the minimum grade. A flat
    // approach is not part of the climb, and would dilute its grade.
    let foot = start;
    while (foot < peak) {
      let k = foot;
      while (k < peak && points[k]![0] - points[foot]![0] < 0.3) k++;
      const run = points[k]![0] - points[foot]![0];
      if (run <= 0 || ((points[k]![1] - points[foot]![1]) / (run * 1000)) * 100 >= minGrade) break;
      foot++;
    }
    // Then start exactly where the ground begins to rise.
    while (foot < peak && points[foot + 1]![1] <= points[foot]![1]) foot++;
    const [fromKm, fromEle] = points[foot]!;
    const [toKm, toEle] = points[peak]!;
    const gain = toEle - fromEle;
    const length = toKm - fromKm;
    if (gain < minGainM || length <= 0) return;
    const grade = (gain / (length * 1000)) * 100;
    if (grade < minGrade) return;
    const inside = points.slice(foot, peak + 1);
    let maxGrade = 0;
    let j = 0;
    for (let i = 0; i < inside.length; i++) {
      while (j < inside.length - 1 && inside[j]![0] - inside[i]![0] < 0.1) j++;
      const run = inside[j]![0] - inside[i]![0];
      if (run >= 0.1) maxGrade = Math.max(maxGrade, ((inside[j]![1] - inside[i]![1]) / (run * 1000)) * 100);
    }
    climbs.push({ from: fromKm, to: toKm, gainM: gain, grade, maxGrade: Math.max(maxGrade, grade) });
  };
  for (let i = 1; i < points.length; i++) {
    const e = points[i]![1];
    if (e > points[peak]![1]) peak = i;
    const gained = points[peak]![1] - points[start]![1];
    if (points[peak]![1] - e > Math.max(10, gained * 0.2)) {
      close();
      start = i;
      peak = i;
    } else if (e < points[start]![1] && peak === start) {
      start = i;
      peak = i;
    }
  }
  close();
  return climbs;
}

/** Index of the last point at or before `km`. */
function indexAt(points: readonly ProfilePoint[], km: number): number {
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (points[mid]![0] <= km) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Elevation at `km`, interpolated between the two surrounding points. */
export function elevationAt(points: readonly ProfilePoint[], km: number): number {
  const i = indexAt(points, km);
  const a = points[i]!;
  const b = points[Math.min(i + 1, points.length - 1)]!;
  if (b[0] === a[0]) return a[1];
  const t = Math.min(1, Math.max(0, (km - a[0]) / (b[0] - a[0])));
  return a[1] + (b[1] - a[1]) * t;
}

/** Grade at `km`, measured over `windowKm` centred on it, in %. */
export function gradeAt(points: readonly ProfilePoint[], km: number, windowKm = 0.2): number {
  const first = points[0]![0];
  const last = points.at(-1)![0];
  const from = Math.max(first, km - windowKm / 2);
  const to = Math.min(last, km + windowKm / 2);
  if (to <= from) return 0;
  return ((elevationAt(points, to) - elevationAt(points, from)) / ((to - from) * 1000)) * 100;
}

/** Positive elevation gained up to each point, with the same noise threshold as `summarize`. */
export function cumulativeGain(points: readonly ProfilePoint[], threshold = 3): number[] {
  const out: number[] = [];
  let gain = 0;
  let reference = points[0]![1];
  for (const [, e] of points) {
    if (e - reference >= threshold) {
      gain += e - reference;
      reference = e;
    } else if (reference - e >= threshold) {
      reference = e;
    }
    out.push(gain);
  }
  return out;
}

/** Gain up to `km`, from `cumulativeGain`. */
export const gainAt = (points: readonly ProfilePoint[], gains: readonly number[], km: number): number => gains[indexAt(points, km)]!;
