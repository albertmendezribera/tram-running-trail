import { existsSync } from 'node:fs';
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
  'on-foot': '/ca/rutes/palamos/a-peu/',
  'shoe-need': '/ca/sabatilles/amples/',
  stories: '/ca/stories/',
};
// These carry a route to run: their long scroll and their 3D are covered by the M2 tests.
const ROUTE_PAGES = { 'race-trail': '/ca/curses/marxa-de-les-tines/', 'route-flat': '/ca/rutes/sils/' };

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
    await open(page, ROUTE_PAGES['race-trail']);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
    await expect(page.locator('footer')).toContainText('són de mostra');
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
    // A training run is a route and says what it was: it is not listed as a race.
    await expect(main(page)).toContainText('Gravada en un entrenament suau: «Easy Run Sils 10k».');
    await open(page, PAGES.races);
    await expect(main(page)).not.toContainText('Easy Run');
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
  test('the home leads to the race, every route and the 3D of a route', async ({ page }) => {
    await open(page, PAGES.home);
    await expect(page.getByRole('img', { name: /Plànol de Palamós/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Recorre Calonge en 3D/ })).toHaveAttribute('href', '/ca/rutes/calonge/');
    await expect(page.locator('main a[href="/ca/curses/marxa-de-les-tines/"]')).toHaveCount(1);
    // And to the next few races of the calendar, each to its own page.
    expect(await page.locator('main [data-month] a[href^="/ca/curses/"]').count()).toBeGreaterThan(3);
    await expect(page.locator('a[href="/ca/rutes/sils/"]')).toHaveCount(1);
    await expect(page.locator('a[href="/ca/rutes/palamos/"]')).toHaveCount(1);
  });

  test('the section the reader is in is marked in the header', async ({ page }) => {
    await open(page, PAGES['shoe-road']);
    await expect(page.locator('header nav a[aria-current="page"]')).toHaveText('Sabatilles');
  });

  test('a flat route is drawn flat next to a mountain one', async ({ page }) => {
    await open(page, PAGES.routes);
    // Every silhouette shares one vertical scale: a flat one uses a sliver of its box.
    const heights = await page.locator('main a svg.silhouette path:first-of-type').evaluateAll((paths) => paths.map((p) => (p as SVGPathElement).getBBox().height));
    expect(heights).toHaveLength(4);
    expect(Math.min(...heights)).toBeLessThan(Math.max(...heights) / 8);
  });
});

test.describe('Home hero (M1)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('shows the plan of a town as a drawing first, and the scroll turns it into relief', async ({ page }) => {
    await open(page, PAGES.home);
    const hero = page.locator('[data-home-hero]');
    // The first frame comes with the page: blocks, shore and route, as lines.
    expect(await hero.locator('svg .blocks polyline').count()).toBeGreaterThan(200);
    await expect(hero.locator('svg .route polyline')).toHaveCount(1);
    // Two real places, and where the lines come from, said under the view.
    await expect(hero).toContainText('Del plànol de Palamós al relleu de Calonge');
    await expect(hero).toContainText('ICGC');
    const viewer = hero.locator('tram-viewer-3d');
    await viewer.scrollIntoViewIfNeeded();
    await expect(viewer).toHaveAttribute('data-state', 'ready', { timeout: 90_000 });
    const canvas = viewer.locator('canvas[data-engine^="three-hero"]');
    await expect(canvas).toBeVisible();
    // Scrolling through what the view holds still for takes the passage to its end, with the view still on screen.
    await page.evaluate(() => {
      const host = document.querySelector<HTMLElement>('[data-home-hero]')!;
      const pin = host.querySelector<HTMLElement>('.pin')!;
      scrollTo(0, host.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(pin).top) + host.offsetHeight - pin.offsetHeight);
    });
    await expect.poll(async () => Number(await canvas.getAttribute('data-progress')), { timeout: 30_000 }).toBeGreaterThan(0.95);
  });

  test('stays a drawing with reduced motion, and takes no scroll for itself', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, PAGES.home);
    const hero = page.locator('[data-home-hero]');
    await expect(hero.locator('tram-viewer-3d')).toHaveAttribute('data-state', 'poster');
    await expect(hero.getByRole('button', { name: 'Veure en 3D' })).toBeVisible();
    // No stretch of page is held for a passage that will not play.
    const [track, pin] = await hero.evaluate((host) => [(host as HTMLElement).offsetHeight, host.querySelector<HTMLElement>('.pin')!.offsetHeight]);
    expect(track).toBe(pin);
  });
});

test.describe('From a list to its page (M6)', () => {
  test('the silhouette of a row and the profile of the page it leads to share a name, so one turns into the other', async ({ page }) => {
    await open(page, PAGES.races);
    const row = page.locator('main a[href="/ca/curses/marxa-de-les-tines/"]');
    const name = await row.locator('svg.silhouette').evaluate((svg) => getComputedStyle(svg).viewTransitionName);
    expect(name).toBe('profile-race-marxa-de-les-tines');
    // No two things in a page may carry the same name, or the browser gives the passage up.
    const names = await page.locator('main svg.silhouette').evaluateAll((all) => all.map((svg) => getComputedStyle(svg).viewTransitionName));
    expect(new Set(names).size).toBe(names.length);
    await row.click();
    await expect(page).toHaveURL(/marxa-de-les-tines/);
    expect(await page.locator('.route-silhouette').evaluate((el) => getComputedStyle(el).viewTransitionName)).toBe(name);
  });

  test('pages change at once with reduced motion: no passage is asked of the browser', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, PAGES.races);
    const asked = await page.evaluate(() => [...document.styleSheets].some((sheet) => [...sheet.cssRules].some(function has(rule: CSSRule): boolean {
      if (rule.constructor.name === 'CSSViewTransitionRule') return !(rule.parentRule instanceof CSSMediaRule) || matchMedia(rule.parentRule.conditionText).matches;
      return 'cssRules' in rule ? [...(rule as CSSGroupingRule).cssRules].some(has) : false;
    })));
    expect(asked).toBe(false);
  });
});

test.describe('Share images (M5)', () => {
  test('a race, a route and a comparison each name an image of 1200 × 630, built with the site from their own figures', async ({ page, request }) => {
    for (const path of [ROUTE_PAGES['race-trail'], '/ca/rutes/palamos/', COMPARE]) {
      await open(page, path);
      const url = await page.locator('meta[property="og:image"]').getAttribute('content');
      expect(url).toMatch(/\/og\/.+\.png$/);
      const response = await request.get(new URL(url!).pathname);
      expect(response.headers()['content-type']).toContain('image/png');
      // A PNG says its size right after its signature.
      const body = await response.body();
      expect([body.readUInt32BE(16), body.readUInt32BE(20)]).toEqual([1200, 630]);
      // What the image shows is said in words too: the name and the figures of the page.
      await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute('content', /\d\s(km|g)\b/);
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    }
  });

  test('a page without an image of its own names none', async ({ page }) => {
    await open(page, PAGES.routes);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Rutes');
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(0);
  });
});

