import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Vec3 } from '../../scene/schema';
import { mergeAndFit } from './itemGeometries';

/** Được vẽ instancing hàng chục lần mỗi loại, nên cần giữ các mô hình nạp vào thật nhẹ. */
export const GLB_ITEM_TRIANGLE_BUDGET = 8000;

/** Lỗi khi mô hình GLB vượt ngân sách tam giác hoặc không có mesh phù hợp. */
export class GlbItemBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GlbItemBudgetError';
  }
}

/** Tùy chọn khớp mô hình GLB: góc xoay, số tam giác tối đa và bảng đổi màu theo tên vật liệu. */
export interface GlbItemFitOptions {
  /** Radian. Xoay mô hình sao cho mặt trước khớp với đồ vật dựng bằng mã (mặt trước hướng +Z). */
  rotationY?: number;
  maxTriangles?: number;
  /** Đổi màu theo tên vật liệu (mã hex) để mô hình bên thứ ba khớp với bảng màu SÖL. */
  materialColors?: Readonly<Record<string, string>>;
}

/** Đếm số tam giác của một hình học (theo chỉ mục hoặc theo số đỉnh). */
function triangleCount(geometry: THREE.BufferGeometry): number {
  const index = geometry.getIndex();
  if (index) return Math.floor(index.count / 3);
  return Math.floor(geometry.getAttribute('position').count / 3);
}

/**
 * Gộp mọi mesh dưới `root` thành một hình học tô màu theo đỉnh vừa khít trong `dimensions`
 * (tỉ lệ "contain" đồng nhất, đáy nằm ở y = 0, căn giữa theo X/Z).
 *
 * Kết quả nối thẳng vào vật liệu tô màu theo đỉnh instanced dùng chung nên phủ màu trạng thái
 * theo từng instance, picking và trạng thái chọn vẫn hoạt động bình thường. Texture không được
 * giữ lại: mỗi mesh đóng góp thuộc tính `COLOR_0` hoặc màu cơ bản của vật liệu.
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

/** Mô hình có texture mang bản đồ PBR thật nên được cấp ngân sách tam giác cao hơn loại tô màu phẳng. */
export const GLB_TEXTURED_TRIANGLE_BUDGET = 16000;

/**
 * Tương tự `buildItemGeometryFromObject`, nhưng giữ lại UV và các vật liệu PBR riêng của mô hình
 * (đạo cụ CC0 quét ảnh). Kết quả là một hình học duy nhất có một nhóm cho mỗi mesh nguồn;
 * mảng vật liệu tương ứng được lưu ở `geometry.userData.itemMaterials` và dùng cho batch instanced,
 * giúp phủ màu trạng thái theo từng instance, picking và trạng thái chọn vẫn hoạt động bình thường.
 */
export function buildTexturedItemGeometryFromObject(
  root: THREE.Object3D,
  dimensions: Vec3,
  options: Pick<GlbItemFitOptions, 'rotationY' | 'maxTriangles'> = {},
): THREE.BufferGeometry {
  const { rotationY = 0, maxTriangles = GLB_TEXTURED_TRIANGLE_BUDGET } = options;
  root.updateWorldMatrix(true, true);
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const rotation = new THREE.Matrix4().makeRotationY(rotationY);

  const parts: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  let totalTriangles = 0;

  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry || !mesh.visible) return;
    const source = mesh.geometry;
    if (!source.getAttribute('position') || !source.getAttribute('uv')) return;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', source.getAttribute('position').clone());
    geometry.setAttribute('uv', source.getAttribute('uv').clone());
    const normal = source.getAttribute('normal');
    if (normal) geometry.setAttribute('normal', normal.clone());
    const index = source.getIndex();
    if (index) geometry.setIndex(index.clone());
    geometry.applyMatrix4(
      new THREE.Matrix4().copy(rotation).multiply(rootInverse).multiply(mesh.matrixWorld),
    );
    if (!normal) geometry.computeVertexNormals();
    // Màu đỉnh trắng để màu của từng instance đóng vai trò lớp phủ trạng thái thuần túy.
    const count = geometry.getAttribute('position').count;
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3));

    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).clone();
    (material as THREE.MeshStandardMaterial).vertexColors = true;
    totalTriangles += triangleCount(geometry);
    parts.push(index ? geometry : geometry.toNonIndexed());
    materials.push(material);
  });

  // Giải phóng các phần hình học và vật liệu đã tạo khi bị loại.
  const dispose = () => {
    for (const part of parts) part.dispose();
    for (const material of materials) material.dispose();
  };
  if (parts.length === 0) {
    throw new GlbItemBudgetError('GLB contains no textured meshes');
  }
  if (totalTriangles > maxTriangles) {
    dispose();
    throw new GlbItemBudgetError(
      `GLB has ${totalTriangles} triangles, over the ${maxTriangles} budget; simplify it with gltf-transform`,
    );
  }
  const allIndexed = parts.every(part => part.getIndex());
  const merged = mergeGeometries(
    allIndexed ? parts : parts.map(part => (part.getIndex() ? part.toNonIndexed() : part)),
    true,
  );
  for (const part of parts) part.dispose();
  if (!merged) {
    for (const material of materials) material.dispose();
    throw new GlbItemBudgetError('GLB meshes could not be merged');
  }

  merged.computeBoundingBox();
  const bounds = merged.boundingBox ?? new THREE.Box3();
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = Math.min(
    dimensions[0] / Math.max(size.x, 1e-4),
    dimensions[1] / Math.max(size.y, 1e-4),
    dimensions[2] / Math.max(size.z, 1e-4),
  );
  merged.translate(-center.x, -bounds.min.y, -center.z);
  merged.scale(scale, scale, scale);
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  merged.userData.itemMaterials = materials;
  return merged;
}
