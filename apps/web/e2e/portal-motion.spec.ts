import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.addInitScript(() => localStorage.setItem('fitcenter_auth_session', JSON.stringify({
    id: 'manager-layout', name: 'Quản lý SÖL', identifier: 'layout@example.invalid', role: 'MANAGER',
  })));
});

test('all manager navigation and account controls fit without sidebar scrolling', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 }, { width: 1366, height: 768 },
    { width: 1024, height: 600 }, { width: 320, height: 568 },
    { width: 390, height: 844 }, { width: 844, height: 390 },
    { width: 568, height: 320 }, { width: 1024, height: 500 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/portal');
    await expect(page).toHaveURL('/manager/dashboard');
    const toggle = page.getByRole('button', { name: 'Mở điều hướng', exact: true });
    if (await toggle.isVisible()) await toggle.click();
    const geometry = await page.evaluate(`(() => {
      const element = document.getElementById('portal-sidebar');
      const bounds = element.getBoundingClientRect();
      return {
        scroll: element.scrollHeight > element.clientHeight + 1,
        clipped: [...element.querySelectorAll('nav a, .sidebar-account a, .sidebar-account button')]
          .filter((link) => { const box = link.getBoundingClientRect(); return box.top < bounds.top || box.bottom > bounds.bottom; })
          .map((link) => link.getAttribute('aria-label')),
      };
    })()`);
    expect(geometry, `${viewport.width} × ${viewport.height}`).toEqual({ scroll: false, clipped: [] });
    await expect(page.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible();
  }
});

test('sidebar hover highlight follows the pointer and returns to the selected page', async ({ page }) => {
  await page.goto('/portal');
  const indicator = page.locator('.portal-nav-indicator');
  const selected = page.getByRole('navigation', { name: 'Điều hướng portal' }).getByRole('link', { name: 'Tổng quan', exact: true });
  const users = page.getByRole('link', { name: 'Tài khoản & Phân quyền', exact: true });
  await expect(indicator).toBeVisible();
  const selectedBox = await selected.boundingBox();
  const usersBox = await users.boundingBox();
  await users.hover();
  await expect.poll(async () => Math.abs((await indicator.boundingBox())!.y - usersBox!.y)).toBeLessThan(2);
  await page.getByRole('heading', { name: /Quản lý SÖL/ }).hover();
  await expect.poll(async () => Math.abs((await indicator.boundingBox())!.y - selectedBox!.y)).toBeLessThan(2);
});
