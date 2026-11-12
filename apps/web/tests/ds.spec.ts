import { expect, type Page, test } from '@playwright/test';

const PAGES = {
  index: '/ds/',
  foundations: '/ds/fonaments/',
  text: '/ds/primitives/text/',
  actions: '/ds/primitives/actions/',
  media: '/ds/primitives/media/',
  layout: '/ds/primitives/layout/',
  measure: '/ds/primitives/measure/',
  'data-table': '/ds/primitives/data-table/',
  bib: '/ds/patterns/bib/',
  'stat-block': '/ds/patterns/stat-block/',
  'elevation-profile': '/ds/patterns/elevation-profile/',
  'climb-list': '/ds/patterns/climb-list/',
  'segmented-control': '/ds/interactive/segmented-control/',
  'theme-toggle': '/ds/interactive/theme-toggle/',
  viewer: '/ds/interactive/viewer-3d-shell/',
};

const open = async (page: Page, path: string): Promise<void> => {
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
};

for (const [name, path] of Object.entries(PAGES)) {
  test(`${name} matches its baseline`, async ({ page }) => {
    await open(page, path);
    if (name === 'viewer') {
      // The scene starts when it comes into view: the capture has to wait for it.
      const auto = page.locator('#demo-auto');
      await auto.scrollIntoViewIfNeeded();
      await expect(auto).toHaveAttribute('data-state', 'ready');
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
  });

  test(`${name} has no horizontal overflow and is not indexable`, async ({ page }) => {
    await open(page, path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  });
}

test.describe('SegmentedControl', () => {
  const states = (page: Page) => page.getByTestId('states');

  test('shows a visible focus and moves with the arrow keys', async ({ page }) => {
    await open(page, PAGES['segmented-control']);
    // A middle option: its ring has to paint over the next one.
    await states(page).getByRole('radio', { name: 'Tots' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(states(page).getByRole('radio', { name: 'Asfalt' })).toBeChecked();
    await expect(states(page)).toHaveScreenshot('segmented-focus.png');
  });

  test('highlights an option on hover', async ({ page }) => {
    await open(page, PAGES['segmented-control']);
    await states(page).getByText('Muntanya').hover();
    await expect(states(page)).toHaveScreenshot('segmented-hover.png');
  });

  test('skips disabled options with the keyboard', async ({ page }) => {
    await open(page, PAGES['segmented-control']);
    const group = page.getByTestId('disabled');
    await group.getByRole('radio', { name: 'Curta' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(group.getByRole('radio', { name: 'Llarga' })).toBeChecked();
  });
});

test.describe('DataTable', () => {
  test('keeps the header visible while scrolling', async ({ page }) => {
    await open(page, PAGES['data-table']);
    const scroller = page.getByTestId('sticky').getByRole('region');
    await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    const [header, box] = await Promise.all([
      scroller.locator('thead th').first().boundingBox(),
      scroller.boundingBox(),
    ]);
    expect(Math.abs(header!.y - box!.y)).toBeLessThan(1);
  });

  test('can be scrolled with the keyboard', async ({ page }) => {
    await open(page, PAGES['data-table']);
    const scroller = page.getByTestId('sticky').getByRole('region');
    await scroller.focus();
    await expect(scroller).toBeFocused();
  });

  test('exposes columns and row headers', async ({ page }) => {
    await open(page, PAGES['data-table']);
    const table = page.getByRole('table', { name: 'Parcials de mostra', exact: true });
    await expect(table.getByRole('columnheader', { name: 'Parcial' })).toBeVisible();
    await expect(table.getByRole('rowheader', { name: '10', exact: true })).toBeVisible();
  });

  test('says so when it has no rows', async ({ page }) => {
    await open(page, PAGES['data-table']);
    await expect(page.getByTestId('empty').getByText('Sense dades')).toBeVisible();
  });
});

test.describe('ElevationProfile', () => {
  test('names the chart and offers its data as HTML', async ({ page }) => {
    await open(page, PAGES['elevation-profile']);
    const block = page.getByTestId('trail');
    await expect(block.getByRole('img', { name: 'Perfil de mostra de muntanya' })).toBeVisible();
    await block.getByText('Dades del perfil').click();
    await expect(block.getByRole('table', { name: 'Perfil de mostra de muntanya' }).getByRole('rowheader').first()).toBeVisible();
    await expect(block.getByRole('cell', { name: 'Cim' }).or(block.getByRole('rowheader', { name: 'Cim' }))).toBeVisible();
  });

  test('keeps the bands readable and ships no script', async ({ page }) => {
    await open(page, PAGES['elevation-profile']);
    const svg = page.getByTestId('trail').getByRole('img');
    expect(await svg.locator('path.band').count()).toBeLessThanOrEqual(4);
    expect(await page.locator('script[src]').count()).toBe(0);
  });

  test('paints the bands in the grade scale, the same as the 3D route', async ({ page }, info) => {
    await open(page, PAGES['elevation-profile']);
    const steepest = page.getByTestId('trail').locator('.legend .band[data-level="4"]');
    const fill = await steepest.evaluate((el) => getComputedStyle(el).fill);
    expect(fill).toBe(info.project.name.endsWith('night') ? 'rgb(242, 174, 253)' : 'rgb(68, 2, 77)');
  });

  test('reads the grades of a real mountain route', async ({ page }) => {
    await open(page, PAGES['elevation-profile']);
    const block = page.getByTestId('real-trail');
    await expect(block.getByRole('img', { name: 'Perfil de la sortida a Calonge' })).toBeVisible();
    expect(await block.locator('path.band').count()).toBeGreaterThanOrEqual(2);
  });

  test('keeps a real flat route flat', async ({ page }) => {
    await open(page, PAGES['elevation-profile']);
    const block = page.getByTestId('real');
    await expect(block.getByRole('img', { name: 'Perfil de la sortida a Sils' })).toBeVisible();
    // 56–68 m of real elevation: the 100 m minimum span, rounded, keeps it flat.
    await expect(block.locator('.y .tick')).toHaveText(['0', '50', '100', '150']);
  });

  test('says so when there is no route', async ({ page }) => {
    await open(page, PAGES['elevation-profile']);
    await expect(page.getByTestId('absent').getByText('Sense perfil')).toBeVisible();
  });
});

test.describe('Viewer3DShell', () => {
  const start = async (page: Page, id: string) => {
    const viewer = page.locator(`#${id}`);
    await viewer.getByRole('button', { name: 'Veure en 3D' }).click();
    return viewer;
  };

  test('starts on its own when it comes into view', async ({ page }) => {
    await open(page, PAGES.viewer);
    const viewer = page.locator('#demo-auto');
    await viewer.scrollIntoViewIfNeeded();
    await expect(viewer).toHaveAttribute('data-state', 'ready');
    await expect(viewer.locator('canvas')).toBeVisible();
  });

  test('keeps the poster until asked, when set to interaction', async ({ page }) => {
    await open(page, PAGES.viewer);
    const viewer = page.locator('#demo-manual');
    await viewer.scrollIntoViewIfNeeded();
    await expect(viewer).toHaveAttribute('data-state', 'poster');
    await expect(viewer.locator('canvas')).toHaveCount(0);
    await start(page, 'demo-manual');
    await expect(viewer).toHaveAttribute('data-state', 'ready');
  });

  test('keeps the poster on error and can retry', async ({ page }) => {
    await open(page, PAGES.viewer);
    const viewer = await start(page, 'demo-error');
    await expect(viewer).toHaveAttribute('data-state', 'error');
    await expect(viewer.getByRole('status')).toHaveText('No s’ha pogut carregar la vista 3D.');
    await expect(viewer).toHaveScreenshot('viewer-error.png');
    await viewer.getByRole('button', { name: 'Torna-ho a provar' }).click();
    await expect(viewer).toHaveAttribute('data-state', 'ready');
  });

  test('moves with the arrow keys and announces it', async ({ page }) => {
    await open(page, PAGES.viewer);
    const viewer = await start(page, 'demo-manual');
    await expect(viewer).toHaveAttribute('data-state', 'ready');
    await viewer.getByRole('group', { name: 'Escena manual' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(viewer.getByRole('status')).toHaveText('Km 1');
  });

  test('does not start on its own with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, PAGES.viewer);
    const viewer = page.locator('#demo-auto');
    await viewer.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2500);
    await expect(viewer).toHaveAttribute('data-state', 'poster');
    await start(page, 'demo-auto');
    await expect(viewer).toHaveAttribute('data-state', 'ready');
  });

  test('has its text equivalent in the HTML', async ({ page }) => {
    await open(page, PAGES.viewer);
    await expect(page.getByTestId('auto').getByText('Text equivalent')).toBeAttached();
  });

  test('cleans up when it leaves the page', async ({ page }) => {
    await open(page, PAGES.viewer);
    const viewer = await start(page, 'demo-manual');
    await expect(viewer).toHaveAttribute('data-state', 'ready');
    await viewer.evaluate((el) => el.remove());
    expect(await page.evaluate(() => (window as Window & { tramDemoDisposed?: number }).tramDemoDisposed)).toBe(1);
  });
});

test.describe('ClimbList', () => {
  test('finds the climb of a real mountain route', async ({ page }) => {
    await open(page, PAGES['climb-list']);
    const list = page.getByTestId('real').getByRole('list', { name: 'Pujades de la sortida a Calonge' });
    await expect(list.getByRole('listitem')).toHaveCount(1);
    await expect(list).toContainText('m D+');
  });

  test('lists several climbs in order', async ({ page }) => {
    await open(page, PAGES['climb-list']);
    expect(await page.getByTestId('many').getByRole('listitem').count()).toBeGreaterThan(1);
  });

  test('does not invent climbs on a flat route', async ({ page }) => {
    await open(page, PAGES['climb-list']);
    await expect(page.getByTestId('flat')).toContainText('Cap pujada destacada');
  });
});

test.describe('M2 · Recórrer el tram', () => {
  const MOMENT = '/ds/moments/recorrer-el-tram/';
  // The realistic view draws ICGC tiles: the tests serve a flat stand-in, so they need no one else's servers.
  // Only the tests about the realistic view (and the baseline, which shows the default) start in it:
  // drawn in software it is several times heavier than the cartographic one.
  test.beforeEach(async ({ page }, info) => {
    await page.route(/geoserveis\.icgc\.cat/, (route) => route.fulfill({ path: 'tests/fixtures/tile.png' }));
    if (/realistic|baseline/.test(info.title)) return;
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('tram-test')) localStorage.setItem('tram-viewer-mode', 'map');
      sessionStorage.setItem('tram-test', '1');
    });
  });
  const runTo = async (page: Page, share: number): Promise<void> => {
    await page.evaluate((s) => {
      const track = document.querySelector('[data-track]')!;
      const box = track.getBoundingClientRect();
      window.scrollTo(0, window.scrollY + box.top + s * (box.height - window.innerHeight));
    }, share);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  };
  const out = (page: Page, name: string) => page.locator(`[data-out="${name}"]`);
  // Headless Chromium draws the 3D in software, a few frames per second: a smooth scroll with the scene running takes seconds.
  const SLOW = { timeout: 30_000 };
  // The realistic view is several times slower again, most of all on the shared machines of CI.
  const REAL = { timeout: 90_000 };
  const REAL_TEST = 300_000;

  test('runs the route with the scroll, from start to finish', async ({ page }) => {
    await open(page, MOMENT);
    await expect(page.locator('tram-route-scroller')).toHaveAttribute('data-live', '');
    await expect(out(page, 'km')).toHaveText('0,00');
    await runTo(page, 0.3);
    await expect(out(page, 'chapter')).toContainText('Pujada 1');
    expect(Number((await out(page, 'gain').textContent())!.replace('.', ''))).toBeGreaterThan(0);
    await runTo(page, 1);
    await expect(out(page, 'km')).toHaveText('12,41');
    await expect(out(page, 'chapter')).toHaveText('Arribada');
  });

  // With reduced motion the 3D waits for its button: the capture is the poster, the same on every machine.
  test('matches its baseline in the middle of the climb', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, MOMENT);
    await runTo(page, 0.3);
    await expect(page).toHaveScreenshot('moment-climb.png');
  });

  test('offers a way past the route without running it', async ({ page }) => {
    await open(page, MOMENT);
    await page.getByRole('link', { name: 'Salta el recorregut' }).click();
    await expect(page.getByRole('heading', { name: 'Full de resultats' })).toBeInViewport();
    await expect(out(page, 'km')).toHaveText('12,41');
  });

  test('jumps to a kilometre when the profile is clicked', async ({ page }) => {
    test.slow();
    await open(page, MOMENT);
    await runTo(page, 0.1);
    const plot = page.locator('tram-route-scroller .plot');
    const box = (await plot.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
    await expect.poll(async () => Number((await out(page, 'km').textContent())!.replace(',', '.')), SLOW).toBeGreaterThan(8);
  });

  const startViewer = async (page: Page) => {
    await open(page, MOMENT);
    const viewer = page.locator('#m2-viewer');
    await viewer.scrollIntoViewIfNeeded();
    // Loading the island and building the terrain takes a while on a busy machine.
    await expect(viewer).toHaveAttribute('data-state', 'ready', REAL);
    return viewer;
  };
  const frames = async (page: Page): Promise<number> => Number(await page.locator('#m2-viewer canvas').getAttribute('data-frames'));

  test('flies the 3D camera with the scroll and draws only when the position changes', async ({ page }) => {
    const viewer = await startViewer(page);
    test.slow();
    const canvas = viewer.locator('canvas');
    const start = await frames(page);
    await runTo(page, 0.3);
    await expect.poll(async () => Number(await canvas.getAttribute('data-share')), SLOW).toBeCloseTo(0.3, 2);
    await expect(canvas).toHaveAttribute('data-moving', 'false', SLOW);
    const arrived = await frames(page);
    expect(arrived).toBeGreaterThan(start);
    // Standing still costs nothing: no frame is drawn until the position changes again.
    await page.waitForTimeout(600);
    expect(await frames(page)).toBe(arrived);
  });

  test('moves one kilometre with each arrow key', async ({ page }) => {
    test.slow();
    const viewer = await startViewer(page);
    await viewer.getByRole('group', { name: 'Vol en 3D pel recorregut de Calonge' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(viewer.getByRole('status')).toHaveText('Km 1');
    await expect(out(page, 'km')).toHaveText('1,00', SLOW);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(viewer.getByRole('status')).toHaveText('Km 3');
    await page.keyboard.press('ArrowLeft');
    await expect(viewer.getByRole('status')).toHaveText('Km 2');
    await expect(out(page, 'km')).toHaveText('2,00', SLOW);
  });

  // The realistic view drawn in software manages about a frame per second in flight. These tests keep it
  // to single frames: from the top of the page, or with reduced motion, where the camera jumps instead of easing.
  test('starts in the realistic view', async ({ page }) => {
    test.setTimeout(REAL_TEST);
    await open(page, MOMENT);
    await expect(page.getByRole('radio', { name: 'Realista' })).toBeChecked();
    const viewer = page.locator('#m2-viewer');
    await viewer.scrollIntoViewIfNeeded();
    await expect(viewer).toHaveAttribute('data-state', 'ready', REAL);
    await expect(viewer.locator('canvas')).toHaveAttribute('data-engine', 'maplibre');
  });

  test('moves the realistic view with the scroll and keeps the place when the view changes', async ({ page }) => {
    test.setTimeout(REAL_TEST);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, MOMENT);
    const viewer = page.locator('#m2-viewer');
    await viewer.getByRole('button', { name: 'Veure en 3D' }).click();
    await expect(viewer).toHaveAttribute('data-state', 'ready', REAL);
    const canvas = viewer.locator('canvas');
    await expect(canvas).toHaveAttribute('data-engine', 'maplibre');
    await runTo(page, 0.3);
    await expect.poll(async () => Number(await canvas.getAttribute('data-share')), REAL).toBeCloseTo(0.3, 2);
    await expect(viewer.locator('[data-scene-label="km"]:not([hidden])').filter({ hasText: /^4$/ })).toBeAttached();
    await page.getByRole('radio', { name: 'Cartogràfic' }).check({ force: true });
    await expect(viewer.locator('canvas[data-engine^="three"]')).toBeVisible(REAL);
    await expect(canvas).toHaveCount(1, REAL);
    await expect.poll(async () => Number(await canvas.getAttribute('data-share')), REAL).toBeCloseTo(0.3, 2);
  });

  test('remembers the view chosen, realistic or cartographic, on the next visit', async ({ page }) => {
    test.setTimeout(REAL_TEST);
    const viewer = await startViewer(page);
    const canvas = viewer.locator('canvas');
    await page.getByRole('radio', { name: 'Cartogràfic' }).check({ force: true });
    await expect(viewer.locator('canvas[data-engine^="three"]')).toBeVisible(REAL);
    await expect(canvas).toHaveCount(1, REAL);
    await open(page, MOMENT);
    await expect(page.getByRole('radio', { name: 'Cartogràfic' })).toBeChecked();
    // The switch also works before the 3D has started.
    await page.getByRole('radio', { name: 'Realista' }).check({ force: true });
    await viewer.scrollIntoViewIfNeeded();
    await expect(viewer.locator('canvas[data-engine="maplibre"]')).toBeVisible(REAL);
    await expect(canvas).toHaveCount(1, REAL);
  });

  test('labels the kilometres and the places on the terrain', async ({ page }) => {
    test.slow();
    const viewer = await startViewer(page);
    const label = (text: string) => viewer.locator('[data-scene-label]:not([hidden])').filter({ hasText: text });
    // From afar only the places; the kilometre markers come with the camera.
    await expect(label('Cim · 313 m')).toBeVisible();
    await expect(label('Sortida · Arribada')).toBeVisible();
    await expect(viewer.locator('[data-scene-label="km"]:not([hidden])')).toHaveCount(0);
    await runTo(page, 0.3);
    await expect(viewer.locator('[data-scene-label="km"]:not([hidden])').filter({ hasText: /^4$/ })).toBeVisible(SLOW);
  });

  test('marks the same place on the profile and in the 3D, both ways', async ({ page }) => {
    test.slow();
    const viewer = await startViewer(page);
    const canvas = viewer.locator('canvas');
    const cursor = page.locator('tram-route-scroller [data-cursor-mark]');
    const left = async (): Promise<number> => Number.parseFloat(await cursor.evaluate((el) => (el as HTMLElement).style.left));
    await runTo(page, 0.3);
    await expect(canvas).toHaveAttribute('data-moving', 'false', SLOW);

    // Profile → 3D: pointing at the profile marks that place on the terrain.
    const plot = (await page.locator('tram-route-scroller .plot').boundingBox())!;
    await page.mouse.move(plot.x + plot.width * 0.6, plot.y + plot.height / 2);
    await expect.poll(async () => Number(await canvas.getAttribute('data-preview'))).toBeCloseTo(0.6, 2);
    await page.mouse.move(1, 1);
    await expect(canvas).toHaveAttribute('data-preview', '');
    await expect.poll(left).toBeCloseTo(30, 0);

    // 3D → profile: pointing at the route moves the profile cursor, and a click runs there.
    const marker = (await viewer.locator('[data-scene-label="km"]:not([hidden])').filter({ hasText: /^4$/ }).boundingBox())!;
    const foot = { x: marker.x + marker.width / 2, y: marker.y + marker.height + 1 };
    await page.mouse.move(foot.x, foot.y);
    await expect.poll(left).toBeCloseTo((4 / 12.41) * 100, 0);
    await page.mouse.click(foot.x, foot.y);
    await expect.poll(async () => Number((await out(page, 'km').textContent())!.replace(',', '.')), SLOW).toBeCloseTo(4, 1);
  });

  test('keeps the silhouette and waits for the button with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, MOMENT);
    const viewer = page.locator('#m2-viewer');
    await viewer.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await expect(viewer).toHaveAttribute('data-state', 'poster');
    await expect(viewer.locator('canvas')).toHaveCount(0);
    await viewer.getByRole('button', { name: 'Veure en 3D' }).click();
    await expect(viewer).toHaveAttribute('data-state', 'ready');
  });

  test('names the grade scale of the 3D route, in the colours of the theme', async ({ page }, info) => {
    await open(page, MOMENT);
    const legend = page.locator('tram-route-scroller .grades');
    // One legend at a time: the profile's own where it shows, the viewer's on narrow screens.
    const narrow = page.viewportSize()!.width < 768;
    await expect(legend).toBeVisible({ visible: narrow });
    await expect(page.locator('tram-route-scroller figure.profile .legend')).toBeVisible({ visible: !narrow });
    await expect(legend).toContainText('Pendent');
    await expect(legend.locator('.grade')).toHaveText(['< 5 %', '5–10 %', '10–15 %', '≥ 15 %']);
    const colors = await legend.locator('.swatch').evaluateAll((swatches) => swatches.map((s) => getComputedStyle(s).backgroundColor));
    expect(new Set(colors).size).toBe(4);
    // Steepest: the darkest by day, the lightest at night.
    expect(colors[3]).toBe(info.project.name.endsWith('night') ? 'rgb(242, 174, 253)' : 'rgb(68, 2, 77)');
  });

  test('credits the source of the terrain', async ({ page }) => {
    await open(page, MOMENT);
    await expect(page.locator('tram-route-scroller')).toContainText('Institut Cartogràfic i Geològic de Catalunya (ICGC), CC BY 4.0');
  });

  test('has no horizontal overflow and is not indexable', async ({ page }) => {
    await open(page, MOMENT);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  });
});

test.describe('M2 without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('is a readable static sheet, without the long scroll', async ({ page }) => {
    await page.goto('/ds/moments/recorrer-el-tram/');
    await expect(page.locator('tram-route-scroller')).not.toHaveAttribute('data-live', '');
    await expect(page.locator('[data-out="km"]')).toHaveText('0,00');
    await expect(page.getByText('Full de resultats')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Salta el recorregut' })).toBeVisible();
    // Neither the 3D button nor the switch of views would do anything here: only the silhouette shows.
    await expect(page.getByRole('radio', { name: 'Realista' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Veure en 3D' })).toBeHidden();
    const track = await page.locator('[data-track]').boundingBox();
    expect(track!.height).toBeLessThan(2 * (page.viewportSize()!.height));
  });
});

test.describe('Catalogue', () => {
  test('marks the page the reader is on in the index', async ({ page }) => {
    await open(page, PAGES.actions);
    const nav = page.getByRole('navigation', { name: 'Catàleg' });
    await expect(nav.getByRole('link', { name: 'Enllaç i botó' })).toHaveAttribute('aria-current', 'page');
    await expect(nav.locator('[aria-current]')).toHaveCount(1);
  });

  test('writes the foundations from the tokens themselves', async ({ page }) => {
    await open(page, PAGES.foundations);
    await expect(page.getByText('surface.tint', { exact: true })).toBeVisible();
    await expect(page.getByText('motion.quick · 160 ms')).toBeVisible();
    await expect(page.getByText('line.route · 3 px')).toBeVisible();
  });
});

test.describe('Primitives', () => {
  test('Button: one accent, real links, and states that say what they are', async ({ page }) => {
    await open(page, PAGES.actions);
    const variants = page.getByTestId('variants');
    const primary = variants.getByRole('button', { name: 'Inscriu-t\'hi' });
    expect(await primary.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 90, 31)');
    expect(await variants.getByRole('button', { name: 'Desa la cursa' }).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    const states = page.getByTestId('states');
    await expect(states.getByRole('button', { name: 'Inscripcions tancades' })).toBeDisabled();
    await expect(states.getByRole('button', { name: 'Desant…' })).toHaveAttribute('aria-busy', 'true');
    await expect(states.getByRole('button', { name: 'Desant…' })).toBeDisabled();
    await expect(states.getByRole('link', { name: 'És un enllaç' })).toHaveAttribute('href', '/ds/');
  });

  test('Button and Link show a visible focus', async ({ page, browserName }) => {
    await open(page, PAGES.actions);
    const button = page.getByTestId('variants').getByRole('button', { name: 'Desa la cursa' });
    await button.focus();
    // Safari only tabs to buttons and links with Option held, unless the reader changed its settings.
    const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
    await page.keyboard.press(`Shift+${tab}`);
    await page.keyboard.press(tab);
    expect(await button.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
  });

  test('Link: an outside link says so and the current page is marked', async ({ page }) => {
    await open(page, PAGES.actions);
    await expect(page.getByRole('main').getByRole('link', { name: 'Institut Cartogràfic' })).toHaveAttribute('rel', 'noopener');
    await expect(page.getByRole('main').getByRole('link', { name: 'Pàgina actual' })).toHaveAttribute('aria-current', 'page');
  });

  test('Icon: named when it stands alone, hidden when it decorates', async ({ page }) => {
    await open(page, PAGES.media);
    await expect(page.getByTestId('named').getByRole('img', { name: 'Cim' })).toBeVisible();
    expect(await page.locator('main svg.icon[aria-hidden="true"]').count()).toBeGreaterThan(10);
  });

  test('VisuallyHidden is read but takes no room', async ({ page }) => {
    await open(page, PAGES.media);
    const hidden = page.getByTestId('hidden').getByText('Quilòmetre 4');
    await expect(hidden).toBeAttached();
    const box = (await hidden.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(1);
  });

  test('Text keeps a running text to a readable measure', async ({ page }) => {
    await open(page, PAGES.text);
    const box = (await page.getByTestId('measure').locator('p').boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(720.5);
  });

  test('Split puts two sides next to each other only when there is room', async ({ page }) => {
    await open(page, PAGES.layout);
    const sides = page.locator('main .split').first().locator('.side');
    const [a, b] = [(await sides.nth(0).boundingBox())!, (await sides.nth(1).boundingBox())!];
    if (page.viewportSize()!.width >= 1024) expect(Math.abs(a.y - b.y)).toBeLessThan(1);
    else expect(b.y).toBeGreaterThan(a.y + a.height - 1);
  });

  test('Cluster wraps instead of overflowing', async ({ page }) => {
    await open(page, PAGES.layout);
    const specimen = (await page.getByTestId('cluster').boundingBox())!;
    for (const tag of await page.getByTestId('cluster').locator('.tag').all()) {
      const box = (await tag.boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(specimen.x + specimen.width + 0.5);
    }
  });
});

test.describe('Theme', () => {
  test.use({ colorScheme: 'dark', storageState: { cookies: [], origins: [] } });

  test('stays light on a phone in dark mode, until the reader chooses night', async ({ page }) => {
    await open(page, PAGES.index);
    const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(await background()).toBe('rgb(239, 236, 228)');
    const toggle = page.getByRole('button', { name: 'Mode nit' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(await background()).toBe('rgb(23, 25, 28)');
    // The choice holds on the next page.
    await open(page, PAGES.measure);
    expect(await background()).toBe('rgb(23, 25, 28)');
    await page.getByRole('button', { name: 'Mode nit' }).click();
    expect(await background()).toBe('rgb(239, 236, 228)');
  });
});

test('StatBlock pairs each label with its figure', async ({ page }) => {
  await open(page, PAGES['stat-block']);
  const block = page.getByTestId('road');
  await expect(block.getByRole('term').first()).toHaveText('Distància');
  await expect(block.getByRole('definition').first()).toContainText('42,195');
});

test('Measure gives screen readers a name for an absent value', async ({ page }) => {
  await open(page, PAGES.measure);
  await expect(page.getByTestId('absent').getByText('Sense dada').first()).toBeAttached();
});
