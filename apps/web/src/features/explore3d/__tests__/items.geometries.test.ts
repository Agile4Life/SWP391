import { describe, expect, it, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ALL_ITEM_KINDS } from '../scene/schema';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import {
  buildChamferBoxGeometry,
  clearItemGeometryCache,
  computeItemInstanceMatrix,
  DEFAULT_ITEM_DIMENSIONS,
  getGeometryTriangleCount,
  getItemGeometry,
  groupItemsByKind,
  isItemInstanceVisible,
  ITEM_HIGH_DETAIL_TRIANGLE_BUDGET,
  ITEM_STATUS_COLORS,
  resolveItemInstanceColor,
  warmAllItemGeometries,
} from '../renderers/items/itemGeometries';
import { ItemInstances } from '../canvas/ItemInstances';
import { Courts } from '../canvas/Courts';
import { Pool } from '../canvas/Pool';

describe('EXP-05 Procedural Item Geometries, Instancing, Courts & Pool', () => {
  beforeEach(() => {
    clearItemGeometryCache();
  });

  it('covers all 36 ItemKind values in ALL_ITEM_KINDS', () => {
    expect(ALL_ITEM_KINDS).toHaveLength(36);
    for (const kind of ALL_ITEM_KINDS) {
      expect(DEFAULT_ITEM_DIMENSIONS[kind]).toBeDefined();
      expect(DEFAULT_ITEM_DIMENSIONS[kind]).toHaveLength(3);
    }
  });

  it.each(ALL_ITEM_KINDS)(
    'builds valid high and low detail BufferGeometry for "%s" with position, normal, color and no NaNs',
    kind => {
      const highGeom = getItemGeometry(kind, 'high');
      const lowGeom = getItemGeometry(kind, 'low');

      for (const [mode, geom] of [
        ['high', highGeom],
        ['low', lowGeom],
      ] as const) {
        expect(geom).toBeInstanceOf(THREE.BufferGeometry);

        const pos = geom.getAttribute('position');
        const norm = geom.getAttribute('normal');
        const col = geom.getAttribute('color');

        expect(pos, `${kind} (${mode}) missing position`).toBeDefined();
        expect(norm, `${kind} (${mode}) missing normal`).toBeDefined();
        expect(col, `${kind} (${mode}) missing color`).toBeDefined();

        expect(pos.itemSize).toBe(3);
        expect(norm.itemSize).toBe(3);
        expect(col.itemSize).toBe(3);
        expect(pos.count).toBeGreaterThan(0);
        expect(norm.count).toBe(pos.count);
        expect(col.count).toBe(pos.count);

        for (let i = 0; i < pos.array.length; i++) {
          expect(Number.isFinite(pos.array[i]), `${kind} (${mode}) position NaN at ${i}`).toBe(
            true,
          );
          expect(Number.isFinite(norm.array[i]), `${kind} (${mode}) normal NaN at ${i}`).toBe(true);
          expect(Number.isFinite(col.array[i]), `${kind} (${mode}) color NaN at ${i}`).toBe(true);
        }

        const tris = getGeometryTriangleCount(geom);
        expect(tris).toBeGreaterThan(0);
        expect(tris).toBeLessThanOrEqual(ITEM_HIGH_DETAIL_TRIANGLE_BUDGET);

        // Kiểm tra căn giữa theo X và Z quanh (0, 0) với đáy đặt trên y = 0
        geom.computeBoundingBox();
        const bbox = geom.boundingBox!;
        expect(bbox).not.toBeNull();
        const centerX = (bbox.min.x + bbox.max.x) * 0.5;
        const centerZ = (bbox.min.z + bbox.max.z) * 0.5;
        expect(Math.abs(centerX)).toBeLessThan(1e-3);
        expect(Math.abs(centerZ)).toBeLessThan(1e-3);
        expect(Math.abs(bbox.min.y)).toBeLessThan(1e-3);

        const [targetW, targetH, targetD] = DEFAULT_ITEM_DIMENSIONS[kind];
        expect(bbox.max.x - bbox.min.x).toBeCloseTo(targetW, 2);
        expect(bbox.max.y - bbox.min.y).toBeCloseTo(targetH, 2);
        expect(bbox.max.z - bbox.min.z).toBeCloseTo(targetD, 2);
      }

      // Mô hình đơn giản hóa mức chi tiết thấp phải dùng số tam giác ít hơn hoặc bằng mức chi tiết cao
      expect(getGeometryTriangleCount(lowGeom)).toBeLessThanOrEqual(
        getGeometryTriangleCount(highGeom),
      );
    },
  );

  it('caches and returns the exact same BufferGeometry reference on repeated calls', () => {
    warmAllItemGeometries();
    for (const kind of ALL_ITEM_KINDS) {
      const firstHigh = getItemGeometry(kind, 'high');
      const secondHigh = getItemGeometry(kind, 'high');
      expect(secondHigh).toBe(firstHigh);

      const firstLow = getItemGeometry(kind, 'low');
      const secondLow = getItemGeometry(kind, 'low');
      expect(secondLow).toBe(firstLow);
      expect(firstLow).not.toBe(firstHigh);
    }
  });

  it('groups all SOL_CENTER_SCENE items into <= 36 instanced batches and resolves status colors & matrices', () => {
    const groups = groupItemsByKind(SOL_CENTER_SCENE);
    expect(groups.size).toBe(36);

    let totalItems = 0;
    for (const entries of groups.values()) {
      totalItems += entries.length;
    }
    expect(totalItems).toBe(56);

    // Kiểm tra tô màu sắc thái theo trạng thái
    expect(resolveItemInstanceColor('active', false, false)).toBe(ITEM_STATUS_COLORS.default);
    expect(resolveItemInstanceColor('maintenance', false, false)).toBe(
      ITEM_STATUS_COLORS.maintenance,
    );
    expect(resolveItemInstanceColor('broken', false, false)).toBe(ITEM_STATUS_COLORS.broken);
    expect(resolveItemInstanceColor('retired', false, false)).toBe(ITEM_STATUS_COLORS.retired);
    expect(resolveItemInstanceColor('maintenance', true, false)).toBe(
      ITEM_STATUS_COLORS.highlight,
    );
    expect(resolveItemInstanceColor('active', false, true)).toBe(ITEM_STATUS_COLORS.highlight);

    // Kiểm tra hiển thị ở chế độ solo và ma trận tỉ lệ 0 khi bị ẩn
    const treadmillEntries = groups.get('treadmill')!;
    expect(treadmillEntries.length).toBeGreaterThan(0);
    const sample = treadmillEntries[0]; // Máy chạy bộ tầng L1

    expect(isItemInstanceVisible(sample, 'stacked', 'ALL', undefined)).toBe(true);
    expect(isItemInstanceVisible(sample, 'solo', 'L1', undefined)).toBe(true);
    expect(isItemInstanceVisible(sample, 'solo', 'B1', undefined)).toBe(false);
    expect(
      isItemInstanceVisible(sample, 'stacked', 'ALL', { visible: false, status: 'active' }),
    ).toBe(false);

    const hiddenMatrix = computeItemInstanceMatrix(sample, 'stacked', false);
    expect(hiddenMatrix.elements[0]).toBe(0);
    expect(hiddenMatrix.elements[5]).toBe(0);
    expect(hiddenMatrix.elements[10]).toBe(0);
    expect(hiddenMatrix.determinant()).toBe(0);
  });

  it('exports ItemInstances, Courts, and Pool R3F canvas components', () => {
    expect(typeof ItemInstances).toBe('function');
    expect(typeof Courts).toBe('function');
    expect(typeof Pool).toBe('function');
  });
});

