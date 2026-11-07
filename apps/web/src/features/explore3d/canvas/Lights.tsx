/* eslint-disable react-refresh/only-export-components */
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import {
  getExploreThemePalette,
  useDocumentTheme,
  type ExploreTheme,
} from '../renderers/materials';
import type { LevelCode } from '../scene/schema';
import { useExploreStore, type QualityTier } from '../state/exploreStore';

const LEVEL_ELEVATION_BY_CODE: Record<LevelCode, number> = {
  B1: -4.5,
  L1: 0.0,
  L2: 4.5,
  RF: 9.0,
  OUT: 0.0,
};

export interface LightingBudgetConfig {
  ambient: {
    color: string;
    intensity: number;
  };
  hemisphere: {
    skyColor: string;
    groundColor: string;
    intensity: number;
  };
  keyLight: {
    position: [number, number, number];
    color: string;
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
    shadowNormalBias: number;
  };
  fillLight: {
    position: [number, number, number];
    color: string;
    intensity: number;
    castShadow: false;
  };
  rimLight: {
    position: [number, number, number];
    color: string;
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
  const isDark = theme === 'dark';
  return {
    ambient: {
      color: isDark ? '#fff5ec' : '#ffffff',
      intensity: isDark ? 0.58 : 0.72,
    },
    hemisphere: {
      skyColor: palette.skyColor,
      groundColor: palette.groundColor,
      intensity: isDark ? 0.98 : 1.05,
    },
    keyLight: {
      position: [30, 44, 26],
      color: '#fff6ed',
      intensity: isDark ? 1.85 : 1.65,
      castShadow: tier !== 'low',
      shadowMapSize: [mapResolution, mapResolution],
      shadowBounds: {
        left: -44,
        right: 44,
        top: 36,
        bottom: -36,
        near: 2,
        far: 95,
      },
      shadowBias: -0.00025,
      shadowNormalBias: 0.02,
    },
    fillLight: {
      position: [-26, 26, -22],
      color: isDark ? '#e6eef8' : '#f4f7fb',
      intensity: isDark ? 0.88 : 0.75,
      castShadow: false,
    },
    rimLight: {
      position: [-18, 32, 30],
      color: '#f5cbbd',
      intensity: isDark ? 0.65 : 0.48,
      castShadow: false,
    },
  };
}

export function Lights() {
  const theme = useDocumentTheme();
  const tier = useExploreStore(s => s.tier);
  const focusLevel = useExploreStore(s => s.focusLevel);
  const walkMode = useExploreStore(s => s.walkMode);
  const invalidate = useThree(s => s.invalidate);

  const cfg = getLightingBudgetConfig(theme, tier);
  const activeLevelCode: LevelCode = focusLevel === 'ALL' ? 'L1' : focusLevel;
  const ceilingY = LEVEL_ELEVATION_BY_CODE[activeLevelCode] + 3.45;
  const interiorBoost = walkMode ? 1.35 : 1.0;

  useEffect(() => {
    invalidate();
  }, [theme, tier, focusLevel, walkMode, invalidate]);

  return (
    <group name="sol-lights">
      <ambientLight color={cfg.ambient.color} intensity={cfg.ambient.intensity} />
      <hemisphereLight
        args={[
          cfg.hemisphere.skyColor,
          cfg.hemisphere.groundColor,
          cfg.hemisphere.intensity,
        ]}
      />
      <directionalLight
        position={cfg.keyLight.position}
        color={cfg.keyLight.color}
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
        shadow-normalBias={cfg.keyLight.shadowNormalBias}
      />
      <directionalLight
        position={cfg.fillLight.position}
        color={cfg.fillLight.color}
        intensity={cfg.fillLight.intensity}
        castShadow={false}
      />
      <directionalLight
        position={cfg.rimLight.position}
        color={cfg.rimLight.color}
        intensity={cfg.rimLight.intensity}
        castShadow={false}
      />
      {/* Warm architectural interior ceiling lights on the active floor */}
      <pointLight
        position={[-9, ceilingY, -2]}
        color="#ffe4d0"
        intensity={1.55 * interiorBoost}
        distance={30}
        decay={1.25}
        castShadow={false}
      />
      <pointLight
        position={[2, ceilingY, 4]}
        color="#fff0e4"
        intensity={1.4 * interiorBoost}
        distance={28}
        decay={1.25}
        castShadow={false}
      />
      <pointLight
        position={[13, ceilingY, -1]}
        color="#ffe4d0"
        intensity={1.5 * interiorBoost}
        distance={30}
        decay={1.25}
        castShadow={false}
      />
    </group>
  );
}

export default Lights;
