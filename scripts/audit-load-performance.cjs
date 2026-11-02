// Production preview only. NODE_PATH supplies playwright-core; no real API or external content is requested.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
const base = process.env.PERF_UI_URL || 'http://127.0.0.1:4173';
const output = process.env.PERF_OUTPUT || 'docs/qa/performance/login-load-after.json';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const results = [];
  try {
    for (const throttled of [false, true]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      const page = await context.newPage();
      await page.addInitScript(() => {
        const observer = new MutationObserver(() => {
          if (document.querySelector('input[type="password"]')) {
            requestAnimationFrame(() => { window.__loginFormReadyMs = performance.now(); });
            observer.disconnect();
          }
        });
        observer.observe(document, { childList: true, subtree: true });
      });
      await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      if (throttled) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 100000 });
      await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
      await page.locator('input[type="password"]').waitFor();
      const metrics = await page.evaluate(() => {
        const scripts = performance.getEntriesByType('resource').filter(r => new URL(r.name).origin === location.origin && new URL(r.name).pathname.endsWith('.js'));
        return {
          fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
          formReadyMs: window.__loginFormReadyMs,
          encodedJsBytes: scripts.reduce((total, r) => total + r.encodedBodySize, 0),
          decodedJsBytes: scripts.reduce((total, r) => total + r.decodedBodySize, 0),
          scripts: scripts.map(r => ({ path: new URL(r.name).pathname, encodedBytes: r.encodedBodySize, decodedBytes: r.decodedBodySize })),
        };
      });
      results.push({ throttled, ...metrics });
      await context.close();
    }
    fs.mkdirSync(require('node:path').dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify({ method: 'Cold production preview, 390x844, SW disabled, external requests blocked; throttled case 1.6 Mbps / 150ms; no CPU throttling', results }, null, 2));
    console.log(JSON.stringify(results, null, 2));
    for (const result of results) assert.ok(result.decodedJsBytes < 650000, `Login startup JS must stay below 650 KB; received ${result.decodedJsBytes} bytes`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
