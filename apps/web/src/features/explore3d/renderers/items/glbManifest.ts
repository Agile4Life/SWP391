import type { ItemKind } from '../../scene/schema';

export interface ItemGlbEntry {
  /** Served from apps/web/public, for example `/models/explore3d/treadmill.glb`. */
  url: string;
  /** Who made it and where it came from, for the license table in docs/3D_ASSETS.md. */
  author: string;
  source: string;
  license: 'CC0' | 'CC-BY-4.0' | 'MIT' | 'project-owned';
  /** Radians around Y so the model faces the same way as the procedural item. */
  rotationY?: number;
  /** Recolor by material name (hex) so the model matches the SOL charcoal-salmon palette. */
  materialColors?: Readonly<Record<string, string>>;
  /** Keep the model's own PBR textures (photo-scanned props) instead of flat vertex colours. */
  textured?: boolean;
}

/**
 * Item kinds that use a .glb model instead of the procedural geometry.
 * Kinds that are missing here, or whose file fails to load or exceeds the
 * triangle budget, keep the procedural model. See docs/3D_ASSETS.md.
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
