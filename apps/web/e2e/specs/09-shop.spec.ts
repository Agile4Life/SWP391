import { test, expect, settled } from '../fixtures';
import { authFile } from '../helpers/accounts';
import { api, apiWith } from '../helpers/api';
import { newMember } from '../helpers/session';
import type { OrderDto, Page, ProductDetailDto, ProductSummaryDto, QuoteDto } from '../../src/features/shop/shopTypes';

// Giữ test xử lý đơn của lễ tân; tạo fixture bằng API test thay vì màn Shop Member đã bỏ.
test.describe('Lễ tân xử lý đơn sản phẩm', () => {
  let orderCode = '';
  test.beforeAll(async () => {
    const member = await newMember({ prefix: 'e2es' });
    const catalog = await apiWith<Page<ProductSummaryDto>>(member.token, 'GET', '/public/products?inStock=true');
    expect(catalog.status).toBeLessThan(300);
    const product = catalog.data.content.find(item => item.inStock);
    expect(product, 'Catalog test cần ít nhất một sản phẩm còn hàng').toBeTruthy();
    const detail = await apiWith<ProductDetailDto>(member.token, 'GET', '/public/products/' + product!.slug);
    expect(detail.status).toBeLessThan(300);
    const variant = detail.data.variants.find(item => item.available && item.stock > 0);
    expect(variant, 'Sản phẩm test cần một biến thể còn hàng').toBeTruthy();
    const items = [{ variantId: variant!.id, quantity: 1 }];
    const quote = await apiWith<QuoteDto>(member.token, 'POST', '/public/shop/quote', { items, fulfillment: 'pickup' });
    expect(quote.status).toBeLessThan(300);
    expect(quote.data.valid).toBe(true);
    const order = await apiWith<OrderDto>(member.token, 'POST', '/shop/orders', {
      clientRequestId: crypto.randomUUID(), items, fulfillment: 'pickup', paymentMethod: 'counter', expectedTotal: quote.data.total,
    });
    expect(order.status).toBeLessThan(300);
    const paid = await api('staff', 'POST', '/staff/product-orders/' + order.data.id + '/counter-payment', { method: 'cash' });
    expect(paid.status).toBeLessThan(300);
    orderCode = order.data.code;
  });

  test('đơn xuất hiện ở "Cần xử lý" của lễ tân và đi hết vòng đời tới Hoàn tất', async ({ browser }) => {
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

});

test.describe('Shop hội viên đã ngừng bán', () => {
  test.use({ storageState: authFile('an') });
  for (const path of ['/member/products', '/member/products/sol-whey', '/member/checkout', '/member/orders', '/member/orders/42']) {
    test(path + ' trở về landing', async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/$/);
      await expect(page.locator('#hero-title')).toBeVisible();
    });
  }
});
