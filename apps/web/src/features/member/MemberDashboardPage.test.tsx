import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberDashboardPage } from './MemberDashboardPage';

const api = vi.hoisted(() => ({
  membership: vi.fn(),
  bookings: vi.fn(),
}));

vi.mock('./memberDashboardApi', () => ({
  getCurrentMembership: api.membership,
  getBookedEnrollments: api.bookings,
}));

const membership = {
  id: 1, memberId: 1, packageId: 2, packageName: 'Essential',
  previousSubscriptionId: null, startDate: '2026-01-01',
  endDate: '2099-12-31', status: 'active', qrCode: null,
  createdAt: '2026-01-01T00:00:00',
};

describe('SCRUM-85 dashboard', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    api.membership.mockReset();
    api.bookings.mockReset();
    api.membership.mockResolvedValue(membership);
    api.bookings.mockResolvedValue([]);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  async function renderDashboard() {
    await act(async () => {
      root.render(<MemoryRouter><MemberDashboardPage /></MemoryRouter>);
    });
  }

  it('shows an empty class list independently of membership', async () => {
    await renderDashboard();
    expect(host.textContent).toContain('Essential');
    expect(host.textContent).toContain('Bạn chưa có lớp học đang đặt.');
  });

  it('keeps membership when enrollment fails and retries only enrollment', async () => {
    api.bookings.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
    await renderDashboard();
    expect(host.textContent).toContain('Essential');
    expect(host.textContent).toContain('Chưa thể tải lịch học lúc này.');

    const retry = [...host.querySelectorAll('button')].find((button) => button.textContent === 'Thử lại');
    await act(async () => retry?.click());
    expect(api.bookings).toHaveBeenCalledTimes(2);
    expect(api.membership).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Bạn chưa có lớp học đang đặt.');
  });

  it('keeps enrollment result when membership fails', async () => {
    api.membership.mockRejectedValue(new Error('offline'));
    api.bookings.mockResolvedValue([{
      id: 9, classId: 2, className: 'Yoga', coachName: 'An', roomName: 'A',
      sessionDate: '2026-10-17', startTime: '08:00:00', endTime: '09:00:00',
      status: 'booked', createdAt: '2026-10-16T10:00:00',
      cancelledAt: null, cancelReason: null,
    }]);
    await renderDashboard();
    expect(host.textContent).toContain('Không thể tải thông tin gói tập');
    expect(host.textContent).toContain('Yoga');
    expect(host.textContent).toContain('Chưa thể hiển thị lịch 7 ngày chính xác');
    expect(host.textContent).not.toContain('2026-10-17');
  });
});
