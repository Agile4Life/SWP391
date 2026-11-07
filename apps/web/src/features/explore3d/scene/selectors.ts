import type {
  HotspotNode,
  ItemNode,
  LevelCode,
  LevelNode,
  SceneDoc,
  SceneNode,
  Vec3,
  WallNode,
  ZoneNode,
} from './schema';
import { polygonBounds2D } from './schema';

export interface WorldBox {
  min: Vec3;
  max: Vec3;
  center: Vec3;
  size: Vec3;
}

export function getNode(doc: SceneDoc, id: string | null | undefined): SceneNode | null {
  if (!id) return null;
  return doc.nodes[id] ?? null;
}

export function getLevels(doc: SceneDoc): LevelNode[] {
  return Object.values(doc.nodes)
    .filter((n): n is LevelNode => n.type === 'level')
    .sort((a, b) => a.order - b.order);
}

export function getLevelByCode(doc: SceneDoc, code: LevelCode): LevelNode | null {
  for (const node of Object.values(doc.nodes)) {
    if (node.type === 'level' && node.code === code) return node;
  }
  return null;
}

export function childrenOf(doc: SceneDoc, parentId: string): SceneNode[] {
  const parent = doc.nodes[parentId];
  if (!parent || !('children' in parent)) return [];
  const out: SceneNode[] = [];
  for (const childId of parent.children) {
    const child = doc.nodes[childId];
    if (child) out.push(child);
  }
  return out;
}

export function levelOf(doc: SceneDoc, nodeId: string | null | undefined): LevelNode | null {
  let curr = getNode(doc, nodeId);
  while (curr) {
    if (curr.type === 'level') return curr;
    curr = getNode(doc, curr.parentId);
  }
  return null;
}

export function zoneOf(doc: SceneDoc, nodeId: string | null | undefined): ZoneNode | null {
  let curr = getNode(doc, nodeId);
  while (curr) {
    if (curr.type === 'zone') return curr;
    curr = getNode(doc, curr.parentId);
  }
  return null;
}

export function zonesOfLevel(doc: SceneDoc, levelIdOrCode: string): ZoneNode[] {
  const level =
    doc.nodes[levelIdOrCode]?.type === 'level'
      ? (doc.nodes[levelIdOrCode] as LevelNode)
      : getLevelByCode(doc, levelIdOrCode as LevelCode);
  if (!level) return [];
  return level.children
    .map(id => doc.nodes[id])
    .filter((n): n is ZoneNode => Boolean(n && n.type === 'zone'));
}

export function wallsOfLevel(doc: SceneDoc, levelIdOrCode: string): WallNode[] {
  const level =
    doc.nodes[levelIdOrCode]?.type === 'level'
      ? (doc.nodes[levelIdOrCode] as LevelNode)
      : getLevelByCode(doc, levelIdOrCode as LevelCode);
  if (!level) return [];
  return level.children
    .map(id => doc.nodes[id])
    .filter((n): n is WallNode => Boolean(n && n.type === 'wall'));
}

export function itemsOfZone(doc: SceneDoc, zoneId: string): ItemNode[] {
  const zone = doc.nodes[zoneId];
  if (!zone || zone.type !== 'zone') return [];
  return zone.children
    .map(id => doc.nodes[id])
    .filter((n): n is ItemNode => Boolean(n && n.type === 'item'));
}

export function itemsOfLevel(doc: SceneDoc, levelIdOrCode: string): ItemNode[] {
  const zones = zonesOfLevel(doc, levelIdOrCode);
  const items: ItemNode[] = [];
  for (const z of zones) {
    items.push(...itemsOfZone(doc, z.id));
  }
  return items;
}

export function hotspotsOfZone(doc: SceneDoc, zoneId: string): HotspotNode[] {
  const zone = doc.nodes[zoneId];
  if (!zone || zone.type !== 'zone') return [];
  return zone.children
    .map(id => doc.nodes[id])
    .filter((n): n is HotspotNode => Boolean(n && n.type === 'hotspot'));
}

export function hotspotsOfLevel(doc: SceneDoc, levelIdOrCode: string): HotspotNode[] {
  const zones = zonesOfLevel(doc, levelIdOrCode);
  const out: HotspotNode[] = [];
  for (const z of zones) {
    out.push(...hotspotsOfZone(doc, z.id));
  }
  return out;
}

export function allZones(doc: SceneDoc): ZoneNode[] {
  return Object.values(doc.nodes).filter((n): n is ZoneNode => n.type === 'zone');
}

export function allItems(doc: SceneDoc): ItemNode[] {
  return Object.values(doc.nodes).filter((n): n is ItemNode => n.type === 'item');
}

