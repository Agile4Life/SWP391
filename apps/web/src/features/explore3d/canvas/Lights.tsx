/* eslint-disable react-refresh/only-export-components */
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import {
  getExploreThemePalette,
  useDocumentTheme,
  type ExploreTheme,
} from '../renderers/materials';
import { useExploreStore, type QualityTier } from '../state/exploreStore';

export interface LightingBudgetConfig {
  hemisphere: {
    skyColor: string;
    groundColor: string;
    intensity: number;
  };
  keyLight: {
    position: [number, number, number];
    intensity: number;
    castShadow: boolean;
    shadowMapSize: [number, number];
    shadowBounds: {
      left: number;
      right: number;
      top: number;
      bottom: number;
      near: number;
      far: number;
    };
    shadowBias: number;
  };
  fillLight: {
    position: [number, number, number];
    intensity: number;
    castShadow: false;
  };
}

export function getLightingBudgetConfig(
  theme: ExploreTheme,
  tier: QualityTier,
): LightingBudgetConfig {
  const palette = getExploreThemePalette(theme);
  const mapResolution = tier === 'high' ? 2048 : 1024;
  return {
    hemisphere: {
      skyColor: palette.skyColor,
      groundColor: palette.groundColor,
      intensity: 0.65,
    },
    keyLight: {
      position: [28, 42, 24],
      intensity: 1.35,
      castShadow: tier !== 'low',
      shadowMapSize: [mapResolution, mapResolution],
      shadowBounds: {
        left: -35,
        right: 48,
        top: 35,
        bottom: -35,
        near: 1,
        far: 120,
      },
      shadowBias: -0.0004,
    },
    fillLight: {
      position: [-24, 18, -20],
      intensity: 0.45,
      castShadow: false,
    },
  };
}

export function Lights() {
  const theme = useDocumentTheme();
  const tier = useExploreStore(s => s.tier);
  const invalidate = useThree(s => s.invalidate);

  const cfg = getLightingBudgetConfig(theme, tier);

  useEffect(() => {
    invalidate();
  }, [theme, tier, invalidate]);

  return (
    <group name="sol-lights">
      <hemisphereLight
        args={[
          cfg.hemisphere.skyColor,
          cfg.hemisphere.groundColor,
          cfg.hemisphere.intensity,
        ]}
      />
      <directionalLight
        position={cfg.keyLight.position}
        intensity={cfg.keyLight.intensity}
        castShadow={cfg.keyLight.castShadow}
        shadow-mapSize={cfg.keyLight.shadowMapSize}
        shadow-camera-left={cfg.keyLight.shadowBounds.left}
        shadow-camera-right={cfg.keyLight.shadowBounds.right}
        shadow-camera-top={cfg.keyLight.shadowBounds.top}
        shadow-camera-bottom={cfg.keyLight.shadowBounds.bottom}
        shadow-camera-near={cfg.keyLight.shadowBounds.near}
        shadow-camera-far={cfg.keyLight.shadowBounds.far}
        shadow-bias={cfg.keyLight.shadowBias}
      />
      <directionalLight
        position={cfg.fillLight.position}
        intensity={cfg.fillLight.intensity}
        castShadow={false}
      />
    </group>
  );
}

export default Lights;
