// The races of the calendar (Phase 2, E19), read from where each is published and written to
// src/content/calendar.json. Every race keeps the source it was read from and a link to it.
// Only facts are taken: name, date, town, distances, organiser and its website. No text, no image.
// Usage: node scripts/import-calendar.mjs [fromDate=2026-01-01] [toDate=2027-12-31]
import { readFileSync, writeFileSync } from 'node:fs';
import { alike, bare, distancesOf, plain, unescape } from './calendar-parse.mjs';

const [FROM = '2026-01-01', TO = '2027-12-31'] = process.argv.slice(2);
const AGENT = 'TRAM calendar import (one run, a handful of requests)';
const get = async (url) => {
  const response = await fetch(url, { headers: { 'User-Agent': AGENT }, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response;
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Who publishes each calendar, where, and on what terms. Shown on the page of every race taken from it. */
const SOURCES = {
  fca: { name: 'Federació Catalana d’Atletisme', url: 'https://fcatletisme.cat/', terms: 'Calendari oficial. Tots els drets reservats pel seu titular: se’n citen fets i s’hi enllaça.' },
  bcn: { name: 'Ajuntament de Barcelona · Open Data BCN', url: 'https://opendata-ajuntament.barcelona.cat/data/dataset/agenda-activitats-esportives', terms: 'CC BY 4.0' },
  'curses-cat': { name: 'Curses.cat', url: 'https://www.curses.cat/calendari', terms: 'Calendari d’una empresa de cronometratge. Se’n citen fets i s’hi enllaça.' },
  runnea: { name: 'Runnea', url: 'https://www.runnea.com/carreras-populares/calendario/catalunya/', terms: 'Calendari d’un mitjà. Se’n citen fets i s’hi enllaça.' },
  gotrail: { name: 'gotrail.run', url: 'https://gotrail.run/trail-running-calendar/spain/cataluna', terms: 'Calendari d’un agregador de curses de muntanya. Tots els drets reservats pel seu titular: se’n citen fets i s’hi enllaça.' },
  feec: { name: 'FEEC · Circuit Català de Caminades de Resistència', url: 'https://www.feec.cat/wp-content/uploads/2025/07/Puntuacions-_-CCCR26.pdf', terms: 'Calendari oficial del circuit, en PDF. Se’n citen fets i s’hi enllaça.' },
  own: { name: 'Web de l’organitzador', url: '', terms: 'Llegit a la pàgina de qui organitza la prova.' },
};
const PLACES = { name: 'Municipis Catalunya Geo · Generalitat de Catalunya', url: 'https://analisi.transparenciacatalunya.cat/d/9aju-tpwc', terms: 'Dades obertes de la Generalitat' };

// ── The municipalities of Catalonia: which a town is, its comarca and where it is.
const towns = new Map();
for (const row of await (await get('https://analisi.transparenciacatalunya.cat/resource/9aju-tpwc.json?$limit=2000')).json()) {
  // The dataset writes "Hospitalet de Llobregat, l'": the article is put back in front.
  const [, rest, article] = /^(.*), (el|la|els|les|l'|es|sa|ses)$/i.exec(row.nom) ?? [null, row.nom, null];
  const name = article ? `${article}${article.endsWith("'") ? '' : ' '}${rest}` : row.nom;
  towns.set(bare(row.nom), { name, comarca: row.nom_comarca, lat: Number(Number(row.latitud).toFixed(5)), lon: Number(Number(row.longitud).toFixed(5)) });
}
const townOf = (written) => {
  if (!written) return null;
  // "Girona-Sant Miquel", "Barcelona (Montjuïc)", "Tapis - Maçanet de Cabrenys": the municipality is one of the parts.
  for (const candidate of [written, ...written.split(/[-–(/,)]/)]) {
    const found = towns.get(bare(candidate));
    if (found) return found;
  }
  return null;
};

const iso = (day, month, year) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const found = [];
const left = {};
const leave = (source, why) => void (left[`${source}: ${why}`] = (left[`${source}: ${why}`] ?? 0) + 1);

// ── Federació Catalana d'Atletisme: the calendar of its website, by category.
// Road, trail and cross-country: races on foot. Race walking and track meetings are another calendar.
for (const [category, terrain] of [['ruta', 'road'], ['trail-muntanya', 'trail'], ['cros', 'mixed']]) {
  for (let page = 1; ; page++) {
    const data = await (await get(`https://fcatletisme.cat/wp-json/tribe/events/v1/events?per_page=50&page=${page}&categories=${category}&start_date=${FROM}&end_date=${TO}`)).json();
    for (const event of data.events ?? []) {
      const venue = unescape(event.venue?.venue ?? '');
      const organiser = event.organizer?.[0]?.organizer ? unescape(event.organizer[0].organizer) : null;
      // The federation also lists Spanish and international championships held elsewhere: those are not of this
      // calendar. They are told by who organises them and by a venue written with its region or country.
      const town = townOf(venue) ?? (venue && !/\(/.test(venue) && !/atletismorfea\.es|worldathletics|european-athletics/.test(event.website ?? '') && !/Española|World Athletics|European Athletics/.test(organiser ?? '') ? { name: venue, comarca: null, lat: null, lon: null } : null);
      if (!town) {
        leave('fca', 'fora de Catalunya o sense municipi');
        continue;
      }
      // "– *Ajornat*" or "– *Suspès*" at the end of a name is the state of the race, not its name.
      const [, state] = /\*\s*(ajorn\w*|susp\w*|cancel\w*|anul\w*)[^*]*\*/i.exec(unescape(event.title)) ?? [];
      const name = unescape(event.title).replace(/\s*[–-]?\s*\*[^*]*\*\s*/g, ' ').trim();
      // A world or European championship held abroad is on the federation's calendar, not on this one.
      if (!town.comarca && /campionat (del mon|d'europa|d'espanya)|copa del mon/.test(plain(name))) {
        leave('fca', 'fora de Catalunya o sense municipi');
        continue;
      }
      found.push({ ...(state ? { status: /^ajorn/i.test(state) ? 'postponed' : 'cancelled' } : {}), name, date: event.start_date.slice(0, 10), town, terrain, distancesM: distancesOf(name, { trail: terrain === 'trail' }), organiser, website: event.website || null, source: { id: 'fca', url: event.url } });
    }
    if (page >= (data.total_pages ?? 1)) break;
    await pause(600);
  }
}

// ── Barcelona's open data: the sports agenda of the city. One row per attribute of an event.
{
  const text = new TextDecoder('utf-16').decode(new Uint8Array(await (await get('https://opendata-ajuntament.barcelona.cat/data/dataset/286de6ac-00db-47ae-9a8e-18c579cbfc2f/resource/ab2d47b7-8493-4ed5-9f63-49ed116135f9/download')).arrayBuffer()));
  const rows = [];
  let [row, cell, quoted] = [[], '', false];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') (row.push(cell), (cell = ''));
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      [row, cell] = [[], ''];
    } else cell += c;
  }
  const head = rows[0].map((h) => h.replace(/^﻿/, ''));
  const at = (name) => head.indexOf(name);
  const seen = new Set();
  for (const r of rows.slice(1)) {
    const id = r[at('register_id')];
    const name = r[at('name')];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (!/(^|\s|")(cursa|marato|milla|trail|10 ?k|sant silvestre)(\s|$)/.test(plain(name))) {
      leave('bcn', 'no és una cursa a peu');
      continue;
    }
    const date = (r[at('start_date')] ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < FROM || date > TO) {
      leave('bcn', 'sense data dins del període');
      continue;
    }
    const [lat, lon] = [Number(r[at('geo_epgs_4326_lat')]), Number(r[at('geo_epgs_4326_lon')])];
    const town = { ...towns.get('barcelona'), ...(lat && lon ? { lat: Number(lat.toFixed(5)), lon: Number(lon.toFixed(5)) } : {}) };
    found.push({ name: name.replace(/"/g, '').trim(), date, town, terrain: /\btrail\b/i.test(name) ? 'trail' : null, distancesM: distancesOf(name), organiser: r[at('institution_name')] || null, website: null, source: { id: 'bcn', url: SOURCES.bcn.url } });
  }
}

// ── Curses.cat: the calendar of a timing company of the Girona area. One <article> per race.
{
  const html = await (await get('https://www.curses.cat/calendari')).text();
  for (const [article] of html.matchAll(/<article class="cc-cursa[\s\S]*?<\/article>/g)) {
    const kind = /data-tipus="([^"]*)"/.exec(article)?.[1] ?? '';
    const name = unescape(/class="cc-nom"[^>]*>([\s\S]*?)<\/a>/.exec(article)?.[1] ?? '');
    const [, day, month, year] = /(\d{2})\/(\d{2})\/(\d{4})/.exec(article) ?? [];
    const spans = [...article.matchAll(/<span><i class="bi bi-([a-z-]+)[^>]*><\/i>([\s\S]*?)<\/span>/g)].map(([, icon, value]) => [icon, unescape(value)]);
    const written = spans.find(([icon]) => icon === 'geo-alt')?.[1] ?? '';
    const lengths = spans.filter(([icon]) => icon !== 'geo-alt' && icon !== 'calendar-event').map(([, value]) => value).join(' ');
    // A calendar of everything the company times: mountain bikes are not on foot. A march or a walk is, and is kept as one.
    if (/\bbtt\b/.test(kind) || !/cursa|trail|popular|urbana|backyard|cronoescalada|marxa|caminada/.test(kind)) {
      leave('curses-cat', `no és a peu (${kind})`);
      continue;
    }
    const march = /marxa|caminada/.test(kind) && !/cursa|trail/.test(kind);
    if (!name || !day) continue;
    // A race run wherever each runner is has no place on a calendar of places.
    if (/\bvirtual\b/i.test(name)) {
      leave('curses-cat', 'cursa virtual');
      continue;
    }
    const date = iso(day, month, year);
    if (date < FROM || date > TO) continue;
    const link = /href="([^"]+)"[^>]*class="btn/.exec(article)?.[1] ?? /class="cc-nom" href="([^"]+)"/.exec(article)?.[1] ?? null;
    const own = link && !/^https?:\/\/(www\.)?curses\.cat\/?$/.test(link) ? link : null;
    found.push({ ...(march ? { kind: 'march' } : {}), name, date, town: townOf(written) ?? (written ? { name: written, comarca: null, lat: null, lon: null } : null), terrain: /trail|cronoescalada/.test(kind) ? 'trail' : /urbana|ruta/.test(kind) ? 'road' : null, distancesM: distancesOf(`${name} ${lengths}`, { trail: /trail|cronoescalada/.test(kind) }), organiser: null, website: own, source: { id: 'curses-cat', url: own ?? SOURCES['curses-cat'].url } });
  }
}

// ── Runnea: what its calendar for Catalonia says of each race to search engines (schema.org).
{
  const html = await (await get(SOURCES.runnea.url)).text();
  const links = [...html.matchAll(/href="(\/carreras-populares\/[a-z0-9-]+-\d+\.html|\/carreras-populares\/[a-z0-9-]+\/)"/g)].map(([, href]) => href).filter((href) => !/calendario/.test(href));
  for (const [, json] of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    let event;
    try {
      event = JSON.parse(json);
    } catch {
      continue;
    }
    if (event['@type'] !== 'Event') continue;
    const [, day, month, year] = /(\d{2})-(\d{2})-(\d{4})/.exec(event.startDate ?? '') ?? [];
    if (!day) continue;
    const date = iso(day, month, year);
    if (date < FROM || date > TO) continue;
    // Runnea says the province, not the town: the place is left unknown rather than guessed.
    const slug = plain(event.name).replace(/\s+/g, '-');
    const page = links.find((href) => href.includes(slug.replace(/-\d{4}$/, '')));
    found.push({ name: unescape(event.name).replace(/\s\d{4}$/, ''), date, town: null, region: event.location?.address?.addressRegion ?? null, terrain: null, distancesM: distancesOf(event.name), organiser: event.organizer?.name || null, website: null, source: { id: 'runnea', url: page ? `https://www.runnea.com${page}` : SOURCES.runnea.url } });
  }
}

// ── gotrail.run: what each page of its calendar for Catalonia says to search engines (schema.org): name, day, town.
for (let page = 1; page <= 20; page++) {
  // The page after the last one does not exist.
  const html = await get(`${SOURCES.gotrail.url}${page > 1 ? `?page=${page}` : ''}`).then((response) => response.text(), () => '');
  let events = [];
  for (const [, json] of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(json);
      if (data['@type'] === 'ItemList') events = data.itemListElement.map((entry) => entry.item).filter((item) => item?.['@type'] === 'SportsEvent');
    } catch {
      // Not data: nothing to read.
    }
  }
  if (!events.length) break;
  for (const event of events) {
    const date = (event.startDate ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < FROM || date > TO) continue;
    const written = event.location?.address?.addressLocality ?? event.location?.name ?? '';
    const geo = event.location?.geo;
    const town = townOf(written) ?? (written ? { name: written, comarca: null, lat: geo ? Number(Number(geo.latitude).toFixed(5)) : null, lon: geo ? Number(Number(geo.longitude).toFixed(5)) : null } : null);
    // "You can run between 13 and 50 kilometers": the shortest and the longest it offers. "You can run 21 kilometers": the one.
    const [, low, high] = /between (\d+(?:\.\d+)?) and (\d+(?:\.\d+)?) kilometers/.exec(event.description ?? '') ?? [];
    const [, only] = /You can run (\d+(?:\.\d+)?) kilometers/.exec(event.description ?? '') ?? [];
    const name = unescape(event.name);
    // It is a calendar of trail running with some road and urban races in it: the ground is said only when the name says it.
    found.push({ name, date, town, terrain: /trail|muntanya|skyrace|vertical/i.test(name) ? 'trail' : null, distancesM: [low, high, only].filter(Boolean).map((km) => Math.round(Number(km) * 1000)).sort((a, b) => a - b), organiser: null, website: null, source: { id: 'gotrail', url: event.url } });
  }
  await pause(800);
}

// ── FEEC: the resistance marches of its Catalan circuit, read once from its PDF into a file of this folder.
{
  const read = JSON.parse(readFileSync(new URL('./calendar-feec-cccr-2026.json', import.meta.url), 'utf8'));
  for (const march of read.marches) {
    if (march.date < FROM || march.date > TO) continue;
    found.push({ kind: 'march', ...(march.status ? { status: march.status } : {}), name: march.name, date: march.date, town: null, terrain: null, distancesM: [Math.round(march.km * 1000)], organiser: null, website: null, source: { id: 'feec', url: read.source } });
  }
}

// ── What was read by hand on the page of an organiser.
{
  const read = JSON.parse(readFileSync(new URL('./calendar-own.json', import.meta.url), 'utf8'));
  for (const race of read.races) {
    found.push({ ...(race.kind ? { kind: race.kind } : {}), name: race.name, date: race.date, town: townOf(race.town) ?? { name: race.town, comarca: null, lat: null, lon: null }, terrain: race.terrain ?? null, distancesM: (race.distancesKm ?? []).map((km) => Math.round(km * 1000)), organiser: race.organiser ?? null, website: race.website ?? null, source: { id: 'own', url: race.website } });
  }
}

// ── One race, one entry: the same race read from two calendars keeps both sources.
// What an organiser says of its own race comes first; then the federations, the timing company, the city and the aggregators.
const ORDER = ['own', 'fca', 'feec', 'curses-cat', 'bcn', 'gotrail', 'runnea'];
found.sort((a, b) => ORDER.indexOf(a.source.id) - ORDER.indexOf(b.source.id));
const races = [];
for (const entry of found) {
  // The day and the name; and the town, when both calendars name a municipality (one may name a neighbourhood of it).
  const same = races.find((race) => race.date === entry.date && (!entry.town?.comarca || !race.town?.comarca || bare(race.town.name) === bare(entry.town.name)) && alike(race.name, entry.name));
  if (same) {
    if (!same.sources.some((s) => s.id === entry.source.id)) same.sources.push(entry.source);
    same.distancesM = [...new Set([...same.distancesM, ...entry.distancesM])].sort((a, b) => a - b);
    same.website ??= entry.website;
    same.organiser ??= entry.organiser;
    same.terrain ??= entry.terrain;
    same.kind ??= entry.kind;
    same.status ??= entry.status;
    if (same.town && !same.town.comarca && entry.town?.comarca) same.town = entry.town;
    same.town ??= entry.town;
    // The city's own data says where in the city, not just the middle of it.
    if (entry.source.id === 'bcn' && entry.town?.lat && same.town) same.town = { ...same.town, lat: entry.town.lat, lon: entry.town.lon };
    continue;
  }
  const { source, ...rest } = entry;
  races.push({ ...rest, sources: [source] });
}

const slugs = new Set();
const out = races
  .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, 'ca'))
  .map((race) => {
    let slug = `${plain(race.name).replace(/'/g, '').replace(/\s+/g, '-').replace(/-\d{4}$/, '').slice(0, 70).replace(/-+$/, '')}-${race.date.slice(0, 4)}`;
    for (let n = 2; slugs.has(slug); n++) slug = slug.replace(/(-\d+)?$/, '') + `-${n}`;
    slugs.add(slug);
    return { slug, name: race.name, date: race.date, town: race.town?.name ?? null, comarca: race.town?.comarca ?? null, ...(race.region && !race.town ? { region: race.region } : {}), lat: race.town?.lat ?? null, lon: race.town?.lon ?? null, terrain: race.terrain, ...(race.kind ? { kind: race.kind } : {}), ...(race.status ? { status: race.status } : {}), distancesM: race.distancesM, organiser: race.organiser, website: race.website, sources: race.sources };
  });

writeFileSync(new URL('../src/content/calendar.json', import.meta.url), JSON.stringify({ accessed: new Date().toISOString().slice(0, 10), from: FROM, to: TO, sources: SOURCES, places: PLACES, races: out }, null, 1) + '\n');
const by = (key) => out.reduce((count, race) => ((count[key(race)] = (count[key(race)] ?? 0) + 1), count), {});
console.log(`${found.length} read, ${out.length} races after joining the same race from two calendars`);
console.log('by source', by((r) => r.sources.map((s) => s.id).join('+')));
console.log('by terrain', by((r) => r.terrain ?? 'unknown'), 'with distance', out.filter((r) => r.distancesM.length).length, 'with town', out.filter((r) => r.town).length, 'with website', out.filter((r) => r.website).length);
console.log('by year', by((r) => r.date.slice(0, 4)), 'left out', left);
