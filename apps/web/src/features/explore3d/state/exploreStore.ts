import { create } from 'zustand';
import type { LevelCode, Viewpoint } from '../scene/schema';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { getNode, levelOf } from '../scene/selectors';

export type LevelMode = 'stacked' | 'exploded' | 'solo';
export type WallMode = 'up' | 'cutaway' | 'down';
export type ViewMode = '3d' | '2d';
export type QualityTier = 'high' | 'medium' | 'low';

export interface CameraCommand {
  seq: number;
  kind: 'overview' | 'node' | 'fit' | 'viewpoint' | 'zoom' | 'nudge';
  nodeId?: string;
  viewpoint?: Viewpoint;
  zoomDelta?: number;
  nudge?: [number, number];
}

export interface PerfMetrics {
  fps: number;
  frameTimeMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

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
  selectNode: (id: string | null, options?: { fit?: boolean; syncLevel?: boolean }) => void;
  setHoveredId: (id: string | null) => void;
  setFocusLevel: (level: LevelCode | 'ALL') => void;
  setLevelMode: (mode: LevelMode) => void;
  setWallMode: (mode: WallMode) => void;
  setViewMode: (mode: ViewMode) => void;
  setQualityTier: (tier: QualityTier, dpr?: number) => void;
  startTour: () => void;
  pauseTour: () => void;
  resumeTour: () => void;
  stopTour: () => void;
  setTourStep: (index: number) => void;
  setWalkMode: (active: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  flyToOverview: () => void;
  flyToNode: (nodeId: string, fit?: boolean) => void;
  flyToViewpoint: (viewpoint: Viewpoint) => void;
  zoomCamera: (delta: number) => void;
  nudgeCamera: (dx: number, dz: number) => void;
  setPerfMetrics: (metrics: Partial<PerfMetrics>) => void;
  markWebglUnavailable: () => void;
  recordContextLost: () => void;
  resetExplore: () => void;
}

let commandSeq = 1;

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

  setHoveredId: id => {
    if (get().hoveredId === id) return;
    set({ hoveredId: id });
  },

  setFocusLevel: level => {
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

  setQualityTier: (tier, dpr) =>
    set({
      tier,
      dpr: dpr ?? DEFAULT_DPR_BY_TIER[tier],
    }),

  startTour: () =>
    set({
      tourActive: true,
      tourPaused: false,
      tourStepIndex: 0,
      walkMode: false,
      levelMode: 'stacked',
      wallMode: 'cutaway',
    }),

  pauseTour: () => set({ tourPaused: true }),
  resumeTour: () => set({ tourPaused: false }),
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

  flyToOverview: () =>
    set({
      selectedId: null,
      focusLevel: 'ALL',
      levelMode: 'stacked',
      walkMode: false,
      cameraCommand: { seq: nextSeq(), kind: 'overview' },
    }),

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

  markWebglUnavailable: () =>
    set({
      webglUnavailable: true,
      viewMode: '2d',
    }),

  recordContextLost: () => {
    const nextCount = get().contextLostCount + 1;
    set({
      contextLostCount: nextCount,
      viewMode: nextCount >= 2 ? '2d' : get().viewMode,
    });
  },

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