test.describe('Calendar (Phase 2)', () => {
  test('lists the races of its sources month by month, each a link to its own page, and says where they come from', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, PAGES.races);
    const rows = page.locator('main [data-month] li a');
    expect(await rows.count()).toBeGreaterThan(300);
    // Every row leads to a page of its own, and no two to the same one.
    const hrefs = await rows.evaluateAll((links) => links.map((a) => a.getAttribute('href')));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    // The months to come can be jumped to.
    const first = page.locator('nav[aria-label="Mesos del calendari"] a').first();
    await expect(page.locator(`${await first.getAttribute('href')}`)).toBeVisible();
    // Each calendar is named, with a link to it.
    for (const source of ['fcatletisme.cat', 'opendata-ajuntament.barcelona.cat', 'curses.cat', 'runnea.com', 'gotrail.run', 'feec.cat']) await expect(page.locator(`main a[href*="${source}"]`).first()).toBeVisible();
    // No source gives the climb, and none is made up: a calendar row has no place for it.
    await expect(page.locator('main [data-month]').first()).not.toContainText('D+');
  });

  test('filters the list by type, distance and comarca, says how many are left, and keeps the choice in the address', async ({ page }) => {
    await open(page, PAGES.races);
    const filter = page.locator('[data-calendar-filter][data-ready]');
    await expect(filter).toBeVisible();
    const status = filter.locator('[data-status]');
    const shown = page.locator('main [data-race]:visible');
    const all = await shown.count();
    await expect(status).toHaveText(`${all} proves.`);
    // Marches only: fewer rows, every one of them a march, and the months left empty are gone with their links.
    await filter.locator('select[name="tipus"]').selectOption('march');
    const marches = await shown.count();
    expect(marches).toBeGreaterThan(10);
    expect(marches).toBeLessThan(all);
    await expect(status).toHaveText(`${marches} de ${all} proves.`);
    await expect(page).toHaveURL(/\?tipus=march$/);
    expect(await page.locator('main [data-month]:visible').count()).toBeLessThan(await page.locator('main [data-month]').count());
    // With a comarca on top, the march of Pals is among what is left.
    await filter.locator('select[name="comarca"]').selectOption('Baix Empordà');
    await expect(page.locator('main [data-race]:visible a[href="/ca/curses/32a-marxa-dels-arrossars-2026/"]')).toBeVisible();
    // A choice that leaves nothing says so, and taking the filters off brings everything back.
    await filter.locator('select[name="distancia"]').selectOption('ultra');
    await expect(status).toHaveText('Cap prova amb aquests filtres.');
    await filter.getByRole('button', { name: 'Treu els filtres' }).click();
    await expect(status).toHaveText(`${all} proves.`);
    expect(await shown.count()).toBe(all);
    await expect(page).toHaveURL(/\/ca\/curses\/$/);
    // No source gives the climb, and the page says why there is no filter for it.
    await expect(filter).toContainText('no es pot filtrar per ell');
  });

  test('a link to a filtered calendar opens it filtered', async ({ page }) => {
    await open(page, `${PAGES.races}?tipus=trail&distancia=21-42`);
    const filter = page.locator('[data-calendar-filter][data-ready]');
    await expect(filter.locator('select[name="tipus"]')).toHaveValue('trail');
    await expect(filter.locator('select[name="distancia"]')).toHaveValue('21-42');
    await expect(filter.locator('[data-status]')).toHaveText(/^\d+ de \d+ proves\.$/);
  });

  test('searches the list by name or town as it is typed, whatever the accents and capitals, and keeps the search in the address', async ({ page }) => {
    await open(page, PAGES.races);
    const filter = page.locator('[data-calendar-filter][data-ready]');
    const search = filter.getByRole('searchbox', { name: 'Nom o població' });
    const status = filter.locator('[data-status]');
    const shown = page.locator('main [data-race]:visible');
    const all = await shown.count();
    // A word of the name is enough, in capitals too: the march of Pals is the only one left, and its month the only month.
    await search.pressSequentially('ARROSSARS');
    await expect(shown).toHaveCount(1);
    await expect(shown.locator('a')).toHaveAttribute('href', '/ca/curses/32a-marxa-dels-arrossars-2026/');
    await expect(status).toHaveText(`1 de ${all} proves.`);
    await expect(page.locator('main [data-month]:visible')).toHaveCount(1);
    await expect(page).toHaveURL(/\?cerca=ARROSSARS$/);
    // Words in any order, without their accents, and the town counts as much as the name.
    await search.fill('sitges marato');
    await expect(page.locator('main [data-race]:visible a[href="/ca/curses/42a-mitja-marato-de-sitges-i-quart-de-marato-2026/"]')).toBeVisible();
    await search.fill('pals');
    await expect(page.locator('main [data-race]:visible a[href="/ca/curses/32a-marxa-dels-arrossars-2026/"]')).toBeVisible();
    // The search and the filters narrow each other.
    const found = await shown.count();
    await filter.locator('select[name="tipus"]').selectOption('road');
    expect(await shown.count()).toBeLessThan(found);
    await expect(page.locator('main [data-race]:visible a[href="/ca/curses/32a-marxa-dels-arrossars-2026/"]')).toHaveCount(0);
    await filter.locator('select[name="tipus"]').selectOption('');
    // What finds nothing says so, and taking the filters off empties the search as well.
    await search.fill('xyzxyz');
    await expect(status).toHaveText('Cap prova amb aquesta cerca.');
    await expect(shown).toHaveCount(0);
    await filter.getByRole('button', { name: 'Treu els filtres' }).click();
    await expect(search).toHaveValue('');
    await expect(status).toHaveText(`${all} proves.`);
    await expect(page).toHaveURL(/\/ca\/curses\/$/);
  });

  test('a link to a search opens the calendar searched', async ({ page }) => {
    await open(page, `${PAGES.races}?cerca=arrossars&tipus=march`);
    const filter = page.locator('[data-calendar-filter][data-ready]');
    await expect(filter.getByRole('searchbox')).toHaveValue('arrossars');
    await expect(filter.locator('select[name="tipus"]')).toHaveValue('march');
    await expect(page.locator('main [data-race]:visible')).toHaveCount(1);
  });

  test('a race of the calendar gives its facts with their source, has no 3D to show, and is kept from search engines while its source has not agreed', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/ca/curses/42a-mitja-marato-de-sitges-i-quart-de-marato-2026/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('42a Mitja Marató de Sitges i Quart de Marató');
    await expect(main(page)).toContainText('Sitges, Garraf');
    await expect(main(page)).toContainText('21,1 km');
    await expect(page.locator('main [data-source] a')).toHaveAttribute('href', /fcatletisme\.cat\/event\//);
    await expect(main(page)).toContainText('no l\'estimem');
    await expect(page.locator('tram-viewer-3d')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
    await expect(page.locator('footer')).toContainText('no és a la versió de producció');
  });

  test('a march read on its organiser\'s own page is on the calendar as a march, with that page as its source', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/ca/curses/32a-marxa-dels-arrossars-2026/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('32a Marxa dels Arrossars');
    await expect(main(page)).toContainText('Marxa a peu');
    await expect(main(page)).toContainText('Pals, Baix Empordà');
    await expect(main(page)).toContainText('22 de novembre');
    await expect(main(page)).toContainText('Jovent del Bruel');
    await expect(page.locator('main [data-source] a')).toHaveAttribute('href', /joventdelbruel/);
    // What an organiser says of its own march may be told to anyone.
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });

  test('a race an open source gives is described to search engines', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/ca/curses/103a-allianz-jean-bouin-rfea-2026/');
    await expect(page.locator('main [data-source]')).toHaveCount(3);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    const data = JSON.parse((await page.locator('script[type="application/ld+json"]:not([data-breadcrumbs])').textContent())!);
    expect(data).toMatchObject({ '@type': 'SportsEvent', startDate: '2026-11-29' });
  });
});

test.describe('The year as a profile (M4)', () => {
  test('draws every race of the calendar as a mark on its year, road up and mountain down, and says how to read it', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, PAGES.races);
    const years = page.locator('main [data-year]');
    expect(await years.count()).toBeGreaterThan(1);
    // A mark to a race: as many as the list has rows.
    expect(await years.locator('svg rect').count()).toBe(await page.locator('main [data-race]').count());
    // Road grows up from the line and mountain down; what is of neither is under both.
    const sides = await years.first().locator('svg').evaluate((svg) => {
      const line = Number(svg.querySelector('line')!.getAttribute('y1'));
      const edges = (side: string, edge: 'top' | 'bottom') => [...svg.querySelectorAll(`rect[data-side="${side}"]`)].map((rect) => Number(rect.getAttribute('y')) + (edge === 'bottom' ? Number(rect.getAttribute('height')) : 0));
      return { line, up: Math.max(...edges('up', 'bottom')), down: Math.min(...edges('down', 'top')), lowestDown: Math.max(...edges('down', 'bottom')), aside: Math.min(...edges('aside', 'top')) };
    });
    expect(sides.up).toBeLessThanOrEqual(sides.line);
    expect(sides.down).toBeGreaterThanOrEqual(sides.line);
    expect(sides.aside).toBeGreaterThan(sides.lowestDown);
    // The drawing has no words: the key beside it names every mark, and the page says what the height is not.
    for (const words of ['Asfalt, cap amunt', 'Muntanya, cap avall', 'cros i proves sense terreny a la font', 'Més que una marató', 'sense distància a la font', 'ja disputada']) await expect(main(page)).toContainText(words);
    await expect(main(page)).toContainText('no el desnivell de cap cursa');
    // The drawing is not what a screen reader reads: the months are.
    await expect(years.first().locator('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });

  test('each month with races is a way into its part of the list, and says what it holds', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, PAGES.races);
    const doors = page.locator('main [data-year] a');
    const hrefs = await doors.evaluateAll((links) => links.map((link) => link.getAttribute('href')!));
    expect(hrefs.length).toBeGreaterThan(12);
    // Every door leads to a month that is in the list.
    for (const href of hrefs) await expect(page.locator(href), href).toHaveCount(1);
    // A month to come leads among the races to come; a month gone, among those run.
    await expect(page.locator('main [data-year="2027"]').getByRole('link', { name: /^Març 2027: / })).toHaveAttribute('href', '#mes-2027-03');
    await expect(page.locator('main [data-year="2026"]').getByRole('link', { name: /^Maig 2026: / })).toHaveAttribute('href', '#fet-2026-05');
    // What a month holds is said in words, side by side as the drawing shows it.
    await expect(page.locator('main [data-year="2026"]').getByRole('link', { name: /^Novembre 2026: \d+ d’asfalt, \d+ de muntanya, \d+ de cros o sense terreny a la font$/ })).toHaveCount(1);
    // A door is wide enough for a finger, on a phone too.
    const widths = await doors.evaluateAll((links) => links.map((link) => link.getBoundingClientRect().width));
    expect(Math.min(...widths)).toBeGreaterThanOrEqual(24);
    // Following one moves the page to that month.
    await page.locator('main [data-year="2027"]').getByRole('link', { name: /^Març 2027: / }).click();
    await expect(page).toHaveURL(/#mes-2027-03$/);
    await expect(page.locator('#mes-2027-03')).toBeInViewport();
  });
});

test.describe('Calendar by facet (Phase 2)', () => {
  test('a kind of race has a page of its own, with its races to come, the rule that puts them there and the cuts that follow', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/ca/curses/trail/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Curses de muntanya');
    await expect(page.locator('main [data-lead]')).toHaveText(/^\d+ proves al calendari: \d+ encara per disputar i \d+ ja disputad(a|es)\.$/);
    await expect(main(page)).toContainText('El tipus és el que diu la font de cada prova');
    // Every row is a mountain race, and leads to its own page.
    const rows = page.locator('main [data-race] a');
    expect(await rows.count()).toBeGreaterThan(50);
    expect(await page.locator('main [data-race] a:not([data-terrain="trail"])').count()).toBe(0);
    // The cuts that follow are pages too: the same kind, comarca by comarca.
    const onward = page.getByRole('navigation', { name: 'Més talls d’aquest calendari' });
    await expect(onward.getByRole('link', { name: /^Baix Empordà \(\d+\)$/ })).toHaveAttribute('href', '/ca/curses/trail/baix-emporda/');
    await expect(page.getByRole('navigation', { name: 'Camí fins a aquesta pàgina' }).getByRole('link', { name: 'Curses' })).toHaveAttribute('href', '/ca/curses/');
    // While a race on it comes from a calendar that has not agreed, the page is kept from search engines.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://tramrun.com/ca/curses/trail/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });

  test('a map without script places the races: every comarca drawn, a dot to a place, and the page’s comarca marked', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/ca/curses/trail/baix-emporda/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Curses de muntanya al Baix Empordà');
    const map = page.getByRole('img', { name: /^Mapa de la comarca i les del voltant amb \d+ llocs? marcats?/ });
    await expect(map).toBeVisible();
    await expect(map.locator('.land path')).toHaveCount(43);
    await expect(map.locator('.land path[data-active]')).toHaveCount(1);
    expect(await map.locator('.dot').count()).toBeGreaterThan(1);
    // Every dot is inside the window the map shows.
    const inside = await map.evaluate((svg: SVGSVGElement) => {
      const { x, y, width, height } = svg.viewBox.baseVal;
      return [...svg.querySelectorAll<SVGPathElement>('.dot')].every((dot) => {
        const [px, py] = dot.getAttribute('d')!.slice(1).split(/[ h]/).map(Number);
        return px! >= x && px! <= x + width && py! >= y && py! <= y + height;
      });
    });
    expect(inside).toBe(true);
    await expect(main(page)).toContainText('Límits de comarca: © Institut Cartogràfic i Geològic de Catalunya');
    // Every race listed is of the comarca, and the way out widens the list.
    expect(await page.locator('main [data-race]').count()).toBe(await page.locator('main [data-race]', { hasText: 'Baix Empordà' }).count());
    const onward = page.getByRole('navigation', { name: 'Més talls d’aquest calendari' });
    await expect(onward.getByRole('link', { name: /^Curses de muntanya a tot Catalunya/ })).toHaveAttribute('href', '/ca/curses/trail/');
    await expect(onward.getByRole('link', { name: /^Curses al Baix Empordà/ })).toHaveAttribute('href', '/ca/curses/baix-emporda/');
    // The page ships no script of its own for any of it.
    expect(await page.locator('main script').count()).toBe(0);
  });

  test('a distance in a year lists the races of that distance run that year, and says how a race comes to count', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/ca/curses/marato/2027/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Maratons del 2027');
    await expect(main(page)).toContainText(/una distància d’entre 42\skm i 42,4\skm/);
    const dates = await page.locator('main [data-race] time').evaluateAll((times) => times.map((time) => time.getAttribute('datetime')));
    expect(dates.length).toBeGreaterThan(1);
    expect(dates.every((date) => date!.startsWith('2027-'))).toBe(true);
    await expect(page.locator('main [data-race] a[href="/ca/curses/48a-edicio-zurich-marato-de-barcelona-2027/"]')).toBeVisible();
    const onward = page.getByRole('navigation', { name: 'Més talls d’aquest calendari' });
    await expect(onward.getByRole('link', { name: /^Tots els anys/ })).toHaveAttribute('href', '/ca/curses/marato/');
  });

  test('a cut with no races is no page', async ({ page }) => {
    for (const path of ['/ca/curses/cros/pallars-sobira/', '/ca/curses/marato/2031/', '/ca/curses/alta-ribagorca/']) {
      const response = await page.goto(path);
      expect(response!.status(), path).toBe(404);
    }
  });

  test('the calendar and each race lead to the cuts they are part of', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, PAGES.races);
    const doors = page.getByRole('navigation', { name: 'El calendari per tipus, distància i comarca' });
    await expect(doors.getByRole('link', { name: /^Curses de muntanya \(\d+\)$/ })).toHaveAttribute('href', '/ca/curses/trail/');
    await expect(doors.getByRole('link', { name: /^Maratons \(\d+\)$/ })).toHaveAttribute('href', '/ca/curses/marato/');
    await expect(doors.getByRole('link', { name: /^Baix Empordà \(\d+\)$/ })).toHaveAttribute('href', '/ca/curses/baix-emporda/');
    // Every door opens on a page that exists.
    const hrefs = await doors.getByRole('link').evaluateAll((links) => links.map((link) => link.getAttribute('href')!));
    expect(hrefs.length).toBeGreaterThan(20);
    for (const href of hrefs) expect((await page.request.get(href)).status(), href).toBe(200);
    await open(page, '/ca/curses/32a-marxa-dels-arrossars-2026/');
    const lists = page.getByRole('navigation', { name: 'Llistes on surt aquesta prova' });
    await expect(lists.getByRole('link', { name: 'Marxes i caminades' })).toHaveAttribute('href', '/ca/curses/marxes/');
    await expect(lists.getByRole('link', { name: 'Curses al Baix Empordà' })).toHaveAttribute('href', '/ca/curses/baix-emporda/');
  });
});

