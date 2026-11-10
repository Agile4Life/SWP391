import { test as base, expect, type Page } from '@playwright/test';

/**
 * Fixture dùng chung: mọi spec import `test`/`expect` từ đây.
 * - Gom lỗi JavaScript chưa bắt (pageerror) và console.error thật của ứng dụng, rồi làm test thất bại để bắt "lỗi vặt".
 * - Bỏ qua nhiễu đã biết: log tài nguyên HTTP 4xx (các ca lỗi cố ý), WebGL, Vite HMR, React DevTools.
 */
const IGNORED_CONSOLE = [
  /Failed to load resource/i,
  /GL Driver Message/i,
  /WebGL/i,
  /\[vite\]/i,
  /React DevTools/i,
  /Download the React DevTools/i,
  /net::ERR_/i,
  /ResizeObserver loop/i,
  /favicon/i,
  /realtime|websocket|wss?:\/\//i,
];

export const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() !== 'error') return;
        const text = message.text();
        if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
        problems.push(`console.error: ${text.slice(0, 300)}`);
      });
      await use(problems);
      expect(problems, 'Không được có lỗi JS/console chưa xử lý').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Chờ SPA qua trạng thái tải: có <main>, hết skeleton/aria-busy. Không dùng networkidle vì portal giữ kết nối realtime. */
export async function settled(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('main').first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);
  await page.locator('#portal-main[aria-busy="true"], main [aria-busy="true"], .portal-skeleton-line').first().waitFor({ state: 'detached', timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(250);
}

export const portalMain = (page: Page) => page.locator('main').first();

/** Ô nhập tìm theo nhãn hoặc placeholder (app dùng cả hai kiểu). */
export const field = (page: Page, text: string | RegExp) => page.getByLabel(text).or(page.getByPlaceholder(text)).first();

/** Đóng toast/thông báo nổi nếu có để không che nút thao tác. */
export async function dismissNotices(page: Page) {
  await page.keyboard.press('Escape').catch(() => undefined);
}

/** Chọn ngày (YYYY-MM-DD) trên DatePicker tùy biến: mở popover, lật tháng tới khi thấy nút ngày. */
export async function pickDate(page: Page, trigger: import('@playwright/test').Locator, isoDate: string) {
  await trigger.click();
  const popover = page.getByRole('dialog', { name: /Chọn ngày/ });
  await popover.waitFor({ state: 'visible' });
  const day = popover.getByRole('button', { name: isoDate, exact: true });
  for (let i = 0; i < 18 && !(await day.isVisible().catch(() => false)); i++) {
    const [y, m] = isoDate.split('-').map(Number);
    const shown = await popover.getByRole('button', { name: /Chọn năm/ }).first().innerText();
    const match = shown.match(/(\d{1,2})\D+(\d{4})/);
    const cur = match ? Number(match[2]) * 12 + Number(match[1]) : y * 12 + m;
    await popover.getByRole('button', { name: cur < y * 12 + m ? /Tháng sau/ : /Tháng trước/ }).click();
  }
  await day.click();
}

/** Ngày YYYY-MM-DD theo múi giờ trung tâm, cộng thêm n ngày. */
export function isoDay(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d);
}
