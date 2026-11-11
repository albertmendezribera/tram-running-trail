import { defineConfig } from '@playwright/test';

const PORT = 4329;
const VIEWPORTS = { mobile: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
const SCHEMES = { light: 'light', night: 'dark' } as const;

// scripts/visual-docker.sh runs the CI image under x86 emulation on a Mac, several
// times slower than CI: fewer workers and more time there. CI keeps the defaults.
const emulated = process.env['TRAM_EMULATED'] === '1';

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  ...(emulated ? { workers: 2, timeout: 90_000 } : {}),
  forbidOnly: Boolean(process.env['CI']),
  // On GitHub a failed test also becomes an annotation on the run, readable without downloading the log.
  reporter: [['list'], ['html', { open: 'never' }], ...(process.env['CI'] ? [['github'] as ['github']] : [])],
  // No platform in the path: baselines are only generated in the CI image (E17).
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  expect: { toHaveScreenshot: { animations: 'disabled' }, ...(emulated ? { timeout: 15_000 } : {}) },
  // The 3D scenes need WebGL, which headless Chromium only gives through its software renderer.
  use: { baseURL: `http://localhost:${PORT}`, launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
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
