// Run against the production preview with NODE_PATH supplying playwright-core.
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const base = process.env.PERF_UI_URL || 'http://127.0.0.1:4173';

async function fixtures(context) {
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(base).origin) return route.abort();
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const data = url.pathname.endsWith('/subscriptions/my') ? null : [];
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  });
  await context.addInitScript(() => {
    localStorage.setItem('fitcenter_token', 'browser-fixture-only');
    localStorage.setItem('fitcenter_auth_session', JSON.stringify({ id: '1', identifier: 'fixture', name: 'Hội viên', role: 'MEMBER' }));
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const offlineContext = await browser.newContext({ serviceWorkers: 'allow' });
    await fixtures(offlineContext);
    const requests = [];
    offlineContext.on('request', request => requests.push(new URL(request.url()).pathname));
    const page = await offlineContext.newPage();
    await page.addInitScript(() => {
      const register = navigator.serviceWorker.register.bind(navigator.serviceWorker);
      navigator.serviceWorker.register = (...args) => new Promise(resolve => {
        window.__releaseRegistration = () => resolve(register(...args));
      });
    });
    const cdp = await offlineContext.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await page.goto(`${base}/member/dashboard`);
    await page.locator('.member-board').waitFor();
    await page.evaluate(() => window.__releaseRegistration());
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await page.waitForFunction(async () => {
      const paths = performance.getEntriesByType('resource').filter(r => new URL(r.name).origin === location.origin && new URL(r.name).pathname.endsWith('.js')).map(r => new URL(r.name).pathname);
      const keys = await caches.keys();
      const cache = await caches.open(keys.find(key => key.startsWith('sol-portal-')));
      return paths.length > 0 && (await Promise.all(paths.map(path => cache.match(path)))).every(Boolean);
    });
    assert.ok(!requests.some(path => path.includes('MemberCardPage-')), 'first install must not download untouched card route');
    await offlineContext.setOffline(true);
    await page.reload();
    await page.locator('.member-board').waitFor();
    console.log('PASS first-ever route reloads offline after delayed SW control with HTTP cache disabled');
    await offlineContext.close();

    const navigationContext = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
    await fixtures(navigationContext);
    const navigationPage = await navigationContext.newPage();
    await navigationPage.goto(`${base}/member/dashboard`);
    await navigationPage.locator('.member-board').waitFor();
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const failChunk = async route => { await pending; await route.abort(); };
    await navigationContext.route('**/assets/MemberCardPage-*.js', failChunk);
    await navigationPage.locator('.portal-rail-link[href="/member/card"]').click();
    await navigationPage.getByRole('status').filter({ hasText: 'Đang tải trang' }).waitFor();
    assert.equal(await navigationPage.locator('.member-board').isVisible(), true, 'pending navigation keeps the existing portal page visible');
    release();
    await navigationPage.getByRole('heading', { name: 'Không thể tải trang', exact: true }).waitFor();
    await navigationContext.unroute('**/assets/MemberCardPage-*.js', failChunk);
    await navigationPage.getByRole('button', { name: 'Tải lại trang', exact: true }).click();
    await navigationPage.getByRole('heading', { name: 'Thẻ thành viên & Mã QR', exact: true }).waitFor();
    console.log('PASS pending route status, preserved shell, chunk-load error and successful reload retry');
    await navigationContext.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
