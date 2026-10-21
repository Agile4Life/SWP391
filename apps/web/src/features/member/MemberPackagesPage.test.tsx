import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberPackagesPage } from './MemberPackagesPage';
import type { MemberSubscription } from './membershipApi';

const api = vi.hoisted(() => ({
  packages: vi.fn(), current: vi.fn(), history: vi.fn(), payments: vi.fn(),
  create: vi.fn(), renew: vi.fn(), upgrade: vi.fn(), requestHold: vi.fn(), cancelPending: vi.fn(), createPayment: vi.fn(),
}));
vi.mock('./membershipApi', () => ({
  getMembershipPackages: api.packages,
  getCurrentMembership: api.current,
  getMembershipHistory: api.history,
  getMyPayments: api.payments,
  createMembershipSubscription: api.create,
  renewMembershipSubscription: api.renew,
  upgradeMembershipSubscription: api.upgrade,
  requestMembershipHold: api.requestHold,
  cancelPendingMembershipSubscription: api.cancelPending,
  createPaymentRequest: api.createPayment,
}));

const membershipPackage = {
  id: 5, name: 'Essential', description: null, price: 500000,
  durationDays: 30, classCreditLimit: null, status: 'active',
};
const higherPackage = {
  id: 6, name: 'VIP Sanctuary', description: null, price: 1500000,
  durationDays: 90, classCreditLimit: null, status: 'active',
};
const lowerPackage = {
  id: 4, name: 'Starter', description: null, price: 250000,
  durationDays: 15, classCreditLimit: 4, status: 'active',
};
const pending = {
  id: 12, memberId: 34, packageId: 5, packageName: 'Essential',
  previousSubscriptionId: null, startDate: '2026-10-16', endDate: '2026-11-16',
  status: 'pending_payment', qrCode: null, createdAt: '2026-10-16T10:00:00',
};
const payment = {
  id: 90, memberId: 34, memberName: null, subscriptionId: 12,
  classEnrollmentId: null, amount: 500000, method: 'bank_transfer',
  status: 'pending', paidAt: null, receivedById: null, receivedByName: null,
  note: null, createdAt: '2026-10-16T10:01:00', invoiceNumber: null,
};

