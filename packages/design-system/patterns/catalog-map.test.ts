import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { axisOf, layoutMap, type MapPoint } from './catalog-map.ts';

const point = (id: string, x: number, y: number, kind: MapPoint['kind'] = 'road'): MapPoint => ({ id, x, y, kind, label: id.toUpperCase(), href: `/${id}/` });

describe('axisOf', () => {
  it('starts and ends on round figures that hold every value, and steps on round figures between them', () => {
    assert.deepEqual(axisOf([135, 214, 420], 6), { min: 100, max: 450, ticks: [100, 150, 200, 250, 300, 350, 400, 450] });
    assert.deepEqual(axisOf([23, 49], 5), { min: 20, max: 50, ticks: [20, 30, 40, 50] });
  });

  it('does not push an end out when a value already sits on a round figure', () => {
    assert.deepEqual(axisOf([0, 4, 10], 5), { min: 0, max: 10, ticks: [0, 2, 4, 6, 8, 10] });
  });

  it('steps on halves without the dust of floating point', () => {
    assert.deepEqual(axisOf([0.5, 2.5], 4).ticks, [0.5, 1, 1.5, 2, 2.5]);
  });

  it('gives values that are all the same a unit either side, and no values an empty axis', () => {
    assert.deepEqual(axisOf([8, 8], 5), { min: 7, max: 9, ticks: [7, 8, 9] });
    assert.deepEqual(axisOf([], 5), { min: 0, max: 1, ticks: [0, 1] });
  });
});

describe('layoutMap', () => {
  it('places each point as a share of each axis from its low end', () => {
    const map = layoutMap([point('a', 100, 20), point('b', 300, 50), point('c', 200, 35)]);
    assert.deepEqual([map.x.min, map.x.max, map.y.min, map.y.max], [100, 300, 20, 50]);
    assert.deepEqual(map.points.map((p) => [p.id, p.along, p.up]), [['a', 0, 0], ['c', 0.5, 0.5], ['b', 1, 1]]);
  });

  it('orders the points from left to right and, in a column, from the bottom up', () => {
    const map = layoutMap([point('high', 250, 40), point('right', 300, 20), point('low', 250, 30), point('left', 200, 50)]);
    assert.deepEqual(map.points.map((p) => p.id), ['left', 'low', 'high', 'right']);
  });

  it('tells the points that share a place apart, so they can be drawn side by side', () => {
    const map = layoutMap([point('b', 265, 8), point('other', 300, 4), point('a', 265, 8, 'trail'), point('c', 265, 8)]);
    assert.deepEqual(map.points.map((p) => [p.id, p.place, p.of]), [['a', 0, 3], ['b', 1, 3], ['c', 2, 3], ['other', 0, 1]]);
    // Side by side is how they are drawn: the place they are given is the same.
    assert.equal(new Set(map.points.slice(0, 3).map((p) => `${p.along}/${p.up}`)).size, 1);
  });

  it('lays out no points as an empty map', () => {
    assert.deepEqual(layoutMap([]).points, []);
  });
});
