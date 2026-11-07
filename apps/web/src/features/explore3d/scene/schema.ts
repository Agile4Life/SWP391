import { z } from 'zod';

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export interface BilingualText {
  vi: string;
  en: string;
}

export type LevelCode = 'B1' | 'L1' | 'L2' | 'RF' | 'OUT';

export const LEVEL_ORDER: readonly LevelCode[] = ['B1', 'L1', 'L2', 'RF', 'OUT'] as const;

export type ZoneCategory =
  | 'reception'
  | 'gym'
  | 'vip'
  | 'court'
  | 'studio'
  | 'pool'
  | 'locker'
  | 'retail'
  | 'lounge'
  | 'circulation';

export type ViewpointKind = 'overview' | 'hero' | 'detail' | 'eye';

export interface Viewpoint {
  id: string;
  label?: BilingualText;
  kind: ViewpointKind;
  position: Vec3; // world space
  target: Vec3;   // world space
  fov?: number;   // default 38
}

export interface SiteNode {
  id: 'site-sol';
  type: 'site';
  parentId: null;
  name: BilingualText;
  bounds: [number, number]; // [64, 48] meters
  children: string[];
  viewpoints: Viewpoint[];
}

export interface BuildingNode {
  id: 'bld-main';
  type: 'building';
  parentId: 'site-sol';
  name: BilingualText;
  footprint: [number, number]; // [44, 32]
  position: Vec3;
  children: string[];
}

export interface LevelNode {
  id: string;
  type: 'level';
  parentId: string;
  code: LevelCode;
  order: number;
  name: BilingualText;
  subtitle: BilingualText;
  elevation: number;      // base Y in stacked mode (m)
  explodedOffset: number; // extra Y in exploded mode (m)
  height: number;         // wall height (m)
  slabThickness: number;  // 0.28 m
  slabPolygon: Vec2[];    // local XZ polygon
  children: string[];     // zone/wall/hotspot ids
  viewpoints: Viewpoint[];
}

export interface ZoneLiveBinding {
  roomName?: string;
  discipline?: 'Gym' | 'Bơi lội' | 'Boxing' | 'Tennis' | 'Cầu lông' | 'Yoga';
  courtDiscipline?: 'Tennis' | 'Cầu lông' | 'Bơi lội';
  tierRequired?: 'SILVER' | 'GOLD' | 'PLATINUM';
}

export interface ZoneNode {
  id: string;
  type: 'zone';
  parentId: string; // level id
  code: string;
  name: BilingualText;
  description: BilingualText;
  category: ZoneCategory;
  polygon: Vec2[]; // local XZ vertices (CCW)
  floorMaterial:
    | 'rubber-dark'
    | 'hardwood'
    | 'turf'
    | 'tile-stone'
    | 'water'
    | 'acrylic-court'
    | 'concrete-polished'
    | 'tatami';
  accentColor?: string;
  liveBinding?: ZoneLiveBinding;
  viewpoints: Viewpoint[]; // must include at least 1 'hero'
  children: string[];      // item ids + hotspot ids
}

export interface WallOpening {
  id: string;
  kind: 'door' | 'double-door' | 'glass-door' | 'window' | 'arch';
  offset: number;     // distance from `start` along wall (m)
  width: number;      // m
  height: number;     // m
  sillHeight: number; // 0 for doors, >0 for windows
}

export interface WallNode {
  id: string;
  type: 'wall';
  parentId: string; // level id
  start: Vec2;
  end: Vec2;
  thickness: number; // 0.18 exterior, 0.12 interior
  height: number;
  material: 'concrete' | 'glass' | 'accent-salmon' | 'wood-slat';
  exterior: boolean;
  openings: WallOpening[];
}

export type ItemKind =
  | 'treadmill'
  | 'upright-bike'
  | 'elliptical'
  | 'smith-machine'
  | 'lat-pulldown'
  | 'squat-rack'
  | 'dumbbell-rack'
  | 'adjustable-bench'
  | 'kinesis-station'
  | 'inbody-analyzer'
  | 'boxing-ring'
  | 'heavy-bag'
  | 'speed-bag'
  | 'badminton-court'
  | 'tennis-court'
  | 'swim-lane'
  | 'starting-block'
  | 'yoga-mat'
  | 'meditation-bolster'
  | 'reception-desk'
  | 'qr-turnstile'
  | 'kiosk-checkin'
  | 'card-printer'
  | 'supplement-shelf'
  | 'nutrition-board'
  | 'trophy-totem'
  | 'coach-podium'
  | 'consultation-pod'
  | 'locker-bank'
  | 'sauna-bench'
  | 'jacuzzi-tub'
  | 'lounge-sofa'
  | 'juice-bar'
  | 'stair-core'
  | 'elevator-core'
  | 'planter-tree';

