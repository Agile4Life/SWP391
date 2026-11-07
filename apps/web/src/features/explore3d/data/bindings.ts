import type { ItemNode, SceneDoc, ZoneNode } from '../scene/schema';
import { allItems, allZones, itemsOfZone } from '../scene/selectors';

export interface LiveRoomRecord {
  id: string;
  name: string;
  location?: string | null;
  capacity: number;
  status: string;
  tier?: string | null;
  openTime?: string | null;
  closeTime?: string | null;
  disciplineName?: string | null;
}

export interface LiveEquipmentRecord {
  id: string;
  name: string;
  code: string;
  category: string;
  roomId?: string | null;
  roomName?: string | null;
  quantity: number;
  status: string;
}

export interface LiveCourtSlot {
  startTime: string;
  endTime: string;
  status: string;
}

export interface LiveCourtSummary {
  id: string;
  name: string;
  location?: string | null;
  capacity: number;
  status: string;
  disciplineName?: string | null;
  openTime?: string | null;
  closeTime?: string | null;
  availableSlotsToday?: number;
  nextFreeSlot?: string | null;
}

export interface LiveClassSessionRecord {
  id: string;
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

export type LiveMembershipSummary = {
  packageName: string;
  tier: 'SILVER' | 'GOLD' | 'PLATINUM' | string;
  status: string;
  endDate?: string | null;
  remainingDays?: number | null;
} | null;

export type LiveStreakSummary = {
  currentStreak: number;
  longestStreak: number;
  activeToday?: boolean;
} | null;

export interface LiveCoachRecord {
  id: string;
  fullName: string;
  specialty?: string | null;
  avatarUrl?: string | null;
}

export interface LiveProductRecord {
  id: string;
  name: string;
  slug: string;
  price: number;
  servingsPerContainer?: number | null;
  stockQuantity?: number | null;
}

export interface LiveCenterSnapshot {
  rooms: LiveRoomRecord[];
  equipment: LiveEquipmentRecord[];
  courts: LiveCourtSummary[];
  courtSlotsByCourtId?: Record<string, LiveCourtSlot[]>;
  classSessions?: LiveClassSessionRecord[];
  sessions?: LiveClassSessionRecord[];
  membership?: LiveMembershipSummary;
  streak?: LiveStreakSummary;
  coaches?: LiveCoachRecord[];
  products?: LiveProductRecord[];
  fetchedAt?: number | null;
  error?: string | null;
}

export type NormalizedRoomStatus = 'available' | 'maintenance' | 'closed' | 'unknown';
export type NormalizedEquipmentStatus = 'active' | 'maintenance' | 'broken' | 'retired';
export type NormalizedItemStatus =
  | NormalizedEquipmentStatus
  | NormalizedRoomStatus;

export interface ZoneEquipmentGroupSummary {
  code: string;
  name: string;
  category?: string;
  quantity: number;
  status: NormalizedEquipmentStatus;
  visibleSlots: number;
  overflowCount: number;
  overflowLabel: string | null;
}

export interface ZoneEquipmentSummary {
  totalUnits: number;
  activeUnits: number;
  maintenanceUnits: number;
  brokenUnits: number;
  retiredUnits: number;
  groups: ZoneEquipmentGroupSummary[];
}

export interface ZoneCourtsSummary {
  totalCourts: number;
  availableCourts: number;
  courts: LiveCourtSummary[];
}

export interface ResolvedZoneBinding {
  zoneId: string;
  hasLiveData: boolean;
  roomId: string | null;
  roomName: string | null;
  roomStatus: NormalizedRoomStatus;
  capacity: number | null;
  locationLabel: string | null;
  openHoursLabel: string | null;
  tierRequired: 'SILVER' | 'GOLD' | 'PLATINUM' | null;
  tierLocked: boolean;
  equipmentSummary: ZoneEquipmentSummary;
  courtsSummary: ZoneCourtsSummary;
  upcomingSessions: LiveClassSessionRecord[];
}

export interface ResolvedItemBinding {
  itemId: string;
  hasLiveData: boolean;
  visible: boolean;
  status: NormalizedItemStatus;
  liveName: string | null;
  // Equipment binding properties
  equipmentCode: string | null;
  instanceSlot: number | null;
  quantity: number | null;
  category: string | null;
  sceneSlots: number;
  overflowCount: number;
  overflowBadge: string | null;
  // Court binding properties
  courtName: string | null;
  courtStatus: NormalizedRoomStatus;
  availableSlotsToday: number | null;
  nextFreeSlot: string | null;
  capacity: number | null;
}

export interface ResolvedSceneBindings {
  hasLiveData: boolean;
  zones: Record<string, ResolvedZoneBinding>;
  items: Record<string, ResolvedItemBinding>;
  membership: LiveMembershipSummary;
  streak: LiveStreakSummary;
  coaches: LiveCoachRecord[];
  products: LiveProductRecord[];
  upcomingSessions: LiveClassSessionRecord[];
  fetchedAt: number | null;
  error: string | null;
}

export const EMPTY_LIVE_SNAPSHOT: LiveCenterSnapshot = {
  rooms: [],
  equipment: [],
  courts: [],
  courtSlotsByCourtId: {},
  classSessions: [],
  sessions: [],
  membership: null,
  streak: null,
  coaches: [],
  products: [],
  fetchedAt: null,
  error: null,
};

export function normalizeKey(value: string | null | undefined): string {
  if (!value) return '';
  return value.normalize('NFC').trim().toLowerCase();
}

export function normalizeRoomStatus(status: string | null | undefined): NormalizedRoomStatus {
  const s = normalizeKey(status);
  if (s === 'available' || s === 'active' || s === 'open') return 'available';
  if (s === 'maintenance') return 'maintenance';
  if (s === 'closed' || s === 'inactive') return 'closed';
  return 'unknown';
}

export function normalizeEquipmentStatus(
  status: string | null | undefined,
): NormalizedEquipmentStatus {
  const s = normalizeKey(status);
  if (s === 'maintenance') return 'maintenance';
  if (s === 'broken' || s === 'damaged' || s === 'out_of_order') return 'broken';
  if (s === 'retired' || s === 'inactive' || s === 'decommissioned') return 'retired';
  return 'active';
}

export function inferMembershipTier(
  tierOrPackageName: string | null | undefined,
): 'SILVER' | 'GOLD' | 'PLATINUM' | null {
  if (!tierOrPackageName) return null;
  const upper = tierOrPackageName.normalize('NFC').trim().toUpperCase();
  if (!upper) return null;
  if (upper.includes('PLATINUM') || upper.includes('VIP')) return 'PLATINUM';
  if (upper.includes('GOLD') || upper.includes('STANDARD') || upper.includes('TRIAL')) {
    return 'GOLD';
  }
  if (upper.includes('SILVER') || upper.includes('BASIC')) return 'SILVER';
  return null;
}

const TIER_RANK: Record<'SILVER' | 'GOLD' | 'PLATINUM', number> = {
  SILVER: 1,
  GOLD: 2,
  PLATINUM: 3,
};

function isMembershipActive(membership: LiveMembershipSummary | undefined): boolean {
  if (!membership) return false;
  const status = normalizeKey(membership.status);
  if (!status) return true;
  return status !== 'cancelled' && status !== 'expired' && status !== 'inactive';
}

function formatShortTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 5);
}

