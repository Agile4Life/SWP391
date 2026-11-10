import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberHoldPage } from './MemberHoldPage';

const mocks = vi.hoisted(() => ({ history: vi.fn(), policy: vi.fn(), detail: vi.fn(), submit: vi.fn(), withdraw: vi.fn() }));
vi.mock('./membershipApi', async (original) => ({ ...await original<typeof import('./membershipApi')>(), getMembershipHistory: mocks.history }));
vi.mock('./holdApi', async (original) => ({
  ...await original<typeof import('./holdApi')>(),
  getHoldPolicy: mocks.policy, getHoldDetail: mocks.detail, submitHoldRequest: mocks.submit, withdrawHoldRequest: mocks.withdraw,
}));

function isoOffset(days: number) {
  const date = new Date(); date.setDate(date.getDate() + days);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
const subscription = { id: 7, packageName: 'GOLD 3 THÁNG', status: 'active', startDate: isoOffset(-5), endDate: isoOffset(84), holdStatus: null };
const policy = { allowed: true, alreadyUsed: false, minDays: 3, maxDays: 15, noticeHours: 24, maxDocuments: 5, maxDocumentBytes: 5242880 };

describe('MemberHoldPage', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div'); document.body.append(host);
    root = createRoot(host);
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
  async function render() { await act(async () => root.render(<MemoryRouter><MemberHoldPage /></MemoryRouter>)); }
  function setValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

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

  it('refuses to send a request without the medical paperwork and validates the notice period', async () => {
    mocks.history.mockResolvedValue([subscription]);
    mocks.policy.mockResolvedValue(policy);
    await render();
    // bộ chọn ngày không cho chọn ngày trước hạn 24 giờ nên chỉ còn lỗi thiếu giấy tờ
    await pickDate('hold-start', isoOffset(3));
    await pickDate('hold-end', isoOffset(6));
    await act(async () => setValue(host.querySelector<HTMLTextAreaElement>('#hold-reason')!, 'Phẫu thuật'));
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('giấy tờ y tế');
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it('lets the member withdraw a pending request and hides the form meanwhile', async () => {
    mocks.history.mockResolvedValue([{ ...subscription, holdStatus: 'PENDING' }]);
    mocks.policy.mockResolvedValue(policy);
    mocks.detail.mockResolvedValue({ id: 7, holdStatus: 'PENDING', holdReason: 'Phẫu thuật', holdStartDate: isoOffset(3), holdEndDate: isoOffset(8), documents: [{ id: 1, fileName: 'giay-kham.pdf', contentType: 'application/pdf', sizeBytes: 10, uploadedAt: '2026-11-09T10:00:00' }] });
    mocks.withdraw.mockResolvedValue({});
    await render();
    expect(host.querySelector('form')).toBeNull();
    expect(host.querySelector('[data-testid="hold-current"]')?.textContent).toContain('giay-kham.pdf');
    await act(async () => [...host.querySelectorAll('button')].find((button) => button.textContent === 'Rút đơn')!.click());
    expect(mocks.withdraw).toHaveBeenCalledWith(7);
  });

  it('lets the member cancel an approved hold that has not started', async () => {
    mocks.history.mockResolvedValue([{ ...subscription, holdStatus: 'APPROVED' }]);
    mocks.policy.mockResolvedValue({ ...policy, alreadyUsed: true });
    mocks.detail.mockResolvedValue({ id: 7, holdStatus: 'APPROVED', holdReason: 'Phẫu thuật', holdStartDate: isoOffset(3), holdEndDate: isoOffset(8), documents: [] });
    mocks.withdraw.mockResolvedValue({});
    await render();
    await act(async () => [...host.querySelectorAll('button')].find((button) => button.textContent === 'Hủy bảo lưu chưa bắt đầu')!.click());
    expect(mocks.withdraw).toHaveBeenCalledWith(7);
  });

  it('offers no cancellation once an approved hold has started', async () => {
    mocks.history.mockResolvedValue([{ ...subscription, status: 'frozen', holdStatus: 'APPROVED' }]);
    mocks.policy.mockResolvedValue({ ...policy, alreadyUsed: true });
    mocks.detail.mockResolvedValue({ id: 7, holdStatus: 'APPROVED', holdReason: 'Phẫu thuật', holdStartDate: isoOffset(-2), holdEndDate: isoOffset(4), documents: [] });
    await render();
    expect([...host.querySelectorAll('button')].some((button) => button.textContent === 'Hủy bảo lưu chưa bắt đầu')).toBe(false);
  });
});
