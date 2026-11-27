import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserManagerPage } from './UserManagerPage';
import { userApi, UserAccount } from './userApi';

vi.mock('./userApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./userApi')>();
  return {
    ...actual,
    userApi: {
      getUsers: vi.fn(),
      getRolePermissions: vi.fn(),
      getPermissions: vi.fn(),
      createUser: vi.fn(),
      updateUser: vi.fn(),
      toggleLockUser: vi.fn(),
      deleteUser: vi.fn(),
      getDeletedUsers: vi.fn(),
      restoreUser: vi.fn(),
      cleanupInactiveUsers: vi.fn(),
      toggleRolePermission: vi.fn(),
    },
  };
});

describe('UserManagerPage', () => {
  let host: HTMLDivElement;
  let root: Root;

  const sampleUsers: UserAccount[] = [
    {
      id: '99',
      name: 'Root Admin',
      email: 'admin@scms.local',
      phone: '0901000099',
      role: 'ADMIN',
      gender: 'male',
      status: 'ACTIVE',
      deleted_at: null,
      created_at: '2026-01-01',
      last_login_at: '2026-10-20T10:00:00',
      is_frozen: false,
    },
    {
      id: '1',
      name: 'Manager User',
      email: 'manager@scms.local',
      phone: '0901000001',
      role: 'CENTER_MANAGER',
      gender: 'male',
      status: 'ACTIVE',
      deleted_at: null,
      created_at: '2026-01-01',
      last_login_at: '2026-10-20T10:00:00',
      is_frozen: false,
    },
    {
      id: '2',
      name: 'Frozen Member',
      email: 'frozen@scms.local',
      phone: '0901000002',
      role: 'MEMBER',
      gender: 'female',
      status: 'ACTIVE',
      deleted_at: null,
      created_at: '2026-01-02',
      last_login_at: '2026-02-01T10:00:00',
      is_frozen: true,
    },
    {
      id: '3',
      name: 'Inactive Coach',
      email: 'coach@scms.local',
      phone: '0901000003',
      role: 'COACH',
      gender: 'male',
      status: 'ACTIVE',
      deleted_at: null,
      created_at: '2026-01-03',
      last_login_at: '2026-02-01T10:00:00',
      is_frozen: false,
    },
  ];

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    vi.mocked(userApi.getUsers).mockResolvedValue(sampleUsers);
    vi.mocked(userApi.getDeletedUsers).mockResolvedValue([]);
    vi.mocked(userApi.getRolePermissions).mockResolvedValue({
      ADMIN: [],
      CENTER_MANAGER: [],
      COACH: [],
      RECEPTIONIST: [],
      MEMBER: [],
    });
    vi.mocked(userApi.getPermissions).mockResolvedValue([]);
    vi.mocked(userApi.deleteUser).mockResolvedValue(undefined as unknown as void);
    vi.mocked(userApi.cleanupInactiveUsers).mockResolvedValue({
      deletedCount: 1,
      message: 'Đã dọn dẹp 1 tài khoản không hoạt động.',
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // Hàm trợ giúp tìm phần tử (nút/tab) trong DOM giả hoặc bấm vào nó.
  const button = (container: HTMLElement, label: string) =>
    [...container.querySelectorAll('button')].find((item) => item.textContent?.trim() === label);

  it('renders user list with the cleanup option in a menu and frozen status badge', async () => {
    await act(async () => {
      root.render(<UserManagerPage />);
    });

    expect(host.textContent).not.toContain('Chính sách tự động dọn dẹp tài khoản');
    expect(host.querySelector('.action-menu')?.textContent).toContain('Quét & Dọn dẹp ngay');
    expect(host.textContent).toContain('Frozen Member');
    expect(host.textContent).toContain('Đang bảo lưu tập');
    expect(host.textContent).toContain('Inactive Coach');
  });

  it('P1-FE-22: protects last active ADMIN instead of CENTER_MANAGER and soft deletes a user', async () => {
    await act(async () => {
      root.render(<UserManagerPage />);
    });

    // Tìm các nút xóa trong bảng
    const deleteButtons = [...host.querySelectorAll('button')].filter(
      (b) => b.textContent?.trim() === 'Xóa'
    ) as HTMLButtonElement[];
    expect(deleteButtons.length).toBe(4);

    // Nút đầu tiên thuộc về ADMIN cuối cùng nên phải bị vô hiệu hóa; CENTER_MANAGER (nút thứ 2) được phép thao tác
    expect(deleteButtons[0].disabled).toBe(true);
    expect(deleteButtons[1].disabled).toBe(false);
    expect(deleteButtons[1].className).toContain('btn-danger');

    // Nhấn xóa trên Inactive Coach (nút xóa thứ 4)
    await act(async () => {
      deleteButtons[3].click();
    });

    // Hộp thoại xác nhận phải được mở và dùng .portal-alert--warning
    expect(host.textContent).toContain('Xác nhận xóa tài khoản');
    expect(host.textContent).toContain('Inactive Coach');
    expect(host.querySelector('dialog .portal-alert.portal-alert--warning')).not.toBeNull();

    // Nhấn xác nhận xóa
    const confirmBtn = button(host, 'Xác nhận xóa');
    expect(confirmBtn).toBeTruthy();

    await act(async () => {
      confirmBtn?.click();
    });

    expect(userApi.deleteUser).toHaveBeenCalledWith('3');
  });

  it('triggers manual cleanup modal with MEMBER-only copy, calls cleanupInactiveUsers, and reloads deleted users', async () => {
    await act(async () => {
      root.render(<UserManagerPage />);
    });

    const cleanupTriggerBtn = button(host, 'Quét & Dọn dẹp ngay');
    expect(cleanupTriggerBtn).toBeTruthy();

    await act(async () => {
      cleanupTriggerBtn?.click();
    });

    expect(host.textContent).toContain('Quét & dọn dẹp tài khoản quá 6 tháng');
    expect(host.textContent).toContain('Chỉ áp dụng cho tài khoản Hội viên');
    expect(host.textContent).not.toContain('(frozen)');

    const dialogBeforeCleanup = host.querySelector<HTMLDialogElement>('dialog[open]')!;
    expect(button(dialogBeforeCleanup, 'Hủy')).toBeTruthy();
    const startBtn = button(dialogBeforeCleanup, 'Bắt đầu quét & dọn dẹp');
    expect(startBtn).toBeTruthy();

    await act(async () => {
      startBtn?.click();
    });

    expect(userApi.cleanupInactiveUsers).toHaveBeenCalledTimes(1);
    expect(userApi.getDeletedUsers).toHaveBeenCalledTimes(2);

    const dialogAfterCleanup = host.querySelector<HTMLDialogElement>('dialog[open]')!;
    expect(dialogAfterCleanup).not.toBeNull();
    expect(dialogAfterCleanup.querySelector('.portal-alert.portal-alert--success')).not.toBeNull();
    expect(dialogAfterCleanup.textContent).toContain('Đã dọn dẹp 1 tài khoản không hoạt động.');
    expect(button(dialogAfterCleanup, 'Đóng')).toBeUndefined();
    expect(button(dialogAfterCleanup, 'Close')).toBeUndefined();
    expect(button(dialogAfterCleanup, 'Hủy')).toBeUndefined();
    expect(button(dialogAfterCleanup, 'Bắt đầu quét & dọn dẹp')).toBeUndefined();

    const closeIconBtn = dialogAfterCleanup.querySelector<HTMLButtonElement>('.portal-dialog__close');
    expect(closeIconBtn).not.toBeNull();
    await act(async () => {
      closeIconBtn!.click();
    });
    expect(host.querySelector('dialog')).toBeNull();
  });

  it('blocks creating a user when email or phone number already exists in the user list', async () => {
    await act(async () => {
      root.render(<UserManagerPage />);
    });

    const addBtn = button(host, 'Thêm tài khoản');
    expect(addBtn).toBeTruthy();
    await act(async () => {
      addBtn?.click();
    });

    // Hàm trợ giúp nhập liệu hoặc thao tác trên biểu mẫu trong DOM giả.
    const setInput = async (id: string, value: string) => {
      const input = document.querySelector<HTMLInputElement>(`#${id}`)!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };

    await setInput('user-name', '');
    await setInput('user-email', 'COACH@scms.local');
    await setInput('user-phone', '0901000003');
    await setInput('user-pass', 'weak');

    const form = document.querySelector('form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(userApi.createUser).not.toHaveBeenCalled();
    expect(document.querySelector('#user-name')?.getAttribute('aria-invalid')).toBe('true');
    expect(document.querySelector('#user-pass')?.getAttribute('aria-invalid')).toBe('true');
    expect(document.querySelector('#user-name-error')?.getAttribute('role')).toBe('alert');
    expect(document.querySelector('#user-pass-error')?.getAttribute('role')).toBe('alert');
    expect(document.body.textContent).toContain('Email đã tồn tại');
    expect(document.body.textContent).toContain('Số điện thoại đã tồn tại');
  });

  it('P1-FE-22 & P2-FE-71: surfaces trash load error without empty state and retries cleanly', async () => {
    vi.mocked(userApi.getDeletedUsers)
      .mockRejectedValueOnce(new Error('Không tải được thùng rác'))
      .mockResolvedValueOnce([]);

    await act(async () => {
      root.render(<UserManagerPage />);
    });

    const tabs = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs).toHaveLength(3);
    expect(host.querySelector('[role="tablist"]')).not.toBeNull();
    expect(host.querySelector('.portal-header .btn-primary')?.textContent).toContain('Thêm tài khoản');

    await act(async () => tabs[1].click());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Không tải được thùng rác');
    expect(host.textContent).not.toContain('Thùng rác trống');

    const retryBtn = host.querySelector<HTMLButtonElement>('[role="alert"] button')!;
    await act(async () => retryBtn.click());
    expect(host.textContent).toContain('Thùng rác trống');
  });

  it('P1-FE-22, P2-FE-72 & P3-FE-27: sends empty string when clearing phone, locks in-flight permission toggle, and shows RBAC empty state', async () => {
    vi.mocked(userApi.updateUser).mockResolvedValue({ ...sampleUsers[3], phone: '' });

    await act(async () => {
      root.render(<UserManagerPage />);
    });

    // Clear phone number in Edit modal -> must pass phone: '' (not undefined)
    const editButtons = [...host.querySelectorAll<HTMLButtonElement>('tbody button')].filter((b) => b.textContent?.trim() === 'Sửa');
    await act(async () => editButtons[3].click());
    const phoneInput = document.querySelector<HTMLInputElement>('#edit-user-phone')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(phoneInput, '');
      phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      document.querySelector<HTMLFormElement>('dialog form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(userApi.updateUser).toHaveBeenCalledWith('3', expect.objectContaining({ phone: '' }));

    // Empty permissions list shows empty state in RBAC tab
    const tabs = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    await act(async () => tabs[2].click());
    expect(host.querySelector('.portal-empty')).not.toBeNull();

    // In-flight permission toggle guard prevents double-click race and passes explicit target boolean
    let resolvePerm: (() => void) | null = null;
    vi.mocked(userApi.getPermissions).mockResolvedValue([{ id: '10', code: 'CLASS_MANAGE', name: 'Quản lý lớp', module: 'CLASS' }]);
    vi.mocked(userApi.toggleRolePermission).mockImplementation(
      () => new Promise<void>((resolve) => { resolvePerm = resolve; }),
    );
    await act(async () => root.unmount());
    root = createRoot(host);
    await act(async () => root.render(<UserManagerPage />));
    const rbacTab = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')][2];
    await act(async () => rbacTab.click());

    const coachCheckbox = host.querySelector<HTMLInputElement>('input[aria-label="Quản lý lớp — Huấn luyện viên"]')!;
    expect(coachCheckbox).not.toBeNull();
    await act(async () => {
      coachCheckbox.click();
    });
    expect(coachCheckbox.disabled).toBe(true);
    await act(async () => {
      coachCheckbox.click();
    });
    expect(userApi.toggleRolePermission).toHaveBeenCalledTimes(1);
    expect(userApi.toggleRolePermission).toHaveBeenCalledWith('COACH', '10', true);
    await act(async () => {
      resolvePerm!();
      await Promise.resolve();
    });
    expect(coachCheckbox.disabled).toBe(false);
  });
});
