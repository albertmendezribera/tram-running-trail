// Which shoes are like one somebody already runs in and is happy with. No imports and no data here, so
// that the rule can be tested alone and run in a browser as well. It reads only what makers state, and
// compares two shoes only on what both state: a figure one of them lacks is no likeness and no difference.
//
// A mountain shoe weighs more and has less foam than a road one, so across grounds the weight and the
// heights are compared by where each shoe stands among those of its own ground (so many grams over or
// under what is usual there). The drop is compared as it is: it is the geometry a runner is used to.
// The weights of each part and the cut-offs are ours, and the page that shows the result says so.

export type Ground = 'road' | 'trail';
export type Support = 'neutral' | 'stability';
export type Use = 'race' | 'tempo' | 'daily' | 'long' | 'ultra';

/** What the rule may read of a shoe: what its maker states, null where it states nothing. */
export interface Likeness {
  terrain: Ground;
  weightG: number | null;
  stackHeelMm: number | null;
  stackForefootMm: number | null;
  dropMm: number | null;
  lugDepthMm: number | null;
  plate: string | null;
  support: Support | null;
  use: readonly Use[];
}

/** What is usual on each ground: the middle shoe of the catalogue, figure by figure. */
export type Usual = Record<Ground, { weightG: number | null; stackHeelMm: number | null; stackForefootMm: number | null }>;

export type Part = 'drop' | 'heel' | 'forefoot' | 'weight' | 'lugs' | 'plate' | 'support' | 'use';

/** How far apart two shoes are on one part. */
export interface Gap {
  part: Part;
  /**
   * The difference, the other shoe less the one asked about, in the unit of the part: millimetres, grams.
   * Across grounds, for the weight and the heights, it is the difference of their places on their own
   * ground. For the plate, the support and the use: 0 when alike, 1 when not.
   */
  by: number;
  /** The same, in steps of what counts as a clear difference for the part: 0 alike, 1 a clear difference. */
  steps: number;
}

export interface Match<T> {
  shoe: T;
  /** The mean of the steps over what could be compared, with a little added for each figure that could not: the less, the more alike. */
  distance: number;
  gaps: Gap[];
  /** How alike, in three words a page can say. */
  closeness: 'close' | 'near' | 'loose';
}

/** What counts as one clear difference: a runner would notice a shoe this much apart. */
export const STEP = { drop: 4, heel: 5, forefoot: 5, weight: 30, lugs: 1.5 } as const;
/** What each part counts for. The drop and the support come first: they are what the legs are used to. */
export const WEIGHT: Record<Part, number> = { drop: 3, support: 3, heel: 2, weight: 2, forefoot: 1, use: 1.5, plate: 1, lugs: 1 };
/** Added to the distance for each of the four figures that could not be compared: a likeness on little is worth less. */
export const BLIND = 0.15;
/** The figures a likeness needs at the least: with no drop in common and nothing else, two shoes are not compared. */
export const MIN_FIGURES = 2;
export const CLOSE = 0.3;
export const NEAR = 0.6;
/** Beyond this, a shoe is not offered as like another. */
export const FAR = 1;

const middle = (values: readonly number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const half = sorted.length >> 1;
  return sorted.length % 2 ? sorted[half]! : (sorted[half - 1]! + sorted[half]!) / 2;
};

/** The usual weight and heights of each ground, from the shoes given. */
export function usualOf(shoes: readonly Likeness[]): Usual {
  const of = (ground: Ground, key: 'weightG' | 'stackHeelMm' | 'stackForefootMm'): number | null =>
    middle(shoes.filter((shoe) => shoe.terrain === ground).flatMap((shoe) => (shoe[key] === null ? [] : [shoe[key]])));
  const ground = (g: Ground) => ({ weightG: of(g, 'weightG'), stackHeelMm: of(g, 'stackHeelMm'), stackForefootMm: of(g, 'stackForefootMm') });
  return { road: ground('road'), trail: ground('trail') };
}

/** A plate that makes a shoe faster. A rock plate protects and is no likeness to it; a stated «no plate» is an answer. */
const fast = (plate: string | null): boolean | null => (plate === null ? null : plate === 'carbon' || plate === 'nylon' || plate === 'pebax');

