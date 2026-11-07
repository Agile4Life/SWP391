import * as THREE from 'three';
import type { ItemNode, LevelCode, SceneDoc, Vec3 } from '../../scene/schema';
import { SOL_CENTER_SCENE } from '../../scene/solCenter.scene';
import { allItems, getLevelByCode, getLevelWorldY, levelOf } from '../../scene/selectors';
import type { LevelMode } from '../../state/exploreStore';

export type ActorActivityKind =
  | 'treadmill-run'
  | 'upright-bike'
  | 'elliptical-stride'
  | 'barbell-squat'
  | 'bench-press'
  | 'dumbbell-curl'
  | 'boxing-spar'
  | 'heavy-bag-boxer'
  | 'heavy-bag-sway'
  | 'badminton-player'
  | 'badminton-shuttlecock'
  | 'swim-freestyle'
  | 'yoga-flow'
  | 'tennis-player'
  | 'tennis-ball'
  | 'inbody-scan'
  | 'pt-coach-tablet'
  | 'receptionist-greet'
  | 'lounge-chat'
  | 'walking-patrol'
  | 'fountain-plume';

export interface ActorOutfitPalette {
  readonly skin: string;
  readonly hair: string;
  readonly top: string;
  readonly bottom: string;
  readonly shoe: string;
  readonly accent: string;
}

export interface LiveActorDefinition {
  readonly id: string;
  readonly level: LevelCode;
  readonly zoneId: string;
  readonly itemId?: string;
  readonly activity: ActorActivityKind;
  readonly anchorPosition: Vec3;
  readonly walkTargetPosition?: Vec3;
  readonly rallySpanZ?: number;
  readonly rallySpanX?: number;
  readonly rallyNetHeight?: number;
  readonly rotationY: number;
  readonly phaseOffset: number;
  readonly speed: number;
  readonly palette: ActorOutfitPalette;
  readonly partCount: number;
  readonly instanceStartIndex: number;
}

export interface EvaluatedPartTransform {
  readonly actorId: string;
  readonly partName: string;
  readonly level: LevelCode;
  readonly visible: boolean;
  readonly position: Vec3;
  readonly rotation: Vec3;
  readonly scale: Vec3;
  readonly color: string;
}

export const STATIC_POSE_TIME_SEC = 1.25;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const OUTFIT_PALETTES: readonly ActorOutfitPalette[] = [
  {
    skin: '#e8be9e',
    hair: '#1e2024',
    top: '#ce9180', // SÖL signature salmon
    bottom: '#23252a',
    shoe: '#f4f3ef',
    accent: '#f07654',
  },
  {
    skin: '#dfb18b',
    hair: '#2c221e',
    top: '#26282e', // SÖL charcoal athletic top
    bottom: '#383b44',
    shoe: '#ce9180',
    accent: '#ce9180',
  },
  {
    skin: '#f0c8a8',
    hair: '#3a271c',
    top: '#f4f3ef', // Crisp ivory performance tee
    bottom: '#22252b',
    shoe: '#e2e8f0',
    accent: '#38bdf8',
  },
  {
    skin: '#d7a17c',
    hair: '#18191c',
    top: '#2e6f7e', // Oasis teal top
    bottom: '#1f232a',
    shoe: '#f8fafc',
    accent: '#68b5c9',
  },
  {
    skin: '#eac0a0',
    hair: '#4a3222',
    top: '#e07a5f', // Warm terracotta coral
    bottom: '#252830',
    shoe: '#f4f3ef',
    accent: '#f59e0b',
  },
  {
    skin: '#c98e68',
    hair: '#17181b',
    top: '#3b4252', // Slate pro jersey
    bottom: '#1e222a',
    shoe: '#ce9180',
    accent: '#10b981',
  },
] as const;

const COACH_PALETTE: ActorOutfitPalette = {
  skin: '#e4b796',
  hair: '#1b1d22',
  top: '#1c1f26',
  bottom: '#282c35',
  shoe: '#ce9180',
  accent: '#f07654',
};

const SWIMMER_PALETTES: readonly ActorOutfitPalette[] = [
  {
    skin: '#e7bc9b',
    hair: '#f07654', // Salmon swim cap
    top: '#1e242d',
    bottom: '#1e242d',
    shoe: '#e7bc9b',
    accent: '#38bdf8',
  },
  {
    skin: '#ddb08c',
    hair: '#38bdf8', // Aqua swim cap
    top: '#222730',
    bottom: '#222730',
    shoe: '#ddb08c',
    accent: '#ce9180',
  },
  {
    skin: '#f0c7a8',
    hair: '#f4f3ef', // White swim cap
    top: '#ce9180',
    bottom: '#1e242d',
    shoe: '#f0c7a8',
    accent: '#38bdf8',
  },
] as const;

const YOGA_PALETTES: readonly ActorOutfitPalette[] = [
  {
    skin: '#ebbfa0',
    hair: '#241c18',
    top: '#ce9180',
    bottom: '#32363f',
    shoe: '#ebbfa0',
    accent: '#f4f3ef',
  },
  {
    skin: '#dfb190',
    hair: '#1a1b1e',
    top: '#d6d3cd',
    bottom: '#282b32',
    shoe: '#dfb190',
    accent: '#ce9180',
  },
  {
    skin: '#f1c9aa',
    hair: '#3e2a1d',
    top: '#4a6b53',
    bottom: '#22252b',
    shoe: '#f1c9aa',
    accent: '#ce9180',
  },
] as const;

export function getPartCountForActivity(activity: ActorActivityKind): number {
  switch (activity) {
    case 'barbell-squat':
    case 'bench-press':
      return 15; // 12 human parts + barbell shaft + 2 weight plates
    case 'dumbbell-curl':
    case 'badminton-player':
    case 'tennis-player':
    case 'swim-freestyle':
      return 14; // 12 human parts + 2 prop/splash parts
    case 'pt-coach-tablet':
      return 13; // 12 human parts + 1 tablet
    case 'heavy-bag-sway':
      return 3; // chain + bag body + salmon strike band
    case 'badminton-shuttlecock':
    case 'tennis-ball':
      return 2; // projectile core + skirt/shadow
    case 'fountain-plume':
      return 8; // 8 rising & cascading water droplets
    default:
      return 12; // 12 articulated human parts
  }
}

/**
 * Builds a single crisp chamfered unit capsule/box geometry centered at `[0, 0, 0]`
 * with exact bounding box `[-0.5, 0.5]` on X, Y, Z and 32 triangles.
 */
let cachedActorPartGeometry: THREE.BufferGeometry | null = null;

export function createActorPartGeometry(): THREE.BufferGeometry {
  if (cachedActorPartGeometry) {
    return cachedActorPartGeometry;
  }

  const profile: ReadonlyArray<readonly [number, number]> = [
    [-0.22, -0.5],
    [0.22, -0.5],
    [0.5, -0.22],
    [0.5, 0.22],
    [0.22, 0.5],
    [-0.22, 0.5],
    [-0.5, 0.22],
    [-0.5, -0.22],
  ];

  // 18 vertices: 8 at y = -0.36, 8 at y = +0.36, 1 bottom apex (0, -0.5, 0), 1 top apex (0, +0.5, 0)
  const positions = new Float32Array(18 * 3);
  const yLow = -0.36;
  const yHigh = 0.36;

  for (let i = 0; i < 8; i++) {
    const [px, pz] = profile[i]!;
    positions[i * 3] = px;
    positions[i * 3 + 1] = yLow;
    positions[i * 3 + 2] = pz;

    const hi = i + 8;
    positions[hi * 3] = px;
    positions[hi * 3 + 1] = yHigh;
    positions[hi * 3 + 2] = pz;
  }

  // Bottom apex (index 16)
  positions[16 * 3] = 0;
  positions[16 * 3 + 1] = -0.5;
  positions[16 * 3 + 2] = 0;

  // Top apex (index 17)
  positions[17 * 3] = 0;
  positions[17 * 3 + 1] = 0.5;
  positions[17 * 3 + 2] = 0;

  // 32 triangles (96 indices)
  const indices = new Uint16Array(32 * 3);
  let ptr = 0;

  // 8 side quads (16 triangles)
  for (let i = 0; i < 8; i++) {
    const next = (i + 1) % 8;
    const b0 = i;
    const b1 = next;
    const t0 = i + 8;
    const t1 = next + 8;

    indices[ptr++] = b0;
    indices[ptr++] = t0;
    indices[ptr++] = b1;

    indices[ptr++] = b1;
    indices[ptr++] = t0;
    indices[ptr++] = t1;
  }

  // 8 bottom cap triangles
  for (let i = 0; i < 8; i++) {
    const next = (i + 1) % 8;
    indices[ptr++] = 16;
    indices[ptr++] = i;
    indices[ptr++] = next;
  }

  // 8 top cap triangles
  for (let i = 0; i < 8; i++) {
    const next = (i + 1) % 8;
    indices[ptr++] = 17;
    indices[ptr++] = next + 8;
    indices[ptr++] = i + 8;
  }

  const geom = new THREE.BufferGeometry();
  geom.name = 'sol-live-actor-unit-part';
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setIndex(new THREE.BufferAttribute(indices, 1));
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();

  cachedActorPartGeometry = geom;
  return geom;
}

