import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoachAttendancePage } from './CoachAttendancePage';
import { attendanceApi, type AttendanceStudent, type CoachClassSession } from './attendanceApi';
import { getCoachSchedule } from '../member/coachBookingApi';
import { addIsoDays } from './coachTimetable';
import { centerNowParts } from '../../shared/lib/centerTime';

vi.mock('./attendanceApi', () => ({
  attendanceApi: {
    getCoachSessions: vi.fn(),
    getHistory: vi.fn(),
    getSessionStudents: vi.fn(),
    saveBatchAttendance: vi.fn(),
  },
}));
vi.mock('../member/coachBookingApi', () => ({ getCoachSchedule: vi.fn().mockResolvedValue([]) }));

describe('CoachAttendancePage (group class attendance)', () => {
  let host: HTMLDivElement;
  let root: Root;
  // 2026-11-26 10:00 giờ Việt Nam (03:00Z): buổi 07:00-09:30 hôm nay đã bắt đầu và trong hạn 7 ngày.
  const FIXED_NOW = new Date('2026-11-26T03:00:00Z');
  const today = centerNowParts(FIXED_NOW).date;

  const baseSession = (overrides: Partial<CoachClassSession> = {}): CoachClassSession => ({
    id: 88,
    className: 'Yoga Sáng',
    disciplineName: 'Yoga',
    roomName: 'Studio A',
    sessionDate: today,
    startTime: '07:00:00',
    endTime: '09:30:00',
    status: 'scheduled',
    capacity: 20,
    bookedCount: 1,
    ...overrides,
  });

  const baseStudent = (overrides: Partial<AttendanceStudent> = {}): AttendanceStudent => ({
    id: 1,
    memberId: 50,
    fullName: 'Trần Thu Hà',
    membershipCode: 'MEM-050',
    status: 'present',
    progressScore: 80,
    notes: '',
    recorded: false,
    ...overrides,
  });

  const renderAt = async (path: string) => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/coach/attendance" element={<CoachAttendancePage />} />
            <Route path="/coach/attendance/:sessionId" element={<CoachAttendancePage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await act(async () => { await Promise.resolve(); });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    if (typeof HTMLDialogElement !== 'undefined') {
      HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
      HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute('open'); };
    }
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    vi.mocked(attendanceApi.getCoachSessions).mockResolvedValue([baseSession()]);
    vi.mocked(attendanceApi.getHistory).mockResolvedValue([]);
    vi.mocked(attendanceApi.getSessionStudents).mockResolvedValue([baseStudent()]);
    vi.mocked(attendanceApi.saveBatchAttendance).mockResolvedValue({ success: true, updatedCount: 1, message: 'OK' });
    vi.mocked(getCoachSchedule).mockResolvedValue([]);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders attendance sessions list & attendance history tabs with .portal-tab-count and without retired evaluation tabs', async () => {
    await renderAt('/coach/attendance');

    const tabs = [...host.querySelectorAll('.attendance-nav-tabs [role="tab"]')];
    expect(tabs).toHaveLength(2);
    expect(tabs[0].textContent).toContain('Điểm danh');
    expect(tabs[0].querySelector('.portal-tab-count')?.textContent).toBe('1');
    expect(tabs[1].textContent).toContain('Lịch sử điểm danh');
    expect(tabs[1].querySelector('.portal-tab-count')?.textContent).toBe('0');
    expect(tabs.map((el) => el.textContent).join(' ')).not.toContain('đánh giá');
    expect(host.textContent).toContain('Yoga Sáng');
    expect(host.querySelector('a[href="/coach/attendance/88"]')).not.toBeNull();
  });

  it('loads session roster at /coach/attendance/:sessionId and links back to /coach/attendance', async () => {
    await renderAt('/coach/attendance/88');

    expect(host.textContent).toContain('Trần Thu Hà');
    expect(host.querySelector('a[href="/coach/attendance"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="attendance-lock-banner"]')).toBeNull();
  });

  it('P1-FE-43: preserves late status as present instead of downgrading to absent on load and save', async () => {
    vi.mocked(attendanceApi.getSessionStudents).mockResolvedValue([
      baseStudent({ id: 1, memberId: 50, fullName: 'Trần Thu Hà', status: 'late', recorded: true }),
      baseStudent({ id: 2, memberId: 51, fullName: 'Nguyễn Minh Quân', status: 'absent', recorded: true }),
    ]);

    await renderAt('/coach/attendance/88');

    const presentRadio = host.querySelector<HTMLInputElement>('input[name="attendance-status-1"][value="present"]')!;
    const absentRadio = host.querySelector<HTMLInputElement>('input[name="attendance-status-1"][value="absent"]')!;
    expect(presentRadio.checked).toBe(true);
    expect(absentRadio.checked).toBe(false);

    const saveBtn = host.querySelector<HTMLButtonElement>('.btn-batch-save')!;
    expect(saveBtn.disabled).toBe(false);
    await act(async () => { saveBtn.click(); });

    expect(attendanceApi.saveBatchAttendance).toHaveBeenCalledWith(88, [
      expect.objectContaining({ memberId: 50, status: 'present' }),
      expect.objectContaining({ memberId: 51, status: 'absent' }),
    ]);
  });

  it('P1-FE-44: keeps in-progress roster edits intact across focus/visibility background refreshes', async () => {
    await renderAt('/coach/attendance/88');

    const absentRadio = host.querySelector<HTMLInputElement>('input[name="attendance-status-1"][value="absent"]')!;
    await act(async () => { absentRadio.click(); });
    expect(absentRadio.checked).toBe(true);

    let finishRefresh!: (sessions: CoachClassSession[]) => void;
    vi.mocked(attendanceApi.getCoachSessions).mockImplementationOnce(
      () => new Promise<CoachClassSession[]>((resolve) => { finishRefresh = resolve; }),
    );

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    // Roster phải giữ nguyên (không bị thay bằng LoadingSkeleton) và lựa chọn Vắng mặt không bị reset.
    expect(host.textContent).toContain('Trần Thu Hà');
    expect(host.querySelector('[aria-busy="true"]')).toBeNull();
    expect(host.querySelector<HTMLInputElement>('input[name="attendance-status-1"][value="absent"]')!.checked).toBe(true);

    await act(async () => {
      finishRefresh([baseSession()]);
      await Promise.resolve();
    });
    expect(host.querySelector<HTMLInputElement>('input[name="attendance-status-1"][value="absent"]')!.checked).toBe(true);
  });

  it('P1-FE-45: locks attendance controls with banner for cancelled sessions', async () => {
    vi.mocked(attendanceApi.getCoachSessions).mockResolvedValue([baseSession({ status: 'cancelled' })]);

    await renderAt('/coach/attendance/88');

    const banner = host.querySelector('[data-testid="attendance-lock-banner"]');
    expect(banner?.textContent).toContain('đã bị hủy');
    expect(host.querySelector<HTMLButtonElement>('.btn-quick-present')!.disabled).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('.btn-batch-save')!.disabled).toBe(true);
    const radios = [...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios.length).toBeGreaterThan(0);
    expect(radios.every((r) => r.disabled)).toBe(true);
  });

  it('P1-FE-45: locks attendance controls with banner for sessions that have not started yet', async () => {
    // FIXED_NOW là 10:00 giờ Việt Nam -> Slot 5 (17:00-19:30) hôm nay chưa bắt đầu.
    vi.mocked(attendanceApi.getCoachSessions).mockResolvedValue([
      baseSession({ startTime: '17:00:00', endTime: '19:30:00' }),
    ]);

    await renderAt('/coach/attendance/88');

    const banner = host.querySelector('[data-testid="attendance-lock-banner"]');
    expect(banner?.textContent).toContain('chưa đến giờ bắt đầu');
    expect(host.querySelector<HTMLButtonElement>('.btn-quick-present')!.disabled).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('.btn-batch-save')!.disabled).toBe(true);
    expect([...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')].every((r) => r.disabled)).toBe(true);
  });

  it('P1-FE-45: locks attendance controls with banner for sessions older than 7 days', async () => {
    vi.mocked(attendanceApi.getCoachSessions).mockResolvedValue([
      baseSession({ sessionDate: addIsoDays(today, -8) }),
    ]);

    await renderAt('/coach/attendance/88');

    const banner = host.querySelector('[data-testid="attendance-lock-banner"]');
    expect(banner?.textContent).toContain('quá thời hạn 7 ngày');
    expect(host.querySelector<HTMLButtonElement>('.btn-quick-present')!.disabled).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('.btn-batch-save')!.disabled).toBe(true);
    expect([...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')].every((r) => r.disabled)).toBe(true);
  });

  it('P2-FE-60 & P2-FE-61: hides empty state on roster error with Retry button and disables radios while saving', async () => {
    vi.mocked(attendanceApi.getSessionStudents)
      .mockRejectedValueOnce(new Error('Lỗi tải danh sách'))
      .mockResolvedValueOnce([baseStudent()]);

    await renderAt('/coach/attendance/88');

    const alert = host.querySelector('[role="alert"]');
    expect(alert?.classList.contains('portal-alert')).toBe(true);
    expect(alert?.classList.contains('portal-alert--error')).toBe(true);
    expect(alert?.textContent).toContain('Lỗi tải danh sách');
    expect(host.textContent).not.toContain('Chưa có học viên nào đăng ký');

    const retryBtn = [...alert!.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Thử lại')!;
    await act(async () => { retryBtn.click(); await Promise.resolve(); });
    expect(host.textContent).toContain('Trần Thu Hà');

    let finishSave!: (res: { success: boolean; updatedCount: number; message: string }) => void;
    vi.mocked(attendanceApi.saveBatchAttendance).mockImplementationOnce(
      () => new Promise((resolve) => { finishSave = resolve; }),
    );
    const saveBtn = host.querySelector<HTMLButtonElement>('.btn-batch-save')!;
    await act(async () => { saveBtn.click(); saveBtn.click(); });

    expect(attendanceApi.saveBatchAttendance).toHaveBeenCalledTimes(1);
    expect([...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')].every((r) => r.disabled)).toBe(true);

    await act(async () => { finishSave({ success: true, updatedCount: 1, message: 'OK' }); await Promise.resolve(); });
    expect([...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')].every((r) => !r.disabled)).toBe(true);
  });

  it('P2-FE-61: renders history error with Retry, and displays gateCheckinAt badge and radiogroup in edit attendance modal', async () => {
    vi.mocked(attendanceApi.getHistory)
      .mockRejectedValueOnce(new Error('History unavailable'))
      .mockResolvedValueOnce([
        {
          sessionId: 88,
          classId: 1,
          className: 'Yoga Sáng',
          roomName: 'Studio A',
          sessionDate: today,
          startTime: '07:00:00',
          endTime: '09:30:00',
          presentCount: 1,
          lateCount: 0,
          absentCount: 0,
          excusedCount: 0,
          evaluatedCount: 0,
          averageScore: null,
          lastEvaluatedAt: null,
          attendanceEditable: true,
        },
      ]);
    vi.mocked(attendanceApi.getSessionStudents).mockResolvedValue([
      baseStudent({ gateCheckinAt: `${today}T07:05:00+07:00` }),
    ]);

    await renderAt('/coach/attendance');
    const historyTab = [...host.querySelectorAll<HTMLButtonElement>('.attendance-nav-tabs [role="tab"]')].find((t) => t.textContent?.includes('Lịch sử'))!;
    await act(async () => { historyTab.click(); });

    const errorBox = host.querySelector('[role="alert"]');
    expect(errorBox?.classList.contains('portal-alert')).toBe(true);
    expect(errorBox?.classList.contains('portal-alert--error')).toBe(true);
    expect(errorBox?.textContent).toContain('Không tải được lịch sử điểm danh.');
    expect(host.textContent).not.toContain('Chưa có buổi nào được điểm danh');

    const retryBtn = [...errorBox!.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Thử lại')!;
    await act(async () => { retryBtn.click(); await Promise.resolve(); });
    expect(host.textContent).toContain('Yoga Sáng');

    const editBtn = host.querySelector<HTMLButtonElement>('.btn-history-edit')!;
    await act(async () => { editBtn.click(); await Promise.resolve(); });

    const dialog = host.querySelector('dialog')!;
    expect(dialog).not.toBeNull();
    expect(dialog.querySelector('.student-gate-tag')?.textContent).toContain('Đã check-in');
    expect(dialog.querySelector('[role="radiogroup"]')).not.toBeNull();
  });

  it('renders quick date presets, datepickers and search input in history tab', async () => {
    const today = centerNowParts().date;
    vi.mocked(attendanceApi.getHistory).mockResolvedValue([
      {
        sessionId: 88,
        className: 'Boxing Pro',
        roomName: 'Ring 1',
        sessionDate: today,
        startTime: '07:00:00',
        endTime: '09:30:00',
        presentCount: 2,
        lateCount: 0,
        absentCount: 0,
        excusedCount: 0,
        evaluatedCount: 0,
        averageScore: null,
        lastEvaluatedAt: null,
        attendanceEditable: true,
      },
    ]);

    await renderAt('/coach/attendance');
    const historyTab = [...host.querySelectorAll<HTMLButtonElement>('.attendance-nav-tabs [role="tab"]')].find((t) => t.textContent?.includes('Lịch sử'))!;
    await act(async () => { historyTab.click(); });

    const presets = [...host.querySelectorAll<HTMLButtonElement>('.history-presets-bar button')];
    expect(presets.map((b) => b.textContent?.trim())).toEqual(['Hôm nay', '7 ngày qua', '14 ngày qua', '30 ngày qua']);

    expect(host.querySelector('#history-from')).not.toBeNull();
    expect(host.querySelector('#history-to')).not.toBeNull();
    expect(host.textContent).toContain('Boxing Pro');

    // Bấm preset Hôm nay
    const todayBtn = presets.find((b) => b.textContent?.includes('Hôm nay'))!;
    await act(async () => { todayBtn.click(); });
    expect(host.textContent).toContain('Boxing Pro');
  });
});
