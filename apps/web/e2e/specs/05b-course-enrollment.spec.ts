import { test, expect, settled } from '../fixtures';
import { apiWith, createCourse } from '../helpers/api';
import { contextFor, memberWithPlan, newMember, PACKAGES } from '../helpers/session';

/**
 * Nghiệp vụ đăng ký khóa học của hội viên: lượt theo gói, học phí ngoài gói, ví, giữ chỗ, hoàn tiền.
 * Mỗi test dùng hội viên + khóa học mới nên lặp lại được. Test đánh dấu test.fail(...) là lỗi sản phẩm đã xác nhận.
 */
test.describe.configure({ mode: 'serial' });

test.describe('Hạn mức lượt theo gói SILVER 3 THÁNG (3 lượt)', () => {
  test('quota API trả đúng 3/3 khi chưa đăng ký; dùng 3 lượt miễn phí; lượt thứ 4 bị từ chối rõ ràng', async () => {
    const m = await memberWithPlan(PACKAGES.SILVER_3M, 549000);
    const quota0 = await apiWith(m.token, 'GET', '/classes/my-quota');
    expect(quota0.status, 'GET /classes/my-quota không được 500').toBe(200);
    expect(quota0.data.remainingCredits).toBe(3);
    const courses = [] as Awaited<ReturnType<typeof createCourse>>[];
    for (let i = 0; i < 4; i++) courses.push(await createCourse({ startInDays: 3 + i * 2 }));
    for (let i = 0; i < 3; i++) {
      const r = await apiWith(m.token, 'POST', `/classes/${courses[i].id}/enroll`, {});
      expect(r.status, `lượt ${i + 1} phải được`).toBe(201);
    }
    expect((await apiWith(m.token, 'GET', '/classes/my-quota')).data.remainingCredits).toBe(0);
    const fourth = await apiWith(m.token, 'POST', `/classes/${courses[3].id}/enroll`, {});
    expect(fourth.status).toBe(403);
    expect(fourth.body.code).toBe('SCHEDULING_COURSE_QUOTA_EXCEEDED');
    expect(String(fourth.body.message)).toMatch(/lượt|hạn mức/i);
  });

  test('lượt thứ 4 qua checkout: phải là khóa tính học phí (không miễn phí), có payment chờ thanh toán', async () => {
    const m = await memberWithPlan(PACKAGES.SILVER_3M, 549000);
    for (let i = 0; i < 3; i++) await apiWith(m.token, 'POST', `/classes/${(await createCourse({ startInDays: 3 + i * 2 })).id}/enroll`, {});
    const extra = await createCourse({ startInDays: 12, price: 500000 });
    const r = await apiWith(m.token, 'POST', `/classes/${extra.id}/checkout`, { method: 'cash' });
    expect(r.status).toBe(201);
    expect(r.data.method).not.toBe('free_quota');
    expect(Number(r.data.amount)).toBeGreaterThan(0);
    expect(r.data.paymentId).toBeTruthy();
  });

  test('giao diện: còn lượt thì banner nêu "Còn 3/3", KHÔNG báo hết lượt', async ({ browser }) => {
    const m = await memberWithPlan(PACKAGES.SILVER_3M, 549000);
    await createCourse({ startInDays: 3 });
    const ctx = await contextFor(browser, m);
    const page = await ctx.newPage();
    await page.goto('/member/classes');
    await settled(page);
    await page.getByRole('tab', { name: 'Lịch lớp học' }).click();
    const banner = page.getByTestId('course-quota-banner');
    await expect(banner).toContainText(/Còn 3\/3/);
    await expect(banner).not.toContainText(/hết lượt|đã dùng hết/i);
    await ctx.close();
  });

  test('giao diện: hết lượt thì đăng ký thêm phải hiện thông báo rõ (hết lượt/tính học phí)', async ({ browser }) => {
    const m = await memberWithPlan(PACKAGES.SILVER_3M, 549000);
    for (let i = 0; i < 3; i++) await apiWith(m.token, 'POST', `/classes/${(await createCourse({ startInDays: 3 + i * 2 })).id}/enroll`, {});
    const name = `E2E UI ${Date.now()}`;
    await createCourse({ startInDays: 12, name });
    const ctx = await contextFor(browser, m);
    const page = await ctx.newPage();
    await page.goto('/member/classes');
    await settled(page);
    await page.getByRole('tab', { name: 'Lịch lớp học' }).click();
    await expect(page.getByTestId('course-quota-banner')).toContainText(/hết|0\/3/i);
    await ctx.close();
  });
});

test.describe('Chưa có gói', () => {
  test('thông báo phải nói cần gói tập, KHÔNG được báo "hết lượt"', async () => {
    const m = await newMember({ prefix: 'e2eq' });
    const course = await createCourse({ startInDays: 4 });
    const res = await apiWith(m.token, 'POST', `/classes/${course.id}/enroll`, {});
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(String(res.body.message)).not.toMatch(/hết lượt/i);
    expect(String(res.body.message)).toMatch(/gói/i);
  });
});

