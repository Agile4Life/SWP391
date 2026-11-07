import { describe, expect, it } from 'vitest';
import {
  EMPTY_LIVE_SNAPSHOT,
  resolveBindings,
  type LiveCenterSnapshot,
  type LiveCourtSummary,
  type LiveEquipmentRecord,
  type LiveRoomRecord,
} from '../data/bindings';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';

/**
 * Exact seed constants mirrored from:
 * - `apps/api/src/main/java/com/swp391/scms/facilities/CatalogSeeder.java`
 * - `apps/api/src/main/java/com/swp391/scms/courts/CourtSeeder.java`
 */
const SEED_ROOMS: LiveRoomRecord[] = [
  {
    id: 'room-1',
    name: 'Phòng Gym Tiêu chuẩn',
    location: 'Tầng 1 - Khu Gym Chính',
    capacity: 50,
    status: 'available',
    tier: 'STANDARD',
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
    id: 'room-3',
    name: 'Zen Garden Studio',
    location: 'Penthouse',
    capacity: 18,
    status: 'available',
    tier: 'STANDARD',
  },
  {
    id: 'room-4',
    name: 'Ring Arena 01',
    location: 'Level 1 - East Wing',
    capacity: 14,
    status: 'maintenance',
    tier: 'STANDARD',
  },
  {
    id: 'room-5',
    name: 'Oasis Lap Pool',
    location: 'Sub-level Oasis',
    capacity: 20,
    status: 'available',
    tier: 'STANDARD',
  },
];

const SEED_EQUIPMENT: LiveEquipmentRecord[] = [
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
    id: 'eq-2',
    name: 'Xe đạp tập Upright Bike',
    code: 'EQ-BIKE-01',
    category: 'Cardio',
    roomName: 'Phòng Gym Tiêu chuẩn',
    quantity: 6,
    status: 'active',
  },
  {
    id: 'eq-3',
    name: 'Giàn tạ đa năng Smith Machine',
    code: 'EQ-SMI-01',
    category: 'Strength',
    roomName: 'Phòng Gym Tiêu chuẩn',
    quantity: 3,
    status: 'active',
  },
  {
    id: 'eq-4',
    name: 'Máy kéo xô đôi Dual Lat Pulldown',
    code: 'EQ-LAT-01',
    category: 'Strength',
    roomName: 'Phòng Gym Tiêu chuẩn',
    quantity: 2,
    status: 'active',
  },
  {
    id: 'eq-5',
    name: 'Dàn tạ tay cao su Dumbbell (2.5-40kg)',
    code: 'EQ-DUMB-01',
    category: 'Free Weights',
    roomName: 'Phòng Gym Tiêu chuẩn',
    quantity: 2,
    status: 'active',
  },
  {
    id: 'eq-6',
    name: 'Khung gánh tạ Squat Rack',
    code: 'EQ-SQUAT-01',
    category: 'Strength',
    roomName: 'Phòng Gym Tiêu chuẩn',
    quantity: 2,
    status: 'active',
  },
  {
    id: 'eq-7',
    name: 'Ghế đẩy ngực đa năng Adjustable Bench',
    code: 'EQ-BENCH-01',
    category: 'Free Weights',
    roomName: 'Phòng Gym Tiêu chuẩn',
    quantity: 6,
    status: 'active',
  },
  {
    id: 'eq-8',
    name: 'Máy chạy bộ cao cấp Technogym Artis Run',
    code: 'EQ-VIP-RUN-01',
    category: 'Cardio',
    roomName: 'Phòng Gym VIP',
    quantity: 4,
    status: 'active',
  },
  {
    id: 'eq-9',
    name: 'Máy tập toàn thân Synchro Elliptical VIP',
    code: 'EQ-VIP-SYN-01',
    category: 'Cardio',
    roomName: 'Phòng Gym VIP',
    quantity: 3,
    status: 'active',
  },
  {
    id: 'eq-10',
    name: 'Dàn tạ khối thông minh Technogym Kinesis One',
    code: 'EQ-VIP-KIN-01',
    category: 'Strength',
    roomName: 'Phòng Gym VIP',
    quantity: 2,
    status: 'active',
  },
  {
    id: 'eq-11',
    name: 'Dàn tạ đơn Urethane bọc crôm VIP',
    code: 'EQ-VIP-DUMB-01',
    category: 'Free Weights',
    roomName: 'Phòng Gym VIP',
    quantity: 1,
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
];

