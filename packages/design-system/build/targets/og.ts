import type { TokenSet } from '../model.ts';
import { Resolver } from '../resolve.ts';
import { GENERATED_NOTICE, matrix, modifierNamed, nest, px, sysName, sysIds, toSource, unionType } from './shared.ts';

/**
 * Style values for build-time Open Graph images (E14), per theme × terrain:
 * colours as hex strings and spacing in px, the units Satori and SVG→PNG
 * renderers expect. Density is fixed to its default: an OG image has one layout.
 */
export function emitOg(set: TokenSet): string {
  const r = new Resolver(set);
  const colorIds = sysIds(set, 'color');
  const spaceIds = sysIds(set, 'dimension');
  const entries = matrix(set, ['theme', 'terrain']).map(({ keys, sel }) => ({
    keys,
    value: {
      color: Object.fromEntries(colorIds.map((id) => [sysName(id), r.color(id, sel).hex])),
      space: Object.fromEntries(spaceIds.map((id) => [sysName(id).replace(/^space-/, ''), px(r.dimension(id, sel))])),
    },
  }));
  const themes = Object.keys(modifierNamed(set, 'theme').contexts);
  const terrains = Object.keys(modifierNamed(set, 'terrain').contexts);
  const spaceNames = spaceIds.map((id) => sysName(id).replace(/^space-/, ''));
  return `// ${GENERATED_NOTICE}

export type TramOgTheme = ${unionType(themes)};
export type TramOgTerrain = ${unionType(terrains)};
export type TramOgColorName = ${unionType(colorIds.map(sysName))};
export type TramOgSpaceName = ${unionType(spaceNames)};

export interface TramOgStyle {
  readonly color: Record<TramOgColorName, string>;
  /** Pixels. */
  readonly space: Record<TramOgSpaceName, number>;
}

export const tramOg: Record<TramOgTheme, Record<TramOgTerrain, TramOgStyle>> = ${toSource(nest(entries))};
`;
}
