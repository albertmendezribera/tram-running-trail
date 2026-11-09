import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildDesignSystem } from './build.ts';
import { componentsFromHex, contrastRatio } from './color.ts';
import { formatDiagnostic } from './model.ts';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const color = (hex: string): object => ({
  colorSpace: 'srgb',
  components: [1, 3, 5].map((i) => Number((parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(4))),
  hex,
});

const MANIFEST = {
  sources: ['ref.json', 'sys.json'],
  modifiers: {
    theme: {
      attribute: 'data-theme',
      default: 'light',
      strategy: 'light-dark',
      contexts: {
        light: { colorScheme: 'light', sources: [] },
        night: { colorScheme: 'dark', sources: ['night.json'] },
      },
    },
    terrain: {
      attribute: 'data-terrain',
      default: 'mixed',
      strategy: 'attribute',
      contexts: { mixed: { sources: [] }, trail: { sources: ['trail.json'] } },
    },
    density: {
      attribute: 'data-density',
      default: 'comfortable',
      strategy: 'attribute',
      contexts: { comfortable: { sources: [] }, compact: { sources: ['compact.json'] } },
    },
  },
  contrast: [{ fg: 'sys.text', bg: 'sys.surface', min: 4.5 }],
};

const BASE: Record<string, unknown> = {
  'modes.json': MANIFEST,
  'ref.json': {
    ref: {
      $type: 'color',
      paper: { $value: color('#efece4') },
      ink: { $value: color('#141518') },
      night: { $value: color('#0e0f11') },
      chalk: { $value: color('#e8e5dc') },
      contour: { $value: color('#9c6237') },
      space: {
        $type: 'dimension',
        '1': { $value: { value: 4, unit: 'px' } },
        '3': { $value: { value: 12, unit: 'px' } },
      },
      font: { $type: 'fontFamily', text: { $value: ['Sofia Sans', 'sans-serif'] } },
      weight: { $type: 'fontWeight', medium: { $value: 500 } },
      ratio: { $type: 'number', leading: { $value: 1.3 }, tracking: { $value: 0.01 } },
      size: {
        $type: 'dimension',
        md: { $value: { value: 16, unit: 'px' }, $extensions: { 'com.tramrun': { fluidMin: { value: 15, unit: 'px' } } } },
      },
    },
  },
  'sys.json': {
    sys: {
      $type: 'color',
      surface: { $value: '{ref.paper}' },
      text: { $root: { $value: '{ref.ink}' }, muted: { $value: '{sys.text}' } },
      rule: { $root: { $value: '{ref.contour}' }, strong: { $value: '{ref.ink}' } },
      data: {
        trail: { $value: '{ref.contour}' },
        primary: { $value: '{sys.text}' },
        road: { $value: '{ref.ink}' },
        active: { $value: '{ref.contour}' },
      },
      map: { water: { $value: '{ref.contour}' }, vegetation: { $value: '{ref.contour}' } },
      space: {
        $type: 'dimension',
        cell: { $value: '{ref.space.3}' },
        '2': { $value: '{ref.space.1}' },
        '3': { $value: '{ref.space.3}' },
        '6': { $value: '{ref.space.3}' },
      },
      font: { $type: 'fontFamily', data: { $value: '{ref.font.text}' } },
      type: {
        'data-md': {
          family: { $type: 'fontFamily', $value: '{sys.font.data}' },
          size: { $type: 'dimension', $value: '{ref.size.md}' },
          weight: { $type: 'fontWeight', $value: '{ref.weight.medium}' },
          leading: { $type: 'number', $value: '{ref.ratio.leading}' },
          tracking: { $type: 'number', $value: '{ref.ratio.tracking}' },
        },
      },
    },
  },
  'night.json': { sys: { surface: { $value: '{ref.night}' }, text: { $root: { $value: '{ref.chalk}' } } } },
  'trail.json': { sys: { data: { primary: { $value: '{sys.data.trail}' } } } },
  'compact.json': { sys: { space: { cell: { $value: '{ref.space.1}' } } } },
};

/** Builds BASE with `patch` applied: `{ file: { 'dotted.path': value } }`, `undefined` deletes. */
function buildWith(patch: Record<string, Record<string, unknown>> = {}) {
  const files = structuredClone(BASE) as Record<string, Record<string, unknown>>;
  for (const [file, edits] of Object.entries(patch)) {
    files[file] ??= {};
    for (const [path, value] of Object.entries(edits)) {
      const keys = path.split('.');
      let node = files[file]!;
      for (const k of keys.slice(0, -1)) node = (node[k] ??= {}) as Record<string, unknown>;
      if (value === undefined) delete node[keys.at(-1)!];
      else node[keys.at(-1)!] = value;
    }
  }
  return buildDesignSystem({ read: (p) => (p in files ? JSON.stringify(files[p]) : undefined) });
}

const errorsOf = (r: ReturnType<typeof buildWith>): string[] => r.diagnostics.errors.map(formatDiagnostic);

function assertError(r: ReturnType<typeof buildWith>, pattern: RegExp): void {
  const errors = errorsOf(r);
  assert.ok(errors.some((e) => pattern.test(e)), `expected an error matching ${pattern}, got:\n${errors.join('\n') || '(none)'}`);
  assert.deepEqual(r.files, {}, 'no files must be produced when there are errors');
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('fixture build', () => {
  // Built in a hook on purpose: an exception in a describe body is listed but does not fail the run.
  let r: ReturnType<typeof buildWith>;
  before(() => {
    r = buildWith();
  });

  it('has no errors', () => assert.deepEqual(errorsOf(r), []));

  it('folds the theme into light-dark() and flips color-scheme per data-theme', () => {
    const css = r.files['tokens.css']!;
    assert.match(css, /--tram-sys-surface: light-dark\(var\(--tram-ref-paper\), var\(--tram-ref-night\)\);/);
    assert.match(css, /\[data-theme="night"\] \{\n\s+color-scheme: dark;\n\s+\}/);
    assert.match(css, /:root \{\n\s+color-scheme: light dark;/);
  });

  it('keeps sys→sys aliases as var() so theme changes flow through', () => {
    assert.match(r.files['tokens.css']!, /--tram-sys-text-muted: var\(--tram-sys-text\);/);
  });

  it('re-declares attribute-mode tokens in every context, default included', () => {
    const css = r.files['tokens.css']!;
    assert.match(css, /\[data-terrain="mixed"\] \{\n\s+--tram-sys-data-primary: var\(--tram-sys-text\);/);
    assert.match(css, /\[data-terrain="trail"\] \{\n\s+--tram-sys-data-primary: var\(--tram-sys-data-trail\);/);
    assert.match(css, /\[data-density="compact"\] \{\n\s+--tram-sys-space-cell: var\(--tram-ref-space-1\);/);
  });

  it('ships spacing in rem in CSS and in px for OG/ECharts', () => {
    assert.match(r.files['tokens.css']!, /--tram-ref-space-3: 0\.75rem;/);
    assert.match(r.files['og.ts']!, /"cell": 12/);
  });

  it('resolves TS targets per theme', () => {
    assert.match(r.files['three.ts']!, /"night": \{\n\s+"mixed": \{\n\s+"surface": \{\n\s+"hex": 0x0e0f11/);
    assert.match(r.files['echarts-theme.ts']!, /"tram-night"/);
  });

  it('ships fluid sizes as clamp() between the reference viewports', () => {
    assert.match(r.files['tokens.css']!, /--tram-ref-size-md: clamp\(0\.9375rem, 0\.9143rem \+ 0\.0952vw, 1rem\);/);
  });

  it('quotes font names and leaves generic families bare', () => {
    assert.match(r.files['tokens.css']!, /--tram-ref-font-text: "Sofia Sans", sans-serif;/);
  });

  it('applies a whole role through data-type, with tabular figures on data roles', () => {
    const css = r.files['tokens.css']!;
    assert.match(css, /\[data-type="data-md"\] \{\n\s+font-family: var\(--tram-sys-type-data-md-family\);/);
    assert.match(css, /letter-spacing: calc\(var\(--tram-sys-type-data-md-tracking\) \* 1em\);\n\s+font-variant-numeric: tabular-nums lining-nums;/);
    assert.match(css, /\[data-numeric="tabular"\] \{\n\s+font-variant-numeric: tabular-nums lining-nums;/);
  });

  it('gives the TS targets the widest size and keeps type out of the spacing map', () => {
    const og = r.files['og.ts']!;
    assert.match(og, /"data-md": \{\n\s+"family": "Sofia Sans",\n\s+"size": 16,\n\s+"weight": 500,\n\s+"lineHeight": 1\.3,\n\s+"letterSpacing": 0\.01/);
    assert.doesNotMatch(og, /type-data-md-size/);
    assert.match(r.files['echarts-theme.ts']!, /"fontFamily": "var\(--tram-sys-font-data\)"/);
  });

  it('is deterministic', () => assert.deepEqual(buildWith().files, r.files));
});

// ---------------------------------------------------------------------------
// Errors must be clear (E16 criterion)
// ---------------------------------------------------------------------------

describe('validation errors', () => {
  it('missing alias, with a suggestion', () =>
    assertError(buildWith({ 'sys.json': { 'sys.surface.$value': '{ref.papr}' } }), /sys\.surface: alias \{ref\.papr\} not found\. Did you mean \{ref\.paper\}\?/));

  it('circular alias', () =>
    assertError(
      buildWith({ 'sys.json': { 'sys.text.$root.$value': '{sys.text.muted}' } }),
      /circular alias: sys\.text(\.muted)? → .* → sys\.text/,
    ));

  it('ref tokens cannot alias', () =>
    assertError(buildWith({ 'ref.json': { 'ref.ink.$value': '{ref.paper}' } }), /ref\.ink: ref tokens hold raw values/));

  it('sys tokens cannot hold raw values', () =>
    assertError(buildWith({ 'sys.json': { 'sys.surface.$value': color('#ffffff') } }), /sys\.surface: sys tokens must alias/));

  it('component tokens cannot use ref tokens', () =>
    assertError(
      buildWith({ 'modes.json': { sources: ['ref.json', 'sys.json', 'comp.json'] }, 'comp.json': { 'comp.bib.ink.$value': '{ref.ink}', 'comp.bib.$type': 'color' } }),
      /comp\.bib\.ink: component tokens cannot use ref tokens directly/,
    ));

  it('hex that disagrees with components', () =>
    assertError(
      buildWith({ 'ref.json': { 'ref.ink.$value': { colorSpace: 'srgb', components: [0, 0, 0], hex: '#141518' } } }),
      /hex #141518 does not match components \[0, 0, 0\] \(= #000000\)\. If #141518 is the intended colour, use components \[0\.0784, 0\.0824, 0\.0941\]/,
    ));

  it('pre-2025 string colours, with the object to write instead', () =>
    assertError(buildWith({ 'ref.json': { 'ref.ink.$value': '#141518' } }), /DTCG 2025\.10 colours are objects.*"components": \[0\.0784, 0\.0824, 0\.0941\]/));

  it('string dimensions, with the object to write instead', () =>
    assertError(buildWith({ 'ref.json': { 'ref.space.1.$value': '4px' } }), /\{"value": 4, "unit": "px"\}/));

  it('type mismatch between alias and target', () =>
    assertError(buildWith({ 'sys.json': { 'sys.surface.$value': '{ref.space.1}' } }), /color token aliases \{ref\.space\.1\}, which is dimension/));

  it('override of a token that does not exist', () =>
    assertError(buildWith({ 'night.json': { 'sys.surfac.$value': '{ref.night}' } }), /sys\.surfac: mode override for a token that does not exist.*Did you mean \{sys\.surface\}\?/));

  it('theme can only change colours', () =>
    assertError(buildWith({ 'night.json': { 'sys.space.cell.$value': '{ref.space.1}' } }), /theme modifier can only change colours/));

  it('a token cannot depend on two attribute modifiers', () =>
    assertError(
      buildWith({ 'trail.json': { 'sys.space.cell.$value': '{ref.space.1}' } }),
      /token is overridden by two modifiers \(terrain and density\)/,
    ));

  it('a token cannot depend on two attribute modifiers through aliases', () =>
    assertError(
      buildWith({
        'sys.json': { 'sys.space.gap.$value': '{sys.space.cell}', 'sys.space.wide.$value': '{ref.space.3}' },
        'trail.json': { 'sys.space.wide.$value': '{sys.space.gap}' },
      }),
      /sys\.space\.wide: token depends on more than one attribute modifier \(terrain, density\)/,
    ));

  it('contrast below the minimum, naming the mode', () =>
    assertError(buildWith({ 'night.json': { 'sys.text.$root.$value': '{ref.night}' } }), /contrast sys\.text on sys\.surface is 1\.00:1, below 4\.5:1 \(theme=night/));

  it('unknown $type', () =>
    assertError(buildWith({ 'ref.json': { 'ref.$type': 'colour' } }), /\$type "colour" is not supported \(supported: color, dimension, fontFamily, fontWeight, number\)/));

  it('fluidMin has to be smaller than the size', () =>
    assertError(
      buildWith({ 'ref.json': { 'ref.size.md.$extensions': { 'com.tramrun': { fluidMin: { value: 20, unit: 'px' } } } } }),
      /ref\.size\.md: fluidMin \(20px\) must use the unit of \$value and be smaller than it \(16px\)/,
    ));

  it('font families are names', () =>
    assertError(buildWith({ 'ref.json': { 'ref.font.text.$value': 5 } }), /ref\.font\.text: fontFamily \$value must be a font name/));

  it('font weights are numbers', () =>
    assertError(buildWith({ 'ref.json': { 'ref.weight.medium.$value': 'bold' } }), /ref\.weight\.medium: fontWeight \$value must be a number from 1 to 1000, got "bold"/));

  it('a type role needs all its tokens', () =>
    assertError(
      buildWith({ 'sys.json': { 'sys.type.data-md.leading': undefined } }),
      /sys\.type\.data-md\.leading: type role "data-md" needs a number token "leading"/,
    ));

  it('duplicate token across files', () =>
    assertError(
      buildWith({ 'modes.json': { sources: ['ref.json', 'sys.json', 'dup.json'] }, 'dup.json': { 'sys.surface.$value': '{ref.ink}', 'sys.$type': 'color' } }),
      /dup\.json → sys\.surface: token already defined in sys\.json/,
    ));

  it('tokens a target needs, all reported instead of crashing', () => {
    const r = buildWith({ 'sys.json': { 'sys.rule.strong': undefined, 'sys.map.water': undefined } });
    assertError(r, /sys\.rule\.strong: required by the ECharts theme but not defined/);
    assertError(r, /sys\.map\.water: required by the ECharts theme but not defined/);
  });

  it('a token a target needs, with the wrong type', () =>
    assertError(
      buildWith({ 'sys.json': { 'sys.space.6': { $type: 'color', $value: '{ref.ink}' } } }),
      /sys\.space\.6: the ECharts theme needs a dimension token, but this one is color/,
    ));

  it('reports every error at once, not just the first', () => {
    const r = buildWith({ 'sys.json': { 'sys.surface.$value': '{ref.nope}', 'sys.data.trail.$value': '{ref.nada}' } });
    assert.ok(r.diagnostics.errors.length >= 2);
  });
});

// ---------------------------------------------------------------------------
// The real tokens
// ---------------------------------------------------------------------------

describe('TRAM tokens', () => {
  const pkg = fileURLToPath(new URL('..', import.meta.url));
  let r: ReturnType<typeof buildDesignSystem>;
  before(() => {
    r = buildDesignSystem({
      read: (p) => {
        try {
          return readFileSync(join(pkg, 'tokens', p), 'utf8');
        } catch {
          return undefined;
        }
      },
    });
  });

  it('build without errors', () => assert.deepEqual(r.diagnostics.errors.map(formatDiagnostic), []));

  it('dist/ is up to date', () => {
    for (const [f, content] of Object.entries(r.files)) {
      assert.equal(readFileSync(join(pkg, 'dist', f), 'utf8'), content, `dist/${f} is stale: run pnpm tokens:build`);
    }
  });

  it('surface the open signal-on-paper contrast issue as a warning (E09)', () => {
    assert.ok(r.diagnostics.warnings.some((w) => /sys\.data\.active on sys\.surface is 2\.64:1/.test(w.message)));
  });

  it('never use slate blue for night (CLAUDE.md 7.8)', () => {
    assert.doesNotMatch(r.files['tokens.css']!, /#0f172a/i);
  });

  it('use a WCAG contrast that matches the reference values', () => {
    const fromHex = (hex: string) => ({
      colorSpace: 'srgb' as const,
      components: componentsFromHex(hex),
      alpha: 1,
      hex,
    });
    assert.equal(contrastRatio(fromHex('#000000'), fromHex('#ffffff')).toFixed(2), '21.00');
    assert.equal(contrastRatio(fromHex('#ff5a1f'), fromHex('#efece4')).toFixed(2), '2.64');
  });
});
