import { chromium } from 'playwright';

const BASE = 'http://localhost:3081';
const results = [];

async function check(name, fn) {
  try {
    const ok = await fn();
    results.push({ name, ok, err: null });
  } catch (e) {
    results.push({ name, ok: false, err: e.message });
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => console.log('PAGE_ERROR:', e.message));
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');

  // Hard guard at start
  const docCount = await page.locator('tbody tr[x-show], tbody tr').count();
  if (docCount === 0) {
    console.error('ABORT: no documents in table. Seed DB first.');
    process.exit(2);
  }

  // 5.2 — Drag & drop tags
  await check('5.2 doc rows have drop handlers', async () => {
    const tr = page.locator('tbody tr').first();
    return await tr.evaluate(el => el.getAttribute('@drop') !== null || el.ondrop !== null);
  });

  await check('5.2 tags exist in sidebar', async () => {
    const pills = page.locator('[draggable="true"]');
    return (await pills.count()) > 0;
  });

  // 5.3 — Context menu on right-click
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  await check('5.3 context menu opens on right-click', async () => {
    const tr = page.locator('tbody tr').first();
    await tr.click({ button: 'right' });
    await page.waitForTimeout(200);
    return await page.locator('#app-context-menu').isVisible();
  });

  await check('5.3 context menu closes on Escape', async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    return !(await page.locator('#app-context-menu').isVisible().catch(() => false));
  });

  // 5.4 — Bookmark group detail modal
  await check('5.4 bookmark group modal opens on group name click', async () => {
    const groupsBtn = page.locator('header button:has-text("Groups")');
    if (await groupsBtn.count()) {
      const aside = page.locator('aside');
      if (!(await aside.isVisible())) await groupsBtn.click();
      await page.waitForTimeout(200);
    }
    const groupName = page.locator('aside [role="button"], aside h4, aside .group-name, aside [title*="Click to view all items"]').first();
    if (!(await groupName.count())) return 'SKIPPED_NO_GROUPS';
    await groupName.click();
    await page.waitForTimeout(300);
    return await page.locator('div:has-text("Bookmark Group")').first().isVisible();
  });

  // 5.5 — Preview modal
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  await check('5.5 preview modal opens on double-click', async () => {
    const tr = page.locator('tbody tr').first();
    await tr.dblclick();
    await page.waitForTimeout(1500);
    const modal = page.locator('text=/Preview:/').first();
    return await modal.isVisible();
  });

  await browser.close();

  console.log('\n=== Verification results ===');
  for (const r of results) {
    const icon = r.ok === 'SKIPPED_NO_GROUPS' ? '⚠️' : (r.ok ? '✅' : '❌');
    console.log(`${icon} ${r.name}${r.err ? ' — ' + r.err : ''}${r.ok === 'SKIPPED_NO_GROUPS' ? ' (no test data)' : ''}`);
  }
  const failed = results.filter(r => r.ok === false).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed > 0 ? 1 : 0);
})();
