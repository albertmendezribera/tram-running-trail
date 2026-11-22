// What each maker says of the width of its shoes, read on its own website, a file to a maker
// (`shoe-fit/<maker>.json`). Like the rest of the catalogue: only what the maker's page states, and a
// model whose page could not be read has no answer, which is not the same as «one width only».
import type { CatalogShoe } from './shoe-catalog';

export interface ShoeFit {
  /** The width versions the maker offers besides the regular one, named as it names them. Empty when the page offers one width; null when it could not be told. */
  widths: string[] | null;
  /** Where the wider version is, when it is not on the model's own page: its own page, or the maker's list of wide shoes. */
  widthsUrl: string | null;
  /** The maker's own words, on the model's page, for a toe box it calls wide or roomy. */
  toeBox: string | null;
  /** What needs saying about the reading, in a sentence. */
  note: string | null;
}

interface FitFile {
  maker: string;
  /** The day the maker's pages were read. */
  accessed: string;
  method: 'plain' | 'browser';
  shoes: Record<string, ShoeFit>;
}

const files = Object.values(import.meta.glob<FitFile>('./shoe-fit/*.json', { eager: true, import: 'default' }));
const byMaker = new Map(files.map((file) => [file.maker, file]));

/** What the maker says of the width of a shoe, or nothing when its pages have not been read for it. */
export const fitOf = (shoe: CatalogShoe): ShoeFit | undefined => byMaker.get(shoe.brand.slug)?.shoes[shoe.slug];
/** The day the width of a shoe was read on its maker's website. */
export const fitAccessed = (shoe: CatalogShoe): string | undefined => byMaker.get(shoe.brand.slug)?.accessed;
