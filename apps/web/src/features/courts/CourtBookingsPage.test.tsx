import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StaffCourtsPage } from './CourtBookingsPage';
import { courtsApi } from './courtsApi';
vi.mock('./courtsApi', async original => ({ ...await original<typeof import('./courtsApi')>(), courtsApi: { list: vi.fn(), confirmPayment: vi.fn(), cancel: vi.fn(), my: vi.fn() } }));
vi.mock('../manager/catalogApi', () => ({ catalogApi: { rooms: vi.fn().mockResolvedValue([]) } }));
const empty = { content: [], totalPages: 0, totalElements: 0, number: 0 };
let host: HTMLDivElement; let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.clearAllMocks();
  vi.mocked(courtsApi.list).mockResolvedValue(empty);
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const render = () => act(async () => root.render(<MemoryRouter><StaffCourtsPage /></MemoryRouter>));
const click = (text: string) => act(async () => [...host.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.includes(text))!.click());
it('keeps staff daily bookings without calling the member endpoint', async () => {
  await render();
  expect(courtsApi.list).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), '', 0);
  expect(courtsApi.my).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Chưa có lượt đặt trong ngày này');
});
it('keeps staff request errors and retry', async () => {
  vi.mocked(courtsApi.list).mockRejectedValueOnce(new Error('Mất kết nối'));
  await render(); expect(host.querySelector('[role="alert"]')).not.toBeNull();
  await click('Thử lại'); expect(courtsApi.list).toHaveBeenCalledTimes(2);
  expect(host.textContent).toContain('Chưa có lượt đặt trong ngày này');
});
it('keeps staff payment confirmation and cancellation', async () => {
  const booking = { id: 7, roomName: 'Sân A', memberName: 'An', date: '2099-01-05', startTime: '09:00', endTime: '10:00', status: 'booked', canCancel: true, paymentMethod: 'cash', paymentStatus: 'pending', price: 100000 };
  vi.mocked(courtsApi.list).mockResolvedValue({ ...empty, content: [booking], totalElements: 1, totalPages: 1 } as never);
  await render(); await click('Xác nhận đã thu tiền');
  expect(courtsApi.confirmPayment).toHaveBeenCalledWith(7);
  await click('Hủy lượt đặt'); await click('Xác nhận hủy');
  expect(courtsApi.cancel).toHaveBeenCalledWith(7, '');
});
