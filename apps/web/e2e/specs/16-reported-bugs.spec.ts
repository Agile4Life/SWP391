import { test, expect, settled } from '../fixtures';
import { apiWith } from '../helpers/api';
import { contextFor, memberWithPlan, PACKAGES } from '../helpers/session';

/** Hồi quy cho các lỗi do người dùng báo; mỗi describe ứng với một lỗi. */
test.describe.configure({ mode: 'serial' });

const COACH_MAI = 5; // HLV Yoga (mai@demo)
const isoDay = (offset: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(Date.now() + offset * 86_400_000));

test.describe('Lỗi 1 — nút "Quản lý lịch PT" mở đúng trang lịch PT', () => {
  test('bấm từ hộp thoại lịch của tôi chuyển sang tab Đặt lịch HLV 1:1', async ({ browser }) => {
    const m = await memberWithPlan(PACKAGES.PLATINUM_3M, 1599000);
    let booked = false;
    for (let offset = 2; offset < 8 && !booked; offset++) {
      const res = await apiWith(m.token, 'POST', '/coach-bookings', { coachId: COACH_MAI, bookingDate: isoDay(offset), startTime: '10:00', endTime: '11:00', paymentMethod: 'cash' });
      booked = res.status === 201 || res.status === 200;
    }
    test.skip(!booked, 'không dựng được lịch PT cho hội viên mới');
    const context = await contextFor(browser, m);
    const page = await context.newPage();
    await page.goto('/member/classes');
    await settled(page);
    await expect(page.getByRole('tab', { name: 'Lịch của tôi' })).toHaveAttribute('aria-selected', 'true');
    await page.locator('.mcal__next').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('link', { name: 'Quản lý lịch PT' }).click();
    await expect(page).toHaveURL(/\/member\/classes\?tab=pt/);
    await expect(page.getByRole('tab', { name: /Đặt lịch HLV 1:1/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Lịch của tôi' })).toHaveAttribute('aria-selected', 'false');
    await context.close();
  });
});
