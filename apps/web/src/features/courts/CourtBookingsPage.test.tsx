import { setLanguage } from '../../shared/i18n/language';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ApiError } from '../../shared/api/client';
import { courtsApi } from './courtsApi';
import { MemberCourtsPage, StaffCourtsPage } from './CourtBookingsPage';

vi.mock('./courtsApi', async original => ({ ...(await original<typeof import('./courtsApi')>()), courtsApi: {
  courts: vi.fn(), availability: vi.fn(), quota: vi.fn(), my: vi.fn(), list: vi.fn(), book: vi.fn(), cancel: vi.fn(),
} }));
vi.mock('../manager/catalogApi', () => ({ catalogApi: { rooms: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../shared/lib/portalNotices', () => ({ notify: vi.fn() }));
const court = { id: 5, name: 'Sân A', location: 'Tầng 1', disciplineId: 2, disciplineName: 'Tennis', openTime: '06:00', closeTime: '22:00' };
const empty = { content: [], totalPages: 0, totalElements: 0, number: 0 };
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  vi.mocked(courtsApi.courts).mockResolvedValue([court]);
  vi.mocked(courtsApi.availability).mockResolvedValue([{ startTime: '09:00', endTime: '10:00', status: 'free', price: 100000 }, { startTime: '10:00', endTime: '11:00', status: 'class', price: 100000 }]);
  vi.mocked(courtsApi.quota).mockResolvedValue({ packageName: 'SILVER', monthlyQuota: 1, used: 0, remaining: 1, advanceDays: 7, maxUpcoming: 2, upcoming: 0, maxUnpaid: 1, unpaid: 0, releaseLeadMinutes: 120 });
  vi.mocked(courtsApi.my).mockResolvedValue(empty);
  vi.mocked(courtsApi.list).mockResolvedValue(empty);
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); setLanguage('vi'); vi.unstubAllGlobals(); });
const render = (staff = false) => act(async () => root.render(<MemoryRouter initialEntries={['/member/courts?discipline=Tennis']}>{staff ? <StaffCourtsPage /> : <MemberCourtsPage />}</MemoryRouter>));
const click = async (text: string) => act(async () => { const button = [...host.querySelectorAll('button')].find(item => item.textContent?.includes(text)); expect(button).toBeTruthy(); button!.click(); });

it('shows loading then an empty court state without invented courts', async () => {
  let resolve!: (value: []) => void;
  vi.mocked(courtsApi.courts).mockReturnValue(new Promise(r => { resolve = r; }));
  await render();
  expect(host.textContent).toContain('Đang tải sân');
  await act(async () => resolve([]));
  expect(host.textContent).toContain('Chưa có sân cho bộ môn này');
});

it('retries a failed grid request and disables class slots', async () => {
  vi.mocked(courtsApi.courts).mockRejectedValueOnce(new Error('Mất kết nối'));
  await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Mất kết nối');
  await click('Thử lại');
  expect(host.textContent).toContain('Sân A');
  expect([...host.querySelectorAll('button')].find(item => item.textContent?.includes('Đang có lớp'))?.disabled).toBe(true);
});

it('refreshes availability after 409 and retains the translated conflict in the dialog', async () => {
  vi.mocked(courtsApi.book).mockRejectedValueOnce(new ApiError('SQL must not display', 409, 'COURT_BOOKING_SLOT_TAKEN'));
  await render();
  await click('Trống'); await click('Xác nhận đặt');
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain('Khung giờ vừa được đặt');
  expect(host.textContent).not.toContain('SQL must not display');
  expect(courtsApi.availability).toHaveBeenCalledTimes(2);
});

it('offers the packages page only when the API says the membership is the problem', async () => {
  vi.mocked(courtsApi.book)
    .mockRejectedValueOnce(new ApiError('Bạn chưa có gói tập', 403, 'COURT_BOOKING_MEMBERSHIP_INVALID'))
    .mockRejectedValueOnce(new ApiError('Hết khung này, hãy chọn gói tập khác', 409, 'COURT_BOOKING_SLOT_TAKEN'));
  await render();
  await click('Trống'); await click('Xác nhận đặt');
  const dialog = () => host.querySelector('[role="dialog"]')!;
  expect(dialog().querySelector('a[href="/member/packages"]')).not.toBeNull();
  // Reopening and failing for another reason must not keep the stale package link.
  await click('Quay lại'); await click('Trống'); await click('Xác nhận đặt');
  expect(dialog().querySelector('a[href="/member/packages"]')).toBeNull();
});

it('shows staff daily empty state and queries the paginated daily endpoint', async () => {
  await render(true);
  expect(courtsApi.list).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), '', 0);
  expect(host.textContent).toContain('Chưa có lượt đặt trong ngày này');
});

