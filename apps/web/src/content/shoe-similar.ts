// The shoes most like each shoe of the catalogue, on its own ground and on the other: for whoever is
// happy with one and looks for its like. The rule is in `similar-keys`; here it is fed with the catalogue.
import { type CatalogShoe, catalogShoes } from './shoe-catalog';
import { traitsOf } from './shoe-traits';
import { comparable, type Ground, type Likeness, type Match, similarTo, type Usual, usualOf } from './similar-keys';
import { noteOf } from './similar-words';

/** How many shoes a list offers: the few most alike, not a ranking of the whole catalogue. */
export const SIMILAR_MOST = 5;

type Entry = Likeness & { entry: CatalogShoe };

/** What the rule reads of a shoe: its figures, and what its maker says of its support and its use. */
export const likenessOf = (shoe: CatalogShoe): Likeness => ({
  terrain: shoe.terrain,
  weightG: shoe.weightG,
  stackHeelMm: shoe.stackHeelMm,
  stackForefootMm: shoe.stackForefootMm,
  dropMm: shoe.dropMm,
  lugDepthMm: shoe.lugDepthMm,
  plate: shoe.plate,
  support: traitsOf(shoe)?.support ?? null,
  use: traitsOf(shoe)?.use ?? [],
});

let built: { entries: Map<CatalogShoe, Entry>; usual: Usual } | undefined;
const all = (): NonNullable<typeof built> => {
  built ??= (() => {
    const entries = new Map(catalogShoes().map((shoe) => [shoe, { ...likenessOf(shoe), entry: shoe }]));
    return { entries, usual: usualOf([...entries.values()]) };
  })();
  return built;
};

/** What is usual on each ground of the catalogue: what weights and heights are compared against, across grounds. */
export const catalogUsual = (): Usual => all().usual;

export interface Alike {
  shoe: CatalogShoe;
  closeness: Match<unknown>['closeness'];
  /** Why it is offered, in a line. */
  note: string;
}

export interface Similar {
  /** Whether the shoe states enough to look for others like it. */
  comparable: boolean;
  road: Alike[];
  trail: Alike[];
}

export function similarOf(shoe: CatalogShoe): Similar {
  const { entries, usual } = all();
  const mine = entries.get(shoe);
  if (!mine || !comparable(mine)) return { comparable: false, road: [], trail: [] };
  const of = (ground: Ground): Alike[] =>
    similarTo(mine, [...entries.values()], ground, usual, SIMILAR_MOST).map((match) => ({ shoe: match.shoe.entry, closeness: match.closeness, note: noteOf(match, ground !== shoe.terrain, match.shoe.support) }));
  return { comparable: true, road: of('road'), trail: of('trail') };
}
