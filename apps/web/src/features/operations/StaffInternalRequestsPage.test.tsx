import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffInternalRequestsPage } from './StaffInternalRequestsPage';
import * as staffRequestApi from './staffRequestApi';

// Thay DatePicker bằng ô nhập thường để ca kiểm thử có thể nhập trực tiếp ngày nghỉ phép.
vi.mock('../../shared/ui/DatePicker', () => ({
  DatePicker: (props: { id: string; value: string; onChange: (e: { target: { value: string } }) => void }) => (
    <input id={props.id} value={props.value} onChange={(e) => props.onChange({ target: { value: e.target.value } })} />
  ),
}));

vi.mock('./staffRequestApi', () => ({
  getMyStaffRequests: vi.fn(),
  createStaffRequest: vi.fn(),
  cancelStaffRequest: vi.fn(),
}));

describe('StaffInternalRequestsPage (Hệ thống Đơn từ nội bộ)', () => {
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
      userId: 10,
      userFullName: 'Huỳnh Đắc Tài',
      userEmail: 'tai.huynh@solfitness.vn',
      userRole: 'COACH',
      requestType: 'SHIFT_EXCHANGE',
      title: 'Xin đổi ca trực sáng',
      reason: 'Cần đổi ca sáng sang ca chiều để đi khám sức khỏe',
      startDate: '2026-11-08',
      endDate: null,
      targetShift: 'Ca sáng (06:00 - 14:00)',
      replacementUserId: null,
      replacementUserFullName: null,
      status: 'APPROVED',
      managerNotes: 'Đã duyệt và sắp xếp người trực thay.',
      reviewedByUserId: 1,
      reviewedByName: 'Trần Quản Lý',
      reviewedAt: '2026-10-31T09:30:00',
      createdAt: '2026-10-30T14:00:00',
      updatedAt: '2026-10-31T09:30:00',
    },
  ];

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    vi.mocked(staffRequestApi.getMyStaffRequests).mockResolvedValue(mockRequests);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });

  // Dựng component vào DOM giả để kiểm thử.
  async function render() {
    await act(async () => {
      root.render(<StaffInternalRequestsPage />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
  }

  it('renders staff internal requests list with status badges and create button', async () => {
    await render();

    expect(host.textContent).toContain('Đơn từ nội bộ');
    expect(host.textContent).toContain('Tạo đơn từ mới');
    expect(host.textContent).toContain('Xin nghỉ phép cá nhân');
    expect(host.textContent).toContain('Xin đổi ca trực sáng');
    expect(host.textContent).toContain('Chờ duyệt');
    expect(host.textContent).toContain('Đã duyệt');
    expect(host.textContent).toContain('Đã duyệt và sắp xếp người trực thay.');
  });

  it('opens create modal, validates required fields, and submits new request', async () => {
    await render();

    const createBtn = [...host.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Tạo đơn từ mới')
    );
    expect(createBtn).not.toBeUndefined();

    await act(async () => {
      createBtn?.click();
    });

    expect(host.textContent).toContain('Tạo đơn từ & đề xuất mới');

    vi.mocked(staffRequestApi.createStaffRequest).mockResolvedValue({
      ...mockRequests[0],
      id: 3,
      title: 'Xin đổi lịch dạy thứ 7',
      requestType: 'SCHEDULE_CHANGE',
    });

    const submitBtn = [...host.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Gửi đơn tới Quản Lý')
    );

    // Bấm gửi khi chưa điền trường bắt buộc -> kích hoạt lỗi kiểm tra hợp lệ
    await act(async () => {
      submitBtn?.click();
    });
    expect(host.textContent).toContain('Vui lòng nhập tiêu đề đơn.');
  });

  it('validates start date requirement for LEAVE request before submitting', async () => {
    await render();

    const createBtn = [...host.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Tạo đơn từ mới')
    );
    await act(async () => {
      createBtn?.click();
    });

    const titleInput = host.querySelector('#internal-request-title') as HTMLInputElement;
    const reasonInput = host.querySelector('#internal-request-reason') as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    const textareaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;

    await act(async () => {
      setter?.call(titleInput, 'Xin nghỉ phép 1 ngày');
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      titleInput.dispatchEvent(new Event('change', { bubbles: true }));
      textareaSetter?.call(reasonInput, 'Có việc riêng cần giải quyết');
      reasonInput.dispatchEvent(new Event('input', { bubbles: true }));
      reasonInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const submitBtn = [...host.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Gửi đơn tới Quản Lý')
    );
    await act(async () => {
      submitBtn?.click();
    });

    expect(host.textContent).toContain('Đơn xin nghỉ phép bắt buộc phải chọn Ngày bắt đầu và Ngày kết thúc.');
    expect(staffRequestApi.createStaffRequest).not.toHaveBeenCalled();
  });

  it('warns about a leave on days already requested and sends it again only after confirmation', async () => {
    const { ApiError } = await import('../../shared/api/client');
    vi.mocked(staffRequestApi.createStaffRequest)
      .mockRejectedValueOnce(new ApiError('Bạn đã có đơn nghỉ từ 20/11/2026 đến 21/11/2026 đã được duyệt, trùng với những ngày này. Bạn có muốn gửi thêm đơn nữa không?', 409, 'LEAVE_OVERLAP'))
      .mockResolvedValueOnce({ ...mockRequests[0], id: 9 });
    await render();
    await act(async () => { [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Tạo đơn từ mới'))?.click(); });
    // Hàm trợ giúp nhập liệu hoặc thao tác trên biểu mẫu trong DOM giả.
    const fill = (selector: string, value: string, proto: typeof HTMLInputElement | typeof HTMLTextAreaElement = HTMLInputElement) => {
      const el = host.querySelector(selector) as HTMLInputElement;
      Object.getOwnPropertyDescriptor(proto.prototype, 'value')?.set?.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    await act(async () => {
      fill('#internal-request-title', 'Xin nghỉ');
      fill('#internal-request-reason', 'Việc riêng', HTMLTextAreaElement);
      fill('#internal-request-start', '2026-11-20');
      fill('#internal-request-end', '2026-11-21');
    });
    await act(async () => { [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Gửi đơn tới Quản Lý'))?.click(); });

    expect(document.body.textContent).toContain('Đã có đơn nghỉ trùng ngày');
    expect(document.body.textContent).toContain('20/11/2026 đến 21/11/2026');
    expect(staffRequestApi.createStaffRequest).toHaveBeenCalledTimes(1);

    await act(async () => { [...document.body.querySelectorAll('button')].find((b) => b.textContent === 'Vẫn gửi đơn')?.click(); });
    expect(staffRequestApi.createStaffRequest).toHaveBeenLastCalledWith(expect.objectContaining({ startDate: '2026-11-20', confirmOverlap: true }));
  });

  it('clears targetShift on type switch, rejects endDate without startDate, and hides empty state on load error (P2-FE-70, P2-FE-71)', async () => {
    vi.mocked(staffRequestApi.getMyStaffRequests).mockRejectedValueOnce(new Error('Network error'));
    await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Network error');
    expect(host.textContent).not.toContain('Không có đơn từ nào trong danh sách');

    vi.mocked(staffRequestApi.getMyStaffRequests).mockResolvedValueOnce(mockRequests);
    const retryBtn = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Thử lại') as HTMLButtonElement;
    await act(async () => retryBtn.click());
    expect(host.textContent).toContain('Xin nghỉ phép cá nhân');

    await act(async () => { [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Tạo đơn từ mới'))?.click(); });
    const typeSelect = host.querySelector('#internal-request-type')!.parentElement!.querySelector('select') as HTMLSelectElement;
    await act(async () => {
      typeSelect.value = 'SHIFT_EXCHANGE';
      typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const shiftInput = host.querySelector('#internal-request-shift') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(shiftInput, 'Ca tối');
      shiftInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      typeSelect.value = 'OTHER';
      typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const fill = (selector: string, value: string, proto: typeof HTMLInputElement | typeof HTMLTextAreaElement = HTMLInputElement) => {
      const el = host.querySelector(selector) as HTMLInputElement;
      Object.getOwnPropertyDescriptor(proto.prototype, 'value')?.set?.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    await act(async () => {
      fill('#internal-request-title', 'Đề xuất mới');
      fill('#internal-request-reason', 'Chi tiết đề xuất', HTMLTextAreaElement);
      fill('#internal-request-end', '2026-11-30');
    });
    await act(async () => { [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Gửi đơn tới Quản Lý'))?.click(); });
    expect(host.textContent).toContain('Vui lòng chọn Ngày bắt đầu khi đã nhập Ngày kết thúc.');
    expect(staffRequestApi.createStaffRequest).not.toHaveBeenCalled();

    await act(async () => { fill('#internal-request-start', '2026-11-28'); });
    vi.mocked(staffRequestApi.createStaffRequest).mockResolvedValueOnce({ ...mockRequests[0], id: 22, requestType: 'OTHER', targetShift: null });
    await act(async () => { [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Gửi đơn tới Quản Lý'))?.click(); });
    expect(staffRequestApi.createStaffRequest).toHaveBeenCalledWith(expect.objectContaining({ requestType: 'OTHER', targetShift: null }));
  });
});
