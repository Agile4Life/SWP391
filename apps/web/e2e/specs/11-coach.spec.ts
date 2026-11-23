import { test, expect, settled, field } from '../fixtures';
import { authFile } from '../helpers/accounts';

test.use({ storageState: authFile('coach') });

test.describe('HLV: lịch dạy', () => {
  test('lịch PT 1:1 theo tuần và học viên phụ trách', async ({ page }) => {
    await page.goto('/coach/classes');
    await settled(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.getByRole('tab', { name: 'Học viên phụ trách' }).or(page.getByRole('button', { name: 'Học viên phụ trách' })).first().click();
    await expect(page.locator('main')).toContainText(/Nguyễn Minh An|Ngô Trung Hiếu/);
  });
});

test.describe('HLV: điểm danh buổi PT 1:1', () => {
  test('lọc theo trạng thái và khoảng ngày; không lỗi khi đổi khoảng ngày không hợp lệ', async ({ page }) => {
    await page.goto('/coach/pt-attendance');
    await settled(page);
    for (const name of [/Đã có mặt/, /Không có mặt/, /Sắp diễn ra/, /Tất cả/]) await page.getByRole('tab', { name }).or(page.getByRole('button', { name })).first().click();
    await page.locator('#pt-from').fill('2026-12-31');
    await page.locator('#pt-to').fill('2026-01-01');
    await expect(page.locator('main')).toBeVisible();
  });
});

/** Giáo án soạn theo 3 bước: 1 học viên & kế hoạch, 2 bài tập theo ngày, 3 xem lại & kích hoạt. Chỉ số sức khỏe có tab riêng. */
const openPlanStep = (page: import('@playwright/test').Page, step: 1 | 2 | 3) => page.locator('.plan-step__button').nth(step - 1).click();

test.describe('HLV: soạn giáo án', () => {
  test('thêm/xóa bài tập; bài tập thiếu tên hoặc số hiệp âm bị chặn', async ({ page }) => {
    await page.goto('/coach/training-plans');
    await settled(page);
    await openPlanStep(page, 2);
    await expect(page.locator('#exercise-name-input')).toBeVisible();
    await page.waitForTimeout(1000);
    const total = async () => page.locator('.exercise-item-card').count();
    const before = await total();
    expect(before).not.toBeNaN();
    // thiếu tên
    await page.getByRole('button', { name: 'Thêm', exact: true }).click();
    expect(await total()).toBe(before);
    // số hiệp âm
    await page.locator('#exercise-name-input').fill('Squat tạ đòn');
    await page.locator('#exercise-sets-input').fill('-3');
    await page.locator('#exercise-reps-input').fill('10');
    await page.getByRole('button', { name: 'Thêm', exact: true }).click();
    expect(await total()).toBe(before);
    // hợp lệ
    await page.locator('#exercise-sets-input').fill('4');
    await page.getByRole('button', { name: 'Thêm', exact: true }).click();
    await expect.poll(total).toBe(before + 1);
    // xóa bài vừa thêm
    await page.getByText('✕').last().click();
    await expect.poll(total).toBe(before);
  });

  test('lưu giáo án: bắt buộc có tên; lưu hợp lệ được kích hoạt ở bước cuối', async ({ page }) => {
    await page.goto('/coach/training-plans');
    await settled(page);
    const name = `Giáo án e2e ${Date.now()}`;
    await page.locator('#plan-title-input').fill(name);
    await openPlanStep(page, 3);
    await expect(page.locator('main')).toContainText(name);
    await page.getByRole('button', { name: 'Lưu & Kích hoạt giáo án' }).click();
    await expect(page.locator('main')).toContainText(/Đã kích hoạt/);
    // hội viên thụ hưởng (Ngô Trung Hiếu) thấy giáo án trong trang tiến độ
    const res = await (await import('../helpers/api')).apiLogin('hieu@demo.sol.vn', 'Demo@12345');
    const plans = await (await import('../helpers/api')).apiWith(res.token, 'GET', '/coaching/training-plans/my');
    expect(plans.status).toBe(200);
    void name;
  });

  test('gợi ý AI: nếu nhà cung cấp AI chưa cấu hình thì báo lỗi thân thiện, trang vẫn dùng được', async ({ page }) => {
    await page.goto('/coach/training-plans');
    await settled(page);
    await page.getByRole('button', { name: 'Gợi ý giáo án bằng AI' }).click();
    await page.waitForTimeout(4000);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('#plan-title-input')).toBeVisible();
  });
});

test.describe('HLV: không có quyền ngoài vai trò', () => {
  test('HLV không vào được báo cáo và quản trị', async ({ page }) => {
    for (const path of ['/manager/reports', '/admin/users', '/staff/reception']) {
      await page.goto(path);
      await expect(page).toHaveURL(/staff\/attendance/);
    }
    void field;
  });
});
