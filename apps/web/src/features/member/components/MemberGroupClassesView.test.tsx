import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberGroupClassesView } from './MemberGroupClassesView';
import * as memberClassesApi from '../memberClassesApi';
import * as walletApi from '../../wallet/walletApi';
import * as vnpayApi from '../../payments/vnpayApi';
import { clearNotices, getNotices } from '../../../shared/lib/portalNotices';
import { ApiError } from '../../../shared/api/client';

vi.mock('../memberClassesApi', () => ({
  getClasses: vi.fn(),
  getMyEnrollments: vi.fn(),
  getMyQuota: vi.fn(),
  enrollCourse: vi.fn(),
  checkoutCourse: vi.fn(),
  cancelCourse: vi.fn(),
}));
vi.mock('../../wallet/walletApi', () => ({
  payWithWallet: vi.fn(),
}));
vi.mock('../../payments/vnpayApi', () => ({
  navigateToVnpay: vi.fn(),
}));

function LocationSpy({ onChange }: { onChange: (search: string) => void }) {
  const location = useLocation();
  onChange(location.search);
  return null;
}

describe('MemberGroupClassesView', () => {
  let host: HTMLDivElement;
  let root: Root;
  let latestSearch = '';

  beforeEach(() => {
    clearNotices();
    latestSearch = '';
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', ''); } });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open'); } });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    vi.mocked(memberClassesApi.getClasses).mockResolvedValue([
      {
        id: 10,
        name: 'Yoga Flow Sáng',
        disciplineId: 1,
        disciplineName: 'Yoga',
        coachId: 5,
        coachName: 'HLV Lan',
        roomId: 2,
        roomName: 'Studio A',
        capacity: 20,
        level: 'all',
        description: 'Giãn cơ buổi sáng',
        status: 'active',
        price: 200000,
        startDate: '2099-02-01',
        endDate: '2099-02-28',
        recurringDays: 'MONDAY,WEDNESDAY',
        startTime: '07:00:00',
        endTime: '09:30:00',
      },
      {
        id: 11,
        name: 'Boxing Tối',
        disciplineId: 2,
        disciplineName: 'Boxing',
        coachId: 6,
        coachName: 'HLV Hùng',
        roomId: 3,
        roomName: 'Ring 1',
        capacity: 15,
        level: 'beginner',
        description: null,
        status: 'active',
        price: 250000,
        startDate: '2099-02-05',
        endDate: '2099-02-28',
        recurringDays: 'TUESDAY,THURSDAY',
        startTime: '17:00:00',
        endTime: '19:30:00',
      },
    ]);
    vi.mocked(memberClassesApi.getMyEnrollments).mockResolvedValue([]);
    vi.mocked(memberClassesApi.getMyQuota).mockResolvedValue({
      tier: 'GOLD',
      totalCredits: 3,
      usedCredits: 1,
      remainingCredits: 2,
      unlimited: false,
      discountPercent: 10,
    });
    vi.mocked(memberClassesApi.enrollCourse).mockResolvedValue({
      id: 500,
      classId: 10,
      className: 'Yoga Flow Sáng',
      memberId: 1,
      sessionId: null,
      sessionDate: null,
      startTime: null,
      endTime: null,
      status: 'booked',
      enrolledAt: '2099-01-01T10:00:00',
      cancelledAt: null,
      cancelReason: null,
    });
    vi.mocked(memberClassesApi.checkoutCourse).mockResolvedValue({
      enrollmentId: 500,
      paymentId: null,
      classId: 10,
      className: 'Yoga Flow Sáng',
      amount: 0,
      paymentMethod: 'free_quota',
      paymentStatus: 'success',
    });
    vi.mocked(memberClassesApi.cancelCourse).mockResolvedValue({
      id: 500,
      classId: 10,
      className: 'Yoga Flow Sáng',
      memberId: 1,
      sessionId: null,
      sessionDate: null,
      startTime: null,
      endTime: null,
      status: 'cancelled',
      enrolledAt: '2099-01-01T10:00:00',
      cancelledAt: '2099-01-02T10:00:00',
      cancelReason: null,
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  const renderView = async (initialEntries = ['/member/classes?tab=classes']) => {
    await act(async () => root.render(
      <MemoryRouter initialEntries={initialEntries}>
        <LocationSpy onChange={(s) => { latestSearch = s; }} />
        <MemberGroupClassesView />
      </MemoryRouter>,
    ));
    await act(async () => { await Promise.resolve(); });
  };

  it('P1-FE-31 & P2-FE-57: filters by discipline chip, syncs ?discipline=, and calls enrollCourse for free credits', async () => {
    await renderView();
    expect(host.querySelectorAll('[data-testid^="member-class-card-"]')).toHaveLength(2);

    // P1-FE-38: no thick borderLeft; uses subtle discipline dot next to discipline name
    const card10 = host.querySelector<HTMLElement>('[data-testid="member-class-card-10"]')!;
    expect(card10.style.borderLeft).toBe('');
    expect(card10.querySelector('.class-discipline-dot')).not.toBeNull();

    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="member-discipline-chip-1"]')!.click());
    expect(host.querySelectorAll('[data-testid^="member-class-card-"]')).toHaveLength(1);
    expect(host.textContent).toContain('Yoga Flow Sáng');
    expect(new URLSearchParams(latestSearch).get('discipline')).toBe('Yoga');

    const registerBtn = [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Đăng ký khóa học')!;
    await act(async () => registerBtn.click());

    const confirmBtn = [...document.querySelectorAll<HTMLButtonElement>('dialog button')].find((b) => b.textContent === 'Đăng ký ngay')!;
    await act(async () => confirmBtn.click());
    await act(async () => { await Promise.resolve(); });

    expect(memberClassesApi.enrollCourse).toHaveBeenCalledWith(10);
    expect(memberClassesApi.checkoutCourse).not.toHaveBeenCalled();
    expect(getNotices()[0]?.type).toBe('success');
    expect(getNotices()[0]?.translation).toBeDefined();
  });

  it('P1-FE-31: surfaces 403 SCHEDULING_COURSE_QUOTA_EXCEEDED cleanly when last free credit was consumed concurrently', async () => {
    vi.mocked(memberClassesApi.enrollCourse).mockRejectedValueOnce(
      new ApiError('Bạn đã sử dụng hết lượt đăng ký khóa học của gói tập.', 403, 'SCHEDULING_COURSE_QUOTA_EXCEEDED'),
    );
    await renderView();
    const card10 = host.querySelector('[data-testid="member-class-card-10"]')!;
    const registerBtn = [...card10.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Đăng ký khóa học')!;
    await act(async () => registerBtn.click());

    const confirmBtn = [...document.querySelectorAll<HTMLButtonElement>('dialog button')].find((b) => b.textContent === 'Đăng ký ngay')!;
    await act(async () => confirmBtn.click());
    await act(async () => { await Promise.resolve(); });

    expect(memberClassesApi.enrollCourse).toHaveBeenCalledWith(10);
    expect(memberClassesApi.checkoutCourse).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('hết lượt đăng ký khóa học');
  });

  it('P1-FE-36: surfaces error alert with Retry and disables enrollment when quota/enrollments fail to load', async () => {
    vi.mocked(memberClassesApi.getMyQuota).mockRejectedValueOnce(new Error('quota unavailable'));
    await renderView();

    const metaAlert = host.querySelector('[data-testid="member-classes-meta-error"]');
    expect(metaAlert).not.toBeNull();
    const registerBtns = [...host.querySelectorAll<HTMLButtonElement>('button')].filter((b) => b.textContent === 'Đăng ký khóa học');
    expect(registerBtns.length).toBeGreaterThan(0);
    expect(registerBtns.every((b) => b.disabled)).toBe(true);

    const retryBtn = [...metaAlert!.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Thử lại')!;
    await act(async () => retryBtn.click());
    await act(async () => { await Promise.resolve(); });

    expect(host.querySelector('[data-testid="member-classes-meta-error"]')).toBeNull();
    const enabledBtns = [...host.querySelectorAll<HTMLButtonElement>('button')].filter((b) => b.textContent === 'Đăng ký khóa học');
    expect(enabledBtns.every((b) => !b.disabled)).toBe(true);
  });

  it('P1-FE-36: shows dedicated active-membership-required message and disables registration when quota.tier is null', async () => {
    vi.mocked(memberClassesApi.getMyQuota).mockResolvedValue({
      tier: null,
      totalCredits: 0,
      usedCredits: 0,
      remainingCredits: 0,
      unlimited: false,
      discountPercent: 0,
    });
    await renderView();

    expect(host.textContent).toContain('Bạn chưa có gói tập đang hoạt động');
    expect(host.textContent).not.toContain('vẫn có thể đăng ký thêm có phí');
    const registerBtns = [...host.querySelectorAll<HTMLButtonElement>('button')].filter((b) => b.textContent === 'Đăng ký khóa học');
    expect(registerBtns.every((b) => b.disabled)).toBe(true);
  });

  it('P1-FE-37: allows same-day opening registration (startDate === today) while blocking cancellation on opening day and closing past courses', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-26T02:00:00Z')); // 2026-11-26 09:00 UTC+7
    vi.mocked(memberClassesApi.getClasses).mockResolvedValue([
      {
        id: 21,
        name: 'Yoga Khai Giảng Hôm Nay',
        disciplineId: 1,
        disciplineName: 'Yoga',
        coachId: 5,
        coachName: 'HLV Lan',
        roomId: 2,
        roomName: 'Studio A',
        capacity: 20,
        level: 'all',
        description: null,
        status: 'active',
        price: 200000,
        startDate: '2026-11-26',
        endDate: '2026-12-26',
        recurringDays: 'THURSDAY',
        startTime: '17:00:00',
        endTime: '19:30:00',
      },
      {
        id: 22,
        name: 'Boxing Đã Khai Giảng',
        disciplineId: 2,
        disciplineName: 'Boxing',
        coachId: 6,
        coachName: 'HLV Hùng',
        roomId: 3,
        roomName: 'Ring 1',
        capacity: 15,
        level: 'beginner',
        description: null,
        status: 'active',
        price: 200000,
        startDate: '2026-11-25',
        endDate: '2026-12-25',
        recurringDays: 'WEDNESDAY',
        startTime: '17:00:00',
        endTime: '19:30:00',
      },
      {
        id: 23,
        name: 'Gym Đã Đăng Ký Khai Giảng Hôm Nay',
        disciplineId: 3,
        disciplineName: 'Gym',
        coachId: 7,
        coachName: 'HLV Minh',
        roomId: 1,
        roomName: 'Gym VIP',
        capacity: 15,
        level: 'all',
        description: null,
        status: 'active',
        price: 200000,
        startDate: '2026-11-26',
        endDate: '2026-12-26',
        recurringDays: 'THURSDAY',
        startTime: '09:45:00',
        endTime: '11:15:00',
      },
    ]);
    vi.mocked(memberClassesApi.getMyEnrollments).mockResolvedValue([
      {
        id: 801,
        classId: 23,
        className: 'Gym Đã Đăng Ký Khai Giảng Hôm Nay',
        memberId: 1,
        sessionId: null,
        sessionDate: null,
        startTime: null,
        endTime: null,
        status: 'booked',
        enrolledAt: '2026-11-20T10:00:00',
        cancelledAt: null,
        cancelReason: null,
      },
    ]);

    await renderView();

    const todayCard = host.querySelector('[data-testid="member-class-card-21"]')!;
    const todayBtn = [...todayCard.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Đăng ký khóa học')!;
    expect(todayBtn.disabled).toBe(false);
    expect(todayCard.textContent).toContain('Khai giảng hôm nay');

    const pastCard = host.querySelector('[data-testid="member-class-card-22"]')!;
    const pastBtn = [...pastCard.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Đăng ký khóa học')!;
    expect(pastBtn.disabled).toBe(true);
    expect(pastCard.textContent).toContain('Đã khai giảng');

    const enrolledTodayCard = host.querySelector('[data-testid="member-class-card-23"]')!;
    expect(enrolledTodayCard.textContent).toContain('Khóa đã bắt đầu');
    expect([...enrolledTodayCard.querySelectorAll('button')].some((b) => b.textContent === 'Hủy đăng ký')).toBe(false);
  });

  it('P2-E2E-02: cancels an enrolled upcoming course after confirmation and refreshes state', async () => {
    vi.mocked(memberClassesApi.getMyEnrollments).mockResolvedValueOnce([
      {
        id: 500,
        classId: 10,
        className: 'Yoga Flow Sáng',
        memberId: 1,
        sessionId: null,
        sessionDate: null,
        startTime: null,
        endTime: null,
        status: 'booked',
        enrolledAt: '2099-01-01T10:00:00',
        cancelledAt: null,
        cancelReason: null,
      },
    ]);
    await renderView();

    const card10 = host.querySelector('[data-testid="member-class-card-10"]')!;
    const cancelBtn = [...card10.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Hủy đăng ký')!;
    await act(async () => cancelBtn.click());

    const confirmCancelBtn = [...document.querySelectorAll<HTMLButtonElement>('dialog button')].find((b) => b.textContent === 'Xác nhận hủy')!;
    await act(async () => confirmCancelBtn.click());
    await act(async () => { await Promise.resolve(); });

    expect(memberClassesApi.cancelCourse).toHaveBeenCalledWith(10);
    expect(getNotices()[0]?.type).toBe('success');
  });

  it('P2-E2E-02: renders main error state with Retry when getClasses fails and recovers cleanly', async () => {
    vi.mocked(memberClassesApi.getClasses).mockRejectedValueOnce(new TypeError('network down'));
    await renderView();

    const alert = host.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('Không thể tải danh sách lớp học');
    const retryBtn = [...alert!.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Thử lại')!;
    await act(async () => retryBtn.click());
    await act(async () => { await Promise.resolve(); });

    expect(host.querySelectorAll('[data-testid^="member-class-card-"]')).toHaveLength(2);
  });

  it('P2-FE-57: disables all other enroll buttons while one course enrollment is in flight', async () => {
    let resolveEnroll!: (value: memberClassesApi.EnrollmentDto) => void;
    vi.mocked(memberClassesApi.enrollCourse).mockImplementationOnce(
      () => new Promise((resolve) => { resolveEnroll = resolve; }),
    );
    await renderView();

    const card10 = host.querySelector('[data-testid="member-class-card-10"]')!;
    const card11 = host.querySelector('[data-testid="member-class-card-11"]')!;
    const register10 = [...card10.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Đăng ký khóa học')!;
    await act(async () => register10.click());
    const confirmBtn = [...document.querySelectorAll<HTMLButtonElement>('dialog button')].find((b) => b.textContent === 'Đăng ký ngay')!;
    await act(async () => { confirmBtn.click(); });

    const register11 = [...card11.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Đăng ký khóa học')!;
    expect(register11.disabled).toBe(true);

    await act(async () => {
      resolveEnroll({
        id: 505,
        classId: 10,
        className: 'Yoga Flow Sáng',
        memberId: 1,
        sessionId: null,
        sessionDate: null,
        startTime: null,
        endTime: null,
        status: 'booked',
        enrolledAt: '2099-01-01T10:00:00',
        cancelledAt: null,
        cancelReason: null,
      });
    });
  });

  it('opens paid checkout modal with Wallet, VNPay and Cash at reception when free credits are 0', async () => {
    vi.mocked(memberClassesApi.getMyQuota).mockResolvedValue({
      tier: 'GOLD',
      totalCredits: 3,
      usedCredits: 3,
      remainingCredits: 0,
      unlimited: false,
      discountPercent: 10,
    });
    await renderView();

    const card10 = host.querySelector('[data-testid="member-class-card-10"]')!;
    const registerBtn = [...card10.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Đăng ký khóa học')!;
    await act(async () => registerBtn.click());

    const dialog = host.querySelector('dialog')!;
    expect(dialog.textContent).toContain('Ví điện tử SÖL');
    expect(dialog.textContent).toContain('VNPay');
    expect(dialog.textContent).toContain('Tiền mặt tại quầy lễ tân');
    // Giá gốc 200.000đ giảm 10% hạng Gold = 180.000đ
    expect(dialog.textContent).toContain('180');
  });

  it('P0-02: settles pending online_wallet course payment via payWithWallet and dispatches wallet & notification events', async () => {
    vi.mocked(memberClassesApi.getMyQuota).mockResolvedValue({
      tier: 'GOLD',
      totalCredits: 3,
      usedCredits: 3,
      remainingCredits: 0,
      unlimited: false,
      discountPercent: 10,
    });
    vi.mocked(memberClassesApi.checkoutCourse).mockResolvedValue({
      enrollmentId: 501,
      paymentId: 777,
      classId: 10,
      className: 'Yoga Flow Sáng',
      amount: 180000,
      paymentMethod: 'online_wallet',
      paymentStatus: 'pending',
    });
    vi.mocked(walletApi.payWithWallet).mockResolvedValue({
      balance: 320000,
      updatedAt: '2099-01-01T10:00:00',
      transactions: [],
    });

    const walletEvents = vi.fn();
    const notifEvents = vi.fn();
    window.addEventListener('wallet-updated', walletEvents);
    window.addEventListener('member-notifications-changed', notifEvents);

    try {
      await renderView();
      const card10 = host.querySelector('[data-testid="member-class-card-10"]')!;
      const registerBtn = [...card10.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Đăng ký khóa học')!;
      await act(async () => registerBtn.click());

      const confirmBtn = [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find((b) => b.textContent === 'Xác nhận đăng ký')!;
      await act(async () => confirmBtn.click());
      await act(async () => { await Promise.resolve(); });

      expect(memberClassesApi.checkoutCourse).toHaveBeenCalledWith(10, 'online_wallet');
      expect(walletApi.payWithWallet).toHaveBeenCalledWith({ paymentId: 777 });
      expect(walletEvents).toHaveBeenCalledTimes(1);
      expect(notifEvents).toHaveBeenCalledTimes(1);
      expect(getNotices()[0]?.type).toBe('success');
    } finally {
      window.removeEventListener('wallet-updated', walletEvents);
      window.removeEventListener('member-notifications-changed', notifEvents);
    }
  });

  it('P0-02: dispatches wallet & notification events without redundant payWithWallet call when backend settles inline', async () => {
    vi.mocked(memberClassesApi.getMyQuota).mockResolvedValue({
      tier: 'GOLD',
      totalCredits: 3,
      usedCredits: 3,
      remainingCredits: 0,
      unlimited: false,
      discountPercent: 0,
    });
    vi.mocked(memberClassesApi.checkoutCourse).mockResolvedValue({
      enrollmentId: 502,
      paymentId: 778,
      classId: 10,
      className: 'Yoga Flow Sáng',
      amount: 200000,
      paymentMethod: 'online_wallet',
      paymentStatus: 'success',
    });

    const walletEvents = vi.fn();
    const notifEvents = vi.fn();
    window.addEventListener('wallet-updated', walletEvents);
    window.addEventListener('member-notifications-changed', notifEvents);

    try {
      await renderView();
      const card10 = host.querySelector('[data-testid="member-class-card-10"]')!;
      const registerBtn = [...card10.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Đăng ký khóa học')!;
      await act(async () => registerBtn.click());

      const confirmBtn = [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find((b) => b.textContent === 'Xác nhận đăng ký')!;
      await act(async () => confirmBtn.click());
      await act(async () => { await Promise.resolve(); });

      expect(walletApi.payWithWallet).not.toHaveBeenCalled();
      expect(walletEvents).toHaveBeenCalledTimes(1);
      expect(notifEvents).toHaveBeenCalledTimes(1);
      expect(getNotices()[0]?.type).toBe('success');
    } finally {
      window.removeEventListener('wallet-updated', walletEvents);
      window.removeEventListener('member-notifications-changed', notifEvents);
    }
  });

  it('P0-02: shows warning/error alert directing member to /member/invoices instead of success toast when VNPay URL is missing', async () => {
    vi.mocked(memberClassesApi.getMyQuota).mockResolvedValue({
      tier: 'GOLD',
      totalCredits: 3,
      usedCredits: 3,
      remainingCredits: 0,
      unlimited: false,
      discountPercent: 0,
    });
    vi.mocked(memberClassesApi.checkoutCourse).mockResolvedValue({
      enrollmentId: 503,
      paymentId: 779,
      classId: 10,
      className: 'Yoga Flow Sáng',
      amount: 200000,
      paymentMethod: 'vnpay',
      paymentStatus: 'pending',
      paymentUrl: null,
    });

    await renderView();
    const card10 = host.querySelector('[data-testid="member-class-card-10"]')!;
    const registerBtn = [...card10.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Đăng ký khóa học')!;
    await act(async () => registerBtn.click());

    const vnpayRadio = [...host.querySelectorAll<HTMLButtonElement>('dialog [role="radio"]')].find((b) => b.textContent === 'VNPay')!;
    await act(async () => vnpayRadio.click());

    const confirmBtn = [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find((b) => b.textContent === 'Xác nhận đăng ký')!;
    await act(async () => confirmBtn.click());
    await act(async () => { await Promise.resolve(); });

    expect(vnpayApi.navigateToVnpay).not.toHaveBeenCalled();
    expect(getNotices().some((n) => n.type === 'success')).toBe(false);
    expect(getNotices()[0]?.type).toBe('error');
    expect(getNotices()[0]?.destination).toBe('/member/invoices');

    const alert = host.querySelector('[data-testid="vnpay-missing-url-alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.querySelector('a')?.getAttribute('href')).toBe('/member/invoices');
  });
});
