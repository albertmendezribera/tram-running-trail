import type { Literal, TokenSet } from '../model.ts';
import { defaultSelection, Resolver } from '../resolve.ts';
import { GENERATED_NOTICE, modifierNamed, px } from './shared.ts';

/** A value as a person reads it: `160 ms`, `13–14 px`, `#17191c`. */
function readable(lit: Literal): string {
  switch (lit.type) {
    case 'color':
      return lit.value.hex;
    case 'dimension':
      return lit.value.fluidMin ? `${px(lit.value.fluidMin)}–${px(lit.value)} px` : `${px(lit.value)} px`;
    case 'fontFamily':
      return lit.value[0]!;
    case 'fontWeight':
    case 'number':
      return String(lit.value);
    case 'duration':
      return `${lit.value} ms`;
    case 'cubicBezier':
      return lit.value.join(', ');
  }
}

/**
 * Every system token with its resolved value and its description, for the
 * catalogue: the foundations pages are written from here, so they cannot fall
 * out of step with the tokens (CLAUDE.md 6.7).
 */
export function emitCatalog(set: TokenSet): string {
  const r = new Resolver(set);
  const sel = defaultSelection(set);
  const theme = modifierNamed(set, 'theme');
  const dark = Object.entries(theme.contexts).find(([, c]) => c.colorScheme === 'dark')?.[0];
  const tokens = [...set.base.values()]
    .filter((d) => d.layer === 'sys')
    .map((d) => {
      const lit = r.resolve(d.id, sel)!;
      const value = readable(lit);
      const night = dark && lit.type === 'color' ? readable(r.resolve(d.id, { ...sel, [theme.name]: dark })!) : undefined;
      return {
        id: d.id,
        css: `--tram-${d.id.replaceAll('.', '-')}`,
        type: lit.type,
        value,
        ...(night && night !== value ? { night } : {}),
        ...(d.description ? { description: d.description } : {}),
      };
    });
  return `// ${GENERATED_NOTICE}

export interface TramToken {
  /** Dotted id, e.g. \`sys.text.muted\`. */
  readonly id: string;
  /** The CSS custom property. */
  readonly css: string;
  readonly type: ${[...new Set(tokens.map((t) => JSON.stringify(t.type)))].join(' | ')};
  /** Resolved value in the default modes, written to be read. */
  readonly value: string;
  /** The value in the night theme, when it differs. */
  readonly night?: string;
  readonly description?: string;
}

export const tramTokens: readonly TramToken[] = ${JSON.stringify(tokens, null, 2)};
`;
}
