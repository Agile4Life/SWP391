import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoachClassesPage } from './CoachClassesPage';
import { AUTH_STORAGE_KEY } from '../../shared/api/client';
import { coachingApi } from './coachingApi';
import { getCoachSchedule } from '../member/coachBookingApi';
import { addIsoDays, mondayOfIso } from './coachTimetable';
import { centerNowParts } from '../../shared/lib/centerTime';

vi.mock('../member/coachBookingApi', () => ({ getCoachSchedule: vi.fn().mockResolvedValue([]) }));

// Giả lập Thứ Hai 06:00 giờ Việt Nam để các buổi trong tuần hiện tại luôn ở tương lai (trừ buổi cố tình đặt ở quá khứ).
const FIXED_MONDAY_MORNING = new Date('2026-11-22T23:00:00Z'); // 2026-11-23 06:00 +07:00
const currentMondayStr = mondayOfIso(centerNowParts(FIXED_MONDAY_MORNING).date);

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
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_MONDAY_MORNING);
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
    vi.useRealTimers();
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
        startTime: '17:00:00',
        endTime: '19:30:00',
        status: 'confirmed',
        paymentMethod: 'package_quota',
        disciplineName: 'Gym',
        notes: 'Đau vai trái',
      },
      {
        id: 10,
        memberName: 'Đã hủy',
        bookingDate: currentMondayStr,
        startTime: '14:15:00',
        endTime: '16:45:00',
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
    expect(dialog.textContent).toContain('Slot 5 · 17:00 – 19:30');
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
        startTime: '07:00:00',
        endTime: '09:30:00',
        status: 'confirmed',
      },
      {
        id: 10,
        memberId: 2,
        memberName: 'Lê Hoàng Long',
        membershipCode: 'MB-002',
        bookingDate: currentMondayStr,
        startTime: '09:45:00',
        endTime: '11:15:00',
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
    const futureSessionDate = addIsoDays(currentMondayStr, 6);
    vi.spyOn(coachingApi, 'getCoachSchedule').mockResolvedValueOnce([
      {
        id: 77,
        classId: 5,
        className: 'Yoga Sáng',
        disciplineName: 'Yoga',
        coachId: 1,
        coachName: 'Marcus Vance',
        roomName: 'Studio A',
        sessionDate: futureSessionDate,
        startTime: '17:00:00',
        endTime: '19:30:00',
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
    // P2-FE-64: Thẻ lớp nhóm của HLV hiện số học viên thay vì lặp tên HLV.
    expect(classBlock.textContent).toContain('11/20 học viên');
    expect(classBlock.textContent).not.toContain('Marcus Vance');
    await act(async () => classBlock.click());

    const dialog = host.querySelector('dialog')!;
    expect(dialog.textContent).toContain('Slot 5 · 17:00 – 19:30');
    expect(dialog.textContent).toContain('Studio A');
    expect(dialog.textContent).toContain('11/20');
    expect(dialog.querySelector('a[href="/coach/attendance/77"]')).not.toBeNull();
  });

  it('P1-FE-45 & P2-FE-64: hides attendance link for cancelled class sessions and marks ended PT sessions as past', async () => {
    // 10:00 giờ Việt Nam Thứ Ba (2026-11-24): buổi PT Thứ Hai (2026-11-23) đã kết thúc -> tone past.
    vi.setSystemTime(new Date('2026-11-24T03:00:00Z'));
    vi.mocked(getCoachSchedule).mockResolvedValueOnce([
      {
        id: 31,
        memberName: 'Nguyễn Minh Anh',
        bookingDate: currentMondayStr,
        startTime: '07:00:00',
        endTime: '09:30:00',
        status: 'confirmed',
        paymentMethod: 'package_quota',
      },
    ] as never);
    vi.spyOn(coachingApi, 'getCoachSchedule').mockResolvedValueOnce([
      {
        id: 79,
        classId: 5,
        className: 'Boxing Đã Hủy',
        disciplineName: 'Boxing',
        coachId: 1,
        roomName: 'Ring Arena 01',
        sessionDate: addIsoDays(currentMondayStr, 2),
        startTime: '17:00:00',
        endTime: '19:30:00',
        status: 'cancelled',
        cancelReason: 'Bảo trì sàn đấu',
        capacity: 14,
        bookedCount: 5,
      },
    ]);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <CoachClassesPage />
        </MemoryRouter>
      );
    });

    // Buổi PT đã qua được đánh dấu .mcal__event--past thay vì .mcal__event--mine
    expect(host.querySelectorAll('.mcal__event--past')).toHaveLength(1);
    expect(host.querySelectorAll('.mcal__event--mine')).toHaveLength(0);

    // Buổi lớp nhóm đã hủy không hiện link Điểm danh buổi này trong modal chi tiết
    const cancelledBlock = host.querySelector<HTMLButtonElement>('.mcal__event--cancelled')!;
    expect(cancelledBlock).not.toBeNull();
    await act(async () => cancelledBlock.click());
    const dialog = host.querySelector('dialog')!;
    expect(dialog.textContent).toContain('Bảo trì sàn đấu');
    expect(dialog.querySelector('a[href="/coach/attendance/79"]')).toBeNull();
  });

  it('P1-FE-53: handles null student fields safely, renders dash for blank fitnessLevel, and provides Retry on error', async () => {
    vi.spyOn(coachingApi, 'getAllAssignedStudents')
      .mockRejectedValueOnce(new Error('Roster down'))
      .mockResolvedValueOnce([
        {
          id: 501,
          memberId: 501,
          membershipCode: '',
          fullName: 'Học viên PT thuần',
          email: '',
          phone: null,
          fitnessGoal: '',
          healthNotes: '',
          fitnessLevel: '',
          enrolledAt: '',
          status: 'active',
        },
      ]);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <CoachClassesPage />
        </MemoryRouter>,
      );
    });

    const studentsTabBtn = [...host.querySelectorAll<HTMLButtonElement>('.coach-tab-btn')].find((btn) =>
      btn.textContent?.includes('Học viên phụ trách'),
    )!;
    await act(async () => studentsTabBtn.click());

    const alert = host.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Roster down');
    const retryBtn = [...alert!.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Thử lại')!;
    await act(async () => retryBtn.click());

    expect(host.textContent).toContain('Học viên PT thuần');
    const pill = host.querySelector('.fitness-level-pill');
    expect(pill?.textContent).toBe('—');
    expect(pill?.textContent).not.toContain('Nâng cao');
    expect(host.querySelector('.health-box--alert')).toBeNull();
  });

  it('P0-06: calls coachingApi.getCoachSchedule without passing username string id and surfaces partial group class failures with retry', async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        id: 'coach_marcus',
        identifier: 'coach_marcus',
        name: 'Marcus Vance',
        role: 'COACH',
      }),
    );
    vi.mocked(getCoachSchedule).mockResolvedValue([
      {
        id: 19,
        memberName: 'Nguyễn Minh Anh',
        bookingDate: currentMondayStr,
        startTime: '07:00:00',
        endTime: '09:30:00',
        status: 'confirmed',
        paymentMethod: 'package_quota',
        disciplineName: 'Gym',
      },
    ] as never);
    const scheduleSpy = vi.spyOn(coachingApi, 'getCoachSchedule')
      .mockRejectedValueOnce(new Error('Group classes down'))
      .mockResolvedValueOnce([]);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <CoachClassesPage />
        </MemoryRouter>,
      );
    });

    // Must not pass currentUser.id ("coach_marcus") to backend Long coachId param
    expect(scheduleSpy).toHaveBeenCalledWith();
    // Surfaces alert with Retry button while still showing PT bookings that loaded
    const alert = host.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('lớp nhóm');
    expect(host.querySelectorAll('.mcal__event--mine')).toHaveLength(1);

    // Retry reloads and clears alert
    const retryBtn = [...alert!.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Thử lại')!;
    await act(async () => retryBtn.click());
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it('P0-06: surfaces partial PT 1:1 failure with retry while still rendering loaded group class sessions', async () => {
    vi.mocked(getCoachSchedule).mockRejectedValueOnce(new Error('PT schedule down'));
    vi.spyOn(coachingApi, 'getCoachSchedule').mockResolvedValueOnce([
      {
        id: 88,
        classId: 5,
        className: 'Boxing Nâng Cao',
        disciplineName: 'Boxing',
        coachId: 1,
        roomName: 'Ring Arena 01',
        sessionDate: currentMondayStr,
        startTime: '17:00:00',
        endTime: '19:30:00',
        status: 'scheduled',
        capacity: 14,
        bookedCount: 6,
      },
    ]);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <CoachClassesPage />
        </MemoryRouter>,
      );
    });

    const alert = host.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('PT 1:1');
    expect(host.textContent).toContain('Boxing Nâng Cao');
  });
});
