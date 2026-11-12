import { componentsFromHex, hexFromComponents } from './color.ts';
import {
  type ContrastRule,
  type Diagnostics,
  type Layer,
  LAYERS,
  type Literal,
  type Manifest,
  type Modifier,
  type ModifierContext,
  SUPPORTED_TYPES,
  type TokenDef,
  type TokenSet,
  type TokenType,
} from './model.ts';

/** Abstracts the file system so tests can feed in-memory token files. */
export interface TokenSource {
  read(path: string): string | undefined;
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type JsonObject = { [k: string]: Json };

const GROUP_PROPS = new Set(['$type', '$description', '$extensions', '$deprecated']);
const TOKEN_PROPS = new Set(['$value', '$type', '$description', '$extensions', '$deprecated']);
const ALIAS_RE = /^\{([^{}]+)\}$/;
const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

const isObject = (v: Json | undefined): v is JsonObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function parseJsonFile(src: TokenSource, file: string, diags: Diagnostics): Json | undefined {
  const text = src.read(file);
  if (text === undefined) {
    diags.error(file, undefined, 'file not found');
    return undefined;
  }
  try {
    return JSON.parse(text) as Json;
  } catch (e) {
    diags.error(file, undefined, `invalid JSON: ${(e as Error).message}`);
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Literal values
// ---------------------------------------------------------------------------

function parseColor(v: Json, file: string, id: string, diags: Diagnostics): Literal | undefined {
  if (typeof v === 'string') {
    const hint = /^#[0-9a-f]{6}$/i.test(v)
      ? ` Write it as {"colorSpace": "srgb", "components": [${componentsFromHex(v).join(', ')}], "hex": "${v.toLowerCase()}"}.`
      : '';
    diags.error(file, id, `DTCG 2025.10 colours are objects, not strings.${hint}`);
    return undefined;
  }
  if (!isObject(v)) {
    diags.error(file, id, 'colour $value must be an object {colorSpace, components, alpha?, hex?}');
    return undefined;
  }
  if (v['colorSpace'] !== 'srgb') {
    diags.error(file, id, `colorSpace ${JSON.stringify(v['colorSpace'])} is not supported yet; use "srgb"`);
    return undefined;
  }
  const comps = v['components'];
  if (
    !Array.isArray(comps) ||
    comps.length !== 3 ||
    !comps.every((c): c is number => typeof c === 'number' && c >= 0 && c <= 1)
  ) {
    diags.error(file, id, 'components must be three numbers between 0 and 1');
    return undefined;
  }
  const alpha = v['alpha'] ?? 1;
  if (typeof alpha !== 'number' || alpha < 0 || alpha > 1) {
    diags.error(file, id, 'alpha must be a number between 0 and 1');
    return undefined;
  }
  const components = comps as [number, number, number];
  const derived = hexFromComponents(components);
  const hex = v['hex'];
  if (hex !== undefined) {
    if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) {
      diags.error(file, id, `hex must look like "#rrggbb", got ${JSON.stringify(hex)}`);
      return undefined;
    }
    if (hex.toLowerCase() !== derived) {
      diags.error(
        file,
        id,
        `hex ${hex} does not match components [${components.join(', ')}] (= ${derived}). ` +
          `If ${hex} is the intended colour, use components [${componentsFromHex(hex).join(', ')}].`,
      );
      return undefined;
    }
  }
  return { type: 'color', value: { colorSpace: 'srgb', components, alpha, hex: derived } };
}

function parseDimension(v: Json, file: string, id: string, diags: Diagnostics): Literal | undefined {
  if (typeof v === 'string') {
    const m = /^(-?\d*\.?\d+)(px|rem)$/.exec(v);
    const hint = m ? ` Write it as {"value": ${Number(m[1])}, "unit": "${m[2]}"}.` : '';
    diags.error(file, id, `DTCG 2025.10 dimensions are objects, not strings.${hint}`);
    return undefined;
  }
  if (!isObject(v) || typeof v['value'] !== 'number' || (v['unit'] !== 'px' && v['unit'] !== 'rem')) {
    diags.error(file, id, 'dimension $value must be {"value": number, "unit": "px" | "rem"}');
    return undefined;
  }
  return { type: 'dimension', value: { value: v['value'], unit: v['unit'] } };
}

/** Reads the optional `$extensions["com.tramrun"].fluidMin` of a dimension token. */
function withFluidMin(lit: Literal, node: JsonObject, file: string, id: string, diags: Diagnostics): Literal | undefined {
  if (lit.type !== 'dimension') return lit;
  const ext = node['$extensions'];
  const raw = isObject(ext) && isObject(ext['com.tramrun']) ? ext['com.tramrun']['fluidMin'] : undefined;
  if (raw === undefined) return lit;
  const min = parseDimension(raw, file, id, diags);
  if (min?.type !== 'dimension') return undefined;
  if (min.value.unit !== lit.value.unit || min.value.value >= lit.value.value) {
    diags.error(file, id, `fluidMin (${min.value.value}${min.value.unit}) must use the unit of $value and be smaller than it (${lit.value.value}${lit.value.unit})`);
    return undefined;
  }
  return { type: 'dimension', value: { ...lit.value, fluidMin: min.value } };
}

function parseFontFamily(v: Json, file: string, id: string, diags: Diagnostics): Literal | undefined {
  const names = typeof v === 'string' ? [v] : v;
  if (!Array.isArray(names) || names.length === 0 || !names.every((n): n is string => typeof n === 'string' && n !== '')) {
    diags.error(file, id, 'fontFamily $value must be a font name or a non-empty array of font names');
    return undefined;
  }
  return { type: 'fontFamily', value: names };
}

function parseFontWeight(v: Json, file: string, id: string, diags: Diagnostics): Literal | undefined {
  if (typeof v !== 'number' || v < 1 || v > 1000) {
    diags.error(file, id, `fontWeight $value must be a number from 1 to 1000, got ${JSON.stringify(v)}`);
    return undefined;
  }
  return { type: 'fontWeight', value: v };
}

function parseNumber(v: Json, file: string, id: string, diags: Diagnostics): Literal | undefined {
  if (typeof v !== 'number') {
    diags.error(file, id, `number $value must be a number, got ${JSON.stringify(v)}`);
    return undefined;
  }
  return { type: 'number', value: v };
}

function parseDuration(v: Json, file: string, id: string, diags: Diagnostics): Literal | undefined {
  if (!isObject(v) || typeof v['value'] !== 'number' || v['value'] < 0 || (v['unit'] !== 'ms' && v['unit'] !== 's')) {
    diags.error(file, id, 'duration $value must be {"value": number ≥ 0, "unit": "ms" | "s"}');
    return undefined;
  }
  return { type: 'duration', value: v['unit'] === 's' ? v['value'] * 1000 : v['value'] };
}

function parseCubicBezier(v: Json, file: string, id: string, diags: Diagnostics): Literal | undefined {
  if (!Array.isArray(v) || v.length !== 4 || !v.every((n): n is number => typeof n === 'number') || v[0]! < 0 || v[0]! > 1 || v[2]! < 0 || v[2]! > 1) {
    diags.error(file, id, 'cubicBezier $value must be [x1, y1, x2, y2] with x1 and x2 from 0 to 1');
    return undefined;
  }
  return { type: 'cubicBezier', value: [v[0]!, v[1]!, v[2]!, v[3]!] };
}

function parseLiteral(type: TokenType, v: Json, node: JsonObject, file: string, id: string, diags: Diagnostics): Literal | undefined {
  switch (type) {
    case 'color':
      return parseColor(v, file, id, diags);
    case 'fontFamily':
      return parseFontFamily(v, file, id, diags);
    case 'fontWeight':
      return parseFontWeight(v, file, id, diags);
    case 'number':
      return parseNumber(v, file, id, diags);
    case 'duration':
      return parseDuration(v, file, id, diags);
    case 'cubicBezier':
      return parseCubicBezier(v, file, id, diags);
    case 'dimension': {
      const lit = parseDimension(v, file, id, diags);
      return lit && withFluidMin(lit, node, file, id, diags);
    }
  }
}

// ---------------------------------------------------------------------------
// Flattening a token file
// ---------------------------------------------------------------------------

function flatten(json: Json, file: string, diags: Diagnostics): TokenDef[] {
  const out: TokenDef[] = [];
  if (!isObject(json)) {
    diags.error(file, undefined, 'a token file must contain a JSON object');
    return out;
  }
  for (const [key, node] of Object.entries(json)) {
    if (key === '$description' || key === '$schema') continue;
    if (!(LAYERS as readonly string[]).includes(key)) {
      diags.error(file, undefined, `top-level key "${key}" must be one of: ${LAYERS.join(', ')}`);
      continue;
    }
    walk(node, [key], undefined, key as Layer, file, diags, out);
  }
  return out;
}

function readType(node: JsonObject, file: string, id: string, diags: Diagnostics): TokenType | undefined {
  const t = node['$type'];
  if (t === undefined) return undefined;
  if (typeof t !== 'string' || !(SUPPORTED_TYPES as readonly string[]).includes(t)) {
    diags.error(file, id, `$type ${JSON.stringify(t)} is not supported (supported: ${SUPPORTED_TYPES.join(', ')})`);
    return undefined;
  }
  return t as TokenType;
}

function walk(
  node: Json,
  path: string[],
  inheritedType: TokenType | undefined,
  layer: Layer,
  file: string,
  diags: Diagnostics,
  out: TokenDef[],
): void {
  const id = path.filter((p) => p !== '$root').join('.');
  if (!isObject(node)) {
    diags.error(file, id, 'expected a token or group object');
    return;
  }
  const type = readType(node, file, id, diags) ?? inheritedType;

  if ('$value' in node) {
    for (const key of Object.keys(node)) {
      if (!TOKEN_PROPS.has(key)) {
        diags.error(
          file,
          id,
          key.startsWith('$')
            ? `unknown token property "${key}"`
            : `a token cannot contain "${key}"; to have a token and a group with the same name, use "$root"`,
        );
      }
    }
    out.push(parseToken(node, id, layer, type, file, diags));
    return;
  }

  if (path[path.length - 1] === '$root') {
    diags.error(file, id, '"$root" must be a token (it needs a $value)');
    return;
  }

  for (const [key, child] of Object.entries(node)) {
    if (key === '$root') {
      walk(child, [...path, key], type, layer, file, diags, out);
    } else if (key.startsWith('$')) {
      if (!GROUP_PROPS.has(key)) diags.warn(file, id, `unknown group property "${key}" ignored`);
    } else if (!NAME_RE.test(key)) {
      diags.error(file, `${id}.${key}`, 'token and group names must be lowercase kebab-case (a-z, 0-9, -)');
    } else {
      walk(child, [...path, key], type, layer, file, diags, out);
    }
  }
}

function parseToken(
  node: JsonObject,
  id: string,
  layer: Layer,
  type: TokenType | undefined,
  file: string,
  diags: Diagnostics,
): TokenDef {
  const v = node['$value'] as Json;
  const description = typeof node['$description'] === 'string' ? node['$description'] : undefined;
  const def: TokenDef = { id, layer, type, alias: undefined, literal: undefined, description, file };

  if (typeof v === 'string' && v.includes('{')) {
    const m = ALIAS_RE.exec(v);
    if (!m) {
      diags.error(file, id, `"${v}" is not a valid alias; write a whole reference like "{sys.text}"`);
      return def;
    }
    def.alias = m[1]!;
    return def;
  }
  if (type === undefined) {
    diags.error(file, id, 'token has no $type (neither on the token nor on a parent group)');
    return def;
  }
  def.literal = parseLiteral(type, v, node, file, id, diags);
  return def;
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

function parseManifest(json: Json, file: string, diags: Diagnostics): Manifest | undefined {
  if (!isObject(json)) {
    diags.error(file, undefined, 'manifest must be an object');
    return undefined;
  }
  const strings = (v: Json | undefined, what: string): string[] => {
    if (!Array.isArray(v) || !v.every((s): s is string => typeof s === 'string')) {
      diags.error(file, undefined, `${what} must be an array of file paths`);
      return [];
    }
    return v;
  };

  const sources = strings(json['sources'], '"sources"');
  const modifiers: Modifier[] = [];
  const rawMods = json['modifiers'] ?? {};
  if (!isObject(rawMods)) diags.error(file, undefined, '"modifiers" must be an object');
  else {
    for (const [name, m] of Object.entries(rawMods)) {
      if (!isObject(m)) {
        diags.error(file, undefined, `modifier "${name}" must be an object`);
        continue;
      }
      const attribute = m['attribute'];
      const def = m['default'];
      const strategy = m['strategy'];
      const rawContexts = m['contexts'];
      if (typeof attribute !== 'string' || !/^data-[a-z][a-z-]*$/.test(attribute)) {
        diags.error(file, undefined, `modifier "${name}": "attribute" must be a data-* attribute name`);
        continue;
      }
      if (strategy !== 'light-dark' && strategy !== 'attribute') {
        diags.error(file, undefined, `modifier "${name}": "strategy" must be "light-dark" or "attribute"`);
        continue;
      }
      if (!isObject(rawContexts) || Object.keys(rawContexts).length < 2) {
        diags.error(file, undefined, `modifier "${name}": "contexts" needs at least two contexts`);
        continue;
      }
      const contexts: Record<string, ModifierContext> = {};
      for (const [ctxName, ctx] of Object.entries(rawContexts)) {
        if (!isObject(ctx)) {
          diags.error(file, undefined, `modifier "${name}", context "${ctxName}" must be an object`);
          continue;
        }
        const cs = ctx['colorScheme'];
        if (cs !== undefined && cs !== 'light' && cs !== 'dark') {
          diags.error(file, undefined, `modifier "${name}", context "${ctxName}": colorScheme must be light or dark`);
        }
        contexts[ctxName] = {
          colorScheme: cs === 'light' || cs === 'dark' ? cs : undefined,
          sources: strings(ctx['sources'] ?? [], `modifier "${name}", context "${ctxName}" sources`),
        };
      }
      if (typeof def !== 'string' || !(def in contexts)) {
        diags.error(file, undefined, `modifier "${name}": "default" must name one of its contexts`);
        continue;
      }
      if ((contexts[def]?.sources.length ?? 0) > 0) {
        diags.error(
          file,
          undefined,
          `modifier "${name}": the default context "${def}" must have no sources (the base files are the default)`,
        );
      }
      if (strategy === 'light-dark') {
        const schemes = Object.values(contexts).map((c) => c.colorScheme);
        if (schemes.length !== 2 || !schemes.includes('light') || !schemes.includes('dark')) {
          diags.error(
            file,
            undefined,
            `modifier "${name}": the light-dark strategy needs exactly two contexts, one with colorScheme "light" and one with "dark"`,
          );
        }
      }
      modifiers.push({ name, attribute, default: def, strategy, contexts });
    }
  }
  if (modifiers.filter((m) => m.strategy === 'light-dark').length > 1) {
    diags.error(file, undefined, 'only one modifier can use the light-dark strategy');
  }

  const contrast: ContrastRule[] = [];
  const rawContrast = json['contrast'] ?? [];
  if (!Array.isArray(rawContrast)) diags.error(file, undefined, '"contrast" must be an array');
  else {
    for (const r of rawContrast) {
      if (!isObject(r) || typeof r['fg'] !== 'string' || typeof r['bg'] !== 'string' || typeof r['min'] !== 'number') {
        diags.error(file, undefined, `contrast rule ${JSON.stringify(r)} needs "fg", "bg" and "min"`);
        continue;
      }
      contrast.push({
        fg: r['fg'],
        bg: r['bg'],
        min: r['min'],
        level: r['level'] === 'warn' ? 'warn' : 'error',
        note: typeof r['note'] === 'string' ? r['note'] : undefined,
      });
    }
  }
  return { sources, modifiers, contrast };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function loadTokenSet(src: TokenSource, diags: Diagnostics, manifestFile = 'modes.json'): TokenSet | undefined {
  const manifestJson = parseJsonFile(src, manifestFile, diags);
  if (manifestJson === undefined) return undefined;
  const manifest = parseManifest(manifestJson, manifestFile, diags);
  if (!manifest) return undefined;

  const base = new Map<string, TokenDef>();
  for (const file of manifest.sources) {
    const json = parseJsonFile(src, file, diags);
    if (json === undefined) continue;
    for (const def of flatten(json, file, diags)) {
      const prev = base.get(def.id);
      if (prev) diags.error(file, def.id, `token already defined in ${prev.file}`);
      else base.set(def.id, def);
    }
  }

  const overrides = new Map<string, Map<string, Map<string, TokenDef>>>();
  for (const mod of manifest.modifiers) {
    const byContext = new Map<string, Map<string, TokenDef>>();
    for (const [ctxName, ctx] of Object.entries(mod.contexts)) {
      const defs = new Map<string, TokenDef>();
      for (const file of ctx.sources) {
        const json = parseJsonFile(src, file, diags);
        if (json === undefined) continue;
        for (const def of flatten(json, file, diags)) {
          const prev = defs.get(def.id);
          if (prev) diags.error(file, def.id, `already overridden for ${mod.name}=${ctxName} in ${prev.file}`);
          else defs.set(def.id, def);
        }
      }
      byContext.set(ctxName, defs);
    }
    overrides.set(mod.name, byContext);
  }
  return { manifest, base, overrides };
}
