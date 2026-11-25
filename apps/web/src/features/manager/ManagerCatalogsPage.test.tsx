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
    saveRoom: vi.fn().mockResolvedValue({}),
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
    expect(host.textContent).toContain('+ Tạo gói tập mới');

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
      b.textContent === '+ Tạo gói tập mới'
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
    vi.mocked(catalogApi.saveRoom).mockRejectedValueOnce(new Error('Trùng tên phòng'));
    const addBtn = [...host.querySelectorAll<HTMLButtonElement>('.portal-header button')].find((b) => b.textContent?.includes('Thêm mới'))!;
    await act(async () => addBtn.click());
    const nameInput = host.querySelector<HTMLInputElement>('#cat-name')!;
    expect(nameInput.maxLength).toBe(100);
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(nameInput, '   ');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(catalogApi.saveRoom).not.toHaveBeenCalled();
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
});
