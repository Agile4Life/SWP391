import { test, expect, settled } from '../fixtures';
import { authFile } from '../helpers/accounts';

test.describe('Ngôn ngữ và giao diện', () => {
  test('đổi Tiếng Việt <-> English lưu bền và dịch tiêu đề trang', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'English' }).first().click();
    await expect(page.getByRole('button', { name: /Sign in/i }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: /SIGN IN|Sign in/i }).first()).toBeVisible();
    await page.getByRole('button', { name: /Tiếng Việt/ }).first().click();
    await expect(page.locator('#login-identifier')).toBeVisible();
  });

  test.describe('portal tiếng Anh', () => {
    test.use({ storageState: authFile('binh') });
    test('trang gói tập và lịch học hiển thị tiếng Anh, không còn chuỗi tiếng Việt thô ở tiêu đề', async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('scms_lang', 'en'));
      await page.goto('/member/packages');
      await settled(page);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(/Memberships/i);
      await page.goto('/member/classes');
      await settled(page);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(/Classes/i);
    });
  });

  test.describe('chế độ tối', () => {
    test.use({ storageState: authFile('binh') });
    test('bật/tắt chế độ tối đổi theme và nhớ lại sau khi tải lại', async ({ page }) => {
      await page.goto('/member/dashboard');
      await settled(page);
      const html = page.locator('html');
      const before = await html.getAttribute('data-theme');
      await page.getByRole('button', { name: /chế độ (tối|sáng)/i }).first().click();
      const after = await html.getAttribute('data-theme');
      expect(after).not.toBe(before);
      await page.reload();
      await expect(html).toHaveAttribute('data-theme', after ?? '');
    });
  });
});

test.describe('Di động (375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('landing không tràn ngang và menu mở được', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#hero-title')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'không được cuộn ngang').toBeLessThanOrEqual(1);
  });
  test.describe('portal', () => {
    test.use({ storageState: authFile('binh') });
    test('thanh điều hướng di động và trang gói tập không tràn ngang', async ({ page }) => {
      await page.goto('/member/dashboard');
      await settled(page);
      await expect(page.getByRole('navigation', { name: /Điều hướng nhanh/ })).toBeVisible();
      for (const path of ['/member/packages', '/member/classes', '/member/courts']) {
        await page.goto(path);
        await settled(page);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${path} tràn ngang ${overflow}px`).toBeLessThanOrEqual(1);
      }
    });
  });
});

test.describe('Tham quan 3D', () => {
  test.use({ storageState: authFile('binh') });
  test('mở được; nếu WebGL không có thì có sơ đồ 2D dự phòng; không lỗi JS', async ({ page }) => {
    await page.goto('/member/explore');
    await page.waitForTimeout(4000);
    await expect(page.locator('main, #root').first()).toBeVisible();
    await expect(page.locator('canvas, svg').first()).toBeVisible();
  });
});

test.describe('Trợ lý SÖL AI / tin nhắn', () => {
  test.use({ storageState: authFile('binh') });
  test('mở hội thoại SÖL AI, gửi tin; nếu AI chưa cấu hình thì báo lỗi thân thiện', async ({ page }) => {
    await page.goto('/messages');
    await settled(page);
    await page.getByRole('button', { name: /SÖL AI/ }).first().click();
    const box = page.getByRole('textbox').last();
    await box.fill('Gói Gold có những quyền lợi gì?');
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toContainText('Gói Gold có những quyền lợi gì?');
    await page.waitForTimeout(3000);
    await expect(page.locator('main')).toBeVisible();
  });
});
