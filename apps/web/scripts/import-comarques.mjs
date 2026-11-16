// The outline of every comarca of Catalonia, for the maps of the calendar: read from the ICGC's own
// service of administrative divisions (CC BY 4.0), at its coarsest scale, and thinned to what a small
// map can show. Run by hand: `pnpm --filter @tram/web import-comarques [file.gml]`. With a file, it is
// read instead of the service.
import { readFile, writeFile } from 'node:fs/promises';

const SERVICE = 'https://geoserveis.icgc.cat/servei/catalunya/divisions-administratives/wfs';
const LAYER = 'divisions_administratives_wfs:divisions_administratives_comarques_1000000';
const SOURCE = { name: 'Divisions administratives · Institut Cartogràfic i Geològic de Catalunya (ICGC)', url: 'https://www.icgc.cat/ca/Geoinformacio-i-mapes/Dades-i-productes/Geoinformacio-cartografica/Divisions-administratives', terms: 'CC BY 4.0' };
/** A point may move this far from the line it is on, in metres: under a pixel of a map of the whole country. */
const TOLERANCE_M = 600;
/** A piece of land smaller than this, in square kilometres, is left out: an islet is a dot of noise. */
const SMALLEST_KM2 = 3;
/** Coordinates are kept to this many metres. */
const GRAIN_M = 100;

const gml = process.argv[2] ? await readFile(process.argv[2], 'utf8') : await (await fetch(`${SERVICE}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${LAYER}`)).text();

/** Douglas-Peucker on an open line of [x, y]. */
function thinned(line, tolerance) {
  const keep = new Uint8Array(line.length);
  keep[0] = keep[line.length - 1] = 1;
  const stack = [[0, line.length - 1]];
  while (stack.length) {
    const [from, to] = stack.pop();
    const [ax, ay] = line[from];
    const [bx, by] = line[to];
    const length = Math.hypot(bx - ax, by - ay) || 1;
    let [far, at] = [0, -1];
    for (let i = from + 1; i < to; i++) {
      const away = Math.abs((bx - ax) * (ay - line[i][1]) - (ax - line[i][0]) * (by - ay)) / length;
      if (away > far) [far, at] = [away, i];
    }
    if (far > tolerance) {
      keep[at] = 1;
      stack.push([from, at], [at, to]);
    }
  }
  return line.filter((_, i) => keep[i]);
}

const areaOf = (ring) => Math.abs(ring.reduce((sum, [x, y], i) => sum + x * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * y, 0)) / 2;

const comarques = [];
for (const member of gml.split('<wfs:member>').slice(1)) {
  const name = /NOMCOMAR>([^<]+)</.exec(member)?.[1];
  if (!name) throw new Error('A comarca without a name');
  const rings = [];
  // The outer line of each piece; a hole in a comarca would not be seen at this size.
  for (const [, list] of member.matchAll(/<gml:exterior><gml:LinearRing><gml:posList>([^<]+)</g)) {
    const numbers = list.trim().split(/\s+/).map(Number);
    const ring = [];
    for (let i = 0; i < numbers.length; i += 2) ring.push([numbers[i], numbers[i + 1]]);
    if (areaOf(ring) < SMALLEST_KM2 * 1e6) continue;
    // A closed line is thinned as two open ones, cut at its first point and at the one furthest from it.
    const closed = ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring.slice(0, -1) : ring;
    let far = 0;
    closed.forEach(([x, y], i) => {
      if (Math.hypot(x - closed[0][0], y - closed[0][1]) > Math.hypot(closed[far][0] - closed[0][0], closed[far][1] - closed[0][1])) far = i;
    });
    const thin = [...thinned(closed.slice(0, far + 1), TOLERANCE_M).slice(0, -1), ...thinned([...closed.slice(far), closed[0]], TOLERANCE_M).slice(0, -1)];
    rings.push(thin.flatMap(([x, y]) => [Math.round(x / GRAIN_M) * GRAIN_M, Math.round(y / GRAIN_M) * GRAIN_M]));
  }
  if (!rings.length) throw new Error(`${name} has no outline`);
  comarques.push({ name, rings });
}
comarques.sort((a, b) => a.name.localeCompare(b.name, 'ca'));

const out = new URL('../src/content/comarques.json', import.meta.url);
await writeFile(out, `${JSON.stringify({ source: SOURCE, accessed: new Date().toISOString().slice(0, 10), crs: 'EPSG:25831', comarques })}\n`);
console.log(`${comarques.length} comarques, ${comarques.reduce((n, c) => n + c.rings.length, 0)} outlines, ${comarques.reduce((n, c) => n + c.rings.reduce((m, r) => m + r.length / 2, 0), 0)} points`);
