export interface TrackPoint {
  lat: number;
  lon: number;
  ele: number;
}

/** Track points of a GPX, all segments in order. Points without elevation are rejected. */
export function parseGpx(xml: string): TrackPoint[] {
  const points = [...xml.matchAll(/<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/g)].map(([, attrs, body]) => ({
    lat: Number(/lat="([^"]+)"/.exec(attrs!)?.[1]),
    lon: Number(/lon="([^"]+)"/.exec(attrs!)?.[1]),
    ele: Number(/<ele>([^<]+)<\/ele>/.exec(body!)?.[1]),
  }));
  if (points.length < 2) throw new Error('the GPX needs at least two track points');
  if (points.some((p) => !Number.isFinite(p.lat) || !Number.isFinite(p.lon) || !Number.isFinite(p.ele))) {
    throw new Error('every track point needs lat, lon and elevation');
  }
  return points;
}