/**
 * Deterministically builds all live human and dynamic object definitions from the scene document.
 */
export function buildLiveActorDefinitions(
  scene: SceneDoc = SOL_CENTER_SCENE,
): LiveActorDefinition[] {
  const items = allItems(scene);
  const byId = new Map<string, ItemNode>();
  for (const item of items) {
    byId.set(item.id, item);
  }

  const rawDefs: Array<Omit<LiveActorDefinition, 'partCount' | 'instanceStartIndex'>> = [];
  let paletteIdx = 0;
  const nextPalette = (): ActorOutfitPalette => {
    const p = OUTFIT_PALETTES[paletteIdx % OUTFIT_PALETTES.length]!;
    paletteIdx += 1;
    return p;
  };

  const addFromItem = (
    itemId: string,
    actorId: string,
    activity: ActorActivityKind,
    localOffset: Vec3,
    headingDelta: number,
    phaseOffset: number,
    speed: number,
    customPalette?: ActorOutfitPalette,
    extra?: Partial<
      Pick<
        LiveActorDefinition,
        'walkTargetPosition' | 'rallySpanZ' | 'rallySpanX' | 'rallyNetHeight'
      >
    >,
  ) => {
    const item = byId.get(itemId);
    if (!item) return;
    const lvl = levelOf(scene, item.id);
    if (!lvl) return;

    const cos = Math.cos(item.rotationY);
    const sin = Math.sin(item.rotationY);
    const wx = item.position[0] + localOffset[0] * cos + localOffset[2] * sin;
    const wy = item.position[1] + localOffset[1];
    const wz = item.position[2] - localOffset[0] * sin + localOffset[2] * cos;

    rawDefs.push({
      id: actorId,
      level: lvl.code,
      zoneId: item.parentId,
      itemId: item.id,
      activity,
      anchorPosition: [wx, wy, wz],
      rotationY: item.rotationY + headingDelta,
      phaseOffset,
      speed,
      palette: customPalette ?? nextPalette(),
      ...extra,
    });
  };

  // =========================================================================
  // LEVEL L1 — Standard Gym, Lobby, Boxing Ring & 4 Badminton Courts
  // =========================================================================
  const l1Treadmills = ['item-l1-run-1', 'item-l1-run-3', 'item-l1-run-5', 'item-l1-run-7'];
  l1Treadmills.forEach((id, idx) => {
    addFromItem(
      id,
      `actor-l1-runner-${idx + 1}`,
      'treadmill-run',
      [0, 0.17, 0.14],
      Math.PI,
      idx * 1.15,
      1.0 + (idx % 2) * 0.12,
    );
  });

  const l1Bikes = ['item-l1-bike-1', 'item-l1-bike-3', 'item-l1-bike-5'];
  l1Bikes.forEach((id, idx) => {
    addFromItem(
      id,
      `actor-l1-cyclist-${idx + 1}`,
      'upright-bike',
      [0, 0.1, 0.22],
      Math.PI,
      idx * 1.4,
      1.05,
    );
  });

  const l1Smiths = ['item-l1-smith-1', 'item-l1-smith-3'];
  l1Smiths.forEach((id, idx) => {
    addFromItem(
      id,
      `actor-l1-smith-lifter-${idx + 1}`,
      'barbell-squat',
      [0, 0.05, 0.02],
      Math.PI,
      idx * 1.6,
      0.85,
    );
  });

  const l1SquatRacks = ['item-l1-squat-1', 'item-l1-squat-2'];
  l1SquatRacks.forEach((id, idx) => {
    addFromItem(
      id,
      `actor-l1-squat-lifter-${idx + 1}`,
      'barbell-squat',
      [0, 0.065, -0.04],
      Math.PI,
      idx * 1.8 + 0.5,
      0.82,
    );
  });

  const l1Benches = ['item-l1-bench-2', 'item-l1-bench-5'];
  l1Benches.forEach((id, idx) => {
    addFromItem(
      id,
      `actor-l1-bench-presser-${idx + 1}`,
      'bench-press',
      [0, 0.46, 0.05],
      Math.PI,
      idx * 1.3,
      0.9,
    );
  });

  const l1Dumbbells = ['item-l1-dumbbell-1', 'item-l1-dumbbell-2'];
  l1Dumbbells.forEach((id, idx) => {
    addFromItem(
      id,
      `actor-l1-dumbbell-lifter-${idx + 1}`,
      'dumbbell-curl',
      [0, 0, 1.05],
      0,
      idx * 1.2,
      0.95,
    );
  });

  // L1 Receptionist & Lobby Walkers
  addFromItem(
    'item-l1-reception-desk',
    'actor-l1-receptionist',
    'receptionist-greet',
    [0, 0, -0.95],
    0,
    0.4,
    0.8,
    COACH_PALETTE,
  );

  rawDefs.push(
    {
      id: 'actor-l1-lobby-walker-1',
      level: 'L1',
      zoneId: 'zone-l1-lobby',
      activity: 'walking-patrol',
      anchorPosition: [-0.8, 0, 13.5],
      walkTargetPosition: [-0.8, 0, 5.2],
      rotationY: Math.PI,
      phaseOffset: 0.2,
      speed: 0.85,
      palette: nextPalette(),
    },
    {
      id: 'actor-l1-corridor-walker-2',
      level: 'L1',
      zoneId: 'zone-l1-gate',
      activity: 'walking-patrol',
      anchorPosition: [-4.8, 0, 3.4],
      walkTargetPosition: [4.2, 0, 3.4],
      rotationY: Math.PI / 2,
      phaseOffset: 1.7,
      speed: 0.8,
      palette: nextPalette(),
    },
  );

  // L1 Boxing Ring Sparring Pair + Heavy Bag Boxers + Dynamic Swaying Bags
  addFromItem(
    'item-l1-boxing-ring',
    'actor-l1-ring-boxer-1',
    'boxing-spar',
    [-0.78, 0.5, 0],
    Math.PI / 2,
    0.0,
    1.15,
  );
  addFromItem(
    'item-l1-boxing-ring',
    'actor-l1-ring-boxer-2',
    'boxing-spar',
    [0.78, 0.5, 0],
    -Math.PI / 2,
    Math.PI,
    1.15,
  );

  const activeBags = ['item-l1-heavy-bag-1', 'item-l1-heavy-bag-3'];
  activeBags.forEach((bagId, idx) => {
    const phase = idx * 1.45;
    addFromItem(bagId, `actor-l1-bag-boxer-${idx + 1}`, 'heavy-bag-boxer', [0, 0, 0.92], Math.PI, phase, 1.1);
    addFromItem(bagId, `prop-l1-heavy-bag-sway-${idx + 1}`, 'heavy-bag-sway', [0, 1.28, 0.1], 0, phase, 1.1);
  });

  // L1 Badminton Courts (Courts 01 & 02 active rallies + animated shuttlecocks)
  const activeBadmintonCourts = ['item-l1-badminton-01', 'item-l1-badminton-02'];
  activeBadmintonCourts.forEach((courtId, idx) => {
    const rallyPhase = idx * 1.65;
    addFromItem(
      courtId,
      `actor-l1-badminton-p${idx * 2 + 1}`,
      'badminton-player',
      [-0.35, 0.02, -1.85],
      0,
      rallyPhase,
      1.0,
    );
    addFromItem(
      courtId,
      `actor-l1-badminton-p${idx * 2 + 2}`,
      'badminton-player',
      [0.35, 0.02, 1.85],
      Math.PI,
      rallyPhase + Math.PI,
      1.0,
    );
    addFromItem(
      courtId,
      `prop-l1-shuttlecock-${idx + 1}`,
      'badminton-shuttlecock',
      [0, 0.02, 0],
      0,
      rallyPhase,
      1.0,
      undefined,
      {
        rallySpanZ: 1.78,
        rallySpanX: 0.45,
        rallyNetHeight: 1.55,
      },
    );
  });

  // =========================================================================
  // LEVEL L2 — VIP Platinum Gym, InBody 770 Lab, 1:1 PT Studio & Lounge
  // =========================================================================
  const l2Treadmills = ['item-l2-vip-run-1', 'item-l2-vip-run-3'];
  l2Treadmills.forEach((id, idx) => {
    addFromItem(
      id,
      `actor-l2-vip-runner-${idx + 1}`,
      'treadmill-run',
      [0, 0.18, 0.15],
      Math.PI,
      idx * 1.3 + 0.4,
      1.08,
    );
  });

  addFromItem(
    'item-l2-vip-syn-2',
    'actor-l2-vip-elliptical-1',
    'elliptical-stride',
    [0, 0.24, 0.04],
    Math.PI,
    0.7,
    1.0,
  );

  addFromItem(
    'item-l2-vip-kin-1',
    'actor-l2-vip-squat-1',
    'barbell-squat',
    [0, 0.08, 0.55],
    Math.PI,
    0.9,
    0.85,
  );

  addFromItem(
    'item-l2-vip-inbody-1',
    'actor-l2-inbody-member',
    'inbody-scan',
    [0, 0.095, 0.14],
    Math.PI,
    0.2,
    0.7,
  );
  addFromItem(
    'item-l2-vip-inbody-1',
    'actor-l2-inbody-coach',
    'pt-coach-tablet',
    [0.92, 0, 0.18],
    -Math.PI / 2,
    0.5,
    0.85,
    COACH_PALETTE,
  );

  // L2 1:1 PT Studio Coach & Client
  rawDefs.push(
    {
      id: 'actor-l2-pt-coach',
      level: 'L2',
      zoneId: 'zone-l2-pt-studio',
      itemId: 'item-l2-coach-podium',
      activity: 'pt-coach-tablet',
      anchorPosition: [13.6, 0, 4.4],
      rotationY: 0,
      phaseOffset: 0.0,
      speed: 0.9,
      palette: COACH_PALETTE,
    },
    {
      id: 'actor-l2-pt-client',
      level: 'L2',
      zoneId: 'zone-l2-pt-studio',
      itemId: 'item-l2-pt-bench',
      activity: 'dumbbell-curl',
      anchorPosition: [13.6, 0, 6.2],
      rotationY: Math.PI,
      phaseOffset: 0.0,
      speed: 0.9,
      palette: nextPalette(),
    },
    {
      id: 'actor-l2-lounge-member-1',
      level: 'L2',
      zoneId: 'zone-l2-lounge',
      itemId: 'item-l2-sofa-2',
      activity: 'lounge-chat',
      anchorPosition: [-8.6, 0, 8.9],
      rotationY: Math.PI / 4,
      phaseOffset: 0.3,
      speed: 0.75,
      palette: nextPalette(),
    },
    {
      id: 'actor-l2-lounge-member-2',
      level: 'L2',
      zoneId: 'zone-l2-lounge',
      itemId: 'item-l2-juice-bar',
      activity: 'lounge-chat',
      anchorPosition: [1.4, 0, 8.8],
      rotationY: 0,
      phaseOffset: 1.5,
      speed: 0.75,
      palette: nextPalette(),
    },
  );

  // =========================================================================
  // LEVEL B1 — Oasis 25m Lap Pool Swimmers & Poolside Coach
  // =========================================================================
  rawDefs.push(
    {
      id: 'actor-b1-swimmer-1',
      level: 'B1',
      zoneId: 'zone-b1-pool',
      itemId: 'item-b1-lane-01',
      activity: 'swim-freestyle',
      anchorPosition: [-16.2, 0.14, -9.2],
      walkTargetPosition: [4.2, 0.14, -9.2],
      rotationY: Math.PI / 2,
      phaseOffset: 0.2,
      speed: 0.95,
      palette: SWIMMER_PALETTES[0]!,
    },
    {
      id: 'actor-b1-swimmer-2',
      level: 'B1',
      zoneId: 'zone-b1-pool',
      itemId: 'item-b1-lane-01',
      activity: 'swim-freestyle',
      anchorPosition: [4.2, 0.14, -7.8],
      walkTargetPosition: [-16.2, 0.14, -7.8],
      rotationY: -Math.PI / 2,
      phaseOffset: 2.1,
      speed: 0.88,
      palette: SWIMMER_PALETTES[1]!,
    },
    {
      id: 'actor-b1-swimmer-3',
      level: 'B1',
      zoneId: 'zone-b1-pool',
      itemId: 'item-b1-lane-02',
      activity: 'swim-freestyle',
      anchorPosition: [-15.8, 0.14, -2.5],
      walkTargetPosition: [4.0, 0.14, -2.5],
      rotationY: Math.PI / 2,
      phaseOffset: 1.1,
      speed: 0.92,
      palette: SWIMMER_PALETTES[2]!,
    },
    {
      id: 'actor-b1-pool-coach',
      level: 'B1',
      zoneId: 'zone-b1-pool',
      activity: 'walking-patrol',
      anchorPosition: [-13.5, 0, 1.6],
      walkTargetPosition: [3.5, 0, 1.6],
      rotationY: Math.PI / 2,
      phaseOffset: 0.6,
      speed: 0.75,
      palette: COACH_PALETTE,
    },
  );

  // =========================================================================
  // LEVEL RF — Rooftop Zen Garden Yoga Instructor + 5 Yoga Students
  // =========================================================================
  rawDefs.push({
    id: 'actor-rf-yoga-instructor',
    level: 'RF',
    zoneId: 'zone-rf-zen',
    activity: 'yoga-flow',
    anchorPosition: [-3.7, 0.03, -9.6],
    rotationY: 0,
    phaseOffset: 0.0,
    speed: 0.72,
    palette: COACH_PALETTE,
  });

  const yogaMatIds = [
    'item-rf-yoga-mat-2',
    'item-rf-yoga-mat-3',
    'item-rf-yoga-mat-5',
    'item-rf-yoga-mat-7',
    'item-rf-yoga-mat-10',
  ];
  yogaMatIds.forEach((matId, idx) => {
    addFromItem(
      matId,
      `actor-rf-yoga-student-${idx + 1}`,
      'yoga-flow',
      [0, 0.03, 0],
      Math.PI,
      idx * 0.12, // Synchronized breath flow with gentle ripple
      0.72,
      YOGA_PALETTES[idx % YOGA_PALETTES.length]!,
    );
  });

  // =========================================================================
  // LEVEL OUT — Outdoor Tennis Courts (4 Players + 2 Balls), Pedestrians & Fountain
  // =========================================================================
  const tennisCourts = ['item-out-tennis-01', 'item-out-tennis-02'];
  tennisCourts.forEach((courtId, idx) => {
    const rallyPhase = idx * 1.85 + 0.3;
    addFromItem(
      courtId,
      `actor-out-tennis-p${idx * 2 + 1}`,
      'tennis-player',
      [-0.6, 0.02, -8.8],
      0,
      rallyPhase,
      0.92,
    );
    addFromItem(
      courtId,
      `actor-out-tennis-p${idx * 2 + 2}`,
      'tennis-player',
      [0.6, 0.02, 8.8],
      Math.PI,
      rallyPhase + Math.PI,
      0.92,
    );
    addFromItem(
      courtId,
      `prop-out-tennis-ball-${idx + 1}`,
      'tennis-ball',
      [0, 0.02, 0],
      0,
      rallyPhase,
      0.92,
      undefined,
      {
        rallySpanZ: 8.6,
        rallySpanX: 1.15,
        rallyNetHeight: 1.0,
      },
    );
  });

  // Campus Pedestrians walking through Main Entrance Gate, Zebra Crosswalk & Promenade
  rawDefs.push(
    {
      id: 'actor-out-pedestrian-1',
      level: 'OUT',
      zoneId: 'zone-out-tennis',
      activity: 'walking-patrol',
      anchorPosition: [4.2, 0, 24.4],
      walkTargetPosition: [2.8, 0, 16.8],
      rotationY: Math.PI,
      phaseOffset: 0.4,
      speed: 0.85,
      palette: nextPalette(),
    },
    {
      id: 'actor-out-pedestrian-2',
      level: 'OUT',
      zoneId: 'zone-out-tennis',
      activity: 'walking-patrol',
      anchorPosition: [11.6, 0, 24.45],
      walkTargetPosition: [4.4, 0, 24.45],
      rotationY: -Math.PI / 2,
      phaseOffset: 1.9,
      speed: 0.82,
      palette: nextPalette(),
    },
    {
      id: 'actor-out-pedestrian-3',
      level: 'OUT',
      zoneId: 'zone-out-tennis',
      activity: 'walking-patrol',
      anchorPosition: [16.5, 0, 18.2],
      walkTargetPosition: [5.5, 0, 18.2],
      rotationY: -Math.PI / 2,
      phaseOffset: 3.1,
      speed: 0.88,
      palette: nextPalette(),
    },
    // Animated Courtyard Reflection Fountain Water Plume Jets
    {
      id: 'prop-out-fountain-jets',
      level: 'OUT',
      zoneId: 'zone-out-tennis',
      activity: 'fountain-plume',
      anchorPosition: [0.2, 1.55, 20.8],
      rotationY: 0,
      phaseOffset: 0,
      speed: 1.2,
      palette: nextPalette(),
    },
  );

  // Assign contiguous instanceStartIndex and partCount
  let cursor = 0;
  return rawDefs.map(def => {
    const partCount = getPartCountForActivity(def.activity);
    const fullDef: LiveActorDefinition = {
      ...def,
      partCount,
      instanceStartIndex: cursor,
    };
    cursor += partCount;
    return fullDef;
  });
}

