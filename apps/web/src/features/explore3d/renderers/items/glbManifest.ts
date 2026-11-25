import type { ItemKind } from '../../scene/schema';

/**
 * Một mô hình GLB cho đồ vật: đường dẫn, tác giả, nguồn, giấy phép, góc xoay quanh Y và bảng đổi màu theo tên
 * vật liệu.
 */
export interface ItemGlbEntry {
  /** Phục vụ từ apps/web/public, ví dụ `/models/explore3d/treadmill.glb`. */
  url: string;
  /** Tác giả và nguồn gốc mô hình, dùng cho bảng giấy phép trong docs/3D_ASSETS.md. */
  author: string;
  source: string;
  license: 'CC0' | 'CC-BY-4.0' | 'MIT' | 'project-owned';
  /** Góc xoay (rad) quanh trục Y để mô hình hướng cùng chiều với vật thể dựng thủ tục. */
  rotationY?: number;
  /** Đổi màu theo tên vật liệu (hex) để mô hình khớp bảng màu charcoal–salmon của SÖL. */
  materialColors?: Readonly<Record<string, string>>;
  /** Giữ nguyên texture PBR của mô hình (vật thể quét ảnh) thay vì màu đỉnh phẳng. */
  textured?: boolean;
}

/**
 * Các loại vật thể sử dụng mô hình .glb thay vì hình học dựng thủ tục.
 * Những loại không có ở đây, hoặc tải tệp thất bại hay vượt quá ngân sách tam giác,
 * sẽ giữ lại mô hình dựng thủ tục. Xem docs/3D_ASSETS.md.
 */
export const ITEM_GLB_MANIFEST: Partial<Record<ItemKind, ItemGlbEntry>> = {
  'lounge-sofa': {
    url: '/models/explore3d/polyhaven/sofa_03.glb',
    author: 'Poly Haven',
    source: 'https://polyhaven.com/a/sofa_03',
    license: 'CC0',
    textured: true,
  },
  'planter-tree': {
    url: '/models/explore3d/polyhaven/potted_plant_02.glb',
    author: 'Poly Haven',
    source: 'https://polyhaven.com/a/potted_plant_02',
    license: 'CC0',
    textured: true,
  },
};
