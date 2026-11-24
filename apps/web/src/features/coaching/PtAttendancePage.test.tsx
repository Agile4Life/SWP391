import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '../../shared/api/client';
import { PtAttendancePage } from './PtAttendancePage';
import { centerNowParts } from '../../shared/lib/centerTime';

const mocks = vi.hoisted(() => ({ load: vi.fn(), mark: vi.fn(), unmark: vi.fn() }));
vi.mock('./ptAttendanceApi', () => ({ getPtAttendance: mocks.load, markPtAttended: mocks.mark, unmarkPtAttended: mocks.unmark }));

// Ngày YYYY-MM-DD lệch days ngày so với hôm nay.
function isoOffset(days: number): string {
  const [year, month, day] = centerNowParts().date.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

// Hàm trợ giúp nhập liệu hoặc thao tác trên biểu mẫu trong DOM giả.
async function pickDate(host: HTMLElement, id: string, iso: string) {
  await act(async () => host.querySelector<HTMLButtonElement>(`button#${id}`)!.click());
  // Hàm trợ giúp tìm phần tử (nút/tab) trong DOM giả hoặc bấm vào nó.
  const dayButton = () => document.querySelector<HTMLButtonElement>(`button[aria-label="${iso}"]`);
  for (let i = 0; i < 2 && !dayButton(); i++) {
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Tháng sau"]')?.click());
  }
  for (let i = 0; i < 4 && !dayButton(); i++) {
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Tháng trước"]')?.click());
  }
  await act(async () => dayButton()!.click());
}

// Dữ liệu mẫu dùng trong các ca kiểm thử.
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
    mocks.mark.mockReset();
    mocks.unmark.mockReset();
    vi.spyOn(clientModule, 'getCurrentUser').mockReturnValue({ id: '2', name: 'Lễ tân', identifier: 'desk', role: 'STAFF' });
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  // Dựng component vào DOM giả để kiểm thử.
  async function render() { await act(async () => root.render(<PtAttendancePage />)); }
  // Hàm trợ giúp tìm phần tử (nút/tab) trong DOM giả hoặc bấm vào nó.
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
    await pickDate(host, 'pt-from', isoOffset(-5));
    expect(host.textContent).toContain('Không có buổi PT nào');
    mocks.load.mockRejectedValueOnce(new Error('Không có quyền'));
    await pickDate(host, 'pt-to', isoOffset(-1));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Không có quyền');
  });

  it('lets staff mark a started, unrecorded session as attended and reloads the list', async () => {
    mocks.load.mockResolvedValue([upcoming, missed, attended]);
    mocks.mark.mockResolvedValue({});
    await render();
    // Các nút ghi nhận có mặt của một buổi.
    const markButtons = (id: number) => [...(host.querySelector(`[data-testid="pt-row-${id}"]`)?.querySelectorAll('button') ?? [])]
      .filter((button) => button.textContent === 'Đánh dấu có mặt');
    // Only the finished, unrecorded session offers the action: not the attended one, not the future one.
    expect(markButtons(1)).toHaveLength(0);
    expect(markButtons(3)).toHaveLength(0);
    expect(markButtons(2)).toHaveLength(1);
    await act(async () => markButtons(2)[0].click());
    expect(mocks.mark).toHaveBeenCalledWith(2);
    expect(mocks.load).toHaveBeenCalledTimes(2);
  });

  it('lets staff remove the mark of an attended session and reloads the list', async () => {
    mocks.load.mockResolvedValue([attended]);
    mocks.unmark.mockResolvedValue({});
    await render();
    const remove = [...host.querySelectorAll<HTMLButtonElement>('[data-testid="pt-row-1"] button')].find((button) => button.textContent === 'Bỏ đánh dấu có mặt')!;
    await act(async () => remove.click());
    expect(mocks.unmark).toHaveBeenCalledWith(1);
    expect(mocks.load).toHaveBeenCalledTimes(2);
  });

  it('tags a member who checked in at the gate and asks before removing their attended mark', async () => {
    mocks.load.mockResolvedValue([{ ...attended, gateCheckinAt: '2020-01-02T08:40:00' }]);
    mocks.unmark.mockResolvedValue({});
    await render();
    expect(host.querySelector('[data-testid="pt-row-1"] .pt-gate-tag')?.textContent).toContain('Đã check-in');
    // Hàm trợ giúp tìm phần tử (nút/tab) trong DOM giả hoặc bấm vào nó.
    const button = (label: string) => [...document.body.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === label)!;

    await act(async () => button('Bỏ đánh dấu có mặt').click());
    expect(document.body.textContent).toContain('Khoa Hội Viên đã quét QR vào trung tâm');
    await act(async () => button('Xem lại').click());
    expect(mocks.unmark).not.toHaveBeenCalled();

    await act(async () => button('Bỏ đánh dấu có mặt').click());
    await act(async () => button('Vẫn bỏ ghi nhận').click());
    expect(mocks.unmark).toHaveBeenCalledWith(1);
  });

  it('reloads actual unmarked data, updates counts and retains it after remount', async () => {
    mocks.load.mockResolvedValueOnce([attended]).mockResolvedValue([{ ...attended, attendedAt: null, attendanceLocked: true }]);
    mocks.unmark.mockResolvedValue({ ...attended, attendedAt: null });
    await render();
    await act(async () => tab('Đã có mặt').click());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="pt-row-1"] button')!.click());
    expect(tab('Đã có mặt').textContent).toContain('(0)');
    expect(tab('Không có mặt').textContent).toContain('(1)');
    expect(host.querySelector('[data-testid="pt-row-1"]')).toBeNull();
    await act(async () => tab('Không có mặt').click());
    expect(host.querySelector('[data-testid="pt-row-1"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="pt-row-1"]')?.textContent).toContain('Đã bỏ ghi nhận có mặt');
    await act(async () => root.unmount());
    root = createRoot(host);
    await render();
    expect(tab('Đã có mặt').textContent).toContain('(0)');
  });

  it.each(['Không có quyền', 'API unavailable'])('retains attendance on unmark failure: %s', async (message) => {
    mocks.load.mockResolvedValue([attended]);
    mocks.unmark.mockRejectedValue(new Error(message));
    await render();
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="pt-row-1"] button')!.click());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(message);
    expect(tab('Đã có mặt').textContent).toContain('(1)');
    expect(host.querySelector<HTMLButtonElement>('[data-testid="pt-row-1"] button')!.disabled).toBe(false);
  });

  it('blocks duplicate clicks until unmark and backend reload finish', async () => {
    mocks.load.mockResolvedValue([attended]);
    let finish!: (value: object) => void;
    mocks.unmark.mockReset().mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await render();
    const button = host.querySelector<HTMLButtonElement>('[data-testid="pt-row-1"] button')!;
    await act(async () => { button.click(); button.click(); });
    expect(mocks.unmark).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    await act(async () => finish({}));
  });

  it('refreshes real backend attendance when returning to the page', async () => {
    mocks.load.mockResolvedValueOnce([attended]).mockResolvedValue([{ ...attended, attendedAt: null }]);
    await render();
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(tab('Đã có mặt').textContent).toContain('(0)');
    expect(tab('Không có mặt').textContent).toContain('(1)');
  });

  it('ignores a slow response for the previous date range', async () => {
    let finishOld!: (rows: object[]) => void;
    mocks.load.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }))
      .mockResolvedValue([missed]);
    await render();
    await pickDate(host, 'pt-from', isoOffset(-5));
    expect(host.querySelector('[data-testid="pt-row-2"]')).not.toBeNull();
    await act(async () => finishOld([attended]));
    expect(host.querySelector('[data-testid="pt-row-1"]')).toBeNull();
    expect(host.querySelector('[data-testid="pt-row-2"]')).not.toBeNull();
    expect(tab('Đã có mặt').textContent).toContain('(0)');
  });

  it('excludes cancelled sessions and keeps attendance unchanged until the backend reload completes', async () => {
    mocks.load.mockResolvedValueOnce([attended, { ...upcoming, status: 'cancelled' }]);
    let finishReload!: (rows: object[]) => void;
    mocks.load.mockImplementationOnce(() => new Promise((resolve) => { finishReload = resolve; }));
    mocks.unmark.mockResolvedValue({ ...attended, attendedAt: null });
    await render();
    expect(tab('Tất cả').textContent).toContain('(1)');
    expect(host.querySelector('[data-testid="pt-row-3"]')).toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="pt-row-1"] button')!.click());
    expect(host.textContent).toContain('Đang cập nhật điểm danh');
    expect(host.querySelector<HTMLButtonElement>('#pt-from')!.disabled).toBe(true);
    await act(async () => finishReload([{ ...attended, attendedAt: null }]));
    expect(tab('Không có mặt').textContent).toContain('(1)');
    expect(host.querySelector<HTMLButtonElement>('#pt-from')!.disabled).toBe(false);
  });

  it('keeps ongoing sessions out of upcoming and recomputes counts at the Vietnam end boundary', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-12T17:30:00Z')); // 00:30 on Nov 13 in Vietnam
    mocks.load.mockResolvedValue([
      { ...missed, id: 4, bookingDate: '2026-11-13', startTime: '00:00:00', endTime: '00:31:00' },
      { ...upcoming, bookingDate: '2026-11-13', startTime: '01:00:00', endTime: '02:00:00' },
    ]);
    try {
      await render();
      expect(tab('Sắp diễn ra').textContent).toContain('(1)');
      expect(host.querySelector('[data-testid="pt-row-4"]')?.textContent).toContain('Đang diễn ra');
      await act(async () => tab('Sắp diễn ra').click());
      expect(host.querySelector('[data-testid="pt-row-4"]')).toBeNull();
      expect(host.querySelector('[data-testid="pt-row-3"] button')).toBeNull();
      await act(async () => vi.advanceTimersByTime(60000));
      expect(tab('Không có mặt').textContent).toContain('(1)');
    } finally { vi.useRealTimers(); }
  });

  it('filters sessions by student name, card code, phone or email search query', async () => {
    const studentA = { ...attended, id: 10, memberId: 100, memberName: 'Nguyễn Văn A', membershipCode: 'MEM-100', memberPhone: '0912345678', memberEmail: 'a@gmail.com' };
    const studentB = { ...attended, id: 11, memberId: 101, memberName: 'Trần Thị B', membershipCode: 'MEM-101', memberPhone: '0987654321', memberEmail: 'b@gmail.com' };
    mocks.load.mockResolvedValue([studentA, studentB]);
    await render();

    expect(host.querySelector('[data-testid="pt-row-10"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="pt-row-11"]')).not.toBeNull();

    const searchInput = host.querySelector<HTMLInputElement>('input[type="search"]')!;
    expect(searchInput).not.toBeNull();

    // Hàm trợ giúp nhập liệu hoặc thao tác trên biểu mẫu trong DOM giả.
    const doSearch = async (val: string) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(searchInput, val);
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
    };

    await doSearch('Nguyễn Văn A');
    expect(host.querySelector('[data-testid="pt-row-10"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="pt-row-11"]')).toBeNull();

    await doSearch('MEM-101');
    expect(host.querySelector('[data-testid="pt-row-10"]')).toBeNull();
    expect(host.querySelector('[data-testid="pt-row-11"]')).not.toBeNull();

    await doSearch('0912345678');
    expect(host.querySelector('[data-testid="pt-row-10"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="pt-row-11"]')).toBeNull();

    await doSearch('b@gmail.com');
    expect(host.querySelector('[data-testid="pt-row-10"]')).toBeNull();
    expect(host.querySelector('[data-testid="pt-row-11"]')).not.toBeNull();

    await doSearch('Không tồn tại');
    expect(host.textContent).toContain('Không tìm thấy học viên phù hợp');
  });
});
