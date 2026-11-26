import assert from 'node:assert/strict';
import { test } from 'node:test';
import { closenessOf, comparable, distanceOf, gapsBetween, similarTo, usualOf } from '../src/content/similar-keys.ts';

const shoe = (over) => ({ terrain: 'road', weightG: null, stackHeelMm: null, stackForefootMm: null, dropMm: null, lugDepthMm: null, plate: null, support: null, use: [], ...over });
const road = (over) => shoe({ terrain: 'road', weightG: 260, stackHeelMm: 38, stackForefootMm: 30, dropMm: 8, ...over });
const trail = (over) => shoe({ terrain: 'trail', weightG: 290, stackHeelMm: 32, stackForefootMm: 26, dropMm: 6, ...over });
// What is usual: road 260 g and 38/30 mm, mountain 290 g and 32/26 mm.
const USUAL = usualOf([road({}), trail({})]);
const gap = (gaps, part) => gaps.find((g) => g.part === part);

test('what is usual on a ground is its middle shoe, and a ground with no figure has none', () => {
  const usual = usualOf([road({ weightG: 200 }), road({ weightG: 300 }), road({ weightG: 260 }), road({ weightG: null })]);
  assert.equal(usual.road.weightG, 260);
  assert.equal(usual.trail.weightG, null);
  assert.equal(usualOf([road({ weightG: 200 }), road({ weightG: 300 })]).road.weightG, 250);
});

test('on the same ground, figures are compared as they are', () => {
  const gaps = gapsBetween(road({}), road({ weightG: 230, dropMm: 4 }), USUAL);
  assert.equal(gap(gaps, 'weight').by, -30);
  assert.equal(gap(gaps, 'weight').steps, 1);
  assert.equal(gap(gaps, 'drop').by, -4);
  assert.equal(gap(gaps, 'heel').by, 0);
});

test('across grounds, weight and heights are compared by their place on their own ground, and the drop as it is', () => {
  // A mountain shoe 20 g over what is usual there, and a road one 20 g over what is usual on the road: alike in weight.
  const gaps = gapsBetween(trail({ weightG: 310, stackHeelMm: 36, dropMm: 8 }), road({ weightG: 280, stackHeelMm: 42, dropMm: 8 }), USUAL);
  assert.equal(gap(gaps, 'weight').by, 0);
  assert.equal(gap(gaps, 'heel').by, 0);
  assert.equal(gap(gaps, 'drop').by, 0);
  // The same road shoe against a mountain one at the usual weight: 20 g heavier for its ground.
  assert.equal(gap(gapsBetween(trail({}), road({ weightG: 280 }), USUAL), 'weight').by, 20);
});

test('a figure one of the two lacks is neither a likeness nor a difference, and too few in common is no comparison', () => {
  const gaps = gapsBetween(road({}), road({ weightG: null }), USUAL);
  assert.equal(gap(gaps, 'weight'), undefined);
  assert.equal(gapsBetween(road({}), shoe({ dropMm: 8 }), USUAL), null);
  assert.equal(comparable(shoe({ dropMm: 8 })), false);
  assert.equal(comparable(shoe({ dropMm: 8, weightG: 250 })), true);
  // Fewer figures in common, the same differences: a little further.
  assert.ok(distanceOf(gaps) > distanceOf(gapsBetween(road({}), road({}), USUAL)));
});

test('lugs count between two mountain shoes only', () => {
  assert.ok(gap(gapsBetween(trail({ lugDepthMm: 4 }), trail({ lugDepthMm: 5.5 }), USUAL), 'lugs'));
  assert.equal(gap(gapsBetween(trail({ lugDepthMm: 4 }), road({ lugDepthMm: 2 }), USUAL), 'lugs'), undefined);
  assert.equal(gap(gapsBetween(road({ lugDepthMm: 2 }), road({ lugDepthMm: 3 }), USUAL), 'lugs'), undefined);
});

test('support, use and a fast plate count only when both makers say', () => {
  const mine = road({ support: 'neutral', use: ['daily', 'long'], plate: 'none' });
  const gaps = gapsBetween(mine, road({ support: 'stability', use: ['daily'], plate: 'carbon' }), USUAL);
  assert.equal(gap(gaps, 'support').steps, 1);
  assert.equal(gap(gaps, 'use').steps, 0.5);
  assert.equal(gap(gaps, 'plate').steps, 1);
  const silent = gapsBetween(mine, road({}), USUAL);
  for (const part of ['support', 'use', 'plate']) assert.equal(gap(silent, part), undefined);
  // A rock plate protects: against a shoe with no plate it is no difference.
  assert.equal(gap(gapsBetween(trail({ plate: 'rock_plate' }), trail({ plate: 'none' }), USUAL), 'plate').steps, 0);
});

test('the same shoe again is at no distance, and one clear difference in the drop is not close', () => {
  assert.equal(distanceOf(gapsBetween(road({}), road({}), USUAL)), 0);
  const close = (a, b) => {
    const gaps = gapsBetween(a, b, USUAL);
    return closenessOf(distanceOf(gaps), gaps);
  };
  assert.notEqual(close(road({}), road({ dropMm: 4 })), 'close');
  // A neutral shoe and one with support, alike in every figure, are not close either.
  assert.equal(close(road({ support: 'neutral' }), road({ support: 'stability' })), 'near');
  assert.equal(close(road({ support: 'neutral' }), road({ support: 'neutral', weightG: 270 })), 'close');
  // Alike on the drop and the weight, with no height to go by: not enough to call it close.
  assert.equal(close(road({}), road({ stackHeelMm: null, stackForefootMm: null })), 'near');
});

test('the most alike come first, on the ground asked for, without the shoe itself and without those too far', () => {
  const mine = trail({ dropMm: 8 });
  const twin = road({ dropMm: 8 });
  const cousin = road({ dropMm: 6, weightG: 275 });
  const stranger = road({ dropMm: 0, weightG: 150, stackHeelMm: 22, stackForefootMm: 22 });
  const found = similarTo(mine, [stranger, cousin, mine, twin, trail({})], 'road', USUAL);
  assert.deepEqual(found.map((match) => match.shoe), [twin, cousin]);
  assert.equal(found[0].closeness, 'close');
  assert.equal(similarTo(mine, [stranger], 'road', USUAL).length, 0);
  assert.deepEqual(similarTo(mine, [mine, trail({})], 'trail', USUAL).map((match) => match.shoe.terrain), ['trail']);
});

test('at the same distance, the shoe known to be alike in more comes first', () => {
  const mine = road({ support: 'neutral' });
  const silent = road({});
  const said = road({ support: 'neutral' });
  assert.deepEqual(similarTo(mine, [silent, said], 'road', USUAL).map((match) => match.shoe), [said, silent]);
});
