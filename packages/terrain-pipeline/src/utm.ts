/**
 * WGS84 latitude/longitude to UTM metres (northern hemisphere). ETRS89, used by
 * the ICGC as EPSG:25831, is within centimetres of WGS84 in Catalonia.
 */
export function toUtm(lat: number, lon: number, zone = 31): [x: number, y: number] {
  const a = 6378137;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const rad = Math.PI / 180;
  const phi = lat * rad;
  const lambda0 = (zone * 6 - 183) * rad;
  const n = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const t = Math.tan(phi) ** 2;
  const c = ep2 * Math.cos(phi) ** 2;
  const A = Math.cos(phi) * (lon * rad - lambda0);
  const m =
    a *
    ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * phi -
      ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * phi) +
      ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * phi) -
      ((35 * e2 ** 3) / 3072) * Math.sin(6 * phi));
  const x = k0 * n * (A + ((1 - t + c) * A ** 3) / 6 + ((5 - 18 * t + t ** 2 + 72 * c - 58 * ep2) * A ** 5) / 120) + 500000;
  const y =
    k0 *
    (m +
      n * Math.tan(phi) * (A ** 2 / 2 + ((5 - t + 9 * c + 4 * c ** 2) * A ** 4) / 24 + ((61 - 58 * t + t ** 2 + 600 * c - 330 * ep2) * A ** 6) / 720));
  return [x, y];
}