const SEED_COURTS: LiveCourtSummary[] = [
  {
    id: 'court-1',
    name: 'Sân Tennis 01',
    location: 'Khu thể thao ngoài trời - Sân A',
    capacity: 4,
    status: 'available',
    disciplineName: 'Tennis',
    openTime: '06:00',
    closeTime: '22:00',
  },
  {
    id: 'court-2',
    name: 'Sân Tennis 02',
    location: 'Khu thể thao ngoài trời - Sân B',
    capacity: 4,
    status: 'available',
    disciplineName: 'Tennis',
    openTime: '06:00',
    closeTime: '22:00',
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
  },
  {
    id: 'court-4',
    name: 'Sân Cầu lông 02',
    location: 'Nhà thi đấu - Tầng 1',
    capacity: 4,
    status: 'available',
    disciplineName: 'Cầu lông',
    openTime: '06:00',
    closeTime: '22:00',
  },
  {
    id: 'court-5',
    name: 'Sân Cầu lông 03',
    location: 'Nhà thi đấu - Tầng 1',
    capacity: 4,
    status: 'available',
    disciplineName: 'Cầu lông',
    openTime: '06:00',
    closeTime: '22:00',
  },
  {
    id: 'court-6',
    name: 'Sân Cầu lông 04',
    location: 'Nhà thi đấu - Tầng 1',
    capacity: 4,
    status: 'available',
    disciplineName: 'Cầu lông',
    openTime: '06:00',
    closeTime: '22:00',
  },
  {
    id: 'court-7',
    name: 'Làn bơi 01',
    location: 'Hồ bơi - Tầng hầm Oasis',
    capacity: 6,
    status: 'available',
    disciplineName: 'Bơi lội',
    openTime: '06:00',
    closeTime: '22:00',
  },
  {
    id: 'court-8',
    name: 'Làn bơi 02',
    location: 'Hồ bơi - Tầng hầm Oasis',
    capacity: 6,
    status: 'available',
    disciplineName: 'Bơi lội',
    openTime: '06:00',
    closeTime: '22:00',
  },
];

function createSeedSnapshot(overrides: Partial<LiveCenterSnapshot> = {}): LiveCenterSnapshot {
  return {
    rooms: structuredClone(SEED_ROOMS),
    equipment: structuredClone(SEED_EQUIPMENT),
    courts: structuredClone(SEED_COURTS),
    ...overrides,
  };
}

