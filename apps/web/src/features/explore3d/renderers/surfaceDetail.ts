import type * as THREE from 'three';

/**
 * World-space surface variation for flat-coloured MeshStandardMaterials,
 * ported from the Saltline material patch ("macro variation" + grime +
 * roughness breakup). Large repeated surfaces stop reading as one flat colour,
 * and specular highlights break up naturally under the low sun.
 */
export interface SurfaceDetail {
  /** Albedo variation amount (±). */
  albedo: number;
  /** Roughness variation amount (±). */
  roughness: number;
  /** Noise frequency in cycles per metre. */
  scale: number;
  /** Grime: darkens noisy patches by up to 35 %. */
  grime: number;
}

export const SURFACE_DETAIL_PRESETS = {
  floor: { albedo: 0.1, roughness: 0.1, scale: 0.55, grime: 0.35 },
  wall: { albedo: 0.08, roughness: 0.08, scale: 0.4, grime: 0.3 },
  wood: { albedo: 0.14, roughness: 0.1, scale: 0.9, grime: 0.2 },
  ground: { albedo: 0.14, roughness: 0.12, scale: 0.3, grime: 0.55 },
  item: { albedo: 0.05, roughness: 0.07, scale: 2.5, grime: 0.12 },
  metal: { albedo: 0.04, roughness: 0.08, scale: 6, grime: 0 },
} satisfies Record<string, SurfaceDetail>;

const VERT_PARS = /* glsl */ `
varying vec3 vSlPos;
`;

const VERT_MAIN = /* glsl */ `
{
  vec4 slWP = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
    slWP = batchingMatrix * slWP;
  #endif
  #ifdef USE_INSTANCING
    slWP = instanceMatrix * slWP;
  #endif
  vSlPos = (modelMatrix * slWP).xyz;
}
`;

const FRAG_PARS = /* glsl */ `
varying vec3 vSlPos;
uniform vec4 uSlMacro;
float slMac = 0.5;
float slMac2 = 0.5;
float slH(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float slN3(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(slH(i), slH(i + vec3(1.0, 0.0, 0.0)), f.x), mix(slH(i + vec3(0.0, 1.0, 0.0)), slH(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(slH(i + vec3(0.0, 0.0, 1.0)), slH(i + vec3(1.0, 0.0, 1.0)), f.x), mix(slH(i + vec3(0.0, 1.0, 1.0)), slH(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
`;

const FRAG_COLOR = /* glsl */ `
{
  vec3 slMp = vSlPos * uSlMacro.z;
  slMac = slN3(slMp);
  // Fade the finer octave when it gets sub-pixel so it never shimmers.
  float slFine = clamp(1.0 - length(fwidth(slMp)) * 0.9, 0.0, 1.0);
  slMac2 = mix(0.5, slN3(slMp * 3.7 + 11.3), slFine);
  float slM = slMac * 0.65 + slMac2 * 0.35 - 0.5;
  diffuseColor.rgb *= 1.0 + uSlMacro.x * slM * 2.0;
  float slGr = smoothstep(0.5, 0.85, slMac * 0.6 + slMac2 * 0.4) * uSlMacro.w;
  diffuseColor.rgb *= 1.0 - slGr * 0.35;
}
`;

const FRAG_ROUGH = /* glsl */ `
roughnessFactor += uSlMacro.y * ((slMac2 - 0.5) * 1.4 + (slMac - 0.5) * 0.8);
roughnessFactor = clamp(roughnessFactor, 0.045, 1.0);
`;

export function applySurfaceDetail<T extends THREE.MeshStandardMaterial>(
  material: T,
  detail: SurfaceDetail,
): T {
  const macro = { value: [detail.albedo, detail.roughness, detail.scale, detail.grime] };
  material.userData.surfaceDetail = detail;
  material.onBeforeCompile = shader => {
    shader.uniforms.uSlMacro = macro;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERT_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAG_COLOR}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${FRAG_ROUGH}`);
  };
  material.customProgramCacheKey = () => 'sol-surface-detail';
  return material;
}
