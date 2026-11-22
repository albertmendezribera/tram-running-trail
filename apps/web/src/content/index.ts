// The content of the site while it lives in files (Phase 1). The shapes follow
// the database schema (supabase/migrations), so moving to Supabase changes this
// file and nothing else.
import { type ProfilePoint, summarize } from '@tram/design-system/patterns/elevation.ts';
import type { Plate } from '@tram/design-system/patterns/route-plate.ts';
import { CALONGE, PALAMOS, RIERA_DE_SANTA_COLOMA, SILS } from './profiles';
import calongePlate from './routes/calonge/plate.json';
import palamosPlate from './routes/palamos/plate.json';
import rieraPlate from './routes/riera-de-santa-coloma/plate.json';
import silsPlate from './routes/sils/plate.json';

export type Terrain = 'road' | 'trail' | 'mixed';

/**
 * A route that can be run on foot inside a 3D model of its town: «Palamós a peu». The model is a program
 * of its own (a Godot web export built in another repository, `palamos-open-world`), not kept in this
 * one: `scripts/sync-palamos-world.sh` copies it into the site where it is at hand, and a build without
 * it says so on the page. What is said of it here is what its own pipeline counts (its README).
 */
export interface OnFoot {
  /** The page it is played on. */
  href: string;
  /** Where the site serves the program, with the slash at the end. */
  program: string;
  /** The `source` of the messages the program posts to the page that frames it. */
  channel: string;
  /** What a visitor downloads to play, in MB: the total the sync script prints. Told before anything is asked for. */
  weightMb: number;
  /** Kilometres of the route, the figure the game's own screen gives: the length of the recorded track. */
  routeKm: number;
  /** Houses raised from their plan to the height the LiDAR gives each. */
  houses: number;
  /** Tree crowns the LiDAR finds outside the houses. */
  trees: number;
  /** The years of the LiDAR flight. */
  lidarYears: string;
  /** Mesh of the elevation model the ground is made of, in metres. */
  demM: number;
  /** Seconds per kilometre the runner of the game runs the route at: a setting of the game, not the pace of the outing. */
  paceS: number;
  /** Signs hung on the houses with the name OpenStreetMap gives each shop, bar, hotel or named building. */
  signs: number;
  /** Places whose name floats over them and is seen from afar: churches, the lighthouse, museums, sculptures, viewpoints. */
  landmarks: number;
  /** Where a visitor who walks freely starts. */
  start: string;
  /** What its poster shows (a capture taken inside the game), in words. */
  posterAlt: string;
}

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
  /** What the outing was, when it is known: said on the page of the route. */
  origin?: string;
  /**
   * Seconds the watch was recording, pauses left out (`scripts/gpx-time.mjs`): what the time and the
   * average pace of the page come from. Only where whoever ran it has said it may be told; absent otherwise.
   */
  timeS?: number;
  /** Present when the route can be run on foot inside its town in 3D. */
  onFoot?: OnFoot;
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
  /** What of the page is not real, said on the page itself, when it is a placeholder. */
  notice?: string;
  edition: { year: number; startDate: string; status: 'scheduled' | 'cancelled' | 'postponed' | 'finished'; registrationUrl: string | null; bib: number };
  courses: Course[];
}

const GPX_CREDIT = 'Recorregut: GPX d’una sortida real. Se’n publiquen el traçat, la distància, l’altitud i el temps total amb el ritme mitjà; ni el dia, ni l’hora, ni les pulsacions.';

/** «A peu» is on trial: shown in development and in the test environment, like the sample data, and left out of a production build. */
const ON_FOOT_SHOWN = import.meta.env.DEV || process.env['TRAM_DS'] === '1';

