import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ManagerClassesPage } from './ManagerClassesPage';
import {
  classesApi,
  type RecurringAvailabilityDto,
  type RecurringAvailabilityPayload,
} from './classesApi';
import { todayISO } from '../schedule/timetable';

vi.mock('./classesApi', () => ({
  classesApi: {
    getClasses: vi.fn(),
    getSessions: vi.fn(),
    getDisciplines: vi.fn(),
    getAvailableRooms: vi.fn(),
    getActiveCoaches: vi.fn(),
    getSessionStudents: vi.fn(),
    checkRecurringAvailability: vi.fn(),
    createRecurringClass: vi.fn(),
    createSession: vi.fn(),
    updateClass: vi.fn(),
    deleteClass: vi.fn(),
    rescheduleSession: vi.fn(),
    cancelSession: vi.fn(),
  },
}));

function buildAvailabilityResponse(
  payload: RecurringAvailabilityPayload,
  overrides?: Partial<RecurringAvailabilityDto>,
): RecurringAvailabilityDto {
  const isSlot1 = payload.startTime === '07:00:00';
  const slots = [
    {
      slotNumber: 1,
      code: 'SLOT_1',
      startTime: '07:00:00',
      endTime: '09:30:00',
      available: false,
      disciplineConflict: true,
      conflictCode: 'SCHEDULING_DISCIPLINE_OVERLAP',
      conflictReason: 'Trùng lịch cùng bộ môn Gym trong Slot 1 (07:00 – 09:30).',
      availableRoomCount: 1,
      availableCoachCount: 1,
    },
    {
      slotNumber: 2,
      code: 'SLOT_2',
      startTime: '09:45:00',
      endTime: '11:15:00',
      available: true,
      disciplineConflict: false,
      conflictCode: null,
      conflictReason: null,
      availableRoomCount: 2,
      availableCoachCount: 1,
    },
    {
      slotNumber: 3,
      code: 'SLOT_3',
      startTime: '11:30:00',
      endTime: '14:00:00',
      available: true,
      disciplineConflict: false,
      conflictCode: null,
      conflictReason: null,
      availableRoomCount: 2,
      availableCoachCount: 2,
    },
    {
      slotNumber: 4,
      code: 'SLOT_4',
      startTime: '14:15:00',
      endTime: '16:45:00',
      available: false,
      disciplineConflict: false,
      conflictCode: 'SCHEDULING_NO_COACH',
      conflictReason: 'Không còn HLV trống trong Slot 4.',
      availableRoomCount: 2,
      availableCoachCount: 0,
    },
    {
      slotNumber: 5,
      code: 'SLOT_5',
      startTime: '17:00:00',
      endTime: '19:30:00',
      available: true,
      disciplineConflict: false,
      conflictCode: null,
      conflictReason: null,
      availableRoomCount: 1,
      availableCoachCount: 1,
    },
  ];

  return {
    validSchedule: true,
    scheduleErrorCode: null,
    scheduleErrorMessage: null,
    sessionCount: 5,
    firstSessionDate: payload.startDate,
    lastSessionDate: payload.endDate,
    selectedSlotAvailable: !isSlot1,
    selectedSlotConflictCode: isSlot1 ? 'SCHEDULING_DISCIPLINE_OVERLAP' : null,
    selectedSlotConflictReason: isSlot1
      ? 'Trùng lịch cùng bộ môn Gym trong Slot 1 (07:00 – 09:30).'
      : null,
    slots,
    rooms: [
      {
        id: 10,
        name: 'Phòng Gym Tiêu chuẩn',
        location: 'L1',
        capacity: 50,
        tier: 'STANDARD',
        available: false,
        conflictCode: 'SCHEDULING_ROOM_CONFLICT',
        conflictReason: 'Trùng lịch phòng tập: Đã có lớp Full Body Strength 101.',
      },
      {
        id: 20,
        name: 'Ring Arena 01',
        location: 'L1',
        capacity: 14,
        tier: 'STANDARD',
        available: true,
        conflictCode: null,
        conflictReason: null,
      },
      {
        id: 30,
        name: 'Phòng Gym VIP',
        location: 'L2',
        capacity: 20,
        tier: 'PLATINUM',
        available: true,
        conflictCode: null,
        conflictReason: null,
      },
    ],
    coaches: [
      {
        id: 100,
        fullName: 'HLV Lan',
        email: 'lan@sol.vn',
        available: false,
        conflictCode: 'SCHEDULING_COACH_PT_CONFLICT',
        conflictReason: 'Trùng lịch PT 1:1 với hội viên trong khung giờ này.',
      },
      {
        id: 101,
        fullName: 'HLV Hùng',
        email: 'hung@sol.vn',
        available: true,
        conflictCode: null,
        conflictReason: null,
      },
    ],
    ...overrides,
  };
}

