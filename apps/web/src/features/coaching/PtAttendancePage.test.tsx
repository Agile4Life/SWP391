import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '../../shared/api/client';
import { PtAttendancePage } from './PtAttendancePage';

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('./ptAttendanceApi', () => ({ getPtAttendance: mocks.load }));

const base = {
  memberId: 10, memberName: 'Khoa Hội Viên', coachId: 20, coachName: 'HLV Hùng', coachSpecialization: 'Gym',
  coachAvatarUrl: null, disciplineId: null, disciplineName: null, hourlyRate: 0, paymentMethod: 'package_quota',
  paymentStatus: 'used_quota', status: 'confirmed', notes: null, createdAt: '2026-11-01T08:00:00', cancelledAt: null, cancelReason: null,
};
const attended = { ...base, id: 1, bookingDate: '2020-01-02', startTime: '09:00:00', endTime: '10:00:00', attendedAt: '2020-01-02T08:50:00' };
const missed = { ...base, id: 2, bookingDate: '2020-01-02', startTime: '15:00:00', endTime: '16:00:00', attendedAt: null };
const upcoming = { ...base, id: 3, bookingDate: '2099-01-02', startTime: '15:00:00', endTime: '16:00:00', attendedAt: null };

describe('PtAttendancePage', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div'); document.body.append(host);
    root = createRoot(host);
    mocks.load.mockReset();
    vi.spyOn(clientModule, 'getCurrentUser').mockReturnValue({ id: '2', name: 'Lễ tân', identifier: 'desk', role: 'STAFF' });
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  async function render() { await act(async () => root.render(<PtAttendancePage />)); }
  const tab = (label: string) => [...host.querySelectorAll<HTMLButtonElement>('button[role="tab"]')].find((button) => button.textContent?.startsWith(label))!;

  it('splits sessions into attended, missed and upcoming with counts, and shows the coach to the desk', async () => {
    mocks.load.mockResolvedValue([upcoming, missed, attended]);
    await render();
    expect(mocks.load).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), 'ALL');
    expect(tab('Tất cả').textContent).toContain('(3)');
    expect(tab('Đã có mặt').textContent).toContain('(1)');
    expect(tab('Không có mặt').textContent).toContain('(1)');
    expect(host.querySelector('[data-testid="pt-row-1"]')?.textContent).toContain('HLV Hùng');
    await act(async () => tab('Không có mặt').click());
    expect(host.querySelector('[data-testid="pt-row-2"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="pt-row-1"]')).toBeNull();
    expect(host.querySelector('[data-testid="pt-row-3"]')).toBeNull();
  });

  it('hides the coach column for a coach and shows empty and error states', async () => {
    vi.spyOn(clientModule, 'getCurrentUser').mockReturnValue({ id: '20', name: 'HLV', identifier: 'hung', role: 'COACH' });
    mocks.load.mockResolvedValueOnce([attended]);
    await render();
    expect(host.querySelector('[data-testid="pt-row-1"]')?.textContent).not.toContain('HLV Hùng');
    mocks.load.mockResolvedValueOnce([]);
    await act(async () => { const input = host.querySelector<HTMLInputElement>('#pt-from')!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '2020-01-01'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(host.textContent).toContain('Không có buổi PT nào');
    mocks.load.mockRejectedValueOnce(new Error('Không có quyền'));
    await act(async () => { const input = host.querySelector<HTMLInputElement>('#pt-to')!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '2020-02-01'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Không có quyền');
  });
});
