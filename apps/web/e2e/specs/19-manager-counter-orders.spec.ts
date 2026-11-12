import { test, expect, settled } from '../fixtures';
import { approveKyc, apiWith, createMemberWithKycPending } from '../helpers/api';
import { PACKAGES } from '../helpers/session';

/** Quản lý xử lý đơn tại quầy ngay trong tab "Đơn hàng" của trang Sản phẩm & Đơn hàng (không có mục riêng). */
test.describe('Quản lý: Đơn hàng → Đơn tại quầy', () => {
  test.use({ storageState: 'e2e/.auth/manager.json' });
  test.describe.configure({ mode: 'serial' });

  /** Hội viên đã qua KYC, đã gửi yêu cầu mua gói Silver và đang chờ thu tiền tại quầy. */
  async function memberWithPendingRequest() {
    const m = await createMemberWithKycPending('e2ecounter');
    expect((await approveKyc(m.id)).status).toBeLessThan(300);
    const sub = await apiWith(m.token, 'POST', '/memberships/subscriptions', { packageId: PACKAGES.SILVER });
    expect(sub.status, JSON.stringify(sub.body)).toBeLessThan(300);
    return { ...m, subscriptionId: (sub.data as any).id as number };
  }

  test('thu tiền một yêu cầu gói: có hóa đơn, gói được kích hoạt, yêu cầu rời khỏi danh sách', async ({ page }) => {
    const m = await memberWithPendingRequest();
    await page.goto('/manager/products?tab=orders');
    await settled(page);
    // Đơn tại quầy nằm cạnh đơn sản phẩm trong cùng tab Đơn hàng, không phải mục sidebar riêng.
    await expect(page.getByRole('group', { name: 'Loại đơn hàng' }).getByRole('button', { name: /Đơn sản phẩm/ })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('group', { name: 'Loại đơn hàng' }).getByRole('button', { name: /^Đơn tại quầy/ }).click();
    await expect(page).toHaveURL(/view=counter/);
    const card = page.getByTestId(`counter-request-${m.subscriptionId}`);
    await expect(card).toContainText(`Nguyen ${m.username}`);
    await card.getByRole('button', { name: 'Xác nhận thu tiền' }).click();
    await expect(page.getByRole('dialog').getByText(/HÓA ĐƠN THANH TOÁN/)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(card).toHaveCount(0);
    const mine = await apiWith(m.token, 'GET', '/memberships/subscriptions/my');
    expect((mine.data as any).status).toBe('active');
  });

  test('hủy một yêu cầu gói phải xác nhận trước; yêu cầu bị hủy', async ({ page }) => {
    const m = await memberWithPendingRequest();
    await page.goto('/manager/products?tab=orders&view=counter');
    await settled(page);
    const card = page.getByTestId(`counter-request-${m.subscriptionId}`);
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Hủy yêu cầu' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Hủy yêu cầu' }).click();
    await expect(card).toHaveCount(0);
    const history = await apiWith(m.token, 'GET', '/memberships/subscriptions/history');
    expect(((history.data as any[]) ?? []).find((s) => s.id === m.subscriptionId)?.status).toBe('cancelled');
  });

  test('quay lại Đơn sản phẩm vẫn thấy các trạng thái đơn hàng cũ', async ({ page }) => {
    await page.goto('/manager/products?tab=orders&view=counter');
    await settled(page);
    await page.getByRole('group', { name: 'Loại đơn hàng' }).getByRole('button', { name: /Đơn sản phẩm/ }).click();
    await expect(page.getByRole('tab', { name: /Chờ trả tại quầy/ })).toBeVisible();
    await expect(page).not.toHaveURL(/view=counter/);
  });
});