test.describe('Thanh toán học phí bằng ví', () => {
  test('ví 0đ: không được xếp chỗ khi chọn Ví SÖL (và không hiện trong lịch cá nhân)', async () => {
    test.fail(true, 'BUG #2/#4 (audit): checkout tạo enrollment trạng thái booked ngay, không kiểm tra số dư ví ở bước đăng ký');
    const m = await memberWithPlan(PACKAGES.SILVER, 199000); // 1 lượt
    await apiWith(m.token, 'POST', `/classes/${(await createCourse({ startInDays: 3 })).id}/enroll`, {});
    const extra = await createCourse({ startInDays: 6, price: 700000 });
    const r = await apiWith(m.token, 'POST', `/classes/${extra.id}/checkout`, { method: 'online_wallet' });
    expect(r.status).toBeGreaterThanOrEqual(400);
    const mine = await apiWith(m.token, 'GET', '/classes/my-enrollments');
    expect((mine.data as any[]).filter((e) => String(e.status).toLowerCase() === 'booked' && e.className === extra.raw?.name)).toHaveLength(0);
  });

  test('thanh toán khoản học phí bằng ví 0đ qua /wallet/pay phải bị từ chối', async () => {
    const m = await memberWithPlan(PACKAGES.SILVER, 199000);
    await apiWith(m.token, 'POST', `/classes/${(await createCourse({ startInDays: 3 })).id}/enroll`, {});
    const extra = await createCourse({ startInDays: 6, price: 700000 });
    const co = await apiWith(m.token, 'POST', `/classes/${extra.id}/checkout`, { method: 'online_wallet' });
    expect(co.status).toBe(201);
    const pay = await apiWith(m.token, 'POST', '/wallet/pay', { paymentId: co.data.paymentId });
    expect(pay.status).toBeGreaterThanOrEqual(400);
  });

  test('enrollment trả phí chưa thanh toán không được tính là đã đặt chỗ', async () => {
    test.fail(true, 'BUG #2 (audit): enrollment booked (hiện trong lịch cá nhân, chiếm sức chứa) dù payment còn pending');
    const m = await memberWithPlan(PACKAGES.SILVER, 199000);
    await apiWith(m.token, 'POST', `/classes/${(await createCourse({ startInDays: 3 })).id}/enroll`, {});
    const extra = await createCourse({ startInDays: 6, price: 400000 });
    expect((await apiWith(m.token, 'POST', `/classes/${extra.id}/checkout`, { method: 'cash' })).status).toBe(201);
    const mine = await apiWith(m.token, 'GET', '/classes/my-enrollments');
    const enr = (mine.data as any[]).find((e) => e.className === extra.raw?.name);
    expect(String(enr?.status).toLowerCase()).not.toBe('booked');
  });
});

test.describe('Giữ chỗ khi chưa thanh toán', () => {
  test('chỗ giữ cho khoản chưa thanh toán phải có hạn', async () => {
    test.fail(true, 'BUG #5 (audit): "giữ chỗ ảo" vĩnh viễn — không có hạn/scheduler nhả chỗ cho enrollment khóa học chưa thanh toán (đặt sân, đơn hàng, VNPay đều có)');
    const m = await memberWithPlan(PACKAGES.SILVER, 199000);
    await apiWith(m.token, 'POST', `/classes/${(await createCourse({ startInDays: 3 })).id}/enroll`, {});
    const extra = await createCourse({ startInDays: 6, capacity: 1 });
    const r = await apiWith(m.token, 'POST', `/classes/${extra.id}/checkout`, { method: 'cash' });
    expect(r.status).toBe(201);
    expect(JSON.stringify(r.data)).toMatch(/expire|hạn|deadline/i);
  });
});

test.describe('Hủy khóa học đã trả tiền', () => {
  test('hủy khóa đã thanh toán bằng ví phải hoàn học phí về ví', async () => {
    test.fail(true, 'BUG #6 (audit): cancelCourseEnrollment chỉ vô hiệu khoản pending; khoản đã thanh toán không tạo phiếu hoàn trả học phí');
    const m = await memberWithPlan(PACKAGES.SILVER, 199000, { topup: 1_000_000 });
    await apiWith(m.token, 'POST', `/classes/${(await createCourse({ startInDays: 3 })).id}/enroll`, {});
    const extra = await createCourse({ startInDays: 6, price: 400000 });
    const balance0 = Number((await apiWith(m.token, 'GET', '/wallet/my')).data.balance);
    const co = await apiWith(m.token, 'POST', `/classes/${extra.id}/checkout`, { method: 'online_wallet' });
    expect(co.status).toBe(201);
    expect((await apiWith(m.token, 'POST', '/wallet/pay', { paymentId: co.data.paymentId })).status).toBeLessThan(300);
    expect(Number((await apiWith(m.token, 'GET', '/wallet/my')).data.balance)).toBeLessThan(balance0);
    expect((await apiWith(m.token, 'DELETE', `/classes/${extra.id}/enroll`)).status).toBe(200);
    expect(Number((await apiWith(m.token, 'GET', '/wallet/my')).data.balance)).toBe(balance0);
  });
});
