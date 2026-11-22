// What somebody may be looking for in a shoe, and the rule that says whether a shoe answers it. No
// imports and no data here, so that the rules can be tested alone. Every rule reads only what a maker
// states; the thresholds are ours, and each page says so.

export type Ground = 'road' | 'trail';

/** The figures of a shoe a rule may read: what its maker states, null where it states nothing. */
export interface Figures {
  terrain: Ground;
  weightG: number | null;
  stackHeelMm: number | null;
  dropMm: number | null;
  lugDepthMm: number | null;
  plate: string | null;
}

/** What a maker's own page says of the width of a model. */
export interface Fit {
  /** The width versions offered besides the regular one, as the maker names them. Empty: one width only. Null: it could not be told. */
  widths: readonly string[] | null;
  /** The maker's own words for a toe box it calls wide or roomy. Null when it claims nothing of the kind. */
  toeBox: string | null;
}

/** Grams at or under which a shoe is listed as light: a road shoe and a mountain one are not weighed against each other. */
export const LIGHT_G: Record<Ground, number> = { road: 230, trail: 270 };
/** Millimetres under the heel from which a shoe is listed as much cushioned. */
export const CUSHION_MM: Record<Ground, number> = { road: 40, trail: 35 };
export const LOW_DROP_MM = 4;
export const DEEP_LUG_MM = 5;

/** Sold in a wider version as well. */
export const hasWideVersion = (fit: Fit | undefined): boolean => Boolean(fit?.widths && fit.widths.length > 0);
/** Described by its maker with a wide toe box. */
export const hasWideToeBox = (fit: Fit | undefined): boolean => Boolean(fit?.toeBox);
export const isWide = (fit: Fit | undefined): boolean => hasWideVersion(fit) || hasWideToeBox(fit);
/** Whether its width could be read at all: a shoe that was not read is counted apart, never as narrow. */
export const widthRead = (fit: Fit | undefined): boolean => fit !== undefined && (fit.widths !== null || fit.toeBox !== null);

export const isLight = (shoe: Figures): boolean => shoe.weightG !== null && shoe.weightG <= LIGHT_G[shoe.terrain];
export const isCushioned = (shoe: Figures): boolean => shoe.stackHeelMm !== null && shoe.stackHeelMm >= CUSHION_MM[shoe.terrain];
export const isLowDrop = (shoe: Figures): boolean => shoe.dropMm !== null && shoe.dropMm <= LOW_DROP_MM;
/** A page that says «no plate» is an answer too: only a plate that is there counts. */
export const hasPlate = (shoe: Figures): boolean => shoe.plate !== null && shoe.plate !== 'none';
export const hasDeepLugs = (shoe: Figures): boolean => shoe.terrain === 'trail' && shoe.lugDepthMm !== null && shoe.lugDepthMm >= DEEP_LUG_MM;
