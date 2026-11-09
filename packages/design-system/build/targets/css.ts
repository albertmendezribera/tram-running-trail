import type { Literal, Modifier, Selection, TokenSet } from '../model.ts';
import { attributeDependencies, defaultSelection, effectiveDef } from '../resolve.ts';
import { GENERATED_NOTICE } from './shared.ts';

export const cssName = (id: string): string => `--tram-${id.replaceAll('.', '-')}`;

const trim = (n: number): string => String(Number(n.toFixed(4)));

function literalCss(lit: Literal): string {
  if (lit.type === 'color') {
    const { components, alpha, hex } = lit.value;
    if (alpha >= 1) return hex;
    const [r, g, b] = components.map((c) => Math.round(c * 255));
    return `rgb(${r} ${g} ${b} / ${trim(alpha)})`;
  }
  const { value, unit } = lit.value;
  // Spacing is authored on a 4 px grid but shipped in rem, so it follows the
  // reader's font-size setting. Targets that need pixels (ECharts, OG) get px.
  return unit === 'px' ? `${trim(value / 16)}rem` : `${trim(value)}rem`;
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
  // `color-scheme: light dark` lets the OS preference pick the theme when no
  // data-theme is set.
  blocks.push(
    block(':root', [
      ...(theme ? ['color-scheme: light dark;'] : []),
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

  return `/* ${GENERATED_NOTICE} */\n\n@layer tram.tokens {\n${blocks.join('\n\n')}\n}\n`;
}
