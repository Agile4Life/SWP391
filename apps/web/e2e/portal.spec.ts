import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.addInitScript(() => {
    if (localStorage.getItem('fitcenter_auth_session')) return;
    localStorage.setItem('fitcenter_auth_session', JSON.stringify({
      id: 'portal-preview', name: 'Phong Trần', identifier: 'portal@example.invalid', role: 'MEMBER',
    }));
  });
});

test('member overview filters the schedule and connects to booking', async ({ page }) => {
  await page.goto('/portal');
  await expect(page).toHaveURL('/member/dashboard');
  await expect(page.getByRole('heading', { name: /Phong Trần/ })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Lịch tập của bạn' })).toContainText('Zenith Reformer Pilates');
  await page.getByRole('button', { name: 'Ngày mai', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Lịch tập của bạn' })).toContainText('Olympus Strength Conditioning');
  await expect(page.getByRole('region', { name: 'Lịch tập của bạn' })).not.toContainText('Zenith Reformer Pilates');
  await page.getByRole('link', { name: 'Đặt lớp mới', exact: true }).click();
  await expect(page).toHaveURL('/member/classes');
});

test('manager enters a management overview and can open users', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.setItem('fitcenter_auth_session', JSON.stringify({
      id: 'manager-preview', name: 'Quản lý SÖL', identifier: 'manager@example.invalid', role: 'MANAGER',
    }));
  });
  await page.goto('/portal');
  await expect(page).toHaveURL('/manager/dashboard');
  await expect(page.getByRole('region', { name: 'Tổng quan vận hành' })).toBeVisible();
  await page.getByRole('link', { name: 'Tài khoản & Phân quyền', exact: true }).click();
  await expect(page).toHaveURL('/manager/users');
});

test('mobile navigation opens, closes on navigation and has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/portal');
  const menu = page.getByRole('button', { name: 'Mở điều hướng', exact: true });
  await menu.click();
  await expect(page.getByRole('button', { name: 'Đóng menu', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  await page.getByRole('link', { name: 'Lịch học & Đặt chỗ', exact: true }).click();
  await expect(page).toHaveURL('/member/classes');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')).toBe(true);
});

test('collapsed sidebar keeps navigation accessible', async ({ page }) => {
  await page.goto('/portal');
  await page.getByRole('button', { name: 'Thu gọn thanh điều hướng', exact: true }).click();
  await page.getByRole('link', { name: 'Hồ sơ & Sức khỏe', exact: true }).click();
  await expect(page).toHaveURL('/member/profile');
});
