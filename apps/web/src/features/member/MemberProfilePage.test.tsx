import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberProfilePage } from './MemberProfilePage';
import type { Profile } from './profileApi';
import { AUTH_STORAGE_KEY } from '../../shared/api/client';
import { setLanguage } from '../../shared/i18n';

const mockApi = vi.hoisted(() => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  updateCoachProfile: vi.fn(),
  updateReceptionistProfile: vi.fn(),
  uploadAvatar: vi.fn(),
  changePassword: vi.fn(),
}));

vi.mock('./profileApi', () => ({
  getProfile: mockApi.getProfile,
  updateProfile: mockApi.updateProfile,
  updateCoachProfile: mockApi.updateCoachProfile,
  updateReceptionistProfile: mockApi.updateReceptionistProfile,
  uploadAvatar: mockApi.uploadAvatar,
  changePassword: mockApi.changePassword,
}));

const sampleProfile: Profile = {
  userId: 10,
  fullName: 'Nguyen Van Test',
  email: 'test@example.com',
  phone: '0912345678',
  dob: '1990-01-01',
  gender: 'male',
  avatarUrl: null,
  address: '123 Pho Hue, Ha Noi',
  membershipCode: 'MEM12345',
  emergencyContactName: 'Nguyen Thi Me',
  emergencyContactPhone: '0987654321',
  fitnessGoal: 'Tang co',
  healthNotes: 'Khong benh ly',
  fitnessLevel: 'beginner',
};

