import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decodeTerrainRgb, encodeTerrainRgb } from './terrain-rgb.ts';
import { parseGpx } from './gpx.ts';
import { planTiles } from './icgc.ts';
import { toLngLat, toUtm } from './utm.ts';

describe('toUtm', () => {
  it('puts the central meridian of zone 31 at x = 500,000 m', () => {
    assert.ok(Math.abs(toUtm(41.9, 3)[0] - 500000) < 1e-6);
  });

  it('keeps distances: 0.01° of latitude is about 1.11 km', () => {
    const d = toUtm(41.91, 3.05)[1] - toUtm(41.9, 3.05)[1];
    assert.ok(Math.abs(d - 1111) < 5, String(d));
  });

  it('places Calonge east of the central meridian', () => {
    const [x, y] = toUtm(41.86, 3.08);
    assert.ok(x > 500000 && x < 520000 && y > 4630000 && y < 4640000, `${x} ${y}`);
  });
});

describe('toLngLat', () => {
  it('undoes toUtm to a fraction of a millimetre across Catalonia', () => {
    for (const [lat, lon] of [[41.86, 3.08], [40.6, 0.5], [42.8, 1.2], [41.4, 2.17]] as const) {
      const [lng2, lat2] = toLngLat(...toUtm(lat, lon));
      assert.ok(Math.abs(lat2 - lat) < 1e-8 && Math.abs(lng2 - lon) < 1e-8, `${lat},${lon} → ${lat2},${lng2}`);
    }
  });
});

describe('terrain-RGB', () => {
  it('round-trips elevations to 0.1 m, below sea level included', () => {
    const heights = [-12.3, 0, 7.75, 357.21, 3404.9];
    const decoded = decodeTerrainRgb(encodeTerrainRgb(heights), 3);
    heights.forEach((h, i) => assert.ok(Math.abs(decoded[i]! - h) <= 0.05 + 1e-6, `${h} → ${decoded[i]}`));
  });
});

describe('parseGpx', () => {
  it('reads every track point in order', () => {
    const gpx = '<gpx><trk><trkseg><trkpt lat="41.1" lon="3.1"><ele>10</ele></trkpt><trkpt lat="41.2" lon="3.2"><ele>12.5</ele></trkpt></trkseg></trk></gpx>';
    assert.deepEqual(parseGpx(gpx), [{ lat: 41.1, lon: 3.1, ele: 10 }, { lat: 41.2, lon: 3.2, ele: 12.5 }]);
  });

  it('rejects points without elevation', () => {
    assert.throws(() => parseGpx('<trkpt lat="1" lon="2"></trkpt><trkpt lat="1" lon="2"><ele>1</ele></trkpt>'), /elevation/);
  });
});

describe('planTiles', () => {
  it('covers the grid exactly, within the request limit', () => {
    const tiles = planTiles(564, 713);
    assert.equal(tiles.reduce((s, t) => s + t.cols * t.rows, 0), 564 * 713);
    assert.ok(tiles.every((t) => t.cols * t.rows <= 35800));
  });
});

it('plate: a cone gives closed contours around its summit and the track with its kilometre marks', async () => {
  const { buildPlate, contourLines, simplify } = await import('./plate.ts');
  const cols = 60;
  const rows = 40;
  const heights = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) heights[r * cols + c] = Math.max(0, 100 - Math.hypot(c - 30, r - 20) * 5);
  const ring = contourLines(heights, cols, rows, 50);
  assert.equal(ring.length, 1);
  assert.deepEqual(ring[0]![0], ring[0]!.at(-1));
  for (const [x, y] of ring[0]!) assert.ok(Math.abs(Math.hypot(x - 30, y - 20) - 10) < 0.5);
  const lean = simplify(ring[0]!, 0.4);
  assert.ok(lean.length < ring[0]!.length && lean.length >= 8);
  for (const [x, y] of lean) assert.ok(Math.abs(Math.hypot(x - 30, y - 20) - 10) < 0.5);

  // A straight track of 3 km, west to east, 100 m above the south edge.
  const plate = buildPlate({ heights, cols, rows, cell: 100, route: [[500, 100], [3500, 100]], distanceKm: 3 });
  assert.equal(plate.intervalM, 10);
  assert.ok(plate.contours.length >= 8);
  assert.ok(plate.contours.some((c) => c.major && c.elevation === 50));
  assert.deepEqual(plate.start, [5, 39]);
  assert.deepEqual(plate.finish, [35, 39]);
  assert.deepEqual(plate.marks, [{ km: 1, x: 15, y: 39 }, { km: 2, x: 25, y: 39 }]);
});