/** How far a shoe is from another, part by part, on what both state. Null when they share too little to say. */
export function gapsBetween(mine: Likeness, other: Likeness, usual: Usual): Gap[] | null {
  const across = mine.terrain !== other.terrain;
  const gaps: Gap[] = [];
  const figure = (part: 'drop' | 'heel' | 'forefoot' | 'weight' | 'lugs', a: number | null, b: number | null, baseA: number | null = 0, baseB: number | null = 0): void => {
    if (a === null || b === null || baseA === null || baseB === null) return;
    const by = b - baseB - (a - baseA);
    gaps.push({ part, by, steps: Math.abs(by) / STEP[part] });
  };
  const base = (shoe: Likeness, key: 'weightG' | 'stackHeelMm' | 'stackForefootMm'): number | null => (across ? usual[shoe.terrain][key] : 0);
  figure('drop', mine.dropMm, other.dropMm);
  figure('heel', mine.stackHeelMm, other.stackHeelMm, base(mine, 'stackHeelMm'), base(other, 'stackHeelMm'));
  figure('forefoot', mine.stackForefootMm, other.stackForefootMm, base(mine, 'stackForefootMm'), base(other, 'stackForefootMm'));
  figure('weight', mine.weightG, other.weightG, base(mine, 'weightG'), base(other, 'weightG'));
  // Lugs are a thing of the mountain: two road shoes have none to compare, and across grounds they say nothing.
  if (!across && mine.terrain === 'trail') figure('lugs', mine.lugDepthMm, other.lugDepthMm);
  if (gaps.length < MIN_FIGURES) return null;

  const yesNo = (part: 'plate' | 'support' | 'use', alike: boolean): void => void gaps.push({ part, by: alike ? 0 : 1, steps: alike ? 0 : 1 });
  const [a, b] = [fast(mine.plate), fast(other.plate)];
  if (a !== null && b !== null) yesNo('plate', a === b);
  if (mine.support !== null && other.support !== null) yesNo('support', mine.support === other.support);
  if (mine.use.length > 0 && other.use.length > 0) {
    // How much of what the two are for is shared: all of it, alike; none, a clear difference.
    const shared = mine.use.filter((use) => other.use.includes(use)).length;
    const either = new Set([...mine.use, ...other.use]).size;
    const apart = 1 - shared / either;
    gaps.push({ part: 'use', by: apart, steps: apart });
  }
  return gaps;
}

const FIGURES: readonly Part[] = ['drop', 'heel', 'forefoot', 'weight'];

/** One number for a set of gaps: the less, the more alike. */
export function distanceOf(gaps: readonly Gap[]): number {
  const total = gaps.reduce((sum, gap) => sum + WEIGHT[gap.part], 0);
  // A difference of two steps weighs more than twice one of a single step: one far figure is not hidden by three near ones.
  const mean = gaps.reduce((sum, gap) => sum + WEIGHT[gap.part] * Math.min(gap.steps, 3) ** 1.5, 0) / total;
  const unseen = FIGURES.filter((part) => !gaps.some((gap) => gap.part === part)).length;
  return mean + unseen * BLIND;
}

/**
 * Close is for a shoe with no clear difference in anything, seen on three of the four figures at the
 * least: one full step apart on any part, or a likeness on the drop and one figure more, is near at the most.
 */
export const closenessOf = (distance: number, gaps: readonly Gap[]): Match<unknown>['closeness'] =>
  distance <= CLOSE && gaps.every((gap) => gap.steps < 1) && FIGURES.filter((part) => gaps.some((gap) => gap.part === part)).length >= 3 ? 'close' : distance <= NEAR ? 'near' : 'loose';

/**
 * The shoes of a ground most like one, the most alike first. Those too far to be called alike are left
 * out: a short list, or an empty one, is an answer too.
 */
export function similarTo<T extends Likeness>(mine: Likeness, others: readonly T[], ground: Ground, usual: Usual, most = 5): Match<T>[] {
  return others
    .filter((other) => other.terrain === ground && (other as Likeness) !== mine)
    .flatMap((shoe) => {
      const gaps = gapsBetween(mine, shoe, usual);
      if (!gaps) return [];
      const distance = distanceOf(gaps);
      return distance > FAR ? [] : [{ shoe, distance, gaps, closeness: closenessOf(distance, gaps) }];
    })
    // At the same distance, the shoe alike on more counts comes first: it is known to be alike in more.
    .sort((a, b) => a.distance - b.distance || b.gaps.length - a.gaps.length)
    .slice(0, most);
}

/** Whether a shoe states enough to look for others like it. */
export const comparable = (shoe: Likeness): boolean => [shoe.dropMm, shoe.stackHeelMm, shoe.stackForefootMm, shoe.weightG].filter((value) => value !== null).length >= MIN_FIGURES;