test.describe('Trail (breadcrumbs)', () => {
  const trail = (page: Page) => page.getByRole('navigation', { name: 'Camí fins a aquesta pàgina' });

  test('every page but the home page shows the way back up, one link to a step', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const WAYS: Array<[path: string, steps: Array<[label: string, href: string]>]> = [
      [PAGES.races, [['Inici', '/ca/']]],
      [PAGES.routes, [['Inici', '/ca/']]],
      ['/ca/sabatilles/', [['Inici', '/ca/']]],
      ['/ca/rutes/calonge/', [['Inici', '/ca/'], ['Rutes', '/ca/rutes/']]],
      [PAGES['on-foot'], [['Inici', '/ca/'], ['Rutes', '/ca/rutes/'], ['Palamós', '/ca/rutes/palamos/']]],
      ['/ca/curses/32a-marxa-dels-arrossars-2026/', [['Inici', '/ca/'], ['Curses', '/ca/curses/']]],
      ['/ca/curses/trail/', [['Inici', '/ca/'], ['Curses', '/ca/curses/']]],
      ['/ca/curses/trail/baix-emporda/', [['Inici', '/ca/'], ['Curses', '/ca/curses/'], ['Curses de muntanya', '/ca/curses/trail/']]],
      ['/ca/curses/marato/2027/', [['Inici', '/ca/'], ['Curses', '/ca/curses/'], ['Maratons', '/ca/curses/marato/']]],
    ];
    for (const [path, steps] of WAYS) {
      await open(page, path);
      const links = trail(page).getByRole('link');
      expect(await links.evaluateAll((all) => all.map((a) => [a.textContent, a.getAttribute('href')])), path).toEqual(steps);
      // It comes before the content, and does not push the page sideways.
      expect(await trail(page).evaluate((nav) => Boolean(nav.compareDocumentPosition(document.querySelector('main')!) & Node.DOCUMENT_POSITION_FOLLOWING)), path).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), path).toBe(0);
    }
    await open(page, '/ca/');
    await expect(trail(page)).toHaveCount(0);
    await expect(page.locator('script[data-breadcrumbs]')).toHaveCount(0);
  });

  test('a page offered to search engines tells them the same way, down to itself; a page kept from them tells nothing', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/ca/rutes/calonge/');
    const data = JSON.parse((await page.locator('script[data-breadcrumbs]').textContent())!);
    expect(data['@type']).toBe('BreadcrumbList');
    expect(data.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Inici', item: 'https://tramrun.com/ca/' },
      { '@type': 'ListItem', position: 2, name: 'Rutes', item: 'https://tramrun.com/ca/rutes/' },
      { '@type': 'ListItem', position: 3, name: 'Ruta de Calonge', item: 'https://tramrun.com/ca/rutes/calonge/' },
    ]);
    // What search engines are told is what the page shows, plus the page itself.
    expect(await trail(page).getByRole('link').allTextContents()).toEqual(['Inici', 'Rutes']);
    // An open race has its own schema.org and the trail beside it.
    await open(page, '/ca/curses/103a-allianz-jean-bouin-rfea-2026/');
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(2);
    // A facet that lists races whose calendar has not agreed is kept from search engines: it shows its trail and tells none.
    await open(page, '/ca/curses/trail/baix-emporda/');
    await expect(trail(page)).toBeVisible();
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  });
});

test.describe('Route as a story (M5)', () => {
  const share = (page: Page) => page.locator('main [data-route-share]');

  test('a route is offered as a tall image in a light and a dark version, to save without any script', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/ca/rutes/calonge/');
    const stories = share(page).locator('[data-story]');
    await expect(stories).toHaveCount(2);
    for (const [i, file] of ['tram-rutes-calonge.png', 'tram-rutes-calonge-nit.png'].entries()) {
      const story = stories.nth(i);
      // What the picture shows is said in words, figures and all.
      await expect(story.locator('img')).toHaveAttribute('alt', /^Imatge vertical de Calonge \((clara|fosca)\): .*distància 12,41\skm, temps 1:23:15, ritme mitjà 6:42\s\/km, desnivell positiu 340\sm\sD\+/);
      const save = story.getByRole('link', { name: 'Baixa-la' });
      await expect(save).toHaveAttribute('download', file);
      const response = await page.request.get((await save.getAttribute('href'))!);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toBe('image/png');
    }
    expect(await overflow(page)).toBe(0);
  });

  test('the image is the size of a story, and keeps clear of what the apps lay over its top and its foot', async ({ page }) => {
    await open(page, '/ca/rutes/sils/');
    for (const href of ['/stories/rutes/sils.png', '/stories/rutes/calonge-nit.png', '/stories/curses/marxa-de-les-tines.png']) {
      const read = await page.evaluate(async (src) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        const canvas = Object.assign(document.createElement('canvas'), { width: image.naturalWidth, height: image.naturalHeight });
        const context = canvas.getContext('2d')!;
        context.drawImage(image, 0, 0);
        // A band is clear when every one of its pixels is the same colour.
        const flat = (from: number, to: number): boolean => {
          const { data } = context.getImageData(0, from, canvas.width, to - from);
          for (let i = 4; i < data.length; i += 4) if (data[i] !== data[0] || data[i + 1] !== data[1] || data[i + 2] !== data[2]) return false;
          return true;
        };
        return { width: image.naturalWidth, height: image.naturalHeight, top: flat(0, 250), foot: flat(1920 - 250, 1920), middle: flat(250, 1920 - 250) };
      }, href);
      expect(read, href).toEqual({ width: 1080, height: 1920, top: true, foot: true, middle: false });
    }
  });

  test('where the browser can hand a picture to another app, «Comparteix» gives it the image as a file', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, value: (data: ShareData) => Boolean(data.files?.length) });
      Object.defineProperty(Navigator.prototype, 'share', {
        configurable: true,
        value: async (data: ShareData) => {
          const [file] = data.files!;
          (window as unknown as { shared: unknown }).shared = { name: file!.name, type: file!.type, size: file!.size, title: data.title };
        },
      });
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/ca/rutes/calonge/');
    const buttons = share(page).getByRole('button', { name: 'Comparteix' });
    await expect(buttons).toHaveCount(2);
    await buttons.nth(1).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { shared?: { name: string } }).shared?.name)).toBe('tram-rutes-calonge-nit.png');
    const shared = await page.evaluate(() => (window as unknown as { shared: { type: string; size: number; title: string } }).shared);
    expect(shared.type).toBe('image/png');
    expect(shared.size).toBeGreaterThan(10_000);
    expect(shared.title).toBe('Calonge');
  });

  test('where it cannot, there is no «Comparteix», and saving is still there', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, value: undefined }));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/ca/curses/marxa-de-les-tines/');
    await expect(share(page).getByRole('link', { name: 'Baixa-la' }).first()).toHaveAttribute('download', 'tram-curses-marxa-de-les-tines.png');
    await expect(share(page).getByRole('button', { name: 'Comparteix' })).toHaveCount(0);
  });

  test('a route tells the time it was run in and its average pace, on its sheet and in its story; a race does not tell one runner’s', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/ca/rutes/palamos/');
    const sheet = page.locator('main section', { hasText: 'Full de resultats' }).first();
    await expect(sheet).toContainText('Temps');
    await expect(sheet).toContainText('00:58:53');
    await expect(sheet).toContainText('Ritme mitjà');
    await expect(sheet).toContainText(/5:45\s?\/km/);
    await expect(share(page).locator('img').first()).toHaveAttribute('alt', /temps 58:53, ritme mitjà 5:45\s\/km/);
    // What is told is the total and the average. The page says so, and says what it keeps to itself.
    await expect(page.locator('footer')).toContainText('ni el dia, ni l’hora, ni les pulsacions');
    // The same track on the page of a race is the race's route, not somebody's run.
    await open(page, '/ca/curses/marxa-de-les-tines/');
    const raceSheet = page.locator('main section', { hasText: 'Full de resultats' }).first();
    await expect(raceSheet).toContainText('Km-esforç');
    await expect(raceSheet).not.toContainText('Ritme mitjà');
    await expect(share(page).locator('img').first()).toHaveAttribute('alt', /punt més alt 313\sm/);
    await expect(share(page).locator('img').first()).not.toHaveAttribute('alt', /temps/);
  });

  test('a route added with the generator alone has its page, its sheet and its story, and is on the list', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, PAGES.routes);
    await expect(page.locator('main a[href="/ca/rutes/riera-de-santa-coloma/"]')).toHaveCount(1);
    await open(page, '/ca/rutes/riera-de-santa-coloma/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Riera de Santa Coloma');
    // What the outing was follows the first sentence, with a space between them.
    await expect(main(page)).toContainText(/D\+\. Anada i tornada des de Sils/);
    const sheet = page.locator('main section', { hasText: 'Full de resultats' }).first();
    await expect(sheet).toContainText(/12,13\skm/);
    await expect(sheet).toContainText('01:11:22');
    await expect(sheet).toContainText(/5:53\s?\/km/);
    // Run a second time, a little shorter: both outings are told, each with what its own GPX says.
    const outings = sheet.locator('[data-outings]');
    await expect(outings.getByRole('row')).toHaveCount(3);
    await expect(outings.getByRole('row').nth(1)).toContainText(/1 · traç.*12,13\skm.*01:11:22.*5:53\s?\/km/);
    await expect(outings.getByRole('row').nth(2)).toContainText(/2.*11,43\skm.*01:05:50.*5:46\s?\/km/);
    await expect(outings).toContainText('El traç, el perfil i les xifres de dalt són de la primera sortida.');
    await expect(share(page).getByRole('link', { name: 'Baixa-la' }).first()).toHaveAttribute('download', 'tram-rutes-riera-de-santa-coloma.png');
    expect((await page.request.get('/stories/rutes/riera-de-santa-coloma-nit.png')).status()).toBe(200);
    expect(await overflow(page)).toBe(0);
  });

  test('a page without a track has no story to offer', async ({ page }) => {
    await open(page, '/ca/curses/32a-marxa-dels-arrossars-2026/');
    await expect(share(page)).toHaveCount(0);
    expect((await page.request.get('/stories/curses/32a-marxa-dels-arrossars-2026.png')).status()).toBe(404);
  });
});

