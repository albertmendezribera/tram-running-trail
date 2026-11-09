import { defineConfig } from '@playwright/test';

const PORT = 4329;
const VIEWPORTS = { mobile: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
const SCHEMES = { light: 'light', night: 'dark' } as const;

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  reporter: [['list'], ['html', { open: 'never' }]],
  // No platform in the path: baselines are only generated in the CI image (E17).
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  expect: { toHaveScreenshot: { animations: 'disabled' } },
  use: { baseURL: `http://localhost:${PORT}` },
  projects: Object.entries(VIEWPORTS).flatMap(([size, viewport]) =>
    Object.entries(SCHEMES).map(([theme, colorScheme]) => ({
      name: `${size}-${theme}`,
      use: { viewport, colorScheme },
    })),
  ),
  webServer: {
    command: `pnpm build:ds && pnpm preview --port ${PORT}`,
    url: `http://localhost:${PORT}/ds/`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
