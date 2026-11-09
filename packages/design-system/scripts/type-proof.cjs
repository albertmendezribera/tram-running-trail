// Type roles proof sheet: renders the [data-type] roles of dist/tokens.css with the
// self-hosted fonts at 390/1440 px, light/night.
// Usage: node scripts/type-proof.cjs [outDir]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'dist/tokens.css'), 'utf8');
const outDir = process.argv[2] ?? path.join(root, '../../docs/explorations/E08');
const font = (f) => `data:font/woff2;base64,${fs.readFileSync(path.join(root, 'fonts', f)).toString('base64')}`;

const TEXT = "El ritme per quilòmetre enganya a la muntanya. Cal mostrar també la velocitat vertical i el km-esforç, i col·locar la placa i els tacs al mateix pla de lectura que l'stack i el drop.";
const ROWS = [
  ['display-xl', '42,195'],
  ['display-lg', '1.250 m D+'],
  ['display-md', '03:27:41 · 4:15 /km'],
  ['display-sm', 'Col·lecció de trams'],
  ['text-lg', TEXT],
  ['text-md', TEXT],
  ['text-sm', TEXT],
  ['text-xs', 'Desnivell positiu · Parcial · Avituallament'],
  ['data-lg', '42,195 km · 1.250 m D+'],
  ['data-md', '4:12 · 8:31 · 12:58 · 44:06'],
  ['data-sm', '4:12 · 8:31 · 12:58 · 44:06'],
];

const html = (theme) => `<!doctype html><html lang="ca" data-theme="${theme}"><meta charset="utf-8"><style>
@font-face { font-family: "Sofia Sans Extra Condensed"; src: url("${font('sofia-sans-extra-condensed-latin-700-900.woff2')}") format("woff2"); font-weight: 700 900; }
@font-face { font-family: "Sofia Sans"; src: url("${font('sofia-sans-latin-400-700.woff2')}") format("woff2"); font-weight: 400 700; }
${css}
@layer proof {
  * { box-sizing: border-box; margin: 0; }
  body { background: var(--tram-sys-surface); color: var(--tram-sys-text); padding: var(--tram-sys-space-6) var(--tram-sys-space-4); }
  h1 { border-bottom: 1px solid var(--tram-sys-rule-strong); padding-bottom: var(--tram-sys-space-2); }
  .row { padding: var(--tram-sys-space-5) 0; border-bottom: 1px solid var(--tram-sys-rule); }
  .row code, .cap { display: block; color: var(--tram-sys-text-muted); margin-bottom: var(--tram-sys-space-2); }
  .row p { max-width: 62ch; }
  .row .wide { max-width: none; white-space: nowrap; }
  .bibs { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--tram-sys-space-6); padding: var(--tram-sys-space-5) 0; }
  .bib { border: 1px solid var(--tram-sys-rule-strong); padding: var(--tram-sys-space-4); }
}
</style><body>
<h1 data-type="text-xs">TRAM · rols tipogràfics · data-theme="${theme}" · làmina de prova, no és UI</h1>
${ROWS.map(([r, t]) => `<div class="row"><code data-type="text-xs">${r}</code><p class="${r.startsWith('text-') ? '' : 'wide'}" data-type="${r}">${t}</p></div>`).join('\n')}
<div class="bibs">
  <div class="bib"><span class="cap" data-type="text-xs">Dorsal · proporcional (per defecte)</span><span data-type="display-xl">1427</span></div>
  <div class="bib"><span class="cap" data-type="text-xs">Dorsal · data-numeric="tabular"</span><span data-type="display-xl" data-numeric="tabular">1427</span></div>
</div>
<p class="cap" data-type="text-xs">Xifres de mostra (isPlaceholder): no corresponen a cap cursa real.</p>
</body></html>`;

(async () => {
  const b = await chromium.launch();
  for (const theme of ['light', 'night']) for (const width of [390, 1440]) {
    const p = await b.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
    await p.setContent(html(theme));
    await p.evaluate(async () => {
      await Promise.all(['700 20px "Sofia Sans Extra Condensed"', '800 20px "Sofia Sans Extra Condensed"', '400 20px "Sofia Sans"', '500 20px "Sofia Sans"'].map((f) => document.fonts.load(f, '0l·')));
      await document.fonts.ready;
    });
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    console.log(theme, width, 'horizontal overflow px:', overflow);
    await p.screenshot({ path: path.join(outDir, `roles-${theme}-${width}.png`), fullPage: true });
    await p.close();
  }
  await b.close();
})();