describe('Item chamfer bevel', () => {
  it('builds a 44 triangle chamfer box with outward unit normals and the requested extents', () => {
    const geom = buildChamferBoxGeometry(1, 2, 0.5, 0.05);
    expect(getGeometryTriangleCount(geom)).toBe(44);
    geom.computeBoundingBox();
    const size = new THREE.Vector3();
    geom.boundingBox!.getSize(size);
    expect(size.x).toBeCloseTo(1, 5);
    expect(size.y).toBeCloseTo(2, 5);
    expect(size.z).toBeCloseTo(0.5, 5);

    const pos = geom.getAttribute('position');
    const norm = geom.getAttribute('normal');
    for (let i = 0; i < pos.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(pos, i);
      const b = new THREE.Vector3().fromBufferAttribute(pos, i + 1);
      const c = new THREE.Vector3().fromBufferAttribute(pos, i + 2);
      const faceNormal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
      const n = new THREE.Vector3().fromBufferAttribute(norm, i);
      expect(n.length()).toBeCloseTo(1, 5);
      // Chiều quấn đỉnh phải khớp với pháp tuyến lưu trữ để các mặt không bị loại bỏ (cull).
      expect(faceNormal.dot(n)).toBeGreaterThan(0.99);
      // Pháp tuyến hướng ra ngoài tâm hình hộp.
      const centroid = a.clone().add(b).add(c).divideScalar(3);
      expect(centroid.dot(n)).toBeGreaterThan(0);
    }
  });

  it('keeps every high detail item within the triangle budget', () => {
    for (const kind of ALL_ITEM_KINDS) {
      const geom = getItemGeometry(kind, 'high');
      expect(getGeometryTriangleCount(geom)).toBeLessThanOrEqual(ITEM_HIGH_DETAIL_TRIANGLE_BUDGET);
    }
  });

  it('designs stair-core without opaque glass walls, aligns top treads flush to upper slabs, and keeps RF stairs under canopy', () => {
    const highStair = getItemGeometry('stair-core', 'high');
    const col = highStair.getAttribute('color');
    const pos = highStair.getAttribute('position');
    const norm = highStair.getAttribute('normal');
    const fakeGlass = new THREE.Color('#c8d4e0');

    let fakeGlassVerts = 0;
    let highestWalkableTreadY = 0;
    for (let i = 0; i < pos.count; i++) {
      const dr = Math.abs(col.getX(i) - fakeGlass.r);
      const dg = Math.abs(col.getY(i) - fakeGlass.g);
      const db = Math.abs(col.getZ(i) - fakeGlass.b);
      if (dr < 0.01 && dg < 0.01 && db < 0.01) fakeGlassVerts++;

      // Bề mặt bậc thang/chiếu nghỉ đi lại được hướng lên trên (`ny > 0.95`, trong lối đi rộng `3,20 m`, loại trừ trụ/giá đỡ lan can ngoài `|x| >= 1.64`)
      if (norm.getY(i) > 0.95 && Math.abs(pos.getX(i)) < 1.62 && pos.getY(i) < 4.1) {
        highestWalkableTreadY = Math.max(highestWalkableTreadY, pos.getY(i));
      }
    }
    expect(fakeGlassVerts).toBe(0);

    const baseH = DEFAULT_ITEM_DIMENSIONS['stair-core'][1];
    const treadRatio = highestWalkableTreadY / baseH;

    // B1->L1 (4,5 m), L1->L2 (5,76 m), L2->RF (5,5 m): bậc chiếu nghỉ trên cùng sau khi phóng tỉ lệ phải khớp sàn tầng trên trong phạm vi 4 cm!
    const b1Stair = SOL_CENTER_SCENE.nodes['item-b1-stairs'];
    const l1Stair = SOL_CENTER_SCENE.nodes['item-l1-stairs'];
    const l2Stair = SOL_CENTER_SCENE.nodes['item-l2-stairs'];
    const rfStair = SOL_CENTER_SCENE.nodes['item-rf-stairs'];
    if (
      b1Stair?.type !== 'item' ||
      l1Stair?.type !== 'item' ||
      l2Stair?.type !== 'item' ||
      rfStair?.type !== 'item'
    ) {
      throw new Error('Missing stair items in SOL_CENTER_SCENE');
    }

    expect(Math.abs(b1Stair.dimensions[1] * treadRatio - 4.5)).toBeLessThan(0.04);
    expect(Math.abs(l1Stair.dimensions[1] * treadRatio - 5.76)).toBeLessThan(0.04);
    expect(Math.abs(l2Stair.dimensions[1] * treadRatio - 5.5)).toBeLessThan(0.04);

    // Cầu thang lên tầng mái phải nằm gọn trong giếng thang dưới mái che RF (không bao giờ nhô cao 3,8 m trên sàn RF)
    const rfTopLocalY = rfStair.position[1] + rfStair.dimensions[1];
    expect(rfTopLocalY).toBeLessThan(2.4);
    expect(Math.abs((rfStair.position[1] + rfStair.dimensions[1] * treadRatio) - 0)).toBeLessThan(0.04);
  });

  it('keeps stair-core spine beams & side stringers strictly underneath the oak treads and avoids opaque blue elevator panels', () => {
    const highStair = getItemGeometry('stair-core', 'high');
    const pos = highStair.getAttribute('position');

    // Vế thang 1 đi lên từ (z = +1.54, y = 0.23) đến (z = +0.42, y = 1.69)
    // Vế thang 2 đi lên từ (z = -0.42, y = 2.13) đến (z = -1.54, y = 3.59)
    let protrudingBeamVerts = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      // Bên trong lối đi cầu thang rộng 3,08 m (loại trừ trụ tay vịn và thanh giằng ngoài `|x| >= 1.60`)
      if (Math.abs(x) < 1.56) {
        if (z >= 0.48 && z <= 1.48) {
          const u = (1.54 - z) / (1.54 - 0.42);
          const stepSurfaceY = 0.23 + u * (1.69 - 0.23);
          if (y > stepSurfaceY + 0.19) {
            protrudingBeamVerts++;
          }
        } else if (z >= -1.48 && z <= -0.48) {
          const u = (-0.42 - z) / (-0.42 - -1.54);
          const stepSurfaceY = 2.13 + u * (3.59 - 2.13);
          if (y > stepSurfaceY + 0.19) {
            protrudingBeamVerts++;
          }
        }
      }
    }
    expect(protrudingBeamVerts).toBe(0);

    // Lõi thang máy dùng hình học đục instanced tô màu đỉnh: không được dùng các tấm kính giả màu xanh da trời rực
    const highElev = getItemGeometry('elevator-core', 'high');
    const eCol = highElev.getAttribute('color');
    const ePos = highElev.getAttribute('position');
    let brightBlueShaftVerts = 0;
    for (let i = 0; i < ePos.count; i++) {
      const r = eCol.getX(i);
      const g = eCol.getY(i);
      const b = eCol.getZ(i);
      if (ePos.getY(i) > 1.5 && b > r + 0.14 && b > g + 0.04 && b > 0.35) {
        brightBlueShaftVerts++;
      }
    }
    expect(brightBlueShaftVerts).toBe(0);
  });
});
