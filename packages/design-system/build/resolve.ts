import { contrastRatio } from './color.ts';
import type {
  ColorValue,
  Diagnostics,
  DimensionValue,
  Literal,
  Modifier,
  Selection,
  TokenDef,
  TokenSet,
} from './model.ts';

export function defaultSelection(set: TokenSet): Selection {
  return Object.fromEntries(set.manifest.modifiers.map((m) => [m.name, m.default]));
}

/** Every combination of modifier contexts (2 themes × 3 terrains × 2 densities = 12 today). */
export function allSelections(set: TokenSet): Selection[] {
  let out: Selection[] = [{}];
  for (const m of set.manifest.modifiers) {
    out = out.flatMap((sel) => Object.keys(m.contexts).map((ctx) => ({ ...sel, [m.name]: ctx })));
  }
  return out;
}

export const describeSelection = (sel: Selection): string =>
  Object.entries(sel)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');

/** The definition of `id` that applies under `sel`: a mode override if there is one, otherwise the base. */
export function effectiveDef(set: TokenSet, id: string, sel: Selection): TokenDef | undefined {
  for (const m of set.manifest.modifiers) {
    const ctx = sel[m.name] ?? m.default;
    const o = set.overrides.get(m.name)?.get(ctx)?.get(id);
    if (o) return o;
  }
  return set.base.get(id);
}

export class Resolver {
  readonly #set: TokenSet;
  readonly #cache = new Map<string, Literal | undefined>();

  constructor(set: TokenSet) {
    this.#set = set;
  }