export function allHotspots(doc: SceneDoc): HotspotNode[] {
  return Object.values(doc.nodes).filter((n): n is HotspotNode => n.type === 'hotspot');
}

export function getLevelWorldY(
  level: LevelNode,
  levelMode: 'stacked' | 'exploded' | 'solo' = 'stacked',
): number {
  return levelMode === 'exploded' ? level.elevation + level.explodedOffset : level.elevation;
}

export function worldBox(
  doc: SceneDoc,
  nodeId: string,
  levelMode: 'stacked' | 'exploded' | 'solo' = 'stacked',
): WorldBox | null {
  const node = doc.nodes[nodeId];
  if (!node) return null;

  if (node.type === 'site') {
    const [w, d] = node.bounds;
    const min: Vec3 = [-w / 2, -5, -d / 2];
    const max: Vec3 = [w / 2, 14, d / 2];
    return makeBox(min, max);
  }

  if (node.type === 'building') {
    const [w, d] = node.footprint;
    const min: Vec3 = [-w / 2, -5, -d / 2];
    const max: Vec3 = [w / 2 + 24, 14, d / 2];
    return makeBox(min, max);
  }

  if (node.type === 'level') {
    const b = polygonBounds2D(node.slabPolygon);
    const y0 = getLevelWorldY(node, levelMode);
    return makeBox([b.minX, y0, b.minZ], [b.maxX, y0 + node.height, b.maxZ]);
  }

  if (node.type === 'zone') {
    const level = levelOf(doc, node.id);
    const y0 = level ? getLevelWorldY(level, levelMode) : 0;
    const h = level ? level.height : 3.8;
    const b = polygonBounds2D(node.polygon);
    return makeBox([b.minX, y0, b.minZ], [b.maxX, y0 + h, b.maxZ]);
  }

  if (node.type === 'item') {
    const level = levelOf(doc, node.id);
    const y0 = level ? getLevelWorldY(level, levelMode) : 0;
    const [x, y, z] = node.position;
    const [w, h, d] = node.dimensions;
    const cos = Math.abs(Math.cos(node.rotationY));
    const sin = Math.abs(Math.sin(node.rotationY));
    const halfW = (w * cos + d * sin) * 0.5;
    const halfD = (w * sin + d * cos) * 0.5;
    const wy = y0 + y;
    return makeBox([x - halfW, wy, z - halfD], [x + halfW, wy + h, z + halfD]);
  }

  if (node.type === 'hotspot') {
    const level = levelOf(doc, node.id);
    const extraY =
      level && levelMode === 'exploded' ? level.explodedOffset : 0;
    const [x, y, z] = node.position;
    const wy = y + extraY;
    return makeBox([x - 0.8, wy - 0.8, z - 0.8], [x + 0.8, wy + 0.8, z + 0.8]);
  }

  if (node.type === 'wall') {
    const level = levelOf(doc, node.id);
    const y0 = level ? getLevelWorldY(level, levelMode) : 0;
    const minX = Math.min(node.start[0], node.end[0]) - node.thickness * 0.5;
    const maxX = Math.max(node.start[0], node.end[0]) + node.thickness * 0.5;
    const minZ = Math.min(node.start[1], node.end[1]) - node.thickness * 0.5;
    const maxZ = Math.max(node.start[1], node.end[1]) + node.thickness * 0.5;
    return makeBox([minX, y0, minZ], [maxX, y0 + node.height, maxZ]);
  }

  return null;
}

function makeBox(min: Vec3, max: Vec3): WorldBox {
  const center: Vec3 = [
    (min[0] + max[0]) * 0.5,
    (min[1] + max[1]) * 0.5,
    (min[2] + max[2]) * 0.5,
  ];
  const size: Vec3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  return { min, max, center, size };
}

export function breadcrumb(doc: SceneDoc, nodeId: string | null | undefined): SceneNode[] {
  const path: SceneNode[] = [];
  let curr = getNode(doc, nodeId);
  while (curr) {
    if (curr.type !== 'building') {
      path.unshift(curr);
    }
    curr = getNode(doc, curr.parentId);
  }
  if (path.length === 0 && doc.nodes[doc.rootId]) {
    path.push(doc.nodes[doc.rootId]);
  }
  return path;
}

export interface SearchHit {
  id: string;
  nodeType: 'level' | 'zone' | 'item' | 'hotspot';
  titleVi: string;
  titleEn: string;
  subtitleVi: string;
  subtitleEn: string;
  levelCode: LevelCode | null;
  routeTo?: string;
}

