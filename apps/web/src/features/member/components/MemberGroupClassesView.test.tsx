import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberGroupClassesView } from './MemberGroupClassesView';
import * as memberClassesApi from '../memberClassesApi';

vi.mock('../memberClassesApi', () => ({
  getClasses: vi.fn(),
  getMyEnrollments: vi.fn(),
  getMyQuota: vi.fn(),
  checkoutCourse: vi.fn(),
  cancelCourse: vi.fn(),
}));

describe('MemberGroupClassesView', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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
        endTime: '08:00:00',
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
        startTime: '18:00:00',
        endTime: '19:00:00',
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
});
