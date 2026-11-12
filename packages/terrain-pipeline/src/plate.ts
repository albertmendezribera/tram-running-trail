/**
 * A route as a map plate: contour lines of the terrain and the track seen from
 * above, as SVG paths. Built once per route and kept in a file, so a page can draw
 * the plate with no script and no image (E03).
 */
export interface Plate {
  /** Size of the plate in its own units: one unit is `unitM` metres. */
  width: number;
  height: number;
  unitM: number;
  /** Metres between contour lines: the same for every route, so a flat one looks flat. */
  intervalM: number;
  contours: Array<{ elevation: number; major: boolean; d: string }>;
  route: string;
  /** Kilometre marks along the track, and its two ends. */
  marks: Array<{ km: number; x: number; y: number }>;
  start: [number, number];
  finish: [number, number];
}

type Point = [number, number];

/** Blurs the model so a contour follows the ground, not the noise of each cell. */
export function smooth(heights: Float32Array, cols: number, rows: number, passes = 3): Float32Array {
  let source = heights;
  for (let pass = 0; pass < passes; pass++) {
    const out = new Float32Array(source.length);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let sum = 0;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr;
            const cc = c + dc;
            if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
            sum += source[rr * cols + cc]!;
            count++;
          }
        }
        out[r * cols + c] = sum / count;
      }
    }
    source = out;
  }
  return source;
}

/** Marching squares: the lines where the ground is at `level`, as chains of points in cell units. */
export function contourLines(heights: Float32Array, cols: number, rows: number, level: number): Point[][] {
  const at = (r: number, c: number): number => heights[r * cols + c]!;
  // An edge is named by its upper-left corner: `h` runs east from it, `v` runs south.
  const point = (edge: string): Point => {
    const [kind, rs, cs] = edge.split(':');
    const r = Number(rs);
    const c = Number(cs);
    if (kind === 'h') {
      const a = at(r, c);
      const b = at(r, c + 1);
      return [c + (level - a) / (b - a), r];
    }
    const a = at(r, c);
    const b = at(r + 1, c);
    return [c, r + (level - a) / (b - a)];
  };
  const links = new Map<string, string[]>();
  const link = (a: string, b: string): void => {
    (links.get(a) ?? links.set(a, []).get(a)!).push(b);
    (links.get(b) ?? links.set(b, []).get(b)!).push(a);
  };
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const nw = at(r, c) >= level;
      const ne = at(r, c + 1) >= level;
      const se = at(r + 1, c + 1) >= level;
      const sw = at(r + 1, c) >= level;
      const top = `h:${r}:${c}`;
      const bottom = `h:${r + 1}:${c}`;
      const left = `v:${r}:${c}`;
      const right = `v:${r}:${c + 1}`;
      const crossed = [nw !== ne && top, ne !== se && right, se !== sw && bottom, sw !== nw && left].filter(Boolean) as string[];
      if (crossed.length === 2) link(crossed[0]!, crossed[1]!);
      else if (crossed.length === 4) {
        // A saddle: joined by the height of its centre.
        const high = (at(r, c) + at(r, c + 1) + at(r + 1, c + 1) + at(r + 1, c)) / 4 >= level;
        if (nw === high) (link(top, right), link(bottom, left));
        else (link(top, left), link(bottom, right));
      }
    }
  }
  const lines: Point[][] = [];
  const used = new Set<string>();
  const walk = (from: string): string[] => {
    const chain = [from];
    used.add(from);
    let here = from;
    for (;;) {
      const next = links.get(here)!.find((e) => !used.has(e));
      if (!next) break;
      used.add(next);
      chain.push(next);
      here = next;
    }
    return chain;
  };
  // Open lines first, from their ends at the edge of the model; what is left are loops.
  for (const [edge, to] of links) if (to.length === 1 && !used.has(edge)) lines.push(walk(edge).map(point));
  for (const edge of links.keys()) {
    if (used.has(edge)) continue;
    const loop = walk(edge).map(point);
    loop.push(loop[0]!);
    lines.push(loop);
  }
  return lines;
}