function normalizeSearchText(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function search(doc: SceneDoc, rawQuery: string): SearchHit[] {
  const q = normalizeSearchText(rawQuery);
  const hits: SearchHit[] = [];

  for (const node of Object.values(doc.nodes)) {
    if (node.type === 'site' || node.type === 'building' || node.type === 'wall') continue;
    const lvl = levelOf(doc, node.id);
    const levelCode = lvl?.code ?? null;

    if (node.type === 'level') {
      hits.push({
        id: node.id,
        nodeType: 'level',
        titleVi: node.name.vi,
        titleEn: node.name.en,
        subtitleVi: node.subtitle.vi,
        subtitleEn: node.subtitle.en,
        levelCode: node.code,
      });
    } else if (node.type === 'zone') {
      hits.push({
        id: node.id,
        nodeType: 'zone',
        titleVi: node.name.vi,
        titleEn: node.name.en,
        subtitleVi: `${levelCode ?? ''} · ${node.description.vi}`,
        subtitleEn: `${levelCode ?? ''} · ${node.description.en}`,
        levelCode,
      });
    } else if (node.type === 'item') {
      const parentZone = zoneOf(doc, node.id);
      const eqCode = node.liveEquipmentBinding?.equipmentCode ?? '';
      const courtName = node.liveCourtBinding?.courtName ?? '';
      hits.push({
        id: node.id,
        nodeType: 'item',
        titleVi: node.name.vi,
        titleEn: node.name.en,
        subtitleVi: [levelCode, parentZone?.name.vi, eqCode, courtName].filter(Boolean).join(' · '),
        subtitleEn: [levelCode, parentZone?.name.en, eqCode, courtName].filter(Boolean).join(' · '),
        levelCode,
      });
    } else if (node.type === 'hotspot') {
      const routeTo = node.action.type === 'navigate' ? node.action.to : undefined;
      hits.push({
        id: node.id,
        nodeType: 'hotspot',
        titleVi: node.title.vi,
        titleEn: node.title.en,
        subtitleVi: `${levelCode ?? ''} · ${node.subtitle.vi}`,
        subtitleEn: `${levelCode ?? ''} · ${node.subtitle.en}`,
        levelCode,
        routeTo,
      });
    }
  }

  if (!q) {
    // Return top zones & primary hotspots when query is empty
    return hits.filter(h => h.nodeType === 'zone' || h.nodeType === 'hotspot').slice(0, 16);
  }

  return hits.filter(h => {
    const haystack = normalizeSearchText(
      `${h.titleVi} ${h.titleEn} ${h.subtitleVi} ${h.subtitleEn} ${h.id} ${h.routeTo ?? ''}`,
    );
    return haystack.includes(q);
  });
}

/**
 * Resolves a deep-link parameter (`focus` or `item`) by node id, zone code, room name,
 * court name, or equipment code so cross-feature links from `/member/courts` and `/member/classes` work seamlessly.
 */
export function resolveDeepLinkNode(doc: SceneDoc, key: string | null | undefined): SceneNode | null {
  if (!key) return null;
  const trimmed = key.trim();
  if (!trimmed) return null;

  if (doc.nodes[trimmed]) {
    return doc.nodes[trimmed];
  }

  const normalized = normalizeSearchText(trimmed);

  // Match zone code, id, bilingual name, or roomName
  for (const z of allZones(doc)) {
    if (
      normalizeSearchText(z.code) === normalized ||
      normalizeSearchText(z.id) === normalized ||
      normalizeSearchText(z.name.vi) === normalized ||
      normalizeSearchText(z.name.en) === normalized ||
      (z.liveBinding?.roomName && normalizeSearchText(z.liveBinding.roomName) === normalized)
    ) {
      return z;
    }
  }

  // Match item id, bilingual name, courtName, or equipmentCode (slot 0)
  for (const item of allItems(doc)) {
    if (
      normalizeSearchText(item.id) === normalized ||
      normalizeSearchText(item.name.vi) === normalized ||
      normalizeSearchText(item.name.en) === normalized ||
      (item.liveCourtBinding?.courtName &&
        normalizeSearchText(item.liveCourtBinding.courtName) === normalized) ||
      (item.liveEquipmentBinding?.equipmentCode &&
        normalizeSearchText(item.liveEquipmentBinding.equipmentCode) === normalized)
    ) {
      return item;
    }
  }

  // Match hotspot id or bilingual title
  for (const hs of allHotspots(doc)) {
    if (
      normalizeSearchText(hs.id) === normalized ||
      normalizeSearchText(hs.title.vi) === normalized ||
      normalizeSearchText(hs.title.en) === normalized
    ) {
      return hs;
    }
  }

  // Match level id or code
  for (const lvl of getLevels(doc)) {
    if (
      normalizeSearchText(lvl.id) === normalized ||
      normalizeSearchText(lvl.code) === normalized
    ) {
      return lvl;
    }
  }

  return null;
}
