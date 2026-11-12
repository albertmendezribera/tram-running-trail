import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildShoeSolid, halfWidth, type Mesh, type SolidSpecs } from './solid.ts';

const road: SolidSpecs = { lengthMm: 270, stackHeelMm: 34.1, stackForefootMm: 25.5, outsoleThicknessMm: 2.3, insoleThicknessMm: 2.9, plate: 'carbon', lugDepthMm: null, rockerApexPct: null, toeSpringDeg: null, heelBevelDeg: null, toeboxHeightMm: 27.3, widthForefootMm: 110.6, widthHeelMm: 77 };
const trail: SolidSpecs = { ...road, lengthMm: 270.4, stackHeelMm: 32.1, stackForefootMm: 27.2, plate: 'none', lugDepthMm: 4, widthForefootMm: 117.7, widthHeelMm: 94.1 };

const extent = (mesh: Mesh, axis: 0 | 1 | 2): [number, number] => {
  let min = Infinity;
  let max = -Infinity;
  for (let i = axis; i < mesh.positions.length; i += 3) ((min = Math.min(min, mesh.positions[i]!)), (max = Math.max(max, mesh.positions[i]!)));
  return [min, max];
};
const sound = (mesh: Mesh): void => {
  assert.ok(mesh.positions.every(Number.isFinite));
  assert.equal(mesh.indices.length % 3, 0);
  assert.ok(mesh.indices.every((i) => i < mesh.positions.length / 3));
};

describe('halfWidth', () => {
  it('is as wide as measured under the heel and the forefoot, and blunt at both ends', () => {
    assert.ok(Math.abs(halfWidth(0.14, 77, 110.6) - 38.5) < 0.01);
    assert.ok(Math.abs(halfWidth(0.72, 77, 110.6) - 55.3) < 0.01);
    assert.ok(halfWidth(0, 77, 110.6) > 0 && halfWidth(0, 77, 110.6) < 10);
    assert.ok(halfWidth(1, 77, 110.6) > 0 && halfWidth(1, 77, 110.6) < 10);
    for (let t = 0; t <= 1; t += 0.05) assert.ok(halfWidth(t, 77, 110.6) <= 55.3 + 1e-9);
  });
});

describe('buildShoeSolid', () => {
  it('gives the sole its measured length, widths and height', () => {
    const solid = buildShoeSolid(road);
    for (const mesh of [solid.outsole, solid.midsole, solid.insole, solid.upper, solid.plate!]) sound(mesh);
    assert.deepEqual(extent(solid.midsole, 0), [0, 270]);
    const [z0, z1] = extent(solid.midsole, 2);
    assert.ok(Math.abs(z1 - z0 - 110.6) < 0.5);
    // The top of the insole reaches the heel stack; the outsole stands on the ground.
    assert.ok(Math.abs(extent(solid.insole, 1)[1] - 34.1) < 0.6 || extent(solid.insole, 1)[1] > 34);
    assert.equal(extent(solid.outsole, 1)[0], 0);
    assert.ok(solid.upperCage.length > 0 && solid.upperCage.length % 6 === 0);
  });

  it('has a plate only for a shoe with one, narrower than the sole and inside it', () => {
    const solid = buildShoeSolid(road);
    const [z0, z1] = extent(solid.plate!, 2);
    assert.ok(z1 - z0 < 110.6);
    assert.ok(extent(solid.plate!, 1)[0] > 2.3);
    assert.equal(buildShoeSolid(trail).plate, null);
  });

  it('has lugs only for a shoe with them, as deep as the figure', () => {
    assert.equal(buildShoeSolid(road).lugs, null);
    const solid = buildShoeSolid(trail);
    sound(solid.lugs!);
    assert.ok(Math.abs(extent(solid.lugs!, 1)[0] + 4) < 0.01);
  });

  it('says the outline seen from above is not a figure, and refuses a shoe of no width', () => {
    assert.ok(buildShoeSolid(road).assumed.includes('plan-shape'));
    assert.throws(() => buildShoeSolid({ ...road, widthHeelMm: 0 }));
  });
});
