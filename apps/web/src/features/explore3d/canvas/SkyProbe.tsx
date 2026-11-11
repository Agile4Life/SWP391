/* eslint-disable react-refresh/only-export-components */
import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import type { ExploreTheme } from '../renderers/materials';

/** Direction toward the sun; matches the key light position in Lights.tsx. */
export const SUN_DIRECTION = new THREE.Vector3(-26, 30, 40).normalize();

export interface SkyPalette {
  zenith: [number, number, number];
  horizon: [number, number, number];
  horizonAway: [number, number, number];
  ground: [number, number, number];
  sun: [number, number, number];
}

/**
 * Linear HDR sky colours, adapted from the Saltline sky (low warm sun, burnt
 * horizon toward the sun, cool slate away from it). Only used to bake the
 * environment probe, so the visible backdrop keeps the portal canvas colour.
 */
export function getSkyPalette(theme: ExploreTheme): SkyPalette {
  const isDark = theme === 'dark';
  return {
    zenith: isDark ? [0.07, 0.1, 0.15] : [0.2, 0.27, 0.36],
    horizon: isDark ? [0.95, 0.6, 0.36] : [1.05, 0.78, 0.56],
    horizonAway: isDark ? [0.17, 0.22, 0.3] : [0.42, 0.48, 0.56],
    ground: isDark ? [0.06, 0.055, 0.055] : [0.2, 0.18, 0.16],
    sun: [1.0, 0.74, 0.46],
  };
}

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uHorizonAway;
uniform vec3 uGround;
void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  float mu = dot(d, uSunDir);
  float s = max(mu, 0.0);
  // How much this azimuth faces the sun (0 = away, 1 = toward).
  float ts = clamp(dot(normalize(d.xz + 1e-5), normalize(uSunDir.xz)) * 0.5 + 0.5, 0.0, 1.0);
  vec3 hc = mix(uHorizonAway, uHorizon, pow(ts, 2.2));
  vec3 midC = mix(vec3(0.15, 0.24, 0.36), vec3(0.72, 0.50, 0.34), pow(ts, 3.0));
  vec3 col = mix(hc, midC, smoothstep(0.0, 0.17, h));
  col = mix(col, uZenith, smoothstep(0.10, 0.55, h));
  // Mie aureole: wide soft glow condensing into a hot core.
  col += uSunCol * vec3(1.0, 0.86, 0.68) *
    (pow(s, 8.0) * 0.14 + pow(s, 64.0) * 0.55 + pow(s, 600.0) * 2.2 + pow(s, 6000.0) * 14.0);
  // Below the horizon: dim ground bounce.
  col = mix(col, uGround, smoothstep(0.0, -0.12, d.y));
  // Clamp so the PMREM bake gets no fireflies.
  gl_FragColor = vec4(min(col, vec3(6.0)), 1.0);
}
`;

/** Sky dome rendered only inside the environment cube-camera bake. */
export function SkyProbe({ theme }: { theme: ExploreTheme }) {
  const material = useMemo(() => {
    const p = getSkyPalette(theme);
    return new THREE.ShaderMaterial({
      name: 'sol-sky-probe',
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      uniforms: {
        uSunDir: { value: SUN_DIRECTION.clone() },
        uSunCol: { value: new THREE.Vector3(...p.sun) },
        uZenith: { value: new THREE.Vector3(...p.zenith) },
        uHorizon: { value: new THREE.Vector3(...p.horizon) },
        uHorizonAway: { value: new THREE.Vector3(...p.horizonAway) },
        uGround: { value: new THREE.Vector3(...p.ground) },
      },
    });
  }, [theme]);
  const geometry = useMemo(() => new THREE.SphereGeometry(80, 48, 24), []);

  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}

export default SkyProbe;
