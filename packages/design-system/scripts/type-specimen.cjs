// Type specimen (E08): compares three open font pairings at 390/1440 px, light/night,
// and measures tabular figures, l·l spacing, reach of the display size and payload.
// Usage: node scripts/type-specimen.cjs <fontsDir> [outDir]
// <fontsDir> holds the @fontsource latin .woff2 files named below, flat (see E08).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '../dist/tokens.css'), 'utf8');
const fontsDir = path.resolve(process.argv[2]);
const outDir = path.resolve(process.argv[3] ?? path.join(__dirname, '../../../docs/explorations/E08'));

const stat = (family, file, weight) => ({ family, file, weight, variable: false });
const vari = (family, file, weight, range) => ({ family, file, weight, range, variable: true });

const PAIRS = [
  {
    id: 'A',
    name: 'Carretera',
    thesis: 'Rètols i matrícules: una família de senyalització',
    display: stat('Barlow Condensed', 'barlow-condensed-latin-700-normal.woff2', 700),
    text: [stat('Barlow', 'barlow-latin-400-normal.woff2', 400), stat('Barlow', 'barlow-latin-600-normal.woff2', 600)],
    data: vari('Overpass Mono', 'overpass-mono-latin-wght-normal.woff2', 400, '300 700'),
  },
  {
    id: 'B',
    name: 'Una sola família',
    thesis: 'Sofia Sans en dos amples, sense monoespaiada',
    display: vari('Sofia Sans Extra Condensed', 'sofia-sans-extra-condensed-latin-wght-normal.woff2', 800, '1 1000'),
    text: [vari('Sofia Sans', 'sofia-sans-latin-wght-normal.woff2', 400, '1 1000'), vari('Sofia Sans', 'sofia-sans-latin-wght-normal.woff2', 600, '1 1000')],
    data: vari('Sofia Sans', 'sofia-sans-latin-wght-normal.woff2', 500, '1 1000'),
  },
  {
    id: 'C',
    name: 'Plànol',
    thesis: 'Cartell condensat, grotesca neutra i cotes de plànol',
    display: vari('Antonio', 'antonio-latin-wght-normal.woff2', 700, '100 700'),
    text: [vari('Hanken Grotesk', 'hanken-grotesk-latin-wght-normal.woff2', 400, '100 900'), vari('Hanken Grotesk', 'hanken-grotesk-latin-wght-normal.woff2', 600, '100 900')],
    data: stat('IBM Plex Mono', 'ibm-plex-mono-latin-400-normal.woff2', 400),
  },
];

const fonts = (p) => [p.display, ...p.text, p.data];

const faces = () => {
  const seen = new Set();
  return PAIRS.flatMap(fonts)
    .filter((f) => !seen.has(f.file) && seen.add(f.file))
    .map((f) => `@font-face { font-family: "${f.family}"; src: url("${f.file}") format("woff2"); font-weight: ${f.variable ? f.range : f.weight}; font-display: block; }`)
    .join('\n');
};

const face = (f) => `font-family: '${f.family}'; font-weight: ${f.weight};`;

// Sample figures only: no real race, split or shoe is represented here (isPlaceholder).
const SPLITS = [
  ['1', '4:12', '4:12', '+8'],
  ['2', '8:31', '4:19', '+21'],
  ['3', '12:58', '4:27', '+47'],
  ['10', '44:06', '4:11', '+3'],
  ['11', '48:17', '4:11', '+1'],
];

