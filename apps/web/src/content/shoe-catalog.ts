// The catalogue of shoes (Phase 3): each model with what its maker states on its own website, read
// there on the day `accessed` says, and nothing else. No figure is measured by a lab, copied from a
// comparison site or recalled: what a maker's page does not say is null and is shown as absent
// (CLAUDE.md 0; docs/revisio-legal.md 4). The two shoes of Phase 1, measured in a lab, are in `shoes.ts`.
import type { Plate, ShoeSpecs } from '@tram/shoe-geometry';
import { SHOWS_PLACEHOLDERS } from './index';
import data from './shoe-catalog.json';

export interface CatalogShoe {
  slug: string;
  brand: { slug: string; name: string };
  model: string;
  /** What the maker sells it for. */
  terrain: 'road' | 'trail';
  weightG: number | null;
  /** The size weighed and, when the maker states the weight in ounces, the figure as it wrote it. */
  weightRef: string | null;
  stackHeelMm: number | null;
  stackForefootMm: number | null;
  dropMm: number | null;
  lugDepthMm: number | null;
  /** Null when the page does not say whether there is one. */
  plate: Plate | null;
  midsole: string | null;
  outsole: string | null;
  /** The maker's own page for the model: where every figure of the entry was read. */
  url: string;
  /** What the page says that fits no field, or says against itself, in its own words: a height with no place named, two figures that do not agree. */
  note: string | null;
  /** The day the page was read. */
  accessed: string;
}

export const CATALOG_ACCESSED = data.accessed;
const ALL = data.shoes as CatalogShoe[];

/**
 * Brand names are text only and their use waits for legal review, as for the shoes of Phase 1: until
 * it is cleared the catalogue is on the test environment and in no production build.
 */
export const catalogShoes = (): CatalogShoe[] => (SHOWS_PLACEHOLDERS ? ALL : []);
export const catalogName = (shoe: CatalogShoe): string => `${shoe.brand.name} ${shoe.model}`;
export const catalogPath = (shoe: CatalogShoe): string => `/ca/sabatilles/${shoe.brand.slug}/${shoe.slug}/`;

/** The nominal inside length of the size the profiles are drawn at (US 9 for men, 27 cm): no maker states the inside length. */
const NOMINAL_LENGTH_MM = 270;

/**
 * What the profile of a shoe can be drawn from, when its maker states both heights: those two and, where
 * stated, the plate and the lugs. Everything else is drawn neutral and said to be, as for any shoe.
 * Null when a height is missing: the shoe is listed without a drawing rather than with a guessed one.
 */
export const drawable = (shoe: CatalogShoe): ShoeSpecs | null =>
  shoe.stackHeelMm === null || shoe.stackForefootMm === null
    ? null
    : {
        lengthMm: NOMINAL_LENGTH_MM,
        stackHeelMm: shoe.stackHeelMm,
        stackForefootMm: shoe.stackForefootMm,
        outsoleThicknessMm: null,
        insoleThicknessMm: null,
        plate: shoe.plate ?? 'none',
        lugDepthMm: shoe.lugDepthMm,
        rockerApexPct: null,
        toeSpringDeg: null,
        heelBevelDeg: null,
        toeboxHeightMm: null,
      };

export const CATALOG_NOTICE = 'Versió de proves. Les xifres del catàleg són les que cada marca declara al seu web, sense mesurar; els noms de marca hi surten només com a text i el seu ús està pendent de revisió legal.';
