import { expect, test } from '@playwright/test';

// CLAUDE.md section 10, measured with the browser's own metrics on a throttled
// connection and CPU (a mid-range phone on 4G): LCP under 1.8 s, CLS under 0.05.
// It runs in its own project (`perf`), on the phone layout and without the software renderer.
const PAGES = ['/ds/', '/ds/patterns/elevation-profile/', '/ds/primitives/data-table/', '/ds/moments/recorrer-el-tram/'];

for (const path of PAGES) {
  test(`${path} paints fast and does not shift`, async ({ page }, info) => {
    // The cartographic view: the realistic one would fetch tiles from outside, and intercepting them slows every request.
    await page.addInitScript(() => localStorage.setItem('tram-viewer-mode', 'map'));
    // Warm the server first: the measure is of the page, not of the first request to a cold process.
    await page.request.get(path);
    const cdp = await page.context().newCDPSession(page);
    // Lighthouse's "slow 4G": 150 ms round trip, 1.6 Mbps down, 750 kbps up, CPU four times slower.
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto(path, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const metrics = await page.evaluate(
      () =>
        new Promise<{ lcp: number; cls: number }>((resolve) => {
          let lcp = 0;
          let cls = 0;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) lcp = Math.max(lcp, entry.startTime);
          }).observe({ type: 'largest-contentful-paint', buffered: true });
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) if (!entry.hadRecentInput) cls += entry.value;
          }).observe({ type: 'layout-shift', buffered: true });
          setTimeout(() => resolve({ lcp, cls }), 300);
        }),
    );
    info.annotations.push({ type: 'metrics', description: `LCP ${Math.round(metrics.lcp)} ms · CLS ${metrics.cls.toFixed(3)}` });
    console.log(`${path} LCP ${Math.round(metrics.lcp)} ms · CLS ${metrics.cls.toFixed(3)}`);
    expect(metrics.lcp, 'a largest contentful paint was recorded').toBeGreaterThan(0);
    expect(metrics.lcp).toBeLessThan(1800);
    expect(metrics.cls).toBeLessThan(0.05);
  });
}
