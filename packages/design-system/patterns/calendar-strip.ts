// The geometry of CalendarStrip (M4, «the year as a profile»): a year as a strip of weeks, each event a
// mark stacked on its week. Marks of one side grow up from the middle line, those of the other grow
// down, and those of neither sit in a lane of their own underneath. A mark is as thick as its weight.

export type Side = 'up' | 'down' | 'aside';

export interface Mark {
  /** ISO date, `2027-03-14`. */
  date: string;
  side: Side;
  /** How thick the mark is, in steps: 1 to 4. A mark of unknown weight is drawn as the thinnest, and narrow. */
  weight: 1 | 2 | 3 | 4 | null;
  /** Already past: drawn faint. */
  past?: boolean;
}

export interface Cell {
  /** The week it is in, from 0. */
  column: number;
  side: Side;
  /** Where it starts and how thick it is, in steps from the line of its side, outwards. */
  from: number;
  thick: number;
  /** Of unknown weight. */
  narrow: boolean;
  past: boolean;
}

export interface Month {
  /** `01` to `12`. */
  month: string;
  /** Where it starts and ends along the strip, as fractions of its length. */
  from: number;
  to: number;
  /** How many marks of each side fall in it. */
  count: Record<Side, number>;
}

export interface Strip {
  year: number;
  /** Weeks, Monday to Sunday, that hold a day of the year: 53 or 54. */
  columns: number;
  cells: Cell[];
  /** The tallest stack of each side, in steps. */
  tallest: Record<Side, number>;
  months: Month[];
}

const DAY_MS = 86_400_000;
const utc = (year: number, month: number, day: number): number => Date.UTC(year, month, day);
/** Days from the Monday of the week the year starts in to its first of January: 0 when it starts on a Monday. */
const lead = (year: number): number => (new Date(utc(year, 0, 1)).getUTCDay() + 6) % 7;
const dayOf = (year: number, iso: string): number => Math.round((Date.parse(`${iso}T00:00:00Z`) - utc(year, 0, 1)) / DAY_MS);

/** The strip of a year: where each mark of that year goes. Marks of other years are left out. */
export function layoutStrip(year: number, marks: readonly Mark[]): Strip {
  const offset = lead(year);
  const days = Math.round((utc(year + 1, 0, 1) - utc(year, 0, 1)) / DAY_MS);
  const columns = Math.ceil((days + offset) / 7);
  const own = marks.filter((mark) => mark.date.startsWith(`${year}-`));
  const cells: Cell[] = [];
  const tallest: Record<Side, number> = { up: 0, down: 0, aside: 0 };
  const stacks = new Map<string, number>();
  // The heaviest at the foot of each stack, and what has been run under what is to come: the outline is a profile, not a comb.
  const ordered = [...own].sort((a, b) => Number(b.past ?? false) - Number(a.past ?? false) || (b.weight ?? 0) - (a.weight ?? 0) || a.date.localeCompare(b.date));
  for (const mark of ordered) {
    const column = Math.floor((dayOf(year, mark.date) + offset) / 7);
    const key = `${column} ${mark.side}`;
    const from = stacks.get(key) ?? 0;
    const thick = mark.weight ?? 1;
    stacks.set(key, from + thick);
    tallest[mark.side] = Math.max(tallest[mark.side], from + thick);
    cells.push({ column, side: mark.side, from, thick, narrow: mark.weight === null, past: mark.past ?? false });
  }
  const months: Month[] = [];
  for (let m = 0; m < 12; m++) {
    const month = String(m + 1).padStart(2, '0');
    const inMonth = own.filter((mark) => mark.date.slice(5, 7) === month);
    months.push({
      month,
      from: (Math.round((utc(year, m, 1) - utc(year, 0, 1)) / DAY_MS) + offset) / (columns * 7),
      to: (Math.round((utc(year, m + 1, 1) - utc(year, 0, 1)) / DAY_MS) + offset) / (columns * 7),
      count: { up: inMonth.filter((mark) => mark.side === 'up').length, down: inMonth.filter((mark) => mark.side === 'down').length, aside: inMonth.filter((mark) => mark.side === 'aside').length },
    });
  }
  return { year, columns, cells, tallest, months };
}

/** The tallest stack of each side over several strips: drawn to it, their heights can be compared. */
export const sharedScale = (strips: readonly Strip[]): Record<Side, number> => ({
  up: Math.max(1, ...strips.map((strip) => strip.tallest.up)),
  down: Math.max(1, ...strips.map((strip) => strip.tallest.down)),
  aside: Math.max(0, ...strips.map((strip) => strip.tallest.aside)),
});
