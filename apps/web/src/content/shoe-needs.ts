// The catalogue by what somebody is looking for (a wide shoe, a light one, one with deep lugs): a page
// for each need, made from what the makers state and from a rule the page says in words. Nothing is
// written by hand: a shoe is on a page because its figures put it there.
import { formatMeasure } from '@tram/formats';
import { CUSHION_MM, DEEP_LUG_MM, hasDeepLugs, hasPlate, hasWideToeBox, hasWideVersion, isCushioned, isLight, isLowDrop, LIGHT_G, LOW_DROP_MM, widthRead } from './need-keys';
import { type CatalogShoe, catalogShoes } from './shoe-catalog';
import { fitOf } from './shoe-fit';

/** A need with fewer shoes than this is no page: a list of one answers nothing. */
export const NEED_MIN_SHOES = 2;

export interface NeedEntry {
  shoe: CatalogShoe;
  /** Why it is on the page, in a few words, next to its name. */
  reason: string | null;
}

export interface NeedGroup {
  /** Over its rows: what they share, or the order they come in. */
  title: string;
  entries: NeedEntry[];
}

export interface Need {
  /** Its address under `/ca/sabatilles/`. */
  slug: string;
  /** A few words for a link to it, under «Què busques?». */
  label: string;
  title: string;
  /** How a shoe comes to be on the page, said to the reader. */
  rule: string;
  /** What the page cannot say: the shoes it had no way to judge. */
  blind: string | null;
  groups: NeedGroup[];
  shoes: CatalogShoe[];
}

const g = (value: number): string => formatMeasure(value, 'g', 'ca');
const mm = (value: number): string => formatMeasure(value, 'mm', 'ca');
const list = (items: readonly string[]): string => new Intl.ListFormat('ca', { type: 'conjunction' }).format(items);
const OURS = 'El llindar l’hem posat nosaltres.';
const PLATES = { carbon: 'Placa de carboni', nylon: 'Placa de niló', pebax: 'Placa de Pebax', rock_plate: 'Placa de protecció' } as const;
const byName = (a: CatalogShoe, b: CatalogShoe): number => a.brand.name.localeCompare(b.brand.name, 'ca') || a.model.localeCompare(b.model, 'ca');
/** How many shoes a rule could not judge, and of how many makers, in words. */
const missing = (shoes: readonly CatalogShoe[], what: string): string | null =>
  shoes.length === 0 ? null : `${shoes.length} ${shoes.length === 1 ? 'model no hi pot sortir: la seva marca' : 'models no hi poden sortir: la seva marca'} no en declara ${what}.`;

/** The size a maker weighs, as the catalogue keeps it: said next to a weight, since no two makers weigh the same size. */
const weighed = (shoe: CatalogShoe): string | null => {
  const ref = shoe.weightRef?.split(';')[0]?.trim();
  if (!ref) return null;
  return ref.toLocaleLowerCase('ca').startsWith('pes') ? `${ref[0]!.toLocaleUpperCase('ca')}${ref.slice(1)}` : `Pes: ${ref}`;
};

let built: Need[] | undefined;

