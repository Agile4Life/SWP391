import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { centerDate, courtsApi, dateAfter } from '../../courts/courtsApi';
import { memberCheckinApi } from '../../member/memberCheckinApi';
import { getCurrentMembership } from '../../member/membershipApi';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { zoneOf } from '../scene/selectors';
import {
  EMPTY_LIVE_SNAPSHOT,
  inferMembershipTier,
  normalizeKey,
  resolveBindings,
  type LiveCenterSnapshot,
  type LiveClassSessionRecord,
  type LiveCoachRecord,
  type LiveCourtSlot,
  type LiveCourtSummary,
  type LiveEquipmentRecord,
  type LiveMembershipSummary,
  type LiveProductRecord,
  type LiveRoomRecord,
  type LiveStreakSummary,
  type ResolvedSceneBindings,
} from './bindings';

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  snapshot: LiveCenterSnapshot;
  timestamp: number;
}

let cachedCenterSnapshot: CacheEntry | null = null;
const cachedCourtDisciplineTimestamp = new Map<string, number>();

export function clearLiveCenterCache(): void {
  cachedCenterSnapshot = null;
  cachedCourtDisciplineTimestamp.clear();
}

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

interface RawCourt {
  id: number | string;
  name: string;
  location?: string | null;
  capacity?: number;
  status?: string;
  disciplineName?: string | null;
  openTime?: string | null;
  closeTime?: string | null;
}

interface RawPublicCoach {
  id: number | string;
  name?: string;
  fullName?: string;
  specialization?: string | null;
  specialty?: string | null;
  avatarUrl?: string | null;
}

interface RawPublicPackage {
  id: number | string;
  name: string;
  tier?: string | null;
  status?: string;
}

interface RawPublicCatalog {
  packages?: RawPublicPackage[];
  coaches?: RawPublicCoach[];
  sessions?: RawClassSession[];
}

interface RawProductItem {
  id: number | string;
  name: string;
  slug: string;
  price?: number;
  minPrice?: number;
  servingsPerContainer?: number | null;
  stockQuantity?: number | null;
  inStock?: boolean;
}

interface RawProductPage {
  content?: RawProductItem[];
}

interface RawSubscription {
  id?: number | string;
  packageName?: string;
  tier?: string | null;
  status?: string;
  endDate?: string | null;
  remainingDays?: number | null;
}

interface RawStreak {
  currentStreak?: number;
  longestStreak?: number;
  activeToday?: boolean;
  activeDates?: string[];
}

interface RawClassSession {
  id: number | string;
  className: string;
  disciplineName?: string | null;
  roomName?: string | null;
  coachName?: string | null;
  sessionDate: string;
  startTime: string;
  endTime: string;
  capacity?: number | null;
  bookedCount?: number | null;
  status?: string | null;
}

function computeRemainingDays(endDate: string | null | undefined, todayStr: string): number | null {
  if (!endDate) return null;
  const endMs = Date.parse(`${endDate.slice(0, 10)}T00:00:00Z`);
  const todayMs = Date.parse(`${todayStr}T00:00:00Z`);
  if (Number.isNaN(endMs) || Number.isNaN(todayMs)) return null;
  return Math.max(0, Math.round((endMs - todayMs) / 86_400_000));
}

async function fetchMembershipWithFallback(): Promise<RawSubscription | null> {
  try {
    return await getCurrentMembership();
  } catch {
    return apiFetch<RawSubscription | null>('/memberships/current');
  }
}

