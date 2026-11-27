/* Fixture chỉ dùng trong trình duyệt QA localhost; ứng dụng vẫn lấy dữ liệu từ API thật. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../../apps/web/node_modules/@playwright/test');
const base = process.env.HISTORY_QA_URL || 'http://127.0.0.1:5182';
const output = path.resolve(__dirname, '../../apps/web/node_modules/.cache/reception-hold-history-qa');
fs.mkdirSync(output, { recursive: true });

async function check(browser, width, theme, language = 'vi') {
  const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
  let reads = 0, fail = false, empty = false;
  await page.addInitScript(({ theme, language }) => {
    localStorage.setItem('fitcenter_auth_session', JSON.stringify({ id: '2', identifier: 'qa', name: 'QA Receptionist', role: 'STAFF' }));
    localStorage.setItem('fitcenter_token', 'qa-only');
    localStorage.setItem('scms_lang', language); localStorage.setItem('scms_theme', theme);
  }, { theme, language });
  await page.route(/\/api\/v1\//, route => {
    const req = route.request(), url = new URL(req.url());
    if (!url.pathname.endsWith('/realtime-session')) assert.equal(req.method(), 'GET', 'Read-only QA');
    let data = [];
    if (url.pathname.endsWith('/auth/me')) data = { id: 2, username: 'qa', fullName: 'QA Receptionist', role: 'RECEPTIONIST' };
    else if (url.pathname.endsWith('/holds')) {
      reads++; assert.equal(url.searchParams.get('status'), 'ALL');
      if (fail) return route.fulfill({ status: 500, json: { success: false, message: 'QA API error' } });
      data = empty ? [] : ['APPROVED', 'REJECTED', 'COMPLETED', 'PENDING'].map((holdStatus, i) => ({
        id: i + 1, memberName: `QA Member ${i + 1}`, membershipCode: `MEM-${i + 1}`, packageName: 'Gym 6 months',
        holdStatus, holdReason: 'Medical leave ' + 'long-reason-'.repeat(20), holdRejectionReason: i === 1 ? 'Missing document' : null,
        holdStartDate: '2026-11-05', holdEndDate: '2026-11-15', holdResolvedAt: i === 2 ? null : '2026-11-02T10:00:00', documents: [],
      }));
    } else if (url.pathname.includes('unread-count')) data = { count: 0 };
    else if (url.pathname.includes('realtime-session')) data = { enabled: false };
    else if (/notifications|conversations|support\/requests/.test(url.pathname)) data = { content: [], totalPages: 0, number: 0 };
    return route.fulfill({ json: { success: true, data } });
  });
  try {
    await page.goto(base + '/staff/reception-history?tab=holds&source=notice');
    const holds = page.getByTestId('hold-request-history');
    await holds.locator('tbody tr').first().waitFor();
    assert.equal(await holds.locator('tbody tr').count(), 3);
    assert(!(await holds.textContent()).includes('QA Member 4'));
    assert.equal(await page.locator('.reception-history-page h1, .reception-history-page h2').count(), 0);
    assert.equal(await holds.locator('tbody button, tbody a').count(), 0);
    assert.equal(await holds.locator('tbody tr').last().locator('td').last().textContent(), '—');
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'No page overflow');
    const status = holds.getByRole('combobox', { name: language === 'en' ? 'Hold status' : 'Trạng thái bảo lưu', exact: true });
    await status.click();
    await holds.getByRole('option', { name: language === 'en' ? 'Rejected' : 'Từ chối', exact: true }).click();
    assert.equal(await holds.locator('tbody tr').count(), 1);
    const beforeTabs = reads;
    const tabs = page.locator('.portal-section-tabs');
    await tabs.locator('a[href*="tab=membership"]').click();
    await holds.waitFor({ state: 'hidden' });
    assert.equal(await holds.isVisible(), false);
    await tabs.locator('a[href*="tab=wallet"]').click();
    await page.waitForURL(/tab=wallet/);
    await page.goBack(); await page.waitForURL(/tab=membership/); await page.goBack();
    await holds.waitFor({ state: 'visible' });
    assert((await status.textContent()).includes(language === 'en' ? 'Rejected' : 'Từ chối'));
    assert(page.url().includes('source=notice'));
    await page.goForward();
    await holds.waitFor({ state: 'hidden' });
    assert.equal(await holds.isVisible(), false);
    await tabs.locator('a[href*="tab=holds"]').focus(); await page.keyboard.press('Enter');
    await holds.waitFor({ state: 'visible' });
    assert.equal(reads, beforeTabs, 'Tab changes preserve state without refetch');
    await status.focus(); await page.keyboard.press('Enter');
    await holds.getByRole('option').first().waitFor();
    await page.keyboard.press('Home'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('[data-testid="hold-request-history"] [role="combobox"]')?.getAttribute('aria-expanded') === 'false');
    await holds.getByRole('listbox').waitFor({ state: 'hidden' });
    assert.equal(await holds.locator('tbody tr').count(), 3, 'Keyboard selects all processed statuses');
    await page.screenshot({ path: path.join(output, `${language}-${theme}-${width}.png`), fullPage: true });
    if (width === 1440 && theme === 'light' && language === 'vi') {
      fail = true;
      await holds.getByRole('button', { name: 'Làm mới lịch sử bảo lưu', exact: true }).click();
      await holds.getByRole('alert').waitFor(); assert.equal(await holds.locator('table').count(), 0);
      fail = false; empty = true;
      await holds.getByRole('button', { name: 'Thử lại', exact: true }).click();
      await holds.getByRole('status').waitFor(); assert.equal(await holds.locator('table').count(), 0);
    }
    console.log(`PASS ${language} ${theme} ${width}px: holds, read-only, tabs, filter state, Back/Forward, keyboard, overflow`);
  } finally { await page.close(); }
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1440, 1366, 1280, 768, 390]) await check(browser, width, theme);
    for (const width of [1280, 390]) await check(browser, width, 'light', 'en');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
