import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLanguage } from '../../../shared/i18n/language';
import {
  MemberCoachBookingView,
} from './MemberCoachBookingView';
import {
  formatCoachName,
  isSessionCompleted,
  isSessionStarted,
} from '../coachBookingUtils';

const mocks = vi.hoisted(() => ({
  getCoaches: vi.fn(),
  getAvailableSlots: vi.fn(),
  getMyCoachBookings: vi.fn(),
  createCoachBooking: vi.fn(),
  cancelCoachBooking: vi.fn(),
  getMemberQuotaStatus: vi.fn(),
}));

vi.mock('../coachBookingApi', () => ({
  getCoaches: mocks.getCoaches,
  getAvailableSlots: mocks.getAvailableSlots,
  getMyCoachBookings: mocks.getMyCoachBookings,
  createCoachBooking: mocks.createCoachBooking,
  cancelCoachBooking: mocks.cancelCoachBooking,
  getMemberQuotaStatus: mocks.getMemberQuotaStatus,
}));

describe('formatCoachName, isSessionStarted & isSessionCompleted helpers', () => {
  afterEach(() => {
    setLanguage('vi');
  });

  it('formats coach names correctly without duplicate HLV prefixes and localizes fallback in EN (P2-FE-50)', () => {
    expect(formatCoachName('HLV Huỳnh Đắc Tài')).toBe('Huỳnh Đắc Tài');
    expect(formatCoachName('hlv Nguyễn Văn A')).toBe('Nguyễn Văn A');
    expect(formatCoachName('Trần Thị B')).toBe('Trần Thị B');
    expect(formatCoachName(null)).toBe('Huấn luyện viên');
    setLanguage('en');
    expect(formatCoachName(null)).toBe('Coach');
  });

  it('determines whether a session has started or completed based on status and UTC+7 time (P1-FE-40)', () => {
    const now = { date: '2026-11-26', time: '08:00' };
    expect(isSessionStarted({ bookingDate: '2026-11-26', startTime: '07:00:00', status: 'confirmed' }, now)).toBe(true);
    expect(isSessionStarted({ bookingDate: '2026-11-26', startTime: '09:45:00', status: 'confirmed' }, now)).toBe(false);
    expect(isSessionStarted({ bookingDate: '2026-11-26', startTime: '07:00:00', status: 'cancelled' }, now)).toBe(false);
    // Trạng thái đã hoàn thành
    expect(isSessionCompleted({ bookingDate: '2099-01-01', endTime: '20:00', status: 'completed' })).toBe(true);
    // Trạng thái đã hủy
    expect(isSessionCompleted({ bookingDate: '2000-01-01', endTime: '10:00', status: 'cancelled' })).toBe(false);
    // Ngày giờ đặt lịch trong quá khứ
    expect(isSessionCompleted({ bookingDate: '2020-01-01', endTime: '10:00', status: 'confirmed' })).toBe(true);
    // Lịch đặt ở tương lai xa
    expect(isSessionCompleted({ bookingDate: '2099-12-31', endTime: '23:59', status: 'confirmed' })).toBe(false);
  });
});

