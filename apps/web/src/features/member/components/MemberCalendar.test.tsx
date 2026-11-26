import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemberCalendar } from './MemberCalendar';
import { setLanguage } from '../../../shared/i18n/language';

const mocks = vi.hoisted(() => ({
  pt: vi.fn(),
  enrollments: vi.fn(),
  sessionsBetween: vi.fn(),
}));

vi.mock('../coachBookingApi', () => ({ getMyCoachBookings: mocks.pt }));
vi.mock('../memberClassesApi', () => ({
  getMyEnrollments: mocks.enrollments,
  getSessionsBetween: mocks.sessionsBetween,
}));
vi.mock('../../../shared/lib/centerTime', async (original) => ({
  ...await original<typeof import('../../../shared/lib/centerTime')>(),
  centerNowParts: () => ({ date: '2099-01-07', time: '06:00' }),
}));

const booking = { id: 31, coachName: 'Hùng', bookingDate: '2099-01-08', startTime: '07:00:00', endTime: '09:30:00', status: 'confirmed' };
const enrollment = { id: 90, classId: 5, className: 'Yoga Sáng', memberId: 1, sessionId: null, sessionDate: null, startTime: null, endTime: null, status: 'booked', enrolledAt: '2099-01-01', cancelledAt: null, cancelReason: null };
const classSession = {
  id: 501,
  classId: 5,
  className: 'Yoga Sáng',
  disciplineId: 1,
  disciplineName: 'Yoga',
  coachId: 10,
  coachName: 'HLV Lan',
  roomId: 2,
  roomName: 'Zen Garden Studio',
  sessionDate: '2099-01-08',
  startTime: '17:00:00',
  endTime: '19:30:00',
  status: 'scheduled',
  cancelReason: null,
  capacity: 20,
  bookedCount: 10,
};

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  setLanguage('vi');
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open'); } });
  vi.clearAllMocks();
  mocks.pt.mockResolvedValue([booking, { ...booking, id: 32, status: 'cancelled' }]);
  mocks.enrollments.mockResolvedValue([enrollment]);
  mocks.sessionsBetween.mockResolvedValue([classSession]);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  setLanguage('vi');
  vi.unstubAllGlobals();
});

const render = () => act(async () => root.render(<MemoryRouter><MemberCalendar /></MemoryRouter>));
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === text)!;

it('displays 5 fixed slot rows, enrolled group classes with coach name underneath, and 1:1 PT sessions', async () => {
  await render();
  const slotHeads = [...host.querySelectorAll('.mcal__slot-head')];
  expect(slotHeads).toHaveLength(5);
  expect(slotHeads.map((node) => [
    node.querySelector('.mcal__slot-name')?.textContent,
    node.querySelector('.mcal__slot-time')?.textContent,
  ])).toEqual([
    ['Slot 1', '07:00 – 09:30'],
    ['Slot 2', '09:45 – 11:15'],
    ['Slot 3', '11:30 – 14:00'],
    ['Slot 4', '14:15 – 16:45'],
    ['Slot 5', '17:00 – 19:30'],
  ]);

  expect(host.querySelectorAll('.mcal__event--pt')).toHaveLength(1);
  const classCard = host.querySelector<HTMLButtonElement>('.mcal__event--class')!;
  expect(classCard).not.toBeNull();
  expect(classCard.textContent).toContain('Yoga Sáng');
  expect(classCard.querySelector('.mcal__event-coach')?.textContent).toBe('HLV Lan');

  // Next up banner displays canonical Slot label
  expect(host.querySelector('.mcal__next')?.textContent).toContain('Slot 1 · 07:00 – 09:30');

  await act(async () => classCard.click());
  expect(host.querySelector('dialog')?.textContent).toContain('Slot 5 · 17:00 – 19:30');
  expect(host.querySelector('.mcal__dialog-actions button')?.textContent).toBe('Đóng');
  const closeBtn = host.querySelector<HTMLButtonElement>('dialog button[aria-label]')!;
  await act(async () => closeBtn.click());

  await act(async () => host.querySelector<HTMLButtonElement>('.mcal__event--pt')!.click());
  expect(host.querySelector('dialog')?.textContent).toContain('Slot 1 · 07:00 – 09:30');
  expect(host.querySelector('dialog')?.textContent).toContain('Chưa điểm danh');
  expect(host.querySelector('.mcal__dialog-actions button')?.textContent).toBe('Đóng');
});

