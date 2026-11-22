import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasDeepLugs, hasPlate, hasWideToeBox, hasWideVersion, isCushioned, isLight, isLowDrop, isWide, widthRead } from '../src/content/need-keys.ts';

const shoe = (over) => ({ terrain: 'road', weightG: null, stackHeelMm: null, dropMm: null, lugDepthMm: null, plate: null, ...over });

test('a shoe is wide by a wider version or by a toe box its maker calls wide', () => {
  assert.equal(hasWideVersion({ widths: ['Wide'], toeBox: null }), true);
  assert.equal(hasWideVersion({ widths: [], toeBox: null }), false);
  assert.equal(hasWideToeBox({ widths: [], toeBox: 'Wide Toe Box' }), true);
  assert.equal(isWide({ widths: [], toeBox: 'Wide Toe Box' }), true);
  assert.equal(isWide({ widths: [], toeBox: null }), false);
});

test('a shoe whose width was not read is not taken for a narrow one', () => {
  assert.equal(widthRead(undefined), false);
  assert.equal(widthRead({ widths: null, toeBox: null }), false);
  assert.equal(isWide(undefined), false);
  // One width only, read on the page, is an answer.
  assert.equal(widthRead({ widths: [], toeBox: null }), true);
});

test('light and cushioned are judged against shoes of the same ground', () => {
  assert.equal(isLight(shoe({ weightG: 230 })), true);
  assert.equal(isLight(shoe({ weightG: 231 })), false);
  assert.equal(isLight(shoe({ terrain: 'trail', weightG: 265 })), true);
  assert.equal(isCushioned(shoe({ stackHeelMm: 38 })), false);
  assert.equal(isCushioned(shoe({ terrain: 'trail', stackHeelMm: 38 })), true);
});

test('a figure a maker does not state puts a shoe on no list', () => {
  const silent = shoe({});
  for (const rule of [isLight, isCushioned, isLowDrop, hasPlate, hasDeepLugs]) assert.equal(rule(silent), false);
});

test('a drop of zero is a low drop, a stated «no plate» is no plate, and lugs count on the mountain only', () => {
  assert.equal(isLowDrop(shoe({ dropMm: 0 })), true);
  assert.equal(isLowDrop(shoe({ dropMm: 5 })), false);
  assert.equal(hasPlate(shoe({ plate: 'none' })), false);
  assert.equal(hasPlate(shoe({ plate: 'carbon' })), true);
  assert.equal(hasDeepLugs(shoe({ terrain: 'trail', lugDepthMm: 5 })), true);
  assert.equal(hasDeepLugs(shoe({ terrain: 'road', lugDepthMm: 5 })), false);
});
