import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAuditLogsPage } from './AdminAuditLogsPage';
import { auditApi, type AuditLogItem, type ClassOccupancyItem } from './auditApi';
import { setLanguage } from '../../shared/i18n/language';

describe('AdminAuditLogsPage (SCRUM-124: Giám sát Audit Log & Báo cáo Lấp đầy Lớp)', () => {
  let host: HTMLDivElement;
  let root: Root;

  const mockLogs: AuditLogItem[] = [
    {
      id: 101,
      userId: 1,
      userFullName: 'Vũ Hoàng Nam',
      userEmail: 'nam.vu@solfitness.vn',
      action: 'UPDATE',
      entityType: 'membership_subscriptions',
      entityId: 45,
      oldValue: { status: 'pending_payment' },
      newValue: { status: 'active' },
      ipAddress: '192.168.1.15',
      createdAt: '2026-10-25T10:15:32',
    },
    {
      id: 102,
      userId: 2,
      userFullName: 'Nguyễn Thu Trang',
      userEmail: 'trang.nguyen@solfitness.vn',
      action: 'CREATE',
      entityType: 'payments',
      entityId: 128,
      oldValue: null,
      newValue: { invoiceNumber: 'INV-1028', amount: 3500000 },
      ipAddress: '192.168.1.22',
      createdAt: '2026-10-25T10:30:15',
    },
  ];

  const mockOccupancy: ClassOccupancyItem[] = [
    {
      classId: 1,
      className: 'Reformer Core & Spinal Alignment',
      disciplineId: 1,
      disciplineName: 'Pilates Reformer',
      roomName: 'Phòng Reformer 1',
      capacity: 10,
      enrolledCount: 9,
      presentCount: 8,
      utilizationRate: 90.0,
      attendanceRate: 88.9,
    },
    {
      classId: 2,
      className: 'Athletic Conditioning',
      disciplineId: 2,
      disciplineName: 'HIIT & Strength',
      capacity: 15,
      enrolledCount: 12,
      presentCount: 10,
      utilizationRate: 80.0,
      attendanceRate: 83.3,
    },
  ];

  beforeEach(() => {
    setLanguage('vi');
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    if (typeof HTMLDialogElement !== 'undefined') {
      if (!HTMLDialogElement.prototype.showModal) {
        Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
          value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); },
          writable: true,
          configurable: true,
        });
      } else {
        vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) {
          this.setAttribute('open', '');
        });
      }
      if (!HTMLDialogElement.prototype.close) {
        Object.defineProperty(HTMLDialogElement.prototype, 'close', {
          value: function (this: HTMLDialogElement) { this.removeAttribute('open'); },
          writable: true,
          configurable: true,
        });
      } else {
        vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) {
          this.removeAttribute('open');
        });
      }
    }

    vi.spyOn(auditApi, 'getAuditLogs').mockResolvedValue({
      content: mockLogs,
      totalElements: 2,
      totalPages: 1,
      number: 0,
      size: 8,
    });

    vi.spyOn(auditApi, 'getClassOccupancy').mockResolvedValue(mockOccupancy);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    host.remove();
    setLanguage('vi');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders audit log table with actors, actions and pagination (AC 1)', async () => {
    await act(async () => {
      root.render(<AdminAuditLogsPage />);
    });

    expect(host.textContent).toContain('Nhật ký & lấp đầy lớp');
    expect(host.textContent).toContain('Vũ Hoàng Nam');
    expect(host.textContent).toContain('Nguyễn Thu Trang');
    expect(host.textContent).toContain('UPDATE');
    expect(host.textContent).toContain('CREATE');
    expect(host.textContent).toContain('membership_subscriptions');
    expect(host.textContent).toContain('payments');
    expect(host.textContent).toContain('Hiển thị trang 1 / 1 (2 bản ghi)');
  });

  it('allows filtering by action and triggers API reload (AC 1)', async () => {
    await act(async () => {
      root.render(<AdminAuditLogsPage />);
    });

    const actionSelect = (host.querySelector('select[aria-label="Lọc theo hành động"]') ||
      host.querySelector('select')) as HTMLSelectElement;
    expect(actionSelect).not.toBeNull();

    await act(async () => {
      actionSelect.value = 'CREATE';
      actionSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(auditApi.getAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE' })
    );
  });

  it('opens diff modal and displays old_value vs new_value comparison (AC 2)', async () => {
    await act(async () => {
      root.render(<AdminAuditLogsPage />);
    });

    const diffBtn = host.querySelector('button[aria-label="Xem diff bản ghi #101"]') as HTMLButtonElement;
    expect(diffBtn).not.toBeNull();

    await act(async () => {
      diffBtn.click();
    });

    expect(host.textContent).toContain('Chi tiết thay đổi bản ghi #101');
    expect(host.textContent).toContain('Giá trị cũ (old_value)');
    expect(host.textContent).toContain('Giá trị mới (new_value)');
    expect(host.textContent).toContain('pending_payment');
    expect(host.textContent).toContain('active');
  });

  it('filters the current page by actor name or email', async () => {
    await act(async () => { root.render(<AdminAuditLogsPage />); });
    const input = host.querySelector('input[aria-label="Tìm kiếm người thực hiện"]') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'trang.nguyen');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(host.textContent).toContain('Nguyễn Thu Trang');
    expect(host.textContent).not.toContain('Vũ Hoàng Nam');
  });

  it('loads the next page and resets pagination when entity filter changes', async () => {
    vi.mocked(auditApi.getAuditLogs).mockResolvedValue({ content: mockLogs, totalElements: 16, totalPages: 2, number: 0, size: 8 });
    await act(async () => { root.render(<AdminAuditLogsPage />); });
    await act(async () => { (host.querySelector('button[aria-label="Trang sau →"]') as HTMLButtonElement).click(); });
    expect(auditApi.getAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
    const select = host.querySelector('select[aria-label="Lọc theo đối tượng"]') as HTMLSelectElement;
    await act(async () => {
      select.value = 'payments';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(auditApi.getAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ entityType: 'payments', page: 0 }));
  });

  it('switches audit, Diff and occupancy labels to English without reloading audit data', async () => {
    await act(async () => { root.render(<AdminAuditLogsPage />); });
    await act(async () => { setLanguage('en'); });
    expect(host.textContent).toContain('Audit log & class fill');
    expect(host.querySelector('input[aria-label="Search actor"]')).not.toBeNull();
    await act(async () => { (host.querySelector('button[aria-label="View record diff #101"]') as HTMLButtonElement).click(); });
    expect(host.textContent).toContain('pending_payment');
    expect(host.textContent).toContain('View diff');
    expect(auditApi.getAuditLogs).toHaveBeenCalledTimes(1);
    await act(async () => { (host.querySelectorAll('button[role="tab"]')[1] as HTMLButtonElement).click(); });
    expect(host.textContent).toContain('Average occupancy');
  });

  it('shows an error with retry when logs fail to load, never sample rows', async () => {
    vi.mocked(auditApi.getAuditLogs).mockRejectedValueOnce(new Error('Máy chủ không phản hồi'));

    await act(async () => {
      root.render(<AdminAuditLogsPage />);
    });

    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Máy chủ không phản hồi');
    expect(host.textContent).not.toContain('Vũ Hoàng Nam');

    const retry = Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Thử lại') as HTMLButtonElement;
    await act(async () => {
      retry.click();
    });

    expect(auditApi.getAuditLogs).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('Vũ Hoàng Nam');
  });

  it('switches to occupancy tab and renders visual occupancy chart (AC 3)', async () => {
    await act(async () => {
      root.render(<AdminAuditLogsPage />);
    });

    const occupancyTabBtn = host.querySelector('button[role="tab"]:nth-child(2)') as HTMLButtonElement;
    expect(occupancyTabBtn).not.toBeNull();

    await act(async () => {
      occupancyTabBtn.click();
    });

    expect(auditApi.getClassOccupancy).toHaveBeenCalled();
    expect(host.textContent).toContain('Tỷ lệ lấp đầy trung bình');
    expect(host.textContent).toContain('Reformer Core & Spinal Alignment');
    expect(host.textContent).toContain('90%');
    expect(host.textContent).toContain('Phòng Reformer 1');
    expect(host.textContent).toContain('Athletic Conditioning');
    expect(host.textContent).toContain('80%');
  });
});