it('only allows single session court booking and does not offer weekly or monthly recurring booking', async () => {
  await render();
  await click('Trống');
  expect(host.querySelector('[role="status"]')).toBeNull();
  expect(host.textContent).not.toContain('Cả tuần');
  expect(host.textContent).not.toContain('Hàng tuần');
  expect(host.textContent).not.toContain('Cả tháng');
  expect(host.textContent).not.toContain('Hàng tháng');
  expect(host.querySelector('[aria-label="Thứ trong tuần"]')).toBeNull();
  await click('Xác nhận đặt');
  expect(courtsApi.book).toHaveBeenCalledWith(expect.objectContaining({ roomId: 5, startTime: '09:00' }));
});

it('books free while the plan has included bookings left', async () => {
  vi.mocked(courtsApi.book).mockResolvedValue({} as never);
  await render();
  await click('Trống');
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain('lượt đặt sân miễn phí');
  await click('Xác nhận đặt');
  expect(courtsApi.book).toHaveBeenCalledWith({ roomId: 5, date: expect.any(String), startTime: '09:00' });
});

it('charges the slot price and sends the payment method once the plan quota is used up', async () => {
  vi.mocked(courtsApi.quota).mockResolvedValue({ packageName: 'SILVER', monthlyQuota: 1, used: 1, remaining: 0, advanceDays: 7, maxUpcoming: 2, upcoming: 0, maxUnpaid: 1, unpaid: 0, releaseLeadMinutes: 120 });
  vi.mocked(courtsApi.book).mockResolvedValue({} as never);
  await render();
  await click('Trống');
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain('Còn 0 lượt đặt sân miễn phí');
  await click('Đặt sân & Thanh toán sau qua VNPay');
  expect(courtsApi.book).toHaveBeenCalledWith({ roomId: 5, date: expect.any(String), startTime: '09:00', paymentMethod: 'vnpay' });
});

it('switches court booking labels and status copy while preserving server court names', async () => {
  await render();
  await act(async () => setLanguage('en'));
  expect(host.textContent).toContain('Book a court');
  expect(host.textContent).toContain('Available');
  expect(host.textContent).toContain('Sân A');
  expect(host.textContent).toContain('You have no court bookings');
  await act(async () => setLanguage('vi'));
  expect(host.textContent).toContain('Đặt sân');
});

it('renders distinct payment status labels for pending, paid, refunded, and cancelled unpaid court bookings', async () => {
  const base = { roomId: 5, roomName: 'Sân A', disciplineName: 'Tennis', memberId: 1, memberName: 'M', date: '2099-01-05', startTime: '09:00', endTime: '10:00', createdAt: '', cancelledAt: null, cancelReason: null, canCancel: false, price: 80000, paymentMethod: 'vnpay' };
  vi.mocked(courtsApi.my).mockResolvedValue({
    content: [
      { ...base, id: 1, status: 'booked', paymentStatus: 'pending' },
      { ...base, id: 2, status: 'cancelled', paymentStatus: 'pending' },
      { ...base, id: 3, status: 'cancelled', paymentStatus: 'refunded' },
      { ...base, id: 4, status: 'booked', paymentStatus: 'paid' },
    ],
    totalPages: 1, totalElements: 4, number: 0,
  });
  await render();
  const rows = [...host.querySelectorAll('.court-booking-row')].map(row => row.textContent ?? '');
  expect(rows[0]).toContain('Chờ thanh toán');
  expect(rows[0]).not.toContain('Đã thanh toán');
  expect(rows[1]).toContain('Chưa thanh toán');
  expect(rows[1]).not.toContain('Đã thanh toán');
  expect(rows[2]).toContain('Đã hoàn tiền');
  expect(rows[2]).not.toContain('Đã thanh toán');
  expect(rows[3]).toContain('Đã thanh toán');
});

it('shows the plan tier rules from the API and limits the date picker to the advance window', async () => {
  vi.mocked(courtsApi.quota).mockResolvedValue({ packageName: 'GOLD', monthlyQuota: 2, used: 1, remaining: 1, advanceDays: 14, maxUpcoming: 4, upcoming: 3, maxUnpaid: 2, unpaid: 1, releaseLeadMinutes: 120 });
  await render();
  expect(host.querySelector('.court-policy')).toBeNull();
  await click('Quy định đặt sân');
  const card = host.querySelector('.court-policy');
  expect(card?.textContent).toContain('Quy định đặt sân của gói GOLD');
  expect(card?.textContent).toContain('Đặt trước tối đa 14 ngày');
  expect(card?.textContent).toContain('Tối đa 4 lượt chưa diễn ra cùng lúc (hiện có 3)');
  expect(card?.textContent).toContain('Tối đa 2 lượt chưa thanh toán cùng lúc (hiện giữ 1)');
  expect(card?.textContent).toContain('2 giờ trước giờ bắt đầu');
});
