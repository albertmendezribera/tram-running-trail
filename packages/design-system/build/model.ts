/**
 * Shared types for the TRAM token pipeline.
 *
 * Source format: DTCG 2025.10 (https://www.designtokens.org/tr/2025.10/format/),
 * restricted to the token types TRAM uses today. Adding a type means adding a
 * parser in load.ts and an emitter in every target.
 */

export const SUPPORTED_TYPES = ['color', 'dimension', 'fontFamily', 'fontWeight', 'number'] as const;
export type TokenType = (typeof SUPPORTED_TYPES)[number];

export const LAYERS = ['ref', 'sys', 'comp'] as const;
export type Layer = (typeof LAYERS)[number];

/** Normalised sRGB colour. `hex` is always derived from `components`. */
export interface ColorValue {
  colorSpace: 'srgb';
  components: [number, number, number];
  alpha: number;
  hex: string;
}

export interface DimensionValue {
  value: number;
  unit: 'px' | 'rem';
  /** Size at the narrowest viewport. `value` is then the size at the widest one. */
  fluidMin?: DimensionValue;
}

export type Literal =
  | { type: 'color'; value: ColorValue }
  | { type: 'dimension'; value: DimensionValue }
  | { type: 'fontFamily'; value: string[] }
  | { type: 'fontWeight'; value: number }
  | { type: 'number'; value: number };

export interface TokenDef {
  /** Dotted id without `$root` segments, e.g. `sys.text.muted`. */
  id: string;
  layer: Layer;
  /** Undefined only on mode overrides, which inherit the base token's type. */
  type: TokenType | undefined;
  alias: string | undefined;
  literal: Literal | undefined;
  description: string | undefined;
  file: string;
}

export interface ModifierContext {
  colorScheme: 'light' | 'dark' | undefined;
  sources: string[];
}

export interface Modifier {
  name: string;
  attribute: string;
  default: string;
  /**
   * `light-dark`: the modifier only changes colours and is applied through the
   * CSS `color-scheme` property + `light-dark()`. Nesting works at any depth.
   * `attribute`: the modifier re-declares the affected tokens on `[attr="ctx"]`.
   */
  strategy: 'light-dark' | 'attribute';
  contexts: Record<string, ModifierContext>;
}

export interface ContrastRule {
  fg: string;
  bg: string;
  min: number;
  level: 'error' | 'warn';
  note: string | undefined;
}

export interface Manifest {
  sources: string[];
  modifiers: Modifier[];
  contrast: ContrastRule[];
}

export interface TokenSet {
  manifest: Manifest;
  /** Base definitions (default context of every modifier), in source order. */
  base: Map<string, TokenDef>;
  /** modifier → context → token id → override. */
  overrides: Map<string, Map<string, Map<string, TokenDef>>>;
}

/** modifier name → context name */
export type Selection = Record<string, string>;

export interface Diagnostic {
  file: string;
  token: string | undefined;
  message: string;
}

export class Diagnostics {
  readonly errors: Diagnostic[] = [];
  readonly warnings: Diagnostic[] = [];
  readonly #seen = new Set<string>();

  error(file: string, token: string | undefined, message: string): void {
    this.#push(this.errors, { file, token, message });
  }

  warn(file: string, token: string | undefined, message: string): void {
    this.#push(this.warnings, { file, token, message });
  }

  #push(list: Diagnostic[], d: Diagnostic): void {
    const key = `${list === this.errors ? 'E' : 'W'}|${d.file}|${d.token ?? ''}|${d.message}`;
    if (this.#seen.has(key)) return;
    this.#seen.add(key);
    list.push(d);
  }
}

export function formatDiagnostic(d: Diagnostic): string {
  return `${d.file}${d.token ? ` → ${d.token}` : ''}: ${d.message}`;
}
