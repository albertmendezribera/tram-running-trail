// The two shoes of Phase 1. Every figure names its source; what no source gives is
// null and is shown as absent (CLAUDE.md 0). The shapes follow `shoes` and
// `shoe_specs` in supabase/migrations.
import type { ShoeSpecs } from '@tram/shoe-geometry';
import { SHOWS_PLACEHOLDERS, type Terrain } from './index';

/** Day the sources were read. */
export const ACCESSED = '2026-11-12';

export interface Source {
  id: string;
  /** Who publishes it. */
  name: string;
  /** What kind of source it is, for the reader. */
  kind: 'manufacturer' | 'lab' | 'review';
  url: string;
}

export interface Score {
  source: string;
  /** The score as the source gives it, on the source's own scale. */
  value: number;
  scale: 10 | 100;
  /** Day the review was published or last updated, as its page says. */
  reviewed: string;
  /** What must be known to read the score fairly. */
  note: string | null;
}

/** A figure and where it comes from. */
export interface Figure {
  value: number | null;
  source: string | null;
  /** The size or condition the figure refers to, when the source states it. */
  ref?: string;
}

export interface Shoe {
  slug: string;
  brand: { slug: string; name: string };
  model: string;
  terrain: Terrain;
  category: 'race' | 'technical';
  /** Not confirmed on a source read for this file: left empty rather than recalled. */
  releaseDate: string | null;
  isPlaceholder: boolean;
  /** Brand names are used as text only, with no logos: their use is pending legal review (CLAUDE.md 8.2). */
  legalReview: 'pending' | 'cleared';
  /** One sentence, from the figures: no opinion. */
  summary: string;
  midsole: string;
  outsole: string | null;
  /** Lab measures the profile is drawn from (`shoe_specs`). */
  specs: ShoeSpecs & { sizeRef: string; weightG: number; widthForefootMm: number; widthHeelMm: number; source: 'lab' | 'manufacturer' | 'mixed'; measuredBy: string };
  /** What the manufacturer states. */
  official: { weightG: Figure; stackHeelMm: Figure; stackForefootMm: Figure; dropMm: Figure; lugDepthMm: Figure };
  sources: Source[];
  scores: Score[];
}

