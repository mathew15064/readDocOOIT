import { chromium } from 'playwright';

const BASE = 'http://localhost:3081';
const VIEWPORTS = [
  { name: 'mobile-sm', width: 375, height: 812 },
  { name: 'mobile', width: 414, height: 896 },
  { name: 'tablet-narrow', width: 768, height: 1024 },
  { name: 'tablet', width: 850, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'desktop-lg', width: 1440, height: 900 },
  { name: 'desktop-xl', width: 1920, height: 1080 },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const failures = [];

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    page.on('pageerror', e => failures.push(`[${vp.name}] PAGE_ERROR: ${e.message}`));

    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const report = await page.evaluate(() => {
      const overflowX = document.documentElement.scrollWidth > window.innerWidth;
      const overflowY = document.documentElement.scrollHeight > window.innerHeight;

      // Check for text overflow in critical elements
      const overflows = [];
      document.querySelectorAll('h1, h2, h3, button, td, th').forEach(el => {
        if (el.tagName === 'TH') return;
        const cls = el.classList;
        if (cls.contains('truncate') || cls.contains('overflow-hidden') || cls.contains('whitespace-nowrap')) return;
        // Skip TD that contains any interactive child (buttons, links)
        if (el.querySelector('button, a, input, select')) return;
        if (el.scrollWidth > el.clientWidth + 2) {
          overflows.push(`${el.tagName}:${el.textContent.slice(0, 30).trim()}`);
        }
      });

      const bodyBg = getComputedStyle(document.body).backgroundColor;

      return { overflowX, overflowY, overflows, bodyBg };
    });

    console.log(`\n=== ${vp.name} (${vp.width}x${vp.height}) ===`);
    console.log(`  overflowX: ${report.overflowX}`);
    console.log(`  overflowY: ${report.overflowY}`);
    console.log(`  bodyBg: ${report.bodyBg}`);
    console.log(`  overflow elements: ${report.overflows.length ? report.overflows.join(', ') : 'none'}`);

    if (report.overflowX) failures.push(`[${vp.name}] horizontal page overflow`);
    if (report.overflows.length) failures.push(`[${vp.name}] element overflow: ${report.overflows.join(', ')}`);
    // bodyBg should be rgb(253, 252, 252) = #fdfcfc
    if (report.bodyBg !== 'rgb(11, 14, 17)') {
      failures.push(`[${vp.name}] body bg is ${report.bodyBg}, expected rgb(253, 252, 252)`);
    }

    await page.close();
  }

  await browser.close();

  console.log('\n=== Summary ===');
  if (failures.length === 0) {
    console.log('✅ All viewports pass');
    process.exit(0);
  } else {
    console.log(`❌ ${failures.length} failure(s):`);
    failures.forEach(f => console.log('  - ' + f));
    process.exit(1);
  }
})();