export interface ItemLiveEquipmentBinding {
  equipmentCode: string; // e.g., 'EQ-RUN-01', 'EQ-VIP-INBODY-01'
  instanceSlot: number;  // 0..quantity-1
}

export interface ItemLiveCourtBinding {
  courtName: string; // e.g., 'Sân Cầu lông 01', 'Sân Tennis 01', 'Làn bơi 01'
}

export interface ItemNode {
  id: string;
  type: 'item';
  parentId: string; // zone id
  kind: ItemKind;
  name: BilingualText;
  position: Vec3; // local to level (x, y, z)
  rotationY: number; // radians
  scale?: Vec3;
  dimensions: Vec3; // [width, height, depth] in meters for selection & fitToBox
  variant?: 'standard' | 'vip';
  liveEquipmentBinding?: ItemLiveEquipmentBinding;
  liveCourtBinding?: ItemLiveCourtBinding;
  hotspotId?: string;
  viewpoint?: Viewpoint;
}

export type HotspotAction =
  | {
      type: 'navigate';
      to: string;
      query?: Record<string, string>;
      ctaLabel: BilingualText;
      secondaryTo?: string;
      secondaryLabel?: BilingualText;
    }
  | {
      type: 'open-chat';
      topic?: string;
      ctaLabel: BilingualText;
      fallbackTo: '/messages';
    }
  | {
      type: 'focus-level';
      level: LevelCode;
      ctaLabel: BilingualText;
    };

export interface HotspotNode {
  id: string;
  type: 'hotspot';
  parentId: string; // zone id or level id
  position: Vec3;   // world space or level-local with level y added; stored in world space for direct placement
  title: BilingualText;
  subtitle: BilingualText;
  badge?: string;
  icon:
    | 'board'
    | 'package'
    | 'calendar'
    | 'court'
    | 'card'
    | 'scan'
    | 'receipt'
    | 'bag'
    | 'chart'
    | 'bell'
    | 'support'
    | 'profile'
    | 'star'
    | 'dumbbell'
    | 'cube'
    | 'compass';
  priority: 'primary' | 'secondary';
  action: HotspotAction;
  liveSummaryKey?:
    | 'membership'
    | 'classes'
    | 'courts'
    | 'card'
    | 'checkin'
    | 'invoices'
    | 'shop'
    | 'progress'
    | 'streak'
    | 'notifications'
    | 'support'
    | 'profile'
    | 'coaches'
    | 'Overview';
}

export type SceneNode =
  | SiteNode
  | BuildingNode
  | LevelNode
  | ZoneNode
  | WallNode
  | ItemNode
  | HotspotNode;

export interface SceneDoc {
  version: 1;
  rootId: 'site-sol';
  nodes: Record<string, SceneNode>;
}

// --- Zod Schemas ---

const Vec2Schema = z.tuple([z.number(), z.number()]);
const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);

const BilingualTextSchema = z.object({
  vi: z.string().min(1),
  en: z.string().min(1),
});

const ViewpointSchema = z.object({
  id: z.string().min(1),
  label: BilingualTextSchema.optional(),
  kind: z.enum(['overview', 'hero', 'detail', 'eye']),
  position: Vec3Schema,
  target: Vec3Schema,
  fov: z.number().positive().optional(),
});

const LevelCodeSchema = z.enum(['B1', 'L1', 'L2', 'RF', 'OUT']);

const SiteNodeSchema = z.object({
  id: z.literal('site-sol'),
  type: z.literal('site'),
  parentId: z.null(),
  name: BilingualTextSchema,
  bounds: Vec2Schema,
  children: z.array(z.string()),
  viewpoints: z.array(ViewpointSchema).min(1),
});

const BuildingNodeSchema = z.object({
  id: z.literal('bld-main'),
  type: z.literal('building'),
  parentId: z.literal('site-sol'),
  name: BilingualTextSchema,
  footprint: Vec2Schema,
  position: Vec3Schema,
  children: z.array(z.string()),
});

const LevelNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('level'),
  parentId: z.string().min(1),
  code: LevelCodeSchema,
  order: z.number().int(),
  name: BilingualTextSchema,
  subtitle: BilingualTextSchema,
  elevation: z.number(),
  explodedOffset: z.number(),
  height: z.number().positive(),
  slabThickness: z.number().positive(),
  slabPolygon: z.array(Vec2Schema).min(3),
  children: z.array(z.string()),
  viewpoints: z.array(ViewpointSchema).min(1),
});

const ZoneNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('zone'),
  parentId: z.string().min(1),
  code: z.string().min(1),
  name: BilingualTextSchema,
  description: BilingualTextSchema,
  category: z.enum([
    'reception',
    'gym',
    'vip',
    'court',
    'studio',
    'pool',
    'locker',
    'retail',
    'lounge',
    'circulation',
  ]),
  polygon: z.array(Vec2Schema).min(3),
  floorMaterial: z.enum([
    'rubber-dark',
    'hardwood',
    'turf',
    'tile-stone',
    'water',
    'acrylic-court',
    'concrete-polished',
    'tatami',
  ]),
  accentColor: z.string().optional(),
  liveBinding: z
    .object({
      roomName: z.string().optional(),
      discipline: z.enum(['Gym', 'Bơi lội', 'Boxing', 'Tennis', 'Cầu lông', 'Yoga']).optional(),
      courtDiscipline: z.enum(['Tennis', 'Cầu lông', 'Bơi lội']).optional(),
      tierRequired: z.enum(['SILVER', 'GOLD', 'PLATINUM']).optional(),
    })
    .optional(),
  viewpoints: z.array(ViewpointSchema).min(1),
  children: z.array(z.string()),
});

const WallOpeningSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['door', 'double-door', 'glass-door', 'window', 'arch']),
  offset: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
  sillHeight: z.number().min(0),
});

const WallNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('wall'),
  parentId: z.string().min(1),
  start: Vec2Schema,
  end: Vec2Schema,
  thickness: z.number().positive(),
  height: z.number().positive(),
  material: z.enum(['concrete', 'glass', 'accent-salmon', 'wood-slat']),
  exterior: z.boolean(),
  openings: z.array(WallOpeningSchema),
});

const ItemKindSchema = z.enum([
  'treadmill',
  'upright-bike',
  'elliptical',
  'smith-machine',
  'lat-pulldown',
  'squat-rack',
  'dumbbell-rack',
  'adjustable-bench',
  'kinesis-station',
  'inbody-analyzer',
  'boxing-ring',
  'heavy-bag',
  'speed-bag',
  'badminton-court',
  'tennis-court',
  'swim-lane',
  'starting-block',
  'yoga-mat',
  'meditation-bolster',
  'reception-desk',
  'qr-turnstile',
  'kiosk-checkin',
  'card-printer',
  'supplement-shelf',
  'nutrition-board',
  'trophy-totem',
  'coach-podium',
  'consultation-pod',
  'locker-bank',
  'sauna-bench',
  'jacuzzi-tub',
  'lounge-sofa',
  'juice-bar',
  'stair-core',
  'elevator-core',
  'planter-tree',
]);

export const ALL_ITEM_KINDS: readonly ItemKind[] = ItemKindSchema.options;

const ItemNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('item'),
  parentId: z.string().min(1),
  kind: ItemKindSchema,
  name: BilingualTextSchema,
  position: Vec3Schema,
  rotationY: z.number(),
  scale: Vec3Schema.optional(),
  dimensions: Vec3Schema,
  variant: z.enum(['standard', 'vip']).optional(),
  liveEquipmentBinding: z
    .object({
      equipmentCode: z.string().min(1),
      instanceSlot: z.number().int().min(0),
    })
    .optional(),
  liveCourtBinding: z
    .object({
      courtName: z.string().min(1),
    })
    .optional(),
  hotspotId: z.string().optional(),
  viewpoint: ViewpointSchema.optional(),
});

const HotspotActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('navigate'),
    to: z.string().min(1),
    query: z.record(z.string(), z.string()).optional(),
    ctaLabel: BilingualTextSchema,
    secondaryTo: z.string().optional(),
    secondaryLabel: BilingualTextSchema.optional(),
  }),
  z.object({
    type: z.literal('open-chat'),
    topic: z.string().optional(),
    ctaLabel: BilingualTextSchema,
    fallbackTo: z.literal('/messages'),
  }),
  z.object({
    type: z.literal('focus-level'),
    level: LevelCodeSchema,
    ctaLabel: BilingualTextSchema,
  }),
]);

const HotspotNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('hotspot'),
  parentId: z.string().min(1),
  position: Vec3Schema,
  title: BilingualTextSchema,
  subtitle: BilingualTextSchema,
  badge: z.string().optional(),
  icon: z.enum([
    'board',
    'package',
    'calendar',
    'court',
    'card',
    'scan',
    'receipt',
    'bag',
    'chart',
    'bell',
    'support',
    'profile',
    'star',
    'dumbbell',
    'cube',
    'compass',
  ]),
  priority: z.enum(['primary', 'secondary']),
  action: HotspotActionSchema,
  liveSummaryKey: z
    .enum([
      'membership',
      'classes',
      'courts',
      'card',
      'checkin',
      'invoices',
      'shop',
      'progress',
      'streak',
      'notifications',
      'support',
      'profile',
      'coaches',
      'Overview',
    ])
    .optional(),
});