test.describe('Story maker', () => {
  const PATH = '/ca/stories/';
  const maker = (page: Page) => page.locator('[data-story-maker]');
  // A made-up outing: a line east, a point a second, climbing a metre a point. Nobody's run.
  const gpx = (lon: number, { times = true, name = 'Volta de prova' } = {}): string =>
    `<?xml version="1.0"?><gpx><trk><name>${name}</name><trkseg>${Array.from(
      { length: 30 },
      (_, i) => `<trkpt lat="41.8" lon="${(lon + i * 0.0001).toFixed(4)}"><ele>${100 + i}</ele>${times ? `<time>2020-01-01T00:00:${String(i).padStart(2, '0')}Z</time>` : ''}</trkpt>`,
    ).join('')}</trkseg></trk></gpx>`;
  const choose = (page: Page, text: string, name = 'sortida.gpx') => page.locator('input[name="gpx"]').setInputFiles({ name, mimeType: 'application/gpx+xml', buffer: Buffer.from(text) });
  /** The ICGC's elevation service, stood in for: a slope, in the grid that was asked for. What was asked is kept. */
  const relief = async (page: Page): Promise<string[]> => {
    const asked: string[] = [];
    await page.route('https://geoserveis.icgc.cat/**', (route) => {
      const params = new URL(route.request().url()).searchParams;
      asked.push(params.get('BBOX')!);
      const [cols, rows] = [Number(params.get('WIDTH')), Number(params.get('HEIGHT'))];
      const [minX, minY, maxX] = params.get('BBOX')!.split(',').map(Number);
      const lines = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => (90 + c * 0.6 + r * 0.9).toFixed(2)).join(' '));
      return route.fulfill({ status: 200, contentType: 'text/plain', headers: { 'Access-Control-Allow-Origin': '*' }, body: `NCOLS ${cols}\nNROWS ${rows}\nXLLCORNER ${minX}\nYLLCORNER ${minY}\nCELLSIZE ${(maxX! - minX!) / cols}\nNODATA_VALUE -9999.0\n${lines.join('\n')}\n` });
    });
    return asked;
  };
  const picture = (page: Page, theme: string) => maker(page).locator(`[data-story="${theme}"]`);

  test('draws the story of a visitor’s own GPX in the browser, in both themes, and asks only for the relief around it', async ({ page }) => {
    const asked = await relief(page);
    await open(page, PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('La teva sortida, en una story');
    await expect(page.locator('header nav a[aria-current="page"]')).toHaveText('Stories');
    await expect(main(page)).toContainText('El fitxer no s’envia enlloc');
    // Nothing is drawn and nothing is asked for until a file is chosen.
    await expect(maker(page).locator('[data-maker-results]')).toBeHidden();
    expect(asked).toEqual([]);
    await choose(page, gpx(2.7));
    await expect(maker(page)).toHaveAttribute('data-state', 'ready');
    await expect(maker(page).getByRole('status').first()).toHaveText('A punt: baixa la que vulguis.');
    // The name the file gives the outing is offered as its title.
    await expect(maker(page).getByLabel('Nom de la ruta')).toHaveValue('Volta de prova');
    for (const [theme, file] of [['light', 'tram-story-volta-de-prova.png'], ['night', 'tram-story-volta-de-prova-nit.png']] as const) {
      const image = picture(page, theme).locator('img');
      expect(await image.evaluate(async (img: HTMLImageElement) => (await img.decode(), [img.naturalWidth, img.naturalHeight]))).toEqual([1080, 1920]);
      await expect(image).toHaveAttribute('alt', /el recorregut sobre les corbes de nivell, distància 0,24\skm, temps 0:29, ritme mitjà \d:\d\d\s?\/km, desnivell positiu 27\sm\sD\+, i el perfil\.$/);
      await expect(picture(page, theme).getByRole('link', { name: 'Baixa-la' })).toHaveAttribute('download', file);
      await expect(picture(page, theme).getByRole('link', { name: 'Baixa-la' })).toHaveAttribute('href', /^blob:/);
    }
    // The one thing asked outside the page: a rectangle of ground, with its margin, in whole cells.
    expect(asked.length).toBeGreaterThanOrEqual(1);
    const [minX, minY, maxX, maxY] = asked[0]!.split(',').map(Number);
    expect(maxX! - minX!).toBeGreaterThan(800);
    expect(maxY! - minY!).toBeGreaterThanOrEqual(800);
    // Other words, and the time left out: drawn again without asking for anything again.
    const before = asked.length;
    await maker(page).getByLabel('Nom de la ruta').fill('Camí de l’estany');
    await expect(picture(page, 'light').getByRole('link', { name: 'Baixa-la' })).toHaveAttribute('download', 'tram-story-cami-de-l-estany.png');
    await maker(page).getByRole('radio', { name: 'Sense' }).check({ force: true });
    await expect(picture(page, 'light').locator('img')).toHaveAttribute('alt', /Camí de l’estany.*distància 0,24\skm, desnivell positiu 27\sm\sD\+, punt més alt 129\sm, i el perfil\.$/);
    expect(asked.length).toBe(before);
    expect(await overflow(page)).toBe(0);
  });

  test('an outing outside Catalonia is drawn without contour lines, and says so; the ICGC is not asked', async ({ page }) => {
    const asked = await relief(page);
    await open(page, PATH);
    await choose(page, gpx(-3.7));
    await expect(maker(page)).toHaveAttribute('data-state', 'ready');
    await expect(maker(page).getByRole('status').first()).toContainText('Fora de Catalunya no tenim relleu');
    await expect(picture(page, 'light').locator('img')).toHaveAttribute('alt', /: el recorregut, distància/);
    expect(asked).toEqual([]);
  });

  test('a file with no times has no time to tell, and a file that is not a GPX is refused in words', async ({ page }) => {
    await relief(page);
    await open(page, PATH);
    await choose(page, gpx(2.7, { times: false }));
    await expect(maker(page)).toHaveAttribute('data-state', 'ready');
    await expect(maker(page).getByRole('radio', { name: 'Amb temps i ritme' })).toBeDisabled();
    await expect(maker(page).getByRole('radio', { name: 'Sense' })).toBeChecked();
    await expect(picture(page, 'night').locator('img')).toHaveAttribute('alt', /punt més alt 129\sm/);
    await choose(page, '<html><body>No soc un GPX</body></html>', 'pagina.gpx');
    await expect(maker(page)).toHaveAttribute('data-state', 'error');
    await expect(maker(page).getByRole('status').first()).toHaveText('Aquest fitxer no és un GPX amb un traç.');
  });

  test('a route run twice says so on the list, and its stories lead to the maker', async ({ page }) => {
    await open(page, PAGES.routes);
    await expect(page.locator('main a[href="/ca/rutes/riera-de-santa-coloma/"]')).toContainText('Sils, la Selva · 2 sortides');
    await expect(page.locator('main a[href="/ca/rutes/sils/"]')).not.toContainText('sortides');
    await open(page, '/ca/rutes/riera-de-santa-coloma/');
    await expect(page.locator('[data-own-story]').getByRole('link')).toHaveAttribute('href', PATH);
  });
});

