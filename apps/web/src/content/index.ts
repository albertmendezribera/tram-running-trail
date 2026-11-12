// The content of the site while it lives in files (Phase 1). The shapes follow
// the database schema (supabase/migrations), so moving to Supabase changes this
// file and nothing else.
import { type ProfilePoint, summarize } from '@tram/design-system/patterns/elevation.ts';
import type { Plate } from '@tram/design-system/patterns/route-plate.ts';
import { CALONGE, SILS } from './profiles';
import calongePlate from './routes/calonge/plate.json';
import silsPlate from './routes/sils/plate.json';

export type Terrain = 'road' | 'trail' | 'mixed';

export interface Route {
  slug: string;
  name: string;
  place: string;
  /** Kilometre and elevation, from the GPX: distance and elevation only. */
  profile: readonly ProfilePoint[];
  /** The route on its contour lines, built by `@tram/terrain-pipeline` (`plate-cli`). */
  plate: Plate;
  source: 'gpx' | 'organizer' | 'editorial';
  /** Where the track comes from, in words, for the page. */
  credit: string;
  isPlaceholder: boolean;
}

export interface Course {
  name: string;
  distanceM: number;
  /** Null when unknown: never estimated. */
  elevationGainM: number | null;
  route: string;
}

export interface Race {
  slug: string;
  name: string;
  terrain: Terrain;
  countryCode: string;
  region: string;
  place: string;
  organizer: string | null;
  source: 'organizer' | 'federation' | 'editorial';
  isPlaceholder: boolean;
  edition: { year: number; startDate: string; status: 'scheduled' | 'cancelled' | 'postponed' | 'finished'; registrationUrl: string | null; bib: number };
  courses: Course[];
}

const GPX_CREDIT = 'Recorregut: GPX d’una sortida real. Només se’n publiquen la distància, l’altitud i el traçat.';

export const ROUTES: Route[] = [
  { slug: 'calonge', name: 'Calonge', place: 'Calonge, Baix Empordà', profile: CALONGE, plate: calongePlate as unknown as Plate, source: 'gpx', credit: GPX_CREDIT, isPlaceholder: false },
  { slug: 'sils', name: 'Sils', place: 'Sils, la Selva', profile: SILS, plate: silsPlate as unknown as Plate, source: 'gpx', credit: GPX_CREDIT, isPlaceholder: false },
];

// The figures of a course come from its track, never typed by hand.
function courseOf(name: string, route: string, profile: readonly ProfilePoint[]): Course {
  const summary = summarize(profile);
  return { name, distanceM: Math.round(summary.distanceKm * 1000), elevationGainM: Math.round(summary.gainM), route };
}

// Sample races: the routes are real, but no race is run on them. They exist to
// build the race page, are marked as placeholders and never reach production.
export const RACES: Race[] = [
  {
    slug: 'cursa-de-mostra-calonge',
    name: 'Cursa de mostra de Calonge',
    terrain: 'trail',
    countryCode: 'ES',
    region: 'Girona',
    place: 'Calonge, Baix Empordà',
    organizer: null,
    source: 'editorial',
    isPlaceholder: true,
    edition: { year: 2027, startDate: '2027-03-14', status: 'scheduled', registrationUrl: null, bib: 1427 },
    courses: [courseOf('12 km', 'calonge', CALONGE)],
  },
  {
    slug: 'cursa-de-mostra-sils',
    name: 'Cursa de mostra de Sils',
    terrain: 'road',
    countryCode: 'ES',
    region: 'Girona',
    place: 'Sils, la Selva',
    organizer: null,
    source: 'editorial',
    isPlaceholder: true,
    edition: { year: 2027, startDate: '2027-04-11', status: 'scheduled', registrationUrl: null, bib: 208 },
    courses: [courseOf('10 km', 'sils', SILS)],
  },
];

/** Staging and development show placeholders; a production build never does (CLAUDE.md 0). */
export const SHOWS_PLACEHOLDERS = import.meta.env.DEV || process.env['TRAM_DS'] === '1';
export const visible = <T extends { isPlaceholder: boolean }>(items: readonly T[]): T[] => items.filter((item) => SHOWS_PLACEHOLDERS || !item.isPlaceholder);
export const routeOf = (slug: string): Route => {
  const route = ROUTES.find((r) => r.slug === slug);
  if (!route) throw new Error(`no route "${slug}"`);
  return route;
};

export const ICGC_CREDIT = 'Ortofoto i model d’elevacions: © Institut Cartogràfic i Geològic de Catalunya (ICGC), CC BY 4.0';
export const DEM_CREDIT = 'Model d’elevacions: © Institut Cartogràfic i Geològic de Catalunya (ICGC), CC BY 4.0';
export const SAMPLE_NOTICE = 'Cursa de mostra: el recorregut és real, però el nom, la data i el dorsal són inventats per provar la pàgina.';
