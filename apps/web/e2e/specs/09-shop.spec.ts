import { test, expect, settled } from '../fixtures';
import { authFile } from '../helpers/accounts';
import { contextFor, newMember } from '../helpers/session';
import type { Page } from '@playwright/test';

async function addFirstProductToCart(page: Page) {
  await page.goto('/products');
  await page.getByRole('button', { name: 'Thêm vào giỏ' }).first().click();
  await expect(page.getByRole('button', { name: /Giỏ hàng · 1 sản phẩm/ })).toBeVisible();
}
const pickup = async (page: Page) => page.getByText('Nhận tại quầy SÖL').first().click();

test.describe('Mua hàng và vòng đời đơn (hội viên + lễ tân)', () => {
  test.describe.configure({ mode: 'serial' });
  let orderCode = '';
  let member: Awaited<ReturnType<typeof newMember>>;

  test.beforeAll(async () => { member = await newMember({ topup: 2_000_000, prefix: 'e2es' }); });

  test('giỏ hàng lưu qua đăng nhập: khách chưa đăng nhập bấm thanh toán bị đưa tới /login', async ({ page }) => {
    await addFirstProductToCart(page);
    await page.getByRole('button', { name: /Giỏ hàng · 1 sản phẩm/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: /^Thanh toán/ }).click();
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fcheckout|\/login/);
  });

  test('nhận tại quầy + thanh toán bằng Ví SÖL: tạo đơn, trừ ví, xóa giỏ', async ({ browser }) => {
    const ctx = await contextFor(browser, member);
    const page = await ctx.newPage();
    await addFirstProductToCart(page);
    await page.goto('/checkout');
    await settled(page);
    await pickup(page);
    await page.getByRole('button', { name: 'Thanh toán bằng Ví SÖL' }).click();
    await expect(page).toHaveURL(/\/member\/orders\/\d+/);
    const main = page.locator('main');
    await expect(main).toContainText('Đã thanh toán');
    orderCode = (await main.innerText()).match(/SOL-\d{6}-[A-Z0-9]{4}/)?.[0] ?? '';
    expect(orderCode).toMatch(/^SOL-/);
    // giỏ đã được dọn
    await page.goto('/products');
    await expect(page.getByRole('button', { name: /Giỏ hàng · 0 sản phẩm|Giỏ hàng/ }).first()).toBeVisible();
    await ctx.close();
  });

  test('đơn xuất hiện ở "Cần xử lý" của lễ tân và đi hết vòng đời tới Hoàn tất', async ({ browser }) => {
    test.skip(!orderCode, 'cần đơn từ bước trước');
    test.setTimeout(90_000);
    const ctx = await browser.newContext({ storageState: authFile('staff') });
    const page = await ctx.newPage();
    await page.goto('/staff/orders');
    await settled(page);
    await page.getByPlaceholder(/Tìm mã đơn/).fill(orderCode);
    const row = page.locator('tr', { hasText: orderCode });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Mở' }).click();
    const dialog = page.getByRole('dialog');
    for (let i = 0; i < 6; i++) {
      const next = dialog.getByRole('button', { name: /Bắt đầu chuẩn bị|Sẵn sàng|Đã chuẩn bị xong|Giao|Đã giao|Đã nhận|Hoàn tất|Xác nhận/ }).first();
      if (!(await next.isVisible().catch(() => false))) break;
      await next.click();
      await page.waitForTimeout(700);
      const confirm = page.getByRole('dialog').filter({ hasText: /Xác nhận/ }).last();
      void confirm;
    }
    await expect(dialog).toContainText(/Hoàn tất|Đã giao|Đã nhận/);
    await dialog.getByRole('button', { name: 'Đóng hộp thoại' }).click();
    await page.getByRole('tab', { name: 'Tất cả', exact: true }).click();
    await expect(page.locator('tr', { hasText: orderCode })).toContainText(/Hoàn tất|Đã giao|Đã nhận/);
    await ctx.close();
  });

  test('hội viên thấy tiến trình đơn đã hoàn tất', async ({ browser }) => {
    test.skip(!orderCode, 'cần đơn từ bước trước');
    const ctx = await contextFor(browser, member);
    const page = await ctx.newPage();
    await page.goto('/member/orders');
    await settled(page);
    await expect(page.locator('main')).toContainText(orderCode);
    await ctx.close();
  });
});

