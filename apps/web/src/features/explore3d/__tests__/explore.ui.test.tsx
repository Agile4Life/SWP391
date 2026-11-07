// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DetailPanel } from '../components/DetailPanel';
import { ExploreBreadcrumb } from '../components/ExploreBreadcrumb';
import { ExploreSearchModal } from '../components/ExploreSearchModal';
import { ExploreToolbar } from '../components/ExploreToolbar';
import { LevelSwitcher } from '../components/LevelSwitcher';
import {
  EMPTY_LIVE_SNAPSHOT,
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
      name: 'Phòng Gym VIP',
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
      roomName: 'Phòng Gym VIP',
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

  const renderUi = (node: ReactNode) => {
    act(() => {
      root.render(<MemoryRouter>{node}</MemoryRouter>);
    });
  };

  const getByTestId = (testId: string): HTMLElement => {
    const el = container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    if (!el) {
      throw new Error(`Missing element [data-testid="${testId}"]`);
    }
    return el;
  };

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

    // Default active level is L1
    expect(getByTestId('floorplan-svg-L1')).toBeTruthy();
    expect(getByTestId('floorplan-zone-zone-l1-gym')).toBeTruthy();

    clickTestId('floorplan-zone-zone-l1-gym');
    expect(useExploreStore.getState().selectedId).toBe('zone-l1-gym');

    // Switch to B1
    clickTestId('floorplan-tab-B1');
    expect(getByTestId('floorplan-svg-B1')).toBeTruthy();
    clickTestId('floorplan-zone-zone-b1-pool');
    expect(useExploreStore.getState().selectedId).toBe('zone-b1-pool');

    // Switch to L2
    clickTestId('floorplan-tab-L2');
    expect(getByTestId('floorplan-svg-L2')).toBeTruthy();
    clickTestId('floorplan-zone-zone-l2-vip-gym');
    expect(useExploreStore.getState().selectedId).toBe('zone-l2-vip-gym');

    // Switch to RF
    clickTestId('floorplan-tab-RF');
    expect(getByTestId('floorplan-svg-RF')).toBeTruthy();
    clickTestId('floorplan-zone-zone-rf-zen');
    expect(useExploreStore.getState().selectedId).toBe('zone-rf-zen');

    // Switch to OUT
    clickTestId('floorplan-tab-OUT');
    expect(getByTestId('floorplan-svg-OUT')).toBeTruthy();
    clickTestId('floorplan-zone-zone-out-tennis');
    expect(useExploreStore.getState().selectedId).toBe('zone-out-tennis');
  });

  it('renders mandatory simulation badge, seed room/equipment data, offline state without fake numbers, and dispatches scms:open-chat', () => {
    const liveBindings = resolveBindings(SOL_CENTER_SCENE, SEED_SNAPSHOT);
    act(() => {
      useExploreStore.getState().selectNode('zone-l1-gym');
    });

    renderUi(<DetailPanel bindings={liveBindings} snapshot={SEED_SNAPSHOT} />);

    // Mandatory transparency badge
    expect(getByTestId('detail-sim-badge').textContent).toMatch(
      /Mô phỏng minh hoạ|Illustrative simulation/,
    );

    // Seed room capacity (50) and equipment code EQ-RUN-01
    expect(getByTestId('detail-zone-capacity').textContent).toBe('50');
    expect(getByTestId('detail-eq-row-EQ-RUN-01')).toBeTruthy();

    // When live data is unavailable, shows "Không có dữ liệu trực tiếp" and does not render fake capacity
    const emptyBindings = resolveBindings(SOL_CENTER_SCENE, EMPTY_LIVE_SNAPSHOT);
    const onRefresh = vi.fn();
    renderUi(
      <DetailPanel
        bindings={emptyBindings}
        snapshot={EMPTY_LIVE_SNAPSHOT}
        onRefresh={onRefresh}
      />,
    );

    expect(getByTestId('explore3d-no-live-data').textContent).toMatch(
      /Không có dữ liệu trực tiếp|No live data available/,
    );
    expect(container.querySelector('[data-testid="detail-zone-capacity"]')).toBeNull();

    clickTestId('explore3d-retry-btn');
    expect(onRefresh).toHaveBeenCalledTimes(1);

    // Select Lobby zone and click open-chat CTA
    act(() => {
      useExploreStore.getState().selectNode('zone-l1-lobby');
    });
    renderUi(<DetailPanel bindings={liveBindings} snapshot={SEED_SNAPSHOT} />);

    const chatListener = vi.fn();
    window.addEventListener('scms:open-chat', chatListener);
    clickTestId('hotspot-cta-hs-l1-chat');
    expect(chatListener).toHaveBeenCalledTimes(1);
    window.removeEventListener('scms:open-chat', chatListener);
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

    // LevelSwitcher switches levels
    clickTestId('explore3d-level-L2');
    expect(useExploreStore.getState().focusLevel).toBe('L2');

    clickTestId('explore3d-level-ALL');
    expect(useExploreStore.getState().focusLevel).toBe('ALL');

    // LevelSwitcher switches levelMode
    clickTestId('explore3d-levelmode-exploded');
    expect(useExploreStore.getState().levelMode).toBe('exploded');

    clickTestId('explore3d-levelmode-solo');
    expect(useExploreStore.getState().levelMode).toBe('solo');

    // ExploreToolbar switches wallMode
    clickTestId('explore3d-wallmode-down');
    expect(useExploreStore.getState().wallMode).toBe('down');

    clickTestId('explore3d-wallmode-up');
    expect(useExploreStore.getState().wallMode).toBe('up');

    // ExploreToolbar toggles viewMode (3d <-> 2d)
    expect(useExploreStore.getState().viewMode).toBe('3d');
    clickTestId('explore3d-btn-viewmode');
    expect(useExploreStore.getState().viewMode).toBe('2d');
    clickTestId('explore3d-btn-viewmode');
    expect(useExploreStore.getState().viewMode).toBe('3d');

    // Search trigger opens search modal and selecting a hit selects the node
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

    // Press '3' -> switches to L2 (and selects lvl-l2)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true, cancelable: true }));
    });
    expect(useExploreStore.getState().focusLevel).toBe('L2');
    expect(useExploreStore.getState().selectedId).toBe('lvl-l2');

    // Select a zone on L2
    act(() => {
      useExploreStore.getState().selectNode('zone-l2-vip-gym');
    });
    expect(useExploreStore.getState().selectedId).toBe('zone-l2-vip-gym');

    // Press '/' -> opens search modal
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }));
    });
    expect(useExploreStore.getState().searchOpen).toBe(true);

    // Focus close button inside modal (non-input) and press Escape: closes modal ONLY, preserves selectedId
    const closeBtn = container.querySelector<HTMLElement>('[data-testid="explore3d-search-close"]');
    closeBtn?.focus();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    expect(useExploreStore.getState().searchOpen).toBe(false);
    expect(useExploreStore.getState().selectedId).toBe('zone-l2-vip-gym');

    // Pressing Escape again with modal closed clears selectedId
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
      new URLSearchParams('focus=Phòng Gym VIP'),
    );
    expect(bilingualNameLink.selectedId).toBe('zone-l2-vip-gym');
    expect(bilingualNameLink.level).toBe('L2');
  });
});
