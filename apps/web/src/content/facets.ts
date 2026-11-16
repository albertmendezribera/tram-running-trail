// The calendar by facet (CLAUDE.md 3 and 8.3): a page for each kind of race, each comarca, each kind in a
// comarca, each named distance and each distance in a year — but only where there are races to list.
// Nothing is made by hand: every page here follows from what the races of the calendar are.
import { formatMeasure } from '@tram/formats';
import { type CalendarRace, calendarRaces } from './calendar';
import { DISTANCES, distancesIn, FACET_MIN_RACES, inComarca, slugOf, TYPES, typeOf } from './facet-keys';

export interface Facet {
  /** Its address under `/ca/curses/`, without slashes at the ends: `trail/baix-emporda`. */
  path: string;
  kind: 'type' | 'comarca' | 'type-comarca' | 'distance' | 'distance-year';
  /** What the facet is one of, over its title. */
  kicker: string;
  title: string;
  /** A few words for a link to it, where the kind of facet is already said. */
  label: string;
  /** How a race comes to be on the page, in a sentence: the rule, said to the reader. */
  rule: string;
  races: CalendarRace[];
  /** The comarca the page is about, to mark it on the map. */
  comarca?: string;
}

const km = (metres: number): string => formatMeasure(metres / 1000, 'km', 'ca');
const TYPE_RULE = 'El tipus és el que diu la font de cada prova. Les proves de les quals cap font diu el terreny no surten en aquesta pàgina.';
const COMARCA_RULE = 'La comarca és la del municipi de cada prova. Les proves de les quals la font no diu el municipi, o en diu un que no hem reconegut, no surten en aquesta pàgina.';

let built: Facet[] | undefined;

/** Every facet with races enough to be a page. */
export function facets(): Facet[] {
  if (built) return built;
  const races = calendarRaces();
  const found: Facet[] = [];
  const comarques = [...new Set(races.map((race) => race.comarca).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b, 'ca'));
  const years = [...new Set(races.map((race) => race.date.slice(0, 4)))].sort();

  for (const type of TYPES) {
    const ofType = races.filter((race) => typeOf(race) === type.key);
    found.push({ path: type.slug, kind: 'type', kicker: 'Calendari · Tipus', title: type.title, label: type.label, rule: TYPE_RULE, races: ofType });
    for (const comarca of comarques) {
      found.push({
        path: `${type.slug}/${slugOf(comarca)}`,
        kind: 'type-comarca',
        kicker: `Calendari · ${type.label} · Comarca`,
        title: `${type.title} ${inComarca(comarca)}`,
        label: comarca,
        rule: `${TYPE_RULE} ${COMARCA_RULE}`,
        races: ofType.filter((race) => race.comarca === comarca),
        comarca,
      });
    }
  }
  for (const comarca of comarques) {
    found.push({ path: slugOf(comarca), kind: 'comarca', kicker: 'Calendari · Comarca', title: `Curses ${inComarca(comarca)}`, label: comarca, rule: COMARCA_RULE, races: races.filter((race) => race.comarca === comarca), comarca });
  }
  for (const distance of DISTANCES) {
    const ofDistance = races.filter((race) => distancesIn(race.distancesM).includes(distance.slug));
    const edges = Number.isFinite(distance.toM) ? `d’entre ${km(distance.fromM)} i ${km(distance.toM)}` : `de més de ${km(distance.fromM - 1)}`;
    const rule = `Hi són les proves que, segons la seva font, tenen una distància ${edges}, siguin d’asfalt o de muntanya. Les proves sense cap distància a la font no surten en aquesta pàgina.`;
    found.push({ path: distance.slug, kind: 'distance', kicker: 'Calendari · Distància', title: distance.title, label: distance.label, rule, races: ofDistance });
    for (const year of years) {
      found.push({ path: `${distance.slug}/${year}`, kind: 'distance-year', kicker: `Calendari · ${distance.label} · Any`, title: `${distance.title} del ${year}`, label: year, rule, races: ofDistance.filter((race) => race.date.startsWith(year)) });
    }
  }

  built = found.filter((facet) => facet.races.length >= FACET_MIN_RACES);
  // A facet and a race share the first step of their addresses: no race may be called as a facet is.
  const taken = new Set(built.map((facet) => facet.path.split('/')[0]));
  const clash = races.find((race) => taken.has(race.slug));
  if (clash) throw new Error(`The race «${clash.slug}» has the address of a facet of the calendar`);
  return built;
}

export const hrefOf = (facet: Facet): string => `/ca/curses/${facet.path}/`;

/** The facets a race is listed in, the plainest first: its kind, its comarca, its distances. */
export function facetsOf(race: CalendarRace): Facet[] {
  const order: Array<Facet['kind']> = ['type', 'comarca', 'type-comarca', 'distance'];
  return facets()
    .filter((facet) => order.includes(facet.kind) && facet.races.includes(race))
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

/** Where a facet leads on to: the same races cut finer, or the cut beside it. Each group has a heading. */
export function onwardFrom(facet: Facet): Array<{ title: string; links: Facet[] }> {
  const every = facets();
  const [head, tail] = facet.path.split('/');
  const under = (kind: Facet['kind'], first: string): Facet[] => every.filter((other) => other.kind === kind && other.path.startsWith(`${first}/`));
  const groups: Array<{ title: string; links: Facet[] }> = [];
  if (facet.kind === 'type') groups.push({ title: 'Per comarca', links: under('type-comarca', head!) });
  if (facet.kind === 'distance') groups.push({ title: 'Per any', links: under('distance-year', head!) });
  if (facet.kind === 'comarca') groups.push({ title: 'Per tipus', links: every.filter((other) => other.kind === 'type-comarca' && other.path.endsWith(`/${head}`)).map((other) => ({ ...other, label: TYPES.find((type) => other.path.startsWith(`${type.slug}/`))!.label })) });
  // A link out of a crossing says in full where it leads: its own title, not a word of it.
  const whole = (path: string | undefined, label?: string): Facet[] => every.filter((other) => other.path === path).map((other) => ({ ...other, label: label ?? other.title }));
  if (facet.kind === 'type-comarca') groups.push({ title: 'Amplia la llista', links: [...whole(head, `${TYPES.find((type) => type.slug === head)!.title} a tot Catalunya`), ...whole(tail)] });
  if (facet.kind === 'distance-year') groups.push({ title: 'Altres anys', links: [...under('distance-year', head!).filter((other) => other.path !== facet.path), ...whole(head, 'Tots els anys')] });
  return groups.filter((group) => group.links.length > 0);
}

/** The doors into the facets from the calendar itself: by kind, by distance and by comarca. */
export const facetDoors = (): Array<{ title: string; links: Facet[] }> =>
  [
    { title: 'Per tipus', links: facets().filter((facet) => facet.kind === 'type') },
    { title: 'Per distància', links: facets().filter((facet) => facet.kind === 'distance') },
    { title: 'Per comarca', links: facets().filter((facet) => facet.kind === 'comarca') },
  ].filter((group) => group.links.length > 0);
