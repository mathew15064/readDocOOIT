import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:3081';
const OUT = path.resolve('screenshots');
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: '01-mobile-sm',  width: 375,  height: 812 },
  { name: '02-mobile',     width: 414,  height: 896 },
  { name: '03-tablet-narrow', width: 768, height: 1024 },
  { name: '04-tablet',     width: 850,  height: 1024 },
  { name: '05-desktop',    width: 1280, height: 900 },
  { name: '06-desktop-lg', width: 1440, height: 900 },
  { name: '07-desktop-xl', width: 1920, height: 1080 },
];

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved:', file);
}

async function waitAndShot(page, name, ms = 400) {
  await page.waitForTimeout(ms);
  await shot(page, name);
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ---- Pass 1: Home page at every viewport ----
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await shot(page, `${vp.name}-home`);

    if (errors.length) {
      console.log(`[${vp.name}] ERRORS:`, errors);
    }
    await page.close();
  }

  // ---- Pass 2: Interactive flows on desktop-lg ----
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => console.log('PAGE_ERROR:', e.message));

  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // 1. Search filter
  await page.locator('input[type="search"], input[placeholder*="Search"]').first().fill('Booth');
  await waitAndShot(page, '10-search-booth', 800);

  // 2. Clear search, toggle only-latest
  await page.locator('input[type="search"], input[placeholder*="Search"]').first().fill('');
  await page.waitForTimeout(300);
  const latestCb = page.locator('input[type="checkbox"]').first();
  if (await latestCb.count()) {
    await latestCb.check();
    await waitAndShot(page, '11-only-latest', 500);
    await latestCb.uncheck();
    await page.waitForTimeout(300);
  }

  // 3. Right-click context menu on first row
  const firstRow = page.locator('tbody tr').first();
  if (await firstRow.count()) {
    await firstRow.click({ button: 'right' });
    await waitAndShot(page, '12-context-menu', 400);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 4. Double-click preview modal
    await firstRow.dblclick();
    await waitAndShot(page, '13-preview-modal', 1800);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 5. Click filename → version history
    const nameCell = firstRow.locator('td').first();
    await nameCell.click();
    await waitAndShot(page, '14-version-history', 700);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 6. Click bookmark pin on first row
    const pin = firstRow.locator('button').first();
    if (await pin.count()) {
      await pin.click();
      await waitAndShot(page, '15-add-bookmark-modal', 500);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  }

  // 7. Open sidebar (Groups button)
  const groupsBtn = page.locator('header button:has-text("Groups")').first();
  if (await groupsBtn.count()) {
    const aside = page.locator('aside');
    if (!(await aside.isVisible())) await groupsBtn.click();
    await waitAndShot(page, '16-sidebar-groups', 500);
  }

  // 8. Open Tags button
  const tagsBtn = page.locator('header button:has-text("Tags")').first();
  if (await tagsBtn.count()) {
    await tagsBtn.click();
    await waitAndShot(page, '17-tags-modal', 500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // 9. Open filter panel in sidebar (if exists)
  const filterBtn = page.locator('button:has-text("Filter")').first();
  if (await filterBtn.count()) {
    await filterBtn.click();
    await waitAndShot(page, '18-bookmark-filter', 400);
  }

  await page.close();
  await browser.close();

  console.log('\nDone. Screenshots in:', OUT);
})();
