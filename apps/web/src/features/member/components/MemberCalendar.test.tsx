import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemberCalendar } from './MemberCalendar';
import { setLanguage } from '../../../shared/i18n/language';
const mocks = vi.hoisted(() => ({ pt: vi.fn(), classes: vi.fn() }));
vi.mock('../coachBookingApi', () => ({ getMyCoachBookings: mocks.pt }));
vi.mock('../../../shared/api/client', async original => ({ ...await original<typeof import('../../../shared/api/client')>(), apiFetch: mocks.classes }));
vi.mock('../../../shared/lib/centerTime', async original => ({
  ...await original<typeof import('../../../shared/lib/centerTime')>(),
  // Cố định thời điểm hiện tại theo giờ trung tâm.
  centerNowParts: () => ({ date: '2099-01-07', time: '06:00' }),
}));
const booking = { id: 31, coachName: 'Hùng', bookingDate: '2099-01-08', startTime: '07:00:00', endTime: '08:00:00', status: 'confirmed' };
let host: HTMLDivElement; let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); setLanguage('vi');
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open'); } });
  vi.clearAllMocks(); mocks.pt.mockResolvedValue([booking, { ...booking, id: 32, status: 'cancelled' }]);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); setLanguage('vi'); vi.unstubAllGlobals(); });
// Dựng component vào DOM giả để kiểm thử.
const render = () => act(async () => root.render(<MemoryRouter><MemberCalendar /></MemoryRouter>));
// Hàm trợ giúp tìm phần tử (nút/tab) trong DOM giả hoặc bấm vào nó.
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === text)!;
it('shows PT only and never calls group class or court APIs', async () => {
  await render();
  expect(host.querySelectorAll('.mcal__event--pt')).toHaveLength(1);
  expect(host.textContent).toContain('Hùng');
  expect(host.querySelectorAll('.mcal__event--class, .mcal__event--court')).toHaveLength(0);
  expect(mocks.classes).not.toHaveBeenCalled();
  await act(async () => host.querySelector<HTMLButtonElement>('.mcal__event--pt')!.click());
  expect(document.querySelector('a[href="/member/classes?tab=pt"]')).not.toBeNull();
});
it('reports PT request failure and retries instead of displaying an empty schedule', async () => {
  mocks.pt.mockRejectedValueOnce(new Error('offline'));
  await render(); expect(host.querySelector('[role="alert"]')).not.toBeNull();
  await act(async () => button('Thử lại').click());
  expect(mocks.pt).toHaveBeenCalledTimes(2); expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(host.querySelectorAll('.mcal__event--pt')).toHaveLength(1);
});
it('keeps week/month navigation and returns to the current week', async () => {
  await render();
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Tuần sau"]')!.click());
  expect(host.querySelectorAll('.mcal__event--pt')).toHaveLength(0);
  await act(async () => button('Tuần này').click());
  expect(host.querySelectorAll('.mcal__event--pt')).toHaveLength(1);
  await act(async () => button('Tháng').click());
  expect(host.querySelectorAll('.mcal__chip--pt')).toHaveLength(1);
});
it('shows an empty PT calendar without requesting other services', async () => {
  mocks.pt.mockResolvedValue([]); await render();
  expect(host.textContent).toContain('Tuần này bạn chưa có lịch nào.');
  expect(mocks.classes).not.toHaveBeenCalled();
});
