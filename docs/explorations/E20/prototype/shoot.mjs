// Opens the prototype for each window and view and saves what it draws: node shoot.mjs <outdir>
import { chromium } from '@playwright/test';
const out = process.argv[2];
const shots = (process.argv[3] ?? '').split(',').filter(Boolean);
const ALL = { 'passeig-along': 'tile=passeig&up=75&behind=120', 'passeig-sea': 'tile=passeig&view=sea&from=200&dist=300&up=70', 'port-along': 'tile=port&up=75&behind=120', 'port-sea': 'tile=port&view=sea&from=230&dist=300&up=80', 'valentina-along': 'tile=valentina&up=75&behind=120', 'valentina-sea': 'tile=valentina&view=sea&from=120&dist=280&up=70' };
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
page.on('pageerror', (e) => console.log('error', e.message));
for (const [name, query] of Object.entries(ALL)) {
  if (shots.length && !shots.includes(name)) continue;
  await page.goto(`http://localhost:4599/proto/index.html?${query}${process.argv[4] ?? ''}`);
  await page.waitForFunction(() => document.title === 'ready', null, { timeout: 120000 });
  await page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 86 });
  console.log(name);
}
await browser.close();