test.describe('Shoe catalogue (Phase 3)', () => {
  test('lists the models maker by maker with what each maker states, and draws a sole only where both heights are stated', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, PAGES.shoes);
    const catalog = page.locator('main [data-catalog]');
    await expect(catalog).toContainText('No són mesures nostres ni de cap laboratori');
    const rows = catalog.locator('[data-catalog-list] li a');
    expect(await rows.count()).toBeGreaterThanOrEqual(100);
    expect(await catalog.locator('[data-maker]').count()).toBeGreaterThanOrEqual(10);
    // Every row leads to a page of its own that exists, and no two to the same one.
    const hrefs = await rows.evaluateAll((links) => links.map((link) => link.getAttribute('href')!));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) expect((await page.request.get(href)).status(), href).toBe(200);
    // A model whose maker states its two heights has its sole drawn; one whose maker does not, has none.
    expect(await catalog.locator('a[href="/ca/sabatilles/nnormal/kjerag-02/"] svg.sole path').count()).toBeGreaterThan(2);
    await expect(catalog.locator('a[href="/ca/sabatilles/nnormal/kjerag-brut/"] svg.sole path')).toHaveCount(0);
    expect(await overflow(page)).toBe(0);
  });

  test('places on a map the models whose maker states both measures, each point a way into its page', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, PAGES.shoes);
    const [stack, drop] = [page.locator('[data-map-view="stack"]'), page.locator('[data-map-view="drop"]')];
    // One map at a time: by weight and height first, which fewer makers state than weight and drop.
    await expect(stack).toBeVisible();
    await expect(drop).toBeHidden();
    const placed = await stack.locator('[data-point]').count();
    expect(placed).toBeGreaterThanOrEqual(40);
    await expect(stack.locator('[data-map-count]')).toHaveText(String(placed));
    // A point says what it is and its two figures, and leads where the row of its model leads.
    const point = stack.locator('[data-point="puma/deviate-nitro-4"] a');
    await expect(point).toHaveAttribute('href', '/ca/sabatilles/puma/deviate-nitro-4/');
    await expect(point).toHaveAccessibleName(/Puma Deviate Nitro 4 250\sg · 38\smm/);
    // A model whose maker states no height is not on that map, and is on the other.
    await expect(stack.locator('[data-point="nike/pegasus-42"]')).toHaveCount(0);
    await expect(drop.locator('[data-point="nike/pegasus-42"]')).toHaveCount(1);
    // The figures of the map are in a table too.
    await expect(stack.locator('details table')).toHaveCount(1);
    expect(await stack.locator('details tbody tr').count()).toBe(placed);
    await page.getByRole('radio', { name: 'Pes i drop' }).check({ force: true });
    await expect(drop).toBeVisible();
    await expect(stack).toBeHidden();
    expect(await drop.locator('[data-point]').count()).toBeGreaterThan(placed);
    expect(new URL(page.url()).searchParams.get('mapa')).toBe('drop');
    expect(await overflow(page)).toBe(0);
  });

  test('filters by maker and by ground hide rows and points alike, and are kept in the address', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, PAGES.shoes);
    const filter = page.locator('[data-catalog-filter]');
    const rows = page.locator('[data-catalog-list] [data-shoe]:visible');
    const total = await rows.count();
    await expect(filter.locator('[data-status]')).toHaveText(`${total} models.`);
    await filter.getByLabel('Marca').selectOption('puma');
    await expect(filter.locator('[data-status]')).toHaveText(`12 de ${total} models.`);
    await expect(rows).toHaveCount(12);
    expect(new Set(await rows.evaluateAll((items) => items.map((item) => item.getAttribute('data-brand'))))).toEqual(new Set(['puma']));
    await expect(page.locator('[data-catalog-list] [data-maker]:visible')).toHaveCount(1);
    // The map keeps the points of what is left, and says how many they are.
    // A point is a place with no size of its own, so it is told shown by its attribute, not by its box.
    const points = page.locator('[data-map-view="stack"] [data-point]:not([hidden])');
    expect(await points.count()).toBeGreaterThan(0);
    expect(await points.evaluateAll((items) => items.every((item) => item.getAttribute('data-point')!.startsWith('puma/')))).toBe(true);
    await expect(page.locator('[data-map-view="stack"] [data-map-count]')).toHaveText(String(await points.count()));
    await filter.getByRole('radio', { name: /Muntanya/ }).check({ force: true });
    await expect(rows).toHaveCount(4);
    expect(new URL(page.url()).search).toBe('?marca=puma&terreny=trail');
    // A link to a filtered catalogue opens filtered.
    await page.reload();
    await expect(rows).toHaveCount(4);
    await expect(filter.getByLabel('Marca')).toHaveValue('puma');
    await filter.getByRole('button', { name: 'Treu els filtres' }).click();
    await expect(rows).toHaveCount(total);
    expect(new URL(page.url()).search).toBe('');
    // Filters that leave nothing say so.
    await filter.getByLabel('Marca').selectOption('asics');
    await filter.getByRole('radio', { name: /Muntanya/ }).check({ force: true });
    await expect(rows).toHaveCount(0);
    await expect(filter.locator('[data-status]')).toHaveText('Cap model amb aquests filtres.');
    await expect(page.locator('[data-map-view="stack"] [data-map-count]')).toHaveText('0');
    expect(await overflow(page)).toBe(0);
  });

  test('offers a way in by need: each is a page with its rule, its shoes in order and what the rule cannot say', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, PAGES.shoes);
    const ways = page.getByRole('navigation', { name: 'Què busques?' });
    await expect(ways.getByRole('heading', { name: 'Què busques?' })).toBeVisible();
    expect(await ways.getByRole('link').count()).toBeGreaterThanOrEqual(5);
    await ways.getByRole('link', { name: /^Lleugera · \d+$/ }).click();
    await expect(page).toHaveURL(/\/ca\/sabatilles\/lleugeres\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sabatilles lleugeres');
    // The rule, with its thresholds, and what it cannot judge.
    await expect(main(page)).toContainText(/pesen 230\sg o menys si són d’asfalt i 270\sg o menys si són de muntanya/);
    await expect(main(page)).toContainText('El llindar l’hem posat nosaltres.');
    await expect(page.locator('[data-blind]')).toContainText(/\d+ models no hi poden sortir: la seva marca no en declara el pes\./);
    // As many rows as the page says, the lightest first, each saying which size was weighed where the maker says it.
    const rows = page.locator('[data-catalog-list] [data-shoe]');
    const total = await rows.count();
    await expect(page.locator('[data-lead]')).toHaveText(new RegExp(`^${total} models de \\d+ marques\\.$`));
    await expect(rows.first()).toContainText('Hyperwarp Pure 2');
    await expect(rows.first()).toContainText(/135\sg/);
    await expect(rows.nth(2)).toContainText('Pes: aproximat, talla 9 d’home');
    // The filters of the catalogue work on this list too.
    const filter = page.locator('[data-catalog-filter]');
    await filter.getByRole('radio', { name: /Muntanya/ }).check({ force: true });
    const shown = page.locator('[data-catalog-list] [data-shoe]:visible');
    expect(await shown.count()).toBeGreaterThan(0);
    expect(await shown.count()).toBeLessThan(total);
    expect(new Set(await shown.evaluateAll((items) => items.map((item) => item.getAttribute('data-terrain'))))).toEqual(new Set(['trail']));
    await expect(filter.locator('[data-status]')).toHaveText(`${await shown.count()} de ${total} models.`);
    // From a need to the others, and back to the whole catalogue; never to itself.
    const others = page.getByRole('navigation', { name: 'Què busques?' });
    await expect(others.getByRole('link', { name: /^Lleugera/ })).toHaveCount(0);
    await expect(others.getByRole('link', { name: /^Drop baix · \d+$/ })).toHaveAttribute('href', '/ca/sabatilles/drop-baix/');
    await expect(others.getByRole('link', { name: 'Tot el catàleg' })).toHaveAttribute('href', '/ca/sabatilles/');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    expect(await overflow(page)).toBe(0);
  });

  test('a wide shoe is found by what its maker says: a wider version on sale, or a toe box it calls wide', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, PAGES.shoes);
    await page.getByRole('navigation', { name: 'Què busques?' }).getByRole('link', { name: /^Peu ample · \d+$/ }).click();
    await expect(page).toHaveURL(/\/ca\/sabatilles\/amples\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sabatilles per a peu ample');
    // No maker states a width in millimetres, and the page says what it cannot say.
    await expect(main(page)).toContainText('Cap marca declara l’amplada en mil·límetres');
    await expect(page.locator('[data-blind]')).toContainText('no vol dir que siguin estrets');
    const groups = page.locator('[data-catalog-list] section h3');
    await expect(groups).toHaveText([/^Amb una versió més ampla · \d+$/, /^La marca en destaca l’espai a la puntera · \d+$/]);
    // Each row says why, with the maker's own names and words.
    const row = (id: string) => page.locator(`[data-catalog-list] [data-shoe="${id}"]`);
    await expect(row('topo-athletic/atmos-2')).toContainText('També en Wide · «Roomy Toe Box»');
    await expect(row('hoka/clifton-11')).toContainText('També en Ancho i X-Ancho');
    await expect(row('nike/winflo-12')).toContainText('«We widened the toe box»');
    // A model with one width only is not here, and neither is one whose page could not be read.
    await expect(row('merrell/agility-peak-6')).toHaveCount(0);
    await expect(row('puma/deviate-nitro-4')).toHaveCount(0);
    // Wide and for the mountain: the filters of the catalogue, on this list.
    await page.locator('[data-catalog-filter]').getByRole('radio', { name: /Muntanya/ }).check({ force: true });
    const shown = page.locator('[data-catalog-list] [data-shoe]:visible');
    expect(await shown.count()).toBeGreaterThan(5);
    expect(new Set(await shown.evaluateAll((items) => items.map((item) => item.getAttribute('data-terrain'))))).toEqual(new Set(['trail']));
    expect(await overflow(page)).toBe(0);
  });

  test('a shoe says what its maker says of its width, where to find the wider version, and nothing when the page could not be read', async ({ page }) => {
    await open(page, '/ca/sabatilles/asics/gel-kayano-33/');
    const fit = page.locator('[data-fit]');
    await expect(fit.getByRole('link', { name: 'La normal, Wide i Extra Wide' })).toHaveAttribute('href', /asics\.com\/.*gel-kayano-33-wide/);
    await expect(fit).toContainText('Cap marca declara l’amplada en mil·límetres.');
    await expect(page.locator('[data-answers="amples"]').getByRole('link', { name: 'Peu ample' })).toHaveAttribute('href', '/ca/sabatilles/amples/');
    // One width, read on the page: said as such, and the shoe is on no list of wide ones.
    await open(page, '/ca/sabatilles/decathlon/kiprun-kipride/');
    await expect(page.locator('[data-fit]')).toContainText('Una de sola, a la pàgina consultada');
    await expect(page.locator('[data-fit]')).toContainText('«Ancho de pie: Medio»');
    await expect(page.locator('[data-fit]')).toContainText('No en destaca l’amplada');
    await expect(page.locator('[data-answers="amples"]')).toHaveCount(0);
    // A page that could not be settled: no width is given, and the reason is.
    await open(page, '/ca/sabatilles/puma/deviate-nitro-4/');
    await expect(page.locator('[data-fit] dl > div').first()).toContainText('Sense dada');
    await expect(page.locator('[data-fit]')).toContainText('no es tria');
  });

  test('every page by need lists only shoes its rule lets in, and a shoe says which lists it is on', async ({ page }) => {
    await open(page, '/ca/sabatilles/tacs-profunds/');
    const rows = page.locator('[data-catalog-list] [data-shoe]');
    expect(new Set(await rows.evaluateAll((items) => items.map((item) => item.getAttribute('data-terrain'))))).toEqual(new Set(['trail']));
    await expect(rows.first()).toContainText(/Tacs de \d(,\d)?\smm/);
    await open(page, '/ca/sabatilles/amb-placa/');
    await expect(page.locator('[data-catalog-list] section h3').first()).toHaveText(/^Placa de carboni · \d+$/);
    await expect(page.locator('[data-blind]')).toContainText('la pàgina de la marca no diu si en porten');
    // A shoe leads to the lists it is on, next to its ground.
    await open(page, '/ca/sabatilles/nike/streakfly-2/');
    await expect(page.locator('[data-answers="lleugeres"]').getByRole('link', { name: 'Lleugera' })).toHaveAttribute('href', '/ca/sabatilles/lleugeres/');
    await expect(page.locator('[data-answers="tacs-profunds"]')).toHaveCount(0);
  });

  test('compares any two models of the catalogue: figure by figure, with the soles over one another and a warning where figures were not taken alike', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/ca/comparar/');
    const result = page.locator('[data-compare-result]');
    // Nothing is compared until two are chosen.
    await expect(result).toBeHidden();
    await expect(page.locator('[data-status]')).toHaveText('Tria dos models.');
    await page.getByLabel('Primer model').selectOption('puma/deviate-nitro-4');
    await expect(page.locator('[data-status]')).toHaveText('Tria l’altre model.');
    await page.getByLabel('Segon model').selectOption('scarpa/spin-race');
    await expect(result).toBeVisible();
    await expect(result.getByRole('heading', { level: 2 })).toHaveText('Puma Deviate Nitro 4 vs Scarpa Spin Race');
    await expect(page).toHaveTitle(/^Puma Deviate Nitro 4 vs Scarpa Spin Race/);
    // The pair is in the address as it reads.
    expect(new URL(page.url()).search).toBe('?a=puma/deviate-nitro-4&b=scarpa/spin-race');
    // The table: each figure of each model and the second less the first.
    const row = (name: string) => result.getByRole('row', { name });
    await expect(row('Pes')).toContainText(/250\sg.*215\sg.*−35\sg/);
    await expect(row('Alçada al taló')).toContainText(/38\smm.*18\smm.*−20\smm/);
    await expect(row('Drop')).toContainText(/8\smm.*4\smm.*−4\smm/);
    // No difference is taken against a figure a maker does not state.
    await expect(row('Profunditat dels tacs')).toContainText('no es pot comparar');
    // Both makers state the two heights: the two soles are drawn, and no other.
    await expect(page.locator('[data-sole]:not([hidden])')).toHaveCount(2);
    await expect(page.locator('[data-sole="puma/deviate-nitro-4"]')).toHaveAttribute('data-shoe', 'a');
    await expect(page.locator('[data-sole="scarpa/spin-race"]')).toHaveAttribute('data-shoe', 'b');
    // Two makers: their heights are not measured alike, and the page says so. Both weights are of a size 42: no warning there.
    await expect(page.locator('[data-caveat="height"]')).toBeVisible();
    await expect(page.locator('[data-caveat="weight"]')).toBeHidden();
    // A card to each of the two, the first first, with the way to its page and to its maker's.
    const cards = page.locator('[data-card]:visible');
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toContainText('Deviate Nitro 4');
    await expect(cards.first().getByRole('link', { name: 'La fitxa sencera' })).toHaveAttribute('href', '/ca/sabatilles/puma/deviate-nitro-4/');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    expect(await overflow(page)).toBe(0);
    // The other way round, every difference changes its sign.
    await page.getByRole('button', { name: 'Canvia’n l’ordre' }).click();
    await expect(row('Pes')).toContainText(/215\sg.*250\sg.*\+35\sg/);
    await expect(result.getByRole('heading', { level: 2 })).toHaveText('Scarpa Spin Race vs Puma Deviate Nitro 4');
  });

  test('a comparison opens from its address, and says what cannot be drawn or was not weighed alike', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // A maker that states no height: its sole is not drawn, and none is guessed.
    await open(page, '/ca/comparar/?a=nike/vaporfly-4&b=puma/deviate-nitro-4');
    await expect(page.locator('[data-compare-result]')).toBeVisible();
    await expect(page.getByLabel('Primer model')).toHaveValue('nike/vaporfly-4');
    await expect(page.locator('[data-soles]')).toBeHidden();
    await expect(page.locator('[data-soles-none]')).toContainText('La marca de Nike Vaporfly 4 no en declara les dues alçades.');
    await expect(page.locator('[data-compare-result]').getByRole('row', { name: 'Alçada al taló' })).toContainText('no es pot comparar');
    // One weighed at a men's 9, the other at a 42: the difference is given, with the warning.
    await expect(page.locator('[data-compare-result]').getByRole('row', { name: 'Pes' })).toContainText(/190\sg.*250\sg.*\+60\sg/);
    await expect(page.locator('[data-caveat="weight"]')).toContainText('Els dos pesos no es van prendre igual. Nike Vaporfly 4: aproximat, talla 9 d’home. Puma Deviate Nitro 4: talla 42.');
    // A model that is not in the catalogue is not chosen, and the same model twice is not a pair.
    await open(page, '/ca/comparar/?a=cap/model&b=puma/deviate-nitro-4');
    await expect(page.locator('[data-compare-result]')).toBeHidden();
    await expect(page.locator('[data-status]')).toHaveText('Tria l’altre model.');
    await page.getByLabel('Primer model').selectOption('puma/deviate-nitro-4');
    await expect(page.locator('[data-status]')).toHaveText('Tria dos models diferents.');
    await expect(page.locator('[data-compare-result]')).toBeHidden();
  });

  test('two points picked on the map lead to their comparison, and a shoe’s page to the comparator with it chosen', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, PAGES.shoes);
    const maps = page.locator('[data-catalog-maps]');
    const point = (id: string) => maps.locator(`[data-map-view="stack"] [data-point="${id}"]`);
    // As the page opens, a point is a link and nothing is asked.
    await expect(maps.locator('[data-pick]')).toBeHidden();
    await expect(point('puma/deviate-nitro-4').locator('a')).not.toHaveAttribute('role', 'button');
    await page.getByRole('radio', { name: 'Tria’n dos i compara' }).check({ force: true });
    await expect(maps.locator('[data-pick-status]')).toHaveText('Toca dos punts del mapa.');
    // Picking does not leave the page: the point is a button that is pressed.
    await point('puma/deviate-nitro-4').locator('a').click({ force: true });
    await expect(page).toHaveURL(/\/ca\/sabatilles\//);
    await expect(point('puma/deviate-nitro-4').getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    await expect(maps.locator('[data-pick-status]')).toHaveText('Puma Deviate Nitro 4. Toca’n un altre.');
    await expect(maps.locator('[data-pick-go]')).toBeHidden();
    await point('scarpa/spin-race').locator('a').click({ force: true });
    await expect(maps.locator('[data-pick-status]')).toHaveText('Puma Deviate Nitro 4 i Scarpa Spin Race.');
    // A third pick takes the place of the first.
    await point('altra/timp-6').locator('a').click({ force: true });
    await expect(maps.locator('[data-pick-status]')).toHaveText('Scarpa Spin Race i Altra Timp 6.');
    await expect(point('puma/deviate-nitro-4')).not.toHaveAttribute('data-picked', '');
    await maps.getByRole('link', { name: 'Compara’ls' }).click();
    await expect(page.locator('[data-compare-result]').getByRole('heading', { level: 2 })).toHaveText('Scarpa Spin Race vs Altra Timp 6');
    // From the page of a shoe, the comparator opens with it chosen.
    await open(page, '/ca/sabatilles/puma/deviate-nitro-4/');
    await page.locator('main [data-compare] a').click();
    await expect(page.getByLabel('Primer model')).toHaveValue('puma/deviate-nitro-4');
    await expect(page.locator('[data-status]')).toHaveText('Tria l’altre model.');
  });

  // The photo models of the catalogue are made of the makers' photos, which are kept out of the repository:
  // they are there on the machine that made them and not where the tests run in CI. Both cases are told.
  const PHOTO = (maker: string, model: string): boolean => existsSync(`src/content/shoes-local/catalog/${maker}/${model}/model.json`);

  test('a shoe of the catalogue turns in 3D where its photo model is, and has no 3D view where it is not', async ({ page }) => {
    // With motion as it comes: asked to reduce it, a 3D view waits for its button instead of starting by itself.
    test.setTimeout(120_000);
    await open(page, '/ca/sabatilles/puma/deviate-nitro-4/');
    const viewer = page.locator('main [data-shoe-viewer]');
    if (PHOTO('puma', 'deviate-nitro-4')) {
      await expect(viewer).toHaveCount(1);
      await viewer.scrollIntoViewIfNeeded();
      await expect(page.locator('#shoe-3d')).toHaveAttribute('data-state', 'ready', { timeout: 90_000 });
      await expect(main(page)).toContainText('No és un escaneig: són les fotos oficials de Puma');
      await expect(main(page)).toContainText('La mida és nominal');
    } else await expect(viewer).toHaveCount(0);
    // A shoe whose photo model is not there has no 3D view: on a machine without the makers' photos, none has.
    await open(page, '/ca/sabatilles/puma/voyage-nitro-4/');
    await expect(page.locator('main [data-shoe-viewer]')).toHaveCount(PHOTO('puma', 'voyage-nitro-4') ? 1 : 0);
    expect(await overflow(page)).toBe(0);
  });

  test('the comparator sets two shoes face to face in 3D only when both have a photo model', async ({ page }) => {
    // With motion as it comes: asked to reduce it, a 3D view waits for its button instead of starting by itself.
    test.setTimeout(120_000);
    const faces = page.locator('[data-faces]');
    await open(page, '/ca/comparar/?a=puma/deviate-nitro-4&b=merrell/agility-peak-6');
    await expect(page.locator('[data-compare-result]')).toBeVisible();
    if (PHOTO('puma', 'deviate-nitro-4') && PHOTO('merrell', 'agility-peak-6')) {
      await expect(faces).toBeVisible();
      // Only the two of the pair: the first as it is, the second as its mirror image.
      const shown = page.locator('[data-face]:visible');
      await expect(shown).toHaveCount(2);
      await expect(shown.first()).toHaveAttribute('data-face', 'puma/deviate-nitro-4');
      await expect(shown.first().locator('[data-shoe-viewer]')).toHaveAttribute('data-shoe-mirror', 'false');
      await expect(shown.last()).toHaveAttribute('data-face', 'merrell/agility-peak-6');
      await expect(shown.last().locator('[data-shoe-viewer]')).toHaveAttribute('data-shoe-mirror', 'true');
      await faces.scrollIntoViewIfNeeded();
      const [first, second] = [page.locator('#face-a-puma-deviate-nitro-4'), page.locator('#face-b-merrell-agility-peak-6')];
      for (const viewer of [first, second]) await expect(viewer).toHaveAttribute('data-state', 'ready', { timeout: 90_000 });
      // Facing each other: one is the other turned round.
      await expect(first.locator('canvas')).toHaveAttribute('data-moving', 'false', { timeout: 60_000 });
      const yaw = async (viewer: typeof first): Promise<number> => Number(await viewer.locator('canvas').getAttribute('data-yaw'));
      expect((await yaw(first)) + (await yaw(second))).toBeCloseTo(Math.PI, 2);
      // Which shoes have a 3D view is said by the shorter list: theirs, or that of the ones without.
      await expect(page.locator('[data-in-3d]')).toContainText(/vista 3D/);
      // One of the two without a model: no face to face, and nothing said in its place.
      if (!PHOTO('scarpa', 'spin-race')) {
        await page.getByLabel('Segon model').selectOption('scarpa/spin-race');
        await expect(faces).toBeHidden();
      }
      expect(await overflow(page)).toBe(0);
    } else await expect(faces).toBeHidden();
  });

  test('a shoe of the catalogue gives its maker’s figures with a link to the maker’s page, and is told to no search engine', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/ca/sabatilles/nnormal/kjerag-02/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kjerag 02');
    await expect(main(page)).toContainText('no les hem mesurat');
    for (const figure of [/214\sg/, /26\smm/, /20\smm/, /6\smm/, /3,5\smm/, 'talla UK 7,5', 'Vibram Megagrip Litebase']) await expect(main(page)).toContainText(figure);
    await expect(page.locator('main [data-source] a')).toHaveAttribute('href', /^https:\/\/www\.nnormal\.com\//);
    // The profile is drawn from the two stated heights, and says what it is drawn without.
    await expect(page.getByRole('img', { name: /Perfil lateral de NNormal Kjerag 02/ })).toBeVisible();
    await expect(main(page)).toContainText('Dibuixat sense dada');
    await expect(main(page)).toContainText('no es poden comparar al mil·límetre');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
    await expect(page.locator('footer')).toContainText('pendent de revisió legal');
    expect(await overflow(page)).toBe(0);
  });

  test('what a maker’s page says against itself is told in its own words, and is not settled for it', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/ca/sabatilles/puma/fast-trac-nitro-4/');
    await expect(page.locator('main [data-note]')).toContainText('dos drops, 12 mm i 6 mm');
    for (const figure of [/286\sg/, /32\smm/, /26\smm/, 'talla 42']) await expect(main(page)).toContainText(figure);
    await expect(page.locator('main [data-source] a')).toHaveAttribute('href', /^https:\/\/eu\.puma\.com\//);
    expect(await overflow(page)).toBe(0);
  });

  test('what a maker does not state is absent, and a shoe without its two heights is not drawn', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/ca/sabatilles/nnormal/kjerag-brut/');
    await expect(main(page)).toContainText(/6,5\smm/);
    await expect(main(page)).toContainText('Sense dada');
    await expect(main(page)).toContainText(/No en dibuixem cap d.estimat/);
    await expect(page.getByRole('img', { name: /Perfil lateral/ })).toHaveCount(0);
    // A weight stated in ounces is shown in grams, with the figure as the maker wrote it.
    await open(page, '/ca/sabatilles/topo-athletic/cyclone-3/');
    await expect(main(page)).toContainText(/196\sg/);
    await expect(main(page)).toContainText('6,9 oz, talla M9');
  });
});

