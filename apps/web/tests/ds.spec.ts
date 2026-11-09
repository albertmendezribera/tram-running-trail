import { expect, type Page, test } from '@playwright/test';

const PAGES = {
  index: '/ds/',
  foundations: '/ds/fonaments/',
  measure: '/ds/primitives/measure/',
  bib: '/ds/patterns/bib/',
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

test('Measure gives screen readers a name for an absent value', async ({ page }) => {
  await open(page, PAGES.measure);
  await expect(page.getByTestId('absent').getByText('Sense dada').first()).toBeAttached();
});