describe('MemberCoachBookingView Review Logic', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    mocks.getCoaches.mockResolvedValue([
      { id: 1, fullName: 'Huỳnh Đắc Tài', specialization: 'Gym Fitness', defaultHourlyRate: 250000 },
    ]);
    mocks.getAvailableSlots.mockResolvedValue([]);
    mocks.getMemberQuotaStatus.mockResolvedValue({
      packageName: 'Platinum',
      monthlyQuota: 4,
      usedThisMonth: 1,
      remainingQuota: 3,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.clearAllMocks();
  });

  // Dựng component vào DOM giả để kiểm thử.
  async function renderComponent() {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <MemberCoachBookingView />
        </MemoryRouter>
      );
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
  }

  it('renders upcoming session with "Sắp diễn ra", pending review badge, and cancel button', async () => {
    mocks.getMyCoachBookings.mockResolvedValue([
      {
        id: 99,
        coachId: 1,
        coachName: 'HLV Huỳnh Đắc Tài',
        bookingDate: '2099-11-03',
        startTime: '20:00:00',
        endTime: '21:00:00',
        status: 'confirmed',
        paymentMethod: 'package_quota',
        hourlyRate: 250000,
      },
    ]);

    await renderComponent();

    // Không lặp tiền tố HLV
    expect(host.textContent).toContain('Tập 1:1 cùng HLV Huỳnh Đắc Tài');
    expect(host.textContent).not.toContain('HLV HLV');

    // Các chỉ báo buổi sắp diễn ra
    expect(host.textContent).toContain('Sắp diễn ra');
    expect(host.textContent).not.toContain('Đánh giá sau khi kết thúc buổi');
    expect(host.textContent).toContain('Hủy lịch hẹn');
    // Không được hiển thị nút đánh giá
    expect(host.textContent).not.toContain('Đánh giá HLV');
  });

  it('renders completed session with "Đã kết thúc buổi" without offering coach reviews', async () => {
    mocks.getMyCoachBookings.mockResolvedValue([
      {
        id: 88,
        coachId: 1,
        coachName: 'Huỳnh Đắc Tài',
        bookingDate: '2020-01-01',
        startTime: '09:00:00',
        endTime: '10:00:00',
        status: 'confirmed',
        paymentMethod: 'package_quota',
        hourlyRate: 250000,
        attendedAt: '2020-01-01T09:02:00',
      },
    ]);

    await renderComponent();

    expect(host.textContent).toContain('Đã kết thúc buổi');
    expect(host.textContent).not.toContain('Đánh giá HLV');
    // Không thể hủy buổi tập đã qua
    expect(host.textContent).not.toContain('Hủy lịch hẹn');

  });

  it('does not offer a review for a finished session the member was not marked present at', async () => {
    mocks.getMyCoachBookings.mockResolvedValue([
      { id: 89, coachId: 1, coachName: 'Huỳnh Đắc Tài', bookingDate: '2020-01-01', startTime: '09:00:00', endTime: '10:00:00',
        status: 'confirmed', paymentMethod: 'package_quota', hourlyRate: 250000, attendedAt: null },
    ]);

    await renderComponent();

    expect(host.textContent).toContain('Không có mặt');
    expect(host.textContent).not.toContain('không thể đánh giá');
    expect([...host.querySelectorAll('button')].some((b) => b.textContent?.includes('Đánh giá HLV'))).toBe(false);
  });
});

describe('MemberCoachBookingView membership notice', () => {
  const NO_PACKAGE_NOTICE = 'Cần có gói tập đang hoạt động để đặt lịch HLV 1:1.';
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    mocks.getCoaches.mockResolvedValue([]);
    mocks.getAvailableSlots.mockResolvedValue([]);
    mocks.getMyCoachBookings.mockResolvedValue([]);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  // Dựng component vào DOM giả để kiểm thử.
  const render = () => act(async () => root.render(<MemoryRouter><MemberCoachBookingView /></MemoryRouter>));

  it('tells a member without a package to register one', async () => {
    mocks.getMemberQuotaStatus.mockResolvedValue({ packageName: null, monthlyQuota: 0, usedThisMonth: 0, remainingQuota: 0 });
    await render();
    expect(host.textContent).toContain(NO_PACKAGE_NOTICE);
    expect(host.textContent).toContain('Đăng ký gói tập ngay');
  });

  it('does not claim the member has no package when the quota request fails', async () => {
    mocks.getMemberQuotaStatus.mockRejectedValue(new Error('offline'));
    await render();
    expect(host.textContent).not.toContain(NO_PACKAGE_NOTICE);
    expect(host.textContent).not.toContain('Bạn chưa có gói tập đang hoạt động');
    expect(host.textContent).toContain('Nâng cấp gói tập');
  });

  it('shows the real package for a member who has one', async () => {
    mocks.getMemberQuotaStatus.mockResolvedValue({ packageName: 'SILVER', monthlyQuota: 0, usedThisMonth: 0, remainingQuota: 0 });
    await render();
    expect(host.textContent).toContain('Gói SILVER không bao gồm lượt tập PT 1:1 miễn phí.');
    expect(host.textContent).not.toContain(NO_PACKAGE_NOTICE);
  });
});

