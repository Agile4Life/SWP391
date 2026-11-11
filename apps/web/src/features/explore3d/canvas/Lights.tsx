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
    /** Vogel-disk filter radius in shadow texels (penumbra width). */
    shadowRadius: number;
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
  // Saltline-style: 4096 map on high, 2048 on medium.
  const mapResolution = tier === 'high' ? 4096 : 2048;
  const isDark = theme === 'dark';
  // Saltline lighting model: one strong HDR sun + sky image-based light, with
  // only a small flat ambient. The low tier has no sky probe, so it keeps a
  // stronger hemisphere/ambient fill instead.
  const hasSkyProbe = tier !== 'low';
  return {
    ambient: {
      color: isDark ? '#fff5ec' : '#ffffff',
      intensity: hasSkyProbe ? (isDark ? 0.14 : 0.2) : isDark ? 0.5 : 0.62,
    },
    hemisphere: {
      skyColor: hasSkyProbe ? '#bcd0e8' : palette.skyColor,
      groundColor: palette.groundColor,
      intensity: hasSkyProbe ? (isDark ? 0.42 : 0.5) : isDark ? 0.98 : 1.05,
    },
    // Low warm sun (~32° elevation) raking in from the left of the default camera
    // (camera sits at +X/+Z): long shadows fall into view and every volume gets a
    // lit side and a shade side. Warm key vs cool fill = "teal & orange".
    keyLight: {
      position: [-26, 30, 40],
      color: '#ffd9b3',
      // HDR sun: the grade's filmic curve rolls highlights off, so it can be bright.
      intensity: isDark ? 3.6 : 3.2,
      castShadow: tier !== 'low',
      shadowMapSize: [mapResolution, mapResolution],
      shadowBounds: {
        left: -58,
        right: 58,
        top: 44,
        bottom: -44,
        near: 1,
        far: 140,
      },
      shadowBias: -0.00012,
      shadowNormalBias: 0.02,
      shadowRadius: tier === 'high' ? 3.2 : 2.4,
    },
    fillLight: {
      position: [34, 18, -10],
      color: isDark ? '#c9dcf2' : '#dde8f6',
      // Cool sky-bounce fill from the side opposite the sun (teal & orange).
      intensity: hasSkyProbe ? (isDark ? 0.42 : 0.38) : isDark ? 0.8 : 0.7,
      castShadow: false,
    },
    rimLight: {
      position: [-30, 22, -34],
      color: '#f5c2ae',
      intensity: isDark ? 0.55 : 0.42,
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
        shadow-radius={cfg.keyLight.shadowRadius}
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