function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto =
    input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('ManagerClassesPage (multi-class per discipline, 4-step wizard, 3 independent tabs)', () => {
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
      { id: 10, name: 'Phòng Gym Tiêu chuẩn', location: 'L1', capacity: 50, status: 'available', tier: 'STANDARD' },
      { id: 20, name: 'Ring Arena 01', location: 'L1', capacity: 14, status: 'available', tier: 'STANDARD' },
      { id: 30, name: 'Phòng Gym VIP', location: 'L2', capacity: 20, status: 'available', tier: 'PLATINUM' },
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
        startTime: '17:00:00',
        endTime: '19:30:00',
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
        startTime: '17:00:00',
        endTime: '19:30:00',
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
        startTime: '17:00:00',
        endTime: '19:30:00',
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
        startTime: '17:00:00',
        endTime: '19:30:00',
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
        startTime: '17:00:00',
        endTime: '19:30:00',
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
        startTime: '17:00:00',
        endTime: '19:30:00',
        status: 'scheduled',
        capacity: 16,
        bookedCount: 8,
      },
    ]);
    vi.mocked(classesApi.getSessionStudents).mockResolvedValue([
      { id: 1, memberId: 50, fullName: 'Nguyễn Minh Anh', email: 'anh@sol.vn', membershipCode: 'MEM-050', status: 'booked' },
    ]);
    vi.mocked(classesApi.checkRecurringAvailability).mockImplementation(async (payload) =>
      buildAvailabilityResponse(payload),
    );
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

    const chips = [...host.querySelectorAll<HTMLButtonElement>('[data-testid="discipline-filter-chips"] button')];
    expect(chips).toHaveLength(3);
    expect(chips.some((c) => c.textContent?.includes('Tất cả'))).toBe(false);
    expect(host.querySelector('#filter-class-select')).toBeNull();
    expect(host.querySelector('#filter-room-select')).toBeNull();

    const yogaChip = host.querySelector<HTMLButtonElement>('[data-testid="discipline-chip-3"]')!;
    await act(async () => yogaChip.click());
    expect(host.querySelector('[data-testid="discipline-active-class-bar"]')?.textContent).toContain('Hatha Yoga Nền Tảng');
    const yogaEvents = host.querySelectorAll<HTMLButtonElement>('.mcal__event');
    expect(yogaEvents).toHaveLength(1);
    expect(yogaEvents[0].textContent).toContain('Hatha Yoga Nền Tảng');
    expect(yogaEvents[0].querySelector('.mcal__event-coach')?.textContent).toBe('HLV Lan');

    const allWeekTab = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')][1];
    await act(async () => allWeekTab.click());
    const overflowBtn = host.querySelector<HTMLButtonElement>('[data-testid="timetable-overflow-btn"]');
    expect(overflowBtn).not.toBeNull();
    expect(overflowBtn!.textContent).toContain('+2 lớp');
  });

  it('keeps "+ Tạo lớp học" enabled when all 3 disciplines have active classes, shows multiple active courses in Tab 1, and never renders "+ Thêm buổi"', async () => {
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
        startTime: '07:00:00',
        endTime: '09:30:00',
      },
      {
        id: 11,
        name: 'Hypertrophy Evening',
        disciplineId: 1,
        disciplineName: 'Gym',
        coachId: 100,
        coachName: 'HLV Lan',
        roomId: 30,
        roomName: 'Phòng Gym VIP',
        capacity: 18,
        status: 'active',
        price: 200000,
        startTime: '17:00:00',
        endTime: '19:30:00',
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
        startTime: '07:00:00',
        endTime: '09:30:00',
        status: 'scheduled',
        capacity: 20,
        bookedCount: 12,
      },
      {
        id: 511,
        classId: 11,
        className: 'Hypertrophy Evening',
        disciplineId: 1,
        disciplineName: 'Gym',
        coachId: 100,
        coachName: 'HLV Lan',
        roomId: 30,
        roomName: 'Phòng Gym VIP',
        sessionDate: today,
        startTime: '17:00:00',
        endTime: '19:30:00',
        status: 'scheduled',
        capacity: 18,
        bookedCount: 6,
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
        startTime: '09:45:00',
        endTime: '11:15:00',
        status: 'scheduled',
        capacity: 15,
        bookedCount: 0,
      },
    ]);

    await renderPage();

    const headerBtn = host.querySelector<HTMLButtonElement>('[data-testid="create-class-btn"]')!;
    expect(headerBtn.textContent?.trim()).toBe('+ Tạo lớp học');
    expect(headerBtn.disabled).toBe(false);

    const activeBar = host.querySelector('[data-testid="discipline-active-class-bar"]')!;
    expect(activeBar.textContent).toContain('2 khóa đang hoạt động');
    expect(activeBar.textContent).toContain('Full Body Strength 101');
    expect(activeBar.textContent).toContain('Hypertrophy Evening');
    expect(activeBar.textContent).toContain('Slot 1 · 07:00 – 09:30');
    expect(activeBar.textContent).toContain('Slot 5 · 17:00 – 19:30');
    expect(activeBar.textContent).not.toContain('Thêm buổi');
    expect(activeBar.querySelector('[data-testid="edit-discipline-class-1"]')?.textContent).toBe('Sửa lớp');
    expect(activeBar.querySelector('[data-testid="edit-discipline-class-11"]')?.textContent).toBe('Sửa lớp');
    expect(activeBar.querySelector('[data-testid="discipline-create-class-btn"]')?.textContent).toBe('+ Tạo khóa mới');

    // Buổi của lớp inactive (classId 99) không bị cộng vào chip Gym (chỉ đếm 2 buổi của 2 lớp active)
    expect(host.querySelector('[data-testid="discipline-chip-1"]')?.textContent).toContain('Gym (2)');

    // Ô trống trên Tab 1 vẫn bấm được để mở trình tạo khóa học dù bộ môn đã có 2 lớp active
    const freeSlotBtn = host.querySelector<HTMLButtonElement>('.mcal__slot:not(.is-past)');
    expect(freeSlotBtn).not.toBeNull();
    await act(async () => freeSlotBtn!.click());
    expect(document.querySelector('[data-testid="class-wizard-stepper"]')).not.toBeNull();
    await act(async () => document.querySelector<HTMLButtonElement>('dialog .portal-dialog__close')!.click());

    // Tab 3 Danh sách lớp cũng không còn nút "+ Thêm buổi"
    const listTab = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')][2];
    await act(async () => listTab.click());
    const tableButtons = [...host.querySelectorAll<HTMLButtonElement>('table button')].map((b) => b.textContent?.trim());
    expect(tableButtons.some((label) => label?.includes('Thêm buổi'))).toBe(false);
    expect(host.textContent).not.toContain('Thêm buổi');
  });

  it('walks through the 4-step wizard end-to-end with per-step validation, live availability conflicts, back-navigation persistence, and submit error recovery', async () => {
    vi.mocked(classesApi.createRecurringClass)
      .mockRejectedValueOnce(
        new Error('Trùng lịch Huấn luyện viên: HLV "HLV Hùng" vừa nhận buổi PT 1:1 trong khung giờ này.'),
      )
      .mockResolvedValueOnce({
        id: 201,
        name: 'Gym Power Morning',
        disciplineId: 1,
        coachId: 101,
        roomId: 30,
        capacity: 18,
        status: 'active',
      });

    await renderPage();

    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="create-class-btn"]')!.click());

    // Stepper shows 4 steps with Step 1 active
    const stepper = document.querySelector('[data-testid="class-wizard-stepper"]')!;
    expect(stepper.querySelectorAll('button')).toHaveLength(4);
    expect(document.querySelector('[data-testid="wizard-step-tab-1"]')?.getAttribute('aria-current')).toBe('step');
    expect(document.querySelector('[data-testid="wizard-step-1"]')).not.toBeNull();

    // All disciplines are selectable and show active course counts
    const disciplineTrigger = document.querySelector<HTMLButtonElement>('#cls-discipline')!;
    expect(disciplineTrigger.textContent).toContain('Gym (1 khóa đang mở)');

    // Step 1 validation: blocks empty name
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="wizard-next-btn"]')!.click());
    expect(document.querySelector('dialog [role="alert"]')?.textContent).toContain('Vui lòng nhập tên khóa học');
    expect(document.querySelector('[data-testid="wizard-step-1"]')).not.toBeNull();

    // Step 1 validation: blocks negative price
    const nameInput = document.querySelector<HTMLInputElement>('#cls-name')!;
    const priceInput = document.querySelector<HTMLInputElement>('#cls-price')!;
    await act(async () => {
      setInputValue(nameInput, 'Gym Power Morning');
      setInputValue(priceInput, '-10000');
    });
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="wizard-next-btn"]')!.click());
    expect(document.querySelector('dialog [role="alert"]')?.textContent).toContain('lớn hơn hoặc bằng 0');
    expect(document.querySelector('[data-testid="wizard-step-1"]')).not.toBeNull();

    // Fix price and advance to Step 2
    await act(async () => setInputValue(priceInput, '250000'));
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="wizard-next-btn"]')!.click());
    await act(async () => { await Promise.resolve(); });

    // Step 2: checkRecurringAvailability is called automatically for default Slot 1
    expect(document.querySelector('[data-testid="wizard-step-2"]')).not.toBeNull();
    expect(classesApi.checkRecurringAvailability).toHaveBeenCalledWith(
      expect.objectContaining({ disciplineId: 1, startTime: '07:00:00', endTime: '09:30:00' }),
    );
    expect(document.querySelectorAll('[data-testid^="slot-option-"]')).toHaveLength(5);

    // Slot 1 shows discipline conflict and blocks advancing; Slot 4 shows "Hết HLV"
    const slot1Btn = document.querySelector<HTMLButtonElement>('[data-testid="slot-option-1"]')!;
    expect(slot1Btn.classList.contains('is-unavailable')).toBe(true);
    expect(slot1Btn.textContent).toContain('Trùng lịch môn Gym');
    const slot4Btn = document.querySelector<HTMLButtonElement>('[data-testid="slot-option-4"]')!;
    expect(slot4Btn.classList.contains('is-unavailable')).toBe(true);
    expect(slot4Btn.textContent).toContain('Hết HLV');
    expect(document.querySelector('[data-testid="wizard-schedule-summary"]')?.textContent).toContain(
      'Trùng lịch cùng bộ môn Gym',
    );
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="wizard-next-btn"]')!.click());
    expect(document.querySelector('[data-testid="wizard-step-2"]')).not.toBeNull();
    expect(document.querySelector('dialog [role="alert"]')?.textContent).toContain('Trùng lịch cùng bộ môn Gym');

    // Pick available Slot 2 -> availability updates and allows advancing to Step 3
    const slot2Btn = document.querySelector<HTMLButtonElement>('[data-testid="slot-option-2"]')!;
    expect(slot2Btn.textContent).toContain('2 phòng · 1 HLV trống');
    await act(async () => slot2Btn.click());
    await act(async () => { await Promise.resolve(); });
    expect(slot2Btn.getAttribute('aria-pressed')).toBe('true');
    expect(classesApi.checkRecurringAvailability).toHaveBeenLastCalledWith(
      expect.objectContaining({ disciplineId: 1, startTime: '09:45:00', endTime: '11:15:00' }),
    );
    expect(document.querySelector('[data-testid="wizard-schedule-summary"]')?.textContent).toContain('Sẽ tạo 5 buổi học');

    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="wizard-next-btn"]')!.click());

    // Step 3: unavailable room & coach are disabled with exact conflict reasons
    expect(document.querySelector('[data-testid="wizard-step-3"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="wizard-step3-banner"]')?.textContent).toContain('Slot 2 (09:45 – 11:15)');

    const busyRoomBtn = document.querySelector<HTMLButtonElement>('[data-testid="wizard-room-10"]')!;
    expect(busyRoomBtn.disabled).toBe(true);
    expect(busyRoomBtn.textContent).toContain('Trùng lịch phòng tập');

    const vipRoomBtn = document.querySelector<HTMLButtonElement>('[data-testid="wizard-room-30"]')!;
    expect(vipRoomBtn.disabled).toBe(false);
    expect(vipRoomBtn.textContent).toContain('VIP Platinum');

    const busyCoachBtn = document.querySelector<HTMLButtonElement>('[data-testid="wizard-coach-100"]')!;
    expect(busyCoachBtn.disabled).toBe(true);
    expect(busyCoachBtn.textContent).toContain('Trùng lịch PT 1:1');

    const freeCoachBtn = document.querySelector<HTMLButtonElement>('[data-testid="wizard-coach-101"]')!;
    expect(freeCoachBtn.disabled).toBe(false);
    expect(freeCoachBtn.getAttribute('aria-checked')).toBe('true');

    // Select VIP room (capacity 20) and test capacity > room.capacity inline error
    await act(async () => vipRoomBtn.click());
    const capInput = document.querySelector<HTMLInputElement>('#cls-capacity')!;
    await act(async () => setInputValue(capInput, '25'));
    expect(document.querySelector('[data-testid="wizard-capacity-error"]')?.textContent).toContain('vượt quá sức chứa');

    // Clicking Next with capacity > room capacity stays on Step 3
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="wizard-next-btn"]')!.click());
    expect(document.querySelector('[data-testid="wizard-step-3"]')).not.toBeNull();

    // Fix capacity to 18 and advance to Step 4
    await act(async () => setInputValue(capInput, '18'));
    expect(document.querySelector('[data-testid="wizard-capacity-error"]')).toBeNull();
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="wizard-next-btn"]')!.click());

    // Step 4: full review summary + positive verification badge
    const step4 = document.querySelector('[data-testid="wizard-step-4"]')!;
    expect(step4).not.toBeNull();
    expect(step4.textContent).toContain('Gym Power Morning');
    expect(step4.textContent).toContain('Slot 2 · 09:45 – 11:15');
    expect(step4.textContent).toContain('5 buổi');
    expect(step4.textContent).toContain('Phòng Gym VIP · 18/20 chỗ');
    expect(step4.textContent).toContain('HLV Hùng');
    expect(step4.textContent).toContain('Đã kiểm tra: 5 Slot chuẩn');

    // Jump back to Step 1 via done stepper tab -> form state preserved
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="wizard-step-tab-1"]')!.click());
    expect(document.querySelector<HTMLInputElement>('#cls-name')?.value).toBe('Gym Power Morning');
    expect(document.querySelector<HTMLInputElement>('#cls-price')?.value).toBe('250000');

    // Navigate back to Step 4 cleanly
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="wizard-next-btn"]')!.click());
    await act(async () => { await Promise.resolve(); });
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="wizard-next-btn"]')!.click());
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="wizard-next-btn"]')!.click());
    expect(document.querySelector('[data-testid="wizard-step-4"]')).not.toBeNull();

    // First submit rejects with race-condition PT 1:1 conflict -> surfaces error & keeps modal/state open
    const form = document.querySelector<HTMLFormElement>('dialog form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await act(async () => { await Promise.resolve(); });
    expect(document.querySelector('dialog [role="alert"]')?.textContent).toContain('PT 1:1');
    expect(document.querySelector('[data-testid="wizard-step-4"]')).not.toBeNull();

    // Second submit succeeds with exact payload
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await act(async () => { await Promise.resolve(); });
    expect(classesApi.createRecurringClass).toHaveBeenLastCalledWith(
      expect.objectContaining({
        name: 'Gym Power Morning',
        disciplineId: 1,
        roomId: 30,
        coachId: 101,
        capacity: 18,
        price: 250000,
        startTime: '09:45:00',
        endTime: '11:15:00',
      }),
    );
    expect(document.querySelector('[data-testid="wizard-step-4"]')).toBeNull();
  });

  it('surfaces availability API failure in Step 2 with a working retry button instead of pretending slots are free', async () => {
    vi.mocked(classesApi.checkRecurringAvailability)
      .mockRejectedValueOnce(new Error('Mất kết nối máy chủ kiểm tra lịch'))
      .mockImplementationOnce(async (payload) =>
        buildAvailabilityResponse(payload, { selectedSlotAvailable: true }),
      );

    await renderPage();
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="create-class-btn"]')!.click());
    await act(async () => setInputValue(document.querySelector<HTMLInputElement>('#cls-name')!, 'Yoga Sáng'));
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="wizard-next-btn"]')!.click());
    await act(async () => { await Promise.resolve(); });

    expect(document.querySelector('[data-testid="wizard-schedule-summary"]')?.textContent).toContain(
      'Mất kết nối máy chủ kiểm tra lịch',
    );
    // Cannot advance while availability check errored
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="wizard-next-btn"]')!.click());
    expect(document.querySelector('[data-testid="wizard-step-2"]')).not.toBeNull();

    // Clicking retry re-runs checkRecurringAvailability and recovers
    await act(async () =>
      document.querySelector<HTMLButtonElement>('[data-testid="wizard-retry-availability-btn"]')!.click(),
    );
    await act(async () => { await Promise.resolve(); });
    expect(document.querySelector('[data-testid="wizard-schedule-summary"]')?.textContent).toContain('Sẽ tạo 5 buổi học');
  });

  it('allows EditClassModal to keep a class active alongside another active class in the same discipline and enforces room capacity limit', async () => {
    vi.mocked(classesApi.getClasses).mockResolvedValue([
      {
        id: 1,
        name: 'Full Body Strength 101',
        disciplineId: 1,
        disciplineName: 'Gym',
        coachId: 101,
        coachName: 'HLV Hùng',
        roomId: 20,
        roomName: 'Ring Arena 01',
        capacity: 12,
        status: 'active',
      },
      {
        id: 11,
        name: 'Gym Evening Pro',
        disciplineId: 1,
        disciplineName: 'Gym',
        coachId: 100,
        coachName: 'HLV Lan',
        roomId: 10,
        roomName: 'Phòng Gym Tiêu chuẩn',
        capacity: 25,
        status: 'active',
      },
    ]);
    vi.mocked(classesApi.updateClass).mockResolvedValue({
      id: 1,
      name: 'Full Body Strength Updated',
      disciplineId: 1,
      coachId: 101,
      roomId: 20,
      capacity: 14,
      status: 'active',
    });

    await renderPage();

    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="edit-discipline-class-1"]')!.click());
    const capInput = document.querySelector<HTMLInputElement>('#edit-cls-cap')!;
    const nameInput = document.querySelector<HTMLInputElement>('#edit-cls-name')!;
    const form = document.querySelector<HTMLFormElement>('dialog form')!;

    // Exceeds Ring Arena 01 capacity (14) -> blocked with inline error
    await act(async () => setInputValue(capInput, '18'));
    expect(document.querySelector('[data-testid="edit-capacity-error"]')?.textContent).toContain('vượt quá sức chứa');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(classesApi.updateClass).not.toHaveBeenCalled();

    // Valid capacity (14) succeeds even though class #11 is also active in Gym
    await act(async () => {
      setInputValue(nameInput, 'Full Body Strength Updated');
      setInputValue(capInput, '14');
    });
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await act(async () => { await Promise.resolve(); });

    expect(classesApi.updateClass).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        name: 'Full Body Strength Updated',
        disciplineId: 1,
        roomId: 20,
        capacity: 14,
        status: 'active',
      }),
    );
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
    expect(detail.textContent).toContain('Slot 5 · 17:00 – 19:30');
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
    expect(detail.textContent).toContain('Slot 5 · 17:00 – 19:30');
    expect(detail.textContent).toContain('Zen Garden Studio');
  });

  it('reschedules a session by selecting one of the 5 fixed slots', async () => {
    vi.mocked(classesApi.rescheduleSession).mockResolvedValue({
      id: 503,
      classId: 3,
      sessionDate: today,
      startTime: '14:15:00',
      endTime: '16:45:00',
      status: 'scheduled',
    });
    await renderPage();

    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="discipline-chip-3"]')!.click());
    await act(async () => host.querySelector<HTMLButtonElement>('.mcal__event')!.click());
    await act(async () => { await Promise.resolve(); });

    const rescheduleBtn = [...document.querySelectorAll<HTMLButtonElement>('dialog button')].find((b) => b.textContent === 'Dời lịch')!;
    await act(async () => rescheduleBtn.click());

    expect(document.querySelectorAll('[data-testid^="slot-option-"]')).toHaveLength(5);
    expect(document.querySelector<HTMLButtonElement>('[data-testid="slot-option-5"]')?.getAttribute('aria-pressed')).toBe('true');

    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="slot-option-4"]')!.click());
    const form = document.querySelector<HTMLFormElement>('dialog form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await act(async () => { await Promise.resolve(); });

    expect(classesApi.rescheduleSession).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 503, startTime: '14:15:00', endTime: '16:45:00' }),
    );
  });
});