/** Every need with shoes enough to be a page. */
export function needs(): Need[] {
  if (built) return built;
  const all = catalogShoes();
  const make = (need: Omit<Need, 'shoes'>): Need => ({ ...need, groups: need.groups.filter((group) => group.entries.length > 0), shoes: need.groups.flatMap((group) => group.entries.map((entry) => entry.shoe)) });

  // Wide: a version sold wider, or a toe box the maker calls wide. The maker's own names and words are the reason.
  const wideReason = (shoe: CatalogShoe): string => {
    const fit = fitOf(shoe)!;
    return [fit.widths?.length ? `També en ${list(fit.widths)}` : null, fit.toeBox ? `«${fit.toeBox}»` : null].filter(Boolean).join(' · ');
  };
  const unread = all.filter((shoe) => !widthRead(fitOf(shoe)));
  const unreadMakers = [...new Set(unread.map((shoe) => shoe.brand.name))].sort((a, b) => a.localeCompare(b, 'ca'));

  const found = [
    make({
      slug: 'amples',
      label: 'Peu ample',
      title: 'Sabatilles per a peu ample',
      rule: 'Hi són els models que la seva marca ven també en una versió més ampla que la normal, i els que la marca descriu amb la puntera ampla o eixamplada, amb les seves paraules. Cap marca declara l’amplada en mil·límetres: aquesta pàgina no pot dir quin model és més ample que un altre, ni com et quedarà.',
      blind: unread.length ? `De ${unread.length} ${unread.length === 1 ? 'model' : 'models'} (${list(unreadMakers)}) no hem pogut llegir què en diu la marca: no vol dir que siguin estrets.` : null,
      groups: [
        { title: 'Amb una versió més ampla', entries: all.filter((shoe) => hasWideVersion(fitOf(shoe))).sort(byName).map((shoe) => ({ shoe, reason: wideReason(shoe) })) },
        {
          title: 'La marca en destaca l’espai a la puntera',
          entries: all.filter((shoe) => hasWideToeBox(fitOf(shoe)) && !hasWideVersion(fitOf(shoe))).sort(byName).map((shoe) => ({ shoe, reason: wideReason(shoe) })),
        },
      ],
    }),
    make({
      slug: 'lleugeres',
      label: 'Lleugera',
      title: 'Sabatilles lleugeres',
      rule: `Hi són els models que, segons la seva marca, pesen ${g(LIGHT_G.road)} o menys si són d’asfalt i ${g(LIGHT_G.trail)} o menys si són de muntanya. ${OURS} Cada marca pesa una talla diferent, i algunes no diuen quina: entre marques, uns grams amunt o avall no volen dir res.`,
      blind: missing(all.filter((shoe) => shoe.weightG === null), 'el pes'),
      groups: [
        {
          title: 'De la més lleugera a la més pesant',
          entries: all.filter(isLight).sort((a, b) => a.weightG! - b.weightG! || byName(a, b)).map((shoe) => ({ shoe, reason: weighed(shoe) })),
        },
      ],
    }),
    make({
      slug: 'molt-amortiment',
      label: 'Molt amortiment',
      title: 'Sabatilles amb molt amortiment',
      rule: `Hi són els models amb ${mm(CUSHION_MM.road)} o més d’alçada al taló si són d’asfalt i ${mm(CUSHION_MM.trail)} o més si són de muntanya, segons la seva marca. ${OURS} L’alçada diu quanta escuma hi ha, no com és de tova, i cada marca la mesura a la seva manera.`,
      blind: missing(all.filter((shoe) => shoe.stackHeelMm === null), 'l’alçada al taló'),
      groups: [
        {
          title: 'De més a menys alçada al taló',
          entries: all.filter(isCushioned).sort((a, b) => b.stackHeelMm! - a.stackHeelMm! || byName(a, b)).map((shoe) => ({ shoe, reason: `${mm(shoe.stackHeelMm!)} al taló` })),
        },
      ],
    }),
    make({
      slug: 'drop-baix',
      label: 'Drop baix',
      title: 'Sabatilles de drop baix',
      rule: `Hi són els models amb ${mm(LOW_DROP_MM)} de drop o menys, segons la seva marca: el taló gairebé a l’alçada de l’avantpeu. ${OURS}`,
      blind: missing(all.filter((shoe) => shoe.dropMm === null), 'el drop'),
      groups: [{ title: 'De menys a més drop', entries: all.filter(isLowDrop).sort((a, b) => a.dropMm! - b.dropMm! || byName(a, b)).map((shoe) => ({ shoe, reason: null })) }],
    }),
    make({
      slug: 'amb-placa',
      label: 'Amb placa',
      title: 'Sabatilles amb placa',
      rule: 'Hi són els models dels quals la marca diu que porten una placa dins la sola: de carboni o de niló, per córrer de pressa, o de protecció contra les pedres, a la muntanya.',
      blind: (() => {
        const silent = all.filter((shoe) => shoe.plate === null).length;
        return silent ? `De ${silent} models, la pàgina de la marca no diu si en porten.` : null;
      })(),
      groups: (Object.keys(PLATES) as (keyof typeof PLATES)[]).map((kind) => ({ title: PLATES[kind], entries: all.filter((shoe) => hasPlate(shoe) && shoe.plate === kind).sort(byName).map((shoe) => ({ shoe, reason: null })) })),
    }),
    make({
      slug: 'tacs-profunds',
      label: 'Tacs profunds',
      title: 'Sabatilles de muntanya amb tacs profunds',
      rule: `Hi són els models de muntanya amb tacs de ${mm(DEEP_LUG_MM)} o més, segons la seva marca: per a fang i terreny tou. ${OURS}`,
      blind: missing(all.filter((shoe) => shoe.terrain === 'trail' && shoe.lugDepthMm === null), 'la profunditat dels tacs'),
      groups: [
        { title: 'De més a menys tac', entries: all.filter(hasDeepLugs).sort((a, b) => b.lugDepthMm! - a.lugDepthMm! || byName(a, b)).map((shoe) => ({ shoe, reason: `Tacs de ${mm(shoe.lugDepthMm!)}` })) },
      ],
    }),
  ];
  built = found.filter((need) => need.shoes.length >= NEED_MIN_SHOES);
  return built;
}

export const needPath = (need: Need): string => `/ca/sabatilles/${need.slug}/`;
/** The needs a shoe answers: the pages it is on. */
export const needsOf = (shoe: CatalogShoe): Need[] => needs().filter((need) => need.shoes.includes(shoe));