function formatOpenHours(
  openTime: string | null | undefined,
  closeTime: string | null | undefined,
): string | null {
  const open = formatShortTime(openTime);
  const close = formatShortTime(closeTime);
  if (!open || !close) return null;
  return `${open} – ${close}`;
}

function enrichCourtWithSlots(
  court: LiveCourtSummary,
  slotsByCourtId: Record<string, LiveCourtSlot[]> | undefined,
): LiveCourtSummary {
  if (!slotsByCourtId) return court;
  const slots = slotsByCourtId[court.id] ?? slotsByCourtId[court.name];
  if (!slots || slots.length === 0) return court;

  const freeSlots = slots.filter(slot => {
    const st = normalizeKey(slot.status);
    return st === 'free' || st === 'available';
  });

  return {
    ...court,
    availableSlotsToday: court.availableSlotsToday ?? freeSlots.length,
    nextFreeSlot:
      court.nextFreeSlot !== undefined
        ? court.nextFreeSlot
        : freeSlots[0]
          ? formatShortTime(freeSlots[0].startTime)
          : null,
  };
}

/**
 * Pure function that resolves live center API records against the static 3D SceneDoc.
 * Never fabricates occupancy percentages or headcounts; marks `hasLiveData: false` when
 * the snapshot is empty or errored.
 */
