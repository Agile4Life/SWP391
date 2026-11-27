/* Fixture và modal QA chỉ tồn tại trong browser localhost; không thay API/dữ liệu production. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('../../apps/web/node_modules/@playwright/test');
const base = process.env.FEEDBACK_QA_URL || 'http://127.0.0.1:5184';
const output = path.resolve(__dirname, '../../apps/web/node_modules/.cache/operation-feedback-qa');
fs.mkdirSync(output, { recursive: true });
const paths = { MEMBER: '/member/hold', STAFF: '/staff/reception', MANAGER: '/manager/requests', COACH: '/staff/requests', ADMIN: '/admin/audit-logs' };

async function check(browser, role, width, theme, language) {
  const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
  let failReject = true, rejected = false, rejectCalls = 0;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ role, theme, language }) => {
    localStorage.setItem('fitcenter_auth_session', JSON.stringify({ id: '2', identifier: 'qa', name: 'QA ' + role, role }));
    localStorage.setItem('fitcenter_token', 'qa-only'); localStorage.setItem('scms_lang', language); localStorage.setItem('scms_theme', theme);
  }, { role, theme, language });
  await page.route(/\/api\/v1\//, route => {
    const req = route.request(), url = new URL(req.url());
    const trial = { id: 55, memberId: 10, memberName: 'QA Member', membershipCode: 'MEM-10', documentType: 'PASSPORT', status: 'PENDING_APPROVAL', requestedAt: '2026-11-25T10:00:00' };
    let data = [];
    if (url.pathname.endsWith('/realtime-session')) data = { enabled: false };
    else if (/\/reception\/trials\/55\/reject$/.test(url.pathname)) {
      assert.equal(role, 'STAFF'); assert.equal(req.method(), 'POST'); rejectCalls++;
      if (failReject) return route.fulfill({ status: 400, json: { success: false, message: 'QA rejection failed' } });
      rejected = true; data = { ...trial, status: 'REJECTED' };
    } else {
      assert.equal(req.method(), 'GET', `Unexpected write: ${url.pathname}`);
      if (url.pathname.endsWith('/auth/me')) data = { id: 2, username: 'qa', fullName: 'QA ' + role, role: role === 'STAFF' ? 'RECEPTIONIST' : role === 'MANAGER' ? 'CENTER_MANAGER' : role };
      else if (url.pathname.endsWith('/reception/trials')) data = rejected ? [] : [trial];
      else if (url.pathname.endsWith('/subscriptions/my')) data = null;
      else if (/audit-logs|notifications|conversations|support\/requests/.test(url.pathname)) data = { content: [], totalElements: 0, totalPages: 0, number: 0 };
      else if (url.pathname.includes('unread-count')) data = { count: 0 };
    }
    return route.fulfill({ json: { success: true, data } });
  });
  try {
    await page.goto(base + paths[role]);
    await page.locator('#portal-main').waitFor();
    await page.evaluate(async () => {
      const { toast, dismissToast } = await import('/src/shared/ui/toast.ts');
      const notices = await import('/src/shared/lib/portalNotices.ts');
      window.qaFeedback = { toast, dismissToast, notices };
      const origin = document.createElement('button'); origin.id = 'qa-feedback-origin'; origin.textContent = 'QA return focus';
      document.getElementById('portal-main').prepend(origin); origin.focus();
      const modal = document.createElement('dialog'); modal.id = 'qa-feedback-modal'; modal.className = 'portal-dialog';
      modal.innerHTML = '<h2>QA modal</h2><label>QA input<input id="qa-feedback-input"></label><p role="alert">QA inline validation</p>';
      document.body.append(modal); modal.showModal(); document.getElementById('qa-feedback-input').focus();
      const vi = 'Đã cập nhật thành công. ' + 'Thông tin kiểm thử dài để kiểm tra xuống dòng. '.repeat(4);
      const en = 'Updated successfully. ' + 'Long feedback text to verify wrapping. '.repeat(4);
      toast(vi, 'success', { vi, en }); window.qaFeedback.notice = modal.querySelector('.sol-toast');
    });
    assert.equal(await page.evaluate(() => document.activeElement.id), 'qa-feedback-input', 'Toast does not steal modal focus');
    await expect(page.locator('#qa-feedback-modal [role="alert"]')).toHaveText('QA inline validation');
    await page.evaluate(() => {
      const modal = document.getElementById('qa-feedback-modal'); modal.close(); modal.remove();
      document.getElementById('qa-feedback-origin').focus();
    });
    const notice = page.locator('#portal-main .sol-toast');
    await notice.waitFor();
    assert(await page.evaluate(() => document.querySelector('#portal-main .sol-toast') === window.qaFeedback.notice));
    assert.equal(await page.locator('.sol-toast').count(), 1);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'qa-feedback-origin');
    assert((await notice.textContent()).includes(language === 'en' ? 'Updated successfully.' : 'Đã cập nhật thành công.'));
    assert(await notice.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    assert.equal(await notice.evaluate(el => getComputedStyle(el).position), 'static', 'Keep inline design');
    assert.equal(await notice.evaluate(el => {
      const controls = document.querySelector('.portal-topbar-actions');
      if (!controls) return false;
      const a = el.getBoundingClientRect(), b = controls.getBoundingClientRect();
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }), false, 'Toast must not overlap floating topbar actions');
    await page.screenshot({ path: path.join(output, `${role}-${language}-${theme}-${width}.png`), fullPage: true });
    await notice.locator('button').focus(); await page.keyboard.press('Enter');
    await expect(page.locator('.sol-toast')).toHaveCount(0);
    await page.evaluate(() => window.qaFeedback.toast.error('QA error'));
    await expect(page.locator('.sol-toast')).toHaveAttribute('role', 'alert');
    await page.keyboard.press('Escape'); await expect(page.locator('.sol-toast')).toHaveCount(0);
    await page.evaluate(() => {
      window.qaFeedback.notices.clearNotices();
      window.qaFeedback.notices.notify('QA info', 'info', { record: true });
    });
    await expect(page.locator('.sol-toast')).toHaveCount(0);
    assert.equal(await page.evaluate(() => window.qaFeedback.notices.getNotices().length), 1);
    if (role === 'STAFF' && width === 1440 && theme === 'light') {
      await page.evaluate(() => window.qaFeedback.notices.clearNotices());
      const card = page.locator('.reception-request').filter({ has: page.locator('.reception-todo__tag--trial') });
      await card.locator('.reception-request__actions button').first().click();
      const form = page.locator('#trial-reject-reason').locator('..').locator('..');
      await page.locator('#trial-reject-reason').fill('QA blurred document');
      await form.locator('button[type="submit"]').click();
      await expect(page.locator('dialog[open]')).toContainText('QA rejection failed');
      await expect(page.locator('.sol-toast--success')).toHaveCount(0);
      assert.equal(await page.evaluate(() => window.qaFeedback.notices.getNotices().length), 0);
      failReject = false; await form.locator('button[type="submit"]').click();
      await expect(page.locator('#portal-main .sol-toast--success')).toHaveCount(1);
      assert.equal(await page.evaluate(() => window.qaFeedback.notices.getNotices().length), 1);
      assert.equal(rejectCalls, 2);
      await expect(page.locator('#trial-reject-reason')).toHaveCount(0);
      await page.mouse.move(0, 0);
      await expect(page.locator('.sol-toast')).toHaveCount(0, { timeout: 5000 });
      assert.equal(await page.evaluate(() => window.qaFeedback.notices.getNotices().length), 1, 'Auto dismiss keeps bell record');
    }
    assert.deepEqual(errors.filter(message => !message.includes('ResizeObserver loop')), [], 'No unexpected runtime errors');
    console.log(`PASS ${role} ${language} ${theme} ${width}px: modal unmount, same node, focus, keyboard dismiss, inline, wrap, bell`);
    if (errors.length) console.log(`NOTE ${role}: ${errors.join('; ')}`);
  } finally { await page.close(); }
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const role of Object.keys(paths)) {
      for (const [width, theme, language] of [[1440, 'light', 'vi'], [768, 'dark', 'vi'], [390, 'light', 'en'], [390, 'dark', 'vi']]) await check(browser, role, width, theme, language);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