const column = (p) => `
<section class="pair" data-pair="${p.id}">
  <header>
    <strong>${p.id} · ${p.name}</strong>
    <p>${p.thesis}</p>
    <p class="meta">${[...new Set(fonts(p).map((f) => f.family))].join(' + ')}</p>
  </header>

  <h2>Dorsal i xifra gran</h2>
  <div class="bib"><span class="bib-l">Dorsal</span><span class="display bib-n" style="${face(p.display)}">1427</span></div>
  <div class="fit-wrap"><span class="display fit" style="${face(p.display)}">42,195</span></div>
  <div class="stats" style="${face(p.display)}">
    <span>1.250 m D+</span><span>4:15 /km</span><span>03:27:41</span>
  </div>

  <h2>Punt volat · l·l</h2>
  <div class="ll display" lang="ca" style="${face(p.display)}">COL·LECCIÓ<br>Paral·lel<br>il·luminació</div>
  <div class="ll-text" lang="ca" style="${face(p.text[0])}">col·lecció, paral·lel, il·luminació, Col·legi</div>
  <div class="ll-text" lang="ca" style="${face(p.text[1])}">col·lecció, paral·lel, il·luminació, Col·legi</div>
  <div class="ll-text" lang="ca" style="${face(p.data)}">col·lecció, paral·lel</div>

  <h2>Text</h2>
  <p class="body" lang="ca" style="${face(p.text[0])}">El ritme per quilòmetre enganya a la muntanya. Cal mostrar també la velocitat vertical i el km-esforç, i col·locar la placa i els tacs al mateix pla de lectura que l'stack i el drop.</p>

  <h2>Full de resultats</h2>
  <table style="${face(p.data)}">
    <thead><tr><th>Km</th><th>Temps</th><th>Parcial</th><th>D+</th></tr></thead>
    <tbody>${SPLITS.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>

  <h2>Alineació de xifres</h2>
  <div class="digits" style="${face(p.display)}">1111111111<br>0123456789<br>8888888888</div>
  <div class="digits small" style="${face(p.data)}">1111111111<br>0123456789<br>8888888888</div>
</section>`;

const html = (theme) => `<!doctype html><html data-theme="${theme}"><meta charset="utf-8"><style>${faces()}
${css}
@layer proof {
  * { box-sizing: border-box; margin: 0; }
  html { font-synthesis: none; }
  body { background: var(--tram-sys-surface); color: var(--tram-sys-text); font: 14px/1.4 ui-monospace, monospace; padding: var(--tram-sys-space-6) var(--tram-sys-space-4); }
  h1 { font-size: 14px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; border-bottom: 1px solid var(--tram-sys-rule-strong); padding-bottom: var(--tram-sys-space-2); margin-bottom: var(--tram-sys-space-6); display: flex; justify-content: space-between; gap: var(--tram-sys-space-4); flex-wrap: wrap; }
  h1 span { color: var(--tram-sys-text-muted); font-weight: 400; }
  h2 { font-size: 12px; font-weight: 400; text-transform: uppercase; letter-spacing: .06em; color: var(--tram-sys-text-muted); margin: var(--tram-sys-space-7) 0 var(--tram-sys-space-2); border-bottom: 1px solid var(--tram-sys-rule); padding-bottom: var(--tram-sys-space-1); }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: var(--tram-sys-space-8) var(--tram-sys-space-7); }
  .pair { min-width: 0; }
  .pair header strong { font-size: 16px; }
  .pair header p { color: var(--tram-sys-text-muted); font-size: 12px; }
  .display { font-variant-numeric: tabular-nums lining-nums; line-height: 1; }
  .bib { border: 1px solid var(--tram-sys-rule-strong); padding: var(--tram-sys-space-3) var(--tram-sys-space-4); display: flex; align-items: baseline; justify-content: space-between; }
  .bib-l { font-size: 12px; color: var(--tram-sys-text-muted); text-transform: uppercase; }
  .bib-n { font-size: 148px; }
  .fit-wrap { margin-top: var(--tram-sys-space-4); overflow: hidden; }
  .fit { display: inline-block; white-space: nowrap; font-size: 100px; }
  .stats { display: grid; gap: var(--tram-sys-space-1); font-size: 44px; line-height: 1.05; font-variant-numeric: tabular-nums lining-nums; margin-top: var(--tram-sys-space-3); }
  .ll { font-size: 52px; line-height: 1.08; }
  .ll-text { font-size: 18px; line-height: 1.5; margin-top: var(--tram-sys-space-2); }
  .body { font-size: 16px; line-height: 1.5; max-width: 62ch; }
  table { border-collapse: collapse; width: 100%; font-size: 15px; font-variant-numeric: tabular-nums lining-nums; }
  th, td { padding: var(--tram-sys-space-cell-y) var(--tram-sys-space-cell-x); border-bottom: 1px solid var(--tram-sys-rule); text-align: right; }
  th:first-child, td:first-child { text-align: left; }
  thead th { border-bottom: 1px solid var(--tram-sys-rule-strong); background: var(--tram-sys-surface-alt); font-weight: inherit; color: var(--tram-sys-text-muted); }
  .digits { font-size: 40px; line-height: 1.1; font-variant-numeric: tabular-nums lining-nums; }
  .digits.small { font-size: 18px; line-height: 1.4; margin-top: var(--tram-sys-space-3); }
  .note { color: var(--tram-sys-text-muted); font-size: 12px; margin-top: var(--tram-sys-space-7); }
}
</style><body>
<h1>TRAM · tipografia, fonts obertes <span>data-theme="${theme}" · E08 · làmina de prova, no és UI</span></h1>
<div class="grid">${PAIRS.map(column).join('')}</div>
<p class="note">Xifres de mostra (isPlaceholder): no corresponen a cap cursa ni cap sabatilla real.</p>
<script>
document.fonts.ready.then(() => {
  for (const el of document.querySelectorAll('.fit')) {
    el.style.fontSize = (100 * el.parentElement.clientWidth / el.getBoundingClientRect().width) + 'px';
  }
  document.documentElement.dataset.ready = '1';
});
</script></body></html>`;