// «Palamós a peu»: the town in 3D, a program of its own (a Godot export of some 52 MB) that is not kept in
// the repository. The build under test may carry it or not, so these tests answer for it themselves.
test.describe('Palamós on foot', () => {
  const PATH = PAGES['on-foot'];
  const stage = (page: Page) => page.getByRole('group', { name: 'Palamós a peu' });
  const STAND_IN = `<!doctype html><title>Joc</title><p>Joc de mostra</p><script>addEventListener('load', () => parent.postMessage({ source: 'tram-palamos', state: 'ready', detail: new URLSearchParams(location.search).get('mode') }, location.origin))</script>`;
  /** The site with the game (a stand-in for it) or without it, whatever the build has. */
  const serve = async (page: Page, present: boolean): Promise<string[]> => {
    const asked: string[] = [];
    await page.route('**/mon/palamos/**', (route) => {
      const url = new URL(route.request().url());
      asked.push(`${route.request().method()} ${url.pathname}${url.search}`);
      if (!present) return route.fulfill({ status: 404, body: 'Not found' });
      return url.pathname.endsWith('manifest.json') ? route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }) : route.fulfill({ status: 200, contentType: 'text/html', body: STAND_IN });
    });
    return asked;
  };

  test('says what it is and what it weighs, and asks for nothing of the game until a button is pressed', async ({ page }) => {
    const asked = await serve(page, true);
    await open(page, PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Palamós a peu');
    // The length is the one the game shows on its own screen.
    await expect(main(page)).toContainText(/la ruta sencera, de 10,2\skm/);
    await expect(stage(page).getByRole('img', { name: /Vista aèria del Palamós en 3D: la platja Gran/ })).toBeVisible();
    await expect(stage(page).getByRole('button', { name: 'Corre la ruta' })).toHaveAttribute('data-variant', 'primary');
    await expect(stage(page).getByRole('button', { name: 'Passeja pel teu compte' })).toBeVisible();
    await expect(stage(page)).toContainText('Baixa uns 52 MB. Millor amb wifi.');
    await expect(page.locator('iframe')).toHaveCount(0);
    expect(asked).toEqual([]);
    await expect(page.locator('footer')).toContainText('© Institut Cartogràfic i Geològic de Catalunya (ICGC), CC BY 4.0');
    await expect(page.locator('footer')).toContainText('© col·laboradors d’OpenStreetMap, ODbL');
  });

  test('the poster is light, and a phone gets a cut of its own', async ({ page, request }) => {
    await open(page, PATH);
    const picture = stage(page).locator('picture');
    const addresses = [...(await picture.locator('source').evaluateAll((all) => all.map((source) => source.getAttribute('srcset')!))), (await picture.locator('img').getAttribute('src'))!];
    expect(addresses).toHaveLength(4);
    for (const address of addresses) expect(Number((await request.get(address)).headers()['content-length']), address).toBeLessThan(200_000);
    await expect(picture.locator('source[media]')).toHaveCount(2);
    await expect(picture.locator('img')).toHaveAttribute('fetchpriority', 'high');
  });

  test('pressing a button opens the game in its mode, in a frame; «Tanca» takes it away', async ({ page }) => {
    const asked = await serve(page, true);
    await open(page, PATH);
    await stage(page).getByRole('button', { name: 'Passeja pel teu compte' }).click();
    await expect(stage(page)).toHaveAttribute('data-state', 'ready');
    expect(asked.slice(0, 2)).toEqual(['HEAD /mon/palamos/manifest.json', 'GET /mon/palamos/index.html?mode=explora']);
    await expect(stage(page).locator('iframe')).toHaveAttribute('allow', 'fullscreen');
    await expect(page.frameLocator('iframe').getByText('Joc de mostra')).toBeVisible();
    await expect(stage(page).getByRole('img')).toBeHidden();
    expect(await overflow(page)).toBe(0);
    await stage(page).getByRole('button', { name: 'Tanca' }).click();
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(stage(page).getByRole('img')).toBeVisible();
    await expect(stage(page).getByRole('button', { name: 'Passeja pel teu compte' })).toBeFocused();
  });

  test('whoever walks freely chooses where to start, and the game is told; the route starts where it starts', async ({ page }) => {
    const asked = await serve(page, true);
    await open(page, PATH);
    const place = stage(page).getByRole('combobox', { name: 'On comença el passeig' });
    await expect(place.getByRole('option')).toHaveText(['Passeig del Mar', 'Carrer Major, al nucli antic', 'Far de Palamós']);
    await expect(place).toHaveValue('passeig');
    await place.selectOption({ label: 'Far de Palamós' });
    await stage(page).getByRole('button', { name: 'Passeja pel teu compte' }).click();
    await expect(stage(page)).toHaveAttribute('data-state', 'ready');
    // Where, and towards what: metres east and south of the origin of the game.
    expect(asked[1]).toBe('GET /mon/palamos/index.html?mode=explora&at=541.5%2C758&look=558%2C778');
    await expect(place).toBeHidden();
    await stage(page).getByRole('button', { name: 'Tanca' }).click();
    // The choice is still the one made, and it says nothing to the route.
    await expect(place).toHaveValue('far');
    await stage(page).getByRole('button', { name: 'Corre la ruta' }).click();
    await expect(stage(page)).toHaveAttribute('data-state', 'ready');
    expect(asked.at(-1)).toBe('GET /mon/palamos/index.html?mode=ruta');
    await expect(main(page)).toContainText('Qui passeja pel seu compte tria on comença: Passeig del Mar, Carrer Major, al nucli antic o Far de Palamós.');
  });

  test('a link may name the place the walk starts at, and nothing starts by itself', async ({ page }) => {
    const asked = await serve(page, true);
    await open(page, `${PATH}?mode=explora&lloc=nucli-antic`);
    await expect(stage(page).getByRole('combobox', { name: 'On comença el passeig' })).toHaveValue('nucli-antic');
    await expect(stage(page).getByRole('button', { name: 'Passeja pel teu compte' })).toBeFocused();
    expect(asked).toEqual([]);
    // A place the stage does not have changes nothing.
    await open(page, `${PATH}?lloc=la-lluna`);
    await expect(stage(page).getByRole('combobox', { name: 'On comença el passeig' })).toHaveValue('passeig');
  });

  test('a build that does not carry the game says so instead of opening it', async ({ page }) => {
    await serve(page, false);
    await open(page, PATH);
    await stage(page).getByRole('button', { name: 'Corre la ruta' }).click();
    await expect(stage(page).getByRole('status')).toHaveText('Aquesta versió de la web no porta el joc.');
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(stage(page).getByRole('img')).toBeVisible();
  });

  test('a link that asks for a mode starts nothing by itself: its button is the main one and has the focus', async ({ page }) => {
    const asked = await serve(page, true);
    await open(page, `${PATH}?mode=explora`);
    await expect(stage(page).getByRole('button', { name: 'Passeja pel teu compte' })).toBeFocused();
    await expect(stage(page).getByRole('button', { name: 'Passeja pel teu compte' })).toHaveAttribute('data-variant', 'primary');
    await expect(stage(page).getByRole('button', { name: 'Corre la ruta' })).toHaveAttribute('data-variant', 'secondary');
    await expect(stage(page).getByRole('button', { name: 'Passeja pel teu compte' })).toBeInViewport();
    await expect(page.locator('iframe')).toHaveCount(0);
    expect(asked).toEqual([]);
  });

  test('what the game shows is also in the page, in words: how it is played, and what of it is data and what is not', async ({ page }) => {
    await open(page, PATH);
    const keys = page.getByRole('table', { name: 'Amb teclat i ratolí' });
    await expect(keys.getByRole('row', { name: /W A S D/ })).toContainText('Mou el corredor');
    await expect(keys.getByRole('row', { name: /1 2 3 4/ })).toContainText('×1, ×2, ×4 i ×8');
    await expect(keys.getByRole('row', { name: /Tab/ })).toContainText('Canvia entre seguir la ruta i portar-lo tu');
    await expect(main(page)).toContainText('El polze esquerre mou el corredor i el dret gira la càmera.');
    const real = page.getByRole('table', { name: 'De debò: surt de dades' });
    await expect(real.getByRole('row', { name: /El relleu/ })).toContainText(/ICGC, amb un punt cada 5\sm/);
    await expect(real.getByRole('row', { name: /L’alçada de cada casa i els arbres/ })).toContainText('LiDAR de l’ICGC (2021-2023): 5.441 cases i 11.917 arbres');
    await expect(real.getByRole('row', { name: /Els carrers/ })).toContainText('OpenStreetMap');
    await expect(real.getByRole('row', { name: /El nom i el lloc de comerços/ })).toContainText('OpenStreetMap: 329 rètols i 41 llocs amb el nom a sobre');
    const decoration = page.locator('main section', { hasText: 'Què és de debò i què no' });
    await expect(decoration).toContainText('Les façanes: finestres, balcons, portes i el color de la paret.');
    await expect(decoration).toContainText('Els rètols: la mida, el color, la lletra i a quina paret de la casa pengen.');
    await expect(decoration).toContainText('El corredor, que és un maniquí.');
    // The pace is the game's, and is said to be.
    await expect(decoration).toContainText(/a 5:00\s\/km, que és un ritme fix del joc, no el de la sortida/);
  });

  test('the menu leads to it and marks it alone; the page of the route leads to it with the runner on the route', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, PATH);
    await expect(page.locator('header nav a[aria-current="page"]')).toHaveText(['Palamós a peu']);
    await open(page, '/ca/rutes/palamos/');
    await expect(page.locator('header nav a[aria-current="page"]')).toHaveText(['Rutes']);
    await expect(page.locator('header nav').getByRole('link', { name: 'Palamós a peu' })).toHaveAttribute('href', PATH);
    const block = page.locator('main section', { hasText: 'Corre-la dins de Palamós' });
    await expect(block).toContainText('La mateixa ruta, vista des de terra: un corredor la fa pel Palamós en 3D.');
    await expect(block.getByRole('link', { name: 'Obre Palamós a peu' })).toHaveAttribute('href', `${PATH}?mode=ruta`);
    // The view of the route has its two ways of seeing the terrain; the old view from the ground is not one of them.
    await expect(page.locator('tram-route-scroller').getByRole('radio')).toHaveCount(2);
    await expect(page.getByRole('radio', { name: 'A peu' })).toHaveCount(0);
    expect(await overflow(page)).toBe(0);
    // A route without a town to be run in offers none.
    await open(page, '/ca/rutes/sils/');
    await expect(page.locator('main a[href*="/a-peu/"]')).toHaveCount(0);
    expect((await page.request.get('/ca/rutes/sils/a-peu/')).status()).toBe(404);
  });
});

