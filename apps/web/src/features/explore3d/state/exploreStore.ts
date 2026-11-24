import { create } from 'zustand';
import type { LevelCode, Viewpoint } from '../scene/schema';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { getLevelByCode, getNode, levelOf } from '../scene/selectors';

/** Chế độ xếp tầng: chồng lên nhau, tách rời hoặc chỉ một tầng. */
export type LevelMode = 'stacked' | 'exploded' | 'solo';
/** Chế độ tường: dựng lên, cắt bớt hoặc hạ xuống. */
export type WallMode = 'up' | 'cutaway' | 'down';
/** Chế độ xem: 3D hoặc sơ đồ 2D. */
export type ViewMode = '3d' | '2d';
/** Mức chất lượng đồ họa: cao, vừa, thấp. */
export type QualityTier = 'high' | 'medium' | 'low';

/**
 * Lệnh điều khiển camera kèm số thứ tự (để phát hiện lệnh mới): về toàn cảnh, tới đối tượng, vừa khung, góc
 * nhìn, thu phóng hoặc dịch.
 */
export interface CameraCommand {
  seq: number;
  kind: 'overview' | 'node' | 'fit' | 'viewpoint' | 'zoom' | 'nudge';
  nodeId?: string;
  viewpoint?: Viewpoint;
  zoomDelta?: number;
  nudge?: [number, number];
}

/** Số đo hiệu năng: khung hình/giây, thời gian mỗi khung, draw call, tam giác, geometry và texture. */
export interface PerfMetrics {
  fps: number;
  frameTimeMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

/**
 * Trạng thái của màn khám phá 3D: lựa chọn, tầng, chế độ, chất lượng, tour, đi bộ, tìm kiếm, camera, hiệu năng
 * và tình trạng WebGL.
 */
export interface ExploreState {
  selectedId: string | null;
  hoveredId: string | null;
  focusLevel: LevelCode | 'ALL';
  levelMode: LevelMode;
  wallMode: WallMode;
  viewMode: ViewMode;
  tier: QualityTier;
  dpr: number;
  tourActive: boolean;
  tourPaused: boolean;
  tourStepIndex: number;
  walkMode: boolean;
  searchOpen: boolean;
  cameraCommand: CameraCommand | null;
  perfMetrics: PerfMetrics;
  webglUnavailable: boolean;
  contextLostCount: number;

