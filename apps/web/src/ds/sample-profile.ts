// Generated shapes for the catalogue. They are not real courses.
export const isPlaceholder = true;

type Point = readonly [number, number];

const route = (km: number, n: number, elevation: (d: number) => number): Point[] =>
  Array.from({ length: n }, (_, i) => {
    const d = (i / (n - 1)) * km;
    return [Number(d.toFixed(3)), Number(elevation(d).toFixed(1))] as const;
  });

export const TRAIL = route(28.4, 1200, (d) => 700 + 420 * Math.sin(d / 4.7) + 180 * Math.sin(d / 1.6 + 1) + 60 * Math.sin(d / 0.55));
export const ROAD = route(42.195, 900, (d) => 18 + 7 * Math.sin(d / 6) + 2 * Math.sin(d / 1.3));

export const TRAIL_POIS = [
  { km: 6.1, kind: 'aid_station' },
  { km: 11.2, kind: 'summit' },
  { km: 16.9, kind: 'checkpoint' },
  { km: 21.2, kind: 'aid_station' },
] as const;
