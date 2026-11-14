/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  getExploreThemePalette,
  useDocumentTheme,
  type ExploreTheme,
} from '../renderers/materials';
import type { LevelCode } from '../scene/schema';
import { getAtmosphere } from './atmosphere';
import { useExploreStore, type QualityTier } from '../state/exploreStore';

const LEVEL_ELEVATION_BY_CODE: Record<LevelCode, number> = {
  B1: -4.5,
  L1: 0.0,
  L2: 4.5,
  RF: 9.0,
  OUT: 0.0,
};

const SUN_DISTANCE = 115;

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
  const mapResolution = tier === 'high' ? 3072 : 2048;
  const isDark = theme === 'dark';
  // Saltline lighting model: one strong HDR sun + sky image-based light, with
  // only a small flat ambient. The low tier has no sky probe, so it keeps a
  // stronger hemisphere/ambient fill instead.
  const hasSkyProbe = tier !== 'low';
  const atmosphere = getAtmosphere(theme);
  return {
    ambient: {
      color: isDark ? '#fff5ec' : '#ffffff',
      intensity: hasSkyProbe ? (isDark ? 0.06 : 0.05) : isDark ? 0.5 : 0.62,
    },
    hemisphere: {
      skyColor: hasSkyProbe ? (isDark ? '#6f8fc4' : '#bcd0e8') : palette.skyColor,
      groundColor: hasSkyProbe ? (isDark ? '#241c18' : '#6b5a4c') : palette.groundColor,
      intensity: hasSkyProbe ? (isDark ? 0.3 : 0.28) : isDark ? 0.98 : 1.05,
    },
    // Time-of-day sun (see atmosphere.ts): golden hour in the light theme, a very
    // low dusk sun in the dark theme. It rakes in from the left of the default
    // camera so long shadows fall into view. HDR intensity; the grade rolls it off.
    keyLight: {
      position: atmosphere.sunPosition,
      color: atmosphere.sunColor,
      intensity: atmosphere.sunIntensity,
      castShadow: tier !== 'low',
      shadowMapSize: [mapResolution, mapResolution],
      shadowBounds: {
        left: -58,
        right: 58,
        top: 44,
        bottom: -44,
        near: 1,
        far: 230,
      },
      shadowBias: -0.00012,
      shadowNormalBias: 0.02,
      shadowRadius: tier === 'high' ? 3.2 : 2.4,
    },
    fillLight: {
      position: [34, 18, -10],
      color: isDark ? '#7f9fd6' : '#cfe0f6',
      // Cool sky-bounce fill from the side opposite the sun (teal & orange).
      intensity: hasSkyProbe ? (isDark ? 0.3 : 0.34) : isDark ? 0.8 : 0.7,
      castShadow: false,
    },
    rimLight: {
      position: [-30, 22, -34],
      color: isDark ? '#ff9a6a' : '#f5c2ae',
      intensity: isDark ? 0.4 : 0.36,
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
  const gl = useThree(s => s.gl);

  const cfg = getLightingBudgetConfig(theme, tier);
  const activeLevelCode: LevelCode = focusLevel === 'ALL' ? 'L1' : focusLevel;
  const ceilingY = LEVEL_ELEVATION_BY_CODE[activeLevelCode] + 3.45;
  // Physically-decaying warm interior lights; at dusk they are the main light indoors.
  const interiorBoost = (walkMode ? 1.35 : 1.0) * (theme === 'dark' ? 26 : 12);

  // The shadow camera sits at the light: push it far enough out along the sun
  // direction that the whole campus is in front of it, even with a very low sun.
  const [sx, sy, sz] = cfg.keyLight.position;
  const sunScale = SUN_DISTANCE / Math.hypot(sx, sy, sz);
  const sunPosition: [number, number, number] = [sx * sunScale, sy * sunScale, sz * sunScale];

  useEffect(() => {
    invalidate();
  }, [theme, tier, focusLevel, walkMode, invalidate]);

  // The sun is fixed, so the shadow map only has to follow moving casters (people, cars):
  // refreshing it every other frame (30 Hz at 60 fps) removes about a third of the frame cost.
  const shadowFrame = useRef(0);
  useFrame(({ gl }) => {
    gl.shadowMap.autoUpdate = false;
    shadowFrame.current += 1;
    gl.shadowMap.needsUpdate = shadowFrame.current % 2 === 1;
  });
  useEffect(
    () => () => {
      gl.shadowMap.autoUpdate = true;
    },
    [gl],
  );

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
        position={sunPosition}
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
        distance={34}
        decay={2}
        castShadow={false}
      />
      <pointLight
        position={[2, ceilingY, 4]}
        color="#fff0e4"
        intensity={1.4 * interiorBoost}
        distance={32}
        decay={2}
        castShadow={false}
      />
      <pointLight
        position={[13, ceilingY, -1]}
        color="#ffe4d0"
        intensity={1.5 * interiorBoost}
        distance={34}
        decay={2}
        castShadow={false}
      />
    </group>
  );
}

export default Lights;