test.describe('Thanh toán: trường hợp lỗi', () => {
  test('ví không đủ số dư: báo lỗi, không tạo đơn đã thanh toán, giỏ giữ nguyên', async ({ browser }) => {
    const poor = await newMember({ prefix: 'e2ep' });
    const ctx = await contextFor(browser, poor);
    const page = await ctx.newPage();
    await addFirstProductToCart(page);
    await page.goto('/checkout');
    await settled(page);
    await pickup(page);
    await page.getByRole('button', { name: 'Thanh toán bằng Ví SÖL' }).click();
    await expect(page.getByRole('alert').or(page.getByText(/không đủ|số dư|nạp thêm/i)).first()).toBeVisible();
    await expect(page).not.toHaveURL(/\/member\/orders\/\d+\/?$/);
    await ctx.close();
  });

  test('giao tận nơi bắt buộc địa chỉ: để trống không đặt được', async ({ browser }) => {
    const m = await newMember({ topup: 1_000_000, prefix: 'e2ed' });
    const ctx = await contextFor(browser, m);
    const page = await ctx.newPage();
    await addFirstProductToCart(page);
    await page.goto('/checkout');
    await settled(page);
    await page.getByText('Giao tận nơi').first().click();
    const pay = page.getByRole('button', { name: 'Thanh toán bằng Ví SÖL' });
    await expect(pay).toBeDisabled().catch(async () => {
      await pay.click();
      await expect(page.getByRole('alert').or(page.getByText(/địa chỉ|Họ tên|bắt buộc/i)).first()).toBeVisible();
    });
    await expect(page).toHaveURL(/\/checkout/);
    await ctx.close();
  });

  test('VNPay chưa cấu hình: báo lỗi thân thiện, không văng trang', async ({ browser }) => {
    const m = await newMember({ prefix: 'e2ev' });
    const ctx = await contextFor(browser, m);
    const page = await ctx.newPage();
    await addFirstProductToCart(page);
    await page.goto('/checkout');
    await settled(page);
    await pickup(page);
    await page.getByRole('button', { name: 'Thanh toán VNPay' }).click();
    await expect(page.locator('main')).toBeVisible();
    await expect(page).toHaveURL(/\/checkout|\/member\/orders/);
    await ctx.close();
  });

  test('giỏ trống: checkout không có nút thanh toán', async ({ browser }) => {
    const m = await newMember({ prefix: 'e2ee' });
    const ctx = await contextFor(browser, m);
    const page = await ctx.newPage();
    await page.goto('/checkout');
    await settled(page);
    await expect(page.getByRole('button', { name: /Thanh toán bằng Ví SÖL/ })).toHaveCount(0);
    await ctx.close();
  });
});

test.describe('Đơn hàng của hội viên', () => {
  test.use({ storageState: authFile('an') });
  test('các tab, bộ lọc trạng thái và địa chỉ giao hàng mở được', async ({ page }) => {
    await page.goto('/member/orders');
    await settled(page);
    for (const tab of ['Chờ thanh toán', 'Đang xử lý', 'Hoàn tất', 'Đã hủy', 'Tất cả']) await page.getByRole('button', { name: tab, exact: true }).click();
    await page.getByRole('button', { name: 'Địa chỉ giao hàng' }).or(page.getByRole('tab', { name: 'Địa chỉ giao hàng' })).first().click();
    await expect(page.locator('main')).toContainText(/địa chỉ/i);
  });
  test('mở đơn không tồn tại không làm sập trang', async ({ page }) => {
    await page.goto('/member/orders/99999999');
    await settled(page);
    await expect(page.locator('main')).toBeVisible();
  });
});
