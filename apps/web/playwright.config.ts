import { defineConfig } from '@playwright/test';

const PORT = 4329;
const VIEWPORTS = { mobile: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
const SCHEMES = { light: 'light', night: 'dark' } as const;
// Night is the reader's choice on the page, not the system's: the night projects arrive having chosen it.
const CHOSE_NIGHT = { cookies: [], origins: [{ origin: `http://localhost:${PORT}`, localStorage: [{ name: 'tram-theme', value: 'night' }] }] };

// scripts/visual-docker.sh runs the CI image under x86 emulation on a Mac, several
// times slower than CI: fewer workers and more time there. CI keeps the defaults.
const emulated = process.env['TRAM_EMULATED'] === '1';
const engines = process.env['TRAM_ENGINES'] === '1';

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
  projects: [
    ...Object.entries(VIEWPORTS).flatMap(([size, viewport]) =>
      Object.entries(SCHEMES).map(([theme, colorScheme]) => ({
        name: `${size}-${theme}`,
        testIgnore: /perf\.spec/,
        use: { viewport, colorScheme, ...(theme === 'night' ? { storageState: CHOSE_NIGHT } : {}) },
      })),
    ),
    // Paint times are measured without the software renderer the 3D tests need: it also slows
    // down the painting of every page, which a visitor's browser does not suffer.
    { name: 'perf', testMatch: /perf\.spec/, use: { viewport: VIEWPORTS.mobile, colorScheme: 'light' as const, launchOptions: { args: [] } } },
    // Safari's and Firefox's engines, on request (TRAM_ENGINES=1): behaviour only, since the baselines are Chromium's.
    ...(engines
      ? [
          { name: 'webkit', testIgnore: /perf\.spec/, ignoreSnapshots: true, use: { browserName: 'webkit' as const, viewport: VIEWPORTS.mobile, colorScheme: 'light' as const, launchOptions: { args: [] } } },
          { name: 'firefox', testIgnore: /perf\.spec/, ignoreSnapshots: true, use: { browserName: 'firefox' as const, viewport: VIEWPORTS.desktop, colorScheme: 'light' as const, launchOptions: { args: [] } } },
        ]
      : []),
  ],
  webServer: {
    command: `pnpm build:ds && pnpm preview --port ${PORT}`,
    url: `http://localhost:${PORT}/ds/`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