export const ROUTES: Route[] = [
  { slug: 'calonge', name: 'Calonge', place: 'Calonge, Baix Empordà', profile: CALONGE, plate: calongePlate as unknown as Plate, source: 'gpx', credit: GPX_CREDIT, origin: 'Gravada a la Marxa de les Tines.', timeS: 4995, isPlaceholder: false },
  {
    slug: 'palamos',
    name: 'Palamós',
    place: 'Palamós, Baix Empordà',
    profile: PALAMOS,
    plate: palamosPlate as unknown as Plate,
    source: 'gpx',
    credit: GPX_CREDIT,
    timeS: 3533,
    // Only where the site is tried out (the test environment and a developer's machine), until it is decided that it goes to production.
    ...(ON_FOOT_SHOWN && {
      onFoot: {
        href: '/ca/rutes/palamos/a-peu/',
        program: '/mon/palamos/',
        channel: 'tram-palamos',
        weightMb: 52,
        routeKm: 10.2,
        houses: 5441,
        trees: 11917,
        lidarYears: '2021-2023',
        demM: 5,
        paceS: 300,
        signs: 329,
        landmarks: 41,
        start: 'Passeig del Mar',
        posterAlt: 'Vista aèria del Palamós en 3D: la platja Gran, el passeig amb les seves fileres d’arbres i les cases del poble',
      },
    }),
    isPlaceholder: false,
  },
  {
    slug: 'riera-de-santa-coloma',
    name: 'Riera de Santa Coloma',
    place: 'Sils, la Selva',
    profile: RIERA_DE_SANTA_COLOMA,
    plate: rieraPlate as unknown as Plate,
    source: 'gpx',
    credit: GPX_CREDIT,
    origin: 'Anada i tornada des de Sils: per l’estany de Sils fins a la riera de Santa Coloma.',
    timeS: 4282,
    isPlaceholder: false,
  },
  { slug: 'sils', name: 'Sils', place: 'Sils, la Selva', profile: SILS, plate: silsPlate as unknown as Plate, source: 'gpx', credit: GPX_CREDIT, origin: 'Gravada en un entrenament suau: «Easy Run Sils 10k».', timeS: 3527, isPlaceholder: false },
];

// The figures of a course come from its track, never typed by hand.
function courseOf(name: string, route: string, profile: readonly ProfilePoint[]): Course {
  const summary = summarize(profile);
  return { name, distanceM: Math.round(summary.distanceKm * 1000), elevationGainM: Math.round(summary.gainM), route };
}

// A sample race: its route is real, and so is its name (the march the track was recorded at), but its
// date and bib are not. It exists to build the race page, is marked as a placeholder and never reaches
// production. The run at Sils was a training run, not a race: it is a route and nothing else.
export const RACES: Race[] = [
  {
    slug: 'marxa-de-les-tines',
    // The name of the march the track was recorded at. Its date, organiser and bib are not known here: those of the page are samples.
    name: 'Marxa de les Tines',
    notice: 'Versió de proves: el recorregut és el d’una sortida real a la Marxa de les Tines, però la data, el dorsal i la resta de dades de cursa d’aquesta pàgina són de mostra, no les de la marxa.',
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
/** What the view from the ground adds, and how much of it is data. */
export const WORLD_NOTE =
  'A peu: edificis, vials pavimentats i topònims del mapa de l’ICGC; cada casa amb les seves plantes i el seu ús, del Cadastre (© Dirección General del Catastro, consultat el novembre de 2026), amb l’alçada comptada a tres metres per planta; bars, comerços i escultures, d’OpenStreetMap (© col·laboradors d’OpenStreetMap, ODbL); arbres segons el LiDAR de l’ICGC i el mapa de cobertes del sòl i, als carrers, on l’ortofoto mostra copes, però cap és un arbre concret; el color del terra, del ferm, de la vegetació, de les teulades i del mar és el de l’ortofoto; les terrasses dels blocs, segons l’any del Cadastre; textures, façanes, color de les parets, matolls, herba i pedres, de decoració.';
/** What a town to walk in 3D is made of: the two sources of «Palamós a peu», as each asks to be named. */
export const ON_FOOT_ICGC_CREDIT = 'Relleu, LiDAR i ortofoto: © Institut Cartogràfic i Geològic de Catalunya (ICGC), CC BY 4.0';
export const OSM_CREDIT = 'Carrers, plantes dels edificis i noms: © col·laboradors d’OpenStreetMap, ODbL';
export const DEM_CREDIT = 'Model d’elevacions: © Institut Cartogràfic i Geològic de Catalunya (ICGC), CC BY 4.0';
export const SAMPLE_NOTICE = 'Cursa de mostra: el recorregut és real, però el nom, la data i el dorsal són inventats per provar la pàgina.';
