/**
 * Checks dist/tokens.css in a real browser engine: nested modes must resolve to
 * the right value at any depth. This is the property that the light-dark()
 * strategy and the per-context re-declaration in build/targets/css.ts exist for.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { type Browser, chromium, type Page } from 'playwright';

const css = readFileSync(new URL('../dist/tokens.css', import.meta.url), 'utf8');

const HTML = `<!doctype html>
<style>${css}
  .probe { background-color: var(--tram-sys-surface); color: var(--tram-sys-data-primary); padding-top: var(--tram-sys-space-cell-y); }
</style>
<body>
  <div id="root" class="probe"></div>
  <section data-theme="night">
    <div id="night" class="probe"></div>
    <section data-terrain="trail">
      <div id="night-trail" class="probe"></div>
      <section data-theme="light">
        <div id="night-trail-light" class="probe"></div>
      </section>
    </section>
    <section data-terrain="road">
      <div id="night-road" class="probe"></div>
      <section data-terrain="mixed"><div id="night-road-mixed" class="probe"></div></section>
    </section>
  </section>
  <section data-terrain="road">
    <section data-theme="night"><div id="road-night" class="probe"></div></section>
  </section>
  <section data-density="compact">
    <div id="compact" class="probe"></div>
    <section data-density="comfortable"><div id="compact-comfortable" class="probe"></div></section>
  </section>
</body>`;

const rgb = (hex: string): string =>
  `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

describe('dist/tokens.css in Chromium', () => {
  let browser: Browser;
  let page: Page;

  before(async () => {
    browser = await chromium.launch();
    page = await browser.newPage({ colorScheme: 'light' });
    await page.setContent(HTML);
  });
  after(() => browser?.close());

  const probe = (id: string) =>
    page.$eval(`#${id}`, (el) => {
      const s = getComputedStyle(el);
      return { surface: s.backgroundColor, primary: s.color, cellY: s.paddingTop };
    });

  it('defaults: light, mixed, comfortable', async () => {
    assert.deepEqual(await probe('root'), { surface: rgb('#efece4'), primary: rgb('#141518'), cellY: '12px' });
  });

  it('night', async () => {
    assert.deepEqual(await probe('night'), { surface: rgb('#0e0f11'), primary: rgb('#e8e5dc'), cellY: '12px' });
  });

  it('trail inside night', async () => {
    assert.equal((await probe('night-trail')).primary, rgb('#9c6237'));
  });

  it('light inside trail inside night: theme flips back, terrain is kept', async () => {
    assert.deepEqual(await probe('night-trail-light'), {
      surface: rgb('#efece4'),
      primary: rgb('#9c6237'),
      cellY: '12px',
    });
  });

  it('road inside night uses the night road colour (road paint)', async () => {
    assert.equal((await probe('night-road')).primary, rgb('#f2eee3'));
  });

  it('night inside road: the road colour follows the inner theme', async () => {
    assert.equal((await probe('road-night')).primary, rgb('#f2eee3'));
  });

  it('mixed nested inside road resets the terrain', async () => {
    assert.equal((await probe('night-road-mixed')).primary, rgb('#e8e5dc'));
  });

  it('compact density, and comfortable nested inside it', async () => {
    assert.equal((await probe('compact')).cellY, '4px');
    assert.equal((await probe('compact-comfortable')).cellY, '12px');
  });

  it('follows the OS preference when no data-theme is set', async () => {
    const dark = await browser.newPage({ colorScheme: 'dark' });
    await dark.setContent(HTML);
    const surface = await dark.$eval('#root', (el) => getComputedStyle(el).backgroundColor);
    await dark.close();
    assert.equal(surface, rgb('#0e0f11'));
  });
});