/** Douglas–Peucker: drops the points a line does not need. */
export function simplify(line: readonly Point[], tolerance: number): Point[] {
  if (line.length < 3) return [...line];
  const keep = new Uint8Array(line.length);
  keep[0] = keep[line.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, line.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = line[a]!;
    const [bx, by] = line[b]!;
    const length = Math.hypot(bx - ax, by - ay);
    let worst = 0;
    let index = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = line[i]!;
      // A closed line starts and ends at the same point: there the distance is to that point.
      const d = length === 0 ? Math.hypot(px - ax, py - ay) : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length;
      if (d > worst) ((worst = d), (index = i));
    }
    if (index > 0 && worst > tolerance) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  return line.filter((_, i) => keep[i]);
}

const fixed = (v: number): string => String(Number(v.toFixed(1)));

/** A path through the middle of each segment, with the points as controls: a smooth line of the same size. */
export function curve(line: readonly Point[]): string {
  if (line.length < 3) return line.map(([x, y], i) => `${i ? 'L' : 'M'}${fixed(x)} ${fixed(y)}`).join('');
  const closed = line[0]![0] === line.at(-1)![0] && line[0]![1] === line.at(-1)![1];
  const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (closed) {
    const ring = line.slice(0, -1);
    const first = mid(ring.at(-1)!, ring[0]!);
    let d = `M${fixed(first[0])} ${fixed(first[1])}`;
    for (let i = 0; i < ring.length; i++) {
      const to = mid(ring[i]!, ring[(i + 1) % ring.length]!);
      d += `Q${fixed(ring[i]![0])} ${fixed(ring[i]![1])} ${fixed(to[0])} ${fixed(to[1])}`;
    }
    return `${d}Z`;
  }
  let d = `M${fixed(line[0]![0])} ${fixed(line[0]![1])}`;
  for (let i = 1; i < line.length - 1; i++) {
    const to = i === line.length - 2 ? line[i + 1]! : mid(line[i]!, line[i + 1]!);
    d += `Q${fixed(line[i]![0])} ${fixed(line[i]![1])} ${fixed(to[0])} ${fixed(to[1])}`;
  }
  return d;
}

const lengthOf = (line: readonly Point[]): number => line.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - line[i]![0], p[1] - line[i]![1]), 0);

export interface PlateInput {
  heights: Float32Array;
  cols: number;
  rows: number;
  /** Metres per cell. */
  cell: number;
  /** Track in metres from the south-west corner of the terrain. */
  route: ReadonlyArray<readonly [number, number]>;
  /** Length of the route in kilometres, as its profile gives it. */
  distanceKm: number;
  intervalM?: number;
  majorEvery?: number;
}

export function buildPlate({ heights, cols, rows, cell, route, distanceKm, intervalM = 10, majorEvery = 5 }: PlateInput): Plate {
  const ground = smooth(heights, cols, rows);
  let min = Infinity;
  let max = -Infinity;
  for (const h of ground) ((min = Math.min(min, h)), (max = Math.max(max, h)));
  const contours: Plate['contours'] = [];
  for (let elevation = Math.ceil(min / intervalM) * intervalM; elevation <= max; elevation += intervalM) {
    // A level that falls exactly on a cell would cross no edge: nudged by a centimetre.
    const lines = contourLines(ground, cols, rows, elevation + 0.01)
      .map((line) => simplify(line, 0.6))
      // Specks of a few cells are noise of the model, not ground.
      .filter((line) => lengthOf(line) >= 16);
    if (lines.length) contours.push({ elevation, major: Math.round(elevation / intervalM) % majorEvery === 0, d: lines.map(curve).join('') });
  }

  // The track in plate units: north is up, so the y axis is turned over.
  const heightM = rows * cell;
  const track = route.map(([x, y]): Point => [x / cell, (heightM - y) / cell]);
  const total = lengthOf(track);
  const marks: Plate['marks'] = [];
  let run = 0;
  let next = 1;
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1]!;
    const b = track[i]!;
    const step = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (next < distanceKm && ((run + step) / total) * distanceKm >= next) {
      const t = ((next / distanceKm) * total - run) / step;
      marks.push({ km: next, x: Number((a[0] + (b[0] - a[0]) * t).toFixed(1)), y: Number((a[1] + (b[1] - a[1]) * t).toFixed(1)) });
      next++;
    }
    run += step;
  }
  const end = (p: Point): [number, number] => [Number(p[0].toFixed(1)), Number(p[1].toFixed(1))];
  return { width: cols, height: rows, unitM: cell, intervalM, contours, route: curve(simplify(track, 0.25)), marks, start: end(track[0]!), finish: end(track.at(-1)!) };
}
