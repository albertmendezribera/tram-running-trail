import assert from 'node:assert/strict';
import { test } from 'node:test';
import { closenessOf, distanceOf, gapsBetween, usualOf } from '../src/content/similar-keys.ts';
import { noteOf } from '../src/content/similar-words.ts';

const shoe = (over) => ({ terrain: 'road', weightG: 260, stackHeelMm: 38, stackForefootMm: 30, dropMm: 8, lugDepthMm: null, plate: null, support: null, use: [], ...over });
const trail = (over) => shoe({ terrain: 'trail', weightG: 290, stackHeelMm: 32, stackForefootMm: 26, dropMm: 6, ...over });
const USUAL = usualOf([shoe({}), trail({})]);
const note = (mine, other) => {
  const gaps = gapsBetween(mine, other, USUAL);
  return noteOf({ gaps, closeness: closenessOf(distanceOf(gaps), gaps) }, mine.terrain !== other.terrain, other.support).replace(/ /g, ' ');
};

test('on the same ground the line gives the differences as figures, what is alike first', () => {
  assert.equal(note(shoe({}), shoe({ weightG: 272, dropMm: 6 })), 'Molt semblant: mateixa alçada al taló · 2 mm menys de drop · 12 g més');
  assert.equal(note(shoe({}), shoe({ weightG: 262 })), 'Molt semblant: mateix drop · mateixa alçada al taló · mateix pes');
});

test('across grounds weight and height are said in words, since they are places on their own ground and not figures side by side', () => {
  assert.equal(note(trail({ dropMm: 8 }), shoe({})), 'Molt semblant: mateix drop · sola equivalent · pes equivalent');
  assert.equal(note(trail({ dropMm: 8 }), shoe({ weightG: 240, stackHeelMm: 44 })), 'Semblant: mateix drop · sola més alta · una mica més lleugera');
});

test('the support is said of the shoe offered: alike, or a «but»; and lugs only between two mountain shoes', () => {
  assert.match(note(shoe({ support: 'neutral' }), shoe({ support: 'neutral' })), /també neutra$/);
  assert.match(note(shoe({ support: 'neutral' }), shoe({ support: 'stability' })), /però amb suport$/);
  assert.match(note(trail({ lugDepthMm: 4 }), trail({ lugDepthMm: 5.5 })), /tacs 1,5 mm més profunds$/);
});