const measurePage = (faceCss) => `<!doctype html><meta charset="utf-8"><style>${faceCss}
html { font-synthesis: none; } body { margin: 0; background: #fff; color: #000; }
#probe { display: inline-block; padding: 40px; font-size: 200px; line-height: 1.4; white-space: nowrap; text-rendering: geometricPrecision; }
</style><body lang="ca"><span id="probe"></span></body>`;

async function inkRuns(page, family, weight, text, lang) {
  await page.evaluate(
    async ([f, w, t, l]) => {
      document.body.lang = l;
      const p = document.getElementById('probe');
      p.style.fontFamily = `"${f}"`;
      p.style.fontWeight = w;
      p.textContent = t;
      await document.fonts.load(`${w} 200px "${f}"`, t);
      await document.fonts.ready;
    },
    [family, weight, text, lang],
  );
  const shot = await page.locator('#probe').screenshot();
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const ink = (x, y) => d[(y * c.width + x) * 4] < 128;
    const runs = [];
    let start = -1;
    for (let x = 0; x <= c.width; x++) {
      let any = false;
      if (x < c.width) for (let y = 0; y < c.height && !any; y++) any = ink(x, y);
      if (any && start < 0) start = x;
      if (!any && start >= 0) {
        let top = c.height, bottom = 0;
        for (let i = start; i < x; i++) for (let y = 0; y < c.height; y++) if (ink(i, y)) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
        runs.push({ x0: start, x1: x, top, bottom });
        start = -1;
      }
    }
    return runs;
  }, shot.toString('base64'));
}

