import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLanguage } from '../../shared/i18n/language';
import { ManagerCatalogsPage } from './ManagerCatalogsPage';
import { catalogApi } from './catalogApi';

vi.mock('./catalogApi', () => ({
  catalogApi: {
    disciplines: vi.fn().mockResolvedValue([
      { id: 1, name: 'Gym', description: 'Sức mạnh' },
      { id: 2, name: 'Reformer Pilates', description: 'Pilates' },
    ]),
    rooms: vi.fn().mockResolvedValue([
      {
        id: 1,
        name: 'Phòng Gym Tiêu chuẩn',
        location: 'Tầng 1',
        capacity: 50,
        status: 'available',
        tier: 'STANDARD',
      },
    ]),
    packages: vi.fn().mockResolvedValue([
      {
        id: 10,
        name: 'SILVER',
        description: 'BASIC – Cơ bản',
        price: 199000,
        durationDays: 30,
        classCreditLimit: 2,
        status: 'active',
        tier: 'SILVER',
      },
      {
        id: 11,
        name: 'GOLD',
        description: 'STANDARD – Trung cấp',
        price: 299000,
        durationDays: 30,
        classCreditLimit: 5,
        status: 'active',
        tier: 'GOLD',
      },
      {
        id: 12,
        name: 'PLATINUM',
        description: 'VIP – Cao cấp',
        price: 599000,
        durationDays: 30,
        classCreditLimit: null,
        status: 'active',
        tier: 'PLATINUM',
      },
    ]),
    saveDiscipline: vi.fn().mockResolvedValue({}),
    deleteDiscipline: vi.fn().mockResolvedValue(undefined),
    updateRoom: vi.fn().mockResolvedValue({}),
    createRoom: vi.fn().mockResolvedValue({}),
    deleteRoom: vi.fn().mockResolvedValue(undefined),
    savePackage: vi.fn().mockResolvedValue({}),
    deletePackage: vi.fn().mockResolvedValue(undefined),
    setPackageStatus: vi.fn().mockResolvedValue({}),
  },
}));

