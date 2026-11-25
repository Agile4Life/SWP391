import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { centerNowParts } from '../../../shared/lib/centerTime';
import { getCurrentMembership } from '../../member/membershipApi';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import {
  EMPTY_LIVE_SNAPSHOT,
  inferMembershipTier,
  normalizeKey,
  resolveBindings,
  type LiveCenterSnapshot,
  type LiveCoachRecord,
  type LiveEquipmentRecord,
  type LiveMembershipSummary,
  type LiveRoomRecord,
  type ResolvedSceneBindings,
} from './bindings';

const CACHE_TTL_MS = 60_000;

/** Một mục cache: ảnh chụp dữ liệu và thời điểm lưu. */
interface CacheEntry {
  snapshot: LiveCenterSnapshot;
  timestamp: number;
}

let cachedCenterSnapshot: CacheEntry | null = null;

/** Xóa cache ảnh chụp dữ liệu trung tâm. */
export function clearLiveCenterCache(): void {
  cachedCenterSnapshot = null;
}

/** Dữ liệu phòng thô từ API. */
interface RawRoom {
  id: number | string;
  name: string;
  location?: string | null;
  capacity?: number;
  status?: string;
  tier?: string | null;
  openTime?: string | null;
  closeTime?: string | null;
  disciplineName?: string | null;
}

/** Dữ liệu thiết bị thô từ API. */
interface RawEquipment {
  id: number | string;
  name: string;
  code?: string | null;
  category?: string | null;
  roomId?: number | string | null;
  roomName?: string | null;
  quantity?: number;
  status?: string;
}

/** Dữ liệu HLV công khai thô từ API. */
interface RawPublicCoach {
  id: number | string;
  name?: string;
  fullName?: string;
  specialization?: string | null;
  specialty?: string | null;
  avatarUrl?: string | null;
}

/** Dữ liệu gói công khai thô từ API. */
interface RawPublicPackage {
  id: number | string;
  name: string;
  tier?: string | null;
  status?: string;
}

/** Danh mục công khai thô từ API. */
interface RawPublicCatalog {
  packages?: RawPublicPackage[];
  coaches?: RawPublicCoach[];
}

/** Dữ liệu gói đăng ký thô từ API. */
interface RawSubscription {
  id?: number | string;
  packageName?: string;
  tier?: string | null;
  status?: string;
  endDate?: string | null;
  remainingDays?: number | null;
}

/** Số ngày còn lại tới ngày hết hạn (không âm); ngày sai thì null. */
function computeRemainingDays(endDate: string | null | undefined, todayStr: string): number | null {
  if (!endDate) return null;
  const endMs = Date.parse(`${endDate.slice(0, 10)}T00:00:00Z`);
  const todayMs = Date.parse(`${todayStr}T00:00:00Z`);
  if (Number.isNaN(endMs) || Number.isNaN(todayMs)) return null;
  return Math.max(0, Math.round((endMs - todayMs) / 86_400_000));
}

/** Lấy gói hiện tại; lỗi thì thử endpoint dự phòng /memberships/current. */
async function fetchMembershipWithFallback(): Promise<RawSubscription | null> {
  try {
    return await getCurrentMembership();
  } catch {
    return apiFetch<RawSubscription | null>('/memberships/current');
  }
}

/** Kết quả của hook: ảnh chụp dữ liệu, dữ liệu đã gắn vào cảnh, đang tải, lỗi và hàm làm mới. */
export interface UseLiveCenterDataResult {
  snapshot: LiveCenterSnapshot;
  bindings: ResolvedSceneBindings;
  loading: boolean;
  error: string | null;
  // Tải lại ngay, bỏ qua cache.
  refresh: () => Promise<void>;
}

/**
 * Hook tải dữ liệu thật của trung tâm (phòng, thiết bị, danh mục, gói) có cache trong thời gian CACHE_TTL_MS và
 * gắn vào cảnh 3D.
 */