async function measureFont(page, f) {
  const round = (n) => Number(n.toFixed(3));
  const spacing = async (lang) => {
    const ll = await inkRuns(page, f.family, f.weight, 'll', lang);
    const dot = await inkRuns(page, f.family, f.weight, 'l·l', lang);
    const res = { runs: dot.length };
    if (ll.length === 2 && dot.length === 3) {
      const natural = (ll[1].x0 - ll[0].x1) / 200;
      const left = (dot[1].x0 - dot[0].x1) / 200;
      const right = (dot[2].x0 - dot[1].x1) / 200;
      const dotCentre = (dot[0].bottom - (dot[1].top + dot[1].bottom) / 2) / (dot[0].bottom - dot[0].top);
      Object.assign(res, { natural: round(natural), left: round(left), right: round(right), span: round((dot[2].x0 - dot[0].x1) / 200), stretch: round((dot[2].x0 - dot[0].x1) / (ll[1].x0 - ll[0].x1)), dotHeight: round(dotCentre) });
    }
    return res;
  };
  const out = { ...(await spacing('ca')), withoutCaLang: await spacing('') };
  const widths = await page.evaluate(([fam, w]) => {
    const s = document.createElement('span');
    s.style.cssText = `font: ${w} 100px "${fam}"; font-variant-numeric: tabular-nums lining-nums; position: absolute;`;
    document.body.append(s);
    const r = [...'0123456789'].map((d) => { s.textContent = d; return s.getBoundingClientRect().width; });
    s.remove();
    return r;
  }, [f.family, f.weight]);
  out.tabularSpread = round(Math.max(...widths) - Math.min(...widths));
  out.digitEm = round(widths[0] / 100);
  return out;
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const specimen = path.join(fontsDir, '_specimen.html');
  const probePath = path.join(fontsDir, '_measure.html');
  const b = await chromium.launch();
  for (const theme of ['light', 'night']) {
    fs.writeFileSync(specimen, html(theme));
    for (const width of [390, 1440]) {
      const p = await b.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
      await p.goto('file://' + specimen);
      await p.waitForSelector('html[data-ready="1"]');
      await p.screenshot({ path: path.join(outDir, `type-${theme}-${width}.png`), fullPage: true });
      await p.close();
    }
  }

  fs.writeFileSync(probePath, measurePage(faces()));
  const page = await b.newPage({ viewport: { width: 1600, height: 600 }, deviceScaleFactor: 1 });
  await page.goto('file://' + probePath);
  const results = [];
  for (const p of PAIRS) {
    const files = [...new Set(fonts(p).map((f) => f.file))];
    const kb = (f) => fs.statSync(path.join(fontsDir, f)).size / 1024;
    const row = { id: p.id, name: p.name, totalKb: Number(files.reduce((a, f) => a + kb(f), 0).toFixed(1)), displayKb: Number(kb(p.display.file).toFixed(1)), files: files.length, fonts: {} };
    for (const [role, f] of [['display', p.display], ['text', p.text[0]], ['textStrong', p.text[1]], ['data', p.data]]) {
      row.fonts[role] = { family: f.family, weight: f.weight, ...(await measureFont(page, f)) };
    }
    row.reach = await page.evaluate(async ([fam, w]) => {
      const s = document.createElement('span');
      s.style.cssText = `font: ${w} 100px "${fam}"; font-variant-numeric: tabular-nums lining-nums; position: absolute; white-space: nowrap;`;
      s.textContent = '42,195';
      document.body.append(s);
      const width = s.getBoundingClientRect().width;
      s.remove();
      return Number((100 * 358 / width).toFixed(1));
    }, [p.display.family, p.display.weight]);
    row.charsPerLine = await page.evaluate(async ([fam, w]) => {
      const s = document.createElement('span');
      const t = "El ritme per quilòmetre enganya a la muntanya i cal mostrar la velocitat vertical";
      s.style.cssText = `font: ${w} 16px "${fam}"; position: absolute; white-space: nowrap;`;
      s.textContent = t;
      document.body.append(s);
      const width = s.getBoundingClientRect().width;
      s.remove();
      return Number((358 / (width / t.length)).toFixed(1));
    }, [p.text[0].family, p.text[0].weight]);
    results.push(row);
  }
  await b.close();
  fs.rmSync(specimen);
  fs.rmSync(probePath);
  fs.writeFileSync(path.join(outDir, 'measures.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 1));
})();