export const SceneNodeSchema = z.discriminatedUnion('type', [
  SiteNodeSchema,
  BuildingNodeSchema,
  LevelNodeSchema,
  ZoneNodeSchema,
  WallNodeSchema,
  ItemNodeSchema,
  HotspotNodeSchema,
]);

export const SceneDocSchema = z.object({
  version: z.literal(1),
  rootId: z.literal('site-sol'),
  nodes: z.record(z.string(), SceneNodeSchema),
});

export function polygonAreaSigned(polygon: Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [x1, z1] = polygon[i];
    const [x2, z2] = polygon[(i + 1) % polygon.length];
    sum += x1 * z2 - x2 * z1;
  }
  return sum * 0.5;
}

export function polygonBounds2D(polygon: Vec2[]): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of polygon) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { minX, maxX, minZ, maxZ };
}

export interface SceneValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateSceneDoc(doc: SceneDoc): SceneValidationResult {
  const errors: string[] = [];
  const parsed = SceneDocSchema.safeParse(doc);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`${issue.path.join('.')}: ${issue.message}`);
    }
    return { valid: false, errors };
  }

  const nodes = doc.nodes;
  if (!nodes[doc.rootId]) {
    errors.push(`Missing root node "${doc.rootId}"`);
  }

  const seenSlots = new Set<string>();

  for (const [key, node] of Object.entries(nodes)) {
    if (node.id !== key) {
      errors.push(`Node key "${key}" does not match node.id "${node.id}"`);
    }
    if (node.parentId !== null && !nodes[node.parentId]) {
      errors.push(`Node "${node.id}" references missing parent "${node.parentId}"`);
    }
    if ('children' in node) {
      for (const childId of node.children) {
        const child = nodes[childId];
        if (!child) {
          errors.push(`Node "${node.id}" lists missing child "${childId}"`);
        } else if (child.parentId !== node.id) {
          errors.push(
            `Child "${childId}" has parentId="${child.parentId}" instead of "${node.id}"`,
          );
        }
      }
    }

    if (node.type === 'zone') {
      const area = Math.abs(polygonAreaSigned(node.polygon));
      if (area < 1) {
        errors.push(`Zone "${node.id}" has degenerate polygon area (${area})`);
      }
      const hasHero = node.viewpoints.some(v => v.kind === 'hero');
      if (!hasHero) {
        errors.push(`Zone "${node.id}" must have at least one 'hero' viewpoint`);
      }
    }

    if (node.type === 'wall') {
      const dx = node.end[0] - node.start[0];
      const dz = node.end[1] - node.start[1];
      const wallLength = Math.hypot(dx, dz);
      if (wallLength <= 0.05) {
        errors.push(`Wall "${node.id}" has near-zero length (${wallLength})`);
      }
      for (const op of node.openings) {
        if (op.offset < 0 || op.offset + op.width > wallLength + 1e-4) {
          errors.push(
            `Wall "${node.id}" opening "${op.id}" [${op.offset}, ${op.offset + op.width}] exceeds wallLength ${wallLength.toFixed(2)}`,
          );
        }
        if (op.sillHeight + op.height > node.height + 1e-4) {
          errors.push(
            `Wall "${node.id}" opening "${op.id}" height (${op.sillHeight + op.height}) exceeds wall height (${node.height})`,
          );
        }
      }
    }

    if (node.type === 'item') {
      const parent = nodes[node.parentId];
      if (!parent || parent.type !== 'zone') {
        errors.push(`Item "${node.id}" must have a ZoneNode parent, got "${parent?.type}"`);
      } else {
        const b = polygonBounds2D(parent.polygon);
        const [x, , z] = node.position;
        const margin = 1.5;
        if (
          x < b.minX - margin ||
          x > b.maxX + margin ||
          z < b.minZ - margin ||
          z > b.maxZ + margin
        ) {
          errors.push(
            `Item "${node.id}" position (${x}, ${z}) is outside zone "${parent.id}" bounds [${b.minX}..${b.maxX}, ${b.minZ}..${b.maxZ}]`,
          );
        }
      }
      if (node.liveEquipmentBinding) {
        const slotKey = `${node.liveEquipmentBinding.equipmentCode}#${node.liveEquipmentBinding.instanceSlot}`;
        if (seenSlots.has(slotKey)) {
          errors.push(`Duplicate equipment instanceSlot "${slotKey}" on item "${node.id}"`);
        }
        seenSlots.add(slotKey);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
