import assert from 'node:assert/strict';
import { test } from 'node:test';
import { found, searchText } from '../src/content/search-text.ts';

test('a text is compared without accents, capitals or punctuation', () => {
  assert.equal(searchText('32a Marxa dels Arrossars'), '32a marxa dels arrossars');
  assert.equal(searchText("Cursa de l'Escala – 10K"), 'cursa de l escala 10k');
  assert.equal(searchText('Mitja Marató de Sant Feliu de Guíxols'), 'mitja marato de sant feliu de guixols');
  assert.equal(searchText('Cros del Col·legi Sant Lluç'), 'cros del collegi sant lluc');
  assert.equal(searchText('  Peñíscola  '), 'peniscola');
});

test('every word asked for has to be there, in any order and as a part of a word', () => {
  const race = searchText('32a Marxa dels Arrossars Pals');
  assert.ok(found(race, 'arrossars'));
  assert.ok(found(race, 'ARROS'));
  assert.ok(found(race, 'pals marxa'));
  assert.ok(found(race, "marxa  d'els"));
  assert.ok(!found(race, 'marxa palamós'));
});

test('nothing asked for finds everything', () => {
  assert.ok(found('cursa de sils', ''));
  assert.ok(found('cursa de sils', '  · '));
});