  // Actions
  // Chọn một đối tượng (tùy chọn bay tới và đồng bộ tầng).
  selectNode: (id: string | null, options?: { fit?: boolean; syncLevel?: boolean }) => void;
  // Đồng bộ tầng khi đi bộ sang tầng khác.
  syncWalkLevel: (level: LevelCode) => void;
  // Đặt đối tượng đang rê chuột.
  setHoveredId: (id: string | null) => void;
  // Đặt tầng đang xem (hoặc tất cả).
  setFocusLevel: (level: LevelCode | 'ALL') => void;
  // Đặt chế độ xếp tầng.
  setLevelMode: (mode: LevelMode) => void;
  // Đặt chế độ tường.
  setWallMode: (mode: WallMode) => void;
  // Đặt chế độ 2D/3D.
  setViewMode: (mode: ViewMode) => void;
  // Đặt mức chất lượng (và DPR tùy chọn).
  setQualityTier: (tier: QualityTier, dpr?: number) => void;
  // Bắt đầu tour tham quan.
  startTour: () => void;
  // Tạm dừng tour.
  pauseTour: () => void;
  // Tiếp tục tour.
  resumeTour: () => void;
  // Dừng tour.
  stopTour: () => void;
  // Đặt bước hiện tại của tour.
  setTourStep: (index: number) => void;
  // Bật/tắt chế độ đi bộ.
  setWalkMode: (active: boolean) => void;
  // Mở/đóng hộp tìm kiếm.
  setSearchOpen: (open: boolean) => void;
  // Bay camera về toàn cảnh.
  flyToOverview: () => void;
  // Bay camera tới một đối tượng.
  flyToNode: (nodeId: string, fit?: boolean) => void;
  // Bay camera tới một góc nhìn định sẵn.
  flyToViewpoint: (viewpoint: Viewpoint) => void;
  // Thu phóng camera.
  zoomCamera: (delta: number) => void;
  // Dịch camera theo trục x, z.
  nudgeCamera: (dx: number, dz: number) => void;
  // Cập nhật một phần số đo hiệu năng.
  setPerfMetrics: (metrics: Partial<PerfMetrics>) => void;
  // Đánh dấu WebGL không dùng được (chuyển sang 2D).
  markWebglUnavailable: () => void;
  // Ghi nhận mất ngữ cảnh WebGL (từ lần thứ hai chuyển sang 2D).
  recordContextLost: () => void;
  // Đặt lại toàn bộ trạng thái khám phá.
  resetExplore: () => void;
}

let commandSeq = 1;

/** Tăng và trả về số thứ tự lệnh camera. */
function nextSeq(): number {
  commandSeq += 1;
  return commandSeq;
}

const DEFAULT_DPR_BY_TIER: Record<QualityTier, number> = {
  high: 2.0,
  medium: 1.5,
  low: 1.15,
};

export const useExploreStore = create<ExploreState>((set, get) => ({
  selectedId: null,
  hoveredId: null,
  focusLevel: 'ALL',
  levelMode: 'stacked',
  wallMode: 'cutaway',
  viewMode: '3d',
  tier: 'high',
  dpr: 2.0,
  tourActive: false,
  tourPaused: false,
  tourStepIndex: 0,
  walkMode: false,
  searchOpen: false,
  cameraCommand: null,
  perfMetrics: {
    fps: 60,
    frameTimeMs: 8.0,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
  },
  webglUnavailable: false,
  contextLostCount: 0,

  // Chọn đối tượng: đồng bộ tầng và chuyển sang chế độ một tầng nếu cần.
  selectNode: (id, options) => {
    if (!id) {
      set({ selectedId: null });
      return;
    }
    const node = getNode(SOL_CENTER_SCENE, id);
    const lvl = levelOf(SOL_CENTER_SCENE, id);
    const current = get();
    const shouldSync = options?.syncLevel !== false;
    const nextFocusLevel =
      shouldSync && lvl
        ? lvl.code
        : current.levelMode === 'solo' && lvl
          ? lvl.code
          : current.focusLevel;
    const nextLevelMode =
      shouldSync &&
      lvl &&
      lvl.code !== 'RF' &&
      lvl.code !== 'OUT' &&
      current.levelMode === 'stacked'
        ? 'solo'
        : current.levelMode;

    if (current.walkMode && lvl) {
      if (
        node?.type === 'item' &&
        (node.kind === 'stair-core' || node.kind === 'elevator-core') &&
        lvl.code === current.focusLevel
      ) {
        const order: LevelCode[] = ['B1', 'L1', 'L2', 'RF'];
        const idx = order.indexOf(lvl.code);
        if (idx !== -1) {
          const nextLvl =
            lvl.code === 'RF'
              ? 'L2'
              : order[Math.min(order.length - 1, idx + 1)]!;
          const targetItemId = `item-${nextLvl.toLowerCase()}-${node.kind === 'stair-core' ? 'stairs' : 'elevator'}`;
          set({
            selectedId: SOL_CENTER_SCENE.nodes[targetItemId] ? targetItemId : id,
            focusLevel: nextLvl,
            levelMode: 'solo',
          });
          return;
        }
      }
      set({
        selectedId: id,
        focusLevel: lvl.code,
        levelMode: 'solo',
      });
      return;
    }

    set({
      selectedId: id,
      focusLevel: nextFocusLevel,
      levelMode: nextLevelMode,
      cameraCommand: {
        seq: nextSeq(),
        kind: options?.fit ? 'fit' : 'node',
        nodeId: id,
      },
    });
  },

  syncWalkLevel: level => {
    if (!getLevelByCode(SOL_CENTER_SCENE, level)) return;
    const current = get();
    const selectedLevel = current.selectedId
      ? levelOf(SOL_CENTER_SCENE, current.selectedId)?.code
      : null;
    const nextSelectedId =
      current.selectedId && selectedLevel && selectedLevel !== level
        ? `lvl-${level.toLowerCase()}`
        : current.selectedId;
    if (current.focusLevel === level && current.selectedId === nextSelectedId) return;
    set({ focusLevel: level, selectedId: nextSelectedId });
  },

  setHoveredId: id => {
    if (get().hoveredId === id) return;
    set({ hoveredId: id });
  },

  setFocusLevel: level => {
    // Bỏ qua tầng đã loại, kể cả lời gọi từ phím tắt hoặc session cũ.
    if (level !== 'ALL' && !getLevelByCode(SOL_CENTER_SCENE, level)) return;
    const current = get();
    if (level === 'ALL') {
      set({
        focusLevel: 'ALL',
        levelMode: current.levelMode === 'solo' ? 'stacked' : current.levelMode,
        walkMode: false,
        cameraCommand: { seq: nextSeq(), kind: 'overview' },
      });
      return;
    }
    const levelNodeId = `lvl-${level.toLowerCase()}`;
    if (current.walkMode) {
      set({
        focusLevel: level,
        levelMode: 'solo',
        selectedId: levelNodeId,
      });
      return;
    }
    set({
      focusLevel: level,
      levelMode: current.levelMode === 'stacked' ? 'solo' : current.levelMode,
      selectedId: levelNodeId,
      cameraCommand: {
        seq: nextSeq(),
        kind: 'node',
        nodeId: levelNodeId,
      },
    });
  },

  setLevelMode: mode => {
    const current = get();
    const nextFocus =
      mode === 'solo' && current.focusLevel === 'ALL' ? 'L1' : current.focusLevel;
    set({
      levelMode: mode,
      focusLevel: nextFocus,
      walkMode: mode === 'exploded' ? false : current.walkMode,
    });
  },

  setWallMode: mode => set({ wallMode: mode }),

  setViewMode: mode =>
    set({
      viewMode: mode,
      tourActive: mode === '2d' ? false : get().tourActive,
      walkMode: mode === '2d' ? false : get().walkMode,
    }),

  // Đặt mức chất lượng và DPR (mặc định theo mức).
  setQualityTier: (tier, dpr) =>
    set({
      tier,
      dpr: dpr ?? DEFAULT_DPR_BY_TIER[tier],
    }),

  // Bắt đầu tour: về chế độ xếp chồng, tường cắt, tắt đi bộ.
  startTour: () =>
    set({
      tourActive: true,
      tourPaused: false,
      tourStepIndex: 0,
      walkMode: false,
      levelMode: 'stacked',
      wallMode: 'cutaway',
    }),

  // Tạm dừng tour.
  pauseTour: () => set({ tourPaused: true }),
  // Tiếp tục tour.
  resumeTour: () => set({ tourPaused: false }),
  // Dừng tour.
  stopTour: () => set({ tourActive: false, tourPaused: false }),
  setTourStep: index => set({ tourStepIndex: index }),

  setWalkMode: active => {
    const current = get();
    if (active) {
      const targetLevel = current.focusLevel === 'ALL' ? 'L1' : current.focusLevel;
      set({
        walkMode: true,
        tourActive: false,
        focusLevel: targetLevel,
        levelMode: 'solo',
        wallMode: current.wallMode === 'down' ? 'cutaway' : current.wallMode,
      });
    } else {
      set({ walkMode: false });
    }
  },

  setSearchOpen: open => set({ searchOpen: open }),

  // Bay về toàn cảnh: bỏ chọn và hiện mọi tầng.
  flyToOverview: () =>
    set({
      selectedId: null,
      focusLevel: 'ALL',
      levelMode: 'stacked',
      walkMode: false,
      cameraCommand: { seq: nextSeq(), kind: 'overview' },
    }),

  // Bay tới đối tượng (fit = vừa khung) và đồng bộ tầng nếu đang xem một tầng.
  flyToNode: (nodeId, fit = false) => {
    const lvl = levelOf(SOL_CENTER_SCENE, nodeId);
    const current = get();
    set({
      selectedId: nodeId,
      focusLevel: current.levelMode === 'solo' && lvl ? lvl.code : current.focusLevel,
      cameraCommand: {
        seq: nextSeq(),
        kind: fit ? 'fit' : 'node',
        nodeId,
      },
    });
  },

  flyToViewpoint: viewpoint =>
    set({
      cameraCommand: {
        seq: nextSeq(),
        kind: 'viewpoint',
        viewpoint,
      },
    }),

  zoomCamera: delta =>
    set({
      cameraCommand: {
        seq: nextSeq(),
        kind: 'zoom',
        zoomDelta: delta,
      },
    }),

  // Dịch camera theo (dx, dz).
  nudgeCamera: (dx, dz) =>
    set({
      cameraCommand: {
        seq: nextSeq(),
        kind: 'nudge',
        nudge: [dx, dz],
      },
    }),

  setPerfMetrics: metrics =>
    set(state => ({
      perfMetrics: { ...state.perfMetrics, ...metrics },
    })),

  // Đánh dấu WebGL không dùng được và chuyển sang 2D.
  markWebglUnavailable: () =>
    set({
      webglUnavailable: true,
      viewMode: '2d',
    }),

  // Ghi nhận mất ngữ cảnh WebGL; từ lần thứ hai chuyển sang 2D.
  recordContextLost: () => {
    const nextCount = get().contextLostCount + 1;
    set({
      contextLostCount: nextCount,
      viewMode: nextCount >= 2 ? '2d' : get().viewMode,
    });
  },

  // Đặt lại trạng thái khám phá về mặc định.
  resetExplore: () =>
    set({
      selectedId: null,
      hoveredId: null,
      focusLevel: 'ALL',
      levelMode: 'stacked',
      wallMode: 'cutaway',
      tourActive: false,
      tourPaused: false,
      tourStepIndex: 0,
      walkMode: false,
      searchOpen: false,
      cameraCommand: { seq: nextSeq(), kind: 'overview' },
    }),
}));