test.describe('Robots and sitemaps', () => {
  test('the test environment names no sitemap and shuts no crawler out: what keeps it from search engines is said on every response', async ({ page }) => {
    const robots = await page.request.get('/robots.txt');
    expect(robots.status()).toBe(200);
    const text = await robots.text();
    expect(text).toMatch(/^User-agent: \*$/m);
    expect(text).not.toMatch(/Sitemap/);
    expect(text).not.toMatch(/^Disallow: \//m);
    // The sitemaps are of the site itself: `check-sitemap` reads them on its build.
    expect((await page.request.get('/sitemap-index.xml')).status()).toBe(404);
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
    const data = JSON.parse((await page.locator('script[type="application/ld+json"]:not([data-breadcrumbs])').textContent()) ?? '{}');
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

// The flight and the view from the ground of the route viewer are parked (`FLIGHT_OFFERED` and `OFFERED_MODES`
// in `islands/viewer-mode.ts`): neither is offered, and their code stays. The two groups after this one are
// their tests, skipped until they are offered again.
test.describe('Parked views of the route viewer', () => {
  for (const path of [ROUTE_PAGES['route-flat'], ROUTE_PAGES['race-trail'], '/ca/rutes/palamos/']) {
    test(`${path} offers two ways of seeing the terrain and no flight`, async ({ page }) => {
      await open(page, path);
      const scroller = page.locator('tram-route-scroller');
      await expect(scroller.getByRole('radio')).toHaveCount(2);
      for (const name of ['Realista', 'Cartogràfic']) await expect(scroller.getByRole('radio', { name })).toBeAttached();
      await expect(scroller.getByRole('radio', { name: 'A peu' })).toHaveCount(0);
      await expect(scroller.locator('[data-fly]')).toHaveCount(0);
      await expect(scroller.getByRole('button', { name: /vol/i })).toHaveCount(0);
      // What was said about the view from the ground is not said without it.
      await expect(scroller).not.toContainText('A peu:');
      await expect(scroller).not.toContainText('Modelat a mà');
      await expect(scroller).toContainText('Institut Cartogràfic i Geològic de Catalunya');
    });
  }

  test('a reader who had chosen the view from the ground gets the realistic one', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('tram-viewer-mode', 'walk'));
    await open(page, ROUTE_PAGES['route-flat']);
    await expect(page.locator('tram-route-scroller').getByRole('radio', { name: 'Realista' })).toBeChecked();
  });
});

test.describe.skip('Flight over a route', () => {
  const km = async (page: Page): Promise<number> => Number((await page.locator('tram-route-scroller [data-out="km"]').textContent())!.replace(',', '.'));

  test('a button flies the route by itself, and a scroll by hand or the button again lands it', async ({ page }) => {
    // The 3D view loads while the flight starts: on a slow machine it holds the page for a while, and the flight catches up after.
    test.setTimeout(120_000);
    await open(page, ROUTE_PAGES['route-flat']);
    const scroller = page.locator('tram-route-scroller');
    const fly = scroller.getByRole('button', { name: 'Fes el vol' });
    await fly.scrollIntoViewIfNeeded();
    await expect(fly).toHaveAttribute('aria-pressed', 'false');
    const before = await km(page);
    await fly.click();
    // Pressed, the button says how to stop, and the route runs with no hand on it.
    const land = scroller.getByRole('button', { name: 'Atura el vol' });
    await expect(land).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => km(page), { timeout: 60_000 }).toBeGreaterThan(before + 0.15);
    await land.click();
    await expect(fly).toHaveAttribute('aria-pressed', 'false');
    const landed = await km(page);
    await page.waitForTimeout(600);
    expect(await km(page)).toBeCloseTo(landed, 1);
    // A flight that is scrolled by hand lands where the hand takes it.
    await fly.click();
    await expect(land).toHaveAttribute('aria-pressed', 'true');
    await page.mouse.wheel(0, 40);
    await expect(fly).toHaveAttribute('aria-pressed', 'false');
  });

  test('is not offered to who asked for less motion: the scroll runs the route as ever', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, ROUTE_PAGES['route-flat']);
    await expect(page.locator('tram-route-scroller [data-fly]')).toBeHidden();
  });
});

