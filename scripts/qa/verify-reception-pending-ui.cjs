/* Fixture chỉ nằm trong browser QA localhost; không gọi backend hay ghi giao dịch thật. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../../apps/web/node_modules/@playwright/test');
const output = path.resolve('apps/web/node_modules/.cache/reception-pending-ui');
const base = process.env.PENDING_QA_URL || 'http://127.0.0.1:5183';
const image = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#eee"/><text x="30" y="200" font-size="32">QA document - all edges visible</text></svg>').toString('base64')}`;
const member = { memberId: 10, membershipCode: 'MEM-164', memberName: 'Anh Lê có tên dài để kiểm tra xuống dòng', memberEmail: 'anh.le.dia.chi.email.dai.de.kiem.tra@example.test', memberPhone: '0901234567' };
const plan = { ...member, id: 50, packageId: 2, packageName: 'Gói Gold ba tháng với tên dài', durationDays: 90, packagePrice: 1500000, startDate: '2026-11-01', endDate: '2027-01-29', status: 'pending_payment' };
const trial = { ...member, id: 55, documentType: 'CCCD', documentNumberMasked: '********4753', documentFullName: 'LÊ ANH', nationality: 'Việt Nam', frontImageUrl: image, backImageUrl: image, requestedAt: '2026-11-05T10:00:00', status: 'PENDING_APPROVAL' };

async function check(browser, theme, width, language = 'vi') {
  const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ theme, language }) => {
    localStorage.setItem('fitcenter_auth_session', JSON.stringify({ id: '2', identifier: 'staff', name: 'Lễ tân QA', role: 'STAFF' }));
    localStorage.setItem('fitcenter_token', 'ui-qa-only');
    localStorage.setItem('scms_theme', theme);
    localStorage.setItem('scms_lang', language);
  }, { theme, language });
  await page.route(/\/api\/v1\//, route => {
    const req = route.request(), pathname = new URL(req.url()).pathname;
    assert(req.method() === 'GET' || pathname.includes('realtime-session'), `Unexpected write: ${pathname}`);
    let data = [];
    if (pathname.endsWith('/auth/me')) data = { id: 2, username: 'staff', fullName: 'Lễ tân QA', role: 'RECEPTIONIST' };
    else if (pathname.includes('realtime-session')) data = { enabled: false, userId: 2 };
    else if (pathname.endsWith('/unread-count')) data = { count: 0 };
    else if (pathname.endsWith('/subscriptions/pending')) data = [plan];
    else if (pathname.endsWith('/enrollments/unpaid')) data = [{ ...member, enrollmentId: 601, className: 'Khóa Yoga nền tảng', disciplineName: 'Yoga', startDate: plan.startDate, endDate: plan.endDate, amount: 500000 }];
    else if (pathname.endsWith('/coach-bookings/unpaid')) data = [{ ...member, id: 90, coachName: 'Hùng', bookingDate: '2026-11-02', startTime: '15:15:00', endTime: '17:45:00', hourlyRate: 200000, status: 'completed' }];
    else if (pathname.endsWith('/reception/trials')) data = [trial, { ...trial, id: 56, documentType: 'PASSPORT', nationality: 'Canada', backImageUrl: null }];
    else if (pathname.endsWith('/holds/pending')) data = [{ ...plan, id: 72, holdReason: 'Đi công tác dài ngày, cần giữ nguyên đầy đủ lý do hội viên đã gửi.' }];
    return route.fulfill({ json: { success: true, data } });
  });
  try {
    await page.goto(`${base}/staff/reception`);
    await page.locator('.reception-request').nth(5).waitFor();
    assert.equal(await page.locator('.reception-request').count(), 6);
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
    const layout = await page.locator('.reception-request').evaluateAll(cards => cards.map(card => {
      const box = node => node.getBoundingClientRect();
      const details = card.querySelector('dl'), actions = card.querySelector('.reception-request__actions');
      const header = card.querySelector('header'), contact = card.querySelector('.reception-request__contact');
      const buttons = [...actions.children].map(box);
      return {
        columns: getComputedStyle(details).gridTemplateColumns.split(' ').length,
        ordered: box(header).bottom <= box(details).top && box(details).bottom <= box(actions).top,
        contactAligned: !contact || contact.children.length < 2 || Math.abs(box(contact.children[0]).top - box(contact.children[1]).top) < 2,
        contained: card.scrollWidth <= card.clientWidth + 1,
        actionsRight: Math.abs(buttons.at(-1).right - box(actions).right) < 2,
        buttonsOverlap: buttons.some((a, i) => buttons.slice(i + 1).some(b => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top)),
      };
    }));
    for (const card of layout) {
      assert(card.ordered && card.contained && !card.buttonsOverlap, JSON.stringify(card));
      assert.equal(card.columns, width >= 768 ? 2 : 1);
      if (width >= 768) assert(card.contactAligned && card.actionsRight, JSON.stringify(card));
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(output, `${language}-${theme}-${width}-queue.png`), fullPage: true });
    await page.locator('.reception-todo__tag--trial').first().locator('..').locator('..').locator('..').getByRole('button').first().click();
    const dialog = page.locator('.reception-trial-detail');
    await dialog.waitFor();
    assert(!(await dialog.textContent()).includes('Lưu ý nghiệp vụ'));
    assert((await dialog.locator('h2').textContent()).endsWith('#55'));
    assert((await dialog.locator('.reception-trial-detail__member').textContent()).includes('MEM-164'));
    const photos = dialog.locator('.document-photo-trigger');
    const bounds = await photos.evaluateAll(nodes => nodes.map(n => {
      const rect = n.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, fit: getComputedStyle(n.querySelector('img')).objectFit };
    }));
    assert.equal(bounds.length, 2);
    assert(bounds.every(b => b.fit === 'contain'));
    assert(Math.abs(bounds[0].width - bounds[1].width) < 2);
    assert(width < 768 ? bounds[1].y > bounds[0].y : Math.abs(bounds[1].y - bounds[0].y) < 2);
    assert.equal(await dialog.evaluate(n => n.scrollWidth > n.clientWidth + 1), false);
    await page.screenshot({ path: path.join(output, `${language}-${theme}-${width}-dialog.png`) });
    for (let i = 0; i < 2; i++) {
      await photos.nth(i).click();
      await page.locator('.document-lightbox').waitFor();
      await page.locator('.document-lightbox-modal .portal-dialog__close').click();
    }
    await dialog.locator('.portal-dialog__close').click();
    assert.equal(await page.locator('.reception-trial-detail').count(), 0);
    assert.deepEqual(errors, []);
    console.log(`PASS ${language} ${theme} ${width}px: five types, contacts, actions, overflow, trial dialog and both image zooms`);
  } finally { await page.close(); }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1440, 1366, 1280, 768, 390]) await check(browser, theme, width);
    for (const width of [1280, 390]) await check(browser, 'light', width, 'en');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
