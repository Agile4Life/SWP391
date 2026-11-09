import * as THREE from 'three';
import type { Vec3 } from '../../scene/schema';
import { mergeAndFit } from './itemGeometries';

/** Instanced dozens of times per kind, so keep loaded models light. */
export const GLB_ITEM_TRIANGLE_BUDGET = 8000;

export class GlbItemBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GlbItemBudgetError';
  }
}

export interface GlbItemFitOptions {
  /** Radians. Rotate the model so its front matches the procedural item (front faces +Z). */
  rotationY?: number;
  maxTriangles?: number;
  /** Recolor by material name (hex), so third-party models can match the SOL palette. */
  materialColors?: Readonly<Record<string, string>>;
}

function triangleCount(geometry: THREE.BufferGeometry): number {
  const index = geometry.getIndex();
  if (index) return Math.floor(index.count / 3);
  return Math.floor(geometry.getAttribute('position').count / 3);
}

/**
 * Flatten every mesh under `root` into a single vertex-colored geometry that fits
 * inside `dimensions` (uniform "contain" scale, base on y = 0, centered on X/Z).
 *
 * The result plugs into the shared instanced vertex-color material, so per-instance
 * status tint, picking and selection keep working. Textures are not carried over:
 * each mesh contributes its COLOR_0 attribute, or else its material base color.
 */
export function buildItemGeometryFromObject(
  root: THREE.Object3D,
  dimensions: Vec3,
  options: GlbItemFitOptions = {},
): THREE.BufferGeometry {
  const { rotationY = 0, maxTriangles = GLB_ITEM_TRIANGLE_BUDGET, materialColors } = options;

  root.updateWorldMatrix(true, true);
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const rotation = new THREE.Matrix4().makeRotationY(rotationY);
  const color = new THREE.Color();

  const parts: THREE.BufferGeometry[] = [];
  let totalTriangles = 0;

  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry || !mesh.visible) return;
    const source = mesh.geometry;
    if (!source.getAttribute('position')) return;

    const geometry = source.clone();
    const transform = new THREE.Matrix4()
      .copy(rotation)
      .multiply(rootInverse)
      .multiply(mesh.matrixWorld);
    geometry.applyMatrix4(transform);
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();

    if (!geometry.getAttribute('color')) {
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const override = material?.name ? materialColors?.[material.name] : undefined;
      if (override) {
        color.set(override);
      } else {
        const baseColor = (material as THREE.MeshStandardMaterial | undefined)?.color;
        color.copy(baseColor ?? new THREE.Color('#b8bac2'));
      }
      const count = geometry.getAttribute('position').count;
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }

    totalTriangles += triangleCount(geometry);
    parts.push(geometry);
  });

  if (parts.length === 0) {
    throw new GlbItemBudgetError('GLB contains no renderable meshes');
  }
  if (totalTriangles > maxTriangles) {
    for (const part of parts) part.dispose();
    throw new GlbItemBudgetError(
      `GLB has ${totalTriangles} triangles, over the ${maxTriangles} budget; simplify it with gltf-transform`,
    );
  }

  const bounds = new THREE.Box3();
  for (const part of parts) {
    part.computeBoundingBox();
    if (part.boundingBox) bounds.union(part.boundingBox);
  }
  const size = bounds.getSize(new THREE.Vector3());
  const scale = Math.min(
    dimensions[0] / Math.max(size.x, 1e-4),
    dimensions[1] / Math.max(size.y, 1e-4),
    dimensions[2] / Math.max(size.z, 1e-4),
  );

  return mergeAndFit(parts, [size.x * scale, size.y * scale, size.z * scale]);
}
