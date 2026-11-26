import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MemberCoachBookingView,
} from './MemberCoachBookingView';
import {
  formatCoachName,
  isSessionCompleted,
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

describe('formatCoachName & isSessionCompleted helpers', () => {
  it('formats coach names correctly without duplicate HLV prefixes', () => {
    expect(formatCoachName('HLV Huỳnh Đắc Tài')).toBe('Huỳnh Đắc Tài');
    expect(formatCoachName('hlv Nguyễn Văn A')).toBe('Nguyễn Văn A');
    expect(formatCoachName('Trần Thị B')).toBe('Trần Thị B');
    expect(formatCoachName(null)).toBe('Huấn luyện viên');
  });

  it('determines whether a session has completed based on status and time', () => {
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
          startTime: '14:00:00',
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

      await act(async () => {
        root.render(<MemoryRouter><MemberCoachBookingView /></MemoryRouter>);
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 60));
      });

      const dateInput = host.querySelector<HTMLInputElement>('input[aria-label="Tìm lịch theo ngày"]');
      expect(dateInput).not.toBeNull();
      const historySection = dateInput?.closest('section');
      expect(historySection).not.toBeNull();
      // Chỉ kiểm tra ngày trong lịch sử; vùng chọn lịch mới cũng có thể hiển thị cùng ngày.
      const historyDates = () => Array.from(
        historySection?.querySelectorAll('.row-card__meta > strong:first-child') ?? [],
        date => date.textContent,
      );
      expect(historyDates()).toEqual(['25/11/2026', '26/11/2026']);

      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(dateInput, '2026-11-26');
        dateInput?.dispatchEvent(new Event('input', { bubbles: true }));
        dateInput?.dispatchEvent(new Event('change', { bubbles: true }));
      });

      expect(historyDates()).toEqual(['26/11/2026']);

      const allDaysBtn = [...(historySection?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((b) =>
        b.textContent?.includes('Tất cả ngày')
      );
      expect(allDaysBtn).toBeDefined();

      await act(async () => {
        allDaysBtn?.click();
      });

      expect(historyDates()).toEqual(['25/11/2026', '26/11/2026']);
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
            { slotNumber: 2, startTime: '09:45:00', endTime: '11:15:00', available: false, reason: 'coach_busy' },
            { slotNumber: 3, startTime: '11:30:00', endTime: '14:00:00', available: false, reason: 'member_busy' },
            { slotNumber: 4, startTime: '14:15:00', endTime: '16:45:00', available: true, reason: null },
            { slotNumber: 5, startTime: '17:00:00', endTime: '19:30:00', available: false, reason: 'coach_on_leave' },
          ]
        : []);
      mocks.createCoachBooking.mockResolvedValue({ id: 10, coachId: 1, bookingDate: '2026-11-06', startTime: '14:15:00', endTime: '16:45:00', status: 'CONFIRMED' });
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
        expect(host.textContent).toContain('14:15 – 16:45');
        expect(host.textContent).toContain('Cần đặt trước 2 tiếng');
        expect(host.textContent).toContain('HLV đã có lịch');
        expect(host.textContent).toContain('Bạn đã có lịch trùng');
        expect(host.textContent).toContain('HLV nghỉ phép');
        expect(host.textContent).not.toContain('HLV nghỉ 1 slot sau 3 slot');
        expect(host.textContent).not.toContain('Buổi sáng');
        const slot = host.querySelector<HTMLButtonElement>('[data-testid="pt-slot-4"]');
        expect(slot).not.toBeNull();
        await act(async () => slot!.click());
        expect(host.textContent).toContain('Slot 4 · 14:15 – 16:45');
        const confirm = [...host.querySelectorAll('button')].find(b => b.textContent?.includes('Xác nhận & Đặt lịch'));
        expect(confirm).toBeDefined();
        await act(async () => confirm!.click());
        expect(mocks.createCoachBooking).toHaveBeenCalledWith(expect.objectContaining({
          coachId: 1, bookingDate: '2026-11-06', startTime: '14:15:00', endTime: '16:45:00',
        }));
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
        startTime: '14:00:00',
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
