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

  it('restores a pending subscription without allowing transfer confirmation before configuration', async () => {
    api.history.mockResolvedValue([pending]);
    await render();
    expect(host.textContent).toContain('Yêu cầu #12');
    expect(host.textContent).toContain('Chưa cấu hình thông tin thanh toán');
    expect(button('Tôi đã chuyển khoản')?.disabled).toBe(true);
    expect(host.querySelector('img')).toBeNull();
    expect(api.create).not.toHaveBeenCalled();
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
    expect(button('Tôi đã chuyển khoản')?.disabled).toBe(true);
    expect(host.textContent).not.toContain('Đã gửi thông báo chuyển khoản');
  });

  it('does not submit a payment for repeated clicks without transfer instructions', async () => {
    api.history.mockResolvedValue([pending]);
    await render();
    await act(async () => {
      button('Tôi đã chuyển khoản')?.click();
      button('Tôi đã chuyển khoản')?.click();
    });
    expect(api.createPayment).not.toHaveBeenCalled();
  });

  it('shows missing instructions in the purchase modal without invented bank details or QR', async () => {
    await render();
    await act(async () => button('Đăng ký lần đầu')?.click());
    const dialog = host.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Essential');
    expect(dialog?.textContent).toContain('500.000');
    expect(dialog?.textContent).toContain('#12');
    expect(dialog?.textContent).toContain('Chưa cấu hình thông tin thanh toán');
    expect(dialog?.textContent).not.toContain('Số tài khoản');
    expect(dialog?.textContent).not.toContain('Tên người nhận');
    expect(dialog?.querySelector('img, canvas')).toBeNull();
    const confirm = [...dialog!.querySelectorAll('button')].find((item) => item.textContent?.includes('Tôi đã chuyển khoản'));
    expect(confirm?.disabled).toBe(true);
    await act(async () => confirm?.click());
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

  it('keeps the created subscription while transfer instructions are unavailable', async () => {
    api.history.mockResolvedValueOnce([]).mockResolvedValue([pending]);
    await render();
    await act(async () => button('Đăng ký lần đầu')?.click());
    expect(api.create).toHaveBeenCalledTimes(1);
    await act(async () => button('Đóng')?.click());
    expect(button('Tôi đã chuyển khoản')?.disabled).toBe(true);
    await act(async () => button('Tôi đã chuyển khoản')?.click());
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
