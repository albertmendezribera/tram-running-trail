import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { alike, bare, distancesOf, unescape } from './calendar-parse.mjs';

describe('towns', () => {
  it('reads a town the same with its article in front, behind or missing', () => {
    assert.equal(bare("L'Escala"), 'escala');
    assert.equal(bare("Escala, l'"), 'escala');
    assert.equal(bare('L’Hospitalet de Llobregat'), bare("Hospitalet de Llobregat, l'"));
    assert.equal(bare('El Palau d’Anglesola'), bare("Palau d'Anglesola, el"));
    // A town that only starts like an article keeps its name.
    assert.equal(bare('Espolla'), 'espolla');
    assert.equal(bare('Salt'), 'salt');
    assert.equal(bare('ST. LLORENÇ DE LA MUGA'), bare('Sant Llorenç de la Muga'));
  });
});

describe('distances', () => {
  it('takes every distance a name gives, in metres, and none it does not', () => {
    assert.deepEqual(distancesOf('27a Cursa Popular de Mollet del Vallès (5 i 10 Km)'), [5000, 10000]);
    assert.deepEqual(distancesOf('2a Cursa de 5 i 10k de Vic'), [5000, 10000]);
    assert.deepEqual(distancesOf('TRAIL LA VALL 6km, 13km , 22km I 46KM', { trail: true }), [6000, 13000, 22000, 46000]);
    assert.deepEqual(distancesOf('15a Cursa solidària Païs del Cava (13.400 m.)'), [13400]);
    assert.deepEqual(distancesOf('46a Cursa Popular de Sant Martí'), []);
    // An edition number is not a distance.
    assert.deepEqual(distancesOf('103a Allianz Jean Bouin (RFEA)'), []);
  });

  it('knows what a marathon, a half and a mile measure on a road, and not on a mountain', () => {
    assert.deepEqual(distancesOf('48a edició Zurich Marató de Barcelona 2027'), [42195]);
    assert.deepEqual(distancesOf('42a Mitja Marató de Sitges i Quart de Marató'), [10549, 21097]);
    assert.deepEqual(distancesOf('38a Milla de la Sagrada Familia'), [1609]);
    assert.deepEqual(distancesOf('Marató del Montseny', { trail: true }), []);
  });
});

describe('the same race in two calendars', () => {
  it('is told by what its names share, not by its edition or its sponsor', () => {
    assert.ok(alike('103a Allianz Jean Bouin (RFEA)', '103a Cursa Allianz Jean Bouin - Trofeu Internacional Ciutat de Barcelona'));
    assert.ok(alike('B100 Cursa dels Nassos 2026 - Sant Silvestre de Barcelona', 'Cursa dels Nassos'));
    assert.ok(!alike('46a Cursa Popular de Sant Martí', '38a Milla de la Sagrada Familia'));
  });

  it('reads names written for a web page', () => {
    assert.equal(unescape('Trail Val d&#x27;Aran <b>UTMB</b>'), "Trail Val d'Aran UTMB");
    assert.equal(unescape('El Palau d&#8217;Anglesola'), 'El Palau d’Anglesola');
  });
});
