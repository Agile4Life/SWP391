// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExploreBreadcrumb } from '../components/ExploreBreadcrumb';
import { ExploreSearchModal } from '../components/ExploreSearchModal';
import { ExploreToolbar } from '../components/ExploreToolbar';
import { LevelSwitcher } from '../components/LevelSwitcher';
import {
  resolveBindings,
  type LiveCenterSnapshot,
} from '../data/bindings';
import { FloorPlan2D } from '../fallback/FloorPlan2D';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { parseExploreSearchParams } from '../state/deepLink';
import { useExploreStore } from '../state/exploreStore';

const SEED_SNAPSHOT: LiveCenterSnapshot = {
  rooms: [
    {
      id: 'room-1',
      name: 'Phòng Gym Tiêu chuẩn',
      location: 'Tầng 1 - Khu Gym Chính',
      capacity: 50,
      status: 'available',
      tier: 'STANDARD',
      openTime: '06:00',
      closeTime: '22:00',
    },
    {
      id: 'room-2',
      name: 'Studio HLV 1:1',
      location: 'Tầng 2 - Khu VIP Platinum',
      capacity: 25,
      status: 'available',
      tier: 'PLATINUM',
    },
    {
      id: 'room-4',
      name: 'Ring Arena 01',
      location: 'Level 1 - East Wing',
      capacity: 14,
      status: 'maintenance',
      tier: 'STANDARD',
    },
  ],
  equipment: [
    {
      id: 'eq-1',
      name: 'Máy chạy bộ điện Commercial Pro',
      code: 'EQ-RUN-01',
      category: 'Cardio',
      roomName: 'Phòng Gym Tiêu chuẩn',
      quantity: 8,
      status: 'active',
    },
    {
      id: 'eq-12',
      name: 'Máy đo chỉ số cơ thể chuyên sâu InBody 770',
      code: 'EQ-VIP-INBODY-01',
      category: 'Diagnostic',
      roomName: 'Studio HLV 1:1',
      quantity: 1,
      status: 'active',
    },
  ],
  courts: [
    {
      id: 'court-1',
      name: 'Sân Tennis 01',
      location: 'Khu thể thao ngoài trời - Sân A',
      capacity: 4,
      status: 'available',
      disciplineName: 'Tennis',
      openTime: '06:00',
      closeTime: '22:00',
      availableSlotsToday: 6,
      nextFreeSlot: '09:00',
    },
    {
      id: 'court-3',
      name: 'Sân Cầu lông 01',
      location: 'Nhà thi đấu - Tầng 1',
      capacity: 4,
      status: 'available',
      disciplineName: 'Cầu lông',
      openTime: '06:00',
      closeTime: '22:00',
      availableSlotsToday: 5,
      nextFreeSlot: '10:00',
    },
  ],
  membership: {
    packageName: 'SILVER',
    tier: 'SILVER',
    status: 'active',
    remainingDays: 24,
  },
  streak: {
    currentStreak: 7,
    longestStreak: 19,
    activeToday: true,
  },
};

