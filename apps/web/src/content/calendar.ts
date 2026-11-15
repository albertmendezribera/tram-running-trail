// The races of the calendar (Phase 2, E19): read from where each is published by
// `scripts/import-calendar.mjs`. Each keeps the calendars it was read from, with a link to each.
// They have no route yet: a race gets its flight and its profile when its organiser gives the track.
import data from './calendar.json';
import { SHOWS_PLACEHOLDERS, type Terrain } from './index';

export interface CalendarSource {
  name: string;
  url: string;
  /** On what terms it is published, in words, for the page. */
  terms: string;
}

export interface CalendarRace {
  slug: string;
  name: string;
  /** ISO date of the start. */
  date: string;
  /** The municipality, as the open list of municipalities of Catalonia writes it; or as the source does, when it is not one of them. */
  town: string | null;
  comarca: string | null;
  /** The province, where a source gives nothing finer. */
  region?: string;
  /** What is underfoot, where a source says it. */
  terrain: Terrain | null;
  /** Postponed or cancelled, where the source says so. */
  status?: 'postponed' | 'cancelled';
  /** Every distance the source gives, in metres. Empty when it gives none: never estimated. */
  distancesM: number[];
  organiser: string | null;
  /** The race's own website. */
  website: string | null;
  sources: Array<{ id: string; url: string }>;
}

export const CALENDAR_SOURCES = data.sources as Record<string, CalendarSource>;
export const CALENDAR_ACCESSED = data.accessed;
export const PLACES_SOURCE = data.places as CalendarSource;
const ALL = data.races as CalendarRace[];

/** Calendars published under an open licence. A race read only from the others waits for their permission to reach production. */
const OPEN = new Set(['bcn']);
export const isOpen = (race: CalendarRace): boolean => race.sources.some((source) => OPEN.has(source.id));

/** Staging shows every race; a production build only those an open source gives (docs/revisio-legal.md). */
export const calendarRaces = (): CalendarRace[] => ALL.filter((race) => SHOWS_PLACEHOLDERS || isOpen(race));

/**
 * The day a page is built: what parts the races to come from those already run. A build can be given
 * its day (`TRAM_TODAY`), so the captures the tests compare do not change from one day to the next.
 */
export const buildDay = (): string => process.env['TRAM_TODAY'] ?? new Date().toISOString().slice(0, 10);

/** Where a race is, in words: town and comarca, or what little a source says. */
export const placeOf = (race: CalendarRace): string | null =>
  race.town ? (race.comarca && race.comarca !== race.town ? `${race.town}, ${race.comarca}` : race.town) : race.region ? `Província de ${race.region.replace(/^lerida$/i, 'Lleida').replace(/^./, (c) => c.toUpperCase())}` : null;

export const sourcesOf = (race: CalendarRace): Array<CalendarSource & { link: string }> => race.sources.map((source) => ({ ...CALENDAR_SOURCES[source.id]!, link: source.url }));
