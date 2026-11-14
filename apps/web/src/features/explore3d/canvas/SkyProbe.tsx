import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ExploreTheme } from '../renderers/materials';
import { getAtmosphere, getSunDirection } from './atmosphere';

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Procedural sky adapted from the Saltline sky: directional horizon, Mie
 * aureole, a domain-warped cloud deck that is self-shadowed toward the sun and
 * always leaves a ragged gap so the sun burns through.
 */
const SKY_FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uSunDir, uSunCol, uZenith, uHorizon, uHorizonAway, uMidSun, uMidAway, uGround;
uniform vec3 uCloudLight, uCloudDark;
uniform float uCloudAmount, uEnv;

float h2(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm3(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { v += a * n2(p); p = p * 2.03 + 17.1; a *= 0.5; } return v / 0.875; }
float fbm5(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n2(p); p = p * 2.03 + 17.1; a *= 0.5; } return v / 0.96875; }

void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  float mu = dot(d, uSunDir);
  float s = max(mu, 0.0);
  float ts = clamp(dot(normalize(d.xz + 1e-5), normalize(uSunDir.xz)) * 0.5 + 0.5, 0.0, 1.0);

  vec3 hc = mix(uHorizonAway, uHorizon, pow(ts, 2.2));
  vec3 midC = mix(uMidAway, uMidSun, pow(ts, 3.0));
  vec3 col = mix(hc, midC, smoothstep(0.0, 0.17, h));
  col = mix(col, uZenith, smoothstep(0.10, 0.55, h));
  col += uSunCol * vec3(1.0, 0.86, 0.68) *
    (pow(s, 8.0) * 0.14 + pow(s, 64.0) * 0.55 + pow(s, 600.0) * 2.2 + pow(s, 6000.0) * 14.0);

  // ---- cloud deck ----
  vec2 q = d.xz / (h + 0.10) * vec2(0.62, 0.95) + vec2(3.1, -1.7);
  float warp = fbm3(q * 0.45 + 7.1);
  vec2 qq = q + (warp - 0.5) * 1.3;
  float dens = fbm5(qq);
  float ridg = 1.0 - abs(2.0 * fbm3(qq * 3.1 + 5.0) - 1.0);
  dens = dens * 0.86 + (ridg - 0.6) * 0.16 * smoothstep(0.03, 0.25, h);
  float body = dens * 0.74 + n2(q * 0.19 + 3.7) * 0.36;
  float cov = smoothstep(0.50, 0.70, body) * smoothstep(0.015, 0.12, h);
  cov *= 1.0 - 0.93 * smoothstep(0.972, 0.9985, mu + (dens - 0.5) * 0.012);
  vec2 sd = normalize(uSunDir.xz);
  float densS = fbm5(qq + sd * 0.22);
  float relief = clamp((dens - densS) * 4.5 + 0.5, 0.0, 1.0);
  float thick = smoothstep(0.58, 0.86, body);
  vec3 cloud = mix(uCloudLight, uCloudDark, thick) * (0.55 + 0.9 * relief * relief);
  // warm light raking across the underside, strongest toward the sun and at thin edges
  cloud += uSunCol * vec3(1.0, 0.62, 0.38) * pow(ts, 1.6) * (0.25 + 0.75 * relief) * (1.0 - 0.6 * thick) * 0.9;
  cloud += uSunCol * cov * (1.0 - cov) * 4.0 * pow(s, 5.0) * 1.2;
  cloud = mix(cloud, hc, exp(-h * 11.0));
  col = mix(col, cloud, cov * uCloudAmount);

  // sun disc (the directional light plays the sun in the environment bake)
  col += uSunCol * 60.0 * smoothstep(0.99990, 0.99996, mu) * (1.0 - uEnv);
  col = mix(col, uGround, smoothstep(0.0, -0.10, d.y));
  if (uEnv > 0.5) col = min(col, vec3(6.0));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function useSkyMaterial(theme: ExploreTheme, env: boolean) {
  const material = useMemo(() => {
    const { sky } = getAtmosphere(theme);
    const v = (c: [number, number, number]) => ({ value: new THREE.Vector3(...c) });
    return new THREE.ShaderMaterial({
      name: env ? 'sol-sky-probe' : 'sol-sky-dome',
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: !env,
      fog: false,
      uniforms: {
        uSunDir: { value: getSunDirection(theme) },
        uSunCol: v(sky.sun),
        uZenith: v(sky.zenith),
        uHorizon: v(sky.horizon),
        uHorizonAway: v(sky.horizonAway),
        uMidSun: v(sky.midSun),
        uMidAway: v(sky.midAway),
        uGround: v(sky.ground),
        uCloudLight: v(sky.cloudLight),
        uCloudDark: v(sky.cloudDark),
        uCloudAmount: { value: sky.cloudAmount },
        uEnv: { value: env ? 1 : 0 },
      },
    });
  }, [theme, env]);
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

const SKY_GEOMETRY = new THREE.SphereGeometry(1, 48, 24);
const NOOP_RAYCAST = () => null;

/** Sky rendered only inside the environment cube-camera bake (image-based sky light). */
export function SkyProbe({ theme }: { theme: ExploreTheme }) {
  const material = useSkyMaterial(theme, true);
  return <mesh geometry={SKY_GEOMETRY} material={material} scale={80} frustumCulled={false} />;
}

/** Visible sky backdrop; follows the camera so it always sits at the far distance. */
export function SkyDome({ theme }: { theme: ExploreTheme }) {
  const material = useSkyMaterial(theme, false);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => {
    ref.current?.position.copy(camera.position);
  });
  return (
    <mesh
      ref={ref}
      name="sol-sky-dome"
      geometry={SKY_GEOMETRY}
      material={material}
      scale={1050}
      renderOrder={-1000}
      frustumCulled={false}
      raycast={NOOP_RAYCAST}
    />
  );
}

export default SkyProbe;
