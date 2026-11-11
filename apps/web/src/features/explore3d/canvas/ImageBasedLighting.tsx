/* eslint-disable react-refresh/only-export-components */
import { Environment as DreiEnvironment, Lightformer } from '@react-three/drei';
import { useDocumentTheme, type ExploreTheme } from '../renderers/materials';
import { getAtmosphere } from './atmosphere';
import { SkyProbe } from './SkyProbe';
import { useExploreStore, type QualityTier } from '../state/exploreStore';

export interface ImageBasedLightingConfig {
  enabled: boolean;
  resolution: number;
  /** Scene-wide multiplier for the baked reflection probe (scene.environmentIntensity). */
  intensity: number;
  panels: {
    id: string;
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
    color: string;
    intensity: number;
    form?: 'rect' | 'circle';
  }[];
}

/**
 * Procedural studio-style reflection probe. The scene materials already declare
 * `envMapIntensity` and metalness, but without an environment map metal and
 * glossy surfaces had nothing to reflect and read as flat plastic. The probe is
 * built from a few light panels (no HDR download), baked once, and skipped on the
 * low quality tier.
 */
export function getImageBasedLightingConfig(
  theme: ExploreTheme,
  tier: QualityTier,
): ImageBasedLightingConfig {
  const isDark = theme === 'dark';
  return {
    enabled: tier !== 'low',
    resolution: tier === 'high' ? 256 : 128,
    // The sky dome (SkyProbe) now provides most of the ambient light, Saltline-style:
    // image-based sky light instead of a flat ambient term.
    intensity: getAtmosphere(theme).skyLight,
    panels: [
      {
        id: 'key-softbox',
        position: [10, 14, 8],
        rotation: [-Math.PI / 3, Math.PI / 5, 0],
        scale: [16, 10, 1],
        color: '#fff4ea',
        intensity: isDark ? 0.5 : 0.8,
      },
      {
        id: 'cool-fill',
        position: [-14, 8, -6],
        rotation: [0, Math.PI / 2.4, 0],
        scale: [12, 8, 1],
        color: '#dfe9f5',
        intensity: isDark ? 0.35 : 0.6,
      },
      {
        id: 'salmon-accent',
        position: [0, 4, -16],
        rotation: [0, 0, 0],
        scale: [22, 3, 1],
        color: '#e1aa98',
        intensity: 0.5,
      },
      {
        id: 'ceiling-strip',
        position: [0, 18, 0],
        rotation: [Math.PI / 2, 0, 0],
        scale: [26, 4, 1],
        color: '#ffffff',
        intensity: isDark ? 0.4 : 0.7,
      },
    ],
  };
}

export function ImageBasedLighting() {
  const theme = useDocumentTheme();
  const tier = useExploreStore(s => s.tier);
  const cfg = getImageBasedLightingConfig(theme, tier);

  if (!cfg.enabled) return null;

  return (
    <DreiEnvironment
      key={`${theme}-${cfg.resolution}`}
      frames={1}
      resolution={cfg.resolution}
      environmentIntensity={cfg.intensity}
    >
      <SkyProbe theme={theme} />
      {cfg.panels.map(panel => (
        <Lightformer
          key={panel.id}
          form={panel.form ?? 'rect'}
          position={panel.position}
          rotation={panel.rotation}
          scale={panel.scale}
          color={panel.color}
          intensity={panel.intensity}
        />
      ))}
    </DreiEnvironment>
  );
}

export default ImageBasedLighting;