export function resolveBindings(
  doc: SceneDoc,
  snapshot: LiveCenterSnapshot = EMPTY_LIVE_SNAPSHOT,
): ResolvedSceneBindings {
  const hasError = Boolean(snapshot.error);
  const rawRooms = hasError ? [] : (snapshot.rooms ?? []);
  const rawEquipment = hasError ? [] : (snapshot.equipment ?? []);
  const rawCourts = hasError ? [] : (snapshot.courts ?? []);
  const rawSessions = hasError
    ? []
    : (snapshot.classSessions ?? snapshot.sessions ?? []);
  const membership = hasError ? null : (snapshot.membership ?? null);
  const streak = hasError ? null : (snapshot.streak ?? null);
  const coaches = hasError ? [] : (snapshot.coaches ?? []);
  const products = hasError ? [] : (snapshot.products ?? []);

  // Index rooms by normalized name
  const roomsByName = new Map<string, LiveRoomRecord>();
  for (const r of rawRooms) {
    const key = normalizeKey(r.name);
    if (key) roomsByName.set(key, r);
  }

  // Index equipment by normalized code
  const equipmentByCode = new Map<string, LiveEquipmentRecord>();
  for (const eq of rawEquipment) {
    const key = normalizeKey(eq.code);
    if (key) equipmentByCode.set(key, eq);
  }

  // Enrich and index courts by normalized name
  const enrichedCourts: LiveCourtSummary[] = rawCourts.map(c =>
    enrichCourtWithSlots(c, snapshot.courtSlotsByCourtId),
  );
  const courtsByName = new Map<string, LiveCourtSummary>();
  for (const c of enrichedCourts) {
    const key = normalizeKey(c.name);
    if (key) courtsByName.set(key, c);
  }

  // Count how many scene item slots exist per equipmentCode across the entire SceneDoc
  const sceneItems = allItems(doc);
  const totalSceneSlotsByCode = new Map<string, number>();
  for (const item of sceneItems) {
    const codeKey = normalizeKey(item.liveEquipmentBinding?.equipmentCode);
    if (codeKey) {
      totalSceneSlotsByCode.set(codeKey, (totalSceneSlotsByCode.get(codeKey) ?? 0) + 1);
    }
  }

  // Determine member tier for tier-lock computation
  const activeMemberTier = isMembershipActive(membership)
    ? inferMembershipTier(membership?.tier || membership?.packageName)
    : null;

  // Sort active upcoming sessions chronologically
  const validSessions = rawSessions
    .filter(s => normalizeKey(s.status) !== 'cancelled')
    .slice()
    .sort((a, b) => {
      const dateCmp = a.sessionDate.localeCompare(b.sessionDate);
      if (dateCmp !== 0) return dateCmp;
      return a.startTime.localeCompare(b.startTime);
    });

  // Resolve items
  const resolvedItems: Record<string, ResolvedItemBinding> = {};
  for (const item of sceneItems) {
    resolvedItems[item.id] = resolveItemBinding(
      item,
      equipmentByCode,
      courtsByName,
      roomsByName,
      totalSceneSlotsByCode,
    );
  }

  // Resolve zones
  const resolvedZones: Record<string, ResolvedZoneBinding> = {};
  for (const zone of allZones(doc)) {
    resolvedZones[zone.id] = resolveZoneBinding(
      doc,
      zone,
      roomsByName,
      equipmentByCode,
      courtsByName,
      enrichedCourts,
      validSessions,
      activeMemberTier,
      coaches,
      products,
      membership,
      streak,
    );
  }

  const hasLiveData =
    !hasError &&
    (rawRooms.length > 0 ||
      rawEquipment.length > 0 ||
      rawCourts.length > 0 ||
      validSessions.length > 0 ||
      membership !== null ||
      streak !== null ||
      coaches.length > 0 ||
      products.length > 0);

  return {
    hasLiveData,
    zones: resolvedZones,
    items: resolvedItems,
    membership,
    streak,
    coaches,
    products,
    upcomingSessions: validSessions.slice(0, 6),
    fetchedAt: snapshot.fetchedAt ?? null,
    error: snapshot.error ?? null,
  };
}

