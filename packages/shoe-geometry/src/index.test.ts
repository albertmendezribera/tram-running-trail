import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildShoeProfile, compareSpecs, FOREFOOT_AT, HEEL_AT, type ShoeSpecs, toCurve, toPath } from './index.ts';

const road: ShoeSpecs = { lengthMm: 270, stackHeelMm: 34.1, stackForefootMm: 25.5, outsoleThicknessMm: 2.3, insoleThicknessMm: 2.9, plate: 'carbon', lugDepthMm: null, rockerApexPct: null, toeSpringDeg: null, heelBevelDeg: null, toeboxHeightMm: 27.3 };
const trail: ShoeSpecs = { lengthMm: 270.4, stackHeelMm: 32.1, stackForefootMm: 27.2, outsoleThicknessMm: 3.1, insoleThicknessMm: 4.3, plate: 'none', lugDepthMm: 4, rockerApexPct: null, toeSpringDeg: null, heelBevelDeg: null, toeboxHeightMm: 26.1 };

/** Height of the top of a closed band at x: its outline goes along the bottom and comes back along the top. */
const topAt = (band: ReadonlyArray<readonly [number, number]>, x: number): number => {
  const back = band.slice(band.length / 2);
  return back.reduce((best, p) => (Math.abs(p[0] - x) < Math.abs(best[0] - x) ? p : best))[1];
};

describe('buildShoeProfile', () => {
  it('stands the two stacks where they are measured, to the tenth of a millimetre', () => {
    const p = buildShoeProfile(road);
    const heel = p.dimensions.find((d) => d.kind === 'stack-heel')!;
    const fore = p.dimensions.find((d) => d.kind === 'stack-forefoot')!;
    assert.equal(heel.from[0], Number((HEEL_AT * 270).toFixed(2)));
    assert.equal(fore.from[0], Number((FOREFOOT_AT * 270).toFixed(2)));
    assert.equal(heel.to[1] - heel.from[1], 34.1);
    assert.ok(Math.abs(fore.to[1] - fore.from[1] - 25.5) < 0.01);
    assert.equal(p.dropMm, 8.6);
    // The drawn sole is as thick as the figure at the heel point (sampled every 1/48 of the length).
    assert.ok(Math.abs(topAt(p.insole, HEEL_AT * 270) - 34.1) < 0.6);
  });

  it('stacks outsole, midsole and insole without gaps', () => {
    const p = buildShoeProfile(trail);
    const mid = 270.4 / 2;
    assert.ok(Math.abs(topAt(p.outsole, mid) - 3.1) < 0.01);
    const top = topAt(p.insole, mid);
    assert.ok(Math.abs(top - topAt(p.midsole, mid) - 4.3) < 0.01);
    assert.ok(top > 27.2 && top < 32.1);
  });

  it('draws lugs only when the shoe has them, as deep as the figure', () => {
    assert.deepEqual(buildShoeProfile(road).lugs, []);
    const p = buildShoeProfile(trail);
    assert.ok(p.lugs.length > 10);
    assert.equal(p.depthMm, 4);
    for (const lug of p.lugs) assert.ok(Math.abs(lug[0]![1] - lug[3]![1] - 4) < 0.01);
    assert.equal(p.dimensions.find((d) => d.kind === 'lug-depth')!.valueMm, 4);
  });

  it('draws a plate only when the shoe has one, inside the foam', () => {
    assert.equal(buildShoeProfile(trail).plate, null);
    const p = buildShoeProfile(road);
    assert.ok(p.plate && p.plate.length > 20);
    for (const [x, y] of p.plate!) {
      const i = Math.round((x / 270) * 48);
      assert.ok(y > p.outsole.at(-1 - i)![1] - 0.01 && y < topAt(p.midsole, x) + 0.01);
    }
  });

  it('says what it had to assume, and assumes the same for every shoe', () => {
    const a = buildShoeProfile(road);
    const b = buildShoeProfile(trail);
    assert.deepEqual(a.assumed, ['rocker', 'toe-spring', 'heel-bevel', 'upper', 'plate-position']);
    assert.deepEqual(b.assumed, ['rocker', 'toe-spring', 'heel-bevel', 'upper', 'lug-pattern']);
    const measured = buildShoeProfile({ ...road, rockerApexPct: 60, toeSpringDeg: 18, heelBevelDeg: 20, plate: 'none' });
    assert.deepEqual(measured.assumed, ['upper']);
    // A higher toe spring lifts the tip of the sole.
    assert.ok(measured.outsole[48]![1] > a.outsole[48]![1]);
  });

  it('refuses a shoe without the figures a profile cannot do without', () => {
    assert.throws(() => buildShoeProfile({ ...road, stackHeelMm: 0 }));
    assert.throws(() => buildShoeProfile({ ...road, lengthMm: Number.NaN }));
  });
});

describe('paths', () => {
  it('turns y over for SVG and closes outlines', () => {
    assert.equal(toPath([[0, 0], [10, 5], [10, 0]]), 'M0 0L10 -5L10 0Z');
    assert.equal(toPath([[0, 0], [10, 5]], false), 'M0 0L10 -5');
    assert.ok(toCurve([[0, 0], [10, 5], [20, 0]]).startsWith('M0 0C'));
  });
});

describe('compareSpecs', () => {
  it('gives each difference with its sign, and none against an unknown', () => {
    const rows = compareSpecs(road, trail);
    assert.deepEqual(rows.find((r) => r.key === 'stackHeelMm'), { key: 'stackHeelMm', a: 34.1, b: 32.1, delta: -2 });
    assert.deepEqual(rows.find((r) => r.key === 'dropMm'), { key: 'dropMm', a: 8.6, b: 4.9, delta: -3.7 });
    assert.deepEqual(rows.find((r) => r.key === 'lugDepthMm'), { key: 'lugDepthMm', a: null, b: 4, delta: null });
  });
});
