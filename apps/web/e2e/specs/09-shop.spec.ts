import { test, expect } from '../fixtures';
import { authFile } from '../helpers/accounts';

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