test.describe.skip('Route on foot', () => {
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
    const canvas = viewer.locator('canvas[data-engine^="three-walk"][data-trees]');
    await expect(canvas).toBeVisible({ timeout: 120_000 });
    await expect(viewer).toHaveAttribute('data-state', 'ready');
    expect(Number(await canvas.getAttribute('data-trees'))).toBeGreaterThan(1000);
    // The choice is kept for the next visit, as the other two.
    expect(await page.evaluate(() => localStorage.getItem('tram-viewer-mode'))).toBe('walk');
    // Once the route is under way the ground by the runner is covered: grass, scrub, stones.
    await page.evaluate(() => (document.querySelector('tram-route-scroller') as HTMLElement & { goTo(share: number): void }).goTo(0.3));
    await expect.poll(async () => Number(await canvas.getAttribute('data-plants')), { timeout: 90_000 }).toBeGreaterThan(500);
  });

  test('tells a town house by house, names its places and says where each thing comes from', async ({ page }) => {
    await open(page, '/ca/rutes/palamos/');
    const scroller = page.locator('tram-route-scroller');
    // Three sources, each credited next to the view, and what is decoration said as such.
    await expect(scroller).toContainText('Dirección General del Catastro');
    await expect(scroller).toContainText('OpenStreetMap');
    await expect(scroller).toContainText('color de les parets, matolls, herba i pedres, de decoració');
    await scroller.getByRole('radio', { name: 'A peu' }).check({ force: true });
    const viewer = scroller.locator('tram-viewer-3d');
    await viewer.scrollIntoViewIfNeeded();
    const canvas = viewer.locator('canvas[data-engine^="three-walk"][data-houses]');
    await expect(canvas).toBeVisible({ timeout: 150_000 });
    await expect(viewer).toHaveAttribute('data-state', 'ready');
    // The cadastre tells the houses of the seafront apart, and the map and OpenStreetMap name what the route passes.
    expect(Number(await canvas.getAttribute('data-houses'))).toBeGreaterThan(2000);
    expect(Number(await canvas.getAttribute('data-names'))).toBeGreaterThan(40);
    // The lighthouse is modelled by hand, and the page says so.
    expect(await canvas.getAttribute('data-landmarks')).toBe('1');
    await expect(scroller).toContainText('Modelat a mà a partir de fotografies: Far de Palamós');
    // A name of the map is written over its place once the runner is near it.
    await page.evaluate(() => (document.querySelector('tram-route-scroller') as HTMLElement & { goTo(share: number): void }).goTo(0.5));
    await expect(viewer.locator('[data-scene-label="name"]:not([hidden])').first()).toBeVisible({ timeout: 90_000 });
  });
});