export function useLiveCenterData(): UseLiveCenterDataResult {
  const [snapshot, setSnapshot] = useState<LiveCenterSnapshot>(() =>
    cachedCenterSnapshot && Date.now() - cachedCenterSnapshot.timestamp < CACHE_TTL_MS
      ? cachedCenterSnapshot.snapshot
      : EMPTY_LIVE_SNAPSHOT,
  );
  const [loading, setLoading] = useState<boolean>(
    () => !(cachedCenterSnapshot && Date.now() - cachedCenterSnapshot.timestamp < CACHE_TTL_MS),
  );
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Tải ảnh chụp dữ liệu (dùng cache còn hạn trừ khi force); chỉ dùng dữ liệu Gym và các luồng còn giữ.
  const loadSnapshot = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && cachedCenterSnapshot && now - cachedCenterSnapshot.timestamp < CACHE_TTL_MS) {
      if (mountedRef.current) {
        setSnapshot(cachedCenterSnapshot.snapshot);
        setError(cachedCenterSnapshot.snapshot.error ?? null);
        setLoading(false);
      }
      return;
    }

    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    const todayStr = centerNowParts().date;

    // Chỉ tải dữ liệu Gym và các flow còn giữ; không gọi lịch lớp nhóm hay sân.
    const [
      roomsRes,
      equipmentRes,
      catalogRes,
      membershipRes,
    ] = await Promise.allSettled([
      apiFetch<RawRoom[]>('/rooms'),
      apiFetch<RawEquipment[]>('/equipment'),
      apiFetch<RawPublicCatalog>('/public/catalog', { headers: { Authorization: '' } }),
      fetchMembershipWithFallback(),
    ]);

    const rooms: LiveRoomRecord[] =
      roomsRes.status === 'fulfilled' && Array.isArray(roomsRes.value)
        ? roomsRes.value.map(r => ({
            id: String(r.id),
            name: r.name,
            location: r.location ?? null,
            capacity: Number(r.capacity ?? 0),
            status: r.status ?? 'available',
            tier: r.tier ?? null,
            openTime: r.openTime ?? null,
            closeTime: r.closeTime ?? null,
            disciplineName: r.disciplineName ?? null,
          }))
        : [];

    const equipment: LiveEquipmentRecord[] =
      equipmentRes.status === 'fulfilled' && Array.isArray(equipmentRes.value)
        ? equipmentRes.value
            .filter(eq => Boolean(eq.code))
            .map(eq => ({
              id: String(eq.id),
              name: eq.name,
              code: String(eq.code),
              category: eq.category ?? 'General',
              roomId: eq.roomId != null ? String(eq.roomId) : null,
              roomName: eq.roomName ?? null,
              quantity: Number(eq.quantity ?? 0),
              status: eq.status ?? 'active',
            }))
        : [];

    const catalog = catalogRes.status === 'fulfilled' ? catalogRes.value : null;

    const coaches: LiveCoachRecord[] = Array.isArray(catalog?.coaches)
      ? catalog.coaches.map(c => ({
          id: String(c.id),
          fullName: c.fullName ?? c.name ?? 'Coach',
          specialty: c.specialty ?? c.specialization ?? null,
          avatarUrl: c.avatarUrl ?? null,
        }))
      : [];

    let membership: LiveMembershipSummary = null;
    if (membershipRes.status === 'fulfilled' && membershipRes.value?.packageName) {
      const sub = membershipRes.value;
      const pkgMatch = catalog?.packages?.find(
        p => normalizeKey(p.name) === normalizeKey(sub.packageName),
      );
      const resolvedTier =
        inferMembershipTier(sub.tier) ??
        inferMembershipTier(pkgMatch?.tier) ??
        inferMembershipTier(sub.packageName) ??
        'SILVER';
      membership = {
        packageName: sub.packageName!,
        tier: resolvedTier,
        status: sub.status ?? 'active',
        endDate: sub.endDate ?? null,
        remainingDays:
          sub.remainingDays !== undefined
            ? sub.remainingDays
            : computeRemainingDays(sub.endDate, todayStr),
      };
    }

    const allCoreFailed =
      roomsRes.status === 'rejected' &&
      equipmentRes.status === 'rejected';

    const snapshotError = allCoreFailed
      ? (roomsRes.reason instanceof Error
          ? roomsRes.reason.message
          : 'Không thể tải dữ liệu trực tiếp')
      : null;

    const nextSnapshot: LiveCenterSnapshot = {
      rooms,
      equipment,
      courts: [],
      courtSlotsByCourtId: {},
      classSessions: [],
      sessions: [],
      membership,
      // Streak đã bỏ khỏi Member; không phát sinh request check-in phụ.
      streak: null,
      coaches,
      // Không tải catalog sản phẩm khi Shop không còn trong scene.
      products: [],
      fetchedAt: Date.now(),
      error: snapshotError,
    };

    cachedCenterSnapshot = {
      snapshot: nextSnapshot,
      timestamp: Date.now(),
    };

    if (mountedRef.current) {
      setSnapshot(nextSnapshot);
      setError(snapshotError);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshot(false);
  }, [loadSnapshot]);

  // Tải lại ngay, bỏ qua cache.
  const refresh = useCallback(async () => {
    await loadSnapshot(true);
  }, [loadSnapshot]);

  // Gắn dữ liệu thật vào cảnh mỗi khi ảnh chụp đổi.
  const bindings = useMemo(() => resolveBindings(SOL_CENTER_SCENE, snapshot), [snapshot]);

  return {
    snapshot,
    bindings,
    loading,
    error,
    refresh,
  };
}