describe('MemberProfilePage role-based profile & avatar upload', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    mockApi.getProfile.mockReset();
    mockApi.updateProfile.mockReset();
    mockApi.updateCoachProfile.mockReset();
    mockApi.updateReceptionistProfile.mockReset();
    mockApi.uploadAvatar.mockReset();

    mockApi.getProfile.mockResolvedValue(sampleProfile);
    mockApi.updateCoachProfile.mockResolvedValue(undefined);
    mockApi.updateReceptionistProfile.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    localStorage.clear();
    setLanguage('vi');
    vi.unstubAllGlobals();
  });

  // Dựng component vào DOM giả để kiểm thử.
  async function renderPage() {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <MemberProfilePage />
        </MemoryRouter>
      );
    });
  }

  it('shows a single personal profile without loading health metrics for MEMBER role', async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ id: '10', name: 'Nguyen Van Test', identifier: 'member1', role: 'MEMBER' })
    );

    await renderPage();

    expect(mockApi.getProfile).toHaveBeenCalled();

    expect(host.textContent).not.toContain('Chỉ số sức khỏe');
    expect(host.querySelector('h1')?.textContent).toBe('Hồ sơ cá nhân');
    expect(host.querySelector('.profile-grid--single')).not.toBeNull();
    expect(host.querySelectorAll('.portal-card')).toHaveLength(1);
    expect(host.querySelector('#health-metric-type')).toBeNull();
    expect(host.querySelector('.profile-metric-form')).toBeNull();
    expect(host.textContent).toContain('Mã hội viên');
    expect(host.textContent).toContain('Trình độ thể lực');
    expect(host.textContent).toContain('Mục tiêu thể lực');
    expect(host.textContent).toContain('Ghi chú sức khỏe & chấn thương');
    expect(host.textContent).toContain('Tải ảnh đại diện lên');
  });

  it('saves the personal profile without mutating health measurements', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ id: '10', name: 'Member', identifier: 'member1', role: 'MEMBER' }));
    mockApi.updateProfile.mockResolvedValue(sampleProfile);
    await renderPage();
    await act(async () => host.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(mockApi.updateProfile).toHaveBeenCalledWith(sampleProfile);
  });

  it('retains profile form and reports save failure', async () => {
    mockApi.updateProfile.mockRejectedValue(new Error('Cannot save'));
    await renderPage();
    await act(async () => host.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect((host.querySelector('#fullName') as HTMLInputElement).value).toBe(sampleProfile.fullName);
    expect((host.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('preserves unsaved profile edits when resetting the avatar, including edits during the request', async () => {
    mockApi.getProfile.mockResolvedValue({ ...sampleProfile, avatarUrl: 'https://example.test/avatar.png' });
    let finish!: (profile: Profile) => void;
    mockApi.uploadAvatar.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    await renderPage();
    const name = host.querySelector<HTMLInputElement>('#fullName')!;
    // Hàm trợ giúp nhập liệu hoặc thao tác trên biểu mẫu trong DOM giả.
    const editName = async (value: string) => act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, value);
      name.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await editName('Draft name');
    await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Đặt lại ảnh mặc định')!.click());
    expect(mockApi.uploadAvatar).toHaveBeenCalledWith(null);
    await editName('Newer draft');
    await act(async () => finish({ ...sampleProfile, avatarUrl: '/images/default-avatar.png' }));
    expect(name.value).toBe('Newer draft');
    expect(host.querySelector<HTMLImageElement>('img[alt="Ảnh đại diện hiện tại"]')?.getAttribute('src')).toBe('/images/default-avatar.png');
    expect(mockApi.updateProfile).not.toHaveBeenCalled();
  });

  it('enforces avatar MIME type and 2MB size constraints before uploading', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ id: '10', name: 'Member', identifier: 'member1', role: 'MEMBER' }));
    await renderPage();
    const input = host.querySelector<HTMLInputElement>('#avatar-file-input')!;
    expect(input).not.toBeNull();

    const invalidTypeFile = new File(['bad'], 'avatar.gif', { type: 'image/gif' });
    await act(async () => {
      Object.defineProperty(input, 'files', { value: [invalidTypeFile], configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Chỉ chấp nhận ảnh JPG, PNG hoặc WebP');
    expect(mockApi.updateProfile).not.toHaveBeenCalled();

    const oversizedFile = new File([new Uint8Array(2 * 1024 * 1024 + 100)], 'huge.png', { type: 'image/png' });
    await act(async () => {
      Object.defineProperty(input, 'files', { value: [oversizedFile], configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('không được vượt quá 2MB');
    expect(mockApi.updateProfile).not.toHaveBeenCalled();
  });

  it('hides health metrics section and renders editable professional fields for COACH role', async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ id: '20', name: 'Coach Huấn Luyện', identifier: 'coach1', role: 'COACH' })
    );
    mockApi.getProfile.mockResolvedValue({
      ...sampleProfile,
      specialization: 'Yoga',
      certification: 'RYT-500',
      bio: '10 năm kinh nghiệm',
    });
    mockApi.updateProfile.mockResolvedValue({
      ...sampleProfile,
      specialization: 'Pilates',
      certification: 'RYT-500',
      bio: '10 năm kinh nghiệm',
    });

    await renderPage();

    expect(mockApi.getProfile).toHaveBeenCalled();

    expect(host.textContent).not.toContain('Chỉ số sức khỏe');
    expect(host.textContent).not.toContain('Mã hội viên');
    expect(host.textContent).not.toContain('Trình độ thể lực');
    expect(host.textContent).toContain('Huấn luyện viên');
    expect((host.querySelector('#specialization') as HTMLInputElement).value).toBe('Yoga');
    expect((host.querySelector('#certification') as HTMLInputElement).value).toBe('RYT-500');

    await act(async () => {
      const specInput = host.querySelector<HTMLInputElement>('#specialization')!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(specInput, 'Pilates');
      specInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => host.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(mockApi.updateCoachProfile).toHaveBeenCalledWith({
      specialization: 'Pilates',
      certification: 'RYT-500',
      bio: '10 năm kinh nghiệm',
    });
  });

  it('hides health metrics section and renders editable shift field for STAFF (Receptionist) role', async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ id: '30', name: 'Le Tan Quầy', identifier: 'staff1', role: 'STAFF' })
    );
    mockApi.getProfile.mockResolvedValue({
      ...sampleProfile,
      shift: 'Ca sáng',
    });
    mockApi.updateProfile.mockResolvedValue({
      ...sampleProfile,
      shift: 'Ca chiều',
    });

    await renderPage();

    expect(mockApi.getProfile).toHaveBeenCalled();

    expect(host.textContent).not.toContain('Chỉ số sức khỏe');
    expect(host.textContent).not.toContain('Mã hội viên');
    expect(host.textContent).toContain('Lễ tân');
    expect((host.querySelector('#shift') as HTMLInputElement).value).toBe('Ca sáng');

    await act(async () => {
      const shiftInput = host.querySelector<HTMLInputElement>('#shift')!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(shiftInput, 'Ca chiều');
      shiftInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => host.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(mockApi.updateReceptionistProfile).toHaveBeenCalledWith({ shift: 'Ca chiều' });
  });

  it.each([['MANAGER', 'Quản lý trung tâm'], ['ADMIN', 'Quản trị hệ thống']])('shows the correct administrative profile without member fields: %s', async (role, label) => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ id: '1', name: 'Admin Manager', identifier: 'admin', role })
    );

    await renderPage();

    expect(mockApi.getProfile).toHaveBeenCalled();

    expect(host.textContent).not.toContain('Chỉ số sức khỏe');
    expect(host.textContent).not.toContain('Mã hội viên');
    expect(host.textContent).toContain(label);
  });

  it('rejects images smaller than 100x100 px and falls back to default avatar on broken image URL', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ id: '10', name: 'Member', identifier: 'member1', role: 'MEMBER' }));
    mockApi.getProfile.mockResolvedValue({ ...sampleProfile, avatarUrl: 'https://broken.example.test/avatar.png' });

    const OrigFileReader = globalThis.FileReader;
    // Lớp giả lập dùng trong kiểm thử.
    class MockFileReader {
      result: string | null = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
      // Callback khi đọc file thành công.
      onload: (() => void) | null = null;
      // Callback khi đọc file lỗi.
      onerror: (() => void) | null = null;
      readAsDataURL() {
        if (this.onload) this.onload();
      }
    }
    vi.stubGlobal('FileReader', MockFileReader as unknown as typeof FileReader);

    // Lớp giả lập dùng trong kiểm thử.
    class MockTinyImage {
      naturalWidth = 50;
      naturalHeight = 50;
      width = 50;
      height = 50;
      // Callback khi tải ảnh thành công.
      onload: (() => void) | null = null;
      // Callback khi tải ảnh lỗi.
      onerror: (() => void) | null = null;
      set src(_val: string) {
        if (this.onload) this.onload();
      }
    }
    vi.stubGlobal('Image', MockTinyImage as unknown as typeof Image);

    await renderPage();

    const img = host.querySelector<HTMLImageElement>('img[alt="Ảnh đại diện hiện tại"]')!;
    expect(img.getAttribute('src')).toBe('https://broken.example.test/avatar.png');
    await act(async () => {
      img.dispatchEvent(new Event('error'));
    });
    expect(img.getAttribute('src')).toBe('/images/default-avatar.png');

    const input = host.querySelector<HTMLInputElement>('#avatar-file-input')!;
    const tinyFile = new File([new Uint8Array([1, 2, 3, 4])], 'tiny.png', { type: 'image/png' });
    await act(async () => {
      Object.defineProperty(input, 'files', { value: [tinyFile], configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('100x100 đến 4096x4096 pixel');
    expect(mockApi.uploadAvatar).not.toHaveBeenCalled();

    vi.stubGlobal('FileReader', OrigFileReader);
  });

  it('translates account role badge when switched to English', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ id: '20', name: 'Coach Test', identifier: 'coach1', role: 'COACH' }));
    setLanguage('en');
    await renderPage();
    expect(host.textContent).toContain('Account role');
    expect(host.textContent).toContain('Coach');
    setLanguage('vi');
  });

  it('allows changing password inside the single profile card', async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ id: '10', name: 'Member', identifier: 'member1', role: 'MEMBER' })
    );
    mockApi.changePassword.mockResolvedValue(undefined);
    await renderPage();

    const toggleBtn = host.querySelector<HTMLButtonElement>('#toggle-password-change-btn');
    expect(toggleBtn).not.toBeNull();
    await act(async () => toggleBtn!.click());

    expect(host.querySelectorAll('.portal-card')).toHaveLength(1);
    const currentInput = host.querySelector<HTMLInputElement>('#currentPassword')!;
    const newInput = host.querySelector<HTMLInputElement>('#newPassword')!;
    const confirmInput = host.querySelector<HTMLInputElement>('#confirmPassword')!;

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(currentInput, 'OldPass123');
      currentInput.dispatchEvent(new Event('input', { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(newInput, 'NewPass456');
      newInput.dispatchEvent(new Event('input', { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(confirmInput, 'NewPass456');
      confirmInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const submitPwdBtn = host.querySelector<HTMLButtonElement>('#submit-password-change-btn')!;
    await act(async () => submitPwdBtn.click());

    expect(mockApi.changePassword).toHaveBeenCalledWith('OldPass123', 'NewPass456');
  });

  it('shows password mistakes right under each field and does not call the API', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ id: '10', name: 'Member', identifier: 'member1', role: 'MEMBER' }));
    await renderPage();
    await act(async () => host.querySelector<HTMLButtonElement>('#toggle-password-change-btn')!.click());
    // Hàm trợ giúp nhập liệu hoặc thao tác trên biểu mẫu trong DOM giả.
    const type = (id: string, value: string) => {
      const input = host.querySelector<HTMLInputElement>(`#${id}`)!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    expect(host.querySelector('#newPassword-hint')!.textContent).toContain('8–50 ký tự');
    await act(async () => { type('currentPassword', 'x'); type('newPassword', 'ab'); type('confirmPassword', 'a'); });
    await act(async () => host.querySelector<HTMLButtonElement>('#submit-password-change-btn')!.click());

    expect(host.querySelector('#newPassword-hint')!.textContent).toContain('ít nhất 1 chữ cái và 1 chữ số');
    expect(host.querySelector('#confirmPassword-error')!.textContent).toContain('không khớp');
    expect(host.querySelector('#newPassword')!.getAttribute('aria-invalid')).toBe('true');
    expect(mockApi.changePassword).not.toHaveBeenCalled();
  });

  it('displays member KYC verification status inside the single profile card', async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ id: '10', name: 'Member', identifier: 'member1', role: 'MEMBER' })
    );
    mockApi.getProfile.mockResolvedValue({ ...sampleProfile, identityVerified: false, kycStatus: null });
    await renderPage();

    expect(host.querySelectorAll('.portal-card')).toHaveLength(1);
    const kycBox = host.querySelector('[data-testid="member-kyc-status"]');
    expect(kycBox).not.toBeNull();
    expect(kycBox?.textContent).toContain('Chưa xác minh');
    expect(kycBox?.querySelector('a')?.getAttribute('href')).toBe('/member/packages/checkout');

    await act(async () => setLanguage('en'));
    expect(kycBox?.textContent).toContain('Identity verification');
    expect(kycBox?.textContent).toContain('Not verified');
  });
});
