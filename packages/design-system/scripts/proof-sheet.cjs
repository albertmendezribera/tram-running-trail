// Token proof sheet (E16): renders dist/tokens.css at 390/1440 px, light/night.
// Usage: node scripts/proof-sheet.cjs [outDir]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '../dist/tokens.css'), 'utf8');
const outDir = process.argv[2] ?? path.join(__dirname, '../../../docs/explorations/E16');
const groups = {
  'Superfície i text': ['surface','surface-alt','text','text-muted','rule','rule-strong','focus'],
  'Accent (únic)': ['accent','accent-text','on-accent'],
  'Dades': ['data-road','data-trail','data-primary','data-active','data-active-outline'],
  'Mapa': ['map-contour','map-vegetation','map-water'],
};
const html = (theme) => `<!doctype html><html data-theme="${theme}"><meta charset="utf-8"><style>${css}
@layer proof {
  * { box-sizing: border-box; margin: 0; }
  body { background: var(--tram-sys-surface); color: var(--tram-sys-text); font: 14px/1.4 ui-monospace, "DejaVu Sans Mono", monospace; padding: var(--tram-sys-space-6); }
  h1 { font-size: 14px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; border-bottom: 1px solid var(--tram-sys-rule-strong); padding-bottom: var(--tram-sys-space-2); display: flex; justify-content: space-between; gap: var(--tram-sys-space-4); flex-wrap: wrap; }
  h1 span { color: var(--tram-sys-text-muted); font-weight: 400; }
  h2 { font-size: 12px; font-weight: 400; text-transform: uppercase; letter-spacing: .06em; color: var(--tram-sys-text-muted); margin: var(--tram-sys-space-7) 0 var(--tram-sys-space-2); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); column-gap: var(--tram-sys-space-7); }
  .row { display: grid; grid-template-columns: var(--tram-sys-space-9) 1fr auto; align-items: center; gap: var(--tram-sys-space-3); border-bottom: 1px solid var(--tram-sys-rule); padding: var(--tram-sys-space-2) 0; }
  .sw { height: var(--tram-sys-space-7); border: 1px solid var(--tram-sys-rule-strong); }
  .hex { font-variant-numeric: tabular-nums; color: var(--tram-sys-text-muted); }
  .space .row { grid-template-columns: var(--tram-sys-space-11) 1fr; } .space code { white-space: nowrap; }
  .bar { height: var(--tram-sys-space-2); background: var(--tram-sys-text); }
  .modes { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0; border-top: 1px solid var(--tram-sys-rule-strong); }
  .mode { background: var(--tram-sys-surface); color: var(--tram-sys-text); padding: var(--tram-sys-space-4); border-bottom: 1px solid var(--tram-sys-rule); }
  .mode svg { display: block; width: 100%; height: 56px; }
  .mode path { fill: none; stroke: var(--tram-sys-data-primary); stroke-width: 2; }
  .mode circle { fill: var(--tram-sys-data-active); stroke: var(--tram-sys-data-active-outline); stroke-width: 1.5; }
  table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
  th, td { padding: var(--tram-sys-space-cell-y) var(--tram-sys-space-cell-x); border-bottom: 1px solid var(--tram-sys-rule); text-align: right; }
  th:first-child, td:first-child { text-align: left; }
  thead th { border-bottom: 1px solid var(--tram-sys-rule-strong); background: var(--tram-sys-surface-alt); font-weight: 400; color: var(--tram-sys-text-muted); }
  .note { color: var(--tram-sys-text-muted); font-size: 12px; margin-top: var(--tram-sys-space-2); }
}
</style><body>
<h1>TRAM · tokens del sistema <span>data-theme="${theme}" · E16 · làmina de prova, no és UI</span></h1>
<div class="grid">${Object.entries(groups).map(([g, ids]) => `<section><h2>${g}</h2>${ids.map(id => `<div class="row"><div class="sw" style="background: var(--tram-sys-${id})"></div><code>--tram-sys-${id}</code><span class="hex" data-var="--tram-sys-${id}"></span></div>`).join('')}</section>`).join('')}
<section class="space"><h2>Espai · base 4 px</h2>${[1,2,3,4,5,6,7,8,9,10,11,12].map(n => `<div class="row"><code>space-${n}</code><div class="bar" style="width: var(--tram-sys-space-${n})"></div></div>`).join('')}</section>
</div>
<h2>Modes niats · data-primary i punt actiu</h2>
<div class="modes">${[['mixed','light'],['road','light'],['trail','light'],['mixed','night'],['road','night'],['trail','night']].map(([t, th]) => `<div class="mode" data-theme="${th}" data-terrain="${t}"><code>${th} · ${t}</code><svg viewBox="0 0 200 56" preserveAspectRatio="none"><path d="M0 50 L30 44 L55 46 L80 30 L105 34 L130 12 L150 20 L175 8 L200 26"/><circle cx="130" cy="12" r="5"/></svg></div>`).join('')}</div>
<p class="note">Traç: placeholder de forma, no és cap perfil real (isPlaceholder). El punt actiu porta contorn sys.text: --signal fa 2,64:1 sobre paper (E09).</p>
<h2>Densitat · DataTable (cell-y / cell-x)</h2>
<div class="grid">${['comfortable','compact'].map(d => `<div data-density="${d}"><table><thead><tr><th>${d}</th><th>km</th><th>D+</th></tr></thead><tbody><tr><td>fila A</td><td>—</td><td>—</td></tr><tr><td>fila B</td><td>—</td><td>—</td></tr></tbody></table></div>`).join('')}</div>
<p class="note">Sense dades reals: les xifres es mostren com a absents ("—").</p>
<script>
for (const el of document.querySelectorAll('[data-var]')) {
  const probe = document.createElement('i'); probe.style.color = 'var(' + el.dataset.var + ')'; el.append(probe);
  const [r,g,b] = getComputedStyle(probe).color.match(/\\d+/g).map(Number); probe.remove();
  el.textContent = '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}
</script></body></html>`;
(async () => {
  const b = await chromium.launch();
  for (const theme of ['light', 'night']) for (const width of [390, 1440]) {
    const p = await b.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
    await p.setContent(html(theme));
    await p.screenshot({ path: `${outDir}/tokens-${theme}-${width}.png`, fullPage: true });
    await p.close();
  }
  await b.close();
})();
