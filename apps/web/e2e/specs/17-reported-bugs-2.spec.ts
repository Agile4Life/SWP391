import { test, expect, settled } from '../fixtures';
import { api, apiWith } from '../helpers/api';
import { contextFor, memberWithPlan, PACKAGES } from '../helpers/session';

/**
 * Đợt lỗi do tester báo ngày 12/11/2026 (class booking, membership, PT, đặt sân, giao dịch, lễ tân).
 * Mỗi describe dựng dữ liệu giả cho đúng tình huống rồi kiểm tra hành vi; số trong tên khớp số mục trong báo cáo.
 */
test.describe.configure({ mode: 'serial' });

const COACH_MAI = 5; // HLV Yoga (mai@demo)
// Ngày YYYY-MM-DD theo giờ Việt Nam, lệch offset ngày so với hôm nay.
const isoDay = (offset: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(Date.now() + offset * 86_400_000));

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
