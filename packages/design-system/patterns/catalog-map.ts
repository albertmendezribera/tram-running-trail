// The layout of the map of a catalogue (CLAUDE.md 9.3): a scatter of things by two of their measures.
// It turns values into places along two axes that start, end and step on round figures. What draws
// them is CatalogMap.astro; nothing here knows of pixels.
import { ticks } from './elevation.ts';

export interface MapPoint {
  /** What the point is, unique in the map: whatever filters the map hides points by it. */
  id: string;
  x: number;
  y: number;
  /** The ground it is for, which is the shape it is drawn with. */
  kind: 'road' | 'trail';
  label: string;
  href: string;
}

export interface MapAxis {
  min: number;
  max: number;
  /** Every round figure of the axis, both ends among them. */
  ticks: number[];
}

export interface PlacedPoint extends MapPoint {
  /** Where it lies along each axis, as a share of it from its low end. */
  along: number;
  up: number;
  /** Among the points that share its very place, which one it is and how many they are: they are drawn side by side. */
  place: number;
  of: number;
}

export interface CatalogMapLayout {
  x: MapAxis;
  y: MapAxis;
  /** From left to right and, in a column, from the bottom up: the order they are read and reached in. */
  points: PlacedPoint[];
}

const round = (value: number): number => Number(value.toFixed(6));

/** An axis that holds every value, from a round figure to a round figure in about `count` round steps. */
export function axisOf(values: readonly number[], count: number): MapAxis {
  if (values.length === 0) return { min: 0, max: 1, ticks: [0, 1] };
  const [low, high] = [Math.min(...values), Math.max(...values)];
  // Values that are all the same have no span to step over: a unit either side.
  if (low === high) return { min: low - 1, max: low + 1, ticks: [low - 1, low, low + 1] };
  const inside = ticks(low, high, count);
  const step = inside.length > 1 ? round(inside[1]! - inside[0]!) : high - low;
  const [min, max] = [round(Math.floor(round(low / step)) * step), round(Math.ceil(round(high / step)) * step)];
  const steps = Math.round((max - min) / step);
  return { min, max, ticks: Array.from({ length: steps + 1 }, (_, i) => round(min + i * step)) };
}

export function layoutMap(points: readonly MapPoint[], count: { x: number; y: number } = { x: 6, y: 5 }): CatalogMapLayout {
  const [x, y] = [axisOf(points.map((point) => point.x), count.x), axisOf(points.map((point) => point.y), count.y)];
  const share = (value: number, axis: MapAxis): number => round((value - axis.min) / (axis.max - axis.min));
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y || a.label.localeCompare(b.label));
  const at = (point: MapPoint): string => `${point.x}/${point.y}`;
  const together = new Map<string, number>();
  for (const point of sorted) together.set(at(point), (together.get(at(point)) ?? 0) + 1);
  const seen = new Map<string, number>();
  return {
    x,
    y,
    points: sorted.map((point) => {
      const place = seen.get(at(point)) ?? 0;
      seen.set(at(point), place + 1);
      return { ...point, along: share(point.x, x), up: share(point.y, y), place, of: together.get(at(point))! };
    }),
  };
}
