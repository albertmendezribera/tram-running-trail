import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { areaPath, createPlot, detectClimbs, elevationDomain, gradeBands, kmStretches, linePath, nearestPoint, type ProfilePoint, summarize, ticks } from './elevation.ts';

/** A route made of [length in km, grade in %] stretches, one point every 50 m. */
function route(stretches: Array<[number, number]>): ProfilePoint[] {
  const points: ProfilePoint[] = [[0, 500]];
  let [km, elevation] = [0, 500];
  for (const [length, grade] of stretches) {
    const steps = Math.round(length / 0.05);
    for (let i = 0; i < steps; i++) {
      km = Number((km + 0.05).toFixed(3));
      elevation += 50 * (grade / 100);
      points.push([km, elevation]);
    }
  }
  return points;
}

describe('gradeBands', () => {
  it('classifies each grade, climbing or descending', () => {
    const bands = gradeBands(route([[2, 2], [2, 7], [2, -12], [2, 20]]), 0.25, 0.5);
    assert.deepEqual(bands.map((b) => b.level), [0, 1, 2, 3]);
  });

  it('covers the whole route without gaps', () => {
    const bands = gradeBands(route([[3, 2], [1, 18], [4, 8]]), 0.25, 0.5);
    assert.equal(bands[0]!.from, 0);
    assert.equal(bands.at(-1)!.to, 8);
    bands.slice(1).forEach((b, i) => assert.equal(b.from, bands[i]!.to));
  });

  it('absorbs a band shorter than the minimum', () => {
    const bands = gradeBands(route([[3, 2], [0.25, 7], [3, 2]]), 0.25, 0.5);
    assert.deepEqual(bands.map((b) => b.level), [0]);
  });

  it('joins a short band to the closest grade', () => {
    const bands = gradeBands(route([[3, 1], [0.25, 12], [3, 20]]), 0.25, 0.5);
    assert.deepEqual(bands.map((b) => b.level), [0, 3]);
  });

  it('keeps a noisy route readable', () => {
    const noisy = Array.from({ length: 80 }, (_, i): [number, number] => [0.25, i % 2 ? 18 : 1]);
    assert.ok(gradeBands(route(noisy)).length <= 40);
    for (const b of gradeBands(route(noisy))) assert.ok(b.to - b.from >= 0.5 - 1e-9);
  });

  it('returns nothing without a route', () => {
    assert.deepEqual(gradeBands([]), []);
    assert.deepEqual(gradeBands([[0, 100]]), []);
  });
});

describe('scales', () => {
  it('gives round ticks inside the range', () => {
    assert.deepEqual(ticks(0, 28.4, 7), [0, 5, 10, 15, 20, 25]);
    assert.deepEqual(ticks(200, 1400, 4), [500, 1000]);
  });

  it('does not exaggerate a flat course', () => {
    const [low, high] = elevationDomain([[0, 10], [42, 18]]);
    assert.ok(high - low >= 100);
  });

  it('does not draw a course near sea level below it', () => {
    assert.deepEqual(elevationDomain([[0, 10], [42, 25]]), [0, 100]);
  });

  it('keeps a course that really goes below sea level', () => {
    assert.ok(elevationDomain([[0, -20], [10, -5]])[0] < 0);
  });

  it('wraps a mountain route with round limits', () => {
    assert.deepEqual(elevationDomain([[0, 212], [10, 1251]]), [0, 1500]);
  });
});

describe('paths', () => {
  const points: ProfilePoint[] = [[0, 0], [5, 50], [10, 100]];
  const plot = createPlot(points, [0, 100], 1000, 300);

  it('maps km and elevation to the plot', () => {
    assert.equal(linePath(points, plot), 'M0 300L500 150L1000 0');
  });

  it('closes the area on the baseline', () => {
    assert.equal(areaPath(points, plot), 'M0 300L500 150L1000 0L1000 300L0 300Z');
  });

  it('finds the nearest point', () => {
    assert.deepEqual(nearestPoint(points, 6), [5, 50]);
  });
});

describe('summaries', () => {
  const hill = route([[2, 0], [1, 12], [1, -6], [2, 0]]);

  it('finds the highest point, the gain and the steepest stretch', () => {
    const s = summarize(hill);
    assert.equal(s.highest[1], 620);
    assert.ok(Math.abs(s.gainM - 120) <= 3);
    assert.ok(Math.abs(s.steepest!.grade - 12) < 0.5);
    assert.ok(s.steepest!.from >= 2 - 1e-9 && s.steepest!.to <= 3 + 1e-9);
  });

  it('ignores GPS noise below the threshold', () => {
    const noisy: ProfilePoint[] = Array.from({ length: 200 }, (_, i) => [i * 0.05, 100 + (i % 2)]);
    assert.equal(summarize(noisy).gainM, 0);
  });

  it('splits a route into kilometres, with a shorter last one', () => {
    const rows = kmStretches(route([[2.5, 4]]));
    assert.deepEqual(rows.map((r) => r.km), [1, 2, 2.5]);
    assert.ok(rows.every((r) => Math.abs(r.grade - 4) < 0.2));
  });
});

describe('detectClimbs', () => {
  it('finds each climb with its gain, length and grade', () => {
    const climbs = detectClimbs(route([[1, 0], [2, 8], [1, -10], [1, 0], [1.5, 12], [1, 0]]));
    assert.equal(climbs.length, 2);
    assert.ok(Math.abs(climbs[0]!.gainM - 160) <= 1);
    assert.ok(Math.abs(climbs[0]!.grade - 8) < 0.2);
    assert.ok(Math.abs(climbs[1]!.to - climbs[1]!.from - 1.5) < 0.06);
  });

  it('does not split a climb on a short dip', () => {
    const climbs = detectClimbs(route([[1, 10], [0.1, -5], [1, 10]]));
    assert.equal(climbs.length, 1);
    assert.ok(climbs[0]!.gainM > 190);
  });

  it('ignores rises too small or too gentle to name', () => {
    assert.deepEqual(detectClimbs(route([[1, 3]])), []);
    assert.deepEqual(detectClimbs(route([[5, 2]])), []);
  });

  it('measures the steepest 100 m inside the climb', () => {
    const [climb] = detectClimbs(route([[1, 5], [0.3, 20], [1, 5]]));
    assert.ok(climb!.maxGrade > 18);
  });
});
