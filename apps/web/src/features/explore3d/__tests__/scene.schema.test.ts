import { describe, expect, it } from 'vitest';
import { ALL_ITEM_KINDS, validateSceneDoc } from '../scene/schema';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import {
  allHotspots,
  allItems,
  allZones,
  breadcrumb,
  childrenOf,
  getLevelByCode,
  getLevels,
  itemsOfZone,
  levelOf,
  resolveDeepLinkNode,
  search,
  worldBox,
  zonesOfLevel,
} from '../scene/selectors';

describe('SOL_CENTER_SCENE schema & integrity', () => {
  it('validates without any schema or referential errors', () => {
    const result = validateSceneDoc(SOL_CENTER_SCENE);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('defines all 5 architectural levels in order B1, L1, L2, RF, OUT', () => {
    const levels = getLevels(SOL_CENTER_SCENE);
    expect(levels.map(l => l.code)).toEqual(['B1', 'L1', 'L2', 'RF', 'OUT']);
    for (const code of ['B1', 'L1', 'L2', 'RF', 'OUT'] as const) {
      expect(getLevelByCode(SOL_CENTER_SCENE, code)).not.toBeNull();
    }
  });

  it('ensures every ZoneNode has at least one hero viewpoint and non-empty children', () => {
    const zones = allZones(SOL_CENTER_SCENE);
    expect(zones.length).toBeGreaterThanOrEqual(16);
    for (const zone of zones) {
      expect(zone.viewpoints.some(v => v.kind === 'hero')).toBe(true);
      expect(zone.children.length).toBeGreaterThan(0);
      expect(levelOf(SOL_CENTER_SCENE, zone.id)).not.toBeNull();
    }
  });

  it('includes all 36 procedural ItemKinds across the center', () => {
    const presentKinds = new Set(allItems(SOL_CENTER_SCENE).map(i => i.kind));
    for (const kind of ALL_ITEM_KINDS) {
      expect(presentKinds.has(kind), `Expected ItemKind "${kind}" in SOL_CENTER_SCENE`).toBe(true);
    }
  });

  it('matches CatalogSeeder equipment codes and slot counts (29 Standard + 11 VIP)', () => {
    const items = allItems(SOL_CENTER_SCENE).filter(i => i.liveEquipmentBinding);
    const byCode = new Map<string, number>();
    for (const item of items) {
      const code = item.liveEquipmentBinding!.equipmentCode;
      byCode.set(code, (byCode.get(code) ?? 0) + 1);
    }
    expect(byCode.get('EQ-RUN-01')).toBe(8);
    expect(byCode.get('EQ-BIKE-01')).toBe(6);
    expect(byCode.get('EQ-SMI-01')).toBe(3);
    expect(byCode.get('EQ-LAT-01')).toBe(2);
    expect(byCode.get('EQ-DUMB-01')).toBe(2);
    expect(byCode.get('EQ-SQUAT-01')).toBe(2);
    expect(byCode.get('EQ-BENCH-01')).toBe(6);
    expect(byCode.get('EQ-VIP-RUN-01')).toBe(4);
    expect(byCode.get('EQ-VIP-SYN-01')).toBe(3);
    expect(byCode.get('EQ-VIP-KIN-01')).toBe(2);
    expect(byCode.get('EQ-VIP-DUMB-01')).toBe(1);
    expect(byCode.get('EQ-VIP-INBODY-01')).toBe(1);
  });

  it('computes worldBox, breadcrumb, search and deep-link resolution accurately', () => {
    const l1 = getLevelByCode(SOL_CENTER_SCENE, 'L1')!;
    expect(zonesOfLevel(SOL_CENTER_SCENE, l1.id).length).toBe(7);
    expect(childrenOf(SOL_CENTER_SCENE, 'site-sol').length).toBe(1);

    const gymItems = itemsOfZone(SOL_CENTER_SCENE, 'zone-l1-gym');
    expect(gymItems.length).toBe(29);

    const boxStacked = worldBox(SOL_CENTER_SCENE, 'zone-l2-vip-gym', 'stacked')!;
    const boxExploded = worldBox(SOL_CENTER_SCENE, 'zone-l2-vip-gym', 'exploded')!;
    expect(boxExploded.center[1]).toBeGreaterThan(boxStacked.center[1]);

    const trail = breadcrumb(SOL_CENTER_SCENE, 'item-l2-vip-inbody-1');
    expect(trail.map(n => n.id)).toEqual([
      'site-sol',
      'lvl-l2',
      'zone-l2-inbody',
      'item-l2-vip-inbody-1',
    ]);

    const searchInbody = search(SOL_CENTER_SCENE, 'inbody');
    expect(searchInbody.some(h => h.id === 'item-l2-vip-inbody-1')).toBe(true);

    const searchCauLong = search(SOL_CENTER_SCENE, 'cau long');
    expect(searchCauLong.some(h => h.id === 'zone-l1-badminton')).toBe(true);

    expect(resolveDeepLinkNode(SOL_CENTER_SCENE, 'Phòng Gym VIP')?.id).toBe('zone-l2-vip-gym');
    expect(resolveDeepLinkNode(SOL_CENTER_SCENE, 'Sân Cầu lông 01')?.id).toBe(
      'item-l1-badminton-01',
    );
    expect(resolveDeepLinkNode(SOL_CENTER_SCENE, 'EQ-VIP-INBODY-01')?.id).toBe(
      'item-l2-vip-inbody-1',
    );
    expect(allHotspots(SOL_CENTER_SCENE).length).toBeGreaterThanOrEqual(20);
  });
});
