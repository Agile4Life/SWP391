import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberPackagesPage } from './MemberPackagesPage';

const api = vi.hoisted(() => ({
  packages: vi.fn(), current: vi.fn(), history: vi.fn(), payments: vi.fn(),
  create: vi.fn(), renew: vi.fn(), createPayment: vi.fn(),
}));
vi.mock('./membershipApi', () => ({
  getMembershipPackages: api.packages,
  getCurrentMembership: api.current,
  getMembershipHistory: api.history,
  getMyPayments: api.payments,
  createMembershipSubscription: api.create,
  renewMembershipSubscription: api.renew,
  createPaymentRequest: api.createPayment,
}));

const membershipPackage = {
  id: 5, name: 'Essential', description: null, price: 500000,
  durationDays: 30, classCreditLimit: null, status: 'active',
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

  it('restores a pending subscription after reload and offers a payment request', async () => {
    api.history.mockResolvedValue([pending]);
    await render();
    expect(host.textContent).toContain('Yêu cầu #12');
    expect(button('Gửi yêu cầu thanh toán')?.disabled).toBe(false);
    expect(api.create).not.toHaveBeenCalled();
  });

  it('does not create a second payment when one is pending for this subscription', async () => {
    api.history.mockResolvedValue([pending]);
    api.payments.mockResolvedValue([{ ...payment, subscriptionId: 88 }, payment]);
    await render();
    expect(host.textContent).toContain('Đã gửi yêu cầu thanh toán');
    expect(button('Gửi yêu cầu thanh toán')).toBeUndefined();
  });

  it('does not confuse a different subscription payment with this one', async () => {
    api.history.mockResolvedValue([pending]);
    api.payments.mockResolvedValue([{ ...payment, subscriptionId: 88 }]);
    await render();
    expect(button('Gửi yêu cầu thanh toán')?.disabled).toBe(false);
  });

  it('submits only one payment for repeated clicks', async () => {
    api.history.mockResolvedValue([pending]);
    let finish!: (value: typeof payment) => void;
    api.createPayment.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await render();
    await act(async () => {
      button('Gửi yêu cầu thanh toán')?.click();
      button('Gửi yêu cầu thanh toán')?.click();
    });
    expect(api.createPayment).toHaveBeenCalledTimes(1);
    await act(async () => finish(payment));
  });

  it('keeps a successful POST response when the immediate payment list is stale', async () => {
    api.history.mockResolvedValue([pending]);
    api.payments.mockResolvedValue([]);
    await render();
    await act(async () => button('Gửi yêu cầu thanh toán')?.click());
    expect(host.textContent).toContain('Đã gửi yêu cầu thanh toán');
    expect(button('Gửi yêu cầu thanh toán')).toBeUndefined();
  });

  it('shows backend rejection without activating membership', async () => {
    api.history.mockResolvedValue([pending]);
    api.createPayment.mockRejectedValue({ status: 409, code: 'PAYMENT_AMOUNT_MISMATCH', message: 'Giá không khớp' });
    await render();
    await act(async () => button('Gửi yêu cầu thanh toán')?.click());
    expect(host.textContent).toContain('Không thể gửi yêu cầu thanh toán.');
    expect(host.textContent).not.toContain('Gói hiện tại');
  });

  it('rechecks payments after a failed POST before allowing Retry', async () => {
    api.history.mockResolvedValue([pending]);
    api.createPayment.mockRejectedValue(new Error('Mất kết nối'));
    api.payments.mockResolvedValueOnce([]).mockResolvedValueOnce([payment]);
    await render();
    await act(async () => button('Gửi yêu cầu thanh toán')?.click());
    expect(api.payments).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('Đã gửi yêu cầu thanh toán');
    expect(button('Gửi yêu cầu thanh toán')).toBeUndefined();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('keeps payment unverified when the recheck also fails', async () => {
    api.history.mockResolvedValue([pending]);
    api.createPayment.mockRejectedValue(new Error('Mất kết nối'));
    api.payments.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('offline'));
    await render();
    await act(async () => button('Gửi yêu cầu thanh toán')?.click());
    expect(host.textContent).toContain('Không thể kiểm tra thanh toán');
    expect(button('Gửi yêu cầu thanh toán')).toBeUndefined();
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

  it('keeps the created subscription when payment creation fails', async () => {
    api.history.mockResolvedValueOnce([]).mockResolvedValue([pending]);
    api.createPayment.mockRejectedValue(new Error('offline'));
    await render();
    await act(async () => button('Đăng ký lần đầu')?.click());
    expect(api.create).toHaveBeenCalledTimes(1);
    await act(async () => button('Đóng')?.click());
    await act(async () => button('Gửi yêu cầu thanh toán')?.click());
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
    expect(button('Gửi yêu cầu thanh toán')).toBeUndefined();
  });
});