it('reports PT request failure and retries cleanly', async () => {
  mocks.pt.mockRejectedValueOnce(new Error('offline'));
  await render();
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  await act(async () => button('Thử lại').click());
  expect(mocks.pt).toHaveBeenCalledTimes(2);
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(host.querySelectorAll('.mcal__event--pt')).toHaveLength(1);
});

it('keeps week/month navigation, renders slot chips in month view, and returns to the current week', async () => {
  await render();
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Tuần sau"]')!.click());
  expect(host.querySelectorAll('.mcal__event--pt')).toHaveLength(0);
  await act(async () => button('Tuần này').click());
  expect(host.querySelectorAll('.mcal__event--pt')).toHaveLength(1);
  await act(async () => button('Tháng').click());
  expect(host.querySelectorAll('.mcal__chip--pt')).toHaveLength(1);
  expect(host.querySelectorAll('.mcal__chip--class')).toHaveLength(1);
  expect(host.querySelector('.mcal__chip--pt')?.textContent).toContain('Slot 1');
  expect(host.querySelector('.mcal__chip--class')?.textContent).toContain('Slot 5');
});

it('shows empty state when neither PT nor enrolled classes exist', async () => {
  mocks.pt.mockResolvedValue([]);
  mocks.enrollments.mockResolvedValue([]);
  mocks.sessionsBetween.mockResolvedValue([]);
  await render();
  expect(host.textContent).toContain('Tuần này bạn chưa có lịch nào.');
});

it('surfaces group class load failure with Retry and translates alerts in EN mode (P1-FE-33)', async () => {
  setLanguage('en');
  mocks.enrollments.mockRejectedValueOnce(new TypeError('network down'));
  await render();
  const alert = host.querySelector('[role="alert"]');
  expect(alert).not.toBeNull();
  expect(alert?.textContent).toContain('Unable to load your group class schedule.');
  await act(async () => button('Retry').click());
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(host.querySelectorAll('.mcal__event--class')).toHaveLength(1);
});

it('updates PT event titles when toggling VI/EN and strips duplicate HLV prefix in EN (P2-FE-54)', async () => {
  mocks.pt.mockResolvedValue([{ ...booking, coachName: 'HLV Hùng' }]);
  await render();
  expect(host.querySelector('.mcal__event--pt')?.textContent).toContain('Tập 1:1 cùng HLV Hùng');
  expect(host.querySelector('.mcal__event--pt')?.textContent).not.toContain('HLV HLV');

  await act(async () => { setLanguage('en'); });
  expect(host.querySelector('.mcal__event--pt')?.textContent).toContain('1:1 session with Hùng');
  expect(host.querySelector('.mcal__event--pt')?.textContent).not.toContain('HLV');
});

it('keeps Next Up banner stable across week navigation and includes next-week group class from rolling lookahead (P1-FE-35)', async () => {
  const nextWeekClass = { ...classSession, id: 502, sessionDate: '2099-01-12', startTime: '07:00:00', endTime: '09:30:00', className: 'Boxing Thứ Hai' };
  mocks.pt.mockResolvedValue([]);
  mocks.sessionsBetween.mockImplementation(async (from: string, to: string) => {
    // Current week is 2099-01-05..2099-01-11; rolling lookahead is 2099-01-07..2099-02-06
    if (to >= '2099-01-12' && from <= '2099-01-12') return [nextWeekClass];
    return [];
  });
  await render();

  // Even though current week (2099-01-05..2099-01-11) has no sessions, Next Up shows Monday's class
  expect(host.querySelector('.mcal__next')?.textContent).toContain('Boxing Thứ Hai');
  expect(host.querySelector('.mcal__next')?.textContent).toContain('Slot 1 · 07:00 – 09:30');

  // Navigating to a past week does not drop or alter the Next Up banner
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Tuần trước"]')!.click());
  expect(host.querySelector('.mcal__next')?.textContent).toContain('Boxing Thứ Hai');
});
