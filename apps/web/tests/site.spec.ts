import { expect, type Page, test } from '@playwright/test';

// The pages of the site (Phase 1), on the staging build: sample races and the two shoes included.
const COMPARE = '/ca/comparar/hoka-speedgoat-6-vs-nike-vaporfly-4/';
const PAGES = {
  home: '/ca/',
  races: '/ca/curses/',
  routes: '/ca/rutes/',
  shoes: '/ca/sabatilles/',
  'shoe-road': '/ca/sabatilles/nike/vaporfly-4/',
  'shoe-trail': '/ca/sabatilles/hoka/speedgoat-6/',
  compare: COMPARE,
};
// These carry a route to run: their long scroll and their 3D are covered by the M2 tests.
const ROUTE_PAGES = { 'race-trail': '/ca/curses/cursa-de-mostra-calonge/', 'race-road': '/ca/curses/cursa-de-mostra-sils/', 'route-flat': '/ca/rutes/sils/' };

const open = async (page: Page, path: string): Promise<void> => {
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
};
const overflow = (page: Page): Promise<number> => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const main = (page: Page) => page.locator('main');

for (const [name, path] of Object.entries(PAGES)) {
  test(`${name} matches its baseline`, async ({ page }) => {
    // A 3D view that starts on its own would move under the capture: with reduced motion it stays on its poster.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, path);
    await expect(page).toHaveScreenshot(`site-${name}.png`, { fullPage: true });
  });
}