describe('MemberCoachBookingView coach list & booking order', () => {
  describe('UI interaction', () => {
    let host: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
      host = document.createElement('div');
      document.body.append(host);
      root = createRoot(host);

      mocks.getCoaches.mockResolvedValue([
        { id: 1, fullName: 'Huỳnh Đắc Tài', specialization: 'Fitness & Cardio', defaultHourlyRate: 200000 },
        { id: 2, fullName: 'Nguyễn Minh Quân', specialization: 'Yoga & Strength', defaultHourlyRate: 200000 },
        { id: 3, fullName: 'Trần Thị Mỹ Trâm', specialization: 'Pilates & Yoga', defaultHourlyRate: 200000 },
      ]);
      mocks.getAvailableSlots.mockResolvedValue([]);
      mocks.getMyCoachBookings.mockResolvedValue([]);
      mocks.getMemberQuotaStatus.mockResolvedValue({ packageName: 'Gold', monthlyQuota: 3, usedThisMonth: 0, remainingQuota: 3 });
    });

    afterEach(async () => {
      await act(async () => root.unmount());
      host.remove();
      vi.clearAllMocks();
      vi.unstubAllGlobals();
    });

    it('does not render discipline filter chips and lists all coaches directly', async () => {
      await act(async () => {
        root.render(<MemoryRouter><MemberCoachBookingView /></MemoryRouter>);
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 60));
      });

      expect(host.textContent).not.toContain('Tất cả bộ môn');
      expect(host.querySelectorAll('.filter-chip')).toHaveLength(0);
      expect(host.textContent).toContain('Huỳnh Đắc Tài');
      expect(host.textContent).toContain('Nguyễn Minh Quân');
      expect(host.textContent).toContain('Trần Thị Mỹ Trâm');
    });

    it('sorts member PT bookings chronologically and filters by selected day', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-25T02:00:00Z'));
      mocks.getMyCoachBookings.mockResolvedValue([
        {
          id: 201,
          memberId: 10,
          memberName: 'Khoa',
          coachId: 1,
          coachName: 'Lê Trọng Nam',
          bookingDate: '2026-11-26',
          startTime: '20:00:00',
          endTime: '21:00:00',
          hourlyRate: 200000,
          paymentMethod: 'cash',
          paymentStatus: 'paid',
          status: 'confirmed',
          attendedAt: null,
          attendanceLocked: false,
          gateCheckinAt: null,
        },
        {
          id: 202,
          memberId: 10,
          memberName: 'Khoa',
          coachId: 1,
          coachName: 'Lê Trọng Nam',
          bookingDate: '2026-11-25',
          startTime: '15:00:00',
          endTime: '15:00:00',
          hourlyRate: 200000,
          paymentMethod: 'cash',
          paymentStatus: 'paid',
          status: 'confirmed',
          attendedAt: null,
          attendanceLocked: false,
          gateCheckinAt: null,
        },
      ]);

      try {
        await act(async () => {
          root.render(<MemoryRouter><MemberCoachBookingView /></MemoryRouter>);
        });
        await act(async () => {
          await new Promise((r) => setTimeout(r, 60));
        });

        // P1-FE-39: uses shared DatePicker instead of native <input type="date">
        expect(host.querySelector('input[type="date"]')).toBeNull();
        const dateTrigger = host.querySelector<HTMLButtonElement>('button[aria-label="Tìm lịch theo ngày"]');
        expect(dateTrigger).not.toBeNull();
        const historySection = dateTrigger?.closest('section');
        expect(historySection).not.toBeNull();
        // Chỉ kiểm tra ngày trong lịch sử; vùng chọn lịch mới cũng có thể hiển thị cùng ngày.
        const historyDates = () => Array.from(
          historySection?.querySelectorAll('.row-card__meta > strong:first-child') ?? [],
          date => date.textContent,
        );
        expect(historyDates()).toEqual(['25/11/2026', '26/11/2026']);

        // Mở DatePicker và chọn ngày 26/11/2026
        await act(async () => { dateTrigger?.click(); });
        const day26Btn = host.querySelector<HTMLButtonElement>('button[data-date="2026-11-26"]');
        expect(day26Btn).not.toBeNull();
        await act(async () => { day26Btn?.click(); });

        expect(historyDates()).toEqual(['26/11/2026']);

        const allDaysBtn = [...(historySection?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((b) =>
          b.textContent?.includes('Tất cả ngày')
        );
        expect(allDaysBtn).toBeDefined();

        await act(async () => {
          allDaysBtn?.click();
        });

        expect(historyDates()).toEqual(['25/11/2026', '26/11/2026']);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});


describe('weekly PT booking after Monday has passed', () => {
  it('only allows single session 1:1 booking and does not offer weekly or monthly recurring booking', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-06T01:00:00Z'));
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mocks.getCoaches.mockResolvedValue([{ id: 1, fullName: 'HLV A', specialization: 'Gym' }]);
    mocks.getMyCoachBookings.mockResolvedValue([]);
    mocks.getMemberQuotaStatus.mockResolvedValue({ packageName: 'GOLD', remainingQuota: 3 });
      mocks.getAvailableSlots.mockImplementation(async (_id, date) => date === '2026-11-06'
        ? [
            { slotNumber: 1, startTime: '07:00:00', endTime: '09:30:00', available: false, reason: 'too_soon' },
            { slotNumber: 2, startTime: '09:45:00', endTime: '12:15:00', available: false, reason: 'coach_busy' },
            { slotNumber: 3, startTime: '12:30:00', endTime: '15:00:00', available: false, reason: 'member_busy' },
            { slotNumber: 4, startTime: '15:15:00', endTime: '17:45:00', available: true, reason: null },
            { slotNumber: 5, startTime: '18:00:00', endTime: '20:30:00', available: false, reason: 'coach_on_leave' },
          ]
        : []);
      mocks.createCoachBooking.mockResolvedValue({ id: 10, coachId: 1, bookingDate: '2026-11-06', startTime: '15:15:00', endTime: '17:45:00', status: 'CONFIRMED' });
      try {
        await act(async () => root.render(<MemoryRouter><MemberCoachBookingView /></MemoryRouter>));
        const weekly = host.querySelector<HTMLButtonElement>('button[aria-label="Cả tuần (Hàng tuần)"]');
        expect(weekly).toBeNull();
        expect(host.textContent).not.toContain('Cả tuần');
        expect(host.textContent).not.toContain('Hàng tuần');
        expect(host.textContent).not.toContain('Cả tháng');
        expect(host.textContent).not.toContain('Hàng tháng');
        // 5 fixed slots rendered without coach_rest notice or old morning/afternoon/evening headings
        expect(host.querySelectorAll('[data-testid^="pt-slot-"]')).toHaveLength(5);
        expect(host.textContent).toContain('Slot 1');
        expect(host.textContent).toContain('07:00 – 09:30');
        expect(host.textContent).toContain('Slot 4');
        expect(host.textContent).toContain('15:15 – 17:45');
        expect(host.textContent).toContain('Đã qua thời gian'); // 07:00 slot already started at 08:00
        expect(host.textContent).toContain('HLV đã có lịch');
        expect(host.textContent).toContain('Bạn đã có lịch trùng');
        expect(host.textContent).toContain('HLV nghỉ phép');
        expect(host.textContent).not.toContain('HLV nghỉ 1 slot sau 3 slot');
        expect(host.textContent).not.toContain('Buổi sáng');
        const slot = host.querySelector<HTMLButtonElement>('[data-testid="pt-slot-4"]');
        expect(slot).not.toBeNull();
        await act(async () => slot!.click());
        expect(host.textContent).toContain('Slot 4 · 15:15 – 17:45');
        const confirm = [...host.querySelectorAll('button')].find(b => b.textContent?.includes('Xác nhận & Đặt lịch'));
        expect(confirm).toBeDefined();
        await act(async () => confirm!.click());
        expect(mocks.createCoachBooking).toHaveBeenCalledWith(expect.objectContaining({
          coachId: 1, bookingDate: '2026-11-06', startTime: '15:15:00', endTime: '17:45:00',
        }));
    } finally {
      await act(async () => root.unmount());
      host.remove();
      vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks();
    }
  });

  it('lets the member page through dates beyond the first week but never before today', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-26T01:00:00Z')); // 2026-11-26 08:00 UTC+7
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mocks.getCoaches.mockResolvedValue([{ id: 1, fullName: 'HLV A', specialization: 'Gym' }]);
    mocks.getMyCoachBookings.mockResolvedValue([]);
    mocks.getMemberQuotaStatus.mockResolvedValue({ packageName: 'GOLD', remainingQuota: 3 });
    mocks.getAvailableSlots.mockResolvedValue([]);
    try {
      await act(async () => root.render(<MemoryRouter><MemberCoachBookingView /></MemoryRouter>));
      const prev = host.querySelector<HTMLButtonElement>('[aria-label="7 ngày trước"]')!;
      const next = host.querySelector<HTMLButtonElement>('[aria-label="7 ngày sau"]')!;
      expect(prev.disabled).toBe(true);
      const dayNumbers = () => [...host.querySelectorAll<HTMLButtonElement>('button')]
        .filter((b) => /Tháng \d+/.test(b.textContent ?? ''))
        .map((b) => b.textContent);
      expect(dayNumbers()).toHaveLength(7);
      expect(dayNumbers()[0]).toContain('26');
      // Tiến 2 tuần: tới 10/12, vượt quá 10 ngày cũ
      await act(async () => next.click());
      await act(async () => next.click());
      expect(dayNumbers()[0]).toContain('10');
      expect(prev.disabled).toBe(false);
      const dec10 = [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => /10\s*Tháng 12/.test(b.textContent ?? ''))!;
      await act(async () => dec10.click());
      expect(mocks.getAvailableSlots).toHaveBeenLastCalledWith(1, '2026-12-10');
      // Lùi không quá hôm nay
      await act(async () => prev.click());
      await act(async () => prev.click());
      await act(async () => prev.click());
      expect(dayNumbers()[0]).toContain('26');
      expect(prev.disabled).toBe(true);
    } finally {
      await act(async () => root.unmount());
      host.remove();
      vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks();
    }
  });

  it('uses Asia/Ho_Chi_Minh date for startDate even when UTC is still on the previous calendar day', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.useFakeTimers({ toFake: ['Date'] });
    // 2026-11-05T20:00:00Z tương ứng 2026-11-06 03:00:00 theo múi giờ Asia/Ho_Chi_Minh
    vi.setSystemTime(new Date('2026-11-05T20:00:00Z'));
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mocks.getCoaches.mockResolvedValue([{ id: 1, fullName: 'HLV A', specialization: 'Gym' }]);
    mocks.getMyCoachBookings.mockResolvedValue([]);
    mocks.getMemberQuotaStatus.mockResolvedValue({ packageName: 'GOLD', remainingQuota: 3 });
    mocks.getAvailableSlots.mockResolvedValue([]);
    try {
      await act(async () => root.render(<MemoryRouter><MemberCoachBookingView /></MemoryRouter>));
      expect(mocks.getAvailableSlots).toHaveBeenCalledWith(1, '2026-11-06');
    } finally {
      await act(async () => root.unmount());
      host.remove();
      vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks();
    }
  });

  it('refreshes 1:1 booking payment status in real-time when payment is confirmed', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);

    let currentPaymentStatus: 'pending' | 'paid' = 'pending';
    mocks.getCoaches.mockResolvedValue([{ id: 1, fullName: 'HLV Huỳnh Đắc Tài', specialization: 'Gym', defaultHourlyRate: 200000 }]);
    mocks.getAvailableSlots.mockResolvedValue([]);
    mocks.getMemberQuotaStatus.mockResolvedValue({ packageName: 'SILVER', monthlyQuota: 0, usedThisMonth: 0, remainingQuota: 0 });
    mocks.getMyCoachBookings.mockImplementation(async () => [
      {
        id: 201,
        coachId: 1,
        coachName: 'HLV Huỳnh Đắc Tài',
        bookingDate: '2099-11-10',
        startTime: '15:00:00',
        endTime: '15:00:00',
        status: 'confirmed',
        paymentMethod: 'cash',
        paymentStatus: currentPaymentStatus,
        hourlyRate: 200000,
      },
    ]);

    const notificationsChanged = vi.fn();
    window.addEventListener('member-notifications-changed', notificationsChanged);

    try {
      await act(async () => root.render(<MemoryRouter><MemberCoachBookingView /></MemoryRouter>));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(host.textContent).toContain('Chờ thanh toán');

      // Mô phỏng xác nhận thanh toán từ Lễ tân hoặc VNPay/Ví
      currentPaymentStatus = 'paid';
      await act(async () => {
        window.dispatchEvent(new CustomEvent('wallet-updated'));
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(host.textContent).toContain('Đã thanh toán');
      expect(notificationsChanged).toHaveBeenCalled();
    } finally {
      window.removeEventListener('member-notifications-changed', notificationsChanged);
      await act(async () => root.unmount());
      host.remove();
      vi.unstubAllGlobals();
      vi.clearAllMocks();
    }
  });
});

