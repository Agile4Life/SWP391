import { describe, expect, it, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ALL_ITEM_KINDS } from '../scene/schema';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import {
  clearItemGeometryCache,
  computeItemInstanceMatrix,
  DEFAULT_ITEM_DIMENSIONS,
  getGeometryTriangleCount,
  getItemGeometry,
  groupItemsByKind,
  isItemInstanceVisible,
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
        expect(tris).toBeLessThanOrEqual(1500);
        expect(tris).toBeLessThanOrEqual(900);

        // Verify centered on X and Z around (0, 0) with base resting at y = 0
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

      // Low detail proxy should use fewer or equal triangles than high detail
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
    expect(totalItems).toBeGreaterThanOrEqual(90);

    // Verify status color tinting
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

    // Verify solo mode visibility and 0-scale matrix when hidden
    const treadmillEntries = groups.get('treadmill')!;
    expect(treadmillEntries.length).toBeGreaterThan(0);
    const sample = treadmillEntries[0]; // L1 treadmill

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
