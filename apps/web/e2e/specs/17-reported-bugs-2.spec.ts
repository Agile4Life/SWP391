import { test, expect, settled } from '../fixtures';
import { api, apiWith } from '../helpers/api';
import { contextFor, memberWithPlan, PACKAGES } from '../helpers/session';

/**
 * Đợt lỗi do tester báo ngày 12/11/2026 (class booking, membership, PT, đặt sân, giao dịch, lễ tân).
 * Mỗi describe dựng dữ liệu giả cho đúng tình huống rồi kiểm tra hành vi; số trong tên khớp số mục trong báo cáo.
 */
test.describe.configure({ mode: 'serial' });

const COACH_MAI = 5; // HLV Yoga (mai@demo)
const TENNIS = 6;
const isoDay = (offset: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(Date.now() + offset * 86_400_000));

async function classByName(name: string) {
  const res = await api<any[]>('manager', 'GET', '/classes');
  return (res.data as any[]).find((c) => c.name === name);
}

test.describe('Mục 1 — đăng ký khóa học', () => {
  test('khóa đã bắt đầu: API trả lỗi "Khóa học đã bắt đầu" thay vì lỗi gói tập; UI hiện nút vô hiệu', async ({ browser }) => {
    const m = await memberWithPlan(PACKAGES.PLATINUM_3M, 1599000);
    const yoga = await classByName('Morning Flow Yoga');
    expect(yoga.startDate < isoDay(0), 'khóa demo đã bắt đầu').toBe(true);

    const res = await apiWith(m.token, 'POST', `/classes/${yoga.id}/enroll`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SCHEDULING_COURSE_ALREADY_STARTED');
    expect(res.body.message).toContain('đã bắt đầu');

    const context = await contextFor(browser, m);
    const page = await context.newPage();
    await page.goto('/member/classes');
    await settled(page);
    await page.getByRole('tab', { name: 'Lịch lớp học' }).click();
    await expect(page.getByRole('button', { name: 'Khóa đã bắt đầu' }).first()).toBeDisabled();
    await context.close();
  });

  test('khóa chưa bắt đầu và nằm trong hạn gói: đăng ký được', async () => {
    const m = await memberWithPlan(PACKAGES.PLATINUM_3M, 1599000);
    const course = await classByName('Yoga Cơ Bản (khóa mới)');
    expect(course, 'seeder tạo khóa sắp mở').toBeTruthy();
    expect(course.startDate > isoDay(0)).toBe(true);
    const res = await apiWith(m.token, 'POST', `/classes/${course.id}/enroll`);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
  });

  test('ngày kết thúc khóa demo trùng buổi học cuối (không còn "phải gia hạn đến 6 tuần sau")', async () => {
    const yoga = await classByName('Morning Flow Yoga');
    const sessions = await api<any[]>('manager', 'GET', `/classes/sessions?fromDate=${yoga.startDate}&toDate=${isoDay(90)}`);
    const dates = (sessions.data as any[]).filter((s) => s.classId === yoga.id).map((s) => s.sessionDate).sort();
    expect(dates.at(-1)).toBe(yoga.endDate);
    expect(dates[0]).toBe(yoga.startDate);
  });
});

test.describe('Mục 2–3 — lịch lớp khớp buổi học', () => {
  test('mỗi buổi học rơi đúng thứ đã thiết lập của lớp', async () => {
    const classes = (await api<any[]>('manager', 'GET', '/classes')).data as any[];
    const sessions = (await api<any[]>('manager', 'GET', `/classes/sessions?fromDate=${isoDay(-40)}&toDate=${isoDay(60)}`)).data as any[];
    const names = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    for (const c of classes.filter((x) => x.repeatType !== 'monthly')) {
      expect(c.recurringDays, `${c.name} có thứ học`).toBeTruthy();
      const days = String(c.recurringDays).split(',');
      for (const s of sessions.filter((x) => x.classId === c.id)) {
        const weekday = names[new Date(`${s.sessionDate}T12:00:00Z`).getUTCDay()];
        expect(days, `${c.name} buổi ${s.sessionDate}`).toContain(weekday);
      }
    }
  });
});

test.describe('Mục 4 — nâng cấp gói: chỉ gói mới còn hoạt động', () => {
  test('Silver 3 tháng nâng lên Platinum: Silver chuyển expired, gói hiện tại là Platinum, trang gói không còn Silver hoạt động', async ({ browser }) => {
    const m = await memberWithPlan(PACKAGES.SILVER_3M, 549000);
    const current = await apiWith(m.token, 'GET', '/memberships/subscriptions/my');
    const silverId = (current.data as any).id;
    const up = await apiWith(m.token, 'POST', `/memberships/subscriptions/${silverId}/upgrade`, { packageId: PACKAGES.PLATINUM });
    expect(up.status, JSON.stringify(up.body)).toBeLessThan(300);
    const upgrade = up.data as any;
    const charge = Number(upgrade.upgradeCharge ?? upgrade.packagePrice ?? upgrade.price);
    const pay = await api('staff', 'POST', '/payments/process', { memberId: m.id, subscriptionId: upgrade.id, amount: charge, method: 'cash', note: 'e2e upgrade' });
    expect(pay.status, JSON.stringify(pay.body)).toBeLessThan(300);

    const history = (await apiWith(m.token, 'GET', '/memberships/subscriptions/history')).data as any[];
    const silver = history.find((s) => s.id === silverId);
    const platinum = history.find((s) => s.id === upgrade.id);
    expect(silver.status).toBe('expired');
    expect(platinum.status).toBe('active');
    expect(history.filter((s) => s.status === 'active')).toHaveLength(1);
    expect(((await apiWith(m.token, 'GET', '/memberships/subscriptions/my')).data as any).packageName).toMatch(/PLATINUM/);

    const context = await contextFor(browser, m);
    const page = await context.newPage();
    await page.goto('/member/packages');
    await settled(page);
    await expect(page.locator('main')).toContainText('PLATINUM');
    await page.screenshot({ path: 'e2e/.results/muc4-packages-after-upgrade.png', fullPage: true });
    await context.close();
  });
});

test.describe('Mục 7 — hủy lịch PT đã thanh toán online', () => {
  test('PT trả bằng ví (luồng VNPay nạp ví rồi trừ) hủy được và tiền hoàn về ví', async ({ browser }) => {
    const m = await memberWithPlan(PACKAGES.PLATINUM_3M, 1599000, { topup: 500000 });
    let booking: any;
    for (let offset = 3; offset < 10 && !booking; offset++) {
      const res = await apiWith(m.token, 'POST', '/coach-bookings', { coachId: COACH_MAI, bookingDate: isoDay(offset), startTime: '15:00', endTime: '16:00', paymentMethod: 'bank_transfer' });
      if (res.status < 300) booking = res.data;
    }
    expect(booking, 'dựng được lịch PT tính phí').toBeTruthy();
    const paid = await apiWith(m.token, 'POST', '/wallet/pay', { coachBookingId: booking.id });
    expect(paid.status, JSON.stringify(paid.body)).toBeLessThan(300);
    const balanceAfterPay = Number((await apiWith(m.token, 'GET', '/wallet/my')).data.balance);

    const context = await contextFor(browser, m);
    const page = await context.newPage();
    await page.goto('/member/classes?tab=pt');
    await settled(page);
    await page.screenshot({ path: 'e2e/.results/muc7-pt-before-cancel.png', fullPage: true });
    await context.close();

    const cancel = await apiWith(m.token, 'DELETE', `/coach-bookings/${booking.id}?reason=e2e`);
    expect(cancel.status, JSON.stringify(cancel.body)).toBeLessThan(300);
    expect((cancel.data as any).status).toBe('cancelled');
    const balanceAfterCancel = Number((await apiWith(m.token, 'GET', '/wallet/my')).data.balance);
    expect(balanceAfterCancel).toBeGreaterThan(balanceAfterPay);
  });
});

test.describe('Mục 9–10 — đặt sân và thanh toán bằng Ví SÖL', () => {
  test('chọn ngày + khung giờ trên giao diện đặt được sân; trả bằng ví thì booking chuyển paid', async ({ browser }) => {
    const m = await memberWithPlan(PACKAGES.SILVER, 199000, { topup: 500000 });
    const context = await contextFor(browser, m);
    const page = await context.newPage();
    await page.goto('/member/courts');
    await settled(page);
    await page.screenshot({ path: 'e2e/.results/muc10-courts.png', fullPage: true });
    const free = page.locator('.court-slot--free').first();
    await expect(free).toBeVisible();
    await free.click();
    const confirm = page.getByRole('button', { name: /Xác nhận đặt|Đặt sân & Thanh toán/ });
    await expect(confirm).toBeEnabled();
    const created = page.waitForResponse((r) => r.url().includes('/court-bookings') && r.request().method() === 'POST');
    await confirm.click();
    expect((await created).status()).toBe(201);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await context.close();

    // Lượt thứ hai vượt quyền lợi gói Silver -> tính phí; trả bằng ví phải đồng bộ cả payment và booking.
    let paidBooking: any;
    for (let offset = 2; offset < 7 && !paidBooking; offset++) {
      for (const hour of [9, 11, 15, 19]) {
        const res = await apiWith(m.token, 'POST', '/court-bookings', { roomId: TENNIS, date: isoDay(offset), startTime: `${hour}:00`.padStart(5, '0'), paymentMethod: 'vnpay' });
        if (res.status < 300) { paidBooking = res.data; break; }
      }
    }
    expect(paidBooking, 'dựng được lượt sân tính phí').toBeTruthy();
    expect(paidBooking.paymentStatus).toBe('pending');
    const pay = await apiWith(m.token, 'POST', '/wallet/pay', { courtBookingId: paidBooking.id });
    expect(pay.status, JSON.stringify(pay.body)).toBeLessThan(300);
    const mine = (await apiWith(m.token, 'GET', '/court-bookings/my?page=0&size=20')).data as any;
    const after = (mine.content ?? mine).find((b: any) => b.id === paidBooking.id);
    expect(after.status).toBe('booked');
    expect(after.paymentStatus).toBe('paid');
  });
});

test.describe('Mục 11 — giao dịch chờ thanh toán ghi rõ dịch vụ', () => {
  test('khoản chờ thanh toán của lượt sân hiện "Đặt sân · <sân> · <ngày> · <giờ>"', async ({ browser }) => {
    const m = await memberWithPlan(PACKAGES.SILVER, 199000);
    // Dùng hết lượt miễn phí rồi đặt thêm một lượt trả tại quầy (tạo khoản chờ thanh toán).
    let pending: any;
    for (let offset = 2; offset < 7 && !pending; offset++) {
      for (const hour of [8, 10, 16, 18]) {
        const res = await apiWith(m.token, 'POST', '/court-bookings', { roomId: TENNIS, date: isoDay(offset), startTime: `${String(hour).padStart(2, '0')}:00`, paymentMethod: 'cash' });
        if (res.status < 300 && res.data.paymentStatus === 'pending') { pending = res.data; break; }
      }
    }
    expect(pending, 'dựng được khoản chờ thanh toán').toBeTruthy();
    const payments = (await apiWith(m.token, 'GET', '/payments/my')).data as any[];
    const row = payments.find((p) => p.courtBookingId === pending.id);
    expect(row.serviceType).toBe('COURT');
    expect(row.serviceName).toContain('·');

    const context = await contextFor(browser, m);
    const page = await context.newPage();
    await page.goto('/member/invoices');
    await settled(page);
    const card = page.getByTestId(`pending-payment-${row.id}`);
    await expect(card).toContainText('Đặt sân');
    await expect(card).toContainText(row.serviceName);
    await expect(card).toContainText('Chờ thanh toán');
    await page.screenshot({ path: 'e2e/.results/muc11-invoices.png', fullPage: true });
    await context.close();
  });
});

test.describe('Mục 12 — lễ tân xem lịch sử yêu cầu gói đã xử lý', () => {
  test('yêu cầu nâng cấp đã thu tiền xuất hiện trong lịch sử (API + giao diện lễ tân)', async ({ browser }) => {
    const m = await memberWithPlan(PACKAGES.SILVER_3M, 549000);
    const silverId = ((await apiWith(m.token, 'GET', '/memberships/subscriptions/my')).data as any).id;
    const up = (await apiWith(m.token, 'POST', `/memberships/subscriptions/${silverId}/upgrade`, { packageId: PACKAGES.PLATINUM })).data as any;
    await api('staff', 'POST', '/payments/process', { memberId: m.id, subscriptionId: up.id, amount: Number(up.upgradeCharge), method: 'cash', note: 'e2e' });

    const history = await api<any[]>('staff', 'GET', '/memberships/subscriptions/requests/history?days=7');
    expect(history.status).toBe(200);
    const row = (history.data as any[]).find((r) => r.subscriptionId === up.id);
    expect(row).toMatchObject({ type: 'UPGRADE', outcome: 'APPROVED' });
    expect(row.processedByName).toBeTruthy();
    expect((await api('coach', 'GET', '/memberships/subscriptions/requests/history')).status).toBe(403);
    expect((await apiWith(m.token, 'GET', '/memberships/subscriptions/requests/history')).status).toBe(403);

    const page = await browser.newPage({ storageState: 'e2e/.auth/staff.json' });
    await page.goto('/staff/reception-history');
    await settled(page);
    const section = page.getByTestId('request-history');
    await expect(section).toContainText('Lịch sử xử lý yêu cầu gói tập');
    await expect(section).toContainText('Nâng cấp');
    await page.screenshot({ path: 'e2e/.results/muc12-reception-history.png', fullPage: true });
    await page.close();
  });
});
