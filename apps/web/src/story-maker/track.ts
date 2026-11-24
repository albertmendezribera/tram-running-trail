// A visitor's own GPX, read where it is: in the browser. Only what a story shows is taken from it: the
// positions, the elevation and the two things the times give, how long the watch was recording and
// nothing finer. Heart rate, cadence and the rest are never read. No imports: tested alone.

export interface TrackPoint {
  lat: number;
  lon: number;
  /** Null when the file gives no elevation for the point. */
  ele: number | null;
  /** Null when the file gives no time for the point. */
  timeMs: number | null;
}

export interface Track {
  /** What the file calls the outing, when it does. */
  name: string | null;
  points: TrackPoint[];
}

/** A file that is not a GPX with a track in it. */
export class TrackError extends Error {
  // Said by name where it is caught: a build may rename the class, not this.
  override name = 'TrackError';
}

const text = (value: string): string =>
  value
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();

/** The track of a GPX: its recorded points (`trkpt`), or the points of a planned route (`rtept`) when it has no recording. */
export function readGpx(xml: string): Track {
  if (!/<gpx[\s>]/i.test(xml)) throw new TrackError('not a GPX');
  const read = (tag: string): TrackPoint[] =>
    [...xml.matchAll(new RegExp(`<${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${tag}>)`, 'g'))].map(([, attrs = '', body = '']) => {
      const ele = /<ele>\s*([^<\s]+)\s*<\/ele>/.exec(body)?.[1];
      const time = /<time>\s*([^<\s]+)\s*<\/time>/.exec(body)?.[1];
      const [height, at] = [ele === undefined ? NaN : Number(ele), time === undefined ? NaN : Date.parse(time)];
      return { lat: Number(/\blat="([^"]+)"/.exec(attrs)?.[1]), lon: Number(/\blon="([^"]+)"/.exec(attrs)?.[1]), ele: Number.isFinite(height) ? height : null, timeMs: Number.isFinite(at) ? at : null };
    });
  const recorded = read('trkpt');
  const points = (recorded.length >= 2 ? recorded : read('rtept')).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180);
  if (points.length < 2) throw new TrackError('no track');
  const name = /<trk>[\s\S]*?<name>([\s\S]*?)<\/name>/.exec(xml)?.[1] ?? /<metadata>[\s\S]*?<name>([\s\S]*?)<\/name>/.exec(xml)?.[1];
  return { name: name ? text(name) || null : null, points };
}

const R = 6371008.8;
const rad = (degrees: number): number => (degrees * Math.PI) / 180;
/** Metres between two points, over the sphere. */
export const metres = (a: { lat: number; lon: number }, b: { lat: number; lon: number }): number =>
  2 * R * Math.asin(Math.sqrt(Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2));

/**
 * The elevation profile of a track: [km, elevation] every `step` metres, as `scripts/gpx-to-profile.mjs`
 * makes it for the routes of the site. `elevations` gives the height of each point, in the order of the track.
 */
export function profileOf(points: readonly TrackPoint[], elevations: readonly number[], step = 20): Array<[number, number]> {
  const profile: Array<[number, number]> = [];
  let [distance, next] = [0, 0];
  points.forEach((point, i) => {
    if (i > 0) distance += metres(points[i - 1]!, point);
    if (distance >= next || i === points.length - 1) {
      profile.push([Number((distance / 1000).toFixed(3)), Number(elevations[i]!.toFixed(1))]);
      next = distance + step;
    }
  });
  return profile;
}

/** A step longer than this between two points is the watch stopped, and is not counted. */
const PAUSE_S = 10;

/**
 * Seconds the watch was recording, pauses left out, as `scripts/gpx-time.mjs` counts them. Null when
 * a point has no time: a planned route, or a file its app wrote without them.
 */
export function recordedSeconds(points: readonly TrackPoint[]): number | null {
  let recorded = 0;
  for (let i = 1; i < points.length; i++) {
    const [from, to] = [points[i - 1]!.timeMs, points[i]!.timeMs];
    if (from === null || to === null) return null;
    const step = (to - from) / 1000;
    if (step >= 0 && step <= PAUSE_S) recorded += step;
  }
  return recorded > 0 ? Math.round(recorded) : null;
}