function resolveItemBinding(
  item: ItemNode,
  equipmentByCode: Map<string, LiveEquipmentRecord>,
  courtsByName: Map<string, LiveCourtSummary>,
  roomsByName: Map<string, LiveRoomRecord>,
  totalSceneSlotsByCode: Map<string, number>,
): ResolvedItemBinding {
  if (item.liveEquipmentBinding) {
    const { equipmentCode, instanceSlot } = item.liveEquipmentBinding;
    const codeKey = normalizeKey(equipmentCode);
    const totalSceneSlots = totalSceneSlotsByCode.get(codeKey) ?? 1;
    const eq = equipmentByCode.get(codeKey);

    if (!eq) {
      return {
        itemId: item.id,
        hasLiveData: false,
        visible: true,
        status: 'unknown',
        liveName: null,
        equipmentCode,
        instanceSlot,
        quantity: null,
        category: null,
        sceneSlots: totalSceneSlots,
        overflowCount: 0,
        overflowBadge: null,
        courtName: null,
        courtStatus: 'unknown',
        availableSlotsToday: null,
        nextFreeSlot: null,
        capacity: null,
      };
    }

    const clampedQty = Math.max(0, eq.quantity);
    const visible = instanceSlot < clampedQty;
    const overflowCount = Math.max(0, clampedQty - totalSceneSlots);
    const status = normalizeEquipmentStatus(eq.status);
    const overflowBadge =
      instanceSlot === 0 && overflowCount > 0 ? `+${overflowCount}` : null;

    return {
      itemId: item.id,
      hasLiveData: true,
      visible,
      status,
      liveName: eq.name,
      equipmentCode: eq.code,
      instanceSlot,
      quantity: eq.quantity,
      category: eq.category,
      sceneSlots: totalSceneSlots,
      overflowCount,
      overflowBadge,
      courtName: null,
      courtStatus: 'unknown',
      availableSlotsToday: null,
      nextFreeSlot: null,
      capacity: null,
    };
  }

  if (item.liveCourtBinding) {
    const { courtName } = item.liveCourtBinding;
    const courtKey = normalizeKey(courtName);
    const court = courtsByName.get(courtKey);
    const fallbackRoom = !court ? roomsByName.get(courtKey) : undefined;

    if (!court && !fallbackRoom) {
      return {
        itemId: item.id,
        hasLiveData: false,
        visible: true,
        status: 'unknown',
        liveName: null,
        equipmentCode: null,
        instanceSlot: null,
        quantity: null,
        category: null,
        sceneSlots: 1,
        overflowCount: 0,
        overflowBadge: null,
        courtName,
        courtStatus: 'unknown',
        availableSlotsToday: null,
        nextFreeSlot: null,
        capacity: null,
      };
    }

    const courtStatus = normalizeRoomStatus(court ? court.status : fallbackRoom!.status);
    const capacity = court ? court.capacity : fallbackRoom!.capacity;
    const availableSlotsToday = court?.availableSlotsToday ?? null;
    const nextFreeSlot = court?.nextFreeSlot ?? null;
    const liveName = court ? court.name : fallbackRoom!.name;

    return {
      itemId: item.id,
      hasLiveData: true,
      visible: true,
      status: courtStatus,
      liveName,
      equipmentCode: null,
      instanceSlot: null,
      quantity: null,
      category: null,
      sceneSlots: 1,
      overflowCount: 0,
      overflowBadge: null,
      courtName: liveName,
      courtStatus,
      availableSlotsToday,
      nextFreeSlot,
      capacity,
    };
  }

  return {
    itemId: item.id,
    hasLiveData: false,
    visible: true,
    status: 'unknown',
    liveName: null,
    equipmentCode: null,
    instanceSlot: null,
    quantity: null,
    category: null,
    sceneSlots: 1,
    overflowCount: 0,
    overflowBadge: null,
    courtName: null,
    courtStatus: 'unknown',
    availableSlotsToday: null,
    nextFreeSlot: null,
    capacity: null,
  };
}