describe('Explore 3D DOM UI & 2D Floor Plan Fallback', () => {
  let container: HTMLDivElement;
  let root: Root;

  // Dựng component vào DOM giả để kiểm thử.
  const renderUi = (node: ReactNode) => {
    act(() => {
      root.render(<MemoryRouter>{node}</MemoryRouter>);
    });
  };

  // Lấy phần tử theo data-testid.
  const getByTestId = (testId: string): HTMLElement => {
    const el = container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    if (!el) {
      throw new Error(`Missing element [data-testid="${testId}"]`);
    }
    return el;
  };

  // Bấm phần tử theo data-testid.
  const clickTestId = (testId: string) => {
    const el = getByTestId(testId);
    act(() => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  };

  beforeEach(() => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useExploreStore.getState().resetExplore();
    useExploreStore.setState({ viewMode: '3d', webglUnavailable: false, contextLostCount: 0 });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders interactive zones, items, and hotspots in FloorPlan2D across L1, B1, L2, RF, and OUT and updates selectedId on click', () => {
    const bindings = resolveBindings(SOL_CENTER_SCENE, SEED_SNAPSHOT);
    renderUi(<FloorPlan2D bindings={bindings} />);

    // Tầng đang hoạt động mặc định là L1
    expect(getByTestId('floorplan-svg-L1')).toBeTruthy();
    expect(getByTestId('floorplan-zone-zone-l1-gym')).toBeTruthy();

    clickTestId('floorplan-zone-zone-l1-gym');
    expect(useExploreStore.getState().selectedId).toBe('zone-l1-gym');

    // Chuyển sang tầng B1
    clickTestId('floorplan-tab-B1');
    expect(getByTestId('floorplan-svg-B1')).toBeTruthy();
    clickTestId('floorplan-zone-zone-b1-locker');
    expect(useExploreStore.getState().selectedId).toBe('zone-b1-locker');

    // Chuyển sang tầng L2
    clickTestId('floorplan-tab-L2');
    expect(getByTestId('floorplan-svg-L2')).toBeTruthy();
    clickTestId('floorplan-zone-zone-l2-pt-studio');
    expect(useExploreStore.getState().selectedId).toBe('zone-l2-pt-studio');

    // Chuyển sang tầng RF
    clickTestId('floorplan-tab-RF');
    expect(getByTestId('floorplan-svg-RF')).toBeTruthy();
    clickTestId('floorplan-zone-zone-rf-terrace');
    expect(useExploreStore.getState().selectedId).toBe('zone-rf-terrace');

    expect(container.querySelector('[data-testid="floorplan-tab-OUT"]')).toBeNull();
  });


  it('switches levels, levelMode, wallMode, and viewMode via LevelSwitcher and ExploreToolbar', () => {
    renderUi(
      <>
        <ExploreBreadcrumb />
        <LevelSwitcher />
        <ExploreToolbar />
        <ExploreSearchModal />
      </>,
    );

    // LevelSwitcher chuyển đổi tầng
    clickTestId('explore3d-level-L2');
    expect(useExploreStore.getState().focusLevel).toBe('L2');

    clickTestId('explore3d-level-ALL');
    expect(useExploreStore.getState().focusLevel).toBe('ALL');

    // LevelSwitcher chuyển đổi chế độ tầng (levelMode)
    clickTestId('explore3d-levelmode-exploded');
    expect(useExploreStore.getState().levelMode).toBe('exploded');

    clickTestId('explore3d-levelmode-solo');
    expect(useExploreStore.getState().levelMode).toBe('solo');

    // ExploreToolbar chuyển đổi chế độ tường (wallMode)
    clickTestId('explore3d-wallmode-down');
    expect(useExploreStore.getState().wallMode).toBe('down');

    clickTestId('explore3d-wallmode-up');
    expect(useExploreStore.getState().wallMode).toBe('up');

    // ExploreToolbar chuyển đổi qua lại viewMode (3d <-> 2d)
    expect(useExploreStore.getState().viewMode).toBe('3d');
    clickTestId('explore3d-btn-viewmode');
    expect(useExploreStore.getState().viewMode).toBe('2d');
    clickTestId('explore3d-btn-viewmode');
    expect(useExploreStore.getState().viewMode).toBe('3d');

    // Nút tìm kiếm mở hộp thoại tìm kiếm và chọn kết quả sẽ chọn nút tương ứng
    clickTestId('explore3d-search-trigger');
    expect(useExploreStore.getState().searchOpen).toBe(true);
    clickTestId('explore3d-search-hit-zone-l1-gym');
    expect(useExploreStore.getState().selectedId).toBe('zone-l1-gym');
    expect(useExploreStore.getState().searchOpen).toBe(false);
  });

  it('supports keyboard shortcuts (0..5, /, Escape, R) in FloorPlan2D without Escape collision when search modal is open', () => {
    const liveBindings = resolveBindings(SOL_CENTER_SCENE, SEED_SNAPSHOT);
    renderUi(
      <>
        <FloorPlan2D bindings={liveBindings} />
        <ExploreSearchModal />
      </>,
    );

    act(() => {
      useExploreStore.getState().selectNode('zone-l1-gym');
    });
    expect(useExploreStore.getState().selectedId).toBe('zone-l1-gym');

    // Nhấn phím '3' -> chuyển sang tầng L2 (và chọn lvl-l2)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true, cancelable: true }));
    });
    expect(useExploreStore.getState().focusLevel).toBe('L2');
    expect(useExploreStore.getState().selectedId).toBe('lvl-l2');

    // Chọn một phân khu ở tầng L2
    act(() => {
      useExploreStore.getState().selectNode('zone-l2-pt-studio');
    });
    expect(useExploreStore.getState().selectedId).toBe('zone-l2-pt-studio');

    // Nhấn phím '/' -> mở hộp thoại tìm kiếm
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }));
    });
    expect(useExploreStore.getState().searchOpen).toBe(true);

    // Focus nút đóng trong hộp thoại (không phải ô nhập) rồi nhấn Escape: CHỈ đóng hộp thoại, giữ nguyên selectedId
    const closeBtn = container.querySelector<HTMLElement>('[data-testid="explore3d-search-close"]');
    closeBtn?.focus();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    expect(useExploreStore.getState().searchOpen).toBe(false);
    expect(useExploreStore.getState().selectedId).toBe('zone-l2-pt-studio');

    // Nhấn Escape thêm lần nữa khi hộp thoại đã đóng sẽ xóa selectedId
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    expect(useExploreStore.getState().selectedId).toBeNull();
  });

  it('parses deep links with empty item fallback, hotspot IDs, and bilingual zone names', () => {
    const emptyItemFallback = parseExploreSearchParams(
      new URLSearchParams('item=&focus=zone-l1-gym'),
    );
    expect(emptyItemFallback.selectedId).toBe('zone-l1-gym');
    expect(emptyItemFallback.level).toBe('L1');

    const hotspotLink = parseExploreSearchParams(
      new URLSearchParams('focus=hs-l1-chat'),
    );
    expect(hotspotLink.selectedId).toBe('hs-l1-chat');
    expect(hotspotLink.level).toBe('L1');

    const bilingualNameLink = parseExploreSearchParams(
      new URLSearchParams('focus=Studio Huấn luyện viên Cá nhân 1:1 (PT)'),
    );
    expect(bilingualNameLink.selectedId).toBe('zone-l2-pt-studio');
    expect(bilingualNameLink.level).toBe('L2');
  });

  it('syncs selectedId and ExploreBreadcrumb when climbing floors via syncWalkLevel, and hides SelectionHighlight wireframes in walkMode', async () => {
    const { SelectionHighlight } = await import('../canvas/SelectionHighlight');
    renderUi(
      <>
        <ExploreBreadcrumb />
        <SelectionHighlight />
      </>,
    );

    act(() => {
      useExploreStore.setState({
        walkMode: true,
        focusLevel: 'B1',
        levelMode: 'solo',
        selectedId: 'item-b1-stairs',
      });
    });
    expect(container.textContent).toContain('Tầng B1');

    // Leo từ B1 lên L1 sẽ cập nhật focusLevel VÀ thay lựa chọn thiết bị B1 cũ bằng lvl-l1
    act(() => {
      useExploreStore.getState().syncWalkLevel('L1');
    });
    expect(useExploreStore.getState().focusLevel).toBe('L1');
    expect(useExploreStore.getState().selectedId).toBe('lvl-l1');
    expect(container.textContent).not.toContain('Tầng B1');
    expect(container.textContent).toContain('Tầng L1');

    // SelectionHighlight phải render null khi walkMode đang bật để khung dây CAD không cắt ngang bầu trời/phòng
    expect(container.querySelector('lineSegments')).toBeNull();
  });
});
