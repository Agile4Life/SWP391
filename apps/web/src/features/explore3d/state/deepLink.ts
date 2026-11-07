import type { LevelCode, Vec3 } from '../scene/schema';
import { LEVEL_ORDER } from '../scene/schema';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { levelOf, resolveDeepLinkNode } from '../scene/selectors';
import type { LevelMode, WallMode } from './exploreStore';

export const EXPLORE3D_SESSION_KEY = 'scms_explore3d_view';

export interface PersistedExploreView {
  position: Vec3;
  target: Vec3;
  focusLevel: LevelCode | 'ALL';
  selectedId: string | null;
  levelMode: LevelMode;
  wallMode: WallMode;
}

export interface ParsedExploreDeepLink {
  level?: LevelCode;
  selectedId?: string;
  viewMode?: '3d' | '2d';
  perf?: boolean;
  bench?: boolean;
}

export function parseExploreSearchParams(searchParams: URLSearchParams): ParsedExploreDeepLink {
  const result: ParsedExploreDeepLink = {};

  const rawLevel = searchParams.get('level')?.toUpperCase();
  if (rawLevel && (LEVEL_ORDER as readonly string[]).includes(rawLevel)) {
    result.level = rawLevel as LevelCode;
  }

  const rawItem = searchParams.get('item');
  const rawFocus = searchParams.get('focus');
  const resolved =
    resolveDeepLinkNode(SOL_CENTER_SCENE, rawItem) ??
    resolveDeepLinkNode(SOL_CENTER_SCENE, rawFocus);
  if (resolved) {
    result.selectedId = resolved.id;
    const inferredLevel = levelOf(SOL_CENTER_SCENE, resolved.id);
    if (inferredLevel && !result.level) {
      result.level = inferredLevel.code;
    }
  }

  const rawMode = searchParams.get('mode')?.toLowerCase();
  if (rawMode === '2d' || rawMode === '3d') {
    result.viewMode = rawMode;
  }

  if (searchParams.get('perf') === '1') {
    result.perf = true;
  }
  if (searchParams.get('bench') === '1') {
    result.bench = true;
  }

  return result;
}

export function buildExploreDeepLink(params: {
  level?: LevelCode | 'ALL';
  focus?: string | null;
  item?: string | null;
}): string {
  const sp = new URLSearchParams();
  if (params.level && params.level !== 'ALL') {
    sp.set('level', params.level);
  }
  if (params.item) {
    sp.set('item', params.item);
  } else if (params.focus) {
    sp.set('focus', params.focus);
  }
  const qs = sp.toString();
  return qs ? `/member/explore?${qs}` : '/member/explore';
}

export function saveExploreSessionView(view: PersistedExploreView): void {
  try {
    sessionStorage.setItem(EXPLORE3D_SESSION_KEY, JSON.stringify(view));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export function loadExploreSessionView(): PersistedExploreView | null {
  try {
    const raw = sessionStorage.getItem(EXPLORE3D_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedExploreView>;
    if (
      Array.isArray(parsed.position) &&
      parsed.position.length === 3 &&
      Array.isArray(parsed.target) &&
      parsed.target.length === 3
    ) {
      return {
        position: parsed.position as Vec3,
        target: parsed.target as Vec3,
        focusLevel: parsed.focusLevel ?? 'ALL',
        selectedId: parsed.selectedId ?? null,
        levelMode: parsed.levelMode ?? 'stacked',
        wallMode: parsed.wallMode ?? 'cutaway',
      };
    }
    return null;
  } catch {
    return null;
  }
}
