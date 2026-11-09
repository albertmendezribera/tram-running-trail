// Usage: node measure.mjs <repo> <outDir>
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { build } from 'esbuild';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, MarkPointComponent, TooltipComponent, VisualMapPiecewiseComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { echartsOption, makeProfile, margin, renderSvg } from './proto.mjs';

const [repo, outDir] = process.argv.slice(2);
const require = createRequire(path.join(repo, 'packages/design-system/package.json'));
const { chromium } = require('playwright');
const { tramEchartsThemes: themes } = await import(path.join(repo, 'packages/design-system/dist/echarts-theme.ts'));

echarts.use([LineChart, GridComponent, MarkPointComponent, TooltipComponent, VisualMapPiecewiseComponent, SVGRenderer]);
for (const [n, t] of Object.entries(themes)) echarts.registerTheme(n, t);

const gz = (s) => zlib.gzipSync(s, { level: 9 }).length;
const kb = (n) => Number((n / 1024).toFixed(1));
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const p95 = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)];

const data = makeProfile();
const SIZES = { mobile: [358, 180], desktop: [1360, 340] };

const renderEcharts = (width, height, theme) => {
  const c = echarts.init(null, theme, { renderer: 'svg', ssr: true, width, height });
  c.setOption(echartsOption(data, width, theme));
  const s = c.renderToSVGString();
  c.dispose();
  return s;
};

const timeIt = (fn, n = 20) => {
  const t = [];
  for (let i = 0; i < n; i++) {
    const a = performance.now();
    fn();
    t.push(performance.now() - a);
  }
  return Number(median(t).toFixed(1));
};

const bundle = async (entry) => {
  const r = await build({ entryPoints: [entry], bundle: true, minify: true, write: false, format: 'iife', target: 'es2022' });
  return r.outputFiles[0].text;
};

const clientSvg = await bundle('client-svg.js');
const clientEcharts = await bundle('client-echarts.js');

const css = fs.readFileSync(path.join(repo, 'packages/design-system/dist/tokens.css'), 'utf8');
const font = fs.readFileSync(path.join(repo, 'packages/design-system/fonts/sofia-sans-latin-400-700.woff2')).toString('base64');
const shell = (theme, body) => `<!doctype html><html lang="ca" data-theme="${theme}"><meta charset="utf-8"><style>@font-face{font-family:"Sofia Sans";src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:400 700}${css}body{margin:16px;background:var(--tram-sys-surface);color:var(--tram-sys-text)}</style><body>${body}</body></html>`;

const [mW, mH] = SIZES.mobile;
const out = {
  isPlaceholder: true,
  points: data.points.length,
  bands: data.bands.length,
  ssr: {
    svg: { oneTheme: kb(renderSvg(data, mW, mH).length), gzip: kb(gz(renderSvg(data, mW, mH))), themesNeeded: 1, ms: timeIt(() => renderSvg(data, mW, mH)) },
    echarts: {
      oneTheme: kb(renderEcharts(mW, mH, 'tram-light').length),
      gzip: kb(gz(renderEcharts(mW, mH, 'tram-light'))),
      themesNeeded: 2,
      ms: timeIt(() => renderEcharts(mW, mH, 'tram-light')),
    },
  },
  client: {
    svg: { raw: kb(clientSvg.length), gzip: kb(gz(clientSvg)) },
    echarts: { raw: kb(clientEcharts.length), gzip: kb(gz(clientEcharts)) },
  },
};

const b = await chromium.launch();

async function run(kind, width, height) {
  const page = await b.newPage({ viewport: { width: width + 32, height: height + 64 } });
  const cdp = await page.context().newCDPSession(page);
  const theme = 'tram-light';
  const body = kind === 'svg' ? `<div id="c">${renderSvg(data, width, height)}</div>` : '<div id="c"></div>';
  await page.setContent(shell('light', body));
  await page.addScriptTag({ content: kind === 'svg' ? clientSvg : clientEcharts });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const es = data.points.map((p) => p[1]);
  const { scaleLinear } = await import('d3-scale');
  const y = scaleLinear([Math.min(...es), Math.max(...es)], [height - margin.bottom, margin.top]).nice();
  const res = await page.evaluate(
    async ({ kind, data, width, height, margin, option, theme, themeObj, dom, rng }) => {
      const t0 = performance.now();
      const el = document.getElementById('c');
      const update =
        kind === 'svg'
          ? window.mount(el.querySelector('svg'), data.points, margin.left, width - margin.right, rng[0], rng[1], dom[0], dom[1], data.km)
          : window.mount(el, option, themeObj, theme, width, height);
      await new Promise(requestAnimationFrame);
      const mount = performance.now() - t0;
      const updates = [];
      const frames = [];
      let last = performance.now();
      for (let i = 0; i < 300; i++) {
        await new Promise(requestAnimationFrame);
        const now = performance.now();
        frames.push(now - last);
        last = now;
        const a = performance.now();
        update((i / 300) * data.km);
        document.body.getBoundingClientRect();
        updates.push(performance.now() - a);
      }
      return { mount, updates, frames };
    },
    { kind, data, width, height, margin, option: echartsOption(data, width, theme), theme, themeObj: themes[theme], dom: y.domain(), rng: y.range() },
  );
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.close();
  return {
    mount: res.mount,
    updateP50: median(res.updates),
    updateP95: p95(res.updates),
    dropped: res.frames.filter((f) => f > 25).length,
  };
}

out.interaction = {};
for (const kind of ['svg', 'echarts']) {
  out.interaction[kind] = {};
  for (const [size, [w, h]] of Object.entries(SIZES)) {
    const runs = [];
    for (let i = 0; i < 3; i++) runs.push(await run(kind, w, h));
    const pick = (k) => Number(median(runs.map((r) => r[k])).toFixed(2));
    out.interaction[kind][size] = { mountMs: pick('mount'), updateP50: pick('updateP50'), updateP95: pick('updateP95'), droppedOf300: pick('dropped') };
  }
}

fs.mkdirSync(outDir, { recursive: true });
for (const theme of ['light', 'night']) {
  for (const [size, [w, h]] of Object.entries(SIZES)) {
    const page = await b.newPage({ viewport: { width: w + 32, height: h * 2 + 80 }, deviceScaleFactor: 2 });
    const eTheme = `tram-${theme}`;
    await page.setContent(shell(theme, `<div>${renderSvg(data, w, h)}</div><div style="margin-top:32px">${renderEcharts(w, h, eTheme)}</div>`));
    await page.evaluate(async () => {
      await document.fonts.load('500 12px "Sofia Sans"');
      await document.fonts.ready;
    });
    await page.screenshot({ path: path.join(outDir, `profile-${theme}-${size}.png`), fullPage: true });
    await page.close();
  }
}
await b.close();
fs.writeFileSync(path.join(outDir, 'measures.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 1));
process.exit(0);
