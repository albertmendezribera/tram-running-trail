// What the facets of the calendar are made of (CLAUDE.md 8.3): the words of their addresses, and what
// makes a race one of a kind. Nothing here reads the calendar, so the rules can be tested on their own.
import { searchText } from './search-text.ts';

/** A name as a part of an address: «Pla de l'Estany» is `pla-de-l-estany`. */
export const slugOf = (text: string): string => searchText(text).replace(/ /g, '-');

export type TypeKey = 'road' | 'trail' | 'mixed' | 'march';

/** The kinds of race a source tells apart. A race whose source says nothing of its ground is of none of them. */
export const TYPES: ReadonlyArray<{ key: TypeKey; slug: string; title: string; label: string }> = [
  { key: 'road', slug: 'asfalt', title: 'Curses d’asfalt', label: 'Asfalt' },
  { key: 'trail', slug: 'trail', title: 'Curses de muntanya', label: 'Muntanya' },
  { key: 'mixed', slug: 'cros', title: 'Curses de cros', label: 'Cros' },
  { key: 'march', slug: 'marxes', title: 'Marxes i caminades', label: 'Marxes' },
];

/** A race is what its source calls it: a march, or a race on a ground the source names. */
export const typeOf = (race: { kind?: 'march' | undefined; terrain: 'road' | 'trail' | 'mixed' | null }): TypeKey | 'unknown' => (race.kind === 'march' ? 'march' : (race.terrain ?? 'unknown'));

/**
 * The distances people look a race up by. Edges in metres, both inside: a ten-kilometre race is one a
 * source gives between 9,9 and 10,1 km, and so on. `km` are the edges as the page says them.
 */
export const DISTANCES: ReadonlyArray<{ slug: string; title: string; label: string; fromM: number; toM: number }> = [
  { slug: '5-km', title: 'Curses de 5 km', label: '5 km', fromM: 4900, toM: 5100 },
  { slug: '10-km', title: 'Curses de 10 km', label: '10 km', fromM: 9900, toM: 10100 },
  { slug: 'mitja-marato', title: 'Mitges maratons', label: 'Mitja marató', fromM: 21000, toM: 21200 },
  { slug: 'marato', title: 'Maratons', label: 'Marató', fromM: 42000, toM: 42400 },
  { slug: 'ultra', title: 'Ultres', label: 'Ultra', fromM: 42401, toM: Infinity },
];

/** The distances of the list above a race has: one for each of its own that falls in one. */
export const distancesIn = (distancesM: readonly number[]): string[] => DISTANCES.filter((d) => distancesM.some((m) => m >= d.fromM && m <= d.toM)).map((d) => d.slug);

// The article each comarca takes, as the ICGC writes their names. Osona takes none.
const ARTICLE: Record<string, 'el' | 'la' | 'l’' | 'les' | ''> = {
  'Alt Camp': 'l’',
  'Alt Empordà': 'l’',
  'Alt Penedès': 'l’',
  'Alt Urgell': 'l’',
  'Alta Ribagorça': 'l’',
  Anoia: 'l’',
  // The list of municipalities calls the Val d'Aran so.
  Aran: 'l’',
  Bages: 'el',
  'Baix Camp': 'el',
  'Baix Ebre': 'el',
  'Baix Empordà': 'el',
  'Baix Llobregat': 'el',
  'Baix Penedès': 'el',
  Barcelonès: 'el',
  Berguedà: 'el',
  Cerdanya: 'la',
  'Conca de Barberà': 'la',
  Garraf: 'el',
  Garrigues: 'les',
  Garrotxa: 'la',
  Gironès: 'el',
  Lluçanès: 'el',
  Maresme: 'el',
  Moianès: 'el',
  Montsià: 'el',
  Noguera: 'la',
  Osona: '',
  'Pallars Jussà': 'el',
  'Pallars Sobirà': 'el',
  'Pla d\'Urgell': 'el',
  'Pla de l\'Estany': 'el',
  Priorat: 'el',
  'Ribera d\'Ebre': 'la',
  Ripollès: 'el',
  Segarra: 'la',
  Segrià: 'el',
  Selva: 'la',
  Solsonès: 'el',
  Tarragonès: 'el',
  'Terra Alta': 'la',
  Urgell: 'l’',
  'Val d\'Aran': 'la',
  'Vallès Occidental': 'el',
  'Vallès Oriental': 'el',
};

/** «al Baix Empordà», «a l’Alt Camp», «a la Selva», «a les Garrigues», «a Osona». A comarca not in the list is an error, not a guess. */
export function inComarca(name: string): string {
  const article = ARTICLE[name];
  if (article === undefined) throw new Error(`No article known for the comarca «${name}»`);
  return article === 'el' ? `al ${name}` : article === 'l’' ? `a l’${name}` : article ? `a ${article} ${name}` : `a ${name}`;
}

/** Fewer races than this make no page: a list of one is the page of that race. */
export const FACET_MIN_RACES = 2;
