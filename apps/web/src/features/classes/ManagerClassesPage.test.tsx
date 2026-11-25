import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ManagerClassesPage } from './ManagerClassesPage';
import { classesApi } from './classesApi';
import { todayISO } from '../schedule/timetable';

vi.mock('./classesApi', () => ({
  classesApi: {
    getClasses: vi.fn(),
    getSessions: vi.fn(),
    getDisciplines: vi.fn(),
    getAvailableRooms: vi.fn(),
    getActiveCoaches: vi.fn(),
    getSessionStudents: vi.fn(),
    createRecurringClass: vi.fn(),
    createSession: vi.fn(),
    updateClass: vi.fn(),
    deleteClass: vi.fn(),
    rescheduleSession: vi.fn(),
    cancelSession: vi.fn(),
  },
}));

describe('ManagerClassesPage (3 disciplines, 1 active class/sport, 3 independent tabs)', () => {
  let host: HTMLDivElement;
  let root: Root;
  const today = todayISO();

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    vi.mocked(classesApi.getDisciplines).mockResolvedValue([
      { id: 1, name: 'Gym', description: 'Gym' },
      { id: 2, name: 'Boxing', description: 'Boxing' },
      { id: 3, name: 'Yoga', description: 'Yoga' },
    ]);
    vi.mocked(classesApi.getAvailableRooms).mockResolvedValue([
      { id: 10, name: 'Phòng Gym Tiêu chuẩn', location: 'L1', capacity: 50, status: 'available' },
      { id: 20, name: 'Ring Arena 01', location: 'L1', capacity: 14, status: 'available' },
      { id: 30, name: 'Zen Garden Studio', location: 'RF', capacity: 18, status: 'available' },
    ]);
    vi.mocked(classesApi.getActiveCoaches).mockResolvedValue([
      { id: 100, fullName: 'HLV Lan', email: 'lan@sol.vn', status: 'active' },
      { id: 101, fullName: 'HLV Hùng', email: 'hung@sol.vn', status: 'active' },
    ]);
    vi.mocked(classesApi.getClasses).mockResolvedValue([
      {
        id: 1,
        name: 'Full Body Strength 101',
        disciplineId: 1,
        disciplineName: 'Gym',
        coachId: 101,
        coachName: 'HLV Hùng',
        roomId: 10,
        roomName: 'Phòng Gym Tiêu chuẩn',
        capacity: 20,
        status: 'active',
        price: 0,
      },
      {
        id: 2,
        name: 'Boxing Cơ Bản',
        disciplineId: 2,
        disciplineName: 'Boxing',
        coachId: 101,
        coachName: 'HLV Hùng',
        roomId: 20,
        roomName: 'Ring Arena 01',
        capacity: 14,
        status: 'active',
      },
      {
        id: 3,
        name: 'Hatha Yoga Nền Tảng',
        disciplineId: 3,
        disciplineName: 'Yoga',
        coachId: 100,
        coachName: 'HLV Lan',
        roomId: 30,
        roomName: 'Zen Garden Studio',
        capacity: 16,
        status: 'active',
        price: 150000,
      },
    ]);
    vi.mocked(classesApi.getSessions).mockResolvedValue([
      {
        id: 501,
        classId: 1,
        className: 'Full Body Strength 101',
        disciplineId: 1,
        disciplineName: 'Gym',
        coachId: 101,
        coachName: 'HLV Hùng',
        roomId: 10,
        roomName: 'Phòng Gym Tiêu chuẩn',
        sessionDate: today,
        startTime: '18:00:00',
        endTime: '19:00:00',
        status: 'scheduled',
        capacity: 20,
        bookedCount: 12,
      },
      {
        id: 502,
        classId: 2,
        className: 'Boxing Cơ Bản',
        disciplineId: 2,
        disciplineName: 'Boxing',
        coachId: 101,
        coachName: 'HLV Hùng',
        roomId: 20,
        roomName: 'Ring Arena 01',
        sessionDate: today,
        startTime: '18:00:00',
        endTime: '19:00:00',
        status: 'scheduled',
        capacity: 14,
        bookedCount: 14,
      },
      {
        id: 503,
        classId: 3,
        className: 'Hatha Yoga Nền Tảng',
        disciplineId: 3,
        disciplineName: 'Yoga',
        coachId: 100,
        coachName: 'HLV Lan',
        roomId: 30,
        roomName: 'Zen Garden Studio',
        sessionDate: today,
        startTime: '18:00:00',
        endTime: '19:00:00',
        status: 'scheduled',
        capacity: 16,
        bookedCount: 8,
      },
    ]);
    vi.mocked(classesApi.getSessionStudents).mockResolvedValue([
      { id: 1, memberId: 50, fullName: 'Nguyễn Minh Anh', email: 'anh@sol.vn', membershipCode: 'MEM-050', status: 'booked' },
    ]);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  const renderPage = async () => {
    await act(async () => {
      root.render(<ManagerClassesPage />);
    });
    await act(async () => {
      await Promise.resolve();
    });
  };

  it('renders 3 independent tabs without duplicate "All disciplines" chip or redundant filter dropdowns', async () => {
    await renderPage();

    const tabs = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')].map((b) => b.textContent?.trim());
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toBe('Lịch theo bộ môn');
    expect(tabs[1]).toBe('Lịch tổng cả tuần');
    expect(tabs[2]).toContain('Danh sách lớp');

    // Tab 1 chỉ có đúng 3 chip bộ môn, không có chip "Tất cả bộ môn" hay dropdown lọc thừa
    const chips = [...host.querySelectorAll<HTMLButtonElement>('[data-testid="discipline-filter-chips"] button')];
    expect(chips).toHaveLength(3);
    expect(chips.some((c) => c.textContent?.includes('Tất cả'))).toBe(false);
    expect(host.querySelector('#filter-class-select')).toBeNull();
    expect(host.querySelector('#filter-room-select')).toBeNull();

    // Bấm chip Yoga → chỉ hiện lịch của lớp Yoga duy nhất
    const yogaChip = host.querySelector<HTMLButtonElement>('[data-testid="discipline-chip-3"]')!;
    await act(async () => yogaChip.click());
    expect(host.querySelector('[data-testid="discipline-active-class-bar"]')?.textContent).toContain('Hatha Yoga Nền Tảng');
    const yogaEvents = host.querySelectorAll<HTMLButtonElement>('.mcal__event');
    expect(yogaEvents).toHaveLength(1);
    expect(yogaEvents[0].textContent).toContain('Hatha Yoga Nền Tảng');

    // Chuyển sang Tab 2 "Lịch tổng cả tuần" → độc lập, hiện đủ cả 3 bộ môn trùng giờ và gom thành "+2 lớp"
    const allWeekTab = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')][1];
    await act(async () => allWeekTab.click());
    const overflowBtn = host.querySelector<HTMLButtonElement>('[data-testid="timetable-overflow-btn"]');
    expect(overflowBtn).not.toBeNull();
    expect(overflowBtn!.textContent).toContain('+2 lớp');
  });

  it('hides all ad-hoc "+ Thêm buổi" buttons and disables "+ Tạo lớp học" when all 3 disciplines already have an active class', async () => {
    vi.mocked(classesApi.getClasses).mockResolvedValue([
      {
        id: 1,
        name: 'Full Body Strength 101',
        disciplineId: 1,
        disciplineName: 'Gym',
        coachId: 101,
        coachName: 'HLV Hùng',
        roomId: 10,
        roomName: 'Phòng Gym Tiêu chuẩn',
        capacity: 20,
        status: 'active',
        price: 0,
      },
      {
        id: 99,
        name: 'Kettlebell Conditioning (Old)',
        disciplineId: 1,
        disciplineName: 'Gym',
        coachId: 101,
        coachName: 'HLV Hùng',
        roomId: 10,
        roomName: 'Phòng Gym Tiêu chuẩn',
        capacity: 15,
        status: 'inactive',
        price: 0,
      },
      {
        id: 2,
        name: 'Boxing Cơ Bản',
        disciplineId: 2,
        disciplineName: 'Boxing',
        coachId: 101,
        coachName: 'HLV Hùng',
        roomId: 20,
        roomName: 'Ring Arena 01',
        capacity: 14,
        status: 'active',
      },
      {
        id: 3,
        name: 'Hatha Yoga Nền Tảng',
        disciplineId: 3,
        disciplineName: 'Yoga',
        coachId: 100,
        coachName: 'HLV Lan',
        roomId: 30,
        roomName: 'Zen Garden Studio',
        capacity: 16,
        status: 'active',
        price: 150000,
      },
    ]);
    vi.mocked(classesApi.getSessions).mockResolvedValue([
      {
        id: 501,
        classId: 1,
        className: 'Full Body Strength 101',
        disciplineId: 1,
        disciplineName: 'Gym',
        coachId: 101,
        coachName: 'HLV Hùng',
        roomId: 10,
        roomName: 'Phòng Gym Tiêu chuẩn',
        sessionDate: today,
        startTime: '18:00:00',
        endTime: '19:00:00',
        status: 'scheduled',
        capacity: 20,
        bookedCount: 12,
      },
      {
        id: 599,
        classId: 99,
        className: 'Kettlebell Conditioning (Old)',
        disciplineId: 1,
        disciplineName: 'Gym',
        coachId: 101,
        coachName: 'HLV Hùng',
        roomId: 10,
        roomName: 'Phòng Gym Tiêu chuẩn',
        sessionDate: today,
        startTime: '09:00:00',
        endTime: '10:00:00',
        status: 'scheduled',
        capacity: 15,
        bookedCount: 0,
      },
    ]);

    await renderPage();

    // Không bao giờ hiển thị nút "+ Thêm buổi" hay "+ Thêm buổi học"
    const headerBtn = host.querySelector<HTMLButtonElement>('[data-testid="create-class-btn"]')!;
    expect(headerBtn.textContent?.trim()).toBe('+ Tạo lớp học');
    expect(headerBtn.disabled).toBe(true);
    expect(host.querySelector('[data-testid="discipline-active-class-bar"]')?.textContent).not.toContain('Thêm buổi');
    expect(host.querySelector('[data-testid="discipline-active-class-bar"]')?.textContent).toContain('Sửa lớp');

    // Buổi của lớp inactive (classId 99) không bị cộng vào chip Gym (chỉ đếm 1 buổi của lớp active)
    expect(host.querySelector('[data-testid="discipline-chip-1"]')?.textContent).toContain('Gym (1)');

    // Tab 3 Danh sách lớp cũng không còn nút "Thêm buổi"
    const listTab = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')][2];
    await act(async () => listTab.click());
    const tableButtons = [...host.querySelectorAll<HTMLButtonElement>('table button')].map((b) => b.textContent?.trim());
    expect(tableButtons.some((label) => label?.includes('Thêm buổi'))).toBe(false);
  });

  it('opens full session detail modal with room, coach, capacity, enrolled students and action buttons when clicking a block', async () => {
    await renderPage();

    const yogaChip = host.querySelector<HTMLButtonElement>('[data-testid="discipline-chip-3"]')!;
    await act(async () => yogaChip.click());

    const yogaBlock = host.querySelector<HTMLButtonElement>('.mcal__event')!;
    await act(async () => yogaBlock.click());
    await act(async () => { await Promise.resolve(); });

    const detail = document.querySelector('[data-testid="session-detail-content"]')!;
    expect(detail).not.toBeNull();
    expect(detail.textContent).toContain('Yoga');
    expect(detail.textContent).toContain('Zen Garden Studio');
    expect(detail.textContent).toContain('HLV Lan');
    expect(detail.textContent).toContain('8/16');
    expect(document.querySelector('[data-testid="session-detail-students"]')?.textContent).toContain('Nguyễn Minh Anh');
    const dialogButtons = [...document.querySelectorAll<HTMLButtonElement>('dialog button')].map((b) => b.textContent);
    expect(dialogButtons).toContain('Sửa khóa học');
    expect(dialogButtons).toContain('Dời lịch');
    expect(dialogButtons).toContain('Hủy buổi');
  });

  it('opens detail modal directly when selecting a hidden class from "+N lớp" overflow list on Full Week tab', async () => {
    await renderPage();

    const allWeekTab = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')][1];
    await act(async () => allWeekTab.click());

    const overflowBtn = host.querySelector<HTMLButtonElement>('[data-testid="timetable-overflow-btn"]')!;
    await act(async () => overflowBtn.click());

    const rows = [...document.querySelectorAll<HTMLButtonElement>('[data-testid="timetable-overflow-list"] button')];
    expect(rows).toHaveLength(3);
    const yogaRow = rows.find((r) => r.textContent?.includes('Hatha Yoga Nền Tảng'))!;
    await act(async () => yogaRow.click());
    await act(async () => { await Promise.resolve(); });

    const detail = document.querySelector('[data-testid="session-detail-content"]')!;
    expect(detail).not.toBeNull();
    expect(detail.textContent).toContain('Yoga');
    expect(detail.textContent).toContain('Zen Garden Studio');
  });

  it('preselects an available discipline without an active class and surfaces coach PT 1:1 conflict error cleanly', async () => {
    vi.mocked(classesApi.getClasses).mockResolvedValue([
      {
        id: 1,
        name: 'Full Body Strength 101',
        disciplineId: 1,
        disciplineName: 'Gym',
        coachId: 101,
        coachName: 'HLV Hùng',
        roomId: 10,
        roomName: 'Phòng Gym Tiêu chuẩn',
        capacity: 20,
        status: 'active',
        price: 0,
      },
      {
        id: 3,
        name: 'Hatha Yoga Nền Tảng',
        disciplineId: 3,
        disciplineName: 'Yoga',
        coachId: 100,
        coachName: 'HLV Lan',
        roomId: 30,
        roomName: 'Zen Garden Studio',
        capacity: 16,
        status: 'active',
        price: 150000,
      },
    ]);
    vi.mocked(classesApi.createRecurringClass).mockRejectedValue(
      new Error('Trùng lịch Huấn luyện viên: HLV "HLV Lan" đã có buổi PT 1:1 trong khung giờ 18:00 – 19:00'),
    );
    await renderPage();

    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="create-class-btn"]')!.click());
    const nameInput = document.querySelector<HTMLInputElement>('#cls-name')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(nameInput, 'Boxing Nâng Cao');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const form = document.querySelector<HTMLFormElement>('dialog form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await act(async () => { await Promise.resolve(); });

    // Tự chọn bộ môn trống đầu tiên (Boxing - id 2), không chọn Gym (id 1 đã có lớp active)
    expect(classesApi.createRecurringClass).toHaveBeenCalledWith(
      expect.objectContaining({ disciplineId: 2 }),
    );
    const alert = document.querySelector('dialog [role="alert"]');
    expect(alert?.textContent).toContain('PT 1:1');
  });
});
