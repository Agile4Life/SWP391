import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useDocumentTheme } from '../renderers/materials';
import { useExploreStore } from '../state/exploreStore';
import { CinematicRenderer, hasHalfFloatTargets } from './cinematicRenderer';
import { getPostFxConfig } from './postfxConfig';
import { getAtmosphere, getSunDirection } from '../canvas/atmosphere';
import * as THREE from 'three';

/**
 * Takes over R3F rendering (useFrame priority 1) and runs the cinematic HDR
 * post chain. Render targets are rebuilt per quality tier; theme changes only
 * retune uniforms.
 */
export function CinematicPipeline() {
  const gl = useThree(s => s.gl);
  const invalidate = useThree(s => s.invalidate);
  const tier = useExploreStore(s => s.tier);
  const theme = useDocumentTheme();
  const rendererRef = useRef<CinematicRenderer | null>(null);

  useEffect(() => {
    // Debug escape hatch (like Saltline's ?mb=1): ?fx=0 renders the plain forward path.
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('fx') === '0') {
      return;
    }
    const hdrType = hasHalfFloatTargets(gl) ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const renderer = new CinematicRenderer(getPostFxConfig(tier, 'dark'), hdrType);
    renderer.attach(gl, invalidate);
    rendererRef.current = renderer;
    invalidate();
    return () => {
      rendererRef.current = null;
      renderer.dispose();
    };
  }, [gl, tier, invalidate]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (renderer) {
      const { haze } = getAtmosphere(theme);
      renderer.applyConfig(getPostFxConfig(tier, theme));
      renderer.setAtmosphere({
        sunDir: getSunDirection(theme),
        fogColor: haze.color,
        fogSun: haze.sunColor,
        density: haze.density,
        falloff: haze.falloff,
        max: haze.max,
      });
    }
    invalidate();
  }, [gl, tier, theme, invalidate]);

  useFrame((state, delta) => {
    const renderer = rendererRef.current;
    if (renderer) {
      renderer.render(state.gl, state.scene, state.camera, delta);
    } else {
      state.gl.render(state.scene, state.camera);
    }
  }, 1);

  return null;
}

export default CinematicPipeline;
