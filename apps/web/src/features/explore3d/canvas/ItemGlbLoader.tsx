import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Component, Suspense, useEffect, type ReactNode } from 'react';
import {
  buildItemGeometryFromObject,
  buildTexturedItemGeometryFromObject,
} from '../renderers/items/glbItemGeometry';
import { ITEM_GLB_MANIFEST, type ItemGlbEntry } from '../renderers/items/glbManifest';
import {
  DEFAULT_ITEM_DIMENSIONS,
  registerItemGeometryOverride,
  unregisterItemGeometryOverride,
} from '../renderers/items/itemGeometries';
import type { ItemKind } from '../scene/schema';
import { useExploreStore } from '../state/exploreStore';

class GlbErrorBoundary extends Component<
  { kind: ItemKind; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn(
      `[explore3d] Could not load the GLB for "${this.props.kind}", keeping the procedural model.`,
      error,
    );
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function ItemGlbKind({ kind, entry }: { kind: ItemKind; entry: ItemGlbEntry }) {
  // Draco is off so no decoder is fetched from a CDN; optimize models with meshopt or leave them uncompressed.
  const gltf = useGLTF(entry.url, false);
  const invalidate = useThree(s => s.invalidate);

  useEffect(() => {
    let geometry;
    try {
      geometry = entry.textured
        ? buildTexturedItemGeometryFromObject(gltf.scene, DEFAULT_ITEM_DIMENSIONS[kind], {
            rotationY: entry.rotationY,
          })
        : buildItemGeometryFromObject(gltf.scene, DEFAULT_ITEM_DIMENSIONS[kind], {
            rotationY: entry.rotationY,
            materialColors: entry.materialColors,
          });
    } catch (error) {
      console.warn(`[explore3d] Skipping GLB for "${kind}".`, error);
      return;
    }
    registerItemGeometryOverride(kind, geometry);
    invalidate();
    return () => {
      const owned = geometry.userData.itemMaterials as { dispose(): void }[] | undefined;
      owned?.forEach(material => material.dispose());
      unregisterItemGeometryOverride(kind, geometry);
      invalidate();
    };
  }, [gltf, kind, entry.rotationY, entry.materialColors, entry.textured, invalidate]);

  return null;
}

export interface ItemGlbLoaderProps {
  manifest?: Partial<Record<ItemKind, ItemGlbEntry>>;
}

/** Loads the manifest models in the background; each kind swaps in when its file is ready. */
export function ItemGlbLoader({ manifest = ITEM_GLB_MANIFEST }: ItemGlbLoaderProps) {
  const tier = useExploreStore(s => s.tier);
  if (tier === 'low') return null;

  return (
    <>
      {(Object.entries(manifest) as [ItemKind, ItemGlbEntry][]).map(([kind, entry]) => (
        <GlbErrorBoundary key={kind} kind={kind}>
          <Suspense fallback={null}>
            <ItemGlbKind kind={kind} entry={entry} />
          </Suspense>
        </GlbErrorBoundary>
      ))}
    </>
  );
}

export default ItemGlbLoader;
