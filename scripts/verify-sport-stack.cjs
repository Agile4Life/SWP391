const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/v1/public/catalog', route => route.fulfill({ json: { data: require('./public-catalog-fixture.cjs') } }));
    await page.route('**/accounts.google.com/gsi/**', route => route.fulfill({ body: '', contentType: 'text/javascript' }));
    const output = 'docs/ui-review/sport-stack'; fs.mkdirSync(output, { recursive: true });
    await page.goto(process.env.PUBLIC_UI_URL || 'http://localhost:5173');
    for (const theme of ['light', 'dark']) {
      for (const width of [390, 768, 1440, 1920, 2560]) {
        await page.evaluate(theme => localStorage.setItem('scms_theme', theme), theme);
        await page.setViewportSize({ width, height: 1000 });
        await page.reload();
        await page.locator('.fit-sport-stack').scrollIntoViewIfNeeded();
        await page.waitForFunction(() => document.querySelector('.fit-sport-stack')?.getBoundingClientRect().height > 0);
        const next = page.getByRole('button', { name: 'Bộ môn tiếp theo', exact: true });
        const active = page.locator('.fit-sport-stack-card[data-depth="0"]');
        for (const sport of ['swimming', 'tennis', 'badminton', 'basketball']) {
          assert.equal(await active.getAttribute('data-sport'), sport);
          assert.equal(await page.locator('.fit-sport-stack-card[inert]').count(), 3);
          const layout = await active.evaluate(el => ({ clipped: el.scrollWidth > el.clientWidth,
            overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            programs: el.querySelectorAll('.fit-sport-stack-programs li').length,
            image: el.querySelector('img').getAttribute('src') }));
          assert.equal(layout.overflow, false, `${sport} overflows at ${width}`);
          assert.equal(layout.clipped, false, `${sport} clips content at ${width}`);
          assert.equal(layout.programs, 3);
          await active.locator('img').evaluate(img => img.decode());
          if ([390, 1440].includes(width) && theme === 'light') {
            await active.screenshot({ path: `${output}/${sport}-${width}.png`, style: '.fit-header { visibility: hidden !important; }' });
          }
          await next.focus(); await page.keyboard.press('Enter');
          await page.waitForFunction(() => document.querySelector('.fit-sport-stack-next')?.getAttribute('aria-disabled') === 'false');
          assert.equal(await next.evaluate(el => el === document.activeElement), true, 'switch preserves keyboard focus');
        }
        assert.equal(await active.getAttribute('data-sport'), 'swimming', 'wraps after four sports');
        console.log(`PASS four complete sport cards, keyboard cycling, images and overflow: ${theme} ${width}px`);
      }
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Bộ môn tiếp theo', exact: true }).click();
    assert.equal(await page.locator('[data-depth="0"]').getAttribute('data-sport'), 'tennis');
    assert.equal(await page.locator('.fit-sport-stack-next').getAttribute('aria-disabled'), 'false');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.getByRole('button', { name: 'Bộ môn tiếp theo', exact: true }).click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('[data-depth="0"]')?.getAttribute('data-sport') === 'badminton');
    assert.deepEqual(errors, []);
    console.log('PASS reduced motion, live preference change and no browser errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
