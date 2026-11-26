/* Fixture chỉ dùng cho QA bố cục trên localhost; ứng dụng vẫn dùng API thật, không lưu giao dịch ở client. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../../apps/web/node_modules/@playwright/test');
const output = path.resolve(__dirname, '../../apps/web/node_modules/.cache/reception-history-qa');
fs.mkdirSync(output, { recursive: true });
const base = process.env.HISTORY_QA_URL || 'http://127.0.0.1:5182';

async function check(browser, theme, width, language = 'vi') {
  const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
  const reads = [];
  await page.addInitScript(({ language, theme }) => {
    localStorage.setItem('fitcenter_auth_session', JSON.stringify({ id: '2', identifier: 'qa', name: 'Lễ tân QA', role: 'STAFF' }));
    localStorage.setItem('fitcenter_token', 'qa-only');
    localStorage.setItem('scms_lang', language);
    localStorage.setItem('scms_theme', theme);
    document.documentElement.dataset.theme = theme;
  }, { language, theme });
  await page.route(/\/api\/v1\//, route => {
    const req = route.request(), url = new URL(req.url());
    // Phiên realtime của shell là POST; chỉ trả fixture disabled, không chuyển yêu cầu ra backend.
    if (!url.pathname.endsWith('/realtime-session')) assert.equal(req.method(), 'GET', `QA không được ghi dữ liệu: ${url.pathname}`);
    let data = [];
    if (url.pathname.endsWith('/auth/me')) data = { id: 2, username: 'qa', fullName: 'Lễ tân QA', role: 'RECEPTIONIST' };
    else if (url.pathname.endsWith('/requests/history')) {
      reads.push(url.pathname + url.search);
      data = [101, 102].map((id, index) => ({ subscriptionId: id, type: index ? 'RENEW' : 'REGISTER', outcome: index ? 'CANCELLED' : 'APPROVED', memberId: 164, membershipCode: 'MEM-164', memberName: 'Anh Lê', packageName: 'GOLD 3 THÁNG', previousPackageName: null, amount: index ? null : 2500000, paymentMethod: index ? null : 'cash', processedAt: `2026-11-2${5 - index}T09:00:00`, processedByName: 'Lễ tân QA' }));
    } else if (url.pathname.endsWith('/wallet/counter-topups')) {
      reads.push(url.pathname + url.search);
      data = [{ paymentId: 202, memberId: 164, membershipCode: 'MEM-164', memberName: 'Anh Lê', amount: 500000, paymentMethod: 'cash', paidAt: '2026-11-25T09:30:00', receivedByName: 'Lễ tân QA' }];
    } else if (url.pathname.includes('unread-count')) data = { count: 0 };
    else if (url.pathname.includes('realtime-session')) data = { enabled: false };
    else if (/notifications|conversations|support\/requests/.test(url.pathname)) data = { content: [], totalPages: 0, number: 0 };
    return route.fulfill({ json: { success: true, data } });
  });
  try {
    await page.goto(base + '/staff/reception-history?source=notice');
    const membership = page.locator('[data-testid="request-history"]');
    const wallet = page.locator('[data-testid="wallet-topup-history"]');
    await membership.locator('tbody tr').first().waitFor();
    await wallet.locator('tbody tr').first().waitFor({ state: 'attached' });
    const initialReads = reads.length; // Dev StrictMode có thể chạy effect khởi tạo hai lần.
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    await page.waitForTimeout(350);
    const tabs = page.locator('.portal-section-tabs');
    assert.equal(await tabs.locator('a.active').count(), 1);
    assert.equal(await wallet.isVisible(), false);
    async function layout(section) {
      const metrics = await section.locator('.request-history__filters').evaluate(node => [...node.children].map(child => {
        const box = child.getBoundingClientRect();
        return { center: box.y + box.height / 2, width: box.width };
      }));
      if (width >= 1280) assert(Math.max(...metrics.map(m => m.center)) - Math.min(...metrics.map(m => m.center)) < 2, 'Desktop phải có một hàng bộ lọc');
      const clipped = await section.locator('.ui-select__value').evaluateAll(nodes => nodes.filter(node => node.scrollWidth > node.clientWidth + 1).map(node => node.textContent));
      assert.deepEqual(clipped, [], 'Không cắt nhãn dropdown');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'Không tràn toàn trang');
    }
    await layout(membership);
    const search = membership.locator('input[type="search"]');
    await search.fill('MEM-164');
    assert.equal(await membership.locator('tbody tr').count(), 2);
    await tabs.locator('a[href*="tab=wallet"]').click();
    await wallet.locator('tbody tr').waitFor();
    await layout(wallet);
    assert.equal(await membership.isVisible(), false);
    await page.screenshot({ path: path.join(output, `${language}-${theme}-${width}-wallet.png`), fullPage: true });
    await page.goBack();
    await membership.waitFor({ state: 'visible' });
    assert.equal(await search.inputValue(), 'MEM-164');
    await page.goForward();
    await wallet.waitFor({ state: 'visible' });
    assert.equal(reads.length, initialReads, 'Đổi tab không tải API lại');
    await tabs.locator('a[href*="tab=membership"]').click();
    await page.screenshot({ path: path.join(output, `${language}-${theme}-${width}-membership.png`), fullPage: true });
    const historyLink = page.locator('.portal-rail-link[href="/staff/reception-history"]');
    assert.equal(await historyLink.getAttribute('aria-current'), 'page');
    assert.equal(await historyLink.getAttribute('title'), language === 'en' ? 'History' : 'Lịch sử');
    if (width >= 1280) {
      await page.locator('.app-sidebar').hover();
      await page.waitForTimeout(650);
      const label = historyLink.locator('.portal-rail-label');
      assert.equal(await label.evaluate(node => getComputedStyle(node).opacity), '1');
      await layout(membership);
      await page.screenshot({ path: path.join(output, `${language}-${theme}-${width}-expanded.png`), fullPage: true });
    } else if (await page.getByRole('button', { name: language === 'en' ? 'More screens' : 'Thêm màn hình', exact: true }).isVisible()) {
      await page.getByRole('button', { name: language === 'en' ? 'More screens' : 'Thêm màn hình', exact: true }).click();
      await page.locator('dialog a[href="/staff/reception-history"]').click();
      await membership.waitFor({ state: 'visible' });
    } else {
      await historyLink.click();
    }
    if (width === 1440 && theme === 'light' && language === 'vi') {
      const choose = async (section, name, option) => {
        await section.getByRole('combobox', { name, exact: true }).click();
        await section.getByRole('option', { name: option, exact: true }).click();
      };
      await choose(membership, 'Sắp xếp', 'Cũ nhất trước');
      assert((await membership.locator('tbody tr').first().textContent()).includes('#102'));
      await choose(membership, 'Kết quả xử lý', 'Đã hủy');
      assert.equal(await membership.locator('tbody tr').count(), 1);
      await choose(membership, 'Loại yêu cầu', 'Gia hạn');
      assert((await membership.locator('tbody').textContent()).includes('#102'));
      const previous = reads.length;
      await choose(membership, 'Khoảng thời gian', '7 ngày qua');
      await membership.locator('tbody tr').waitFor();
      assert(reads.slice(previous).some(url => url.endsWith('days=7')));
      const beforeRefresh = reads.length;
      await membership.getByRole('button', { name: 'Làm mới lịch sử', exact: true }).click();
      await membership.locator('tbody tr').waitFor();
      assert(reads.length > beforeRefresh);
      await tabs.locator('a[href*="tab=wallet"]').click();
      await choose(wallet, 'Phương thức nạp', 'Chuyển khoản');
      assert.equal(await wallet.locator('tbody tr').count(), 0);
      await choose(wallet, 'Phương thức nạp', 'Tiền mặt');
      await wallet.locator('tbody tr').waitFor();
      const walletBeforeRefresh = reads.length;
      await wallet.getByRole('button', { name: 'Làm mới lịch sử nạp ví', exact: true }).click();
      await wallet.locator('tbody tr').waitFor();
      assert(reads.length > walletBeforeRefresh);
    }
    await page.goto(base + '/staff/reception-history?tab=invalid');
    await membership.locator('tbody tr').first().waitFor();
    assert.equal(await wallet.isVisible(), false);
    await page.goto(base + '/staff/reception-history?tab=wallet');
    await wallet.locator('tbody tr').first().waitFor();
    assert.equal(await membership.isVisible(), false);
    console.log(`PASS ${language} ${theme} ${width}px: layout, sidebar, query tabs, Back/Forward, state, API reads`);
  } finally { await page.close(); }
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1440, 1366, 1280, 768, 390]) await check(browser, theme, width);
    for (const width of [1280, 390]) await check(browser, 'light', width, 'en');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
