// Desktop check: load the launcher at 1920x1080, open the Control Center with the arrow keys,
// fail on any page error, and save a screenshot of each.
// Usage: node tools/screens.cjs <path-to-playwright> <out-dir>
const { chromium } = require(process.argv[2]);
const path = require('path');
const out = process.argv[3];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND/.test(m.text())) errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../app/index.html'));
  await page.waitForTimeout(800);
  // The home screen, then the Control Center (Up to the top row, right to its button, OK).
  await page.screenshot({ path: path.join(out, 'tv-1-home.png') });
  await page.keyboard.press('ArrowUp');
  for (let k = 0; k < 3; k++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  if (!(await page.evaluate(() => document.getElementById('cc').classList.contains('open')))) errors.push('Control Center did not open');
  await page.screenshot({ path: path.join(out, 'tv-2-control-center.png') });
  if ((await page.evaluate(() => document.body.className)).indexOf('style-glass') < 0) errors.push('home screen not built');
  await browser.close();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log('ok');
})().catch(e => { console.error(e); process.exit(1); });