function resolveZoneBinding(
  doc: SceneDoc,
  zone: ZoneNode,
  roomsByName: Map<string, LiveRoomRecord>,
  equipmentByCode: Map<string, LiveEquipmentRecord>,
  courtsByName: Map<string, LiveCourtSummary>,
  allCourts: LiveCourtSummary[],
  validSessions: LiveClassSessionRecord[],
  activeMemberTier: 'SILVER' | 'GOLD' | 'PLATINUM' | null,
  coaches: LiveCoachRecord[],
  products: LiveProductRecord[],
  membership: LiveMembershipSummary,
  streak: LiveStreakSummary,
): ResolvedZoneBinding {
  const zoneItems = itemsOfZone(doc, zone.id);

  // 1. Room resolution
  const boundRoomKey = normalizeKey(zone.liveBinding?.roomName);
  const matchedRoom = boundRoomKey ? (roomsByName.get(boundRoomKey) ?? null) : null;

  // 2. Tier resolution & locking
  const roomTier = inferMembershipTier(matchedRoom?.tier);
  const tierRequired: 'SILVER' | 'GOLD' | 'PLATINUM' | null =
    zone.liveBinding?.tierRequired ??
    (roomTier === 'PLATINUM' ? 'PLATINUM' : null);

  let tierLocked = false;
  if (tierRequired && activeMemberTier) {
    tierLocked = TIER_RANK[activeMemberTier] < TIER_RANK[tierRequired];
  }

  // 3. Equipment summary for all equipment bound to items in this zone
  const slotCountByCodeInZone = new Map<string, { rawCode: string; slots: number }>();
  for (const item of zoneItems) {
    if (item.liveEquipmentBinding) {
      const rawCode = item.liveEquipmentBinding.equipmentCode;
      const key = normalizeKey(rawCode);
      const prev = slotCountByCodeInZone.get(key);
      if (prev) {
        prev.slots += 1;
      } else {
        slotCountByCodeInZone.set(key, { rawCode, slots: 1 });
      }
    }
  }

  let totalUnits = 0;
  let activeUnits = 0;
  let maintenanceUnits = 0;
  let brokenUnits = 0;
  let retiredUnits = 0;
  const groups: ZoneEquipmentGroupSummary[] = [];

  for (const [codeKey, info] of slotCountByCodeInZone.entries()) {
    const eq = equipmentByCode.get(codeKey);
    if (!eq) continue;
    const qty = Math.max(0, eq.quantity);
    const status = normalizeEquipmentStatus(eq.status);
    const visibleSlots = Math.min(info.slots, qty);
    const overflowCount = Math.max(0, qty - info.slots);

    totalUnits += qty;
    if (status === 'active') activeUnits += qty;
    else if (status === 'maintenance') maintenanceUnits += qty;
    else if (status === 'broken') brokenUnits += qty;
    else if (status === 'retired') retiredUnits += qty;

    groups.push({
      code: eq.code,
      name: eq.name,
      category: eq.category,
      quantity: qty,
      status,
      visibleSlots,
      overflowCount,
      overflowLabel: overflowCount > 0 ? `+${overflowCount}` : null,
    });
  }

  const equipmentSummary: ZoneEquipmentSummary = {
    totalUnits,
    activeUnits,
    maintenanceUnits,
    brokenUnits,
    retiredUnits,
    groups,
  };

  // 4. Courts summary for court zones
  const matchedCourts: LiveCourtSummary[] = [];
  const seenCourtKeys = new Set<string>();

  for (const item of zoneItems) {
    if (item.liveCourtBinding) {
      const cKey = normalizeKey(item.liveCourtBinding.courtName);
      const found = courtsByName.get(cKey);
      if (found && !seenCourtKeys.has(cKey)) {
        seenCourtKeys.add(cKey);
        matchedCourts.push(found);
      } else if (!found && !seenCourtKeys.has(cKey)) {
        const roomAsCourt = roomsByName.get(cKey);
        if (roomAsCourt) {
          seenCourtKeys.add(cKey);
          matchedCourts.push({
            id: roomAsCourt.id,
            name: roomAsCourt.name,
            location: roomAsCourt.location,
            capacity: roomAsCourt.capacity,
            status: roomAsCourt.status,
            disciplineName: roomAsCourt.disciplineName,
            openTime: roomAsCourt.openTime,
            closeTime: roomAsCourt.closeTime,
          });
        }
      }
    }
  }

  const courtDisciplineKey = normalizeKey(zone.liveBinding?.courtDiscipline);
  if (courtDisciplineKey) {
    for (const court of allCourts) {
      const cKey = normalizeKey(court.name);
      if (!seenCourtKeys.has(cKey) && normalizeKey(court.disciplineName) === courtDisciplineKey) {
        seenCourtKeys.add(cKey);
        matchedCourts.push(court);
      }
    }
  }

  const availableCourts = matchedCourts.filter(
    c => normalizeRoomStatus(c.status) === 'available',
  ).length;

  const courtsSummary: ZoneCourtsSummary = {
    totalCourts: matchedCourts.length,
    availableCourts,
    courts: matchedCourts,
  };

  // 5. Upcoming class sessions (up to 3 matching roomName or discipline)
  const disciplineKey = normalizeKey(zone.liveBinding?.discipline);
  const upcomingSessions = validSessions
    .filter(s => {
      if (boundRoomKey && normalizeKey(s.roomName) === boundRoomKey) return true;
      if (disciplineKey && normalizeKey(s.disciplineName) === disciplineKey) return true;
      return false;
    })
    .slice(0, 3);

  // 6. Room status, capacity, location & open hours
  let roomStatus: NormalizedRoomStatus = 'unknown';
  if (matchedRoom) {
    roomStatus = normalizeRoomStatus(matchedRoom.status);
  } else if (matchedCourts.length > 0) {
    roomStatus = availableCourts > 0 ? 'available' : normalizeRoomStatus(matchedCourts[0].status);
  }

  const capacity = matchedRoom ? matchedRoom.capacity : null;
  const locationLabel =
    matchedRoom?.location ?? matchedCourts[0]?.location ?? null;
  const openHoursLabel =
    formatOpenHours(matchedRoom?.openTime, matchedRoom?.closeTime) ??
    formatOpenHours(matchedCourts[0]?.openTime, matchedCourts[0]?.closeTime);

  const hasZoneSpecificContext =
    (zone.id === 'zone-l1-shop' && products.length > 0) ||
    (zone.id === 'zone-l2-pt-studio' && coaches.length > 0) ||
    ((zone.id === 'zone-l1-lobby' || zone.id === 'zone-l1-gate') &&
      (membership !== null || streak !== null));

  const hasLiveData =
    matchedRoom !== null ||
    groups.length > 0 ||
    matchedCourts.length > 0 ||
    upcomingSessions.length > 0 ||
    hasZoneSpecificContext;

  return {
    zoneId: zone.id,
    hasLiveData,
    roomId: matchedRoom?.id ?? null,
    roomName: matchedRoom?.name ?? zone.liveBinding?.roomName ?? null,
    roomStatus,
    capacity,
    locationLabel,
    openHoursLabel,
    tierRequired,
    tierLocked,
    equipmentSummary,
    courtsSummary,
    upcomingSessions,
  };
}
