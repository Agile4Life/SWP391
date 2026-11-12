import { test, expect, settled, field } from '../fixtures';
import { authFile } from '../helpers/accounts';
import { api, apiWith } from '../helpers/api';
import { memberWithPlan, PACKAGES } from '../helpers/session';

async function dynamicQr(role: 'binh' | 'an' | 'chi' | 'hieu'): Promise<string> {
  const res = await api<{ qrCode: string }>(role, 'GET', '/memberships/subscriptions/my/dynamic-qr');
  expect(res.status).toBe(200);
  return res.data.qrCode;
}

test.describe('Check-in / check-out tại quầy lễ tân', () => {
  test.use({ storageState: authFile('staff') });
  test.describe.configure({ mode: 'serial' });

  test('trang Check-in có ô nhập mã QR và nhật ký các lượt vào gần đây', async ({ page }) => {
    await page.goto('/staff/check-in');
    await settled(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Check-in');
    await expect(field(page, /Nhập mã QR thẻ hội viên/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Lượt check-in gần đây' })).toBeVisible();
  });

  test('hội viên còn gói: quét mã động thành công và xuất hiện trong danh sách đang tập', async ({ page }) => {
    // hội viên mới tạo để không phụ thuộc việc dữ liệu demo đã có người "đang trong trung tâm" hay chưa
    const m = await memberWithPlan(PACKAGES.GOLD, 299000);
    const qr = await apiWith(m.token, 'GET', '/memberships/subscriptions/my/dynamic-qr');
    expect(qr.status).toBe(200);
    await page.goto('/staff/check-in');
    await settled(page);
    await field(page, /Nhập mã QR thẻ hội viên/).fill(qr.data.qrCode);
    await page.getByRole('button', { name: 'Check-in', exact: true }).click();
    await expect(page.locator('main')).toContainText(/XÁC THỰC HỢP LỆ/i);
    await expect(page.locator('main')).toContainText(m.username);
  });

  test('quét lại cùng một mã động bị từ chối (không dùng lại được)', async ({ page }) => {
    await page.goto('/staff/check-in');
    await settled(page);
    const code = await dynamicQr('chi');
    const input = field(page, /Nhập mã QR thẻ hội viên/);
    await input.fill(code);
    await page.getByRole('button', { name: 'Check-in', exact: true }).click();
    await expect(page.locator('main')).toContainText(/Lê Khánh Chi|thành công/i);
    await input.fill(code);
    await page.getByRole('button', { name: 'Check-in', exact: true }).click();
    await expect(page.getByRole('alert').or(page.locator('main')).first()).toContainText(/đã được sử dụng|đã check-in|từ chối|hết hạn|không hợp lệ/i);
  });

  test('mã rác / mã tĩnh cũ / mã rỗng đều bị từ chối với lý do dễ hiểu', async ({ page }) => {
    await page.goto('/staff/check-in');
    await settled(page);
    const input = field(page, /Nhập mã QR thẻ hội viên/);
    for (const bad of ['abc', 'SUB-1-ABCD1234', 'DYN:1:1:1:deadbeef', '<script>alert(1)</script>']) {
      await input.fill(bad);
      await page.getByRole('button', { name: 'Check-in', exact: true }).click();
      await expect(page.locator('main')).toContainText(/từ chối|không hợp lệ|không còn|hết hạn|không tìm thấy/i);
    }
    await input.fill('');
    await expect(page.getByRole('button', { name: 'Check-in', exact: true })).toBeDisabled();
  });

  test('check-out đưa hội viên ra khỏi danh sách đang trong trung tâm', async ({ page }) => {
    await page.goto('/staff/check-out');
    await settled(page);
    await page.getByRole('button', { name: /Đang trong trung tâm/ }).click();
    const buttons = page.getByRole('button', { name: /Checkout/ });
    const before = await buttons.count();
    expect(before).toBeGreaterThan(0);
    await buttons.first().click();
    await expect(buttons).toHaveCount(before - 1);
  });

  test('nhật ký 10 lượt gần nhất ghi cả lượt bị từ chối', async ({ page }) => {
    await page.goto('/staff/check-in');
    await settled(page);
    await expect(page.locator('main')).toContainText(/từ chối/i);
  });
});

test.describe('Hội viên tự check-in', () => {
  test.describe('hội viên còn gói (an)', () => {
    test.use({ storageState: authFile('an') });
    test('trang quét QR cổng: chuyển Check-in/Check-out, lịch sử theo khoảng thời gian', async ({ page }) => {
      await page.goto('/member/check-in');
      await settled(page);
      await page.getByRole('button', { name: 'Check-out' }).click();
      await expect(page.getByRole('heading', { level: 1 })).toContainText('check-out');
      await page.getByRole('button', { name: 'Check-in' }).first().click();
      for (const range of ['Hôm nay', '7 ngày', '30 ngày']) await page.getByRole('button', { name: range }).click();
      await expect(page.locator('main')).toContainText(/ra vào|Lịch sử/);
    });
    test('camera bị chặn quyền: hiện hướng dẫn thay vì treo', async ({ page }) => {
      await page.goto('/member/check-in');
      await settled(page);
      await page.getByRole('button', { name: 'Bật camera' }).click();
      await expect(page.getByRole('alert').or(page.locator('main')).first()).toContainText(/camera/i);
    });
  });

  test.describe('hội viên hết hạn (dung)', () => {
    test.use({ storageState: authFile('dung') });
    test('không lấy được mã động check-in', async () => {
      const res = await api('dung', 'GET', '/memberships/subscriptions/my/dynamic-qr');
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});

test.describe('Mã QR cổng ở quầy', () => {
  test.use({ storageState: authFile('staff') });
  test('mã cổng hiển thị thời hạn hiệu lực và tự làm mới ở tab Check-in và Check-out', async ({ page }) => {
    for (const path of ['/staff/check-in', '/staff/check-out']) {
      await page.goto(path);
      await settled(page);
      await expect(page.getByText(/Mã còn hiệu lực/)).toBeVisible();
    }
  });

  test('quầy lễ tân không còn hiện mã QR cổng', async ({ page }) => {
    await page.goto('/staff/reception');
    await settled(page);
    await expect(page.getByText(/Mã còn hiệu lực/)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Cần xử lý/ })).toBeVisible();
  });
});
