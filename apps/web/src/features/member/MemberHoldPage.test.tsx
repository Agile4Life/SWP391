import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLanguage } from '../../shared/i18n';
import { centerNowParts } from '../../shared/lib/centerTime';
import { MemberHoldPage } from './MemberHoldPage';

const mocks = vi.hoisted(() => ({ history: vi.fn(), policy: vi.fn(), detail: vi.fn(), submit: vi.fn(), withdraw: vi.fn() }));
vi.mock('./membershipApi', async (original) => ({ ...await original<typeof import('./membershipApi')>(), getMembershipHistory: mocks.history }));
vi.mock('./holdApi', async (original) => ({
  ...await original<typeof import('./holdApi')>(),
  getHoldPolicy: mocks.policy, getHoldDetail: mocks.detail, submitHoldRequest: mocks.submit, withdrawHoldRequest: mocks.withdraw,
}));

// Đóng băng thời gian tại Thứ Tư 25/11/2026 10:00 +07:00 để tránh lệch ngày quanh nửa đêm.
const FIXED_NOW = new Date('2026-11-25T03:00:00Z');

// Ngày YYYY-MM-DD lệch days ngày so với mốc cố định theo múi giờ trung tâm.
function isoOffset(days: number) {
  const [year, month, day] = centerNowParts(FIXED_NOW).date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
const subscription = { id: 7, packageName: 'GOLD 3 THÁNG', status: 'active', startDate: isoOffset(-5), endDate: isoOffset(84), holdStatus: null };
const policy = { allowed: true, alreadyUsed: false, minDays: 3, maxDays: 15, noticeHours: 24, maxDocuments: 5, maxDocumentBytes: 5242880 };

describe('MemberHoldPage', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(FIXED_NOW);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div'); document.body.append(host);
    root = createRoot(host);
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });
  afterEach(async () => { await act(async () => root.unmount()); setLanguage('vi'); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
  // Dựng component vào DOM giả để kiểm thử.
  async function render() { await act(async () => root.render(<MemoryRouter><MemberHoldPage /></MemoryRouter>)); }
  // Hàm trợ giúp nhập liệu hoặc thao tác trên biểu mẫu trong DOM giả.
  function setValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Hàm trợ giúp nhập liệu hoặc thao tác trên biểu mẫu trong DOM giả.
  async function pickDate(id: string, iso: string) {
    await act(async () => host.querySelector<HTMLButtonElement>(`button#${id}`)!.click());
    for (let i = 0; i < 3 && !document.querySelector(`button[aria-label="${iso}"]`); i++) {
      await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Tháng sau"]')?.click());
    }
    await act(async () => document.querySelector<HTMLButtonElement>(`button[aria-label="${iso}"]`)!.click());
  }

  it('shows the allowance and the request form for a package that can be held', async () => {
    mocks.history.mockResolvedValue([subscription]);
    mocks.policy.mockResolvedValue(policy);
    await render();
    expect(host.textContent).toContain('GOLD 3 THÁNG');
    expect(host.textContent).toContain('Tối đa 15 ngày, tối thiểu 3 ngày');
    expect(host.querySelector('form')).not.toBeNull();
    expect(mocks.detail).not.toHaveBeenCalled();
  });

  it('explains that a 1-month package cannot be held and shows no form', async () => {
    mocks.history.mockResolvedValue([{ ...subscription, packageName: 'SILVER' }]);
    mocks.policy.mockResolvedValue({ ...policy, allowed: false, maxDays: 0 });
    await render();
    expect(host.textContent).toContain('Gói này không được bảo lưu');
    expect(host.querySelector('form')).toBeNull();
  });

  it('allows sending a request without documents for business trip or vacation', async () => {
    mocks.history.mockResolvedValue([subscription]);
    mocks.policy.mockResolvedValue(policy);
    mocks.submit.mockResolvedValue({});
    await render();
    await pickDate('hold-start', isoOffset(3));
    await pickDate('hold-end', isoOffset(6));
    await act(async () => setValue(host.querySelector<HTMLTextAreaElement>('#hold-reason')!, 'Đi công tác'));
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(mocks.submit).toHaveBeenCalledWith(7, {
      reason: 'Đi công tác',
      startDate: isoOffset(3),
      endDate: isoOffset(6),
      files: [],
    });
  });

  it('lets the member withdraw a pending request after confirmation and hides the form meanwhile', async () => {
    mocks.history.mockResolvedValue([{ ...subscription, holdStatus: 'PENDING' }]);
    mocks.policy.mockResolvedValue(policy);
    mocks.detail.mockResolvedValue({ id: 7, holdStatus: 'PENDING', holdReason: 'Phẫu thuật', holdStartDate: isoOffset(3), holdEndDate: isoOffset(8), documents: [{ id: 1, fileName: 'giay-kham.pdf', contentType: 'application/pdf', sizeBytes: 10, uploadedAt: '2026-11-09T10:00:00' }] });
    mocks.withdraw.mockResolvedValue({});
    await render();
    expect(host.querySelector('form')).toBeNull();
    expect(host.querySelector('[data-testid="hold-current"]')?.textContent).toContain('giay-kham.pdf');
    await act(async () => [...host.querySelectorAll('button')].find((button) => button.textContent === 'Rút đơn')!.click());
    expect(mocks.withdraw).not.toHaveBeenCalled();
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find((button) => button.textContent === 'Rút đơn')!.click());
    expect(mocks.withdraw).toHaveBeenCalledWith(7);
  });

  it('lets the member cancel an approved hold that has not started after confirmation', async () => {
    mocks.history.mockResolvedValue([{ ...subscription, holdStatus: 'APPROVED' }]);
    mocks.policy.mockResolvedValue({ ...policy, alreadyUsed: true });
    mocks.detail.mockResolvedValue({ id: 7, holdStatus: 'APPROVED', holdReason: 'Phẫu thuật', holdStartDate: isoOffset(3), holdEndDate: isoOffset(8), documents: [] });
    mocks.withdraw.mockResolvedValue({});
    await render();
    await act(async () => [...host.querySelectorAll('button')].find((button) => button.textContent === 'Hủy bảo lưu chưa bắt đầu')!.click());
    expect(mocks.withdraw).not.toHaveBeenCalled();
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find((button) => button.textContent === 'Hủy bảo lưu')!.click());
    expect(mocks.withdraw).toHaveBeenCalledWith(7);
  });

  it('offers no cancellation once an approved hold has started', async () => {
    mocks.history.mockResolvedValue([{ ...subscription, status: 'frozen', holdStatus: 'APPROVED' }]);
    mocks.policy.mockResolvedValue({ ...policy, alreadyUsed: true });
    mocks.detail.mockResolvedValue({ id: 7, holdStatus: 'APPROVED', holdReason: 'Phẫu thuật', holdStartDate: isoOffset(-2), holdEndDate: isoOffset(4), documents: [] });
    await render();
    expect([...host.querySelectorAll('button')].some((button) => button.textContent === 'Hủy bảo lưu chưa bắt đầu')).toBe(false);
  });

  it('P2-FE-47 & P2-FE-50: warns about group courses (3-day rule) and PT 1:1, marks invalid fields, and re-translates form errors', async () => {
    mocks.history.mockResolvedValue([subscription]);
    mocks.policy.mockResolvedValue(policy);
    await render();
    expect(host.textContent).toContain('khóa học nhóm');
    expect(host.textContent).toContain('3 ngày');
    expect(host.textContent).toContain('PT 1:1');

    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(host.querySelector('#hold-reason')?.getAttribute('aria-invalid')).toBe('true');
    expect(host.querySelector('.form-error')?.textContent).toContain('Vui lòng nhập lý do bảo lưu.');

    await act(async () => setLanguage('en'));
    expect(host.querySelector('.form-error')?.textContent).toContain('Please enter the reason for the hold.');
  });

  it('styles load error with portal-alert--error and alreadyUsed notice without portal-card override', async () => {
    mocks.history.mockRejectedValueOnce(new Error('offline'));
    await render();
    const alert = host.querySelector('.portal-alert.portal-alert--error[role="alert"]');
    expect(alert).not.toBeNull();

    mocks.history.mockResolvedValueOnce([subscription]);
    mocks.policy.mockResolvedValueOnce({ ...policy, alreadyUsed: true });
    await act(async () => alert?.querySelector<HTMLButtonElement>('button')?.click());
    const infoNotice = host.querySelector('.hold-notice.hold-notice--info[role="status"]');
    expect(infoNotice).not.toBeNull();
    expect(infoNotice?.classList.contains('portal-card')).toBe(false);
    expect(infoNotice?.textContent).toContain('Gói này đã dùng lượt bảo lưu duy nhất.');
  });
});
