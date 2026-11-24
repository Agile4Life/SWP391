import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { StaffReceptionPage } from './StaffReceptionPage';
import { getCurrentUser } from '../../shared/api/client';
import { checkinApi } from './checkinApi';
import { clearNotices, getNotices } from '../../shared/lib/portalNotices';

const api = vi.hoisted(() => ({
  lookupMembers: vi.fn(), getPendingSubscriptions: vi.fn(), cancelPendingSubscription: vi.fn(), getPendingHoldRequests: vi.fn(),
  getActivePackages: vi.fn(), getRenewalCandidates: vi.fn(), createRenewal: vi.fn(), processPayment: vi.fn(), getPendingReceipt: vi.fn(),
  getUnpaidCoachBookings: vi.fn(), confirmCoachBookingPayment: vi.fn(),
  getPendingTrials: vi.fn(), approveTrial: vi.fn(), rejectTrial: vi.fn(),
  getMemberWallet: vi.fn(), topupMemberWallet: vi.fn(), getRequestHistory: vi.fn(),
}));
vi.mock('./receptionApi', () => ({ receptionApi: api, maskCitizenId: () => '—' }));
vi.mock('../../shared/api/client', () => ({ getCurrentUser: vi.fn() }));
vi.mock('./checkinApi', () => ({ checkinApi: { gateQr: vi.fn() } }));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,gate-qr') } }));
vi.mock('../../shared/ui/toast', () => ({ toast: vi.fn() }));
vi.mock('./PaymentInvoice', () => ({ PaymentInvoice: () => <div>Hóa đơn thực</div> }));

let root: Root;
let host: HTMLDivElement;
const member = { userId: 10, membershipCode: 'MB-10', fullName: 'An', email: 'an@example.test', phone: '1234', status: 'ACTIVE' };
const pkg = { id: 2, name: 'Gold', price: 200, durationDays: 30, status: 'active' };
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.resetAllMocks(); clearNotices();
  api.getRequestHistory.mockResolvedValue([]);
  vi.mocked(getCurrentUser).mockReturnValue({ id: 'staff', name: 'Lễ tân', identifier: 'staff', role: 'STAFF' });
  vi.mocked(checkinApi.gateQr).mockResolvedValue({ qrCode: 'SOL:GATE:1:A1:signed', gateId: 'A1', gate: 'Turnstile A1 - Sảnh Chính',
    generatedAt: '2026-10-29T00:00:00Z', expiresAt: '2026-10-29T00:01:00Z', expiresInSeconds: 60 });
  api.lookupMembers.mockResolvedValue([member]);
  api.getPendingSubscriptions.mockResolvedValue([]);
  api.getPendingHoldRequests.mockResolvedValue([]);
  api.getUnpaidCoachBookings.mockResolvedValue([]);
  api.getActivePackages.mockResolvedValue([pkg]);
  api.getRenewalCandidates.mockResolvedValue([]);
  api.getPendingReceipt.mockResolvedValue(null);
  api.getPendingTrials.mockResolvedValue([]);
  api.getMemberWallet.mockResolvedValue({ balance: 150000 });
  api.topupMemberWallet.mockResolvedValue({ balance: 650000 });
  api.processPayment.mockResolvedValue({ id: 42, memberId: 10, amount: 200, method: 'pos', status: 'success', paidAt: '2026-10-01T10:00:00', invoiceNumber: 'INV-42' });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it.each(['STAFF', 'MANAGER'] as const)('leaves the gate QR to the check-in and check-out tabs for %s', async (role) => {
  vi.mocked(getCurrentUser).mockReturnValue({ id: 'staff', name: 'Lễ tân', identifier: 'staff', role });
  await act(async () => root.render(<StaffReceptionPage />));
  expect(host.querySelector('img[alt="Mã QR cổng check-in"]')).toBeNull();
  expect(checkinApi.gateQr).not.toHaveBeenCalled();
});

it('gathers memberships, 1:1 sessions, trials and holds in one "Cần xử lý" card', async () => {
  await act(async () => root.render(<StaffReceptionPage />));
  const headings = Array.from(host.querySelectorAll('h2, h3')).map((node) => node.textContent ?? '');
  expect(headings.some((text) => text.startsWith('Cần xử lý ('))).toBe(true);
  const card = host.querySelector('.reception-top__queue')!;
  // Không còn tiêu đề từng nhóm: mỗi mục chỉ có một nhãn nhỏ chỉ loại việc.
  expect(card.querySelector('.reception-todo__group')).toBeNull();
  expect(card.querySelector('.reception-todo__empty')!.textContent).toContain('Không có việc nào cần xử lý');
  expect(host.querySelector('[data-testid="request-history"]')).toBeNull();
});

