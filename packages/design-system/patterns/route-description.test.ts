import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ProfilePoint } from './elevation.ts';
import { describeRoute } from './route-description.ts';

// A flat approach, one climb of 3 km at 10 %, then a descent.
const climb: ProfilePoint[] = Array.from({ length: 201 }, (_, i) => {
  const km = i * 0.05;
  return [Number(km.toFixed(2)), km < 2 ? 100 : km < 5 ? 100 + (km - 2) * 100 : Math.max(100, 400 - (km - 5) * 80)];
});
const flat: ProfilePoint[] = Array.from({ length: 201 }, (_, i) => [i * 0.05, 60 + (i % 2)]);

// Figures and units are joined with no-break spaces (packages/formats): the tests read them as plain ones.
const plain = (points: readonly ProfilePoint[], locale: 'ca' | 'es' | 'en'): string[] => describeRoute(points, locale).map((s) => s.replace(/[\u00a0\u202f]/g, ' '));

describe('describeRoute', () => {
  it('says the distance, the gain, the main climb and the highest point, from the data', () => {
    const text = plain(climb, 'ca');
    assert.match(text[0]!, /^10 km amb 300 m D\+\.$/);
    assert.match(text[1]!, /^La pujada principal fa 3 km al 10 % de mitjana, del km 2 al 5, i hi guanyes 300 m\.$/);
    assert.match(text.at(-1)!, /^El punt més alt és a 400 m, al km 5\.$/);
  });

  it('says so when the route is flat, and invents no climb', () => {
    const text = plain(flat, 'ca');
    assert.equal(text.length, 3);
    assert.match(text[1]!, /gairebé pla/);
  });

  it('writes in the language asked for', () => {
    assert.match(plain(climb, 'en')[1]!, /^The main climb is 3 km at 10 % on average/);
    assert.match(plain(climb, 'es')[1]!, /^La subida principal tiene 3 km al 10 % de media/);
  });
});
