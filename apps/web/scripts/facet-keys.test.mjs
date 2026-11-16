import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { distancesIn, inComarca, slugOf, typeOf } from '../src/content/facet-keys.ts';

const read = (file) => JSON.parse(readFileSync(new URL(`../src/content/${file}`, import.meta.url), 'utf8'));

test('a name becomes a part of an address', () => {
  assert.equal(slugOf('Baix Empordà'), 'baix-emporda');
  assert.equal(slugOf("Pla de l'Estany"), 'pla-de-l-estany');
  assert.equal(slugOf('Lluçanès'), 'llucanes');
  assert.equal(slugOf("Val d'Aran"), 'val-d-aran');
});

test('a race is of the kind its source says, and of none when it says nothing', () => {
  assert.equal(typeOf({ kind: 'march', terrain: 'trail' }), 'march');
  assert.equal(typeOf({ terrain: 'road' }), 'road');
  assert.equal(typeOf({ terrain: null }), 'unknown');
});

test('a race is of every named distance one of its own falls in, and of none it only comes near', () => {
  assert.deepEqual(distancesIn([10549, 21097]), ['mitja-marato']);
  assert.deepEqual(distancesIn([5000, 10000, 42195]), ['5-km', '10-km', 'marato']);
  assert.deepEqual(distancesIn([42000, 100000]), ['marato', 'ultra']);
  assert.deepEqual(distancesIn([12000, 16000]), []);
  assert.deepEqual(distancesIn([]), []);
});

test('every comarca the map draws, and every one a race is in, has its article', () => {
  const names = new Set([...read('comarques.json').comarques.map((c) => c.name), ...read('calendar.json').races.map((r) => r.comarca).filter(Boolean)]);
  assert.equal(read('comarques.json').comarques.length, 43);
  for (const name of names) assert.match(inComarca(name), /^a(l| l’| la| les)? /);
  assert.equal(inComarca('Baix Empordà'), 'al Baix Empordà');
  assert.equal(inComarca('Alt Camp'), 'a l’Alt Camp');
  assert.equal(inComarca('Garrigues'), 'a les Garrigues');
  assert.equal(inComarca('Osona'), 'a Osona');
  assert.throws(() => inComarca('Comarca que no existeix'));
});

test('no two comarques share an address', () => {
  const slugs = read('comarques.json').comarques.map((c) => slugOf(c.name));
  assert.equal(new Set(slugs).size, slugs.length);
});
