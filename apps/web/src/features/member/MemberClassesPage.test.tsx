import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberClassesPage } from './MemberClassesPage';

const mocks = vi.hoisted(() => ({
  sessions: vi.fn(),
  waitlists: vi.fn(),
  enrollments: vi.fn(),
  enroll: vi.fn(),
  cancelEnrollment: vi.fn(),
  joinWaitlist: vi.fn(),
  leaveWaitlist: vi.fn(),
}));

vi.mock('./memberClassesApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('./memberClassesApi')>();
  return {
    ...original,
    getSessions: mocks.sessions,
    getMyWaitlists: mocks.waitlists,
    getMyEnrollments: mocks.enrollments,
    enroll: mocks.enroll,
    cancelEnrollment: mocks.cancelEnrollment,
    joinWaitlist: mocks.joinWaitlist,
    leaveWaitlist: mocks.leaveWaitlist,
  };
});

const session = {
  id: 8, classId: 3, className: 'Yoga Flow', disciplineId: 2, disciplineName: 'Yoga',
  coachId: 4, coachName: 'An', roomId: 5, roomName: 'Studio', sessionDate: '2099-10-19',
  startTime: '08:00:00', endTime: '09:00:00', status: 'scheduled', cancelReason: null,
  capacity: 12, bookedCount: 12,
};

describe('MemberClassesPage', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div'); document.body.append(host);
    root = createRoot(host);
    mocks.sessions.mockReset();
    mocks.waitlists.mockReset();
    mocks.enrollments.mockReset();
    mocks.enroll.mockReset();
    mocks.cancelEnrollment.mockReset();
    mocks.joinWaitlist.mockReset();
    mocks.leaveWaitlist.mockReset();
    mocks.waitlists.mockResolvedValue([]);
    mocks.enrollments.mockResolvedValue([]);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
  async function render() { await act(async () => root.render(<MemoryRouter><MemberClassesPage /></MemoryRouter>)); }

  it('shows loading, then real sessions and waitlist action when class is full', async () => {
    let resolve!: (value: typeof session[]) => void;
    mocks.sessions.mockReturnValue(new Promise((done) => { resolve = done; }));
    await render();
    expect(host.textContent).toContain('Đang tải lịch học');
    await act(async () => resolve([session]));
    expect(host.textContent).toContain('Yoga Flow');
    expect(host.textContent).toContain('12 / 12');
    const button = [...host.querySelectorAll('button')].find((item) => item.textContent?.includes('Tham gia hàng chờ'));
    expect(button?.disabled).toBe(false);
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/member/packages');
  });

  it('shows empty schedule', async () => {
    mocks.sessions.mockResolvedValueOnce([]);
    await render();
    expect(host.textContent).toContain('Chưa có lịch học');
  });

  it('filters disciplines and weekdays without changing backend data', async () => {
    mocks.sessions.mockResolvedValue([session, { ...session, id: 9, className: 'Boxing Basics', disciplineName: 'Boxing', sessionDate: '2099-10-20' }]);
    await render();
    const yoga = [...host.querySelectorAll('button')].find((item) => item.textContent === 'Yoga')!;
    await act(async () => yoga.click());
    expect(host.textContent).toContain('Yoga Flow');
    expect(host.textContent).not.toContain('Boxing Basics');
    const select = host.querySelector('select')!;
    await act(async () => { select.value = '2'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(host.textContent).toContain('Không có buổi học phù hợp');
  });

  it('shows an error and retries the backend request', async () => {
    mocks.sessions.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([session]);
    await render();
    expect(host.textContent).toContain('Không tải được lịch học');
    const retry = [...host.querySelectorAll('button')].find((item) => item.textContent === 'Thử lại')!;
    await act(async () => retry.click());
    expect(host.textContent).toContain('Yoga Flow');
    expect(mocks.sessions).toHaveBeenCalledTimes(2);
  });

  it('keeps the schedule when waitlists fail and retries only waitlists', async () => {
    mocks.sessions.mockResolvedValue([session]);
    mocks.waitlists.mockRejectedValueOnce(new Error('waitlist offline')).mockResolvedValueOnce([]);
    await render();
    expect(host.textContent).toContain('Yoga Flow');
    expect(host.textContent).not.toContain('Không tải được lịch học');
    const tab = [...host.querySelectorAll('button')].find((item) => item.textContent?.includes('Lịch học của tôi'))!;
    await act(async () => tab.click());
    expect(host.textContent).toContain('Không tải được hàng chờ');
    const retry = [...host.querySelectorAll('button')].find((item) => item.textContent === 'Thử lại hàng chờ')!;
    await act(async () => retry.click());
    expect(host.textContent).not.toContain('Không tải được hàng chờ');
    expect(mocks.sessions).toHaveBeenCalledTimes(1);
    expect(mocks.waitlists).toHaveBeenCalledTimes(2);
  });

  it('disables booking for cancelled sessions and shows empty my-schedule when nothing booked', async () => {
    mocks.sessions.mockResolvedValue([{ ...session, status: 'cancelled' }]);
    await render();
    expect(host.textContent).toContain('Không thể đặt');
    const tab = [...host.querySelectorAll('button')].find((item) => item.textContent?.includes('Lịch học của tôi'))!;
    await act(async () => tab.click());
    expect(host.textContent).toContain('Chưa có lịch học đã đặt');
    expect(host.textContent).not.toContain('Hủy đặt chỗ');
  });

  it('marks a past session unavailable even when capacity remains', async () => {
    mocks.sessions.mockResolvedValue([{ ...session, sessionDate: '2020-10-19', bookedCount: 2 }]);
    await render();
    expect(host.textContent).toContain('Không thể đặt');
  });

  it('marks a session that has started today unavailable', async () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    mocks.sessions.mockResolvedValue([{ ...session, sessionDate: today, startTime: '00:00:00', endTime: '23:59:59', bookedCount: 2 }]);
    await render();
    expect(host.textContent).toContain('Không thể đặt');
  });
});