export function getTotalActorInstanceCount(defs: readonly LiveActorDefinition[]): number {
  if (defs.length === 0) return 0;
  const last = defs[defs.length - 1]!;
  return last.instanceStartIndex + last.partCount;
}

export function isActorLevelVisible(
  level: LevelCode,
  levelMode: LevelMode,
  focusLevel: LevelCode | 'ALL',
): boolean {
  if (levelMode === 'solo' && focusLevel !== 'ALL') {
    return level === focusLevel;
  }
  return true;
}

// =========================================================================
// BIOMECHANICAL POSE SOLVER & FORWARD KINEMATICS
// =========================================================================

interface HumanPoseAngles {
  rootOffset: Vec3;
  yawOffset: number;
  torsoPitch: number;
  torsoRoll: number;
  headYaw: number;
  headPitch: number;
  leftShoulderPitch: number;
  leftShoulderSplay: number;
  leftElbowPitch: number;
  leftElbowSplay: number;
  rightShoulderPitch: number;
  rightShoulderSplay: number;
  rightElbowPitch: number;
  rightElbowSplay: number;
  leftHipPitch: number;
  leftHipSplay: number;
  leftKneePitch: number;
  rightHipPitch: number;
  rightHipSplay: number;
  rightKneePitch: number;
  proneMode?: boolean;
  reclinedMode?: boolean;
}