describe('MemberCoachBookingView audit remediation (P1-FE-40, P1-FE-41, P2-FE-55/56/59)', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    setLanguage('vi');
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', ''); } });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open'); } });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    mocks.getCoaches.mockResolvedValue([
      { id: 1, fullName: 'HLV Huỳnh Đắc Tài', specialization: '', defaultHourlyRate: 200000 },
    ]);
    mocks.getAvailableSlots.mockResolvedValue([
      { slotNumber: 4, startTime: '15:15:00', endTime: '17:45:00', available: true, reason: null },
    ]);
    mocks.getMyCoachBookings.mockResolvedValue([]);
    mocks.getMemberQuotaStatus.mockResolvedValue({
      packageName: 'GOLD 3 THÁNG',
      monthlyQuota: 3,
      usedThisMonth: 1,
      remainingQuota: 2,
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    setLanguage('vi');
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('P1-FE-40: shows "Đang diễn ra" and hides Cancel for an in-progress session, and refreshes + invokes onBookingSuccess when selectedCoachId is null', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-26T01:00:00Z')); // 2026-11-26 08:00 UTC+7
    mocks.getCoaches.mockResolvedValue([]); // selectedCoachId === null
    mocks.getMyCoachBookings.mockResolvedValue([
      {
        id: 301,
        coachId: 1,
        coachName: 'HLV An',
        bookingDate: '2026-11-26',
        startTime: '07:00:00',
        endTime: '09:30:00',
        status: 'confirmed',
        paymentMethod: 'package_quota',
        paymentStatus: 'used_quota',
        hourlyRate: 200000,
      },
      {
        id: 302,
        coachId: 1,
        coachName: 'HLV An',
        bookingDate: '2026-11-26',
        startTime: '18:00:00',
        endTime: '20:30:00',
        status: 'confirmed',
        paymentMethod: 'package_quota',
        paymentStatus: 'used_quota',
        hourlyRate: 200000,
      },
    ]);
    mocks.cancelCoachBooking.mockResolvedValue({ id: 302, status: 'cancelled' });
    const onBookingSuccess = vi.fn();

    await act(async () => root.render(<MemoryRouter><MemberCoachBookingView onBookingSuccess={onBookingSuccess} /></MemoryRouter>));

    expect(host.textContent).toContain('Đang diễn ra');
    // Only the future 18:00 session has a Cancel button (using btn-danger btn-sm)
    const cancelBtns = [...host.querySelectorAll<HTMLButtonElement>('button')].filter((b) => b.textContent === 'Hủy lịch hẹn');
    expect(cancelBtns).toHaveLength(1);
    expect(cancelBtns[0].className).toContain('btn-danger');

    await act(async () => cancelBtns[0].click());
    const confirmCancel = [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find((b) => b.textContent === 'Xác nhận Hủy')!;
    await act(async () => confirmCancel.click());

    expect(mocks.cancelCoachBooking).toHaveBeenCalledWith(302, 'Hội viên chủ động hủy');
    expect(mocks.getMyCoachBookings).toHaveBeenCalledTimes(2);
    expect(mocks.getMemberQuotaStatus).toHaveBeenCalledTimes(2);
    expect(onBookingSuccess).toHaveBeenCalledTimes(1);
  });

  it('P1-FE-41 & P2-FE-59: renders / slot units, accurate Gold 10% tier discount in modal, and ArrowDown radio keyboard navigation', async () => {
    await act(async () => root.render(<MemoryRouter><MemberCoachBookingView /></MemoryRouter>));
    expect(host.textContent).toContain('/ slot');
    expect(host.textContent).not.toContain('/ giờ');

    const slot4 = host.querySelector<HTMLButtonElement>('[data-testid="pt-slot-4"]')!;
    await act(async () => slot4.click());

    const modalPrice = host.querySelector('[data-testid="pt-modal-slot-price"]')?.textContent ?? '';
    expect(modalPrice).toContain('180');
    expect(modalPrice).toContain('200');
    expect(modalPrice).toContain('Giảm 10%');
    expect(modalPrice).toContain('/ slot');
    expect(host.textContent).not.toContain('/ buổi');
    expect(host.textContent).not.toContain('Fitness & Cardio');

    const radios = [...host.querySelectorAll<HTMLDivElement>('dialog [role="radio"]')];
    expect(radios).toHaveLength(2);
    expect(radios[0].getAttribute('aria-checked')).toBe('true');
    await act(async () => {
      radios[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(radios[1].getAttribute('aria-checked')).toBe('true');
    await act(async () => {
      radios[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });
    expect(radios[0].getAttribute('aria-checked')).toBe('true');
  });

  it('P2-FE-55 & P2-FE-56: does not misclassify monthlyQuota=1 as Trial, localizes EN cancel modal cleanly, and hides empty state on error', async () => {
    mocks.getMemberQuotaStatus.mockResolvedValue({
      packageName: 'CUSTOM PRO',
      monthlyQuota: 1,
      usedThisMonth: 0,
      remainingQuota: 1,
    });
    mocks.getMyCoachBookings.mockResolvedValue([
      {
        id: 401,
        coachId: 1,
        coachName: 'HLV Huỳnh Đắc Tài',
        bookingDate: '2099-11-26',
        startTime: '07:00:00',
        endTime: '09:30:00',
        status: 'confirmed',
        paymentMethod: 'cash',
        paymentStatus: 'pending',
        hourlyRate: 200000,
        memberName: 'An',
      },
    ]);
    setLanguage('en');
    await act(async () => root.render(<MemoryRouter><MemberCoachBookingView /></MemoryRouter>));

    expect(host.textContent).toContain('CUSTOM PRO');
    expect(host.textContent).not.toContain('3-Day Trial Pass');
    expect(host.textContent).toContain('1:1 session with coach Huỳnh Đắc Tài');

    // Payment modal no longer includes obsolete VietQR transfer memo
    const payDetailsBtn = [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'View payment details')!;
    await act(async () => payDetailsBtn.click());
    expect(host.querySelector('dialog')?.textContent).not.toContain('PT401');
    const closePay = host.querySelector<HTMLButtonElement>('dialog button[aria-label]')!;
    await act(async () => closePay.click());

    // Cancel modal EN copy has clean grammar without "days"
    const cancelBtn = [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Cancel appointment')!;
    await act(async () => cancelBtn.click());
    const cancelModalText = host.querySelector('dialog')?.textContent ?? '';
    expect(cancelModalText).toContain('26/11/2099');
    expect(cancelModalText).not.toContain('days 26/11/2099');
  });

  it('P2-FE-56: error banner shows Retry button & dismiss aria-label and suppresses coach empty state', async () => {
    mocks.getCoaches.mockRejectedValueOnce(new Error('offline'));
    await act(async () => root.render(<MemoryRouter><MemberCoachBookingView /></MemoryRouter>));

    const alert = host.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.querySelector('button[aria-label="Đóng thông báo lỗi"]')).not.toBeNull();
    expect(host.textContent).not.toContain('Chưa có huấn luyện viên nào.');

    const retryBtn = [...alert!.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Thử lại')!;
    await act(async () => retryBtn.click());
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.textContent).toContain('Huỳnh Đắc Tài');
  });
});