describe('SCRUM-86 packages', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    Object.values(api).forEach((mock) => mock.mockReset());
    api.packages.mockResolvedValue([membershipPackage]);
    api.current.mockResolvedValue(null);
    api.history.mockResolvedValue([]);
    api.payments.mockResolvedValue([]);
    api.create.mockResolvedValue(pending);
    api.createPayment.mockResolvedValue(payment);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });

  async function render() {
    await act(async () => root.render(<MemberPackagesPage />));
  }

  function button(label: string) {
    return [...host.querySelectorAll('button')].find((item) => item.textContent?.trim() === label);
  }

  const active = { ...pending, id: 1, status: 'active', endDate: '2099-11-17' };
  const renewal = { ...pending, id: 5, previousSubscriptionId: 1, status: 'active',
    startDate: '2099-11-18', endDate: '2099-12-18' };

  it('allows an active subscription without a successor to renew only once', async () => {
    api.current.mockResolvedValue(active);
    api.history.mockResolvedValue([active]);
    api.renew.mockResolvedValue({ ...renewal, status: 'pending_payment' });
    await render();
    expect(button('Gia hạn')?.disabled).toBe(false);
    await act(async () => {
      button('Gia hạn')?.click();
      button('Gia hạn')?.click();
    });
    expect(api.renew).toHaveBeenCalledExactlyOnceWith(1);
    expect(api.create).not.toHaveBeenCalled();
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('Gia hạn gói tập');
  });

  it('allows an active subscription to upgrade to a higher package and blocks lower packages', async () => {
    const upgradePending = {
      ...pending,
      id: 18,
      packageId: 6,
      packageName: 'VIP Sanctuary',
      previousSubscriptionId: 1,
      status: 'pending_payment',
    };
    api.packages.mockResolvedValue([lowerPackage, membershipPackage, higherPackage]);
    api.current.mockResolvedValue(active);
    api.history.mockResolvedValue([active]);
    api.upgrade.mockResolvedValue(upgradePending);

    await render();

    expect(button('Đang có gói hoạt động')?.disabled).toBe(true);
    expect(button('Gia hạn')?.disabled).toBe(false);
    expect(button('Nâng cấp gói')?.disabled).toBe(false);

    await act(async () => {
      button('Nâng cấp gói')?.click();
    });

    expect(api.upgrade).toHaveBeenCalledExactlyOnceWith(1, 6);
    expect(api.create).not.toHaveBeenCalled();
    expect(api.renew).not.toHaveBeenCalled();
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('Nâng cấp gói tập');
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('VIP Sanctuary');
  });

  it('allows an active member to submit a hold request with a reason', async () => {
    const heldPending = {
      ...active,
      holdStatus: 'PENDING',
      holdReason: 'Đi công tác dài ngày tại Nhật Bản',
    };
    api.current.mockResolvedValue(active);
    api.history.mockResolvedValue([active]);
    api.requestHold.mockResolvedValue(heldPending);

    await render();

    const holdBtn = button('Bảo lưu gói tập');
    expect(holdBtn).toBeDefined();
    expect(holdBtn?.disabled).toBe(false);

    await act(async () => {
      holdBtn?.click();
    });

    const textarea = host.querySelector('#hold-reason-input') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();

    await act(async () => {
      const nativeValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value',
      )?.set;
      nativeValueSetter?.call(textarea, 'Đi công tác dài ngày tại Nhật Bản');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      button('Gửi yêu cầu bảo lưu')?.click();
    });

    expect(api.requestHold).toHaveBeenCalledExactlyOnceWith(1, 'Đi công tác dài ngày tại Nhật Bản');
    expect(host.textContent).toContain('Đang chờ Lễ tân xử lý yêu cầu bảo lưu');
    expect(button('Đang chờ duyệt bảo lưu')?.disabled).toBe(true);
  });

  it.each(['active', 'pending_payment'])('blocks a %s successor restored from history without submitting renewal', async (status) => {
    api.current.mockResolvedValue(active);
    api.history.mockResolvedValue([active, { ...renewal, status }]);
    await render();
    const action = button('Đã gia hạn')!;
    expect(action?.disabled).toBe(true);
    await act(async () => action.click());
    expect(api.renew).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('warns about multiple valid successors of the same subscription', async () => {
    api.current.mockResolvedValue(active);
    api.history.mockResolvedValue([active, renewal, { ...renewal, id: 9 }, { ...renewal, id: 10 }]);
    await render();
    expect(button('Cần kiểm tra gia hạn')?.disabled).toBe(true);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('nhiều lượt gia hạn');
    expect(api.renew).not.toHaveBeenCalled();
  });

  it.each(['cancelled', 'expired'])('does not treat a %s child as a blocking successor', async (status) => {
    api.current.mockResolvedValue(active);
    api.history.mockResolvedValue([active, { ...renewal, status }]);
    await render();
    expect(button('Gia hạn')?.disabled).toBe(false);
  });

  it('does not confuse another subscription successor with the selected source', async () => {
    api.current.mockResolvedValue(active);
    api.history.mockResolvedValue([active, { ...renewal, previousSubscriptionId: 99, packageId: 99 }]);
    await render();
    expect(button('Gia hạn')?.disabled).toBe(false);
  });

  it('still purchases a new package when eligible', async () => {
    await render();
    expect(button('Đăng ký lần đầu')?.disabled).toBe(false);
    await act(async () => button('Đăng ký lần đầu')?.click());
    expect(api.create).toHaveBeenCalledExactlyOnceWith(5);
    expect(api.renew).not.toHaveBeenCalled();
  });

  it('blocks renewal while history loads and restores the successor state when it arrives', async () => {
    let resolveHistory!: (items: MemberSubscription[]) => void;
    api.current.mockResolvedValue(active);
    api.history.mockReturnValue(new Promise((resolve) => { resolveHistory = resolve; }));
    await render();
    expect(button('Gia hạn')?.disabled).toBe(true);
    await act(async () => button('Gia hạn')?.click());
    expect(api.renew).not.toHaveBeenCalled();
    await act(async () => resolveHistory([active, renewal]));
    expect(button('Đã gia hạn')?.disabled).toBe(true);
  });

  it('blocks renewal on history failure and verifies it again on retry', async () => {
    api.current.mockResolvedValue(active);
    api.history.mockRejectedValueOnce(new Error('offline')).mockResolvedValue([active, renewal]);
    await render();
    expect(button('Gia hạn')?.disabled).toBe(true);
    expect(host.textContent).toContain('Không thể kiểm tra lịch sử gói');
    await act(async () => button('Gia hạn')?.click());
    expect(api.renew).not.toHaveBeenCalled();
    await act(async () => button('Thử lại')?.click());
    expect(button('Đã gia hạn')?.disabled).toBe(true);
  });

  it('blocks an expired source with a valid future successor', async () => {
    api.history.mockResolvedValue([{ ...active, status: 'expired', endDate: '2020-01-01' }, renewal]);
    await render();
    expect(button('Đã gia hạn')?.disabled).toBe(true);
    expect(api.renew).not.toHaveBeenCalled();
  });

  it('restores renewal protection after remounting the page', async () => {
    api.current.mockResolvedValue(active);
    api.history.mockResolvedValue([active, renewal]);
    await render();
    await act(async () => root.unmount());
    root = createRoot(host);
    await render();
    expect(api.history).toHaveBeenCalledTimes(2);
    expect(button('Đã gia hạn')?.disabled).toBe(true);
    expect(api.renew).not.toHaveBeenCalled();
  });

  it('keeps catalog visible and blocks purchases when history fails', async () => {
    api.history.mockRejectedValue(new Error('offline'));
    await render();
    expect(host.textContent).toContain('Essential');
    expect(host.textContent).toContain('Không thể kiểm tra lịch sử gói');
    expect(button('Đăng ký gói mới')?.disabled).toBe(true);
  });

  it('keeps catalog when payment or current API fails', async () => {
    api.payments.mockRejectedValue(new Error('offline'));
    api.current.mockRejectedValue(new Error('offline'));
    await render();
    expect(host.textContent).toContain('Essential');
    expect(host.textContent).toContain('Không thể kiểm tra thanh toán');
    expect(host.textContent).toContain('Không thể kiểm tra gói hiện tại');
    expect(button('Đăng ký lần đầu')?.disabled).toBe(true);
  });

  it('shows an empty catalog', async () => {
    api.packages.mockResolvedValue([]);
    await render();
    expect(host.textContent).toContain('Chưa có gói tập khả dụng');
  });

  it('keeps current membership visible when catalog fails', async () => {
    api.packages.mockRejectedValue(new Error('offline'));
    api.current.mockResolvedValue({ ...pending, status: 'active' });
    await render();
    expect(host.textContent).toContain('Không thể tải gói tập');
    expect(host.textContent).toContain('Gói hiện tại');
  });

  it('restores a pending subscription without rendering a transfer confirmation button', async () => {
    api.history.mockResolvedValue([pending]);
    await render();
    expect(host.textContent).toContain('Yêu cầu #12');
    expect(host.textContent).toContain('Vui lòng thanh toán trực tiếp tại Quầy Lễ Tân');
    expect(button('Tôi đã chuyển khoản')).toBeUndefined();
    expect(button('Hủy yêu cầu')).toBeDefined();
    expect(host.querySelector('img')).toBeNull();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('allows cancelling a pending subscription request awaiting receptionist confirmation', async () => {
    const cancelledSub = { ...pending, status: 'cancelled' };
    api.history.mockResolvedValue([pending]);
    api.cancelPending.mockResolvedValue(cancelledSub);

    await render();
    expect(host.textContent).toContain('Yêu cầu #12');
    expect(button('Hủy yêu cầu')?.disabled).toBe(false);

    await act(async () => {
      button('Hủy yêu cầu')?.click();
    });

    expect(api.cancelPending).toHaveBeenCalledExactlyOnceWith(12);
    expect(host.textContent).toContain('Đã hủy yêu cầu gói tập #12');
    expect(host.textContent).not.toContain('Thanh toán gói tập • Yêu cầu #12');
  });

  it('does not create a second payment when one is pending for this subscription', async () => {
    api.history.mockResolvedValue([pending]);
    api.payments.mockResolvedValue([{ ...payment, subscriptionId: 88 }, payment]);
    await render();
    expect(host.textContent).toContain('Đã gửi thông báo chuyển khoản. Vui lòng chờ nhân viên xác nhận.');
    expect(host.textContent).not.toContain('Thanh toán thành công');
    expect(button('Tôi đã chuyển khoản')).toBeUndefined();
    expect(api.createPayment).not.toHaveBeenCalled();
  });

  it('does not confuse a different subscription payment with this one', async () => {
    api.history.mockResolvedValue([pending]);
    api.payments.mockResolvedValue([{ ...payment, subscriptionId: 88 }]);
    await render();
    expect(button('Tôi đã chuyển khoản')).toBeUndefined();
    expect(host.textContent).not.toContain('Đã gửi thông báo chuyển khoản');
  });

  it('shows POS payment instructions in the purchase modal without a transfer confirmation button', async () => {
    await render();
    await act(async () => button('Đăng ký lần đầu')?.click());
    const dialog = host.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Essential');
    expect(dialog?.textContent).toContain('500.000');
    expect(dialog?.textContent).toContain('#12');
    expect(dialog?.textContent).toContain('Vui lòng thanh toán trực tiếp tại Quầy Lễ Tân');
    expect(dialog?.textContent).not.toContain('Số tài khoản');
    expect(dialog?.textContent).not.toContain('Tên người nhận');
    expect(dialog?.querySelector('img, canvas')).toBeNull();
    const confirm = [...dialog!.querySelectorAll('button')].find((item) => item.textContent?.includes('Tôi đã chuyển khoản'));
    expect(confirm).toBeUndefined();
    expect(api.createPayment).not.toHaveBeenCalled();
  });

  it('restores an activated subscription only when the backend reports it active', async () => {
    api.current.mockResolvedValue({ ...pending, status: 'active' });
    api.history.mockResolvedValue([{ ...pending, status: 'active' }]);
    api.payments.mockResolvedValue([{ ...payment, status: 'success' }]);
    await render();
    expect(host.textContent).toContain('Gói đã kích hoạt');
    expect(button('Tôi đã chuyển khoản')).toBeUndefined();
    expect(api.createPayment).not.toHaveBeenCalled();
  });

  it('refreshes payments without submitting a new transfer notification', async () => {
    api.history.mockResolvedValue([pending]);
    api.payments.mockResolvedValueOnce([]).mockResolvedValueOnce([payment]);
    await render();
    await act(async () => button('Tải lại trạng thái')?.click());
    expect(api.payments).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('Đã gửi thông báo chuyển khoản');
    expect(button('Tôi đã chuyển khoản')).toBeUndefined();
    expect(api.createPayment).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('keeps payment unverified when refreshing fails and recovers through Retry', async () => {
    api.history.mockResolvedValue([pending]);
    api.payments.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([payment]);
    await render();
    await act(async () => button('Tải lại trạng thái')?.click());
    expect(host.textContent).toContain('Không thể kiểm tra thanh toán');
    expect(button('Tôi đã chuyển khoản')).toBeUndefined();
    await act(async () => button('Thử lại')?.click());
    expect(host.textContent).toContain('Đã gửi thông báo chuyển khoản');
    expect(api.createPayment).not.toHaveBeenCalled();
  });

  it('never displays an active package when payment is success but membership is pending', async () => {
    api.history.mockResolvedValue([pending]);
    api.payments.mockResolvedValue([{ ...payment, status: 'success' }]);
    await render();
    expect(host.textContent).toContain('gói chưa active');
    expect(host.textContent).not.toContain('Gói hiện tại');
  });

  it('does not choose between multiple pending subscriptions', async () => {
    api.history.mockResolvedValue([pending, { ...pending, id: 13 }]);
    await render();
    expect(host.textContent).toContain('Có nhiều yêu cầu đang chờ');
    expect(button('Có yêu cầu đang chờ')?.disabled).toBe(true);
  });

  it('keeps the created subscription after closing the modal', async () => {
    api.history.mockResolvedValueOnce([]).mockResolvedValue([pending]);
    await render();
    await act(async () => button('Đăng ký lần đầu')?.click());
    expect(api.create).toHaveBeenCalledTimes(1);
    await act(async () => button('Đóng')?.click());
    expect(button('Tôi đã chuyển khoản')).toBeUndefined();
    expect(api.createPayment).not.toHaveBeenCalled();
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Yêu cầu #12');
  });

  it('renews the latest expired subscription of the selected package', async () => {
    const older = { ...pending, id: 20, status: 'expired', endDate: '2020-01-01' };
    const latest = { ...pending, id: 21, status: 'expired', endDate: '2021-01-01' };
    api.history.mockResolvedValue([older, latest]);
    api.renew.mockResolvedValue({ ...pending, previousSubscriptionId: 21 });
    await render();
    expect(button('Gia hạn')?.disabled).toBe(false);
    await act(async () => button('Gia hạn')?.click());
    expect(api.renew).toHaveBeenCalledWith(21);
    expect(api.create).not.toHaveBeenCalled();
  });

  it('does not renew from cancelled or pending subscriptions', async () => {
    api.history.mockResolvedValue([{ ...pending, status: 'cancelled' }]);
    await render();
    expect(button('Đăng ký gói mới')?.disabled).toBe(false);
    expect(api.renew).not.toHaveBeenCalled();
  });

  it('blocks an ambiguous expired renewal source', async () => {
    api.history.mockResolvedValue([
      { ...pending, id: 20, status: 'expired', endDate: '2020-01-01' },
      { ...pending, id: 21, status: 'expired', endDate: '2020-01-01' },
    ]);
    await render();
    expect(button('Cần kiểm tra lịch sử')?.disabled).toBe(true);
    expect(api.renew).not.toHaveBeenCalled();
  });

  it.each(['failed', 'refunded'])('explains a %s payment without offering another POST', async (status) => {
    api.history.mockResolvedValue([pending]);
    api.payments.mockResolvedValue([{ ...payment, status }]);
    await render();
    expect(host.textContent).toContain(status === 'failed' ? 'giao dịch thất bại' : 'đã hoàn tiền');
    expect(button('Tôi đã chuyển khoản')).toBeUndefined();
    expect(api.createPayment).not.toHaveBeenCalled();
  });
});
