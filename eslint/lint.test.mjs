import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ESLint } from 'eslint';
import stylelint from 'stylelint';

const eslint = new ESLint();

const rulesFor = async (code, filePath) => {
  const [result] = await eslint.lintText(code, { filePath });
  assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
  return result.messages.map((m) => m.ruleId);
};

const astro = (template) => `---\nconst a: number = 1;\n---\n${template}\n`;

describe('tram/measure-required', () => {
  const page = 'apps/web/src/ds/example.astro';

  for (const text of ['42,195 km', '1.250 m D+', '4:15 /km', '245 g', '8,5 mm', '820 m/h', '54,5 km-esforç']) {
    it(`rejects "${text}"`, async () => {
      assert.deepEqual(await rulesFor(astro(`<p>Temps ${text}</p>`), page), ['tram/measure-required']);
    });
  }

  for (const text of ['Dorsal 1427', 'Any 2027', 'base de 4 px', '3 germans', 'Fase 0', 'Muntanya']) {
    it(`accepts "${text}"`, async () => {
      assert.deepEqual(await rulesFor(astro(`<p>${text}</p>`), page), []);
    });
  }
});

describe('ref tokens in the app', () => {
  it('rejects importing them', async () => {
    assert.deepEqual(await rulesFor("import ref from '@tram/design-system/tokens/ref/color.json';\nexport default ref;\n", 'apps/web/src/ds/example.ts'), ['no-restricted-imports']);
  });

  it('allows the public entry points', async () => {
    assert.deepEqual(await rulesFor("import { tramOg } from '@tram/design-system/og';\nexport default tramOg;\n", 'apps/web/src/ds/example.ts'), []);
  });
});

describe('stylelint', () => {
  const rulesForCss = async (code, codeFilename = 'apps/web/src/example.css') => {
    const { results } = await stylelint.lint({ code, codeFilename, configFile: 'stylelint.config.mjs' });
    return results[0].warnings.map((w) => w.rule);
  };

  const cases = {
    'a hex colour': ['a { color: #fff; }', 'color-no-hex'],
    'a named colour': ['a { color: red; }', 'color-named'],
    'rgb()': ['a { color: rgb(0 0 0); }', 'function-disallowed-list'],
    'px sizes': ['a { margin: 4px; }', 'unit-disallowed-list'],
    'numeric z-index': ['a { z-index: 3; }', 'declaration-property-value-disallowed-list'],
    'ref tokens': ['a { color: var(--tram-ref-ink); }', 'declaration-property-value-disallowed-list'],
  };

  for (const [name, [code, rule]] of Object.entries(cases)) {
    it(`rejects ${name}`, async () => assert.deepEqual(await rulesForCss(code), [rule]));
  }

  it('accepts sys and comp tokens', async () => {
    assert.deepEqual(await rulesForCss('a { color: var(--tram-sys-text); margin: var(--tram-comp-bib-gap); }'), []);
  });

  it('checks the styles of .astro files', async () => {
    assert.deepEqual(await rulesForCss('<style>a { margin: 4px; }</style>\n', 'apps/web/src/example.astro'), ['unit-disallowed-list']);
  });
});
