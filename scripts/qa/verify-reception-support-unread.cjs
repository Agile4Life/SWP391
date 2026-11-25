/* Kiểm tra UI bằng dữ liệu mẫu trên localhost; không gọi API hoặc ghi dữ liệu thật. */
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require('../../apps/web/node_modules/@playwright/test');

async function check(browser, theme, width) {
  let unreadCount = 2;
  const reads = [], queries = [];
  const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
  const ticket = { id: 2, memberId: 10, memberName: 'Hội viên mẫu có tên dài để kiểm tra bố cục', subject: 'Hỗ trợ gia hạn gói tập',
    description: 'Yêu cầu ban đầu', status: 'open', createdAt: '2026-10-01T08:00:00', assignedToName: null,
    lastMessage: 'Tôi cần hỗ trợ thêm về gói tập', lastMessageAt: '2026-11-25T10:00:00' };
  await page.addInitScript(() => {
    localStorage.setItem('fitcenter_auth_session', JSON.stringify({ id: '2', identifier: 'staff', name: 'Lễ tân mẫu', role: 'STAFF' }));
    localStorage.setItem('fitcenter_token', 'ui-test-only'); localStorage.setItem('scms_lang', 'vi');
  });
  await page.route(/\/api\/v1\//, route => {
    const request = route.request(), url = new URL(request.url()), pathname = url.pathname;
    let data = [];
    if (pathname.endsWith('/auth/me')) data = { username: 'staff', fullName: 'Lễ tân mẫu', role: 'RECEPTIONIST' };
    else if (pathname.includes('realtime-session')) data = { enabled: false, userId: 2 };
    else if (pathname.includes('unread-count')) data = { count: 0 };
    else if (pathname.endsWith('/support/requests/2/read')) {
      reads.push(JSON.parse(request.postData())); unreadCount = 0; data = { unreadCount };
    } else if (pathname.endsWith('/support/requests/2/messages')) {
      data = [{ id: 20, senderId: 10, senderName: ticket.memberName, senderRole: 'MEMBER', message: ticket.lastMessage, createdAt: ticket.lastMessageAt }];
    } else if (pathname.endsWith('/support/requests/2')) data = ticket;
    else if (pathname.endsWith('/support/requests')) {
      queries.push(url.search);
      data = { content: url.searchParams.get('unreadOnly') === 'true' && unreadCount === 0 ? [] : [{ ...ticket, unreadCount }], totalPages: 1, number: 0 };
    } else if (pathname.includes('/chat/conversations')) data = { content: [], totalPages: 0, number: 0 };
    // Mở/đọc/quay lại không được phát sinh thao tác xử lý phiếu hoặc gửi tin.
    assert(!pathname.endsWith('/status') && !pathname.endsWith('/escalate'));
    assert(!(pathname.endsWith('/messages') && request.method() === 'POST'));
    return route.fulfill({ json: { success: true, data } });
  });
  try {
    await page.goto('http://127.0.0.1:5173/messages?tab=support');
    const row = page.locator('[data-support-ticket="2"]'); await row.waitFor();
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    assert.equal(await row.locator('.direct-chat__unread').textContent(), '2');
    await page.getByRole('radio', { name: 'Chưa đọc', exact: true }).click();
    await page.getByRole('radio', { name: 'Đang chờ', exact: true }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(os.tmpdir(), `scms-chat-${theme}-${width}-inbox.png`), fullPage: true });
    await row.click();
    const back = page.getByRole('button', { name: 'Quay lại hộp thư', exact: true }); await back.waitFor();
    await page.locator('.direct-chat__bubble').last().waitFor();
    await page.locator('#staff-support-message').fill('Bản nháp còn giữ khi quay lại');
    await page.locator('.support-chat button[type="submit"]').click({ trial: true });
    const box = await back.boundingBox(); assert(box && box.height >= 44);
    assert.equal(await page.locator('.support-chat').evaluate(node => node.scrollWidth > node.clientWidth), false);
    await page.screenshot({ path: path.join(os.tmpdir(), `scms-chat-${theme}-${width}-detail.png`), fullPage: true });
    await back.click();
    await page.getByText('Không có phiếu hỗ trợ phù hợp.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('radio', { name: 'Chưa đọc', exact: true }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByRole('radio', { name: 'Đang chờ', exact: true }).getAttribute('aria-checked'), 'true');
    await page.getByRole('radio', { name: 'Tất cả', exact: true }).click(); await row.waitFor();
    assert.equal(await row.locator('.direct-chat__unread').count(), 0);
    await row.click();
    assert.equal(await page.locator('#staff-support-message').inputValue(), 'Bản nháp còn giữ khi quay lại');
    assert.deepEqual(reads, [{ lastMessageId: 20 }]);
    assert(queries.some(query => query.includes('status=open') && query.includes('unreadOnly=true')));
    console.log(`PASS ${theme} ${width}px: unread, filters, read cursor, back, draft, mobile controls`);
  } finally { await page.close(); }
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try { for (const theme of ['light', 'dark']) for (const width of [1440, 390]) await check(browser, theme, width); }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
