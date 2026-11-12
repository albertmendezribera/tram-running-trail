/** A route as a map plate, as `@tram/terrain-pipeline` builds it: paths in plate units, north up. */
export interface Plate {
  width: number;
  height: number;
  /** Metres per plate unit. */
  unitM: number;
  intervalM: number;
  contours: ReadonlyArray<{ elevation: number; major: boolean; d: string }>;
  route: string;
  marks: ReadonlyArray<{ km: number; x: number; y: number }>;
  start: readonly [number, number];
  finish: readonly [number, number];
}
