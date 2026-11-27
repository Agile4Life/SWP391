import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { StaffAccountsPage } from './StaffAccountsPage';
import { createStaffAccount, listStaffAccounts, setStaffAccountLocked } from './staffAccountsApi';

vi.mock('./staffAccountsApi', () => ({ createStaffAccount: vi.fn(), listStaffAccounts: vi.fn(), setStaffAccountLocked: vi.fn() }));
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  vi.mocked(listStaffAccounts).mockResolvedValue([]);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

it('offers only Coach and Receptionist and creates an account using the provisioned email', async () => {
  vi.mocked(createStaffAccount).mockResolvedValue({ id: 4, fullName: 'New Coach', email: 'coach@gmail.com', roleCode: 'COACH', status: 'active' });
  await act(async () => root.render(<StaffAccountsPage />));
  expect(host.textContent).toContain('Chưa có tài khoản nhân sự');
  const genderSelect = host.querySelector('#staff-gender')!.parentElement!.querySelector('select')!;
  expect([...genderSelect.options].map(option => option.textContent)).toEqual(['Nam', 'Nữ']);
  await act(async () => host.querySelector<HTMLButtonElement>('#staff-role')!.click());
  expect([...host.querySelectorAll('[role="option"]')].map(option => option.textContent?.trim())).toEqual(['Huấn luyện viên', 'Lễ tân']);
  await act(async () => host.querySelector<HTMLButtonElement>('#staff-role')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  // Hàm trợ giúp nhập liệu hoặc thao tác trên biểu mẫu trong DOM giả.
  const setInput = async (id: string, value: string) => {
    const input = host.querySelector<HTMLInputElement>(`#${id}`)!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  await setInput('staff-name', 'New Coach');
  await setInput('staff-email', 'coach@gmail.com');
  await setInput('staff-password', 'Secret123!');
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(createStaffAccount).toHaveBeenCalledWith({ fullName: 'New Coach', email: 'coach@gmail.com', phone: undefined, password: 'Secret123!', gender: 'male', roleCode: 'COACH' });
  expect(host.querySelector('tbody')?.textContent).toContain('coach@gmail.com');
  expect(host.querySelector<HTMLInputElement>('#staff-password')?.value).toBe('');
  expect(host.textContent).not.toContain('Phân quyền');
});

it('shows a load failure with retry and never treats it as an empty list', async () => {
  vi.mocked(listStaffAccounts).mockRejectedValueOnce(new Error('Không thể kết nối'));
  await act(async () => root.render(<StaffAccountsPage />));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Không thể kết nối');
  expect(host.textContent).not.toContain('Chưa có tài khoản nhân sự');
  expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Thử lại')!.click());
  expect(host.textContent).toContain('Chưa có tài khoản nhân sự');
});

it('locks and unlocks a staff account from the list after confirmation and reports a failed change', async () => {
  const coach = { id: 8, fullName: 'Coach A', email: 'a@gmail.com', roleCode: 'COACH' as const, status: 'active' };
  vi.mocked(listStaffAccounts).mockResolvedValue([coach]);
  vi.mocked(setStaffAccountLocked).mockResolvedValueOnce({ ...coach, status: 'locked' });
  await act(async () => root.render(<StaffAccountsPage />));
  // Hàm trợ giúp tìm phần tử (nút/tab) trong DOM giả hoặc bấm vào nó.
  const rowButton = () => host.querySelector<HTMLButtonElement>('tbody button')!;
  expect(rowButton().textContent).toBe('Khóa');
  await act(async () => rowButton().click());
  const confirmLock = [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find(btn => btn.textContent === 'Khóa tài khoản')!;
  expect(confirmLock).toBeDefined();
  await act(async () => confirmLock.click());
  expect(setStaffAccountLocked).toHaveBeenLastCalledWith(8, true);
  expect(host.querySelector('tbody')?.textContent).toContain('Đã khóa');
  expect(rowButton().textContent).toBe('Mở khóa');
  vi.mocked(setStaffAccountLocked).mockRejectedValueOnce(new Error('Không thể mở khóa'));
  await act(async () => rowButton().click());
  const confirmUnlock = [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find(btn => btn.textContent === 'Mở khóa')!;
  expect(confirmUnlock).toBeDefined();
  await act(async () => confirmUnlock.click());
  expect(setStaffAccountLocked).toHaveBeenLastCalledWith(8, false);
  expect(host.querySelector('tbody')?.textContent).toContain('Đã khóa');
});

it('rejects duplicate email and phone number before calling createStaffAccount', async () => {
  vi.mocked(listStaffAccounts).mockResolvedValue([
    { id: 8, fullName: 'Coach A', email: 'coach.a@gmail.com', phone: '0901234567', roleCode: 'COACH', status: 'active' },
  ]);
  await act(async () => root.render(<StaffAccountsPage />));
  // Hàm trợ giúp nhập liệu hoặc thao tác trên biểu mẫu trong DOM giả.
  const setInput = async (id: string, value: string) => {
    const input = host.querySelector<HTMLInputElement>(`#${id}`)!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  await setInput('staff-name', 'Coach Duplicate Email');
  await setInput('staff-email', '  COACH.A@gmail.com ');
  await setInput('staff-password', 'Secret123!');
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(createStaffAccount).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Email đã tồn tại');

  await setInput('staff-email', 'coach.b@gmail.com');
  await setInput('staff-phone', '+84 901 234 567');
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(createStaffAccount).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Số điện thoại đã tồn tại');
});

it('sorts staff accounts by name only', async () => {
  const staffList = [
    { id: 1, fullName: 'Bùi Văn B', email: 'b@sol.vn', roleCode: 'RECEPTIONIST' as const, status: 'locked' as const },
    { id: 2, fullName: 'An Thị A', email: 'a@sol.vn', roleCode: 'COACH' as const, status: 'active' as const },
    { id: 3, fullName: 'Cù Trọng C', email: 'c@sol.vn', roleCode: 'COACH' as const, status: 'active' as const },
  ];
  vi.mocked(listStaffAccounts).mockResolvedValue(staffList);
  await act(async () => root.render(<StaffAccountsPage />));

  // Tên các tài khoản đang hiển thị trong bảng.
  const getRenderedNames = () =>
    [...host.querySelectorAll('tbody tr')].map(tr => tr.querySelector('td')?.textContent?.trim());

  // Default: name_asc -> An Thị A, Bùi Văn B, Cù Trọng C
  expect(getRenderedNames()).toEqual(['An Thị A', 'Bùi Văn B', 'Cù Trọng C']);

  const sortSelect = host.querySelector('select[aria-label="Sắp xếp danh sách nhân sự"]') as HTMLSelectElement;
  expect(sortSelect).toBeTruthy();
  expect([...sortSelect.options].map(option => option.value)).toEqual(['name_asc', 'name_desc']);

  // Sort name_desc -> Cù Trọng C, Bùi Văn B, An Thị A
  await act(async () => {
    sortSelect.value = 'name_desc';
    sortSelect.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(getRenderedNames()).toEqual(['Cù Trọng C', 'Bùi Văn B', 'An Thị A']);

});

it('P1-FE-21 & P2-FE-41: enforces PasswordPolicy (min 8 chars with letter+number, no spaces), requires trimmed fullName >= 2, and avoids undefined CSS token', async () => {
  await act(async () => root.render(<StaffAccountsPage />));
  const setInput = async (id: string, value: string) => {
    const input = host.querySelector<HTMLInputElement>(`#${id}`)!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  const passwordInput = host.querySelector<HTMLInputElement>('#staff-password')!;
  expect(passwordInput.minLength).toBe(8);
  expect(host.textContent).toContain('8–50 ký tự');

  // Whitespace-only name & weak 6-char password rejected before API call
  await setInput('staff-name', '   ');
  await setInput('staff-email', 'valid.staff@sol.vn');
  await setInput('staff-password', '123456');
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(createStaffAccount).not.toHaveBeenCalled();
  expect(host.querySelector('#staff-name-error')?.textContent).toContain('tối thiểu 2 ký tự');
  expect(host.querySelector('#staff-password-error')?.textContent).toContain('8–50 ký tự');

  // Password with spaces is also rejected
  await setInput('staff-name', 'Nguyễn Văn A');
  await setInput('staff-password', 'Secret 123');
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(createStaffAccount).not.toHaveBeenCalled();
  expect(host.querySelector('#staff-password-error')?.textContent).toContain('không chứa khoảng trắng');

  // Sort label uses valid --portal-muted token, not nonexistent --sol-text-muted
  const sortLabel = host.querySelector<HTMLLabelElement>('label[for="staff-sort-select"]')!;
  expect(sortLabel.getAttribute('style')).toContain('--portal-muted');
  expect(sortLabel.getAttribute('style')).not.toContain('--sol-text-muted');
});

it('does not falsely mark both email and phone invalid on ambiguous combined duplicate backend errors', async () => {
  vi.mocked(createStaffAccount).mockRejectedValueOnce(new Error('Email hoặc số điện thoại nhân sự đã tồn tại'));
  await act(async () => root.render(<StaffAccountsPage />));
  const setInput = async (id: string, value: string) => {
    const input = host.querySelector<HTMLInputElement>(`#${id}`)!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  await setInput('staff-name', 'Nguyễn Văn B');
  await setInput('staff-email', 'new.staff@sol.vn');
  await setInput('staff-phone', '0912345678');
  await setInput('staff-password', 'Secret123!');
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

  expect(host.querySelector('#staff-email')?.getAttribute('aria-invalid')).toBe('false');
  expect(host.querySelector('#staff-phone')?.getAttribute('aria-invalid')).toBe('false');
  expect(host.querySelector('.portal-alert[role="alert"]')?.textContent).toContain('Email hoặc số điện thoại nhân sự đã tồn tại');

  // Unambiguous single-field backend error still marks only that field
  vi.mocked(createStaffAccount).mockRejectedValueOnce(new Error('Email already exists'));
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(host.querySelector('#staff-email')?.getAttribute('aria-invalid')).toBe('true');
  expect(host.querySelector('#staff-phone')?.getAttribute('aria-invalid')).toBe('false');
});
