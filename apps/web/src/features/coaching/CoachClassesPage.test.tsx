import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoachClassesPage } from './CoachClassesPage';
import { AUTH_STORAGE_KEY } from '../../shared/api/client';
import { coachingApi } from './coachingApi';
import { getCoachSchedule } from '../member/coachBookingApi';

vi.mock('../member/coachBookingApi', () => ({ getCoachSchedule: vi.fn().mockResolvedValue([]) }));

// Thứ Hai của tuần chứa ngày d.
function getWeekMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

// Định dạng Date thành YYYY-MM-DD.
function formatYmd(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const currentMondayStr = formatYmd(getWeekMonday(new Date()));

describe('CoachClassesPage (SCRUM-121: UI Coach Lịch PT 1-1 & Học viên Phụ trách)', () => {
  let host: HTMLDivElement;
  let root: Root;

  const mockStudents = [
    {
      id: 101,
      memberId: 1,
      membershipCode: 'MB-2026-001',
      fullName: 'Lê Hoàng Long',
      email: 'long.le@solfitness.vn',
      phone: '0903 112 233',
      fitnessGoal: 'Tăng khối lượng cơ nạc (Hypertrophy), giảm mỡ vùng bụng dưới.',
      healthNotes: 'Tiền sử thoát vị đĩa đệm nhẹ L4-L5.',
      fitnessLevel: 'intermediate',
      emergencyContactName: 'Lê Thu Hương (Vợ)',
      emergencyContactPhone: '0903 998 877',
      enrolledAt: '2026-10-18T09:30:00Z',
      status: 'booked',
    },
    {
      id: 102,
      memberId: 2,
      membershipCode: 'MB-2026-014',
      fullName: 'Trần Thị Thu Thảo',
      email: 'thao.tran@solfitness.vn',
      phone: '0918 456 789',
      fitnessGoal: 'Săn chắc cơ mông đùi, cải thiện tư thế đứng.',
      healthNotes: 'Khớp cổ tay phải yếu do hội chứng ống cổ tay văn phòng.',
      fitnessLevel: 'beginner',
      emergencyContactName: 'Trần Văn Hùng (Bố)',
      emergencyContactPhone: '0912 345 678',
      enrolledAt: '2026-10-18T10:15:00Z',
      status: 'booked',
    },
  ];

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    if (typeof HTMLDialogElement !== 'undefined') {
      if (!HTMLDialogElement.prototype.showModal) {
        Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
          value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); },
          writable: true,
          configurable: true,
        });
      } else {
        vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) {
          this.setAttribute('open', '');
        });
      }
      if (!HTMLDialogElement.prototype.close) {
        Object.defineProperty(HTMLDialogElement.prototype, 'close', {
          value: function (this: HTMLDialogElement) { this.removeAttribute('open'); },
          writable: true,
          configurable: true,
        });
      } else {
        vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) {
          this.removeAttribute('open');
        });
      }
    }

    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        id: 1,
        fullName: 'Marcus Vance',
        role: 'COACH',
      })
    );

    vi.spyOn(coachingApi, 'getAllAssignedStudents').mockResolvedValue(mockStudents);
    vi.spyOn(coachingApi, 'getCoachSchedule').mockResolvedValue([]);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    host.remove();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders the coach weekly timetable and navigation', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <CoachClassesPage />
        </MemoryRouter>
      );
    });

    expect(host.textContent).toContain('Lịch dạy & học viên');
    expect(host.textContent).toContain('Thời khóa biểu');
    expect(host.textContent).toContain('Học viên phụ trách');
    expect(host.querySelector('[aria-label="Tuần trước"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Tuần sau"]')).not.toBeNull();
    expect(host.querySelectorAll('.mcal__col')).toHaveLength(7);
  });

  it('allows switching weeks and triggers schedule reload', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <CoachClassesPage />
        </MemoryRouter>
      );
    });

    const nextWeekBtn = host.querySelector('[aria-label="Tuần sau"]') as HTMLButtonElement;
    expect(nextWeekBtn).not.toBeNull();

    await act(async () => {
      nextWeekBtn.click();
    });

    expect(getCoachSchedule).toHaveBeenCalled();
  });

  it('switches to dedicated "Học viên phụ trách" tab and displays assigned students without icons', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <CoachClassesPage />
        </MemoryRouter>
      );
    });

    const tabButtons = Array.from(host.querySelectorAll('.coach-tab-btn'));
    const studentsTabBtn = tabButtons.find((btn) => btn.textContent?.includes('Học viên phụ trách'));
    expect(studentsTabBtn).toBeDefined();

    await act(async () => {
      studentsTabBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(host.textContent).toContain('Danh sách học viên phụ trách');
    expect(host.textContent).toContain('Lê Hoàng Long');
    expect(host.textContent).toContain('Trần Thị Thu Thảo');
    expect(host.textContent).toContain('Mục tiêu thể lực');
    expect(host.textContent).toContain('Lưu ý sức khỏe & chấn thương');

    // Đảm bảo không có emoji xuất hiện trong tab học viên
    expect(host.textContent).not.toContain('📧');
    expect(host.textContent).not.toContain('📞');
    expect(host.textContent).not.toContain('⚠️');
  });

  it('shows confirmed 1:1 bookings on the timetable and opens their detail modal', async () => {
    vi.mocked(getCoachSchedule).mockResolvedValueOnce([
      {
        id: 9,
        memberName: 'Phạm Quốc Bảo',
        bookingDate: currentMondayStr,
        startTime: '18:00:00',
        endTime: '19:00:00',
        status: 'confirmed',
        paymentMethod: 'package_quota',
        disciplineName: 'Gym',
        notes: 'Đau vai trái',
      },
      {
        id: 10,
        memberName: 'Đã hủy',
        bookingDate: currentMondayStr,
        startTime: '20:00:00',
        endTime: '21:00:00',
        status: 'cancelled',
      },
    ] as never);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <CoachClassesPage />
        </MemoryRouter>
      );
    });

    const events = [...host.querySelectorAll<HTMLButtonElement>('.mcal__event--mine')];
    expect(events).toHaveLength(1);
    expect(events[0].textContent).toContain('PT 1:1 · Phạm Quốc Bảo');

    await act(async () => events[0].click());
    const dialog = host.querySelector('dialog')!;
    expect(dialog.textContent).toContain('Đau vai trái');
    expect(dialog.textContent).toContain('Quyền lợi gói tập');
  });

  it('filters PT sessions on the weekly timetable by student search query', async () => {
    vi.mocked(getCoachSchedule).mockResolvedValueOnce([
      {
        id: 9,
        memberId: 1,
        memberName: 'Phạm Quốc Bảo',
        membershipCode: 'MB-001',
        bookingDate: currentMondayStr,
        startTime: '08:00:00',
        endTime: '09:00:00',
        status: 'confirmed',
      },
      {
        id: 10,
        memberId: 2,
        memberName: 'Lê Hoàng Long',
        membershipCode: 'MB-002',
        bookingDate: currentMondayStr,
        startTime: '10:00:00',
        endTime: '11:00:00',
        status: 'confirmed',
      },
    ] as never);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <CoachClassesPage />
        </MemoryRouter>
      );
    });

    const searchInput = host.querySelector<HTMLInputElement>('input[placeholder*="Tìm theo tên học viên"]')!;
    expect(searchInput).not.toBeNull();

    expect(host.querySelectorAll('.mcal__event--mine')).toHaveLength(2);

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(searchInput, 'Quốc Bảo');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const filteredEvents = host.querySelectorAll('.mcal__event--mine');
    expect(filteredEvents).toHaveLength(1);
    expect(filteredEvents[0].textContent).toContain('Phạm Quốc Bảo');
  });

  it('shows group class sessions alongside PT bookings and links to group class attendance', async () => {
    const sunday = new Date(getWeekMonday(new Date()));
    sunday.setDate(sunday.getDate() + 6);
    const futureSessionDate = formatYmd(sunday);
    vi.spyOn(coachingApi, 'getCoachSchedule').mockResolvedValueOnce([
      {
        id: 77,
        classId: 5,
        className: 'Yoga Sáng',
        disciplineName: 'Yoga',
        coachId: 1,
        roomName: 'Studio A',
        sessionDate: futureSessionDate,
        startTime: '20:00:00',
        endTime: '21:00:00',
        status: 'scheduled',
        capacity: 20,
        bookedCount: 11,
      },
    ]);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <CoachClassesPage />
        </MemoryRouter>
      );
    });

    const classBlock = host.querySelector<HTMLButtonElement>('.mcal__event--open')!;
    expect(classBlock).not.toBeNull();
    expect(classBlock.textContent).toContain('Yoga Sáng');
    await act(async () => classBlock.click());

    const dialog = host.querySelector('dialog')!;
    expect(dialog.textContent).toContain('Studio A');
    expect(dialog.textContent).toContain('11/20');
    expect(dialog.querySelector('a[href="/coach/attendance/77"]')).not.toBeNull();
  });
});
