// Read-only UI audit using the existing verification fixtures; no real API calls.
const fs = require('node:fs');
const vm = require('node:vm');
const { chromium } = require('playwright-core');
const source = fs.readFileSync(`${__dirname}/verify-ux-consistency.cjs`, 'utf8');
const { fixtures, routes } = vm.runInNewContext(source.slice(0, source.indexOf('(async () => {')) + '\n({ fixtures, routes })', { require, Date });
fixtures['/public/catalog'] = require('./public-catalog-fixture.cjs');
const publicRoutes = ['/', '/login', '/register', '/swimming', '/tennis', '/trainers/1'].map(path => [null, path]);
const output = 'docs/ui-review/heading-audit';

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [], measurements = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/accounts.google.com/gsi/**', route => route.fulfill({ body: '', contentType: 'text/javascript' }));
    await page.route('**/api/v1/**', route => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, '');
      return route.fulfill({ json: { success: true, data: /^\/roles\/\d+\/permissions$/.test(path) ? fixtures['/roles/permissions'] : fixtures[path] ?? [] } });
    });
    async function collect(path, width, state = 'page') {
      const headings = await page.locator('h1,h2,h3,h4,h5,h6,[role="heading"],.fit-faq-trigger,.member-discover-card strong,.member-digital-card > strong').evaluateAll(elements => elements.filter(el => {
        const css = getComputedStyle(el);
        return el.getClientRects().length && css.visibility !== 'hidden' && css.display !== 'none';
      }).map(el => {
        const css = getComputedStyle(el);
        return { tag: el.tagName, className: el.className, text: el.textContent.trim().replace(/\s+/g, ' '),
          size: parseFloat(css.fontSize), weight: css.fontWeight, lineHeight: css.lineHeight,
          clipped: el.scrollWidth > el.clientWidth + 1 };
      }));
      measurements.push({ path, width, state, headings });
    }
    for (const width of [390, 768, 1440, 2560]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [role, path] of [...publicRoutes, ...routes]) {
        await page.addInitScript(role => {
          localStorage.setItem('scms_theme', 'light');
          if (role) {
            localStorage.setItem('fitcenter_auth_session', JSON.stringify({ id: '1', identifier: 'review', name: 'Nguyễn An', role }));
            localStorage.setItem('fitcenter_token', 'review-only');
          } else {
            localStorage.removeItem('fitcenter_auth_session');
            localStorage.removeItem('fitcenter_token');
          }
        }, role);
        await page.goto(`${process.env.PUBLIC_UI_URL || 'http://localhost:5173'}${path}`);
        await page.locator('.fit-site, .portal-v2').waitFor();
        await page.waitForLoadState('networkidle');
        await collect(path, width);
        if (path === '/') {
          await page.locator('.fit-muscle-zone').first().focus();
          await page.locator('.fit-muscle-callout').waitFor();
          await collect(path, width, 'muscle-callout');
        }
        if (path === '/member/dashboard' && [390, 1440].includes(width)) await page.screenshot({ path: `${output}/dashboard-${width}.png`, fullPage: true });
        if (path === '/manager/users') {
          await page.getByRole('button', { name: /Thêm tài khoản/ }).first().click();
          await page.locator('dialog[open]').waitFor();
          await collect(path, width, 'create-dialog');
        }
      }
      fs.writeFileSync(`${output}/sizes.json`, JSON.stringify({ measurements, errors }, null, 2));
      console.log(`Audited 19 pages, muscle callout and account dialog at ${width}px`);
    }
    console.log(`Browser errors: ${errors.length}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
