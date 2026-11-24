import { test } from '../fixtures';
import { writeFileSync, mkdirSync } from 'node:fs';
import { authFile, type RoleKey } from '../helpers/accounts';

/**
 * Kiểm tra i18n (mục 13): truy cập từng route của mỗi vai trò bằng tiếng Anh và ghi các văn bản hiển thị còn tiếng Việt vào
 * e2e/.results/i18n-crawl.json. Không chạy trong bộ test thông thường: `I18N_AUDIT=1 npx playwright test 18-i18n-crawl`.
 * Dữ liệu động (tên gói/lớp/phòng/người) được phép giữ nguyên tiếng Việt; mọi nội dung còn lại trong báo cáo là phần bị thiếu dịch.
 */
const ROUTES: Record<string, string[]> = {
  an: ['/member/dashboard', '/member/packages', '/member/hold', '/member/card', '/member/check-in', '/member/invoices', '/member/progress', '/member/support', '/member/classes', '/member/classes?tab=pt', '/member/profile', '/member/notifications', '/messages', '/member/explore'],
  em: ['/member/dashboard', '/member/packages', '/member/hold'],
  lan: ['/member/dashboard', '/member/packages'],
  staff: ['/staff/reception', '/staff/check-in', '/staff/support', '/staff/coach-classes', '/staff/requests', '/staff/kyc', '/staff/holds', '/messages', '/profile'],
  coach: ['/coach/classes', '/coach/pt-attendance', '/coach/training-plans', '/coach/saved-plans', '/staff/requests', '/messages', '/profile'],
  manager: ['/manager/reports', '/manager/catalogs', '/manager/coach-assignments', '/manager/staff-accounts', '/manager/users', '/manager/cancellations', '/manager/support', '/manager/requests', '/profile'],
  admin: ['/admin/users', '/admin/audit-logs', '/profile'],
};
const VI = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹàáèéìíòóùúýÀ-Ỹ]/;

test('crawl English UI for leftover Vietnamese', async ({ browser }) => {
  test.skip(!process.env.I18N_AUDIT, 'set I18N_AUDIT=1 to run the i18n crawl');
  test.setTimeout(900_000);
  const report: Record<string, string[]> = {};
  for (const [role, routes] of Object.entries(ROUTES)) {
    const context = await browser.newContext({ storageState: authFile(role as RoleKey) });
    await context.addInitScript(() => { try { localStorage.setItem('scms_lang', 'en'); } catch { /* bỏ qua */ } });
    const page = await context.newPage();
    for (const route of routes) {
      try {
        await page.goto(route, { waitUntil: 'networkidle', timeout: 20_000 });
      } catch { /* giữ lại phần đã hiển thị */ }
      await page.waitForTimeout(1200);
      // Cuộn trang để các component hiện theo thao tác cuộn kịp render văn bản.
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } });
      const texts = await page.evaluate((pattern) => {
        const re = new RegExp(pattern);
        const out = new Set<string>();
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const t = (walker.currentNode.textContent ?? '').trim();
          const el = walker.currentNode.parentElement;
          if (!t || !el || el.closest('script,style,[aria-hidden="true"]')) continue;
          if (re.test(t)) out.add(t.slice(0, 160));
        }
        for (const el of Array.from(document.querySelectorAll('[aria-label],[title],[placeholder]'))) {
          for (const a of ['aria-label', 'title', 'placeholder']) { const v = el.getAttribute(a); if (v && re.test(v)) out.add(`@${a}: ${v.slice(0, 160)}`); }
        }
        return Array.from(out);
      }, VI.source);
      report[`${role} ${route}`] = texts;
    }
    await context.close();
  }
  mkdirSync('e2e/.results', { recursive: true });
  writeFileSync('e2e/.results/i18n-crawl.json', JSON.stringify(report, null, 2));
});
