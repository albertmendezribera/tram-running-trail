// What each maker says a shoe is for and what support it gives, read on its own website, a file to a
// maker (`shoe-traits/<maker>.json`). Like the rest of the catalogue: only what the maker's page states,
// each answer with the maker's own words beside it, and a page that does not say is no answer.
import type { CatalogShoe } from './shoe-catalog';
import type { Support, Use } from './similar-keys';

export interface ShoeTraits {
  /** Neutral or stability, when the maker's page says which. */
  support: Support | null;
  /** The maker's own word for it. */
  supportSaid: string | null;
  /** What the page says the shoe is for. Empty when it does not say. */
  use: Use[];
  /** The maker's own words that back the use. */
  useSaid: string | null;
  /** The distances the page names for the shoe, in its own words. */
  distanceSaid: string | null;
  /** What needs saying about the reading, in a sentence. */
  note: string | null;
}

interface TraitsFile {
  maker: string;
  /** The day the maker's pages were read. */
  accessed: string;
  method: 'plain' | 'browser';
  shoes: Record<string, ShoeTraits>;
}

const files = Object.values(import.meta.glob<TraitsFile>('./shoe-traits/*.json', { eager: true, import: 'default' }));
const byMaker = new Map(files.map((file) => [file.maker, file]));

/** What the maker says a shoe is for, or nothing when its pages have not been read for it. */
export const traitsOf = (shoe: CatalogShoe): ShoeTraits | undefined => byMaker.get(shoe.brand.slug)?.shoes[shoe.slug];
/** The day the traits of a shoe were read on its maker's website. */
export const traitsAccessed = (shoe: CatalogShoe): string | undefined => byMaker.get(shoe.brand.slug)?.accessed;

export const SUPPORT_LABEL: Record<Support, string> = { neutral: 'Neutra', stability: 'Amb suport' };
export const USE_LABEL: Record<Use, string> = { race: 'Competició', tempo: 'Ritme', daily: 'Dia a dia', long: 'Tirada llarga', ultra: 'Ultra' };
export const USES: readonly Use[] = ['race', 'tempo', 'daily', 'long', 'ultra'];
