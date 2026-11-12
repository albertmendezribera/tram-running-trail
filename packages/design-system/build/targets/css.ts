import type { Literal, Modifier, Selection, TokenSet } from '../model.ts';
import { attributeDependencies, defaultSelection, effectiveDef, TYPE_ROLE_PARTS, typeRoles } from '../resolve.ts';
import { cssFontFamily, GENERATED_NOTICE, px } from './shared.ts';

export const cssName = (id: string): string => `--tram-${id.replaceAll('.', '-')}`;

const trim = (n: number): string => String(Number(n.toFixed(4)));

// Fluid sizes interpolate between the two reference viewports (CLAUDE.md 0).
const FLUID_VIEWPORT = { min: 390, max: 1440 };

const rem = (pixels: number): string => `${trim(pixels / 16)}rem`;

function fluid(minPx: number, maxPx: number): string {
  const slope = (maxPx - minPx) / (FLUID_VIEWPORT.max - FLUID_VIEWPORT.min);
  const intercept = minPx - slope * FLUID_VIEWPORT.min;
  return `clamp(${rem(minPx)}, ${rem(intercept)} + ${trim(slope * 100)}vw, ${rem(maxPx)})`;
}

function literalCss(lit: Literal): string {
  switch (lit.type) {
    case 'color': {
      const { components, alpha, hex } = lit.value;
      if (alpha >= 1) return hex;
      const [r, g, b] = components.map((c) => Math.round(c * 255));
      return `rgb(${r} ${g} ${b} / ${trim(alpha)})`;
    }
    case 'dimension':
      // Authored in px on a 4 px grid but shipped in rem, so sizes follow the
      // reader's font-size setting. Targets that need pixels (ECharts, OG) get px.
      return lit.value.fluidMin ? fluid(px(lit.value.fluidMin), px(lit.value)) : rem(px(lit.value));
    case 'fontFamily':
      return cssFontFamily(lit.value);
    case 'fontWeight':
    case 'number':
      return trim(lit.value);
  }
}

function expr(set: TokenSet, id: string, sel: Selection): string {
  const def = effectiveDef(set, id, sel)!;
  if (def.literal) return literalCss(def.literal);
  return `var(${cssName(def.alias!)})`;
}

/**
 * Expression for `id` with every modifier fixed by `sel` except the
 * light-dark one, which is folded into `light-dark(light, dark)`.
 */
function themedExpr(set: TokenSet, id: string, sel: Selection, theme: Modifier | undefined): string {
  if (!theme) return expr(set, id, sel);
  const ctx = (scheme: 'light' | 'dark'): string =>
    Object.entries(theme.contexts).find(([, c]) => c.colorScheme === scheme)![0];
  const light = expr(set, id, { ...sel, [theme.name]: ctx('light') });
  const dark = expr(set, id, { ...sel, [theme.name]: ctx('dark') });
  return light === dark ? light : `light-dark(${light}, ${dark})`;
}

const block = (selector: string, lines: string[]): string =>
  `  ${selector} {\n${lines.map((l) => `    ${l}`).join('\n')}\n  }`;

export function emitCss(set: TokenSet): string {
  const theme = set.manifest.modifiers.find((m) => m.strategy === 'light-dark');
  const defaults = defaultSelection(set);
  const ids = [...set.base.keys()];
  const blocks: string[] = [];

  // Base: every token with the default context of each attribute modifier.
  // The default theme applies until the page sets data-theme: a phone in dark
  // mode does not switch TRAM to night by itself (people read night as 'all black').
  blocks.push(
    block(':root', [
      ...(theme ? [`color-scheme: ${theme.contexts[theme.default]!.colorScheme};`] : []),
      ...ids.map((id) => `${cssName(id)}: ${themedExpr(set, id, defaults, theme)};`),
    ]),
  );

  // Theme: only flips color-scheme. Every themed colour is a light-dark()
  // expression, resolved where it is used, so themes nest at any depth.
  if (theme) {
    for (const [ctxName, ctx] of Object.entries(theme.contexts)) {
      blocks.push(block(`[${theme.attribute}="${ctxName}"]`, [`color-scheme: ${ctx.colorScheme};`]));
    }
  }

  // Attribute modifiers: re-declare every token that depends on the modifier
  // (including tokens that only alias an affected token), for every context,
  // the default one included, so a nested default resets correctly.
  const deps = attributeDependencies(set);
  for (const m of set.manifest.modifiers.filter((mod) => mod.strategy === 'attribute')) {
    const affected = ids.filter((id) => deps.get(id)?.has(m.name));
    if (affected.length === 0) continue;
    for (const ctxName of Object.keys(m.contexts)) {
      const sel = { ...defaults, [m.name]: ctxName };
      blocks.push(
        block(
          `[${m.attribute}="${ctxName}"]`,
          affected.map((id) => `${cssName(id)}: ${themedExpr(set, id, sel, theme)};`),
        ),
      );
    }
  }

  return `/* ${GENERATED_NOTICE} */\n\n@layer tram.tokens {\n${blocks.join('\n\n')}\n}\n${typeLayer(set)}`;
}

/** Data roles align in columns; display figures keep their natural widths (E08). */
function numericFor(role: string): string {
  if (role.startsWith('data-')) return 'tabular-nums lining-nums';
  if (role.startsWith('display-')) return 'proportional-nums lining-nums';
  return 'normal';
}

/** `[data-type="<role>"]` applies a whole typographic role. */
function typeLayer(set: TokenSet): string {
  const roles = typeRoles(set);
  if (roles.length === 0) return '';
  const part = (role: string, name: keyof typeof TYPE_ROLE_PARTS): string => `var(${cssName(`sys.type.${role}.${name}`)})`;
  const blocks = roles.map((role) =>
    block(`[data-type="${role}"]`, [
      `font-family: ${part(role, 'family')};`,
      `font-size: ${part(role, 'size')};`,
      `font-weight: ${part(role, 'weight')};`,
      `line-height: ${part(role, 'leading')};`,
      `letter-spacing: calc(${part(role, 'tracking')} * 1em);`,
      `font-variant-numeric: ${numericFor(role)};`,
    ]),
  );
  blocks.push(block('[data-numeric="tabular"]', ['font-variant-numeric: tabular-nums lining-nums;']));
  return `\n@layer tram.type {\n${blocks.join('\n\n')}\n}\n`;
}
