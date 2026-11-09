import type { ItemKind } from '../../scene/schema';
import { ITEM_PALETTE } from './itemGeometries';

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
}

/**
 * Item kinds that use a .glb model instead of the procedural geometry.
 * Kinds that are missing here, or whose file fails to load or exceeds the
 * triangle budget, keep the procedural model. See docs/3D_ASSETS.md.
 */
export const ITEM_GLB_MANIFEST: Partial<Record<ItemKind, ItemGlbEntry>> = {
  'lounge-sofa': {
    url: '/models/explore3d/lounge-sofa.glb',
    author: 'Kenney',
    source: 'https://kenney.nl/assets/furniture-kit (loungeSofaLong)',
    license: 'CC0',
    materialColors: { carpet: ITEM_PALETTE.terracotta, wood: ITEM_PALETTE.wood },
  },
  'juice-bar': {
    url: '/models/explore3d/juice-bar.glb',
    author: 'Kenney',
    source: 'https://kenney.nl/assets/furniture-kit (kitchenBar)',
    license: 'CC0',
    materialColors: {
      wood: ITEM_PALETTE.woodLight,
      woodDark: ITEM_PALETTE.charcoalSoft,
      metal: ITEM_PALETTE.metalLight,
    },
  },
  'planter-tree': {
    url: '/models/explore3d/planter-tree.glb',
    author: 'Kenney',
    source: 'https://kenney.nl/assets/furniture-kit (pottedPlant)',
    license: 'CC0',
    materialColors: {
      plant: ITEM_PALETTE.foliageLight,
      wood: ITEM_PALETTE.terracotta,
      woodDark: ITEM_PALETTE.charcoalSoft,
    },
  },
};
