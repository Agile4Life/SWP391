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

describe('ManagerClassesPage', () => {
  let host: HTMLDivElement;
  let root: Root;
  const today = todayISO();

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    vi.mocked(classesApi.getDisciplines).mockResolvedValue([
      { id: 1, name: 'Yoga', description: 'Yoga' },
      { id: 2, name: 'Boxing', description: 'Boxing' },
      { id: 3, name: 'Pilates', description: 'Pilates' },
    ]);
    vi.mocked(classesApi.getAvailableRooms).mockResolvedValue([
      { id: 10, name: 'Studio A', location: 'L1', capacity: 20, status: 'available' },
      { id: 20, name: 'Boxing Ring', location: 'L1', capacity: 16, status: 'available' },
      { id: 30, name: 'Zen Studio', location: 'RF', capacity: 15, status: 'available' },
    ]);
    vi.mocked(classesApi.getActiveCoaches).mockResolvedValue([
      { id: 100, fullName: 'HLV Lan', email: 'lan@sol.vn', status: 'active' },
      { id: 101, fullName: 'HLV Hùng', email: 'hung@sol.vn', status: 'active' },
    ]);
    vi.mocked(classesApi.getClasses).mockResolvedValue([
      {
        id: 1,
        name: 'Yoga Sáng',
        disciplineId: 1,
        disciplineName: 'Yoga',
        coachId: 100,
        coachName: 'HLV Lan',
        roomId: 10,
        roomName: 'Studio A',
        capacity: 20,
        status: 'active',
        price: 150000,
      },
      {
        id: 2,
        name: 'Boxing Cơ Bản',
        disciplineId: 2,
        disciplineName: 'Boxing',
        coachId: 101,
        coachName: 'HLV Hùng',
        roomId: 20,
        roomName: 'Boxing Ring',
        capacity: 16,
        status: 'active',
      },
      {
        id: 3,
        name: 'Pilates Core',
        disciplineId: 3,
        disciplineName: 'Pilates',
        coachId: 100,
        coachName: 'HLV Lan',
        roomId: 30,
        roomName: 'Zen Studio',
        capacity: 15,
        status: 'active',
      },
    ]);
    vi.mocked(classesApi.getSessions).mockResolvedValue([
      {
        id: 501,
        classId: 1,
        className: 'Yoga Sáng',
        disciplineId: 1,
        disciplineName: 'Yoga',
        coachId: 100,
        coachName: 'HLV Lan',
        roomId: 10,
        roomName: 'Studio A',
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
        roomName: 'Boxing Ring',
        sessionDate: today,
        startTime: '18:00:00',
        endTime: '19:00:00',
        status: 'scheduled',
        capacity: 16,
        bookedCount: 16,
      },
      {
        id: 503,
        classId: 3,
        className: 'Pilates Core',
        disciplineId: 3,
        disciplineName: 'Pilates',
        coachId: 100,
        coachName: 'HLV Lan',
        roomId: 30,
        roomName: 'Zen Studio',
        sessionDate: today,
        startTime: '18:00:00',
        endTime: '19:00:00',
        status: 'scheduled',
        capacity: 15,
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

  it('groups 3 concurrent disciplines in Full Week Overview (+2 lớp) and switches cleanly when clicking Yoga chip', async () => {
    await renderPage();

    // Mặc định đang ở "Lịch tổng cả tuần": 3 môn chạy cùng 18:00 được gom thành 1 thẻ + nút "+2 lớp" (không đè nhau)
    const overflowBtn = host.querySelector<HTMLButtonElement>('[data-testid="timetable-overflow-btn"]');
    expect(overflowBtn).not.toBeNull();
    expect(overflowBtn!.textContent).toContain('+2 lớp');

    // Bấm chip Yoga → tự chuyển sang lịch riêng của Yoga và chỉ hiện Yoga Sáng (không còn nút gom +2)
    const yogaChip = host.querySelector<HTMLButtonElement>('[data-testid="discipline-chip-1"]')!;
    await act(async () => yogaChip.click());

    expect(host.querySelector('[data-testid="timetable-overflow-btn"]')).toBeNull();
    const events = host.querySelectorAll<HTMLButtonElement>('.mcal__event');
    expect(events).toHaveLength(1);
    expect(events[0].textContent).toContain('Yoga Sáng');
  });

  it('opens full session detail modal with room, coach, capacity and enrolled students when clicking a timetable block', async () => {
    await renderPage();

    const yogaChip = host.querySelector<HTMLButtonElement>('[data-testid="discipline-chip-1"]')!;
    await act(async () => yogaChip.click());

    const yogaBlock = host.querySelector<HTMLButtonElement>('.mcal__event')!;
    await act(async () => yogaBlock.click());
    await act(async () => { await Promise.resolve(); });

    const detail = document.querySelector('[data-testid="session-detail-content"]')!;
    expect(detail).not.toBeNull();
    expect(detail.textContent).toContain('Yoga');
    expect(detail.textContent).toContain('Studio A');
    expect(detail.textContent).toContain('HLV Lan');
    expect(detail.textContent).toContain('12/20');
    expect(document.querySelector('[data-testid="session-detail-students"]')?.textContent).toContain('Nguyễn Minh Anh');
    const dialogButtons = [...document.querySelectorAll<HTMLButtonElement>('dialog button')].map((b) => b.textContent);
    expect(dialogButtons).toContain('Sửa khóa học');
    expect(dialogButtons).toContain('Dời lịch');
    expect(dialogButtons).toContain('Hủy buổi');
  });

  it('supports Room Overview where all 3 concurrent disciplines sit in separate room columns with zero overlap', async () => {
    await renderPage();

    const roomTab = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find((b) => b.textContent?.includes('Tổng quan theo phòng'))!;
    await act(async () => roomTab.click());

    expect(host.querySelectorAll('.rcal__col')).toHaveLength(3);
    expect(host.querySelectorAll('[data-testid="room-col-10"] .rcal__event')).toHaveLength(1);
    expect(host.querySelectorAll('[data-testid="room-col-20"] .rcal__event')).toHaveLength(1);
    expect(host.querySelectorAll('[data-testid="room-col-30"] .rcal__event')).toHaveLength(1);
  });

  it('opens full detail modal directly when selecting a hidden class from "+N lớp" overflow list', async () => {
    await renderPage();

    const overflowBtn = host.querySelector<HTMLButtonElement>('[data-testid="timetable-overflow-btn"]')!;
    await act(async () => overflowBtn.click());

    const rows = [...document.querySelectorAll<HTMLButtonElement>('[data-testid="timetable-overflow-list"] button')];
    expect(rows).toHaveLength(3);
    const pilatesRow = rows.find((r) => r.textContent?.includes('Pilates Core'))!;
    await act(async () => pilatesRow.click());
    await act(async () => { await Promise.resolve(); });

    const detail = document.querySelector('[data-testid="session-detail-content"]')!;
    expect(detail).not.toBeNull();
    expect(detail.textContent).toContain('Pilates');
    expect(detail.textContent).toContain('Zen Studio');
    expect(detail.textContent).toContain('8/15');
  });

  it('surfaces backend coach PT 1:1 conflict error cleanly inside the create modal', async () => {
    vi.mocked(classesApi.createRecurringClass).mockRejectedValue(
      new Error('Trùng lịch Huấn luyện viên: HLV "HLV Lan" đã có buổi PT 1:1 trong khung giờ 18:00 – 19:00'),
    );
    await renderPage();

    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="create-class-btn"]')!.click());
    const nameInput = document.querySelector<HTMLInputElement>('#cls-name')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(nameInput, 'Yoga Chiều');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const form = document.querySelector<HTMLFormElement>('dialog form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await act(async () => { await Promise.resolve(); });

    const alert = document.querySelector('dialog [role="alert"]');
    expect(alert?.textContent).toContain('PT 1:1');
  });
});
