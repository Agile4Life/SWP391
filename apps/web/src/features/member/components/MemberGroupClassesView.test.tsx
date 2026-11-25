import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberGroupClassesView } from './MemberGroupClassesView';
import * as memberClassesApi from '../memberClassesApi';
import * as walletApi from '../../wallet/walletApi';
import * as vnpayApi from '../../payments/vnpayApi';
import { clearNotices, getNotices } from '../../../shared/lib/portalNotices';

vi.mock('../memberClassesApi', () => ({
  getClasses: vi.fn(),
  getMyEnrollments: vi.fn(),
  getMyQuota: vi.fn(),
  checkoutCourse: vi.fn(),
  cancelCourse: vi.fn(),
}));
vi.mock('../../wallet/walletApi', () => ({
  payWithWallet: vi.fn(),
}));
vi.mock('../../payments/vnpayApi', () => ({
  navigateToVnpay: vi.fn(),
}));

describe('MemberGroupClassesView', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    clearNotices();
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
    vi.mocked(memberClassesApi.checkoutCourse).mockResolvedValue({
      enrollmentId: 500,
      paymentId: null,
      classId: 10,
      className: 'Yoga Flow Sáng',
      amount: 0,
      paymentMethod: 'free_quota',
      paymentStatus: 'success',
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  const renderView = async () => {
    await act(async () => root.render(<MemoryRouter><MemberGroupClassesView /></MemoryRouter>));
    await act(async () => { await Promise.resolve(); });
  };

  it('filters courses by discipline chip and registers using free membership quota', async () => {
    await renderView();
    expect(host.querySelectorAll('[data-testid^="member-class-card-"]')).toHaveLength(2);

    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="member-discipline-chip-1"]')!.click());
    expect(host.querySelectorAll('[data-testid^="member-class-card-"]')).toHaveLength(1);
    expect(host.textContent).toContain('Yoga Flow Sáng');

    const registerBtn = [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Đăng ký khóa học')!;
    await act(async () => registerBtn.click());

    const confirmBtn = [...document.querySelectorAll<HTMLButtonElement>('dialog button')].find((b) => b.textContent === 'Đăng ký ngay')!;
    await act(async () => confirmBtn.click());
    await act(async () => { await Promise.resolve(); });

    expect(memberClassesApi.checkoutCourse).toHaveBeenCalledWith(10, 'cash');
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
