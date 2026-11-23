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
  COACH_FILTER_DISCIPLINES,
  matchesCoachDiscipline,
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
    // Completed status
    expect(isSessionCompleted({ bookingDate: '2099-01-01', endTime: '20:00', status: 'completed' })).toBe(true);
    // Cancelled status
    expect(isSessionCompleted({ bookingDate: '2000-01-01', endTime: '10:00', status: 'cancelled' })).toBe(false);
    // Past booking date & time
    expect(isSessionCompleted({ bookingDate: '2020-01-01', endTime: '10:00', status: 'confirmed' })).toBe(true);
    // Far future booking
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

    // Does not double HLV prefix
    expect(host.textContent).toContain('Tập 1:1 cùng HLV Huỳnh Đắc Tài');
    expect(host.textContent).not.toContain('HLV HLV');

    // Upcoming indicators
    expect(host.textContent).toContain('Sắp diễn ra');
    expect(host.textContent).not.toContain('Đánh giá sau khi kết thúc buổi');
    expect(host.textContent).toContain('Hủy lịch hẹn');
    // Review button should not be present
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
    // Session in the past cannot be cancelled
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

describe('MemberCoachBookingView Coach Discipline Sorting & Filtering', () => {
  it('has ALL, Gym, Boxing, Yoga as filter disciplines', () => {
    expect(COACH_FILTER_DISCIPLINES).toEqual(['ALL', 'Gym', 'Boxing', 'Yoga']);
  });

  it('matches coaches by discipline patterns accurately', () => {
    const gymCoach = {
      id: 1,
      fullName: 'Huỳnh Đắc Tài',
      email: 'tai@example.com',
      phone: '0901234567',
      specialization: 'Fitness & Cardio',
      bio: 'Chuyên gia huấn luyện thể hình và phục hồi thể lực.',
      certification: 'NASM',
      avatarUrl: null,
      defaultHourlyRate: 200000,
    };
    const multiCoach = {
      id: 2,
      fullName: 'Nguyễn Minh Quân',
      email: 'quan@example.com',
      phone: '0901234568',
      specialization: 'Yoga & Strength',
      bio: 'HLV 5 nam kinh nghiem',
      certification: 'Yoga Alliance',
      avatarUrl: null,
      defaultHourlyRate: 200000,
    };
    const yogaCoach = {
      id: 3,
      fullName: 'Trần Thị Mỹ Trâm',
      email: 'tram@example.com',
      phone: '0901234569',
      specialization: 'Pilates & Yoga',
      bio: '',
      certification: '',
      avatarUrl: null,
      defaultHourlyRate: 200000,
    };
    const boxingCoach = {
      id: 4,
      fullName: 'Võ Văn Quyền',
      email: 'quyen@example.com',
      phone: '0901234570',
      specialization: 'Boxing & Kickfit',
      bio: 'Võ sĩ boxing chuyên nghiệp',
      certification: '',
      avatarUrl: null,
      defaultHourlyRate: 200000,
    };

    // ALL matches everything
    expect(matchesCoachDiscipline(gymCoach, 'ALL')).toBe(true);
    expect(matchesCoachDiscipline(yogaCoach, 'ALL')).toBe(true);
    expect(matchesCoachDiscipline(boxingCoach, 'ALL')).toBe(true);

    // Gym matching
    expect(matchesCoachDiscipline(gymCoach, 'Gym')).toBe(true);
    expect(matchesCoachDiscipline(multiCoach, 'Gym')).toBe(true);
    expect(matchesCoachDiscipline(yogaCoach, 'Gym')).toBe(false);

    // Yoga matching
    expect(matchesCoachDiscipline(yogaCoach, 'Yoga')).toBe(true);
    expect(matchesCoachDiscipline(multiCoach, 'Yoga')).toBe(true);
    expect(matchesCoachDiscipline(gymCoach, 'Yoga')).toBe(false);

    // Boxing matching
    expect(matchesCoachDiscipline(boxingCoach, 'Boxing')).toBe(true);
    expect(matchesCoachDiscipline(gymCoach, 'Boxing')).toBe(false);
    expect(matchesCoachDiscipline(yogaCoach, 'Boxing')).toBe(false);
  });

  describe('UI Interaction for discipline chips', () => {
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

    it('sorts member PT bookings by day ascending by default and toggles descending', async () => {
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

      const textAsc = host.textContent ?? '';
      expect(textAsc.indexOf('25/11/2026')).toBeLessThan(textAsc.indexOf('26/11/2026'));

      const sortBtn = [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
        b.textContent?.includes('Sắp xếp theo ngày:')
      );
      expect(sortBtn).toBeDefined();

      await act(async () => {
        sortBtn?.click();
      });

      const textDesc = host.textContent ?? '';
      expect(textDesc.indexOf('26/11/2026')).toBeLessThan(textDesc.indexOf('25/11/2026'));
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
      ? [{ startTime: '14:00:00', endTime: '15:00:00', available: true, reason: null }] : []);
    mocks.createCoachBooking.mockResolvedValue({ id: 10, coachId: 1, bookingDate: '2026-11-06', startTime: '14:00:00', endTime: '15:00:00', status: 'CONFIRMED' });
    try {
      await act(async () => root.render(<MemoryRouter><MemberCoachBookingView /></MemoryRouter>));
      const weekly = host.querySelector<HTMLButtonElement>('button[aria-label="Cả tuần (Hàng tuần)"]');
      expect(weekly).toBeNull();
      expect(host.textContent).not.toContain('Cả tuần');
      expect(host.textContent).not.toContain('Hàng tuần');
      expect(host.textContent).not.toContain('Cả tháng');
      expect(host.textContent).not.toContain('Hàng tháng');
      const slot = [...host.querySelectorAll('button')].find(b => b.title.includes('14:00') && b.title.includes('Còn trống'));
      expect(slot).toBeDefined();
      await act(async () => slot!.click());
      const confirm = [...host.querySelectorAll('button')].find(b => b.textContent?.includes('Xác nhận & Đặt lịch'));
      expect(confirm).toBeDefined();
      await act(async () => confirm!.click());
      expect(mocks.createCoachBooking).toHaveBeenCalledWith(expect.objectContaining({
        coachId: 1, bookingDate: '2026-11-06', startTime: '14:00:00', endTime: '15:00:00',
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
    // 2026-11-05T20:00:00Z is 2026-11-06 03:00:00 in Asia/Ho_Chi_Minh
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

      // Simulate payment confirmation from Reception or VNPay/Wallet
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
