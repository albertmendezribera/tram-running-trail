/**
 * Checks the typographic roles of dist/tokens.css with the self-hosted fonts in a
 * real browser: the fluid range, the numeric rule and the Catalan l·l (E08).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { type Browser, chromium, type Page } from 'playwright';

const css = readFileSync(new URL('../dist/tokens.css', import.meta.url), 'utf8');

const fontUrl = (file: string): string =>
  `data:font/woff2;base64,${readFileSync(new URL(`../fonts/${file}`, import.meta.url)).toString('base64')}`;

const FACES = `
@font-face { font-family: "Sofia Sans Extra Condensed"; src: url("${fontUrl('sofia-sans-extra-condensed-latin-700-900.woff2')}") format("woff2"); font-weight: 700 900; }
@font-face { font-family: "Sofia Sans"; src: url("${fontUrl('sofia-sans-latin-400-700.woff2')}") format("woff2"); font-weight: 400 700; }`;

// Role → size in px at 390 and at 1440 px of viewport.
const ROLES: Record<string, [number, number]> = {
  'display-xl': [120, 240],
  'display-lg': [64, 120],
  'display-md': [44, 72],
  'display-sm': [28, 40],
  'text-lg': [18, 20],
  'text-md': [17, 18],
  'text-sm': [15, 16],
  'text-xs': [13, 14],
  'data-lg': [18, 20],
  'data-md': [16, 17],
  'data-sm': [14, 15],
};

const HTML = `<!doctype html><html lang="ca"><meta charset="utf-8">
<style>${FACES}
${css}
body { margin: 0; background: #fff; color: #000; }
#ink { display: inline-block; padding: 40px; white-space: nowrap; }
</style>
<body>
  ${Object.keys(ROLES).map((r) => `<div id="${r}" data-type="${r}">0</div>`).join('\n')}
  <span id="ink"></span>
</body></html>`;

/** Horizontal runs of ink in `text`, set at 200 px: three for a well-formed l·l. */
async function inkRuns(page: Page, role: string, text: string): Promise<Array<[number, number]>> {
  await page.evaluate(
    async ([r, t]) => {
      const el = document.getElementById('ink')!;
      el.dataset['type'] = r!;
      el.style.fontSize = '200px';
      el.textContent = t!;
      await document.fonts.ready;
    },
    [role, text],
  );
  const shot = await page.locator('#ink').screenshot();
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, img.width, img.height);
    const runs: Array<[number, number]> = [];
    let start = -1;
    for (let x = 0; x <= img.width; x++) {
      let ink = false;
      for (let y = 0; x < img.width && y < img.height && !ink; y++) ink = data[(y * img.width + x) * 4]! < 128;
      if (ink && start < 0) start = x;
      if (!ink && start >= 0) {
        runs.push([start, x]);
        start = -1;
      }
    }
    return runs;
  }, shot.toString('base64'));
}

describe('type roles in Chromium', () => {
  let browser: Browser;
  let page: Page;

  const open = async (width: number): Promise<void> => {
    await page.setViewportSize({ width, height: 800 });
    await page.setContent(HTML);
    await page.evaluate(async () => {
      await Promise.all([
        document.fonts.load('800 20px "Sofia Sans Extra Condensed"', '0l·'),
        document.fonts.load('500 20px "Sofia Sans"', '0l·'),
      ]);
      await document.fonts.ready;
    });
  };
  const sizeOf = (role: string): Promise<number> =>
    page.evaluate((r) => parseFloat(getComputedStyle(document.getElementById(r)!).fontSize), role);
  const digitWidths = (role: string): Promise<number[]> =>
    page.evaluate((r) => {
      const el = document.getElementById('ink')!;
      el.dataset['type'] = r;
      el.style.fontSize = '100px';
      el.style.padding = '0';
      return [...'0123456789'].map((d) => {
        el.textContent = d;
        return el.getBoundingClientRect().width;
      });
    }, role);

  before(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
  });
  after(async () => {
    await browser.close();
  });

  for (const [width, index, label] of [
    [390, 0, 'at the narrow reference viewport'],
    [1440, 1, 'at the wide reference viewport'],
    [320, 0, 'below the range'],
    [1920, 1, 'above the range'],
  ] as const) {
    it(`sizes every role ${label}`, async () => {
      await open(width);
      for (const [role, sizes] of Object.entries(ROLES)) {
        assert.ok(Math.abs((await sizeOf(role)) - sizes[index]) < 0.05, `${role} at ${width}: ${await sizeOf(role)}`);
      }
    });
  }

  it('loads the self-hosted fonts', async () => {
    await open(390);
    assert.deepEqual(
      await page.evaluate(() => [...document.fonts].map((f) => `${f.family} ${f.status}`).sort()),
      ['Sofia Sans Extra Condensed loaded', 'Sofia Sans loaded'],
    );
  });

  it('keeps every weight of the tokens working in the narrowed axes', async () => {
    await open(390);
    const width = (role: string, weight: number): Promise<number> =>
      page.evaluate(
        ([r, w]) => {
          const el = document.getElementById('ink')!;
          el.dataset['type'] = r as string;
          el.style.cssText = `font-size: 100px; padding: 0; font-weight: ${w}`;
          el.textContent = 'Hamburgefons';
          return el.getBoundingClientRect().width;
        },
        [role, weight] as const,
      );
    assert.notEqual(await width('display-xl', 700), await width('display-xl', 800));
    assert.notEqual(await width('text-md', 400), await width('text-md', 500));
  });

  it('gives data roles tabular figures', async () => {
    await open(390);
    for (const role of ['data-lg', 'data-md', 'data-sm']) {
      const w = await digitWidths(role);
      assert.ok(Math.max(...w) - Math.min(...w) < 0.01, `${role}: ${w.join(', ')}`);
    }
  });

  it('gives display roles proportional figures, unless data-numeric asks for tabular', async () => {
    await open(390);
    const w = await digitWidths('display-xl');
    assert.ok(Math.max(...w) - Math.min(...w) > 1, `proportional: ${w.join(', ')}`);
    await page.evaluate(() => {
      document.getElementById('ink')!.dataset['numeric'] = 'tabular';
    });
    const t = await digitWidths('display-xl');
    assert.ok(Math.max(...t) - Math.min(...t) < 0.01, `tabular: ${t.join(', ')}`);
  });

  for (const role of ['display-xl', 'text-md', 'data-md']) {
    it(`keeps the l·l dot centred between the two l in ${role}`, async () => {
      await open(1440);
      const runs = await inkRuns(page, role, 'l·l');
      assert.equal(runs.length, 3, `expected l, dot and l: ${JSON.stringify(runs)}`);
      const left = runs[1]![0] - runs[0]![1];
      const right = runs[2]![0] - runs[1]![1];
      assert.ok(left > 0 && right > 0 && Math.abs(left - right) <= 4, `gaps ${left} and ${right} px at 200 px`);
    });
  }
});