export const SHOES: Shoe[] = [
  {
    slug: 'vaporfly-4',
    brand: { slug: 'nike', name: 'Nike' },
    model: 'Vaporfly 4',
    terrain: 'road',
    category: 'race',
    releaseDate: null,
    isPlaceholder: false,
    legalReview: 'pending',
    summary: 'Sabatilla de competició d’asfalt amb placa de carboni de tota la llargada i escuma ZoomX.',
    midsole: 'ZoomX',
    outsole: null,
    specs: {
      sizeRef: 'US 9 home',
      // The source gives no inside length for this shoe: the nominal length of the size (27 cm) is used.
      lengthMm: 270,
      weightG: 166,
      stackHeelMm: 34.1,
      stackForefootMm: 25.5,
      outsoleThicknessMm: 2.3,
      insoleThicknessMm: 2.9,
      plate: 'carbon',
      lugDepthMm: null,
      rockerApexPct: null,
      toeSpringDeg: null,
      heelBevelDeg: null,
      toeboxHeightMm: 27.3,
      widthForefootMm: 110.6,
      widthHeelMm: 77,
      source: 'lab',
      measuredBy: 'runrepeat',
    },
    official: {
      weightG: { value: 190, source: 'nike', ref: 'US 10 home' },
      // Nike's product page read for this file states the drop but not the stacks: these are the brand's figures as RunRepeat quotes them.
      stackHeelMm: { value: 35, source: 'runrepeat', ref: 'xifra de la marca citada pel laboratori' },
      stackForefootMm: { value: 29, source: 'runrepeat', ref: 'xifra de la marca citada pel laboratori' },
      dropMm: { value: 6, source: 'nike' },
      lugDepthMm: { value: null, source: null },
    },
    sources: [
      { id: 'nike', name: 'Nike', kind: 'manufacturer', url: 'https://www.nike.com/t/vaporfly-4-mens-road-racing-shoes-HK05JWOf' },
      { id: 'runrepeat', name: 'RunRepeat', kind: 'lab', url: 'https://runrepeat.com/nike-vaporfly-4' },
      { id: 'outdoorgearlab', name: 'OutdoorGearLab', kind: 'review', url: 'https://www.outdoorgearlab.com/reviews/shoes-and-boots/running-shoes-womens/nike-vaporfly-4-womens' },
      { id: 'runningshoesguru', name: 'Running Shoes Guru', kind: 'review', url: 'https://www.runningshoesguru.com/reviews/road/nike-zoomx-vaporfly-4-review/' },
    ],
    scores: [
      { source: 'runrepeat', value: 93, scale: 100, reviewed: '2026-02-16', note: null },
      { source: 'outdoorgearlab', value: 69, scale: 100, reviewed: '2025-06-16', note: 'Prova del model de dona.' },
      { source: 'runningshoesguru', value: 8, scale: 10, reviewed: '2025-03-11', note: null },
    ],
  },
  {
    slug: 'speedgoat-6',
    brand: { slug: 'hoka', name: 'Hoka' },
    model: 'Speedgoat 6',
    terrain: 'trail',
    category: 'technical',
    releaseDate: null,
    isPlaceholder: false,
    legalReview: 'pending',
    summary: 'Sabatilla de muntanya sense placa, amb mitjasola d’EVA modelada per compressió i sola Vibram Megagrip amb tacs.',
    midsole: 'CMEVA',
    outsole: 'Vibram Megagrip',
    specs: {
      sizeRef: 'US 9 home',
      lengthMm: 270.4,
      weightG: 278,
      stackHeelMm: 32.1,
      stackForefootMm: 27.2,
      outsoleThicknessMm: 3.1,
      insoleThicknessMm: 4.3,
      plate: 'none',
      lugDepthMm: 4,
      rockerApexPct: null,
      toeSpringDeg: null,
      heelBevelDeg: null,
      toeboxHeightMm: 26.1,
      widthForefootMm: 117.7,
      widthHeelMm: 94.1,
      source: 'lab',
      measuredBy: 'runrepeat',
    },
    official: {
      weightG: { value: 278, source: 'hoka', ref: 'model d’home' },
      stackHeelMm: { value: 40, source: 'hoka', ref: 'model d’home' },
      stackForefootMm: { value: 35, source: 'hoka', ref: 'model d’home' },
      dropMm: { value: 5, source: 'hoka' },
      lugDepthMm: { value: 5, source: 'hoka' },
    },
    sources: [
      { id: 'hoka', name: 'Hoka', kind: 'manufacturer', url: 'https://www.hoka.com/en/us/mens-trail/speedgoat-6/1147791.html' },
      { id: 'runrepeat', name: 'RunRepeat', kind: 'lab', url: 'https://runrepeat.com/hoka-speedgoat-6' },
      { id: 'outdoorgearlab', name: 'OutdoorGearLab', kind: 'review', url: 'https://www.outdoorgearlab.com/reviews/shoes-and-boots/trail-running-shoes-men/hoka-speedgoat-6' },
      { id: 'runningshoesguru', name: 'Running Shoes Guru', kind: 'review', url: 'https://www.runningshoesguru.com/reviews/trail/hoka-speedgoat-6-review/' },
    ],
    scores: [
      { source: 'runrepeat', value: 84, scale: 100, reviewed: '2025-07-04', note: null },
      { source: 'outdoorgearlab', value: 74, scale: 100, reviewed: '2024-10-03', note: null },
      { source: 'runningshoesguru', value: 8, scale: 10, reviewed: '2024-11-07', note: null },
    ],
  },
];

export const shoeName = (shoe: Shoe): string => `${shoe.brand.name} ${shoe.model}`;
export const shoePath = (shoe: Shoe): string => `/ca/sabatilles/${shoe.brand.slug}/${shoe.slug}/`;
export const sourceOf = (shoe: Shoe, id: string): Source => {
  const source = shoe.sources.find((s) => s.id === id);
  if (!source) throw new Error(`${shoe.slug} has no source "${id}"`);
  return source;
};

/** Canonical comparison: the two models in alphabetical order of brand and model (CLAUDE.md 5). */
export const pairSlug = (a: Shoe, b: Shoe): string =>
  [a, b]
    .map((s) => `${s.brand.slug}-${s.slug}`)
    .sort()
    .join('-vs-');
export const PAIRS: Array<[Shoe, Shoe]> = SHOES.flatMap((a, i) => SHOES.slice(i + 1).map((b): [Shoe, Shoe] => (`${a.brand.slug}-${a.slug}` < `${b.brand.slug}-${b.slug}` ? [a, b] : [b, a])));

/** Staging shows every shoe; a production build only those that are real and cleared by legal review. */
export const visibleShoes = (): Shoe[] => SHOES.filter((s) => SHOWS_PLACEHOLDERS || (!s.isPlaceholder && s.legalReview === 'cleared'));
export const visiblePairs = (): Array<[Shoe, Shoe]> => PAIRS.filter(([a, b]) => visibleShoes().includes(a) && visibleShoes().includes(b));
export const SHOE_NOTICE = 'Versió de proves. Els noms de marca hi surten només com a text i el seu ús està pendent de revisió legal; les mesures de laboratori són de tercers i se’n cita la font.';