export interface UseLiveCenterDataResult {
  snapshot: LiveCenterSnapshot;
  bindings: ResolvedSceneBindings;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useLiveCenterData(selectedZoneId?: string | null): UseLiveCenterDataResult {
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

    const todayStr = centerDate();
    const toDateStr = dateAfter(todayStr, 6);

    const [
      roomsRes,
      equipmentRes,
      courtsRes,
      catalogRes,
      productsRes,
      membershipRes,
      streakRes,
      sessionsRes,
    ] = await Promise.allSettled([
      apiFetch<RawRoom[]>('/rooms'),
      apiFetch<RawEquipment[]>('/equipment'),
      courtsApi.courts(),
      apiFetch<RawPublicCatalog>('/public/catalog', { headers: { Authorization: '' } }),
      apiFetch<RawProductPage | RawProductItem[]>('/public/products?size=6', {
        headers: { Authorization: '' },
      }),
      fetchMembershipWithFallback(),
      memberCheckinApi.streak(),
      apiFetch<RawClassSession[]>(
        `/classes/sessions?fromDate=${encodeURIComponent(todayStr)}&toDate=${encodeURIComponent(toDateStr)}`,
      ),
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

    const roomsByName = new Map<string, LiveRoomRecord>();
    for (const r of rooms) {
      roomsByName.set(normalizeKey(r.name), r);
    }

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

    const courts: LiveCourtSummary[] =
      courtsRes.status === 'fulfilled' && Array.isArray(courtsRes.value)
        ? courtsRes.value.map((c: RawCourt) => {
            const matchedRoom = roomsByName.get(normalizeKey(c.name));
            const fallbackCap =
              normalizeKey(c.disciplineName) === normalizeKey('Bơi lội') ? 6 : 4;
            return {
              id: String(c.id),
              name: c.name,
              location: c.location ?? matchedRoom?.location ?? null,
              capacity: Number(c.capacity ?? matchedRoom?.capacity ?? fallbackCap),
              status: c.status ?? matchedRoom?.status ?? 'available',
              disciplineName: c.disciplineName ?? matchedRoom?.disciplineName ?? null,
              openTime: c.openTime ?? matchedRoom?.openTime ?? null,
              closeTime: c.closeTime ?? matchedRoom?.closeTime ?? null,
            };
          })
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

    const rawProductsValue = productsRes.status === 'fulfilled' ? productsRes.value : null;
    const rawProductItems: RawProductItem[] = Array.isArray(rawProductsValue)
      ? rawProductsValue
      : Array.isArray(rawProductsValue?.content)
        ? rawProductsValue.content
        : [];

    const products: LiveProductRecord[] = rawProductItems.map(p => ({
      id: String(p.id),
      name: p.name,
      slug: p.slug,
      price: Number(p.price ?? p.minPrice ?? 0),
      servingsPerContainer: p.servingsPerContainer ?? null,
      stockQuantity:
        p.stockQuantity !== undefined
          ? p.stockQuantity
          : typeof p.inStock === 'boolean'
            ? p.inStock
              ? 1
              : 0
            : null,
    }));

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

    let streak: LiveStreakSummary = null;
    if (streakRes.status === 'fulfilled' && streakRes.value) {
      const st: RawStreak = streakRes.value;
      const activeToday =
        typeof st.activeToday === 'boolean'
          ? st.activeToday
          : Array.isArray(st.activeDates)
            ? st.activeDates.includes(todayStr)
            : false;
      streak = {
        currentStreak: Number(st.currentStreak ?? 0),
        longestStreak: Number(st.longestStreak ?? 0),
        activeToday,
      };
    }

    const rawSessionList: RawClassSession[] =
      sessionsRes.status === 'fulfilled' && Array.isArray(sessionsRes.value)
        ? sessionsRes.value
        : Array.isArray(catalog?.sessions)
          ? catalog.sessions
          : [];

    const classSessions: LiveClassSessionRecord[] = rawSessionList.map(s => ({
      id: String(s.id),
      className: s.className,
      disciplineName: s.disciplineName ?? null,
      roomName: s.roomName ?? null,
      coachName: s.coachName ?? null,
      sessionDate: s.sessionDate,
      startTime: s.startTime,
      endTime: s.endTime,
      capacity: s.capacity ?? null,
      bookedCount: s.bookedCount ?? null,
      status: s.status ?? null,
    }));

    const allCoreFailed =
      roomsRes.status === 'rejected' &&
      equipmentRes.status === 'rejected' &&
      courtsRes.status === 'rejected';

    const snapshotError = allCoreFailed
      ? (roomsRes.reason instanceof Error
          ? roomsRes.reason.message
          : 'Không thể tải dữ liệu trực tiếp')
      : null;

    const nextSnapshot: LiveCenterSnapshot = {
      rooms,
      equipment,
      courts,
      courtSlotsByCourtId: cachedCenterSnapshot?.snapshot.courtSlotsByCourtId ?? {},
      classSessions,
      sessions: classSessions,
      membership,
      streak,
      coaches,
      products,
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

  // Lazily load court slot availability when a court zone (Badminton, Pool, Tennis) is selected
  useEffect(() => {
    if (!selectedZoneId) return;
    const zone = zoneOf(SOL_CENTER_SCENE, selectedZoneId);
    const courtDiscipline = zone?.liveBinding?.courtDiscipline;
    if (!courtDiscipline) return;

    const lastFetched = cachedCourtDisciplineTimestamp.get(courtDiscipline);
    if (lastFetched && Date.now() - lastFetched < CACHE_TTL_MS) {
      return;
    }

    const matchingCourts = snapshot.courts.filter(
      c => normalizeKey(c.disciplineName) === normalizeKey(courtDiscipline),
    );
    if (matchingCourts.length === 0) return;

    let cancelled = false;
    cachedCourtDisciplineTimestamp.set(courtDiscipline, Date.now());
    const todayStr = centerDate();

    void (async () => {
      const results = await Promise.allSettled(
        matchingCourts.map(async court => {
          const numericId = Number(court.id);
          if (Number.isNaN(numericId)) return { courtId: court.id, slots: [] as LiveCourtSlot[] };
          const slots = await courtsApi.availability(numericId, todayStr);
          return {
            courtId: court.id,
            slots: Array.isArray(slots)
              ? slots.map(s => ({
                  startTime: s.startTime,
                  endTime: s.endTime,
                  status: s.status,
                }))
              : [],
          };
        }),
      );

      if (cancelled || !mountedRef.current) return;

      const newSlotsByCourtId: Record<string, LiveCourtSlot[]> = {};
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.slots.length > 0) {
          newSlotsByCourtId[r.value.courtId] = r.value.slots;
        }
      }

      if (Object.keys(newSlotsByCourtId).length === 0) return;

      setSnapshot(prev => {
        const mergedSlots = {
          ...(prev.courtSlotsByCourtId ?? {}),
          ...newSlotsByCourtId,
        };
        const updated: LiveCenterSnapshot = {
          ...prev,
          courtSlotsByCourtId: mergedSlots,
        };
        if (cachedCenterSnapshot) {
          cachedCenterSnapshot = {
            snapshot: updated,
            timestamp: cachedCenterSnapshot.timestamp,
          };
        }
        return updated;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedZoneId, snapshot.courts]);

  const refresh = useCallback(async () => {
    cachedCourtDisciplineTimestamp.clear();
    await loadSnapshot(true);
  }, [loadSnapshot]);

  const bindings = useMemo(() => resolveBindings(SOL_CENTER_SCENE, snapshot), [snapshot]);

  return {
    snapshot,
    bindings,
    loading,
    error,
    refresh,
  };
}
