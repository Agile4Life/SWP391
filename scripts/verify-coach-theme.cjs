// Run against local Vite with playwright-core available. All API requests use fixtures.
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const base = process.env.PUBLIC_UI_URL || 'http://localhost:5173';
const output = process.env.UI_REVIEW_OUTPUT;
if (output) require('node:fs').mkdirSync(output, { recursive: true });
const session = { id: 1, classId: 1, className: 'Lớp kiểm tra', roomName: 'Studio 1', sessionDate: '2026-10-26', startTime: '08:00', endTime: '09:00', bookedCount: 8, capacity: 10, status: 'scheduled' };
const fixtures = {
  '/profile': { userId: 1, fullName: 'Review', email: 'review@example.test' },
  '/classes/sessions': [session],
  '/attendance/sessions/1': ['present', 'absent', 'late', 'excused'].map((status, i) => ({ id: i + 1, memberId: i + 1, fullName: `Học viên ${i + 1}`, membershipCode: `MB-${i + 1}`, status, progressScore: 70, notes: '' })),
  '/admin/audit-logs': { content: ['CREATE', 'UPDATE', 'DELETE'].map((action, i) => ({ id: i + 1, userId: 1, userFullName: 'Review', userEmail: 'review@example.test', action, entityType: 'classes', entityId: 1, oldValue: null, newValue: {}, createdAt: '2026-10-26T08:00:00' })), totalPages: 1, totalElements: 3, number: 0, size: 8 },
  '/reports/class-utilization': [{ classId: 1, className: session.className, disciplineName: 'Tennis', capacity: 10, enrolledCount: 8, presentCount: 6, utilizationRate: 80, attendanceRate: 75 }],
};

// Composite translucent backgrounds through the actual ancestor chain before measuring WCAG contrast.
async function contrast(locator) {
  return locator.evaluate(el => {
    const rgba = value => value.match(/[\d.]+/g).map(Number);
    const blend = (front, back) => front.slice(0, 3).map((v, i) => v * (front[3] ?? 1) + back[i] * (1 - (front[3] ?? 1)));
    const ancestors = [];
    for (let node = el; node; node = node.parentElement) ancestors.unshift(node);
    let bg = [255, 255, 255];
    for (const node of ancestors) bg = blend(rgba(getComputedStyle(node).backgroundColor), bg);
    const fg = blend(rgba(getComputedStyle(el).color), bg);
    const lum = rgb => rgb.map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((s, c, i) => s + c * [.2126, .7152, .0722][i], 0);
    return (Math.max(lum(fg), lum(bg)) + .05) / (Math.min(lum(fg), lum(bg)) + .05);
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const errors = [];
  const failures = [];
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce', timezoneId: 'Asia/Ho_Chi_Minh' });
    page.on('pageerror', e => errors.push(e.message));
    await page.clock.setFixedTime(new Date('2026-10-26T09:00:00+07:00'));
    await page.route('**/api/v1/**', route => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, '');
      return route.fulfill({ json: { success: true, data: fixtures[path] ?? [] } });
    });
    await page.route('**/accounts.google.com/**', route => route.fulfill({ body: '', contentType: 'text/javascript' }));
    for (const theme of ['light', 'dark']) {
      await page.addInitScript(theme => {
        localStorage.setItem('scms_theme', theme);
        localStorage.setItem('fitcenter_token', 'fixture-token');
        localStorage.setItem('fitcenter_auth_session', JSON.stringify({ id: '1', name: 'Review', identifier: 'review', role: 'MANAGER' }));
      }, theme);
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(`${base}/manager/audit-logs`);
        await page.locator('.action-badge').first().waitFor();
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
        for (const badge of await page.locator('.action-badge').all()) {
          for (const hover of [false, true]) {
            if (hover) await badge.hover();
            const ratio = await contrast(badge);
            if (ratio < 4.5) failures.push(`${theme}/${width} audit ${await badge.textContent()} hover=${hover}: ${ratio.toFixed(2)}:1`);
          }
        }
        await page.locator('.btn-view-diff').first().click();
        await page.locator('dialog[open]').waitFor();
        assert.ok(await contrast(page.locator('.diff-code-content').first()) >= 4.5, 'diff modal text contrast');
        await page.keyboard.press('Escape');
        await page.locator('dialog[open]').waitFor({ state: 'hidden' });
        await page.getByRole('tab').nth(1).click();
        await page.locator('.discipline-chart-item').waitFor();
        const bar = page.locator('.progress-fill-bar');
        const box = await bar.boundingBox();
        if (!box || box.height < 6 || box.width < 1) failures.push(`${theme}/${width} occupancy bar is invisible`);
        if (await page.locator('.chart-discipline-list').evaluate(el => getComputedStyle(el).display) !== 'flex') failures.push(`${theme}/${width} occupancy layout is missing`);
        if (output && width === 1440) await page.screenshot({ path: `${output}/occupancy-${theme}.png`, fullPage: true });
        await page.goto(`${base}/staff/attendance`);
        await page.locator('.attendance-student-card').first().waitFor();
        for (const label of await page.locator('.attendance-student-card').first().locator('.radio-status-label').all()) {
          const ratio = await contrast(label);
          if (ratio < 4.5) failures.push(`${theme}/${width} attendance ${await label.textContent()}: ${ratio.toFixed(2)}:1`);
        }
        const save = page.locator('.btn-batch-save');
        for (const hover of [false, true]) {
          if (hover) { await save.hover(); await page.waitForTimeout(250); }
          const ratio = await contrast(save);
          if (ratio < 4.5) failures.push(`${theme}/${width} save hover=${hover}: ${ratio.toFixed(2)}:1`);
        }
        if (output && width === 1440) await page.screenshot({ path: `${output}/attendance-${theme}.png`, fullPage: true });
        for (const route of ['/coach/classes', '/coach/training-plans']) {
          await page.goto(`${base}${route}`);
          await page.locator(route.endsWith('classes') ? '.coach-session-card' : '.exercise-item-card').first().waitFor();
        }
        console.log(`Checked four routes: ${theme}, ${width}px`);
      }
    }
    assert.deepEqual(errors, [], 'browser runtime errors');
    assert.deepEqual(failures, [], 'CSS regressions');
    console.log('PASS occupancy rendering, status contrast, save hover, four routes in both themes');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
