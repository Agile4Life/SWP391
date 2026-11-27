import { act } from 'react';
import { toast } from '../../shared/ui/toast';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ManagerInternalRequestsPage } from './ManagerInternalRequestsPage';
import * as staffRequestApi from './staffRequestApi';

vi.mock('../../shared/ui/toast', () => ({ toast: vi.fn() }));
vi.mock('./staffRequestApi', () => ({
  getAllStaffRequests: vi.fn(),
  reviewStaffRequest: vi.fn(),
}));

describe('ManagerInternalRequestsPage (Duyệt đơn từ nội bộ)', () => {
  let host: HTMLDivElement;
  let root: Root;

  const mockRequests: staffRequestApi.StaffInternalRequestDto[] = [
    {
      id: 1,
      userId: 10,
      userFullName: 'Huỳnh Đắc Tài',
      userEmail: 'tai.huynh@solfitness.vn',
      userRole: 'COACH',
      requestType: 'LEAVE',
      title: 'Xin nghỉ phép cá nhân',
      reason: 'Bận việc gia đình 2 ngày',
      startDate: '2026-11-05',
      endDate: '2026-11-06',
      targetShift: null,
      replacementUserId: null,
      replacementUserFullName: null,
      status: 'PENDING',
      managerNotes: null,
      reviewedByUserId: null,
      reviewedByName: null,
      reviewedAt: null,
      createdAt: '2026-10-31T08:00:00',
      updatedAt: null,
    },
    {
      id: 2,
      userId: 11,
      userFullName: 'Nguyễn Minh Quân',
      userEmail: 'quan.nguyen@solfitness.vn',
      userRole: 'COACH',
      requestType: 'SHIFT_EXCHANGE',
      title: 'Đổi ca trực',
      reason: 'Đổi sang ca chiều',
      startDate: '2026-11-08',
      endDate: null,
      targetShift: 'Ca sáng',
      replacementUserId: null,
      replacementUserFullName: null,
      status: 'APPROVED',
      managerNotes: 'Đồng ý',
      reviewedByUserId: 1,
      reviewedByName: 'Trần Quản Lý',
      reviewedAt: '2026-10-31T09:30:00',
      createdAt: '2026-10-30T14:00:00',
      updatedAt: '2026-10-31T09:30:00',
    },
  ];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-31T03:00:00Z'));
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    vi.mocked(staffRequestApi.getAllStaffRequests).mockResolvedValue(mockRequests);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });

  // Dựng component vào DOM giả để kiểm thử.
  async function render() {
    await act(async () => {
      root.render(<ManagerInternalRequestsPage />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
  }

  it('renders manager review page with pending requests and approve/reject actions', async () => {
    await render();

    expect(host.textContent).toContain('Duyệt đơn từ nội bộ');
    expect(host.textContent).toContain('Huỳnh Đắc Tài');
    expect(host.textContent).toContain('Xin nghỉ phép cá nhân');
    expect(host.textContent).toContain('Phê duyệt đơn');
    expect(host.textContent).toContain('Từ chối đơn');
  });

  it('blocks overdue approval but keeps rejection available', async () => {
    vi.setSystemTime(new Date('2026-11-05T00:00:00Z'));
    await render();
    expect(host.textContent).toContain('Quá hạn duyệt');
    const approve = [...host.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.includes('Phê duyệt đơn'))!;
    expect(approve.disabled).toBe(true);
    expect([...host.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.includes('Từ chối đơn'))?.disabled).toBe(false);
  });

  it('rechecks the Vietnam date when an approval dialog crosses midnight', async () => {
    vi.setSystemTime(new Date('2026-11-04T16:59:00Z'));
    await render();
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.includes('Phê duyệt đơn'))!.click());
    vi.setSystemTime(new Date('2026-11-04T17:00:00Z'));
    vi.mocked(staffRequestApi.reviewStaffRequest).mockClear();
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(staffRequestApi.reviewStaffRequest).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Quá hạn duyệt');
  });

  it('opens approve modal and confirms approval', async () => {
    await render();

    const approveBtn = [...host.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Phê duyệt đơn')
    );
    expect(approveBtn).not.toBeUndefined();

    await act(async () => {
      approveBtn?.click();
    });

    expect(host.textContent).toContain('Phê duyệt đơn: Xin nghỉ phép cá nhân');

    vi.mocked(staffRequestApi.reviewStaffRequest).mockResolvedValue({
      ...mockRequests[0],
      status: 'APPROVED',
      managerNotes: 'Đã xem xét và chấp thuận.',
    });

    const confirmBtn = [...host.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Xác nhận Phê duyệt')
    );
    expect(confirmBtn).not.toBeUndefined();

    await act(async () => {
      confirmBtn?.click();
    });

    expect(staffRequestApi.reviewStaffRequest).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        status: 'APPROVED',
      })
    );
  });

  it('opens reject modal and requires reason', async () => {
    await render();

    const rejectBtn = [...host.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Từ chối đơn')
    );
    expect(rejectBtn).not.toBeUndefined();

    await act(async () => {
      rejectBtn?.click();
    });

    expect(host.textContent).toContain('Từ chối đơn: Xin nghỉ phép cá nhân');

    const confirmRejectBtn = [...host.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Xác nhận Từ chối')
    );

    // Lý do trống sẽ kích hoạt báo lỗi
    await act(async () => {
      confirmRejectBtn?.click();
    });

    expect(host.textContent).toContain('Vui lòng nhập lý do từ chối đơn');
  });

  it('warns on coach leave conflicts, confirms before forcing approval, dispatches notification refresh, and guards empty OTHER metadata (P2-FE-70, P2-FE-71)', async () => {
    const { ApiError } = await import('../../shared/api/client');
    const otherReq: staffRequestApi.StaffInternalRequestDto = {
      ...mockRequests[0],
      id: 99,
      userFullName: '',
      requestType: 'OTHER',
      title: 'Đề xuất bổ sung dụng cụ',
      startDate: null,
      endDate: null,
      targetShift: null,
      status: 'PENDING',
    };
    vi.mocked(staffRequestApi.getAllStaffRequests).mockResolvedValue([mockRequests[0], otherReq]);
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    await render();

    // Null-safe userFullName renders '?' avatar without crashing
    expect(host.textContent).toContain('Đề xuất bổ sung dụng cụ');

    // Open coach LEAVE approval modal -> shows coach schedule conflict warning
    const approveBtns = [...host.querySelectorAll('button')].filter((b) => b.textContent?.includes('Phê duyệt đơn'));
    await act(async () => approveBtns[0].click());
    expect(host.textContent).toContain('có thể ảnh hưởng đến các buổi lớp nhóm hoặc PT 1:1');

    // Backend returns 409 COACH_LEAVE_HAS_CONFLICTS -> asks confirmation before sending confirmConflicts: true
    vi.mocked(staffRequestApi.reviewStaffRequest)
      .mockRejectedValueOnce(new ApiError('HLV có 2 buổi lớp và 1 buổi PT bị ảnh hưởng.', 409, 'COACH_LEAVE_HAS_CONFLICTS'))
      .mockResolvedValueOnce({ ...mockRequests[0], status: 'APPROVED', affectedClassSessionCount: 2, affectedPtSessionCount: 0 });

    const confirmApprove = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Xác nhận Phê duyệt'))!;
    await act(async () => confirmApprove.click());
    expect(staffRequestApi.reviewStaffRequest).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'APPROVED', confirmConflicts: false }));
    expect(document.body.textContent).toContain('HLV có 2 buổi lớp và 1 buổi PT bị ảnh hưởng.');

    const forceBtn = [...document.body.querySelectorAll('button')].find((b) => b.textContent === 'Vẫn phê duyệt')!;
    await act(async () => forceBtn.click());
    expect(staffRequestApi.reviewStaffRequest).toHaveBeenLastCalledWith(1, expect.objectContaining({ status: 'APPROVED', confirmConflicts: true }));
    // Không có buổi PT 1:1 thì câu báo chỉ nhắc buổi lớp nhóm.
    const lastNotice = String(vi.mocked(toast).mock.calls.at(-1)?.[0] ?? '');
    expect(lastNotice).toContain('cần sắp xếp người dạy thay cho 2 buổi lớp nhóm.');
    expect(lastNotice).not.toContain('PT');
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'member-notifications-changed' }));
    dispatchSpy.mockRestore();
  });

  it('hides empty state when loading fails and provides a Retry button (P2-FE-71)', async () => {
    vi.mocked(staffRequestApi.getAllStaffRequests).mockRejectedValueOnce(new Error('API error'));
    await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('API error');
    expect(host.textContent).not.toContain('Không có đơn từ nào cần xử lý');

    vi.mocked(staffRequestApi.getAllStaffRequests).mockResolvedValueOnce(mockRequests);
    const retry = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Thử lại')!;
    await act(async () => retry.click());
    expect(host.textContent).toContain('Xin nghỉ phép cá nhân');
  });
});

