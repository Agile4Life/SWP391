import type { LevelCode, Vec3 } from '../scene/schema';
import { LEVEL_ORDER } from '../scene/schema';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { getLevelByCode, levelOf, resolveDeepLinkNode } from '../scene/selectors';
import type { LevelMode, WallMode } from './exploreStore';

export const EXPLORE3D_SESSION_KEY = 'scms_explore3d_view';

/**
 * Góc nhìn được lưu trong phiên: vị trí và điểm nhìn camera, tầng đang xem, đối tượng đang chọn, chế độ tầng và
 * tường.
 */
export interface PersistedExploreView {
  position: Vec3;
  target: Vec3;
  focusLevel: LevelCode | 'ALL';
  selectedId: string | null;
  levelMode: LevelMode;
  wallMode: WallMode;
}

/** Kết quả đọc đường dẫn khám phá: tầng, đối tượng được chọn, chế độ 2D/3D và cờ hiệu năng/benchmark. */
export interface ParsedExploreDeepLink {
  level?: LevelCode;
  selectedId?: string;
  viewMode?: '3d' | '2d';
  perf?: boolean;
  bench?: boolean;
}

/**
 * Đọc tham số URL (level, item/focus, mode, perf, bench); chỉ nhận giá trị hợp lệ và suy ra tầng từ đối tượng
 * được chọn.
 */
export function parseExploreSearchParams(searchParams: URLSearchParams): ParsedExploreDeepLink {
  const result: ParsedExploreDeepLink = {};

  const rawLevel = searchParams.get('level')?.toUpperCase();
  if (rawLevel && (LEVEL_ORDER as readonly string[]).includes(rawLevel) && getLevelByCode(SOL_CENTER_SCENE, rawLevel as LevelCode)) {
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

/** Dựng đường dẫn /member/explore kèm level và item (hoặc focus). */
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

/** Lưu góc nhìn hiện tại vào sessionStorage (bỏ qua lỗi storage). */
export function saveExploreSessionView(view: PersistedExploreView): void {
  try {
    sessionStorage.setItem(EXPLORE3D_SESSION_KEY, JSON.stringify(view));
  } catch {
    // Bỏ qua lỗi vượt hạn mức lưu trữ hoặc chế độ riêng tư
  }
}

/** Đọc lại góc nhìn đã lưu trong sessionStorage; dữ liệu sai thì trả null. */
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
        // Session cũ có thể trỏ tới tầng/khu đã loại khỏi scope.
        focusLevel: parsed.focusLevel && parsed.focusLevel !== 'ALL' && getLevelByCode(SOL_CENTER_SCENE, parsed.focusLevel) ? parsed.focusLevel : 'ALL',
        selectedId: parsed.selectedId && SOL_CENTER_SCENE.nodes[parsed.selectedId] ? parsed.selectedId : null,
        levelMode: parsed.levelMode ?? 'stacked',
        wallMode: parsed.wallMode ?? 'cutaway',
      };
    }
    return null;
  } catch {
    return null;
  }
}
