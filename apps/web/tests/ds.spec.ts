import { expect, type Page, test } from '@playwright/test';

const PAGES = {
  index: '/ds/',
  foundations: '/ds/fonaments/',
  measure: '/ds/primitives/measure/',
  'data-table': '/ds/primitives/data-table/',
  bib: '/ds/patterns/bib/',
  'stat-block': '/ds/patterns/stat-block/',
  'elevation-profile': '/ds/patterns/elevation-profile/',
  'segmented-control': '/ds/interactive/segmented-control/',
};

const open = async (page: Page, path: string): Promise<void> => {
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
};

for (const [name, path] of Object.entries(PAGES)) {
  test(`${name} matches its baseline`, async ({ page }) => {
    await open(page, path);
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

  test('says so when there is no route', async ({ page }) => {
    await open(page, PAGES['elevation-profile']);
    await expect(page.getByTestId('absent').getByText('Sense perfil')).toBeVisible();
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