it('keeps the gate QR hidden from members on reception', async () => {
  vi.mocked(getCurrentUser).mockReturnValue({ id: 'member', name: 'Hội viên', identifier: 'member', role: 'MEMBER' });
  await act(async () => root.render(<MemoryRouter><StaffReceptionPage /></MemoryRouter>));
  expect(host.querySelector('[data-testid="reception-forbidden-guard"]')).not.toBeNull();
  expect(host.querySelector('img[alt="Mã QR cổng check-in"]')).toBeNull();
  expect(checkinApi.gateQr).not.toHaveBeenCalled();
});

// Chọn một hội viên trong kết quả tra cứu.
async function selectMember() {
  await act(async () => root.render(<StaffReceptionPage />));
  const input = host.querySelector('input[placeholder^="Nhập Số điện thoại"]') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '1234');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => input.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(api.lookupMembers).toHaveBeenCalledWith('1234');
}

// Chọn phương thức rồi thu tiền.
async function chooseAndPay(value: string) {
  const select = host.querySelector('#pos-package')!.parentElement!.querySelector('select') as HTMLSelectElement;
  expect(Array.from(select.options).map((option) => option.value)).toContain(value);
  await act(async () => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => select.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}

it('shows a lookup failure separately from a successful empty search', async () => {
  api.lookupMembers.mockRejectedValueOnce(new Error('Lookup unavailable'));
  await selectMember();
  expect(host.querySelector('#reception-search-error')?.textContent).toContain('Lookup unavailable');
  expect(host.textContent).not.toContain('Không tìm thấy hội viên');
  api.lookupMembers.mockResolvedValueOnce([]);
  const input = host.querySelector('input[placeholder^="Nhập Số điện thoại"]')!;
  await act(async () => input.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(host.querySelector('#reception-search-error')).toBeNull();
  expect(host.textContent).toContain('Không tìm thấy hội viên');
});

it('does not invent a zero wallet balance on failure and retries the read without making a transaction', async () => {
  api.getMemberWallet.mockRejectedValueOnce(new Error('Wallet unavailable'));
  await selectMember();
  expect(host.textContent).toContain('Không thể tải số dư ví. Vui lòng thử lại.');
  expect(host.querySelector('[data-testid="member-wallet-balance"]')?.textContent).not.toMatch(/0\s*[đ₫]/);
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="open-counter-topup-modal-btn"]')!.click());
  expect(document.body.querySelectorAll('dialog strong')[1]?.textContent).not.toMatch(/0\s*[đ₫]/);
  api.getMemberWallet.mockResolvedValueOnce({ balance: 250000 });
  const retry = [...document.body.querySelectorAll<HTMLButtonElement>('button')].find(b => b.getAttribute('aria-label') === 'Tải lại số dư ví')!;
  await act(async () => retry.click());
  expect(host.querySelector('[data-testid="member-wallet-balance"]')?.textContent).toContain('250.000');
  expect(host.textContent).not.toContain('Không thể tải số dư ví. Vui lòng thử lại.');
  expect(api.topupMemberWallet).not.toHaveBeenCalled();
  expect(api.processPayment).not.toHaveBeenCalled();
});

it('displays a genuine zero balance returned by the wallet API', async () => {
  api.getMemberWallet.mockResolvedValueOnce({ balance: 0 });
  await selectMember();
  expect(host.querySelector('[data-testid="member-wallet-balance"]')?.textContent).toMatch(/0\s*[đ₫]/);
  expect(host.textContent).not.toContain('Không thể tải số dư ví. Vui lòng thử lại.');
});

it.each([
  ['getPendingSubscriptions', 'gói tập chờ thanh toán', 'Tải lại gói tập chờ thanh toán', 'plan'],
  ['getPendingHoldRequests', 'yêu cầu bảo lưu', 'Tải lại yêu cầu bảo lưu', 'hold'],
  ['getPendingTrials', 'yêu cầu dùng thử', 'Tải lại yêu cầu dùng thử', 'trial'],
] as const)('shows %s errors instead of empty queues and clears the error after retry', async (method, label, retryLabel, filter) => {
  api[method].mockRejectedValue(new Error('Offline'));
  await act(async () => root.render(<StaffReceptionPage />));
  const card = host.querySelector('.reception-top__queue')!;
  expect(card.textContent).toContain(`Không thể tải ${label}. Vui lòng thử lại.`);
  expect(card.textContent).not.toContain('Không có việc nào cần xử lý');
  const tabs = { plan: 'Gói tập', hold: 'Bảo lưu', trial: 'Trải nghiệm' };
  const tab = [...card.querySelectorAll<HTMLButtonElement>('.filter-chip')].find(b => b.textContent?.startsWith(tabs[filter]))!;
  await act(async () => tab.click());
  expect(card.textContent).not.toContain('Không có mục nào trong nhóm đã chọn');
  api[method].mockResolvedValue([]);
  const retry = card.querySelector<HTMLButtonElement>(`button[aria-label="${retryLabel}"]`)!;
  await act(async () => retry.click());
  expect(card.textContent).not.toContain(`Không thể tải ${label}`);
  expect(card.textContent).toContain('Không có việc nào cần xử lý');
});

it('keeps successful queue data when another queue fails and when its own refresh fails', async () => {
  const pending = { id: 77, memberId: 10, membershipCode: 'MB-10', memberName: 'An', memberEmail: 'an@example.test',
    memberPhone: '1234', packageId: 2, packageName: 'Gold', durationDays: 30, packagePrice: 200000,
    startDate: '2026-10-01', endDate: '2026-10-30', status: 'pending_payment', createdAt: '2026-10-01' };
  api.getPendingSubscriptions.mockResolvedValueOnce([pending]).mockRejectedValue(new Error('Offline'));
  api.getPendingTrials.mockRejectedValue(new Error('Offline'));
  await act(async () => root.render(<StaffReceptionPage />));
  const card = host.querySelector('.reception-top__queue')!;
  expect(card.textContent).toContain('Yêu cầu #77');
  // Refresh nền thất bại phải giữ bản ghi cũ và báo lỗi, không đổi thành danh sách rỗng.
  await act(async () => window.dispatchEvent(new Event('online')));
  expect(card.textContent).toContain('Yêu cầu #77');
  expect(card.textContent).toContain('Không thể tải gói tập chờ thanh toán');
  expect(card.textContent).toContain('Không thể tải yêu cầu dùng thử');
});

it('sells an active package at the counter for a member without a pending order', async () => {
  await selectMember();
  await chooseAndPay('buy:2');
  expect(api.processPayment).toHaveBeenCalledWith(expect.objectContaining({ memberId: 10, packageId: 2, amount: 200 }));
  expect(api.createRenewal).not.toHaveBeenCalled();
  expect(getNotices()[0].destination).toBe('/staff/reception-history');
  expect(host.textContent).toContain('Hóa đơn thực');
});

it('blocks payment for the previous member while another member lookup is pending', async () => {
  await selectMember();
  const packageSelect = host.querySelector('#pos-package')!.parentElement!.querySelector('select') as HTMLSelectElement;
  await act(async () => { packageSelect.value = 'buy:2'; packageSelect.dispatchEvent(new Event('change', { bubbles: true })); });
  const paymentForm = packageSelect.closest('form')!;
  let finishSearch!: (members: (typeof member)[]) => void;
  api.lookupMembers.mockReturnValueOnce(new Promise(resolve => { finishSearch = resolve; }));
  const search = host.querySelector('input[placeholder^="Nhập Số điện thoại"]') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(search, '5678');
    search.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => search.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

  await act(async () => paymentForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(api.processPayment).not.toHaveBeenCalled();
  expect(api.createRenewal).not.toHaveBeenCalled();
  expect(paymentForm.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);

  await act(async () => finishSearch([{ ...member, userId: 20, fullName: 'Bình', phone: '5678' }]));
  await chooseAndPay('buy:2');
  expect(api.processPayment).toHaveBeenCalledTimes(1);
  expect(api.processPayment).toHaveBeenCalledWith(expect.objectContaining({ memberId: 20 }));
});

it('creates a linked renewal before collecting payment', async () => {
  const previous = { id: 5, memberId: 10, packageId: 2, packageName: 'Gold', startDate: '2026-09-01', endDate: '2026-09-30', status: 'expired', createdAt: '2026-09-01' };
  api.getRenewalCandidates.mockResolvedValue([previous]);
  api.createRenewal.mockResolvedValue({ ...previous, id: 6, status: 'pending_payment' });
  await selectMember();
  await chooseAndPay('renew:5');
  expect(api.createRenewal).toHaveBeenCalledWith(10, 5);
  expect(api.processPayment).toHaveBeenCalledWith(expect.objectContaining({ memberId: 10, subscriptionId: 6, packageId: 2, amount: 200 }));
});

it('keeps an existing pending order fixed to its selected package', async () => {
  api.getPendingSubscriptions.mockResolvedValue([{ id: 9, memberId: 10, membershipCode: 'MB-10', memberName: 'An',
    memberEmail: 'an@example.test', memberPhone: '1234', packageId: 2, packageName: 'Gold', durationDays: 30,
    packagePrice: 200, startDate: '2026-10-01', endDate: '2026-10-30', status: 'pending_payment', createdAt: '2026-10-01' }]);
  await selectMember();
  const field = host.querySelector('#pos-package') as HTMLInputElement;
  expect(field.tagName).toBe('INPUT');
  expect(field.disabled).toBe(true);
  expect(field.value).toContain('Gold');
  await act(async () => field.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(api.processPayment).toHaveBeenCalledWith(expect.objectContaining({ subscriptionId: 9, packageId: 2, amount: 200 }));
});

it('keeps the created renewal pending when payment fails', async () => {
  const previous = { id: 5, memberId: 10, packageId: 2, packageName: 'Gold', startDate: '2026-09-01', endDate: '2026-09-30', status: 'expired', createdAt: '2026-09-01' };
  api.getRenewalCandidates.mockResolvedValue([previous]);
  api.createRenewal.mockResolvedValue({ ...previous, id: 6, status: 'pending_payment' });
  api.processPayment.mockRejectedValue(new Error('payment failed'));
  api.getPendingSubscriptions.mockResolvedValueOnce([]).mockResolvedValue([{ id: 6, memberId: 10, membershipCode: 'MB-10', memberName: 'An',
    memberEmail: 'an@example.test', memberPhone: '1234', packageId: 2, packageName: 'Gold', durationDays: 30,
    packagePrice: 200, startDate: '2026-10-01', endDate: '2026-10-30', status: 'pending_payment', createdAt: '2026-10-01' }]);
  await selectMember();
  await chooseAndPay('renew:5');
  expect((host.querySelector('#pos-package') as HTMLInputElement).value).toContain('Yêu cầu #6');
  expect(host.textContent).not.toContain('Hóa đơn thực');
});

it('lets the desk record payment for an unpaid hourly 1:1 session', async () => {
  const booking = { id: 90, memberId: 10, memberName: 'An', coachId: 20, coachName: 'Hùng', coachSpecialization: 'Gym',
    coachAvatarUrl: null, disciplineId: null, disciplineName: null, bookingDate: '2026-11-02', startTime: '14:00:00',
    endTime: '15:00:00', hourlyRate: 200000, paymentMethod: 'cash', paymentStatus: 'pending', status: 'confirmed',
    notes: null, createdAt: '2026-10-30T10:00:00', cancelledAt: null, cancelReason: null };
  api.getUnpaidCoachBookings.mockResolvedValueOnce([booking]).mockResolvedValue([]);
  api.confirmCoachBookingPayment.mockResolvedValue({ ...booking, paymentStatus: 'paid' });
  await act(async () => root.render(<StaffReceptionPage />));
  expect(host.querySelector('.reception-todo__tag--pt')!.textContent).toBe('Buổi PT');
  expect(host.querySelector('.reception-top__queue h2')!.textContent).toBe('Cần xử lý (1)');
  const confirm = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Đã thu tiền mặt')!;
  await act(async () => confirm.click());
  expect(api.confirmCoachBookingPayment).toHaveBeenCalledWith(90, 'cash');
  expect(host.querySelector('.reception-todo__tag--pt')).toBeNull();
});

it('renders pending trial applications and lets the desk approve a trial with name sync', async () => {
  // Dữ liệu mẫu dùng trong các ca kiểm thử.
  const trialItem = {
    id: 55,
    memberId: 10,
    membershipCode: 'MB-10',
    memberName: 'an_google_account',
    memberEmail: 'an@example.test',
    memberPhone: '0901234567',
    documentType: 'CCCD' as const,
    documentNumberMasked: '••••••••1234',
    documentFullName: 'NGUYỄN VĂN AN',
    nationality: null,
    frontImageUrl: 'data:image/png;base64,front',
    backImageUrl: 'data:image/png;base64,back',
    status: 'PENDING_APPROVAL' as const,
    requestedAt: '2026-11-05T10:00:00',
  };
  api.getPendingTrials.mockResolvedValueOnce([trialItem]).mockResolvedValue([]);
  api.approveTrial.mockResolvedValue({ ...trialItem, status: 'APPROVED' });

  await act(async () => root.render(<StaffReceptionPage />));
  expect(host.querySelector('.reception-todo__tag--trial')!.textContent).toBe('Trải nghiệm');
  expect(host.textContent).toContain('Đơn thử #55');
  expect(host.textContent).toContain('NGUYỄN VĂN AN');
  expect(host.textContent).toContain('Đồng bộ họ tên');

  const approveBtn = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Duyệt & Kích hoạt'))!;
  expect(approveBtn).toBeDefined();
  await act(async () => approveBtn.click());
  expect(api.approveTrial).toHaveBeenCalledWith(55);
});

it('renders passport document type and nationality for foreign trial applicants', async () => {
  // Dữ liệu mẫu dùng trong các ca kiểm thử.
  const passportItem = {
    id: 56,
    memberId: 12,
    membershipCode: 'MB-12',
    memberName: 'john_smith',
    memberEmail: 'john@example.test',
    memberPhone: '0909999999',
    documentType: 'PASSPORT' as const,
    documentNumberMasked: '••••••••5678',
    documentFullName: 'JOHNATHAN SMITH',
    nationality: 'United States',
    frontImageUrl: 'data:image/png;base64,passport_front',
    backImageUrl: null,
    status: 'PENDING_APPROVAL' as const,
    requestedAt: '2026-11-05T11:00:00',
  };
  api.getPendingTrials.mockResolvedValueOnce([passportItem]);

  await act(async () => root.render(<StaffReceptionPage />));
  expect(host.textContent).toContain('Hộ chiếu (United States)');
  expect(host.textContent).toContain('JOHNATHAN SMITH');
});

it('shows a retry when unpaid 1:1 sessions fail to load', async () => {
  api.getUnpaidCoachBookings.mockRejectedValueOnce(new Error('Mất kết nối')).mockResolvedValue([]);
  await act(async () => root.render(<StaffReceptionPage />));
  expect(host.textContent).toContain('Mất kết nối');
  const retry = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Thử lại')!;
  await act(async () => retry.click());
  expect(host.querySelector('.reception-todo__tag--pt')).toBeNull();
});

it('lets the receptionist top up a selected member wallet at the counter', async () => {
  await selectMember();
  expect(api.getMemberWallet).toHaveBeenCalledWith(10);
  expect(host.querySelector('[data-testid="member-wallet-balance"]')?.textContent).toContain('150.000');

  const openModalBtn = host.querySelector<HTMLButtonElement>('[data-testid="open-counter-topup-modal-btn"]')!;
  expect(openModalBtn).not.toBeNull();
  await act(async () => openModalBtn.click());

  const amountInput = document.body.querySelector<HTMLInputElement>('[data-testid="counter-topup-amount-input"]')!;
  expect(amountInput).not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(amountInput, '500000');
    amountInput.dispatchEvent(new Event('input', { bubbles: true }));
  });

  const submitBtn = document.body.querySelector<HTMLButtonElement>('[data-testid="submit-counter-topup-btn"]')!;
  await act(async () => submitBtn.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

  expect(getNotices()[0].destination).toBe('/staff/reception-history');
  expect(api.topupMemberWallet).toHaveBeenCalledWith(10, {
    amount: 500000,
    paymentMethod: 'cash',
    note: undefined,
    clientRequestId: expect.any(String),
  });
  expect(host.querySelector('[data-testid="member-wallet-balance"]')?.textContent).toContain('650.000');
});

it('resends the same request id when the receptionist retries a top-up after a network error', async () => {
  api.topupMemberWallet.mockRejectedValueOnce(new Error('network down'));
  await selectMember();
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="open-counter-topup-modal-btn"]')!.click());
  const amountInput = document.body.querySelector<HTMLInputElement>('[data-testid="counter-topup-amount-input"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(amountInput, '500000');
    amountInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  // Hàm trợ giúp nhập liệu hoặc thao tác trên biểu mẫu trong DOM giả.
  const submit = async () => act(async () => document.body.querySelector<HTMLButtonElement>('[data-testid="submit-counter-topup-btn"]')!
    .closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

  await submit();
  await submit();

  expect(api.topupMemberWallet).toHaveBeenCalledTimes(2);
  const [first, second] = api.topupMemberWallet.mock.calls.map((call: unknown[]) => (call[1] as { clientRequestId: string }).clientRequestId);
  expect(first).toBeTruthy();
  expect(second).toBe(first);
});

it('offers only renewal, not a second new package, while the member still has a running paid period', async () => {
  const running = { id: 5, memberId: 10, packageId: 2, packageName: 'Gold', startDate: '2026-01-01', endDate: '2099-12-31', status: 'active', createdAt: '2026-01-01' };
  api.getRenewalCandidates.mockResolvedValue([running]);
  await selectMember();
  const packageSelect = host.querySelector('#pos-package')!.parentElement!.querySelector('select') as HTMLSelectElement;
  const values = Array.from(packageSelect.options).map((option) => option.value);
  expect(values).toContain('renew:5');
  expect(values.some((value) => value.startsWith('buy:'))).toBe(false);
  expect(host.querySelector('[data-testid="reception-renew-only-hint"]')).not.toBeNull();
});

it('asks confirmation before cancelling a pending membership request at the desk', async () => {
  // Dữ liệu mẫu dùng trong các ca kiểm thử.
  const pendingItem = {
    id: 77, memberId: 10, membershipCode: 'MB-10', memberName: 'An',
    memberEmail: 'an@example.test', memberPhone: '1234', packageId: 2, packageName: 'Gold', durationDays: 30,
    packagePrice: 200000, startDate: '2026-10-01', endDate: '2026-10-30', status: 'pending_payment', createdAt: '2026-10-01',
  };
  api.getPendingSubscriptions.mockResolvedValueOnce([pendingItem]).mockResolvedValue([]);
  api.cancelPendingSubscription.mockResolvedValue(undefined);

  await act(async () => root.render(<StaffReceptionPage />));
  const cancelBtn = [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Hủy yêu cầu')!;
  expect(cancelBtn.style.whiteSpace).toBe('nowrap');

  await act(async () => cancelBtn.click());
  expect(api.cancelPendingSubscription).not.toHaveBeenCalled();

  const dialogConfirmBtn = [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find((b) => b.textContent === 'Hủy yêu cầu')!;
  expect(dialogConfirmBtn).toBeDefined();
  await act(async () => dialogConfirmBtn.click());
  expect(api.cancelPendingSubscription).toHaveBeenCalledWith(77);
});

const runningGold = { id: 50, memberId: 10, packageId: 2, packageName: 'GOLD 9 THÁNG', previousSubscriptionId: null,
  startDate: '2026-11-21', endDate: '2027-08-16', status: 'active', createdAt: '2026-11-21' };
const oldSilver = { ...runningGold, id: 40, packageId: 3, packageName: 'SILVER 9 THÁNG',
  startDate: '2026-02-24', endDate: '2026-11-20', status: 'expired' };
// Component phụ chỉ phục vụ kiểm thử.
function useConflictHistory() {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-23T05:00:00Z'));
  api.getActivePackages.mockResolvedValue([{ ...pkg, name: runningGold.packageName, durationDays: 270 },
    { ...pkg, id: 3, name: oldSilver.packageName, durationDays: 270 }]);
  api.getRenewalCandidates.mockResolvedValue([runningGold, oldSilver]);
}
afterEach(() => vi.useRealTimers());
it('disables conflicting history but keeps Gold renewable and blocks a forced Silver submission', async () => {
  useConflictHistory(); await selectMember();
  const select = host.querySelector('#pos-package')!.parentElement!.querySelector('select') as HTMLSelectElement;
  expect(select.querySelector<HTMLOptionElement>('[value="renew:40"]')!.disabled).toBe(true);
  expect(select.querySelector<HTMLOptionElement>('[value="renew:50"]')!.disabled).toBe(false);
  await chooseAndPay('renew:40');
  expect(host.textContent).toContain('Không thể gia hạn gói SILVER 9 THÁNG vì trùng thời hạn với gói GOLD 9 THÁNG hiện tại. Vui lòng chọn gói hợp lệ.');
  expect(api.createRenewal).not.toHaveBeenCalled(); expect(api.processPayment).not.toHaveBeenCalled();
  expect((select.closest('form')!.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
});
it('still renews Gold when an unrelated old Silver renewal is blocked', async () => {
  useConflictHistory(); api.createRenewal.mockResolvedValue({ ...runningGold, id: 51, status: 'pending_payment' });
  await selectMember(); await chooseAndPay('renew:50');
  expect(api.createRenewal).toHaveBeenCalledWith(10, 50);
  expect(api.processPayment).toHaveBeenCalledWith(expect.objectContaining({ subscriptionId: 51, packageId: 2 }));
  expect(host.textContent).toContain('Hóa đơn thực');
});
it('explains candidate loading failures and prevents a forced payment', async () => {
  api.getRenewalCandidates.mockRejectedValue(new Error('offline')); await selectMember();
  expect(host.textContent).toContain('Không tải được gói tập hoặc lịch sử gia hạn. Vui lòng thử lại.');
  const select = host.querySelector('#pos-package')!.parentElement!.querySelector('select') as HTMLSelectElement;
  await act(async () => select.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(api.createRenewal).not.toHaveBeenCalled(); expect(api.processPayment).not.toHaveBeenCalled();
});
it('keeps backend renewal rejection clear and never falls back to collecting a new purchase', async () => {
  api.getRenewalCandidates.mockResolvedValue([{ ...runningGold, endDate: '2099-08-16' }]);
  api.createRenewal.mockRejectedValue(Object.assign(new Error('Subscription chain needs review before renewal'), { code: 'MEMBERSHIP_RENEWAL_CONFLICT' }));
  await selectMember(); await chooseAndPay('renew:50');
  expect(host.textContent).toContain('Không thể gia hạn kỳ đã chọn. Vui lòng tải lại danh sách hoặc nhờ quản lý kiểm tra.');
  expect(host.textContent).not.toContain('Subscription chain'); expect(api.processPayment).not.toHaveBeenCalled();
});
it('preserves a backend rejection for a different business reason', async () => {
  api.getRenewalCandidates.mockResolvedValue([{ ...runningGold, endDate: '2099-08-16' }]);
  api.createRenewal.mockRejectedValue(new Error('Gói đang chờ duyệt bảo lưu.'));
  await selectMember(); await chooseAndPay('renew:50');
  expect(host.textContent).toContain('Gói đang chờ duyệt bảo lưu.'); expect(api.processPayment).not.toHaveBeenCalled();
});

it('does not turn a missing renewal id into a new purchase when its number matches a package id', async () => {
  await selectMember();
  const select = host.querySelector('#pos-package')!.parentElement!.querySelector('select') as HTMLSelectElement;
  const staleOption = document.createElement('option');
  staleOption.value = 'renew:2'; staleOption.textContent = 'Stale renewal'; select.add(staleOption);
  await chooseAndPay('renew:2');
  expect(host.textContent).toContain('Kỳ gia hạn không còn trong danh sách. Vui lòng chọn lại.');
  expect(api.createRenewal).not.toHaveBeenCalled(); expect(api.processPayment).not.toHaveBeenCalled();
});

it('keeps replaced renewals disabled and explains them in the visible dropdown', async () => {
  api.getRenewalCandidates.mockResolvedValue([
    { id: 1, memberId: 10, packageId: 2, packageName: 'Trial', startDate: '2026-10-01', endDate: '2026-10-03', status: 'expired', createdAt: '2026-10-01' },
    { id: 2, memberId: 10, packageId: 3, packageName: 'GOLD 3 THÁNG', previousSubscriptionId: 1, startDate: '2026-10-02', endDate: '2026-12-31', status: 'active', createdAt: '2026-10-02' },
  ]);
  api.getActivePackages.mockResolvedValue([pkg, { ...pkg, id: 3, name: 'GOLD 3 THÁNG' }]);
  await selectMember();
  const trigger = host.querySelector<HTMLButtonElement>('#pos-package')!;
  await act(async () => trigger.click());
  const disabled = host.querySelector<HTMLElement>('.ui-select__option.is-disabled');
  expect(disabled?.getAttribute('aria-disabled')).toBe('true');
  expect(disabled?.textContent).toContain('GOLD 3 THÁNG');
  await act(async () => disabled?.click());
  expect(api.processPayment).not.toHaveBeenCalled();
  expect(api.createRenewal).not.toHaveBeenCalled();
});