function defaultPoseAngles(): HumanPoseAngles {
  return {
    rootOffset: [0, 0, 0],
    yawOffset: 0,
    torsoPitch: 0,
    torsoRoll: 0,
    headYaw: 0,
    headPitch: 0,
    leftShoulderPitch: 0,
    leftShoulderSplay: -0.08,
    leftElbowPitch: 0.15,
    leftElbowSplay: -0.05,
    rightShoulderPitch: 0,
    rightShoulderSplay: 0.08,
    rightElbowPitch: 0.15,
    rightElbowSplay: 0.05,
    leftHipPitch: 0,
    leftHipSplay: -0.03,
    leftKneePitch: 0,
    rightHipPitch: 0,
    rightHipSplay: 0.03,
    rightKneePitch: 0,
  };
}

function limbDirection(pitch: number, splay: number): Vec3 {
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cs = Math.cos(splay);
  const ss = Math.sin(splay);
  return [ss, -cs * cp, cs * sp];
}

function rotateLocalToWorld(
  anchor: Vec3,
  yaw: number,
  lx: number,
  ly: number,
  lz: number,
): Vec3 {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return [
    anchor[0] + lx * cos + lz * sin,
    anchor[1] + ly,
    anchor[2] - lx * sin + lz * cos,
  ];
}

/**
 * Evaluates all instanced part transforms at `timeSec` for a given set of actor definitions.
 */