describe('ManagerCatalogsPage (A6: Package & Price CRUD)', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    setLanguage('vi');
    vi.unstubAllGlobals();
  });

  const setFieldValue = async (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    await act(async () => {
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };

  const selectOption = async (triggerId: string, optionLabel: string) => {
    const trigger = host.querySelector<HTMLButtonElement>(`button#${triggerId}`)!;
    expect(trigger).not.toBeNull();
    await act(async () => trigger.click());
    const option = [...host.querySelectorAll<HTMLLIElement>('[role="option"]')].find((item) =>
      item.textContent?.includes(optionLabel),
    )!;
    expect(option).toBeDefined();
    await act(async () => option.click());
  };

  const switchTab = async (tabLabel: string) => {
    const btn = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((b) =>
      b.textContent?.includes(tabLabel),
    )!;
    expect(btn).toBeDefined();
    await act(async () => btn.click());
  };

  const submitDialogForm = async () => {
    const form = host.querySelector<HTMLFormElement>('dialog form') ?? host.querySelector<HTMLFormElement>('form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
  };

  it('displays all disciplines including newly created or legacy ones and allows full package price CRUD', async () => {
    await act(async () => {
      root.render(<ManagerCatalogsPage />);
    });

    expect(host.textContent).toContain('Reformer Pilates');

    // Chuyển sang tab Gói tập
    const pkgTabBtn = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((b) =>
      b.textContent?.includes('Gói tập')
    )!;
    await act(async () => pkgTabBtn.click());

    expect(host.textContent).toContain('199.000\u00a0₫');
    expect(host.textContent).toContain('299.000\u00a0₫');
    expect(host.textContent).toContain('599.000\u00a0₫');
    expect(host.textContent).toContain('Tạo gói tập mới');

    // Cập nhật giá nhanh cho gói SILVER
    const quickPriceBtn = [...host.querySelectorAll('button')].find((b) =>
      b.textContent === 'Sửa giá nhanh'
    )!;
    await act(async () => quickPriceBtn.click());

    const quickInput = host.querySelector<HTMLInputElement>('#quick-pkg-price')!;
    expect(quickInput.value).toBe('199000');

    const plus50kBtn = [...host.querySelectorAll('button')].find((b) =>
      b.textContent === '+50k'
    )!;
    await act(async () => plus50kBtn.click());
    expect(quickInput.value).toBe('249000');

    await act(async () => {
      host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(catalogApi.savePackage).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        name: 'SILVER',
        price: 249000,
        durationDays: 30,
        tier: 'SILVER',
      })
    );
  });

  it('opens create package modal and saves a new package with tier, price, duration, and description', async () => {
    await act(async () => {
      root.render(<ManagerCatalogsPage />);
    });

    const pkgTabBtn = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((b) =>
      b.textContent?.includes('Gói tập')
    )!;
    await act(async () => pkgTabBtn.click());

    const createBtn = [...host.querySelectorAll('button')].find((b) =>
      b.textContent === 'Tạo gói tập mới'
    )!;
    await act(async () => createBtn.click());

    const nameInput = host.querySelector<HTMLInputElement>('#cat-name')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(nameInput, 'GOLD SUMMER PROMO');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      nameInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const preset299 = [...host.querySelectorAll('button')].find((b) =>
      b.textContent === '299.000\u00a0₫'
    )!;
    await act(async () => preset299.click());

    await act(async () => {
      host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(catalogApi.savePackage).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        name: 'GOLD SUMMER PROMO',
        price: 299000,
        durationDays: 90,
        status: 'active',
      })
    );
  });

  it('P2-FE-43, P2-FE-45 & P3-FE-21: respects explicit room tier, separates loadError/formError, hides table on loadError, enforces trim/maxLength, uses btn-danger and accessible tabs, and translates EN strings', async () => {
    vi.mocked(catalogApi.rooms).mockResolvedValueOnce([
      {
        id: 5,
        name: 'Phòng VIP Tiêu chuẩn',
        location: 'Tầng 1',
        capacity: 25,
        status: 'available',
        tier: 'STANDARD',
      },
    ]);

    await act(async () => {
      root.render(<ManagerCatalogsPage />);
    });

    // Accessible tablist & portal-tab-count
    expect(host.querySelector('[role="tablist"]')).not.toBeNull();
    const tabs = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs).toHaveLength(3);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].querySelector('.portal-tab-count')?.textContent).toBe('2');

    // Delete buttons use btn-danger btn-sm
    const deleteBtns = [...host.querySelectorAll<HTMLButtonElement>('tbody button')].filter((b) => b.textContent?.trim() === 'Xóa');
    expect(deleteBtns[0].className).toContain('btn-danger');
    expect(deleteBtns[0].className).toContain('btn-sm');

    // Room with explicit tier STANDARD stays Standard even if name includes "VIP"
    await act(async () => tabs[1].click());
    expect(host.querySelector('tbody')?.textContent).toContain('Tiêu chuẩn');
    expect(host.querySelector('tbody')?.textContent).not.toContain('Cao cấp (Platinum)');

    // Modal form error does not duplicate on page level & trims blank name
    vi.mocked(catalogApi.updateRoom).mockRejectedValueOnce(new Error('Trùng tên phòng'));
    expect(host.querySelector('.portal-header .btn-primary')).not.toBeNull();
    expect([...host.querySelectorAll('tbody button')].some((b) => b.textContent?.trim() === 'Xóa')).toBe(true);
    const roomEditBtn = [...host.querySelectorAll<HTMLButtonElement>('tbody tr:first-child button')].find((b) => b.textContent?.trim() === 'Chỉnh sửa')!;
    await act(async () => roomEditBtn.click());
    const nameInput = host.querySelector<HTMLInputElement>('#cat-name')!;
    expect(nameInput.maxLength).toBe(100);
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(nameInput, '   ');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(catalogApi.updateRoom).not.toHaveBeenCalled();
    expect(host.querySelectorAll('[role="alert"]')).toHaveLength(1);

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(nameInput, 'Studio Mới');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    // Error stays inside modal only (1 alert, not 2)
    expect(host.querySelectorAll('[role="alert"]')).toHaveLength(1);
    expect(host.querySelector('dialog [role="alert"]')?.textContent).toContain('Trùng tên phòng');

    // EN translations for 9 months preset & duration rule
    await act(async () => {
      setLanguage('en');
    });
    await act(async () => tabs[2].click());
    const addPkgBtn = host.querySelector<HTMLButtonElement>('.portal-header .btn-primary')!;
    await act(async () => addPkgBtn.click());
    expect(host.textContent).toContain('9 months (270 days)');

    // Load error hides empty table completely
    vi.mocked(catalogApi.disciplines).mockRejectedValueOnce(new Error('Catalog offline'));
    await act(async () => root.unmount());
    root = createRoot(host);
    await act(async () => {
      root.render(<ManagerCatalogsPage />);
    });
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Catalog offline');
    expect(host.querySelector('table')).toBeNull();
  });

  // ── Disciplines (Bộ môn) tab coverage (P2-E2E-02) ─────────────────────────────────────

  it('Disciplines tab: renders descriptions, missing-description fallback, and empty state CTA', async () => {
    vi.mocked(catalogApi.disciplines).mockResolvedValueOnce([
      { id: 1, name: 'Gym', description: 'Sức mạnh tổng hợp' },
      { id: 2, name: 'Boxing', description: null },
    ]);

    await act(async () => {
      root.render(<ManagerCatalogsPage />);
    });

    const rows = [...host.querySelectorAll('tbody tr')];
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Gym');
    expect(rows[0].textContent).toContain('Sức mạnh tổng hợp');
    expect(rows[1].textContent).toContain('Boxing');
    expect(rows[1].textContent).toContain('Không có mô tả');

    // Empty state renders message & working "Thêm mới" CTA
    vi.mocked(catalogApi.disciplines).mockResolvedValueOnce([]);
    await act(async () => root.unmount());
    root = createRoot(host);
    await act(async () => {
      root.render(<ManagerCatalogsPage />);
    });

    expect(host.querySelector('table')).toBeNull();
    expect(host.textContent).toContain('Chưa có bộ môn nào');
    const emptyAddBtn = host.querySelector<HTMLButtonElement>('.portal-state .btn-primary')!;
    expect(emptyAddBtn).not.toBeNull();
    await act(async () => emptyAddBtn.click());
    expect(host.querySelector('dialog')?.textContent).toContain('Thêm bộ môn');
  });

  it('Disciplines tab: creates a discipline with trimmed name and description and reloads catalog', async () => {
    await act(async () => {
      root.render(<ManagerCatalogsPage />);
    });

    const addBtn = host.querySelector<HTMLButtonElement>('.portal-header .btn-primary')!;
    await act(async () => addBtn.click());

    const dialog = host.querySelector('dialog')!;
    expect(dialog.textContent).toContain('Thêm bộ môn');
    expect(dialog.querySelector('#cat-tier')).toBeNull();
    expect(dialog.querySelector('#cat-capacity')).toBeNull();
    expect(dialog.querySelector('#cat-status')).toBeNull();

    await setFieldValue(dialog.querySelector<HTMLInputElement>('#cat-name')!, '  Yoga Bay  ');
    await setFieldValue(dialog.querySelector<HTMLTextAreaElement>('#cat-desc')!, '  Tăng dẻo dai và cân bằng  ');
    await submitDialogForm();

    expect(catalogApi.saveDiscipline).toHaveBeenCalledWith(null, {
      name: 'Yoga Bay',
      description: 'Tăng dẻo dai và cân bằng',
    });
    expect(host.querySelector('dialog[open]')?.textContent).toContain('Thành công');
    expect(host.querySelector('dialog[open] .portal-alert--success svg')).toBeNull();
    expect(document.querySelector('.sol-toast')).toBeNull();
    expect(
      [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find(
        (b) => b.textContent?.trim() === 'Đóng' || b.textContent?.trim() === 'Close',
      ),
    ).toBeUndefined();
    await act(async () => host.querySelector<HTMLButtonElement>('dialog .portal-dialog__close')!.click());
    expect(host.querySelector('dialog')).toBeNull();
    expect(catalogApi.disciplines).toHaveBeenCalledTimes(2);
  });

  it('Disciplines tab: edits an existing discipline with pre-filled values', async () => {
    await act(async () => {
      root.render(<ManagerCatalogsPage />);
    });

    const editBtn = [...host.querySelectorAll<HTMLButtonElement>('tbody tr:first-child button')].find(
      (b) => b.textContent?.trim() === 'Chỉnh sửa',
    )!;
    await act(async () => editBtn.click());

    const dialog = host.querySelector('dialog')!;
    expect(dialog.textContent).toContain('Chỉnh sửa bộ môn');
    const nameInput = dialog.querySelector<HTMLInputElement>('#cat-name')!;
    const descInput = dialog.querySelector<HTMLTextAreaElement>('#cat-desc')!;
    expect(nameInput.value).toBe('Gym');
    expect(descInput.value).toBe('Sức mạnh');

    await setFieldValue(nameInput, 'Gym Hiệu Năng');
    await setFieldValue(descInput, 'Huấn luyện sức mạnh và thể lực');
    await submitDialogForm();

    expect(catalogApi.saveDiscipline).toHaveBeenCalledWith(1, {
      name: 'Gym Hiệu Năng',
      description: 'Huấn luyện sức mạnh và thể lực',
    });
    expect(catalogApi.disciplines).toHaveBeenCalledTimes(2);
  });

  it('Disciplines tab: deletes a discipline only after confirmation and survives in-use backend rejection', async () => {
    await act(async () => {
      root.render(<ManagerCatalogsPage />);
    });

    const getFirstDeleteBtn = () =>
      [...host.querySelectorAll<HTMLButtonElement>('tbody tr:first-child button')].find(
        (b) => b.textContent?.trim() === 'Xóa',
      )!;

    // Cancel confirmation -> deleteDiscipline not called
    await act(async () => getFirstDeleteBtn().click());
    expect(host.querySelector('dialog')?.textContent).toContain('Xóa bộ môn?');
    const cancelBtn = [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find(
      (b) => b.textContent?.trim() === 'Hủy',
    )!;
    await act(async () => cancelBtn.click());
    expect(catalogApi.deleteDiscipline).not.toHaveBeenCalled();

    // Confirm deletion -> calls deleteDiscipline(1) and reloads
    await act(async () => getFirstDeleteBtn().click());
    const confirmDeleteBtn = host.querySelector<HTMLButtonElement>('dialog .btn-danger')!;
    await act(async () => confirmDeleteBtn.click());
    expect(catalogApi.deleteDiscipline).toHaveBeenCalledWith(1);
    expect(catalogApi.disciplines).toHaveBeenCalledTimes(2);
    expect(host.querySelector('dialog[open]')?.textContent).toContain('Đã xóa bộ môn');
    expect(
      [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find(
        (b) => b.textContent?.trim() === 'Đóng' || b.textContent?.trim() === 'Close',
      ),
    ).toBeUndefined();
    await act(async () => host.querySelector<HTMLButtonElement>('dialog .portal-dialog__close')!.click());

    // Backend rejects deletion when discipline is already in use -> table remains visible & usable
    vi.mocked(catalogApi.deleteDiscipline).mockRejectedValueOnce(
      new Error('Bộ môn đang được sử dụng bởi lớp học hoạt động'),
    );
    await act(async () => getFirstDeleteBtn().click());
    await act(async () => host.querySelector<HTMLButtonElement>('dialog .btn-danger')!.click());

    expect(host.querySelector('table')).not.toBeNull();
    expect(getFirstDeleteBtn().disabled).toBe(false);
    expect(host.querySelector('dialog[open]')?.textContent).toContain('Bộ môn đang được sử dụng bởi lớp học hoạt động');
    expect(host.querySelector('dialog[open] .portal-alert--error svg')).not.toBeNull();
  });

  it('Disciplines tab: validates blank/overlong names, clears error on input, and isolates save errors inside modal', async () => {
    await act(async () => {
      root.render(<ManagerCatalogsPage />);
    });

    await act(async () => host.querySelector<HTMLButtonElement>('.portal-header .btn-primary')!.click());
    const nameInput = host.querySelector<HTMLInputElement>('#cat-name')!;

    // Blank / whitespace-only name rejected
    await setFieldValue(nameInput, '   ');
    await submitDialogForm();
    expect(catalogApi.saveDiscipline).not.toHaveBeenCalled();
    expect(host.querySelectorAll('[role="alert"]')).toHaveLength(1);
    expect(host.querySelector('dialog [role="alert"]')?.textContent).toContain('Vui lòng nhập tên hiển thị.');

    // Typing clears validation alert
    await setFieldValue(nameInput, 'Boxing');
    expect(host.querySelector('[role="alert"]')).toBeNull();

    // Name > 100 chars rejected
    await setFieldValue(nameInput, 'A'.repeat(101));
    await submitDialogForm();
    expect(catalogApi.saveDiscipline).not.toHaveBeenCalled();
    expect(host.querySelector('dialog [role="alert"]')?.textContent).toContain('Tên hiển thị tối đa 100 ký tự.');

    // Backend duplicate error stays inside modal only
    vi.mocked(catalogApi.saveDiscipline).mockRejectedValueOnce(new Error('Tên bộ môn đã tồn tại'));
    await setFieldValue(nameInput, 'Gym');
    await submitDialogForm();
    expect(host.querySelectorAll('[role="alert"]')).toHaveLength(1);
    expect(host.querySelector('dialog [role="alert"]')?.textContent).toContain('Tên bộ môn đã tồn tại');
  });

  // ── Rooms (Phòng tập) tab coverage (P2-E2E-02) ────────────────────────────────────────

  it('Rooms tab: hides room tiers, displays statuses and empty state', async () => {
    vi.mocked(catalogApi.rooms).mockResolvedValueOnce([
      {
        id: 1,
        name: 'Phòng VIP Tiêu chuẩn',
        location: 'Tầng 1',
        capacity: 50,
        status: 'available',
        tier: 'STANDARD',
      },
      {
        id: 2,
        name: 'Studio Riêng',
        location: null,
        capacity: 12,
        status: 'maintenance',
        tier: 'PLATINUM',
      },
      {
        id: 3,
        name: 'Khu Gym VIP Tầng 3',
        location: 'Tầng 3',
        capacity: 20,
        status: 'closed',
        tier: null,
      },
    ]);

    await act(async () => {
      root.render(<ManagerCatalogsPage />);
    });
    await switchTab('Phòng tập');

    const rows = [...host.querySelectorAll('tbody tr')];
    expect(rows).toHaveLength(3);

    // Existing names and room status remain visible without a tier column.
    expect(rows[0].textContent).toContain('Phòng VIP Tiêu chuẩn');
    expect(host.textContent).not.toContain('Phân hạng');
    expect(rows[0].textContent).toContain('50 người');
    expect(rows[0].querySelector('.badge-success')?.textContent).toContain('Đang hoạt động');

    // Null location and maintenance status remain visible.
    expect(rows[1].textContent).toContain('Studio Riêng');
    expect(rows[1].textContent).not.toContain('Cao cấp (Platinum)');
    expect(rows[1].textContent).toContain('—');
    expect(rows[1].textContent).toContain('12 người');
    expect(rows[1].querySelector('.badge-warning')?.textContent).toContain('Bảo trì');

    // Closed status remains visible.
    expect(rows[2].textContent).not.toContain('Cao cấp (Platinum)');
    expect(rows[2].querySelector('.badge-warning')?.textContent).toContain('Đã đóng');

    // Empty rooms list renders empty state
    vi.mocked(catalogApi.rooms).mockResolvedValueOnce([]);
    await act(async () => root.unmount());
    root = createRoot(host);
    await act(async () => {
      root.render(<ManagerCatalogsPage />);
    });
    await switchTab('Phòng tập');
    expect(host.querySelector('table')).toBeNull();
    expect(host.textContent).toContain('Chưa có cơ sở phòng tập nào');
  });

  it('Rooms tab: offers add and delete actions', async () => {
    await act(async () => {
      root.render(<ManagerCatalogsPage />);
    });
    await switchTab('Phòng tập');
    expect(host.querySelector('.portal-header .btn-primary')).not.toBeNull();
    const rowButtons = [...host.querySelectorAll<HTMLButtonElement>('tbody button')].map((b) => b.textContent?.trim());
    expect(rowButtons).toContain('Chỉnh sửa');
    expect(rowButtons).toContain('Xóa');
  });

  it('creates a room and deletes an unused room after confirmation', async () => {
    await act(async () => root.render(<ManagerCatalogsPage />));
    await switchTab('Phòng tập');
    await act(async () => host.querySelector<HTMLButtonElement>('.portal-header .btn-primary')!.click());
    expect(host.querySelector('#cat-tier')).toBeNull();
    await setFieldValue(host.querySelector<HTMLInputElement>('#cat-name')!, 'Studio Mới');
    await submitDialogForm();
    expect(catalogApi.createRoom).toHaveBeenCalledWith(expect.objectContaining({ name: 'Studio Mới', capacity: 10 }));
    expect(
      [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find(
        (b) => b.textContent?.trim() === 'Đóng' || b.textContent?.trim() === 'Close',
      ),
    ).toBeUndefined();
    await act(async () => host.querySelector<HTMLButtonElement>('dialog .portal-dialog__close')!.click());
    const deleteButton = [...host.querySelectorAll<HTMLButtonElement>('tbody button')].find((b) => b.textContent?.trim() === 'Xóa')!;
    await act(async () => deleteButton.click());
    await act(async () => host.querySelector<HTMLButtonElement>('dialog .btn-danger')!.click());
    expect(catalogApi.deleteRoom).toHaveBeenCalledWith(1);
  });

  it('Rooms tab: preserves the room tier when editing its status', async () => {
    vi.mocked(catalogApi.rooms).mockResolvedValueOnce([
      {
        id: 5,
        name: 'Phòng VIP Tiêu chuẩn',
        location: 'Tầng 1',
        capacity: 50,
        status: 'available',
        tier: 'PLATINUM',
      },
    ]);

    await act(async () => {
      root.render(<ManagerCatalogsPage />);
    });
    await switchTab('Phòng tập');

    const editBtn = [...host.querySelectorAll<HTMLButtonElement>('tbody tr:first-child button')].find(
      (b) => b.textContent?.trim() === 'Chỉnh sửa',
    )!;
    await act(async () => editBtn.click());

    const dialog = host.querySelector('dialog')!;
    expect(dialog.textContent).toContain('Chỉnh sửa phòng tập');
    // The tier is not editable here.
    expect(dialog.querySelector('#cat-tier')).toBeNull();

    await setFieldValue(dialog.querySelector<HTMLInputElement>('#cat-capacity')!, '35');
    await selectOption('cat-status', 'Bảo trì');
    await submitDialogForm();

    expect(catalogApi.updateRoom).toHaveBeenCalledWith(5, {
      name: 'Phòng VIP Tiêu chuẩn',
      location: 'Tầng 1',
      capacity: 35,
      status: 'maintenance',
      tier: 'PLATINUM',
    });
    expect(catalogApi.rooms).toHaveBeenCalledTimes(2);
  });

  it('Rooms tab: validates overlong name, overlong location, and invalid capacity bounds', async () => {
    await act(async () => {
      root.render(<ManagerCatalogsPage />);
    });
    await switchTab('Phòng tập');
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>('tbody tr:first-child button')].find((b) => b.textContent?.trim() === 'Chỉnh sửa')!.click());

    const nameInput = host.querySelector<HTMLInputElement>('#cat-name')!;
    const locInput = host.querySelector<HTMLInputElement>('#cat-location')!;
    const capInput = host.querySelector<HTMLInputElement>('#cat-capacity')!;

    // Name > 100 chars
    await setFieldValue(nameInput, 'P'.repeat(101));
    await submitDialogForm();
    expect(host.querySelector('dialog [role="alert"]')?.textContent).toContain('Tên hiển thị tối đa 100 ký tự.');

    // Location > 150 chars
    await setFieldValue(nameInput, 'Zen Studio');
    await setFieldValue(locInput, 'L'.repeat(151));
    await submitDialogForm();
    expect(host.querySelector('dialog [role="alert"]')?.textContent).toContain('Vị trí / tầng tối đa 150 ký tự.');

    // Capacity out of range (0, 201, non-integer 12.5)
    await setFieldValue(locInput, 'Tầng 2');
    for (const invalidCap of ['0', '201', '12.5']) {
      await setFieldValue(capInput, invalidCap);
      await submitDialogForm();
      expect(host.querySelector('dialog [role="alert"]')?.textContent).toContain(
        'Sức chứa phòng phải là số nguyên từ 1 đến 200 người.',
      );
    }
    expect(catalogApi.updateRoom).not.toHaveBeenCalled();
  });

  it('Rooms tab: hides empty table on load error and recovers Rooms table on Retry', async () => {
    vi.mocked(catalogApi.rooms).mockRejectedValueOnce(new Error('Rooms service unavailable'));

    await act(async () => {
      root.render(<ManagerCatalogsPage />);
    });
    await switchTab('Phòng tập');

    const alert = host.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Rooms service unavailable');
    expect(host.querySelector('table')).toBeNull();
    expect(host.querySelector('.portal-state')).toBeNull();

    const retryBtn = [...alert!.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === 'Thử lại',
    )!;
    await act(async () => retryBtn.click());

    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.querySelector('table')).not.toBeNull();
    expect(host.querySelector('tbody')?.textContent).toContain('Phòng Gym Tiêu chuẩn');
  });
});
