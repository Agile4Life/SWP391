import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../shared/api/client';
import { ManagerClassesPage } from './ManagerClassesPage';
import {
  classesApi,
  type RecurringAvailabilityDto,
  type RecurringAvailabilityPayload,
} from './classesApi';
import { resolveWizardCoaches, resolveWizardRooms } from './components/classWizardValidation';
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
    expect(host.querySelector('[data-testid="discipline-active-class-bar"]')?.textContent).toContain('1 khóa đang hoạt động');
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
    expect(activeBar.textContent).not.toContain('Thêm buổi');
    // Sửa lớp nằm ở tab Danh sách lớp và chi tiết buổi học, không lặp ở thanh bộ môn.
    expect(activeBar.textContent).not.toContain('Sửa lớp');
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

    await act(async () => [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((tab) => tab.textContent?.includes('Danh sách lớp'))!.click());
    const row = [...host.querySelectorAll('tr')].find((tr) => tr.textContent?.includes('Full Body Strength 101'))!;
    await act(async () => [...row.querySelectorAll<HTMLButtonElement>('button')].find((btn) => btn.textContent === 'Sửa')!.click());
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

  it('P0-01: keeps Step 4 review open after clicking Step 3 Next with distinct non-submit button nodes until explicit Step 4 click', async () => {
    vi.mocked(classesApi.createRecurringClass).mockResolvedValue({
      id: 301,
      name: 'Boxing Afternoon',
      disciplineId: 1,
      coachId: 101,
      roomId: 20,
      capacity: 12,
      status: 'active',
    });

    await renderPage();
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="create-class-btn"]')!.click());

    // Step 1 -> Step 2
    await act(async () => setInputValue(document.querySelector<HTMLInputElement>('#cls-name')!, 'Boxing Afternoon'));
    // Submitting the form on Step 1 must not create the course
    await act(async () => {
      document.querySelector<HTMLFormElement>('dialog form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(classesApi.createRecurringClass).not.toHaveBeenCalled();

    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="wizard-next-btn"]')!.click());
    await act(async () => { await Promise.resolve(); });

    // Step 2: choose available Slot 2 -> Step 3
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="slot-option-2"]')!.click());
    await act(async () => { await Promise.resolve(); });
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="wizard-next-btn"]')!.click());

    // Step 3 -> Step 4: capture Step 3 Next DOM element before click
    const step3NextBtn = document.querySelector<HTMLButtonElement>('[data-testid="wizard-next-btn"]')!;
    expect(step3NextBtn).not.toBeNull();
    await act(async () => step3NextBtn.click());
    await act(async () => { await Promise.resolve(); });

    // Must remain on Step 4 Review without auto-submitting
    expect(document.querySelector('[data-testid="wizard-step-4"]')).not.toBeNull();
    expect(classesApi.createRecurringClass).not.toHaveBeenCalled();

    // Step 4 confirm button must be a freshly mounted distinct DOM node with type="button"
    const step4SubmitBtn = document.querySelector<HTMLButtonElement>('[data-testid="wizard-submit-btn"]')!;
    expect(step4SubmitBtn).not.toBeNull();
    expect(step4SubmitBtn).not.toBe(step3NextBtn);
    expect(step4SubmitBtn.type).toBe('button');

    // Explicit click on Step 4 submits the course
    await act(async () => step4SubmitBtn.click());
    await act(async () => { await Promise.resolve(); });
    expect(classesApi.createRecurringClass).toHaveBeenCalledTimes(1);
  });

  it('P0-05: aligns EditClassModal and ClassListTable statuses to active, inactive, and archived without cancelled', async () => {
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
      },
      {
        id: 2,
        name: 'Boxing Ngừng Mở',
        disciplineId: 2,
        disciplineName: 'Boxing',
        coachId: 101,
        coachName: 'HLV Hùng',
        roomId: 20,
        roomName: 'Ring Arena 01',
        capacity: 14,
        status: 'inactive',
      },
      {
        id: 3,
        name: 'Yoga Lưu Trữ',
        disciplineId: 3,
        disciplineName: 'Yoga',
        coachId: 100,
        coachName: 'HLV Lan',
        roomId: 30,
        roomName: 'Phòng Gym VIP',
        capacity: 16,
        status: 'archived',
      },
    ]);
    vi.mocked(classesApi.updateClass).mockResolvedValue({
      id: 1,
      name: 'Full Body Strength 101',
      disciplineId: 1,
      coachId: 101,
      roomId: 10,
      capacity: 20,
      status: 'inactive',
    });

    await renderPage();

    // Tab 3 ClassListTable distinguishes active, inactive, archived cleanly
    const listTab = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')][2];
    await act(async () => listTab.click());
    const allChip = [...host.querySelectorAll<HTMLButtonElement>('.filter-chip')].find((b) =>
      b.textContent?.includes('ngừng mở/lưu trữ'),
    )!;
    expect(allChip).toBeDefined();
    await act(async () => allChip.click());

    const rows = [...host.querySelectorAll('tbody tr')];
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('Đang mở');
    expect(rows[1].textContent).toContain('Ngừng mở');
    expect(rows[2].textContent).toContain('Lưu trữ');

    // Open EditClassModal and verify status select options are active | inactive | archived
    const editBtn = [...rows[0].querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Sửa')!;
    await act(async () => editBtn.click());
    const statusSelect = document.querySelector('#edit-cls-status')!.parentElement!.querySelector('select') as HTMLSelectElement;
    const optionValues = [...statusSelect.options].map((opt) => opt.value);
    expect(optionValues).toEqual(['active', 'inactive', 'archived']);
    expect(optionValues).not.toContain('cancelled');

    await act(async () => {
      statusSelect.value = 'inactive';
      statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      document.querySelector<HTMLFormElement>('dialog form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await act(async () => { await Promise.resolve(); });
    expect(classesApi.updateClass).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'inactive' }));
  });

  it('P1-FE-15 & P3-FE-19: invalidates stale availability on Step 2 edits, re-checks Step 3 after 409 conflict on Step 4, and prioritizes SCHEDULING_PAST_SESSION', async () => {
    let resolveDeferred: ((v: RecurringAvailabilityDto) => void) | null = null;
    vi.mocked(classesApi.checkRecurringAvailability)
      // Initial Step 2 check (Slot 1 has both past + disciplineConflict -> must prioritize Past slot)
      .mockImplementationOnce(async (payload) =>
        buildAvailabilityResponse(payload, {
          slots: buildAvailabilityResponse(payload).slots.map((s) =>
            s.slotNumber === 1
              ? { ...s, disciplineConflict: true, conflictCode: 'SCHEDULING_PAST_SESSION' }
              : s,
          ),
        }),
      )
      // Slot 2 check -> available
      .mockImplementationOnce(async (payload) => buildAvailabilityResponse(payload))
      // Toggling a weekday -> stays pending to test stale-key invalidation
      .mockImplementationOnce(
        () =>
          new Promise<RecurringAvailabilityDto>((resolve) => {
            resolveDeferred = resolve;
          }),
      )
      // Step 3 automatic re-check after 409 Conflict -> HLV Hùng is now busy!
      .mockImplementationOnce(async (payload) =>
        buildAvailabilityResponse(payload, {
          coaches: [
            {
              id: 100,
              fullName: 'HLV Lan',
              email: 'lan@sol.vn',
              available: true,
              conflictCode: null,
              conflictReason: null,
            },
            {
              id: 101,
              fullName: 'HLV Hùng',
              email: 'hung@sol.vn',
              available: false,
              conflictCode: 'SCHEDULING_COACH_PT_CONFLICT',
              conflictReason: 'HLV Hùng vừa nhận lịch PT 1:1.',
            },
          ],
        }),
      );

    vi.mocked(classesApi.createRecurringClass).mockRejectedValueOnce(
      new ApiError('Trùng lịch HLV Hùng', 409, 'SCHEDULING_COACH_PT_CONFLICT'),
    );

    await renderPage();
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="create-class-btn"]')!.click());
    await act(async () => setInputValue(document.querySelector<HTMLInputElement>('#cls-name')!, 'Race Safe Class'));
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="wizard-next-btn"]')!.click());
    await act(async () => { await Promise.resolve(); });

    // P3-FE-19: SCHEDULING_PAST_SESSION prioritized over disciplineConflict
    expect(document.querySelector('[data-testid="slot-option-1"]')?.textContent).toContain('Đã qua giờ');

    // Pick Slot 2 -> valid availability
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="slot-option-2"]')!.click());
    await act(async () => { await Promise.resolve(); });
    expect(document.querySelector('[data-testid="wizard-schedule-summary"]')?.textContent).toContain('Sẽ tạo 5 buổi học');

    // Toggle another weekday -> stale availability cleared immediately while pending
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="weekday-chip-FRIDAY"]')!.click());
    const nextBtnPending = document.querySelector<HTMLButtonElement>('[data-testid="wizard-next-btn"]')!;
    expect(nextBtnPending.disabled).toBe(true);
    expect(document.querySelector('[data-testid="wizard-schedule-summary"]')?.textContent).toContain('Đang kiểm tra');

    // Resolve pending availability check -> advance to Step 3 -> Step 4
    await act(async () => {
      resolveDeferred!(
        buildAvailabilityResponse({
          disciplineId: 1,
          startDate: '2026-12-01',
          endDate: '2026-12-29',
          recurringDays: ['MONDAY', 'FRIDAY'],
          startTime: '09:45:00',
          endTime: '11:15:00',
        }),
      );
      await Promise.resolve();
    });
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="wizard-next-btn"]')!.click());
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="wizard-next-btn"]')!.click());
    expect(document.querySelector('[data-testid="wizard-step-4"]')).not.toBeNull();

    // Submit on Step 4 -> fails with 409 Conflict
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="wizard-submit-btn"]')!.click());
    await act(async () => { await Promise.resolve(); });
    expect(document.querySelector('dialog [role="alert"]')?.textContent).toContain('Trùng lịch HLV Hùng');

    // Click Back to Step 3 -> triggers automatic re-check, HLV Hùng turns unavailable!
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="wizard-back-btn"]')!.click());
    await act(async () => { await Promise.resolve(); });
    expect(classesApi.checkRecurringAvailability).toHaveBeenCalledTimes(4);
    const hungBtn = document.querySelector<HTMLButtonElement>('[data-testid="wizard-coach-101"]')!;
    expect(hungBtn.disabled).toBe(true);
    expect(hungBtn.textContent).toContain('HLV Hùng vừa nhận lịch PT 1:1.');
    const lanBtn = document.querySelector<HTMLButtonElement>('[data-testid="wizard-coach-100"]')!;
    expect(lanBtn.disabled).toBe(false);
  });

  it('P1-FE-16: resolveWizardRooms/Coaches never fall back to fake-available items when validSchedule returns empty arrays', async () => {
    const emptyAvailability = buildAvailabilityResponse(
      {
        disciplineId: 1,
        startDate: '2026-12-01',
        endDate: '2026-12-29',
        recurringDays: ['MONDAY'],
        startTime: '09:45:00',
        endTime: '11:15:00',
      },
      { validSchedule: true, selectedSlotAvailable: true, rooms: [], coaches: [] },
    );

    expect(
      resolveWizardRooms(emptyAvailability, [
        { id: 10, name: 'Phòng Gym Tiêu chuẩn', location: 'L1', capacity: 50, status: 'available' },
      ]),
    ).toEqual([]);
    expect(
      resolveWizardCoaches(emptyAvailability, [
        { id: 100, fullName: 'HLV Lan', email: 'lan@sol.vn', status: 'active' },
      ]),
    ).toEqual([]);

    vi.mocked(classesApi.checkRecurringAvailability).mockResolvedValue(emptyAvailability);
    await renderPage();
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="create-class-btn"]')!.click());
    await act(async () => setInputValue(document.querySelector<HTMLInputElement>('#cls-name')!, 'No Resource Course'));
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="wizard-next-btn"]')!.click());
    await act(async () => { await Promise.resolve(); });
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="wizard-next-btn"]')!.click());

    expect(document.querySelector('[data-testid="wizard-no-rooms-alert"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="wizard-no-coaches-alert"]')).not.toBeNull();
    expect(document.querySelectorAll('button[data-testid^="wizard-room-"]')).toHaveLength(0);
    expect(document.querySelectorAll('button[data-testid^="wizard-coach-"]')).toHaveLength(0);
  });

  it('P1-FE-17: EditClassModal injects maintenance/inactive fallback room & coach, blocks saving Active until replaced, and permits switching to Inactive', async () => {
    vi.mocked(classesApi.getClasses).mockResolvedValue([
      {
        id: 77,
        name: 'Legacy Yoga Maintenance',
        disciplineId: 3,
        disciplineName: 'Yoga',
        coachId: 999,
        coachName: 'HLV Cũ',
        roomId: 888,
        roomName: 'Zen Studio (Đóng)',
        capacity: 12,
        status: 'active',
      },
    ]);
    vi.mocked(classesApi.updateClass).mockResolvedValue({
      id: 77,
      name: 'Legacy Yoga Maintenance',
      disciplineId: 3,
      coachId: 999,
      roomId: 888,
      capacity: 12,
      status: 'inactive',
    });

    await renderPage();
    const listTab = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')][2];
    await act(async () => listTab.click());
    const editBtn = [...host.querySelectorAll<HTMLButtonElement>('tbody button')].find((b) => b.textContent === 'Sửa')!;
    await act(async () => editBtn.click());

    // Fallback options appear with clear status labels
    const roomSelect = document.querySelector('#edit-cls-room')!.parentElement!.querySelector('select') as HTMLSelectElement;
    const coachSelect = document.querySelector('#edit-cls-coach')!.parentElement!.querySelector('select') as HTMLSelectElement;
    expect(roomSelect.options[0].textContent).toContain('Zen Studio (Đóng)');
    expect(roomSelect.options[0].textContent).toContain('Đang bảo trì');
    expect(coachSelect.options[0].textContent).toContain('HLV Cũ');
    expect(coachSelect.options[0].textContent).toContain('Ngừng hoạt động');
    expect(document.querySelector('[data-testid="edit-unavailable-resource-warning"]')).not.toBeNull();

    // Preserves room capacity validation against fallback room capacity (12)
    await act(async () => setInputValue(document.querySelector<HTMLInputElement>('#edit-cls-cap')!, '20'));
    expect(document.querySelector('[data-testid="edit-capacity-error"]')?.textContent).toContain('vượt quá sức chứa');
    await act(async () => setInputValue(document.querySelector<HTMLInputElement>('#edit-cls-cap')!, '12'));

    // Keeping status === 'active' with maintenance room is blocked
    const form = document.querySelector<HTMLFormElement>('dialog form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(classesApi.updateClass).not.toHaveBeenCalled();
    expect(document.querySelector('dialog [role="alert"]')?.textContent).toContain('bảo trì');

    // Switching status to 'inactive' allows saving cleanly
    const statusSelect = document.querySelector('#edit-cls-status')!.parentElement!.querySelector('select') as HTMLSelectElement;
    await act(async () => {
      statusSelect.value = 'inactive';
      statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await act(async () => { await Promise.resolve(); });
    expect(classesApi.updateClass).toHaveBeenCalledWith(
      77,
      expect.objectContaining({ roomId: 888, coachId: 999, status: 'inactive' }),
    );
  });

  it('P2-FE-38, P2-FE-39 & P3-FE-19: Tab 3 shows refresh error, hides Xem lịch on inactive classes, jumps to startDate week, and localizes fitnessLevel without flashing (0)', async () => {
    vi.mocked(classesApi.getClasses).mockResolvedValue([
      {
        id: 1,
        name: 'Future Gym Course',
        disciplineId: 1,
        disciplineName: 'Gym',
        coachId: 101,
        coachName: 'HLV Hùng',
        roomId: 10,
        roomName: 'Phòng Gym Tiêu chuẩn',
        capacity: 20,
        status: 'active',
        startDate: '2099-03-11',
        endDate: '2099-04-11',
      },
      {
        id: 2,
        name: 'Archived Boxing',
        disciplineId: 2,
        disciplineName: 'Boxing',
        coachId: 101,
        coachName: 'HLV Hùng',
        roomId: 20,
        roomName: 'Ring Arena 01',
        capacity: 14,
        status: 'archived',
      },
    ]);

    let resolveStudents: ((list: Awaited<ReturnType<typeof classesApi.getSessionStudents>>) => void) | null = null;
    vi.mocked(classesApi.getSessionStudents).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStudents = resolve;
        }),
    );

    await renderPage();

    // Open session detail modal while students are loading -> should NOT flash "(0)"
    await act(async () => host.querySelector<HTMLButtonElement>('.mcal__event')!.click());
    expect(document.querySelector('dialog h3')?.textContent?.trim()).toBe('Học viên đã ghi danh');
    expect(document.querySelector('dialog h3')?.textContent).not.toContain('(0)');

    // Resolve students with raw fitnessLevel enum -> must map to localized label, not raw enum
    await act(async () => {
      resolveStudents!([
        {
          id: 1,
          memberId: 50,
          fullName: 'Nguyễn Minh Anh',
          email: 'anh@sol.vn',
          fitnessLevel: 'intermediate',
          status: 'booked',
        },
      ]);
      await Promise.resolve();
    });
    expect(document.querySelector('dialog h3')?.textContent).toContain('(1)');
    expect(document.querySelector('[data-testid="session-detail-students"]')?.textContent).toContain('Trung cấp');
    expect(document.querySelector('[data-testid="session-detail-students"]')?.textContent).not.toContain('intermediate');
    await act(async () => document.querySelector<HTMLButtonElement>('dialog .portal-dialog__close')!.click());

    // Switch to Tab 3, show All -> archived row must not have "Xem lịch", active row jumps weekStart to Monday of 2099-03-11 (2099-03-09)
    const listTab = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')][2];
    await act(async () => listTab.click());
    const allChip = [...host.querySelectorAll<HTMLButtonElement>('.filter-chip')].find((b) =>
      b.textContent?.includes('Tất cả'),
    )!;
    await act(async () => allChip.click());

    const rows = [...host.querySelectorAll('tbody tr')];
    expect(rows).toHaveLength(2);
    expect(rows[1].textContent).not.toContain('Xem lịch');

    // Trigger refresh failure while on Tab 3 -> must display error alert + Retry button
    vi.mocked(classesApi.getClasses).mockRejectedValueOnce(new Error('Lỗi làm mới danh sách'));
    await act(async () => host.querySelector<HTMLButtonElement>('.portal-header button[aria-label]')?.click());
    await act(async () => { await Promise.resolve(); });
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Lỗi làm mới danh sách');

    // Click "Xem lịch" on Future Gym Course -> switches to Tab 1 and jumps to week 09/03 – 15/03/2099
    const viewScheduleBtn = [...rows[0].querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Xem lịch')!;
    await act(async () => viewScheduleBtn.click());
    expect(host.textContent).toContain('09/03 – 15/03/2099');
  });
});
