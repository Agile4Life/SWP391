import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoachAttendancePage } from './CoachAttendancePage';
import { attendanceApi, type AttendanceStudent, type CoachClassSession } from './attendanceApi';
import { toast } from '../../shared/ui/toast';

describe('CoachAttendancePage (SCRUM-123: HLV Điểm danh Buổi học & Đánh giá)', () => {
  let host: HTMLDivElement;
  let root: Root;

  const mockSessions: CoachClassSession[] = [
    {
      id: 101,
      className: 'Reformer Core & Spinal Alignment',
      disciplineName: 'Pilates Reformer',
      roomName: 'Studio 01 (Tầng 2)',
      sessionDate: '2026-10-25',
      startTime: '17:30',
      endTime: '18:30',
      bookedCount: 2,
      capacity: 6,
    },
  ];

  const mockStudents: AttendanceStudent[] = [
    {
      id: 1,
      memberId: 101,
      fullName: 'Nguyễn Văn An',
      membershipCode: 'MB-2026-089',
      status: 'present',
      progressScore: 85,
      notes: 'Kiểm soát cơ lõi tốt.',
    },
    {
      id: 2,
      memberId: 102,
      fullName: 'Trần Thị Mai',
      membershipCode: 'MB-2026-054',
      status: 'late',
      progressScore: 70,
      notes: 'Đến muộn 5 phút.',
    },
  ];

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    vi.spyOn(attendanceApi, 'getCoachSessions').mockResolvedValue(mockSessions);
    vi.spyOn(attendanceApi, 'getSessionStudents').mockResolvedValue(mockStudents);
    vi.spyOn(attendanceApi, 'saveBatchAttendance').mockResolvedValue({
      success: true,
      updatedCount: 2,
      message: 'Đã lưu điểm danh & đánh giá thành công cho 2 học viên.',
    });
    vi.spyOn(toast, 'success');
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders session information and booked students list (AC 1)', async () => {
    await act(async () => {
      root.render(<CoachAttendancePage />);
    });

    expect(host.textContent).toContain('Điểm Danh Buổi Học & Đánh Giá');
    expect(host.textContent).toContain('Reformer Core & Spinal Alignment');
    expect(host.textContent).toContain('Nguyễn Văn An');
    expect(host.textContent).toContain('MB-2026-089');
    expect(host.textContent).toContain('Trần Thị Mai');
    expect(host.textContent).toContain('MB-2026-054');
  });

  it('renders 4 radio buttons: Có mặt, Vắng mặt, Đi muộn, Có phép (AC 2)', async () => {
    await act(async () => {
      root.render(<CoachAttendancePage />);
    });

    expect(host.textContent).toContain('Có mặt');
    expect(host.textContent).toContain('Vắng mặt');
    expect(host.textContent).toContain('Đi muộn');
    expect(host.textContent).toContain('Có phép');

    // Radio inputs exist
    const radioInputs = host.querySelectorAll('input[type="radio"]');
    expect(radioInputs.length).toBeGreaterThanOrEqual(8); // 2 students * 4 statuses

    // Select absent for first student
    const absentRadio = host.querySelector('input[name="attendance-status-1"][value="absent"]') as HTMLInputElement;
    expect(absentRadio).not.toBeNull();

    await act(async () => {
      absentRadio.click();
    });

    expect(absentRadio.checked).toBe(true);
  });

  it('renders progress score slider (1-100) and technical notes input (AC 3)', async () => {
    await act(async () => {
      root.render(<CoachAttendancePage />);
    });

    const sliders = host.querySelectorAll('input[type="range"]');
    expect(sliders.length).toBe(2);

    const firstSlider = sliders[0] as HTMLInputElement;
    expect(firstSlider.min).toBe('1');
    expect(firstSlider.max).toBe('100');
    expect(firstSlider.value).toBe('85');

    // Change slider value
    await act(async () => {
      firstSlider.value = '95';
      firstSlider.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Notes input exists
    const notesInput = host.querySelector('input[aria-label="Nhận xét kỹ thuật của Nguyễn Văn An"]') as HTMLInputElement;
    expect(notesInput).not.toBeNull();
    expect(notesInput.value).toBe('Kiểm soát cơ lõi tốt.');

    await act(async () => {
      notesInput.value = 'Động tác biến thể nâng cao rất xuất sắc.';
      notesInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  it('saves batch attendance and triggers success toast (AC 4)', async () => {
    await act(async () => {
      root.render(<CoachAttendancePage />);
    });

    const saveBtn = host.querySelector('.btn-batch-save') as HTMLButtonElement;
    expect(saveBtn).not.toBeNull();

    await act(async () => {
      saveBtn.click();
    });

    expect(attendanceApi.saveBatchAttendance).toHaveBeenCalledWith(101, [
      expect.objectContaining({ memberId: 101, status: 'present', progressScore: 85 }),
      expect.objectContaining({ memberId: 102, status: 'late', progressScore: 70 }),
    ]);

    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('thành công'));
  });

  it('marks all students as present when quick button is clicked', async () => {
    await act(async () => {
      root.render(<CoachAttendancePage />);
    });

    const quickBtn = host.querySelector('.btn-quick-present') as HTMLButtonElement;
    expect(quickBtn).not.toBeNull();

    await act(async () => {
      quickBtn.click();
    });

    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Có mặt cho toàn bộ'));
  });
});
