// Puts into the calendar what each organiser says of its own race on its own page (scripts/own-read/*.json,
// read there on the day each file says). A race its organiser confirms gains the source «own», which is
// what lets it reach production without waiting for the calendar it was first found in (docs/revisio-legal.md
// 11). Where the organiser says something else than the calendar did, the organiser's word is kept.
// Only facts are taken: name, date, town, distances, organiser, whether it is a march, whether it was called off.
// Usage: node scripts/apply-own-read.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { bare } from './calendar-parse.mjs';

/**
 * Pages that are not taken as the organiser's own word, though a race was read on them: the sign-up pages
 * of Curses.cat, the timing company whose calendar is one of the sources that have given no leave.
 */
const NOT_OWN = /(^|\.)curses\.cat$/;
/**
 * Races whose organiser bars Anthropic's agents on its own site (robots.txt). Their date was read on
 * another page (a council's agenda, a sign-up platform, a sister host): not used, against that wish.
 */
const WITHHELD = new Set(['cursa-del-tractor-2026', 'cursa-del-bolet-2026', 'el-tast-de-la-mitja-10-km-amb-desnivell-2026']);

const at = (file) => new URL(file, import.meta.url);
const calendar = JSON.parse(readFileSync(at('../src/content/calendar.json'), 'utf8'));
const bySlug = new Map(calendar.races.map((race) => [race.slug, race]));
// The municipalities of Catalonia, as the import reads them: which a town is, its comarca and where it is.
const towns = new Map();
for (const row of await (await fetch('https://analisi.transparenciacatalunya.cat/resource/9aju-tpwc.json?$limit=2000', { headers: { 'User-Agent': 'TRAM calendar import (one request)' } })).json()) {
  const [, rest, article] = /^(.*), (el|la|els|les|l'|es|sa|ses)$/i.exec(row.nom) ?? [null, row.nom, null];
  const name = article ? `${article}${article.endsWith("'") ? '' : ' '}${rest}` : row.nom;
  towns.set(bare(name), { town: name, comarca: row.nom_comarca, lat: Number(Number(row.latitud).toFixed(5)), lon: Number(Number(row.longitud).toFixed(5)) });
}

const told = { confirmed: 0, already: 0, dates: [], distances: 0, cancelled: 0, marches: 0, unknown: [], moved: [], unplaced: [], dropped: [], left: 0 };
for (const file of readdirSync(at('./own-read/')).filter((name) => name.endsWith('.json')).sort()) {
  for (const read of JSON.parse(readFileSync(at(`./own-read/${file}`), 'utf8')).races) {
    // A race the calendar holds twice: the copy goes.
    if (read.duplicateOf && bySlug.has(read.slug) && bySlug.has(read.duplicateOf)) {
      calendar.races = calendar.races.filter((race) => race.slug !== read.slug);
      told.dropped.push(read.slug);
      continue;
    }
    if (!read.confirmed || !read.website) continue;
    if (NOT_OWN.test(new URL(read.website).hostname) || WITHHELD.has(read.slug)) {
      told.left += 1;
      continue;
    }
    const race = bySlug.get(read.slug);
    if (!race) {
      told.unknown.push(read.slug);
      continue;
    }
    if (race.sources.some((source) => source.id === 'own')) told.already += 1;
    else race.sources.push({ id: 'own', url: read.website });
    told.confirmed += 1;
    race.website = read.website;
    if (read.organiser) race.organiser = read.organiser;
    if (read.date && read.date !== race.date) {
      told.dates.push(`${read.slug}: ${race.date} → ${read.date}`);
      race.date = read.date;
    }
    if (read.distancesKm?.length) {
      const metres = read.distancesKm.map((km) => Math.round(km * 1000)).sort((a, b) => a - b);
      if (JSON.stringify(metres) !== JSON.stringify(race.distancesM)) told.distances += 1;
      race.distancesM = metres;
    }
    if (read.kind === 'march' && race.kind !== 'march') {
      race.kind = 'march';
      told.marches += 1;
    }
    if (read.status && race.status !== read.status) {
      race.status = read.status;
      told.cancelled += 1;
    }
    // The town its organiser says, where it is a municipality: a race is placed at its town hall, as every other.
    if (read.town && bare(read.town) !== bare(race.town ?? '')) {
      const place = towns.get(bare(read.town));
      if (place) {
        told.moved.push(`${read.slug}: ${race.town ?? '—'} → ${place.town}`);
        Object.assign(race, place);
      } else told.unplaced.push(`${read.slug}: «${read.town}»`);
    }
  }
}
writeFileSync(at('../src/content/calendar.json'), `${JSON.stringify(calendar, null, 1)}\n`);
const open = calendar.races.filter((race) => race.sources.some((source) => source.id === 'bcn' || source.id === 'own')).length;
console.log(`${told.confirmed} races confirmed by their organiser (${told.already} already were); ${told.distances} with other distances, ${told.marches} marches, ${told.cancelled} called off or put off`);
if (told.dates.length) console.log(`Dates the organiser gives otherwise:\n  ${told.dates.join('\n  ')}`);
if (told.unknown.length) console.log(`Not in the calendar: ${told.unknown.join(', ')}`);
if (told.moved.length) console.log(`Towns the organiser gives otherwise:\n  ${told.moved.join('\n  ')}`);
if (told.unplaced.length) console.log(`Towns that are no municipality, left as they were:\n  ${told.unplaced.join('\n  ')}`);
if (told.dropped.length) console.log(`Held twice, one copy dropped: ${told.dropped.join(', ')}`);
console.log(`${told.left} confirmations not used (a page of Curses.cat, or an organiser that bars the reading)`);
console.log(`${open} of ${calendar.races.length} races may now reach production`);