export function evaluateActorPartsAtTime(
  defs: readonly LiveActorDefinition[],
  timeSec: number,
  options?: {
    scene?: SceneDoc;
    levelMode?: LevelMode;
    focusLevel?: LevelCode | 'ALL';
  },
): EvaluatedPartTransform[] {
  const scene = options?.scene ?? SOL_CENTER_SCENE;
  const levelMode = options?.levelMode ?? 'stacked';
  const focusLevel = options?.focusLevel ?? 'ALL';

  const levelWorldYMap: Record<LevelCode, number> = {
    B1: -4.5,
    L1: 0,
    L2: 4.5,
    RF: 9.0,
    OUT: 0,
  };
  for (const code of ['B1', 'L1', 'L2', 'RF', 'OUT'] as const) {
    const lvlNode = getLevelByCode(scene, code);
    if (lvlNode) {
      levelWorldYMap[code] = getLevelWorldY(lvlNode, levelMode);
    }
  }

  const out: EvaluatedPartTransform[] = [];

  const pushPart = (
    actor: LiveActorDefinition,
    partName: string,
    visible: boolean,
    position: Vec3,
    rotation: Vec3,
    scale: Vec3,
    color: string,
  ) => {
    out.push({
      actorId: actor.id,
      partName,
      level: actor.level,
      visible,
      position,
      rotation,
      scale: visible ? scale : [0, 0, 0],
      color,
    });
  };

  for (const actor of defs) {
    const visible = isActorLevelVisible(actor.level, levelMode, focusLevel);
    const levelY = levelWorldYMap[actor.level];
    const baseAnchor: Vec3 = [
      actor.anchorPosition[0],
      levelY + actor.anchorPosition[1],
      actor.anchorPosition[2],
    ];
    const phase = timeSec * actor.speed * 3.2 + actor.phaseOffset;

    // -----------------------------------------------------------------------
    // NON-HUMAN DYNAMIC PROPS (Heavy Bag Sway, Shuttlecock, Tennis Ball, Fountain)
    // -----------------------------------------------------------------------
    if (actor.activity === 'heavy-bag-sway') {
      const punchImpulse = Math.max(0, Math.sin(phase * 1.5));
      const swayZ = punchImpulse * 0.14 + Math.sin(phase * 3.0) * 0.03;
      const swayPitch = -punchImpulse * 0.18;
      pushPart(
        actor,
        'bag-chain',
        visible,
        [baseAnchor[0], baseAnchor[1] + 0.74, baseAnchor[2] + swayZ * 0.35],
        [swayPitch * 0.5, actor.rotationY, 0],
        [0.05, 0.32, 0.05],
        '#cbd5e1',
      );
      pushPart(
        actor,
        'bag-body',
        visible,
        [baseAnchor[0], baseAnchor[1] + 0.02, baseAnchor[2] + swayZ],
        [swayPitch, actor.rotationY, 0],
        [0.36, 1.18, 0.36],
        '#19191c',
      );
      pushPart(
        actor,
        'bag-band',
        visible,
        [baseAnchor[0], baseAnchor[1] + 0.16, baseAnchor[2] + swayZ * 1.05],
        [swayPitch, actor.rotationY, 0],
        [0.38, 0.24, 0.38],
        '#f07654',
      );
      continue;
    }

    if (actor.activity === 'badminton-shuttlecock') {
      const spanZ = actor.rallySpanZ ?? 1.78;
      const spanX = actor.rallySpanX ?? 0.45;
      const netH = actor.rallyNetHeight ?? 1.55;
      const cycle = (timeSec * actor.speed * 0.72 + actor.phaseOffset / Math.PI) % 2;
      const forward = cycle < 1;
      const u = forward ? cycle : cycle - 1;
      const z = forward ? -spanZ + 2 * spanZ * u : spanZ - 2 * spanZ * u;
      const x = (forward ? 1 : -1) * spanX * Math.sin(u * Math.PI);
      const y = 1.15 + 4 * u * (1 - u) * (netH + 0.95 - 1.15);
      const pitch = (forward ? 1 : -1) * (0.45 - 0.9 * u);

      const worldPos: Vec3 = [baseAnchor[0] + x, baseAnchor[1] + y, baseAnchor[2] + z];
      pushPart(
        actor,
        'shuttle-cork',
        visible,
        worldPos,
        [pitch, 0, 0],
        [0.09, 0.09, 0.09],
        '#f8fafc',
      );
      pushPart(
        actor,
        'shuttle-skirt',
        visible,
        [worldPos[0], worldPos[1] + 0.05, worldPos[2] + (forward ? -0.05 : 0.05)],
        [pitch + (forward ? -0.3 : 0.3), 0, 0],
        [0.14, 0.14, 0.14],
        '#f07654',
      );
      continue;
    }

    if (actor.activity === 'tennis-ball') {
      const spanZ = actor.rallySpanZ ?? 8.6;
      const spanX = actor.rallySpanX ?? 1.15;
      const cycle = (timeSec * actor.speed * 0.55 + actor.phaseOffset / Math.PI) % 2;
      const forward = cycle < 1;
      const u = forward ? cycle : cycle - 1;
      const z = forward ? -spanZ + 2 * spanZ * u : spanZ - 2 * spanZ * u;
      const x = (forward ? 1 : -1) * spanX * (u - 0.5);

      let y: number;
      if (u <= 0.78) {
        const s = u / 0.78;
        y = (1 - s) * 1.05 + s * 0.09 + 4 * s * (1 - s) * 1.48;
      } else {
        const b = (u - 0.78) / 0.22;
        y = 0.09 + Math.sin(b * Math.PI * 0.5) * 0.96;
      }

      const worldPos: Vec3 = [baseAnchor[0] + x, baseAnchor[1] + y, baseAnchor[2] + z];
      pushPart(
        actor,
        'tennis-ball-core',
        visible,
        worldPos,
        [u * 6.28, u * 3.14, 0],
        [0.14, 0.14, 0.14],
        '#e6ff2b',
      );
      pushPart(
        actor,
        'tennis-ball-shadow',
        visible,
        [worldPos[0], baseAnchor[1] + 0.02, worldPos[2]],
        [0, 0, 0],
        [0.18, 0.02, 0.18],
        '#1f2937',
      );
      continue;
    }

    if (actor.activity === 'fountain-plume') {
      for (let j = 0; j < 8; j++) {
        const angle = (j / 8) * Math.PI * 2;
        const u = (timeSec * actor.speed * 0.9 + j * 0.125) % 1;
        const radius = 0.12 + u * 0.78;
        const height = 4 * u * (1 - u) * 1.35;
        const px = baseAnchor[0] + Math.cos(angle) * radius;
        const py = baseAnchor[1] + height;
        const pz = baseAnchor[2] + Math.sin(angle) * radius;
        const dropletScale = 0.11 + (1 - Math.abs(u - 0.5)) * 0.08;
        pushPart(
          actor,
          `fountain-jet-${j + 1}`,
          visible,
          [px, py, pz],
          [0, angle, 0],
          [dropletScale, dropletScale * 1.8, dropletScale],
          j % 2 === 0 ? '#bae6fd' : '#38bdf8',
        );
      }
      continue;
    }

    // -----------------------------------------------------------------------
    // SWIMMING FREESTYLE (Prone horizontal aquatic kinematics + splash)
    // -----------------------------------------------------------------------
    if (actor.activity === 'swim-freestyle') {
      const target = actor.walkTargetPosition ?? [
        actor.anchorPosition[0] + 18,
        actor.anchorPosition[1],
        actor.anchorPosition[2],
      ];
      const lapCycle = (timeSec * actor.speed * 0.09 + actor.phaseOffset * 0.15) % 2;
      const forwardLap = lapCycle < 1;
      const rawU = forwardLap ? lapCycle : 2 - lapCycle;
      const smoothU = 0.5 - 0.5 * Math.cos(rawU * Math.PI);

      const curX =
        actor.anchorPosition[0] + (target[0] - actor.anchorPosition[0]) * smoothU;
      const curZ =
        actor.anchorPosition[2] + (target[2] - actor.anchorPosition[2]) * smoothU;
      const dx = (target[0] - actor.anchorPosition[0]) * (forwardLap ? 1 : -1);
      const dz = (target[2] - actor.anchorPosition[2]) * (forwardLap ? 1 : -1);
      const swimYaw = Math.atan2(dx, dz);
      const swimAnchor: Vec3 = [curX, baseAnchor[1] + Math.sin(phase) * 0.02, curZ];

      const strokeL = phase;
      const strokeR = phase + Math.PI;
      const kick = Math.sin(phase * 2.5) * 0.11;

      const placeSwimPart = (
        partName: string,
        lx: number,
        ly: number,
        lz: number,
        rx: number,
        ry: number,
        rz: number,
        scale: Vec3,
        color: string,
      ) => {
        const wp = rotateLocalToWorld(swimAnchor, swimYaw, lx, ly, lz);
        pushPart(actor, partName, visible, wp, [rx, swimYaw + ry, rz], scale, color);
      };

      const P = actor.palette;
      placeSwimPart('torso', 0, 0.04, 0.12, Math.PI / 2, 0, Math.sin(phase) * 0.15, [0.34, 0.46, 0.18], P.top);
      placeSwimPart('hips', 0, 0.02, -0.22, Math.PI / 2, 0, 0, [0.3, 0.22, 0.17], P.bottom);
      placeSwimPart('head', 0, 0.09, 0.46, 0.2, Math.sin(phase * 0.5) * 0.35, 0, [0.2, 0.21, 0.22], P.skin);
      placeSwimPart('hair', 0, 0.14, 0.46, 0.15, 0, 0, [0.21, 0.11, 0.23], P.hair);

      // Left arm windmill stroke
      const lArmZ = 0.32 + Math.cos(strokeL) * 0.28;
      const lArmY = 0.06 + Math.sin(strokeL) * 0.18;
      placeSwimPart('leftUpperArm', -0.22, lArmY, lArmZ, Math.PI / 2 - Math.sin(strokeL) * 0.7, 0, 0, [0.09, 0.28, 0.09], P.skin);
      placeSwimPart('leftForearm', -0.24, lArmY + Math.sin(strokeL) * 0.08, lArmZ + Math.cos(strokeL) * 0.22, Math.PI / 2 - Math.sin(strokeL) * 0.9, 0, 0, [0.08, 0.26, 0.08], P.skin);

      // Right arm windmill stroke
      const rArmZ = 0.32 + Math.cos(strokeR) * 0.28;
      const rArmY = 0.06 + Math.sin(strokeR) * 0.18;
      placeSwimPart('rightUpperArm', 0.22, rArmY, rArmZ, Math.PI / 2 - Math.sin(strokeR) * 0.7, 0, 0, [0.09, 0.28, 0.09], P.skin);
      placeSwimPart('rightForearm', 0.24, rArmY + Math.sin(strokeR) * 0.08, rArmZ + Math.cos(strokeR) * 0.22, Math.PI / 2 - Math.sin(strokeR) * 0.9, 0, 0, [0.08, 0.26, 0.08], P.skin);

      // Flutter-kicking legs
      placeSwimPart('leftThigh', -0.1, 0.01 + kick * 0.4, -0.48, Math.PI / 2 + kick, 0, 0, [0.11, 0.34, 0.11], P.skin);
      placeSwimPart('leftShin', -0.1, -0.01 + kick * 0.9, -0.82, Math.PI / 2 + kick * 1.4, 0, 0, [0.09, 0.34, 0.09], P.skin);
      placeSwimPart('rightThigh', 0.1, 0.01 - kick * 0.4, -0.48, Math.PI / 2 - kick, 0, 0, [0.11, 0.34, 0.11], P.skin);
      placeSwimPart('rightShin', 0.1, -0.01 - kick * 0.9, -0.82, Math.PI / 2 - kick * 1.4, 0, 0, [0.09, 0.34, 0.09], P.skin);

      // Water splash droplets behind kicking feet
      placeSwimPart('splashLeft', -0.12, 0.06 + Math.abs(kick) * 0.4, -1.08, 0, 0, 0, [0.14, 0.08, 0.18], '#e0f2fe');
      placeSwimPart('splashRight', 0.12, 0.05 + (0.11 - Math.abs(kick)) * 0.4, -1.14, 0, 0, 0, [0.12, 0.07, 0.16], '#bae6fd');
      continue;
    }

    // -----------------------------------------------------------------------
    // ARTICULATED HUMAN ACTIVITIES
    // -----------------------------------------------------------------------
    const pose = defaultPoseAngles();
    let actorWorldPos: Vec3 = [baseAnchor[0], baseAnchor[1], baseAnchor[2]];
    let actorYaw = actor.rotationY;

    switch (actor.activity) {
      case 'treadmill-run': {
        const s = Math.sin(phase * 1.6);
        const c = Math.cos(phase * 1.6);
        pose.rootOffset = [0, Math.abs(s) * 0.055, 0];
        pose.torsoPitch = 0.15;
        pose.torsoRoll = s * 0.05;
        pose.leftShoulderPitch = -s * 0.68 + 0.15;
        pose.leftElbowPitch = -s * 0.45 + 1.25;
        pose.rightShoulderPitch = s * 0.68 + 0.15;
        pose.rightElbowPitch = s * 0.45 + 1.25;
        pose.leftHipPitch = s * 0.65;
        pose.leftKneePitch = s * 0.45 - 0.55 - Math.max(0, -c) * 0.45;
        pose.rightHipPitch = -s * 0.65;
        pose.rightKneePitch = -s * 0.45 - 0.55 - Math.max(0, c) * 0.45;
        break;
      }

      case 'upright-bike': {
        const crank = phase * 1.5;
        const lSin = Math.sin(crank);
        const rSin = Math.sin(crank + Math.PI);
        pose.rootOffset = [0, -0.06 + Math.sin(crank * 2) * 0.015, 0];
        pose.torsoPitch = 0.42;
        pose.headPitch = -0.22;
        pose.leftShoulderPitch = 0.85;
        pose.leftElbowPitch = 1.1;
        pose.rightShoulderPitch = 0.85;
        pose.rightElbowPitch = 1.1;
        pose.leftHipPitch = 0.75 + lSin * 0.42;
        pose.leftKneePitch = -0.35 - (1 - lSin) * 0.35;
        pose.rightHipPitch = 0.75 + rSin * 0.42;
        pose.rightKneePitch = -0.35 - (1 - rSin) * 0.35;
        break;
      }

      case 'elliptical-stride': {
        const s = Math.sin(phase * 1.3);
        pose.rootOffset = [0, Math.abs(s) * 0.035, 0];
        pose.torsoPitch = 0.08;
        pose.leftShoulderPitch = 0.55 - s * 0.52;
        pose.leftElbowPitch = 1.05 - s * 0.35;
        pose.rightShoulderPitch = 0.55 + s * 0.52;
        pose.rightElbowPitch = 1.05 + s * 0.35;
        pose.leftHipPitch = s * 0.48;
        pose.leftKneePitch = s * 0.25 - 0.2;
        pose.rightHipPitch = -s * 0.48;
        pose.rightKneePitch = -s * 0.25 - 0.2;
        break;
      }

      case 'barbell-squat': {
        const squatFactor = 0.5 - 0.5 * Math.cos(phase * 0.9);
        const depth = squatFactor * 0.34;
        pose.rootOffset = [0, -depth, -squatFactor * 0.08];
        pose.torsoPitch = squatFactor * 0.28;
        pose.headPitch = -squatFactor * 0.18;
        pose.leftShoulderPitch = -0.15;
        pose.leftShoulderSplay = -0.78;
        pose.leftElbowPitch = 1.45;
        pose.leftElbowSplay = -0.45;
        pose.rightShoulderPitch = -0.15;
        pose.rightShoulderSplay = 0.78;
        pose.rightElbowPitch = 1.45;
        pose.rightElbowSplay = 0.45;
        pose.leftHipPitch = squatFactor * 1.05;
        pose.leftHipSplay = -0.12;
        pose.leftKneePitch = -squatFactor * 0.85;
        pose.rightHipPitch = squatFactor * 1.05;
        pose.rightHipSplay = 0.12;
        pose.rightKneePitch = -squatFactor * 0.85;
        break;
      }

      case 'bench-press': {
        pose.reclinedMode = true;
        break;
      }

      case 'dumbbell-curl': {
        const lCurl = 0.5 - 0.5 * Math.cos(phase * 1.2);
        const rCurl = 0.5 - 0.5 * Math.cos(phase * 1.2 + Math.PI);
        pose.rootOffset = [0, Math.sin(phase * 2.4) * 0.015, 0];
        pose.leftShoulderPitch = 0.12 + lCurl * 0.25;
        pose.leftShoulderSplay = -0.14;
        pose.leftElbowPitch = 0.35 + lCurl * 1.85;
        pose.rightShoulderPitch = 0.12 + rCurl * 0.25;
        pose.rightShoulderSplay = 0.14;
        pose.rightElbowPitch = 0.35 + rCurl * 1.85;
        pose.leftHipPitch = 0.08;
        pose.leftKneePitch = -0.08;
        pose.rightHipPitch = 0.08;
        pose.rightKneePitch = -0.08;
        break;
      }

      case 'boxing-spar':
      case 'heavy-bag-boxer': {
        const bounce = Math.abs(Math.sin(phase * 2.2)) * 0.045;
        const stepZ = Math.sin(phase * 1.1) * 0.09;
        const weaveX = Math.cos(phase * 1.1) * 0.06;
        const jab = Math.max(0, Math.sin(phase * 1.5));
        const cross = Math.max(0, Math.sin(phase * 1.5 + 2.2));
        pose.rootOffset = [weaveX, bounce, stepZ];
        pose.torsoPitch = 0.18 + (jab + cross) * 0.08;
        pose.yawOffset = (jab - cross) * 0.25;
        pose.leftShoulderPitch = 0.72 + jab * 0.82;
        pose.leftShoulderSplay = -0.18;
        pose.leftElbowPitch = 1.95 - jab * 0.38;
        pose.rightShoulderPitch = 0.68 + cross * 0.86;
        pose.rightShoulderSplay = 0.18;
        pose.rightElbowPitch = 1.95 - cross * 0.4;
        pose.leftHipPitch = 0.26;
        pose.leftKneePitch = -0.18;
        pose.rightHipPitch = -0.18;
        pose.rightKneePitch = -0.28;
        break;
      }

      case 'badminton-player': {
        const cycle = (timeSec * actor.speed * 0.72 + actor.phaseOffset / Math.PI) % 2;
        const activeSide = cycle < 1;
        const swing = activeSide ? Math.sin(cycle * Math.PI) : 0;
        const swayX = Math.sin(phase * 0.7) * 0.55;
        const lungeZ = swing * 0.32;
        pose.rootOffset = [swayX, Math.abs(Math.sin(phase * 1.4)) * 0.04 - swing * 0.08, lungeZ];
        pose.torsoPitch = 0.16 + swing * 0.18;
        pose.leftShoulderPitch = 0.45 + swing * 0.35;
        pose.leftShoulderSplay = -0.25;
        pose.leftElbowPitch = 1.15;
        pose.rightShoulderPitch = 0.55 + swing * 1.95;
        pose.rightShoulderSplay = 0.22;
        pose.rightElbowPitch = 1.25 + swing * 1.35;
        pose.leftHipPitch = -0.15 - swing * 0.25;
        pose.leftKneePitch = -0.25;
        pose.rightHipPitch = 0.25 + swing * 0.45;
        pose.rightKneePitch = -0.2;
        break;
      }

      case 'tennis-player': {
        const cycle = (timeSec * actor.speed * 0.55 + actor.phaseOffset / Math.PI) % 2;
        const activeSide = cycle < 1;
        const swing = activeSide ? Math.sin(cycle * Math.PI) : 0;
        const baselineX = Math.sin(phase * 0.55) * 1.25;
        pose.rootOffset = [baselineX, Math.abs(Math.sin(phase * 1.3)) * 0.035, swing * 0.22];
        pose.torsoPitch = 0.14;
        pose.yawOffset = -0.25 + swing * 0.85;
        pose.leftShoulderPitch = 0.45;
        pose.leftShoulderSplay = -0.28;
        pose.leftElbowPitch = 1.1;
        pose.rightShoulderPitch = 0.35 + swing * 1.15;
        pose.rightShoulderSplay = 0.45 - swing * 0.3;
        pose.rightElbowPitch = 0.95 + swing * 0.75;
        pose.leftHipPitch = 0.22;
        pose.leftHipSplay = -0.14;
        pose.leftKneePitch = -0.22;
        pose.rightHipPitch = -0.12 + swing * 0.3;
        pose.rightHipSplay = 0.14;
        pose.rightKneePitch = -0.22;
        break;
      }

      case 'yoga-flow': {
        const breath = 0.5 - 0.5 * Math.cos(phase * 0.55);
        pose.rootOffset = [0, -breath * 0.04, 0];
        pose.torsoPitch = (1 - breath) * 0.18;
        pose.headPitch = -breath * 0.22;
        pose.leftShoulderPitch = 0.25 + breath * 2.55;
        pose.leftShoulderSplay = -0.18 - Math.sin(breath * Math.PI) * 0.55;
        pose.leftElbowPitch = 0.45 + breath * 2.45;
        pose.leftElbowSplay = -0.1;
        pose.rightShoulderPitch = 0.25 + breath * 2.55;
        pose.rightShoulderSplay = 0.18 + Math.sin(breath * Math.PI) * 0.55;
        pose.rightElbowPitch = 0.45 + breath * 2.45;
        pose.rightElbowSplay = 0.1;
        break;
      }

      case 'inbody-scan': {
        pose.rootOffset = [0, Math.sin(phase * 0.6) * 0.008, 0];
        pose.leftShoulderPitch = 0.48;
        pose.leftShoulderSplay = -0.36;
        pose.leftElbowPitch = 0.62;
        pose.leftElbowSplay = -0.25;
        pose.rightShoulderPitch = 0.48;
        pose.rightShoulderSplay = 0.36;
        pose.rightElbowPitch = 0.62;
        pose.rightElbowSplay = 0.25;
        break;
      }

      case 'pt-coach-tablet': {
        const gesture = Math.sin(phase * 0.9);
        pose.headYaw = Math.sin(phase * 0.5) * 0.22;
        pose.leftShoulderPitch = 0.42;
        pose.leftShoulderSplay = -0.14;
        pose.leftElbowPitch = 1.45;
        pose.rightShoulderPitch = 0.45 + gesture * 0.35;
        pose.rightShoulderSplay = 0.22;
        pose.rightElbowPitch = 1.25 + gesture * 0.45;
        break;
      }

      case 'receptionist-greet': {
        const wave = Math.sin(phase * 1.1);
        pose.headYaw = Math.sin(phase * 0.55) * 0.28;
        pose.leftShoulderPitch = 0.25;
        pose.leftElbowPitch = 0.85;
        pose.rightShoulderPitch = 0.85 + wave * 0.25;
        pose.rightShoulderSplay = 0.35;
        pose.rightElbowPitch = 2.05 + wave * 0.35;
        pose.rightElbowSplay = 0.25 + wave * 0.2;
        break;
      }

      case 'lounge-chat': {
        const talk = Math.sin(phase * 0.85);
        pose.headYaw = talk * 0.22;
        pose.leftShoulderPitch = 0.3 + talk * 0.2;
        pose.leftElbowPitch = 1.15 + talk * 0.25;
        pose.rightShoulderPitch = 0.25 - talk * 0.18;
        pose.rightElbowPitch = 1.05 - talk * 0.2;
        break;
      }

      case 'walking-patrol': {
        const target = actor.walkTargetPosition ?? [
          actor.anchorPosition[0],
          actor.anchorPosition[1],
          actor.anchorPosition[2] - 6,
        ];
        const walkCycle = (timeSec * actor.speed * 0.14 + actor.phaseOffset * 0.2) % 2;
        const forward = walkCycle < 1;
        const rawU = forward ? walkCycle : 2 - walkCycle;
        const smoothU = 0.5 - 0.5 * Math.cos(rawU * Math.PI);

        const wx =
          actor.anchorPosition[0] + (target[0] - actor.anchorPosition[0]) * smoothU;
        const wz =
          actor.anchorPosition[2] + (target[2] - actor.anchorPosition[2]) * smoothU;
        const dx = (target[0] - actor.anchorPosition[0]) * (forward ? 1 : -1);
        const dz = (target[2] - actor.anchorPosition[2]) * (forward ? 1 : -1);
        actorYaw = Math.atan2(dx, dz);
        actorWorldPos = [wx, baseAnchor[1], wz];

        const stride = Math.sin(phase * 1.25);
        pose.rootOffset = [0, Math.abs(stride) * 0.032, 0];
        pose.torsoPitch = 0.05;
        pose.leftShoulderPitch = -stride * 0.42;
        pose.leftElbowPitch = Math.max(0.15, -stride * 0.35 + 0.35);
        pose.rightShoulderPitch = stride * 0.42;
        pose.rightElbowPitch = Math.max(0.15, stride * 0.35 + 0.35);
        pose.leftHipPitch = stride * 0.46;
        pose.leftKneePitch = stride * 0.25 - 0.22;
        pose.rightHipPitch = -stride * 0.46;
        pose.rightKneePitch = -stride * 0.25 - 0.22;
        break;
      }
    }

    // Special handling for Reclined Bench Presser (15 parts)
    if (pose.reclinedMode) {
      const P = actor.palette;
      const press = 0.5 - 0.5 * Math.cos(phase * 1.0);
      const liftY = press * 0.26;
      const placeBenchPart = (
        partName: string,
        lx: number,
        ly: number,
        lz: number,
        rx: number,
        ry: number,
        rz: number,
        scale: Vec3,
        color: string,
      ) => {
        const wp = rotateLocalToWorld(actorWorldPos, actorYaw, lx, ly, lz);
        pushPart(actor, partName, visible, wp, [rx, actorYaw + ry, rz], scale, color);
      };

      placeBenchPart('torso', 0, 0.22, 0.08, -1.15, 0, 0, [0.35, 0.44, 0.2], P.top);
      placeBenchPart('hips', 0, 0.06, -0.22, -0.4, 0, 0, [0.32, 0.2, 0.2], P.bottom);
      placeBenchPart('head', 0, 0.38, 0.34, -0.8, 0, 0, [0.2, 0.22, 0.2], P.skin);
      placeBenchPart('hair', 0, 0.44, 0.38, -0.8, 0, 0, [0.21, 0.1, 0.22], P.hair);

      placeBenchPart('leftUpperArm', -0.26, 0.32 + liftY * 0.45, 0.14, 0, 0, -0.55 + press * 0.35, [0.1, 0.28, 0.1], P.skin);
      placeBenchPart('leftForearm', -0.34, 0.54 + liftY * 0.95, 0.14, 0, 0, 0.1, [0.09, 0.28, 0.09], P.skin);
      placeBenchPart('rightUpperArm', 0.26, 0.32 + liftY * 0.45, 0.14, 0, 0, 0.55 - press * 0.35, [0.1, 0.28, 0.1], P.skin);
      placeBenchPart('rightForearm', 0.34, 0.54 + liftY * 0.95, 0.14, 0, 0, -0.1, [0.09, 0.28, 0.09], P.skin);

      placeBenchPart('leftThigh', -0.2, -0.02, -0.42, 1.25, 0, -0.2, [0.12, 0.38, 0.12], P.bottom);
      placeBenchPart('leftShin', -0.24, -0.26, -0.58, 0.1, 0, 0, [0.1, 0.38, 0.11], P.shoe);
      placeBenchPart('rightThigh', 0.2, -0.02, -0.42, 1.25, 0, 0.2, [0.12, 0.38, 0.12], P.bottom);
      placeBenchPart('rightShin', 0.24, -0.26, -0.58, 0.1, 0, 0, [0.1, 0.38, 0.11], P.shoe);

      // Pressed Barbell + Weight Plates
      const barY = 0.68 + liftY;
      placeBenchPart('barbellShaft', 0, barY, 0.14, 0, 0, 0, [1.76, 0.038, 0.038], '#cbd5e1');
      placeBenchPart('barbellPlateLeft', -0.74, barY, 0.14, 0, 0, 0, [0.09, 0.36, 0.36], '#ce9180');
      placeBenchPart('barbellPlateRight', 0.74, barY, 0.14, 0, 0, 0, [0.09, 0.36, 0.36], '#ce9180');
      continue;
    }

    // Standard Upright / Articulated Human Rig (12 base parts + optional props)
    const P = actor.palette;
    const totalYaw = actorYaw + pose.yawOffset;
    const [rx, ry, rz] = pose.rootOffset;

    const placeHumanPart = (
      partName: string,
      lx: number,
      ly: number,
      lz: number,
      rotX: number,
      rotY: number,
      rotZ: number,
      scale: Vec3,
      color: string,
    ) => {
      const wp = rotateLocalToWorld(actorWorldPos, totalYaw, lx + rx, ly + ry, lz + rz);
      pushPart(actor, partName, visible, wp, [rotX, totalYaw + rotY, rotZ], scale, color);
    };

    const hipY = 0.88;
    const torsoCenterY = hipY + 0.28 * Math.cos(pose.torsoPitch);
    const torsoCenterZ = 0.28 * Math.sin(pose.torsoPitch);
    const shoulderY = hipY + 0.48 * Math.cos(pose.torsoPitch);
    const shoulderZ = 0.48 * Math.sin(pose.torsoPitch);
    const headY = hipY + 0.66 * Math.cos(pose.torsoPitch);
    const headZ = 0.66 * Math.sin(pose.torsoPitch);

    placeHumanPart(
      'torso',
      0,
      torsoCenterY,
      torsoCenterZ,
      pose.torsoPitch,
      0,
      pose.torsoRoll,
      [0.35, 0.46, 0.21],
      P.top,
    );
    placeHumanPart(
      'hips',
      0,
      hipY,
      0,
      pose.torsoPitch * 0.35,
      0,
      0,
      [0.32, 0.19, 0.2],
      P.bottom,
    );
    placeHumanPart(
      'head',
      0,
      headY,
      headZ,
      pose.torsoPitch * 0.5 + pose.headPitch,
      pose.headYaw,
      0,
      [0.2, 0.23, 0.21],
      P.skin,
    );
    placeHumanPart(
      'hair',
      0,
      headY + 0.09,
      headZ - 0.01,
      pose.torsoPitch * 0.5 + pose.headPitch,
      pose.headYaw,
      0,
      [0.215, 0.1, 0.225],
      P.hair,
    );

    // Left Arm Forward Kinematics
    const lUpperLen = 0.29;
    const lForeLen = 0.27;
    const lShoulder: Vec3 = [-0.22, shoulderY, shoulderZ];
    const lDir1 = limbDirection(pose.leftShoulderPitch, pose.leftShoulderSplay);
    const lElbow: Vec3 = [
      lShoulder[0] + lDir1[0] * lUpperLen,
      lShoulder[1] + lDir1[1] * lUpperLen,
      lShoulder[2] + lDir1[2] * lUpperLen,
    ];
    const lDir2 = limbDirection(pose.leftElbowPitch, pose.leftElbowSplay);
    const lHand: Vec3 = [
      lElbow[0] + lDir2[0] * lForeLen,
      lElbow[1] + lDir2[1] * lForeLen,
      lElbow[2] + lDir2[2] * lForeLen,
    ];

    const isBoxer =
      actor.activity === 'boxing-spar' || actor.activity === 'heavy-bag-boxer';
    const forearmColor = isBoxer ? P.accent : P.skin;
    const forearmScale: Vec3 = isBoxer ? [0.12, lForeLen, 0.12] : [0.088, lForeLen, 0.088];

    placeHumanPart(
      'leftUpperArm',
      (lShoulder[0] + lElbow[0]) * 0.5,
      (lShoulder[1] + lElbow[1]) * 0.5,
      (lShoulder[2] + lElbow[2]) * 0.5,
      -pose.leftShoulderPitch,
      0,
      pose.leftShoulderSplay,
      [0.098, lUpperLen, 0.098],
      P.skin,
    );
    placeHumanPart(
      'leftForearm',
      (lElbow[0] + lHand[0]) * 0.5,
      (lElbow[1] + lHand[1]) * 0.5,
      (lElbow[2] + lHand[2]) * 0.5,
      -pose.leftElbowPitch,
      0,
      pose.leftElbowSplay,
      forearmScale,
      forearmColor,
    );

    // Right Arm Forward Kinematics
    const rShoulder: Vec3 = [0.22, shoulderY, shoulderZ];
    const rDir1 = limbDirection(pose.rightShoulderPitch, pose.rightShoulderSplay);
    const rElbow: Vec3 = [
      rShoulder[0] + rDir1[0] * lUpperLen,
      rShoulder[1] + rDir1[1] * lUpperLen,
      rShoulder[2] + rDir1[2] * lUpperLen,
    ];
    const rDir2 = limbDirection(pose.rightElbowPitch, pose.rightElbowSplay);
    const rHand: Vec3 = [
      rElbow[0] + rDir2[0] * lForeLen,
      rElbow[1] + rDir2[1] * lForeLen,
      rElbow[2] + rDir2[2] * lForeLen,
    ];

    placeHumanPart(
      'rightUpperArm',
      (rShoulder[0] + rElbow[0]) * 0.5,
      (rShoulder[1] + rElbow[1]) * 0.5,
      (rShoulder[2] + rElbow[2]) * 0.5,
      -pose.rightShoulderPitch,
      0,
      pose.rightShoulderSplay,
      [0.098, lUpperLen, 0.098],
      P.skin,
    );
    placeHumanPart(
      'rightForearm',
      (rElbow[0] + rHand[0]) * 0.5,
      (rElbow[1] + rHand[1]) * 0.5,
      (rElbow[2] + rHand[2]) * 0.5,
      -pose.rightElbowPitch,
      0,
      pose.rightElbowSplay,
      forearmScale,
      forearmColor,
    );

    // Left Leg Forward Kinematics
    const thighLen = 0.42;
    const shinLen = 0.42;
    const lHip: Vec3 = [-0.1, hipY - 0.04, 0];
    const lLegDir1 = limbDirection(pose.leftHipPitch, pose.leftHipSplay);
    const lKnee: Vec3 = [
      lHip[0] + lLegDir1[0] * thighLen,
      lHip[1] + lLegDir1[1] * thighLen,
      lHip[2] + lLegDir1[2] * thighLen,
    ];
    const lLegDir2 = limbDirection(pose.leftKneePitch, pose.leftHipSplay * 0.5);
    const lAnkle: Vec3 = [
      lKnee[0] + lLegDir2[0] * shinLen,
      lKnee[1] + lLegDir2[1] * shinLen,
      lKnee[2] + lLegDir2[2] * shinLen,
    ];

    placeHumanPart(
      'leftThigh',
      (lHip[0] + lKnee[0]) * 0.5,
      (lHip[1] + lKnee[1]) * 0.5,
      (lHip[2] + lKnee[2]) * 0.5,
      -pose.leftHipPitch,
      0,
      pose.leftHipSplay,
      [0.13, thighLen, 0.135],
      P.bottom,
    );
    placeHumanPart(
      'leftShin',
      (lKnee[0] + lAnkle[0]) * 0.5,
      (lKnee[1] + lAnkle[1]) * 0.5,
      (lKnee[2] + lAnkle[2]) * 0.5,
      -pose.leftKneePitch,
      0,
      pose.leftHipSplay * 0.5,
      [0.105, shinLen, 0.125],
      P.shoe,
    );

    // Right Leg Forward Kinematics
    const rHip: Vec3 = [0.1, hipY - 0.04, 0];
    const rLegDir1 = limbDirection(pose.rightHipPitch, pose.rightHipSplay);
    const rKnee: Vec3 = [
      rHip[0] + rLegDir1[0] * thighLen,
      rHip[1] + rLegDir1[1] * thighLen,
      rHip[2] + rLegDir1[2] * thighLen,
    ];
    const rLegDir2 = limbDirection(pose.rightKneePitch, pose.rightHipSplay * 0.5);
    const rAnkle: Vec3 = [
      rKnee[0] + rLegDir2[0] * shinLen,
      rKnee[1] + rLegDir2[1] * shinLen,
      rKnee[2] + rLegDir2[2] * shinLen,
    ];

    placeHumanPart(
      'rightThigh',
      (rHip[0] + rKnee[0]) * 0.5,
      (rHip[1] + rKnee[1]) * 0.5,
      (rHip[2] + rKnee[2]) * 0.5,
      -pose.rightHipPitch,
      0,
      pose.rightHipSplay,
      [0.13, thighLen, 0.135],
      P.bottom,
    );
    placeHumanPart(
      'rightShin',
      (rKnee[0] + rAnkle[0]) * 0.5,
      (rKnee[1] + rAnkle[1]) * 0.5,
      (rKnee[2] + rAnkle[2]) * 0.5,
      -pose.rightKneePitch,
      0,
      pose.rightHipSplay * 0.5,
      [0.105, shinLen, 0.125],
      P.shoe,
    );

    // -----------------------------------------------------------------------
    // HELD PROPS ATTACHED TO HANDS / SHOULDERS
    // -----------------------------------------------------------------------
    if (actor.activity === 'barbell-squat') {
      const barY = shoulderY + 0.03;
      const barZ = shoulderZ - 0.08;
      placeHumanPart('barbellShaft', 0, barY, barZ, 0, 0, 0, [1.88, 0.038, 0.038], '#cbd5e1');
      placeHumanPart('barbellPlateLeft', -0.78, barY, barZ, 0, 0, 0, [0.1, 0.38, 0.38], '#ce9180');
      placeHumanPart('barbellPlateRight', 0.78, barY, barZ, 0, 0, 0, [0.1, 0.38, 0.38], '#ce9180');
    } else if (actor.activity === 'dumbbell-curl') {
      placeHumanPart('dumbbellLeft', lHand[0], lHand[1], lHand[2], 0, 0, 0, [0.24, 0.095, 0.095], '#19191c');
      placeHumanPart('dumbbellRight', rHand[0], rHand[1], rHand[2], 0, 0, 0, [0.24, 0.095, 0.095], '#19191c');
    } else if (
      actor.activity === 'badminton-player' ||
      actor.activity === 'tennis-player'
    ) {
      const isTennis = actor.activity === 'tennis-player';
      const racketColor = isTennis ? '#f07654' : '#cbd5e1';
      const headScale: Vec3 = isTennis ? [0.24, 0.3, 0.035] : [0.2, 0.25, 0.03];
      placeHumanPart(
        'racketShaft',
        rHand[0],
        rHand[1] + rDir2[1] * 0.16,
        rHand[2] + rDir2[2] * 0.16,
        -pose.rightElbowPitch,
        0,
        pose.rightElbowSplay,
        [0.035, 0.32, 0.035],
        '#cbd5e1',
      );
      placeHumanPart(
        'racketHead',
        rHand[0],
        rHand[1] + rDir2[1] * 0.38,
        rHand[2] + rDir2[2] * 0.38,
        -pose.rightElbowPitch,
        0,
        pose.rightElbowSplay,
        headScale,
        racketColor,
      );
    } else if (actor.activity === 'pt-coach-tablet') {
      placeHumanPart(
        'coachTablet',
        lHand[0] + 0.04,
        lHand[1] + 0.02,
        lHand[2] + 0.06,
        -0.45,
        0,
        0,
        [0.22, 0.025, 0.28],
        '#38bdf8',
      );
    }
  }

  return out;
}