for (const [name, path] of Object.entries({ ...PAGES, ...ROUTE_PAGES })) {
  test(`${name} has one title, a description and no horizontal overflow`, async ({ page }) => {
    // The 3D view waits for its button: these tests read the page, they do not fly it.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, path);
    expect(await overflow(page)).toBe(0);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{50,}/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${path}$`));
    await expect(page.locator('html')).toHaveAttribute('lang', 'ca');
  });
}

test.describe('Sample content', () => {
  test('a sample race says so, is not indexable and is described to no search engine', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, ROUTE_PAGES['race-road']);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
    await expect(page.locator('footer')).toContainText('Cursa de mostra');
    // What nobody organises has no organiser: absent, never made up.
    const organiser = page.locator('dl > div', { hasText: 'Organitza' });
    await expect(organiser).toContainText('—');
    await expect(organiser).toContainText('Sense dada');
  });

  test('a route takes its figures from its track and claims nothing about the surface', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, ROUTE_PAGES['route-flat']);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    await expect(main(page)).toContainText('9,99 km');
    await expect(main(page).getByText('Asfalt', { exact: true })).toHaveCount(0);
  });

  test('the shoe pages are kept from search engines until their names are cleared', async ({ page }) => {
    for (const path of [PAGES.shoes, PAGES['shoe-road'], COMPARE]) {
      await open(page, path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
      await expect(page.locator('footer')).toContainText('pendent de revisió legal');
    }
  });
});

test.describe('Home and lists', () => {
  test('the home leads to both races, both routes and the 3D of a route', async ({ page }) => {
    await open(page, PAGES.home);
    await expect(page.getByRole('img', { name: 'Plànol de Calonge' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Recorre Calonge en 3D/ })).toHaveAttribute('href', '/ca/rutes/calonge/');
    await expect(page.locator('a[href^="/ca/curses/cursa-de-mostra-"]')).toHaveCount(2);
    await expect(page.locator('a[href="/ca/rutes/sils/"]')).toHaveCount(1);
  });

  test('the section the reader is in is marked in the header', async ({ page }) => {
    await open(page, PAGES['shoe-road']);
    await expect(page.locator('header nav a[aria-current="page"]')).toHaveText('Sabatilles');
  });

  test('a flat race is drawn flat next to a mountain one', async ({ page }) => {
    await open(page, PAGES.races);
    // Both silhouettes share one vertical scale: the flat one uses a sliver of its box.
    const heights = await page.locator('main a svg.silhouette path:first-of-type').evaluateAll((paths) => paths.map((p) => (p as SVGPathElement).getBBox().height));
    expect(heights).toHaveLength(2);
    expect(Math.min(...heights)).toBeLessThan(Math.max(...heights) / 8);
  });
});

test.describe('RoutePlate', () => {
  test('draws the route on its contours with kilometre marks, scale and credit, and ships no script', async ({ page }) => {
    await open(page, '/ds/patterns/route-plate/');
    const plate = page.locator('figure', { has: page.getByRole('img', { name: 'Plànol de Calonge' }) }).first();
    expect(await plate.locator('svg path').count()).toBeGreaterThan(20);
    await expect(plate.locator('figcaption')).toContainText('Corbes de nivell cada 10 m');
    await expect(plate.locator('figcaption')).toContainText('Institut Cartogràfic i Geològic de Catalunya');
    await expect(plate).toContainText('Sortida i arribada');
    await expect(plate.locator('script')).toHaveCount(0);
  });
});

test.describe('ShoeXray', () => {
  test('names the drawing and writes its dimensions from the figures', async ({ page }) => {
    await open(page, PAGES['shoe-road']);
    const xray = page.locator('figure', { has: page.getByRole('img', { name: /Perfil lateral de Nike Vaporfly 4/ }) });
    await expect(xray).toContainText('34,1 mm');
    await expect(xray).toContainText('25,5 mm');
    await expect(xray).toContainText('8,6 mm');
    // No lugs on a road shoe, and what is not data is said.
    await expect(xray.getByText('Tacs', { exact: true })).toHaveCount(0);
    await expect(xray.locator('figcaption')).toContainText('Dibuixat sense dada');
    await expect(xray.locator('figcaption')).toContainText('posició de la placa');
  });

  test('takes the shoe apart by layers, with the keyboard and without JavaScript', async ({ page }) => {
    await open(page, PAGES['shoe-trail']);
    const xray = page.locator('figure', { has: page.getByRole('img', { name: /Perfil lateral de Hoka Speedgoat 6/ }) });
    const cote = xray.getByText('Taló', { exact: true });
    const layer = xray.getByText(/Mitjasola · CMEVA/);
    await expect(cote).toBeVisible();
    await expect(layer).toHaveCSS('opacity', '0');
    await xray.getByRole('radio', { name: 'Muntada' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(xray.getByRole('radio', { name: 'Per capes' })).toBeChecked();
    await expect(cote).toBeHidden();
    await expect(layer).toHaveCSS('opacity', '1');
    await expect(xray).toContainText('Sola · Vibram Megagrip · 3,1 mm');
  });

  test('lays two shoes over each other with the difference on each dimension', async ({ page }) => {
    await open(page, COMPARE);
    const xray = page.locator('figure', { has: page.getByRole('img', { name: /Perfil lateral de Hoka Speedgoat 6 i Nike Vaporfly 4/ }) });
    await expect(xray).toContainText('Δ +2 mm');
    await expect(xray).toContainText('Δ −1,7 mm');
    await expect(xray).toContainText('Δ +3,7 mm');
    await expect(xray.locator('figcaption')).toContainText('Alineades al taló');
    // Each shoe is told apart by its line, not by colour alone: the second one is dashed.
    const dash = await xray.locator('g[data-shoe="b"] .layer').first().evaluate((el) => getComputedStyle(el).strokeDasharray);
    expect(dash).not.toBe('none');
  });
});

test.describe('Shoe sheet', () => {
  test('sets what the lab measured next to what the brand states, under their names', async ({ page }) => {
    await open(page, PAGES['shoe-trail']);
    const table = page.getByRole('table', { name: 'Mesures de Hoka Speedgoat 6' });
    await expect(table.getByRole('columnheader')).toHaveText(['Mesura', /Mesurat\s*RunRepeat/, /Declarat\s*Hoka/]);
    const lugs = table.getByRole('row', { name: /Profunditat dels tacs/ });
    await expect(lugs.getByRole('cell')).toHaveText(['4 mm', '5 mm']);
  });

  test('gives each outside score on its own scale, with its source, and no average', async ({ page }) => {
    await open(page, PAGES['shoe-road']);
    const scores = page.locator('main li', { has: page.locator('a[rel~="external"]') });
    await expect(scores).toHaveCount(3);
    await expect(scores.nth(0).getByRole('link')).toHaveAttribute('href', 'https://runrepeat.com/nike-vaporfly-4');
    await expect(scores.nth(0)).toContainText('93');
    await expect(scores.nth(0)).toContainText('sobre 100');
    await expect(scores.nth(1)).toContainText('Prova del model de dona');
    await expect(scores.nth(2)).toContainText('sobre 10');
    await expect(main(page)).toContainText('no es poden sumar ni fer-ne la mitjana');
    // Figures, never stars (6.4).
    await expect(main(page)).not.toContainText(/[★☆⭐]/);
  });

  test('describes the shoe as a product, without ratings that are not ours', async ({ page }) => {
    await open(page, PAGES['shoe-road']);
    const data = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}');
    expect(data['@type']).toBe('Product');
    expect(data.brand.name).toBe('Nike');
    expect(data.aggregateRating).toBeUndefined();
  });
});

test.describe('Comparator', () => {
  test('gives every difference with its unit and its sign, and none against a missing figure', async ({ page }) => {
    await open(page, COMPARE);
    const table = page.getByRole('table', { name: /Mesures de laboratori de Hoka Speedgoat 6 i Nike Vaporfly 4/ });
    await expect(table.getByRole('row', { name: /Pes/ }).getByRole('cell')).toHaveText(['278 g', '166 g', /−112 g/]);
    await expect(table.getByRole('row', { name: /Gruix de la sola/ }).getByRole('cell').last()).toHaveText(/−0,8 mm/);
    const lugs = table.getByRole('row', { name: /Profunditat dels tacs/ }).getByRole('cell');
    await expect(lugs.nth(1)).toContainText('Sense dada');
    await expect(lugs.last()).toContainText('no es pot comparar');
  });

  test('has one address for a pair: the other order leads to it', async ({ page }) => {
    await page.goto('/ca/comparar/nike-vaporfly-4-vs-hoka-speedgoat-6/');
    await expect(page).toHaveURL(new RegExp(`${COMPARE}$`));
    await expect(page.locator('h1')).toHaveText('Hoka Speedgoat 6 vs Nike Vaporfly 4');
  });
});

test.describe('Shoe in 3D', () => {
  // Software GL on CI: the scene takes its time to compile.
  test.describe.configure({ timeout: 90_000 });
  const READY = { timeout: 60_000 };

  test('turns with a drag and with the arrow keys, and says where it is', async ({ page }) => {
    await open(page, PAGES['shoe-trail']);
    const viewer = page.locator('#shoe-3d');
    await viewer.scrollIntoViewIfNeeded();
    await expect(viewer).toHaveAttribute('data-state', 'ready', READY);
    const canvas = viewer.locator('canvas');
    await expect(canvas).toHaveAttribute('data-moving', 'false', READY);
    const yaw = async (): Promise<number> => Number(await canvas.getAttribute('data-yaw'));
    const start = await yaw();
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2, { steps: 4 });
    await page.mouse.up();
    expect(await yaw()).toBeGreaterThan(start + 0.5);
    // Still again once the hand lets go: a shoe at rest costs no frames.
    await expect(canvas).toHaveAttribute('data-moving', 'false');
    // The frame the last move asked for may still be on its way.
    await page.waitForTimeout(300);
    const frames = await canvas.getAttribute('data-frames');
    await page.waitForTimeout(300);
    expect(await canvas.getAttribute('data-frames')).toBe(frames);

    const turned = await yaw();
    await viewer.getByRole('group', { name: 'Hoka Speedgoat 6 en 3D' }).focus();
    await page.keyboard.press('ArrowRight');
    expect(await yaw()).toBeGreaterThan(turned + 0.3);
    await expect(viewer.getByRole('status')).toContainText(/Sabatilla girada [\d.,]+ graus/);
  });

  test('keeps the profile as its poster and waits for the button with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, PAGES['shoe-road']);
    const viewer = page.locator('#shoe-3d');
    await viewer.scrollIntoViewIfNeeded();
    await expect(viewer).toHaveAttribute('data-state', 'poster');
    await expect(viewer.locator('svg path').first()).toBeVisible();
    await expect(viewer.getByRole('button', { name: 'Veure en 3D' })).toBeVisible();
    // What the view is made of is said next to it: measurements, or the brand's photos where they are.
    await expect(viewer).toContainText(/no (és )?un escaneig/i);
  });
});

test.describe('Comparator in 3D', () => {
  test.describe.configure({ timeout: 120_000 });

  test('sets the two shoes side by side and turns them together, as mirror images', async ({ page }) => {
    await open(page, COMPARE);
    const [first, second] = [page.locator('#shoe-3d-a'), page.locator('#shoe-3d-b')];
    await first.scrollIntoViewIfNeeded();
    for (const viewer of [first, second]) await expect(viewer).toHaveAttribute('data-state', 'ready', { timeout: 90_000 });
    // Side by side on every screen: the second starts to the right of the first, at the same height.
    const [a, b] = [(await first.boundingBox())!, (await second.boundingBox())!];
    expect(b.x).toBeGreaterThan(a.x + a.width - 1);
    expect(Math.abs(b.y - a.y)).toBeLessThan(2);

    const yaw = async (viewer: typeof first): Promise<number> => Number(await viewer.locator('canvas').getAttribute('data-yaw'));
    await expect(first.locator('canvas')).toHaveAttribute('data-moving', 'false', { timeout: 60_000 });
    const before = [await yaw(first), await yaw(second)];
    // Facing each other: one is the other turned round.
    expect(before[0]! + before[1]!).toBeCloseTo(Math.PI, 2);
    const box = (await first.locator('canvas').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 4 });
    await page.mouse.up();
    await expect.poll(() => yaw(second)).toBeLessThan(before[1]! - 0.3);
    expect(await yaw(first)).toBeGreaterThan(before[0]! + 0.3);
    expect((await yaw(first)) + (await yaw(second))).toBeCloseTo(Math.PI, 2);
  });
});

test.describe('Route on foot', () => {
  test.describe.configure({ timeout: 180_000 });

  test('offers three ways of seeing a route, and on foot stands trees and buildings along it', async ({ page }) => {
    await open(page, ROUTE_PAGES['route-flat']);
    const scroller = page.locator('tram-route-scroller');
    await expect(scroller.getByRole('radio')).toHaveCount(3);
    // What is data and what is not is said next to the view.
    await expect(scroller).toContainText('cap és un arbre concret');
    await scroller.getByRole('radio', { name: 'A peu' }).check({ force: true });
    const viewer = scroller.locator('tram-viewer-3d');
    await viewer.scrollIntoViewIfNeeded();
    // The view that was there steps aside for the new one: the canvas with trees is the one to wait for.
    const canvas = viewer.locator('canvas[data-engine="maplibre"][data-trees]');
    await expect(canvas).toBeVisible({ timeout: 120_000 });
    await expect(viewer).toHaveAttribute('data-state', 'ready');
    expect(Number(await canvas.getAttribute('data-trees'))).toBeGreaterThan(1000);
    // The choice is kept for the next visit, as the other two.
    expect(await page.evaluate(() => localStorage.getItem('tram-viewer-mode'))).toBe('walk');
  });
});
