import { test, expect, settled } from '../fixtures';
import { authFile } from '../helpers/accounts';
import { apiWith, createMemberWithKycPending, type FreshMember } from '../helpers/api';

/**
 * Luồng chính số 1: hội viên mới -> KYC -> lễ tân duyệt -> đăng ký gói -> lễ tân thu tiền mặt -> gói kích hoạt.
 * Chạy tuần tự trên một hội viên mới tạo riêng cho lần chạy này.
 */
test.describe.configure({ mode: 'serial' });

let member: FreshMember;
const storageFor = (m: FreshMember) => ({
  cookies: [],
  origins: [{
    origin: 'http://localhost:4173',
    localStorage: [
      { name: 'fitcenter_token', value: m.token },
      { name: 'fitcenter_auth_session', value: JSON.stringify({ id: m.username, name: m.username, identifier: m.username, role: 'MEMBER' }) },
      { name: 'scms_lang', value: 'vi' },
    ],
  }],
});

test.beforeAll(async () => {
  member = await createMemberWithKycPending();
});

test.describe('KYC và đăng ký gói', () => {
  test('KYC chưa duyệt: hội viên chưa thể đăng ký gói đầu tiên', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: storageFor(member) });
    const page = await ctx.newPage();
    await page.goto('/member/packages');
    await settled(page);
    await page.getByRole('button', { name: 'Đăng ký lần đầu' }).first().click();
    await page.waitForTimeout(1500);
    const sub = await apiWith(member.token, 'GET', '/memberships/subscriptions/my');
    expect(sub.data == null || (sub.data as any).status === undefined || sub.status >= 400).toBeTruthy();
    await expect(page.getByText('Đã gửi yêu cầu thành công')).toHaveCount(0);
    await ctx.close();
  });

  test.describe('lễ tân duyệt KYC', () => {
    test.use({ storageState: authFile('staff') });
    test('hiện hồ sơ mới trong danh sách chờ và duyệt được', async ({ page }) => {
      await page.goto('/staff/kyc');
      await settled(page);
      const row = page.locator('main').getByText(`Nguyen ${member.username}`, { exact: false }).first();
      await expect(row).toBeVisible();
      await row.locator('xpath=ancestor::*[.//button[normalize-space()="Duyệt"]][1]').getByRole('button', { name: 'Duyệt' }).click();
      await expect(page.locator('main').getByText(`Nguyen ${member.username}`)).toHaveCount(0);
    });
  });

  test('sau khi KYC được duyệt: đăng ký gói, chặn yêu cầu thứ hai, hủy rồi đăng ký lại', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: storageFor(member) });
    const page = await ctx.newPage();
    await page.goto('/member/packages');
    await settled(page);
    await page.getByRole('button', { name: 'Đăng ký lần đầu' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Đã gửi yêu cầu thành công');
    await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
    await expect(page.getByText('Đang chờ thanh toán').first()).toBeVisible();
    // edge: không cho tạo thêm yêu cầu khi đã có yêu cầu đang chờ
    const others = page.getByRole('button', { name: 'Có yêu cầu đang chờ' });
    expect(await others.count()).toBeGreaterThan(0);
    await others.first().click();
    await expect(page.getByRole('dialog')).not.toContainText('Đã gửi yêu cầu thành công');
    await expect(page.getByRole('dialog')).toContainText(/đang chờ|liên hệ|Chưa thể/i);
    await page.keyboard.press('Escape');
    expect((await apiWith(member.token, 'POST', '/memberships/subscriptions', { packageId: 3 })).status).toBeGreaterThanOrEqual(400);
    // worst case: hủy yêu cầu rồi đăng ký lại
    await page.getByRole('button', { name: 'Hủy yêu cầu đăng ký' }).first().click();
    const confirm = page.getByRole('dialog');
    if (await confirm.isVisible().catch(() => false)) await confirm.getByRole('button', { name: /Hủy yêu cầu|Xác nhận|Đồng ý/ }).last().click();
    const register = page.getByRole('button', { name: /Đăng ký (lần đầu|gói mới)/ }).first();
    await expect(register).toBeVisible();
    await register.click();
    await expect(page.getByRole('dialog')).toContainText('Đã gửi yêu cầu thành công');
    await ctx.close();
  });

  test.describe('lễ tân thu tiền mặt', () => {
    test.use({ storageState: authFile('staff') });
    test('tra cứu theo mã hội viên, xác nhận thu tiền và xuất hóa đơn', async ({ page }) => {
      await page.goto('/staff/reception');
      await settled(page);
      const card = page.locator('main').getByText(`Nguyen ${member.username}`, { exact: false }).first();
      await expect(card).toBeVisible();
      await card.locator('xpath=ancestor::*[.//button[normalize-space()="Chọn xác nhận"]][1]').getByRole('button', { name: 'Chọn xác nhận' }).click();
      await page.getByRole('button', { name: 'Xác nhận thu tiền & xuất hóa đơn' }).click();
      await expect(page.getByRole('alert').or(page.getByRole('status')).filter({ hasText: /thành công|hóa đơn/i }).first()).toBeVisible();
    });
  });

  test('gói đã kích hoạt: thẻ QR, trạng thái và hóa đơn của hội viên', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: storageFor(member) });
    const page = await ctx.newPage();
    await page.goto('/member/dashboard');
    await settled(page);
    await expect(page.getByText('Đang hoạt động').first()).toBeVisible();
    await page.goto('/member/card');
    await settled(page);
    await expect(page.getByText('Gói tập đang hoạt động')).toBeVisible();
    await expect(page.locator('main canvas, main img[alt*="QR"], main svg').first()).toBeVisible();
    await page.goto('/member/invoices');
    await settled(page);
    await expect(page.getByRole('button', { name: /Xem hóa đơn/ }).first()).toBeVisible();
    await ctx.close();
  });
});
