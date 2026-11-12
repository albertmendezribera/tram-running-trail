import { srgbToLinear } from '../color.ts';
import type { TokenSet } from '../model.ts';
import { defaultSelection, Resolver } from '../resolve.ts';
import { GENERATED_NOTICE, matrix, modifierNamed, nest, px, sysName, sysIds, toSource, unionType } from './shared.ts';

const round = (n: number): number => Number(n.toFixed(5));

/**
 * Colour constants for Three.js and TSL, per theme × terrain.
 *
 * Each colour carries:
 * - `hex`: sRGB integer for `new Color(hex)` (Three converts it to its linear
 *   working space when ColorManagement is enabled, the default since r152).
 * - `srgb`: sRGB components, 0–1.
 * - `linear`: linear-sRGB components, for uniforms/attributes that bypass Color
 *   (`new Color().setRGB(...linear, LinearSRGBColorSpace)`).
 */
export function emitThree(set: TokenSet): string {
  const r = new Resolver(set);
  const ids = sysIds(set, 'color');
  const entries = matrix(set, ['theme', 'terrain']).map(({ keys, sel }) => ({
    keys,
    value: Object.fromEntries(
      ids.map((id) => {
        const c = r.color(id, sel);
        return [
          sysName(id),
          {
            hex: `0x${c.hex.slice(1)}`,
            srgb: c.components.map(round),
            linear: c.components.map((v) => round(srgbToLinear(Math.round(v * 255) / 255))),
          },
        ];
      }),
    ),
  }));
  const defaults = defaultSelection(set);
  const lineIds = sysIds(set, 'dimension').filter((id) => id.startsWith('sys.line.'));
  const motionIds = [...set.base.values()].filter((d) => d.layer === 'sys' && d.type === 'duration').map((d) => d.id);
  const themes = Object.keys(modifierNamed(set, 'theme').contexts);
  const terrains = Object.keys(modifierNamed(set, 'terrain').contexts);
  // Hex integers are emitted as strings by toSource; unquote them.
  const body = toSource(nest(entries)).replace(/"(0x[0-9a-f]{6})"/g, '$1');
  return `// ${GENERATED_NOTICE}

export type TramTheme = ${unionType(themes)};
export type TramTerrain = ${unionType(terrains)};
export type TramColorName = ${unionType(ids.map(sysName))};

export interface TramThreeColor {
  readonly hex: number;
  readonly srgb: readonly [number, number, number];
  readonly linear: readonly [number, number, number];
}

export const tramThreeColors: Record<TramTheme, Record<TramTerrain, Record<TramColorName, TramThreeColor>>> = ${body};

/** Line weights in CSS pixels: a contour, a table rule and a route are one family. */
export const tramThreeLines = ${toSource(Object.fromEntries(lineIds.map((id) => [id.slice('sys.line.'.length), px(r.dimension(id, defaults))])))} as const;

/** Durations in milliseconds. A scene checks \`prefers-reduced-motion\` itself: these are the full values. */
export const tramThreeMotion = ${toSource(Object.fromEntries(motionIds.map((id) => [id.slice('sys.motion.'.length), r.duration(id, defaults)])))} as const;
`;
}
