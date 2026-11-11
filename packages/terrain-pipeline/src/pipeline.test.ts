import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decodeTerrainRgb, encodeTerrainRgb } from './terrain-rgb.ts';
import { parseGpx } from './gpx.ts';
import { planTiles } from './icgc.ts';
import { toUtm } from './utm.ts';

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