  /** Resolves `id` to a literal under `sel`. Throws a CycleError on circular aliases. */
  resolve(id: string, sel: Selection, stack: string[] = []): Literal | undefined {
    const key = `${describeSelection(sel)}|${id}`;
    if (this.#cache.has(key)) return this.#cache.get(key);
    if (stack.includes(id)) throw new CycleError([...stack.slice(stack.indexOf(id)), id]);
    const def = effectiveDef(this.#set, id, sel);
    let out: Literal | undefined;
    if (def?.literal) out = def.literal;
    else if (def?.alias) out = this.resolve(def.alias, sel, [...stack, id]);
    this.#cache.set(key, out);
    return out;
  }

  color(id: string, sel: Selection): ColorValue {
    const lit = this.resolve(id, sel);
    if (lit?.type !== 'color') throw new Error(`${id} is not a colour token`);
    return lit.value;
  }

  dimension(id: string, sel: Selection): DimensionValue {
    const lit = this.resolve(id, sel);
    if (lit?.type !== 'dimension') throw new Error(`${id} is not a dimension token`);
    return lit.value;
  }

  fontFamily(id: string, sel: Selection): string[] {
    const lit = this.resolve(id, sel);
    if (lit?.type !== 'fontFamily') throw new Error(`${id} is not a fontFamily token`);
    return lit.value;
  }

  /** A duration token, in milliseconds. */
  duration(id: string, sel: Selection): number {
    const lit = this.resolve(id, sel);
    if (lit?.type !== 'duration') throw new Error(`${id} is not a duration token`);
    return lit.value;
  }

  cubicBezier(id: string, sel: Selection): [number, number, number, number] {
    const lit = this.resolve(id, sel);
    if (lit?.type !== 'cubicBezier') throw new Error(`${id} is not a cubicBezier token`);
    return lit.value;
  }

  /** The value of a fontWeight or number token. */
  scalar(id: string, sel: Selection): number {
    const lit = this.resolve(id, sel);
    if (lit?.type !== 'fontWeight' && lit?.type !== 'number') throw new Error(`${id} is not a fontWeight or number token`);
    return lit.value;
  }
}

export class CycleError extends Error {
  readonly chain: string[];
  constructor(chain: string[]) {
    super(`circular alias: ${chain.join(' → ')}`);
    this.chain = chain;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]!;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length]!;
}

function suggest(id: string, candidates: Iterable<string>): string {
  let best: string | undefined;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = levenshtein(id, c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best !== undefined && bestD <= Math.max(2, Math.floor(id.length / 4)) ? ` Did you mean {${best}}?` : '';
}

/** Every definition: base plus every override, tagged with the modifier that owns it. */
function allDefs(set: TokenSet): Array<{ def: TokenDef; modifier: Modifier | undefined; context: string | undefined }> {
  const out: Array<{ def: TokenDef; modifier: Modifier | undefined; context: string | undefined }> = [];
  for (const def of set.base.values()) out.push({ def, modifier: undefined, context: undefined });
  for (const m of set.manifest.modifiers) {
    for (const [context, defs] of set.overrides.get(m.name) ?? []) {
      for (const def of defs.values()) out.push({ def, modifier: m, context });
    }
  }
  return out;
}

/**
 * For each base token, the `attribute`-strategy modifiers it depends on, directly
 * (it is overridden) or through any alias it may take in any context.
 */
export function attributeDependencies(set: TokenSet): Map<string, Set<string>> {
  const attributeMods = set.manifest.modifiers.filter((m) => m.strategy === 'attribute');
  const targets = new Map<string, Set<string>>();
  const direct = new Map<string, Set<string>>();
  for (const { def, modifier } of allDefs(set)) {
    if (def.alias) {
      if (!targets.has(def.id)) targets.set(def.id, new Set());
      targets.get(def.id)!.add(def.alias);
    }
    if (modifier && attributeMods.includes(modifier)) {
      if (!direct.has(def.id)) direct.set(def.id, new Set());
      direct.get(def.id)!.add(modifier.name);
    }
  }
  const memo = new Map<string, Set<string>>();
  const visit = (id: string, stack: Set<string>): Set<string> => {
    const cached = memo.get(id);
    if (cached) return cached;
    const out = new Set(direct.get(id) ?? []);
    if (stack.has(id)) return out; // cycles are reported elsewhere
    stack.add(id);
    for (const t of targets.get(id) ?? []) for (const m of visit(t, stack)) out.add(m);
    stack.delete(id);
    memo.set(id, out);
    return out;
  };
  const result = new Map<string, Set<string>>();
  for (const id of set.base.keys()) result.set(id, visit(id, new Set()));
  return result;
}

/** The tokens a target reads by name, so that a missing one is a build error and not a crash. */
export interface TargetRequirements {
  target: string;
  color: readonly string[];
  dimension: readonly string[];
  fontFamily: readonly string[];
}

export function validateTargetRequirements(set: TokenSet, diags: Diagnostics, req: TargetRequirements): void {
  for (const type of ['color', 'dimension', 'fontFamily'] as const) {
    for (const id of req[type]) {
      const def = set.base.get(id);
      if (!def) {
        diags.error('modes.json', id, `required by the ${req.target} but not defined.${suggest(id, set.base.keys())}`);
      } else if (def.type !== type) {
        diags.error(def.file, id, `the ${req.target} needs a ${type} token, but this one is ${def.type}`);
      }
    }
  }
}

/** The tokens every typographic role (`sys.type.<role>.*`) has to define. */
export const TYPE_ROLE_PARTS = {
  family: 'fontFamily',
  size: 'dimension',
  weight: 'fontWeight',
  leading: 'number',
  tracking: 'number',
} as const;

export function typeRoles(set: TokenSet): string[] {
  const roles = new Set<string>();
  for (const id of set.base.keys()) {
    const m = /^sys\.type\.([^.]+)\./.exec(id);
    if (m) roles.add(m[1]!);
  }
  return [...roles];
}

export function validateTypeRoles(set: TokenSet, diags: Diagnostics): void {
  for (const role of typeRoles(set)) {
    for (const [part, type] of Object.entries(TYPE_ROLE_PARTS)) {
      const id = `sys.type.${role}.${part}`;
      const def = set.base.get(id);
      if (!def) diags.error('modes.json', id, `type role "${role}" needs a ${type} token "${part}"`);
      else if (def.type !== type) diags.error(def.file, id, `must be a ${type} token, but this one is ${def.type}`);
    }
  }
}

export function validate(set: TokenSet, diags: Diagnostics): void {
  const { base } = set;
  const overriddenBy = new Map<string, string>();

  for (const { def, modifier, context } of allDefs(set)) {
    const where = modifier ? ` (mode ${modifier.name}=${context})` : '';

    // Overrides must target an existing sys/comp token and inherit its type.
    if (modifier) {
      const target = base.get(def.id);
      if (!target) {
        diags.error(def.file, def.id, `mode override for a token that does not exist in the base files.${suggest(def.id, base.keys())}`);
        continue;
      }
      if (def.layer === 'ref') {
        diags.error(def.file, def.id, 'modes cannot change ref tokens; override the sys role instead');
        continue;
      }
      if (def.type !== undefined && def.type !== target.type) {
        diags.error(def.file, def.id, `override has $type ${def.type} but the base token is ${target.type}`);
      }
      def.type = target.type;
      if (modifier.strategy === 'light-dark' && target.type !== 'color') {
        diags.error(def.file, def.id, `the ${modifier.name} modifier can only change colours (it is applied with light-dark())`);
      }
      const prevMod = overriddenBy.get(def.id);
      if (prevMod && prevMod !== modifier.name) {
        diags.error(def.file, def.id, `token is overridden by two modifiers (${prevMod} and ${modifier.name}); give each its own sys role`);
      }
      overriddenBy.set(def.id, modifier.name);
    }

    // Layer rules (CLAUDE.md 6.2).
    if (def.layer === 'ref' && def.alias) {
      diags.error(def.file, def.id, `ref tokens hold raw values; aliases start at the sys layer${where}`);
    }
    if (def.layer !== 'ref' && def.literal) {
      diags.error(def.file, def.id, `${def.layer} tokens must alias another token; raw values live in ref${where}`);
    }

    if (!def.alias) continue;
    const target = base.get(def.alias);
    if (!target) {
      diags.error(def.file, def.id, `alias {${def.alias}} not found${where}.${suggest(def.alias, base.keys())}`);
      continue;
    }
    if (def.layer === 'sys' && target.layer === 'comp') {
      diags.error(def.file, def.id, `sys tokens cannot alias component tokens ({${def.alias}})`);
    }
    if (def.layer === 'comp' && target.layer === 'ref') {
      diags.error(def.file, def.id, `component tokens cannot use ref tokens directly ({${def.alias}}); alias a sys role (CLAUDE.md 6.2)`);
    }
    if (def.type !== undefined && target.type !== undefined && def.type !== target.type) {
      diags.error(def.file, def.id, `${def.type} token aliases {${def.alias}}, which is ${target.type}`);
    }
  }

  // Cycles and unresolvable tokens, in every combination of modes.
  const resolver = new Resolver(set);
  for (const sel of allSelections(set)) {
    for (const id of base.keys()) {
      try {
        resolver.resolve(id, sel);
      } catch (e) {
        if (!(e instanceof CycleError)) throw e;
        const def = base.get(e.chain[0]!)!;
        diags.error(def.file, def.id, `${e.message} (${describeSelection(sel)})`);
      }
    }
  }

  // A token may vary with at most one attribute modifier. Otherwise its CSS
  // custom property would be computed with a stale value when the two
  // attributes are set on different elements (see E16, "CSS inheritance").
  for (const [id, mods] of attributeDependencies(set)) {
    if (mods.size > 1) {
      diags.error(
        base.get(id)!.file,
        id,
        `token depends on more than one attribute modifier (${[...mods].join(', ')}). ` +
          'Split it into one sys role per modifier.',
      );
    }
  }

  if (diags.errors.length > 0) return; // contrast needs a clean graph

  for (const rule of set.manifest.contrast) {
    const fg = base.get(rule.fg);
    const bg = base.get(rule.bg);
    if (fg?.type !== 'color' || bg?.type !== 'color') {
      diags.error('modes.json', undefined, `contrast rule ${rule.fg} on ${rule.bg}: both must be colour tokens`);
      continue;
    }
    const worstByTheme = new Map<string, { ratio: number; sel: Selection }>();
    for (const sel of allSelections(set)) {
      const fgC = resolver.color(rule.fg, sel);
      const bgC = resolver.color(rule.bg, sel);
      const ratio = contrastRatio(fgC, bgC);
      if (ratio >= rule.min) continue;
      const themeKey = set.manifest.modifiers
        .filter((m) => m.strategy === 'light-dark')
        .map((m) => sel[m.name])
        .join();
      const prev = worstByTheme.get(themeKey);
      if (!prev || ratio < prev.ratio) worstByTheme.set(themeKey, { ratio, sel });
    }
    for (const { ratio, sel } of worstByTheme.values()) {
      const msg =
        `contrast ${rule.fg} on ${rule.bg} is ${ratio.toFixed(2)}:1, below ${rule.min}:1 (${describeSelection(sel)})` +
        (rule.note ? `. ${rule.note}` : '');
      if (rule.level === 'warn') diags.warn('modes.json', rule.fg, msg);
      else diags.error('modes.json', rule.fg, msg);
    }
  }
}