describe('resolveBindings against CatalogSeeder & CourtSeeder constants', () => {
  it('binds all 5 seeded rooms, 12 equipment codes (40 units), and 8 bookable courts accurately', () => {
    const resolved = resolveBindings(SOL_CENTER_SCENE, createSeedSnapshot());
    expect(resolved.hasLiveData).toBe(true);

    // 1. Standard Gym (cap 50, available, 29 equipment units)
    const gymZone = resolved.zones['zone-l1-gym'];
    expect(gymZone.hasLiveData).toBe(true);
    expect(gymZone.roomStatus).toBe('available');
    expect(gymZone.capacity).toBe(50);
    expect(gymZone.locationLabel).toBe('Tầng 1 - Khu Gym Chính');
    expect(gymZone.equipmentSummary.totalUnits).toBe(29);
    expect(gymZone.equipmentSummary.activeUnits).toBe(29);
    expect(gymZone.equipmentSummary.groups.length).toBe(7);

    // 2. VIP Gym (cap 25, available, PLATINUM, 10 equipment units in zone + 1 InBody in lab)
    const vipZone = resolved.zones['zone-l2-vip-gym'];
    expect(vipZone.hasLiveData).toBe(true);
    expect(vipZone.roomStatus).toBe('available');
    expect(vipZone.capacity).toBe(25);
    expect(vipZone.tierRequired).toBe('PLATINUM');
    expect(vipZone.equipmentSummary.totalUnits).toBe(10);
    expect(vipZone.equipmentSummary.activeUnits).toBe(10);

    const inbodyZone = resolved.zones['zone-l2-inbody'];
    expect(inbodyZone.hasLiveData).toBe(true);
    expect(inbodyZone.equipmentSummary.totalUnits).toBe(1);
    expect(resolved.items['item-l2-vip-inbody-1'].status).toBe('active');
    expect(resolved.items['item-l2-vip-inbody-1'].visible).toBe(true);

    // 3. Ring Arena 01 (cap 14, maintenance)
    const boxingZone = resolved.zones['zone-l1-boxing'];
    expect(boxingZone.hasLiveData).toBe(true);
    expect(boxingZone.roomStatus).toBe('maintenance');
    expect(boxingZone.capacity).toBe(14);

    // 4. Zen Garden Studio (cap 18, available)
    const zenZone = resolved.zones['zone-rf-zen'];
    expect(zenZone.hasLiveData).toBe(true);
    expect(zenZone.roomStatus).toBe('available');
    expect(zenZone.capacity).toBe(18);

    // 5. Oasis Lap Pool (cap 20, available, 2 swim lanes)
    const poolZone = resolved.zones['zone-b1-pool'];
    expect(poolZone.hasLiveData).toBe(true);
    expect(poolZone.roomStatus).toBe('available');
    expect(poolZone.capacity).toBe(20);
    expect(poolZone.courtsSummary.totalCourts).toBe(2);
    expect(poolZone.courtsSummary.availableCourts).toBe(2);
    expect(resolved.items['item-b1-lane-01'].courtStatus).toBe('available');
    expect(resolved.items['item-b1-lane-01'].capacity).toBe(6);

    // 6. Badminton Courts 01..04 & Tennis Courts 01..02
    const badmintonZone = resolved.zones['zone-l1-badminton'];
    expect(badmintonZone.courtsSummary.totalCourts).toBe(4);
    expect(badmintonZone.courtsSummary.availableCourts).toBe(4);
    expect(badmintonZone.openHoursLabel).toBe('06:00 – 22:00');
    for (let i = 1; i <= 4; i++) {
      const courtItem = resolved.items[`item-l1-badminton-0${i}`];
      expect(courtItem.hasLiveData).toBe(true);
      expect(courtItem.courtStatus).toBe('available');
      expect(courtItem.capacity).toBe(4);
    }

    const tennisZone = resolved.zones['zone-out-tennis'];
    expect(tennisZone.courtsSummary.totalCourts).toBe(2);
    expect(tennisZone.courtsSummary.availableCourts).toBe(2);
    expect(resolved.items['item-out-tennis-01'].courtStatus).toBe('available');
    expect(resolved.items['item-out-tennis-02'].courtStatus).toBe('available');
  });

  it('clamps visible equipment instances when live quantity is smaller than scene slots', () => {
    const snapshot = createSeedSnapshot();
    const runEq = snapshot.equipment.find(e => e.code === 'EQ-RUN-01')!;
    runEq.quantity = 5;

    const resolved = resolveBindings(SOL_CENTER_SCENE, snapshot);

    // Slots 0..4 (items 1..5) are visible; slots 5..7 (items 6..8) are hidden
    for (let i = 1; i <= 8; i++) {
      const itemBinding = resolved.items[`item-l1-run-${i}`];
      expect(itemBinding.visible).toBe(i <= 5);
      expect(itemBinding.overflowCount).toBe(0);
      expect(itemBinding.overflowBadge).toBeNull();
    }

    const runGroup = resolved.zones['zone-l1-gym'].equipmentSummary.groups.find(
      g => g.code === 'EQ-RUN-01',
    )!;
    expect(runGroup.quantity).toBe(5);
    expect(runGroup.visibleSlots).toBe(5);
    expect(runGroup.overflowCount).toBe(0);
  });

  it('computes overflowCount (+N) when live quantity exceeds scene slots', () => {
    const snapshot = createSeedSnapshot();
    const runEq = snapshot.equipment.find(e => e.code === 'EQ-RUN-01')!;
    runEq.quantity = 12; // Scene has 8 slots -> overflow of +4

    const resolved = resolveBindings(SOL_CENTER_SCENE, snapshot);

    for (let i = 1; i <= 8; i++) {
      const itemBinding = resolved.items[`item-l1-run-${i}`];
      expect(itemBinding.visible).toBe(true);
      expect(itemBinding.overflowCount).toBe(4);
    }
    expect(resolved.items['item-l1-run-1'].overflowBadge).toBe('+4');
    expect(resolved.items['item-l1-run-2'].overflowBadge).toBeNull();

    const runGroup = resolved.zones['zone-l1-gym'].equipmentSummary.groups.find(
      g => g.code === 'EQ-RUN-01',
    )!;
    expect(runGroup.quantity).toBe(12);
    expect(runGroup.visibleSlots).toBe(8);
    expect(runGroup.overflowCount).toBe(4);
    expect(runGroup.overflowLabel).toBe('+4');
  });

  it('maps equipment status (active, maintenance, broken, retired) to item status and zone unit counts', () => {
    const snapshot = createSeedSnapshot();
    snapshot.equipment.find(e => e.code === 'EQ-BIKE-01')!.status = 'maintenance'; // 6 units
    snapshot.equipment.find(e => e.code === 'EQ-SMI-01')!.status = 'broken'; // 3 units
    snapshot.equipment.find(e => e.code === 'EQ-LAT-01')!.status = 'retired'; // 2 units

    const resolved = resolveBindings(SOL_CENTER_SCENE, snapshot);

    expect(resolved.items['item-l1-bike-1'].status).toBe('maintenance');
    expect(resolved.items['item-l1-smith-1'].status).toBe('broken');
    expect(resolved.items['item-l1-lat-1'].status).toBe('retired');

    const summary = resolved.zones['zone-l1-gym'].equipmentSummary;
    expect(summary.totalUnits).toBe(29);
    expect(summary.maintenanceUnits).toBe(6);
    expect(summary.brokenUnits).toBe(3);
    expect(summary.retiredUnits).toBe(2);
    expect(summary.activeUnits).toBe(29 - 6 - 3 - 2);
  });

  it('locks PLATINUM zones for SILVER/GOLD members and unlocks them for PLATINUM members', () => {
    const silverSnapshot = createSeedSnapshot({
      membership: {
        packageName: 'SILVER',
        tier: 'SILVER',
        status: 'active',
        remainingDays: 20,
      },
    });
    const silverResolved = resolveBindings(SOL_CENTER_SCENE, silverSnapshot);
    expect(silverResolved.zones['zone-l2-vip-gym'].tierRequired).toBe('PLATINUM');
    expect(silverResolved.zones['zone-l2-vip-gym'].tierLocked).toBe(true);
    expect(silverResolved.zones['zone-b1-thermal'].tierRequired).toBe('PLATINUM');
    expect(silverResolved.zones['zone-b1-thermal'].tierLocked).toBe(true);
    expect(silverResolved.zones['zone-l1-gym'].tierLocked).toBe(false);

    const platinumSnapshot = createSeedSnapshot({
      membership: {
        packageName: 'PLATINUM 3 THÁNG',
        tier: 'PLATINUM',
        status: 'active',
        remainingDays: 85,
      },
    });
    const platinumResolved = resolveBindings(SOL_CENTER_SCENE, platinumSnapshot);
    expect(platinumResolved.zones['zone-l2-vip-gym'].tierLocked).toBe(false);
    expect(platinumResolved.zones['zone-b1-thermal'].tierLocked).toBe(false);
  });

  it('attaches upcoming class sessions and court slot availability without inventing fake metrics', () => {
    const snapshot = createSeedSnapshot({
      courtSlotsByCourtId: {
        'court-3': [
          { startTime: '08:00:00', endTime: '09:00:00', status: 'booked' },
          { startTime: '09:00:00', endTime: '10:00:00', status: 'free' },
          { startTime: '10:00:00', endTime: '11:00:00', status: 'free' },
        ],
      },
      classSessions: [
        {
          id: 's-1',
          className: 'Sunrise Flow Yoga',
          disciplineName: 'Yoga',
          roomName: 'Zen Garden Studio',
          coachName: 'HLV Minh Anh',
          sessionDate: '2026-11-08',
          startTime: '07:00',
          endTime: '08:00',
          capacity: 18,
          bookedCount: 12,
          status: 'scheduled',
        },
      ],
    });

    const resolved = resolveBindings(SOL_CENTER_SCENE, snapshot);
    const badminton01 = resolved.items['item-l1-badminton-01'];
    expect(badminton01.availableSlotsToday).toBe(2);
    expect(badminton01.nextFreeSlot).toBe('09:00');

    const zenZone = resolved.zones['zone-rf-zen'];
    expect(zenZone.upcomingSessions.length).toBe(1);
    expect(zenZone.upcomingSessions[0].className).toBe('Sunrise Flow Yoga');
  });

  it('sets hasLiveData: false and invents no numbers when snapshot is empty or errored', () => {
    const emptyResolved = resolveBindings(SOL_CENTER_SCENE, EMPTY_LIVE_SNAPSHOT);
    expect(emptyResolved.hasLiveData).toBe(false);
    for (const zone of Object.values(emptyResolved.zones)) {
      expect(zone.hasLiveData).toBe(false);
      expect(zone.roomStatus).toBe('unknown');
      expect(zone.capacity).toBeNull();
      expect(zone.equipmentSummary.totalUnits).toBe(0);
      expect(zone.courtsSummary.totalCourts).toBe(0);
    }
    expect(emptyResolved.items['item-l1-run-1'].hasLiveData).toBe(false);
    expect(emptyResolved.items['item-l1-run-1'].visible).toBe(true);
    expect(emptyResolved.items['item-l1-run-1'].status).toBe('unknown');

    const erroredSnapshot = createSeedSnapshot({ error: 'Network error' });
    const erroredResolved = resolveBindings(SOL_CENTER_SCENE, erroredSnapshot);
    expect(erroredResolved.hasLiveData).toBe(false);
    expect(erroredResolved.zones['zone-l1-gym'].hasLiveData).toBe(false);
    expect(erroredResolved.zones['zone-l1-gym'].capacity).toBeNull();
  });
});
