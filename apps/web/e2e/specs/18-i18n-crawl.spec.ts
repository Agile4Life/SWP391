import { test } from '../fixtures';
import { writeFileSync, mkdirSync } from 'node:fs';
import { authFile, type RoleKey } from '../helpers/accounts';

/**
 * Audit (mục 13): visit every route per role in English and write the visible text that is still Vietnamese to
 * e2e/.results/i18n-crawl.json. Not part of the normal run: `I18N_AUDIT=1 npx playwright test 18-i18n-crawl`.
 * Data (package/class/room/person names) is expected to stay Vietnamese; everything else in the report is a gap.
 */
const ROUTES: Record<string, string[]> = {
  an: ['/member/dashboard', '/member/packages', '/member/hold', '/member/card', '/member/check-in', '/member/invoices', '/member/orders', '/member/products', '/member/progress', '/member/support', '/member/classes', '/member/classes?tab=pt', '/member/courts', '/member/streak', '/member/profile', '/member/notifications', '/messages', '/member/explore'],
  em: ['/member/dashboard', '/member/packages', '/member/hold'],
  lan: ['/member/dashboard', '/member/packages'],
  staff: ['/staff/reception', '/staff/check-in', '/staff/support', '/staff/courts', '/staff/attendance', '/staff/coach-classes', '/staff/requests', '/staff/pt-attendance', '/staff/kyc', '/staff/holds', '/staff/classes', '/staff/orders', '/messages', '/profile'],
  coach: ['/coach/classes', '/coach/first-assessment', '/coach/pt-attendance', '/coach/training-plans', '/coach/health-metrics', '/coach/saved-plans', '/staff/requests', '/messages', '/profile'],
  manager: ['/manager/reports', '/manager/catalogs', '/manager/products', '/manager/products/new', '/manager/equipment', '/manager/coach-assignments', '/manager/staff-accounts', '/manager/users', '/manager/cancellations', '/manager/coach-reviews', '/manager/support', '/manager/requests', '/staff/classes', '/profile'],
  admin: ['/admin/users', '/admin/audit-logs', '/profile'],
};
const VI = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹàáèéìíòóùúýÀ-Ỹ]/;

test('crawl English UI for leftover Vietnamese', async ({ browser }) => {
  test.skip(!process.env.I18N_AUDIT, 'set I18N_AUDIT=1 to run the i18n crawl');
  test.setTimeout(900_000);
  const report: Record<string, string[]> = {};
  for (const [role, routes] of Object.entries(ROUTES)) {
    const context = await browser.newContext({ storageState: authFile(role as RoleKey) });
    await context.addInitScript(() => { try { localStorage.setItem('scms_lang', 'en'); } catch { /* ignore */ } });
    const page = await context.newPage();
    for (const route of routes) {
      try {
        await page.goto(route, { waitUntil: 'networkidle', timeout: 20_000 });
      } catch { /* keep what rendered */ }
      await page.waitForTimeout(1200);
      // Scroll so appear-on-scroll components render their text.
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
