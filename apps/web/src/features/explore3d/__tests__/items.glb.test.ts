import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  buildItemGeometryFromObject,
  GlbItemBudgetError,
} from '../renderers/items/glbItemGeometry';
import {
  clearItemGeometryCache,
  getItemGeometry,
  getItemGeometryRevision,
  hasItemGeometryOverride,
  registerItemGeometryOverride,
  subscribeItemGeometries,
  unregisterItemGeometryOverride,
} from '../renderers/items/itemGeometries';

function makeModel(): THREE.Group {
  const root = new THREE.Group();
  const red = new THREE.Mesh(
    new THREE.BoxGeometry(2, 1, 1),
    new THREE.MeshStandardMaterial({ color: '#ff0000' }),
  );
  red.position.set(5, 3, -2);
  const blue = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 6),
    new THREE.MeshStandardMaterial({ color: '#0000ff' }),
  );
  blue.position.set(5, 4, -2);
  root.add(red, blue);
  root.position.set(10, 0, 10);
  return root;
}

function bounds(geometry: THREE.BufferGeometry): THREE.Box3 {
  geometry.computeBoundingBox();
  return geometry.boundingBox!.clone();
}

afterEach(() => {
  clearItemGeometryCache();
});

describe('buildItemGeometryFromObject', () => {
  it('fits inside the target box without distortion, base on y=0 and centered on X/Z', () => {
    const geometry = buildItemGeometryFromObject(makeModel(), [1, 1, 1]);
    const box = bounds(geometry);
    const size = box.getSize(new THREE.Vector3());

    expect(box.min.y).toBeCloseTo(0, 5);
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 5);
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(0, 5);
    expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(1, 4);
    // Source model is 2 : 2 : 1 (red box on its side plus the sphere on top); proportions are kept.
    expect(size.x / size.z).toBeCloseTo(2, 1);
  });

  it('bakes material base colors into the vertex color attribute', () => {
    const geometry = buildItemGeometryFromObject(makeModel(), [2, 2, 2]);
    const colors = geometry.getAttribute('color');
    const seen = new Set<string>();
    for (let i = 0; i < colors.count; i++) {
      seen.add(`${colors.getX(i).toFixed(2)},${colors.getY(i).toFixed(2)},${colors.getZ(i).toFixed(2)}`);
    }
    expect(seen).toContain('1.00,0.00,0.00');
    expect(seen).toContain('0.00,0.00,1.00');
    expect(geometry.getAttribute('normal').count).toBe(geometry.getAttribute('position').count);
  });

  it('rotates around Y before fitting', () => {
    const plain = bounds(buildItemGeometryFromObject(makeModel(), [4, 4, 4]));
    const turned = bounds(
      buildItemGeometryFromObject(makeModel(), [4, 4, 4], { rotationY: Math.PI / 2 }),
    );
    const plainSize = plain.getSize(new THREE.Vector3());
    const turnedSize = turned.getSize(new THREE.Vector3());
    expect(turnedSize.x).toBeCloseTo(plainSize.z, 3);
    expect(turnedSize.z).toBeCloseTo(plainSize.x, 3);
  });

  it('rejects empty models and models over the triangle budget', () => {
    expect(() => buildItemGeometryFromObject(new THREE.Group(), [1, 1, 1])).toThrow(
      GlbItemBudgetError,
    );
    expect(() =>
      buildItemGeometryFromObject(makeModel(), [1, 1, 1], { maxTriangles: 10 }),
    ).toThrow(/budget/);
  });
});

describe('item geometry overrides', () => {
  it('serves the override for high detail only and restores the procedural model on unregister', () => {
    const procedural = getItemGeometry('treadmill', 'high');
    const override = buildItemGeometryFromObject(makeModel(), [1, 1, 1]);

    const listener = vi.fn();
    const unsubscribe = subscribeItemGeometries(listener);
    const revisionBefore = getItemGeometryRevision();

    registerItemGeometryOverride('treadmill', override);
    expect(hasItemGeometryOverride('treadmill')).toBe(true);
    expect(getItemGeometry('treadmill', 'high')).toBe(override);
    expect(getItemGeometry('treadmill', 'low')).not.toBe(override);
    expect(getItemGeometryRevision()).toBeGreaterThan(revisionBefore);
    expect(listener).toHaveBeenCalledTimes(1);

    unregisterItemGeometryOverride('treadmill', override);
    expect(hasItemGeometryOverride('treadmill')).toBe(false);
    expect(getItemGeometry('treadmill', 'high')).toBe(procedural);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('ignores an unregister for a geometry that is no longer the active override', () => {
    const first = buildItemGeometryFromObject(makeModel(), [1, 1, 1]);
    const second = buildItemGeometryFromObject(makeModel(), [1, 1, 1]);
    registerItemGeometryOverride('squat-rack', first);
    registerItemGeometryOverride('squat-rack', second);

    unregisterItemGeometryOverride('squat-rack', first);
    expect(getItemGeometry('squat-rack', 'high')).toBe(second);
  });
});
