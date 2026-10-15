import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.emulateMedia({ colorScheme: 'light' });
});

for (const role of ['MEMBER', 'MANAGER']) {
  test(`${role} can change theme and keep it after navigation and reload`, async ({ page }) => {
    await page.addInitScript((role) => localStorage.setItem('fitcenter_auth_session', JSON.stringify({
      id: 'theme-review', name: 'Phong Trần', identifier: 'theme@example.invalid', role,
    })), role);
    await page.goto('/portal');
    await page.getByRole('button', { name: 'Bật chế độ tối', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Bật chế độ sáng', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Hồ sơ & Sức khỏe', exact: true }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Bật chế độ sáng', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Bật chế độ sáng', exact: true }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Bật chế độ tối', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Bật chế độ tối', exact: true }).click();
    await page.getByRole('link', { name: 'Quay lại trang chủ', exact: true }).click();
    await expect(page).toHaveURL('/');
    await expect(page.locator('html')).not.toHaveAttribute('data-portal-theme', 'dark');
  });
}

test('first visit follows system dark appearance', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => localStorage.setItem('fitcenter_auth_session', JSON.stringify({
    id: 'system-theme', name: 'Phong Trần', identifier: 'theme@example.invalid', role: 'MEMBER',
  })));
  await page.goto('/portal');
  await expect(page.getByRole('button', { name: 'Bật chế độ sáng', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Bật chế độ sáng', exact: true })).toBeVisible();
});

test('dark appearance keeps all manager controls visible on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => localStorage.setItem('fitcenter_auth_session', JSON.stringify({
    id: 'mobile-theme', name: 'Quản lý SÖL', identifier: 'theme@example.invalid', role: 'MANAGER',
  })));
  await page.goto('/portal');
  await page.getByRole('button', { name: 'Bật chế độ tối', exact: true }).click();
  await page.getByRole('button', { name: 'Mở điều hướng', exact: true }).click();
  const bounds = await page.locator('#portal-sidebar').boundingBox();
  const logout = await page.getByRole('button', { name: 'Đăng xuất', exact: true }).boundingBox();
  expect(logout!.y + logout!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Bật chế độ sáng', exact: true })).toBeVisible();
});

test('dark table text and attendance states maintain readable contrast', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fitcenter_auth_session', JSON.stringify({ id: 'contrast', name: 'Quản lý SÖL', identifier: 'contrast', role: 'MANAGER' }));
    localStorage.setItem('scms_portal_theme', 'dark');
  });
  const contrast = (selector: string) => page.evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    const rgb = (color) => color.match(/[\\d.]+/g).map(Number);
    const foreground = rgb(getComputedStyle(element).color);
    let background = [9, 9, 9];
    for (let node = element; node; node = node.parentElement) {
      const color = rgb(getComputedStyle(node).backgroundColor);
      if ((color[3] ?? 1) > 0) { background = color; break; }
    }
    const luminance = (color) => color.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, index) => sum + v * [.2126, .7152, .0722][index], 0);
    const a = luminance(foreground), b = luminance(background);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  })()`);
  await page.goto('/manager/reports');
  await expect(page.locator('.portal-table tbody tr').first()).toBeVisible();
  expect(await contrast('.portal-table tbody td:nth-child(3)')).toBeGreaterThanOrEqual(4.5);
  await page.goto('/staff/attendance');
  for (const selector of ['.seg-btn--ok.is-active', '.seg-btn--warn.is-active', '.seg-btn--bad.is-active', '.seg-btn:not(.is-active)']) {
    expect(await contrast(selector), selector).toBeGreaterThanOrEqual(4.5);
  }
});
