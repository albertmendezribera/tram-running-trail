// What OpenStreetMap names along a route that the ICGC's map does not: bars, restaurants, shops, a pharmacy,
// a sculpture on the promenade. © OpenStreetMap contributors, ODbL.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const OSM_ATTRIBUTION = 'Comerços i llocs d’interès: © col·laboradors d’OpenStreetMap, ODbL';
/** The servers that answer Overpass queries; any of them may be busy. */
const SERVERS = ['https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass-api.de/api/interpreter'];

/** The kinds of place kept, by the tag that says what each is. Anything else with a name is left out. */
const KINDS: Record<string, readonly string[]> = {
  amenity: ['restaurant', 'bar', 'cafe', 'pub', 'ice_cream', 'fast_food', 'pharmacy', 'bank', 'library', 'theatre', 'cinema', 'townhall', 'police', 'post_office', 'fuel', 'marketplace', 'hospital', 'clinic', 'school', 'place_of_worship', 'community_centre', 'arts_centre'],
  shop: ['*'],
  tourism: ['hotel', 'hostel', 'guest_house', 'museum', 'artwork', 'viewpoint', 'camp_site', 'attraction', 'gallery'],
  historic: ['monument', 'memorial', 'castle', 'ruins', 'archaeological_site', 'tower', 'church', 'building'],
  leisure: ['park', 'sports_centre', 'marina', 'bird_hide', 'stadium'],
  man_made: ['lighthouse', 'tower', 'windmill'],
};

export interface OsmPlace {
  name: string;
  /** What it is, as OpenStreetMap tags it: "restaurant", "shop", "artwork"… */
  kind: string;
  lat: number;
  lon: number;
}

/** What a set of tags is, or null when it is none of the kinds kept. */
export function osmKind(tags: Record<string, string>): string | null {
  for (const [key, values] of Object.entries(KINDS)) {
    const value = tags[key];
    if (!value) continue;
    if (values.includes('*')) return ['supermarket', 'bakery', 'bicycle', 'sports'].includes(value) ? value : key;
    if (values.includes(value)) return value;
  }
  return null;
}

/** Named places of the kinds kept inside a box of degrees. Kept on disk: the servers are often busy. */
export async function fetchOsmPlaces(box: { south: number; west: number; north: number; east: number }, cache: string): Promise<OsmPlace[]> {
  mkdirSync(cache, { recursive: true });
  const bbox = [box.south, box.west, box.north, box.east].map((v) => v.toFixed(5)).join(',');
  const file = join(cache, `osm-${bbox}.json`);
  let json: { elements: Array<{ lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> } | undefined;
  if (existsSync(file)) json = JSON.parse(readFileSync(file, 'utf8'));
  const query = `[out:json][timeout:60];(${Object.keys(KINDS).map((key) => `nwr["name"]["${key}"](${bbox});`).join('')});out center tags;`;
  for (let attempt = 0; !json && attempt < SERVERS.length * 3; attempt++) {
    const response = await fetch(SERVERS[attempt % SERVERS.length]!, { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'route-world/0.1' }, signal: AbortSignal.timeout(90_000) }).catch(() => null);
    if (response?.ok) {
      const text = await response.text();
      if (text.startsWith('{')) {
        json = JSON.parse(text);
        writeFileSync(file, text);
      }
    }
    if (!json) await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  if (!json) throw new Error('OpenStreetMap: no Overpass server answered');
  const places: OsmPlace[] = [];
  for (const element of json.elements) {
    const [lat, lon] = [element.lat ?? element.center?.lat, element.lon ?? element.center?.lon];
    const kind = osmKind(element.tags ?? {});
    const name = element.tags?.['name']?.trim();
    if (lat === undefined || lon === undefined || !kind || !name) continue;
    places.push({ name, kind, lat, lon });
  }
  return places;
}
