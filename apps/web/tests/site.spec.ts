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
    expect(heights).toHaveLength(3);
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
      await expect(story.locator('img')).toHaveAttribute('alt', /^Imatge vertical de Calonge \((clara|fosca)\): .*distància 12,41\skm, desnivell positiu 340\sm\sD\+, punt més alt 313\sm/);
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

  test('a page without a track has no story to offer', async ({ page }) => {
    await open(page, '/ca/curses/32a-marxa-dels-arrossars-2026/');
    await expect(share(page)).toHaveCount(0);
    expect((await page.request.get('/stories/curses/32a-marxa-dels-arrossars-2026.png')).status()).toBe(404);
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
