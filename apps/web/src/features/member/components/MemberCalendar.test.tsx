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

const booking = { id: 31, coachName: 'Hùng', bookingDate: '2099-01-08', startTime: '07:00:00', endTime: '08:00:00', status: 'confirmed' };
const enrollment = { id: 90, classId: 5, className: 'Yoga Sáng', memberId: 1, sessionId: null, sessionDate: null, startTime: null, endTime: null, status: 'booked', enrolledAt: '2099-01-01', cancelledAt: null, cancelReason: null };
const classSession = {
  id: 501,
  classId: 5,
  className: 'Yoga Sáng',
  disciplineId: 1,
  disciplineName: 'Yoga',
  coachId: 10,
  coachName: 'Lan',
  roomId: 2,
  roomName: 'Studio A',
  sessionDate: '2099-01-08',
  startTime: '18:00:00',
  endTime: '19:00:00',
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

it('displays both enrolled group classes and 1:1 PT sessions', async () => {
  await render();
  expect(host.querySelectorAll('.mcal__event--pt')).toHaveLength(1);
  expect(host.querySelectorAll('.mcal__event--class')).toHaveLength(1);
  expect(host.textContent).toContain('Hùng');
  expect(host.textContent).toContain('Yoga Sáng');

  await act(async () => host.querySelector<HTMLButtonElement>('.mcal__event--class')!.click());
  expect(host.querySelector('a[href="/member/classes?tab=classes"]')).not.toBeNull();
  const closeBtn = host.querySelector<HTMLButtonElement>('dialog button[aria-label]')!;
  await act(async () => closeBtn.click());

  await act(async () => host.querySelector<HTMLButtonElement>('.mcal__event--pt')!.click());
  expect(host.querySelector('a[href="/member/classes?tab=pt"]')).not.toBeNull();
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

it('keeps week/month navigation and returns to the current week', async () => {
  await render();
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Tuần sau"]')!.click());
  expect(host.querySelectorAll('.mcal__event--pt')).toHaveLength(0);
  await act(async () => button('Tuần này').click());
  expect(host.querySelectorAll('.mcal__event--pt')).toHaveLength(1);
  await act(async () => button('Tháng').click());
  expect(host.querySelectorAll('.mcal__chip--pt')).toHaveLength(1);
  expect(host.querySelectorAll('.mcal__chip--class')).toHaveLength(1);
});

it('shows empty state when neither PT nor enrolled classes exist', async () => {
  mocks.pt.mockResolvedValue([]);
  mocks.enrollments.mockResolvedValue([]);
  mocks.sessionsBetween.mockResolvedValue([]);
  await render();
  expect(host.textContent).toContain('Tuần này bạn chưa có lịch nào.');
});
