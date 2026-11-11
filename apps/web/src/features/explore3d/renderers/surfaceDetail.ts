import type * as THREE from 'three';
import { getSurfaceTextureSet, type SurfaceTextureName } from './surfaceTextures';

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
  /** Micro-relief strength (procedural bump; concrete grain, asphalt, fabric). */
  bump?: number;
  /** Micro-relief frequency in cycles per metre. */
  bumpScale?: number;
  /** Standing-water amount on low, up-facing surfaces (puddles that mirror the sky). */
  wet?: number;
  /** Only wet dark (asphalt-like) colours; for merged vertex-coloured geometry. */
  wetDarkOnly?: boolean;
  /** Photo-scanned PBR set, projected triplanar in world space (no UVs needed). */
  texture?: SurfaceTextureName;
  /** Metres covered by one texture tile. */
  textureSize?: number;
  /** How much of the texture's own hue to keep (0 = luminance detail only, 1 = full colour). */
  textureChroma?: number;
  /** Normal-map strength. */
  textureNormal?: number;
  /** Read per-vertex [roughness, metalness] from the `surf` attribute (instanced items). */
  vertexSurface?: boolean;
}

const BASE = {
  floor: { albedo: 0.1, roughness: 0.1, scale: 0.55, grime: 0.35, bump: 0.5, bumpScale: 38 },
  wall: { albedo: 0.09, roughness: 0.1, scale: 0.4, grime: 0.4, bump: 0.6, bumpScale: 30 },
  wood: { albedo: 0.16, roughness: 0.12, scale: 0.9, grime: 0.25, bump: 0.5, bumpScale: 26 },
} satisfies Record<string, SurfaceDetail>;

export const SURFACE_DETAIL_PRESETS = {
  floor: BASE.floor,
  rubber: { ...BASE.floor, texture: 'rubber_tiles', textureSize: 2 },
  court: { ...BASE.floor, texture: 'rubberized_track', textureSize: 2.5 },
  tatami: { ...BASE.floor, texture: 'tatami_mat', textureSize: 1.8 },
  polished: { albedo: 0.08, roughness: 0.12, scale: 0.5, grime: 0.25, bump: 0.12, bumpScale: 22, texture: 'smooth_concrete_floor', textureSize: 3.5, textureNormal: 0.6 },
  tile: { albedo: 0.06, roughness: 0.1, scale: 0.5, grime: 0.2, bump: 0.12, bumpScale: 22, texture: 'floor_tiles_06', textureSize: 2.4 },
  turf: { albedo: 0.16, roughness: 0.08, scale: 0.8, grime: 0.3, bump: 1.4, bumpScale: 90, texture: 'leafy_grass', textureSize: 3, textureChroma: 0.35 },
  wall: { ...BASE.wall, texture: 'concrete_wall_008', textureSize: 3.2 },
  plaster: { ...BASE.wall, texture: 'grey_plaster', textureSize: 3 },
  wood: { ...BASE.wood, texture: 'wood_floor_deck', textureSize: 2.2, textureChroma: 0.5 },
  parquet: { ...BASE.wood, texture: 'laminate_floor_02', textureSize: 2.6, textureChroma: 0.5 },
  walkway: { ...BASE.floor, texture: 'smooth_concrete_floor', textureSize: 3 },
  ground: { albedo: 0.16, roughness: 0.12, scale: 0.3, grime: 0.6, bump: 1.1, bumpScale: 46, wet: 1, texture: 'asphalt_02', textureSize: 4 },
  campus: { albedo: 0.09, roughness: 0.1, scale: 0.4, grime: 0.35, bump: 0.5, bumpScale: 34, wet: 0.8, wetDarkOnly: true, texture: 'asphalt_02', textureSize: 4 },
  terrain: { albedo: 0.26, roughness: 0.1, scale: 0.045, grime: 0.5, bump: 1.2, bumpScale: 40, wet: 0.3, texture: 'leafy_grass', textureSize: 11, textureChroma: 0.8 },
  item: { albedo: 0.05, roughness: 0.07, scale: 2.5, grime: 0.12, bump: 0.25, bumpScale: 60 },
  equipment: { albedo: 0.03, roughness: 0.06, scale: 5, grime: 0.05, bump: 0.03, bumpScale: 140, vertexSurface: true },
  metal: { albedo: 0.04, roughness: 0.08, scale: 6, grime: 0, bump: 0.08, bumpScale: 80 },
} satisfies Record<string, SurfaceDetail>;

const VERT_PARS = /* glsl */ `
varying vec3 vSlPos;
#ifdef SL_SURF
attribute vec2 surf;
varying vec2 vSlSurf;
#endif
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
  #ifdef SL_SURF
    vSlSurf = surf;
  #endif
}
`;

const FRAG_PARS = /* glsl */ `
varying vec3 vSlPos;
#ifdef SL_SURF
varying vec2 vSlSurf;
#endif
uniform vec4 uSlMacro;
uniform vec4 uSlMicro; // x bump strength, y bump frequency, z wetness, w wet-dark-only
float slMac = 0.5;
float slMac2 = 0.5;
float slWetK = 0.0;
#ifdef SL_TEX
uniform sampler2D tSlAlbedo;
uniform sampler2D tSlNormal;
uniform sampler2D tSlArm;
uniform vec4 uSlTex; // x tiles per metre, y chroma, z normal strength, w unused
uniform float uSlTexOn;
uniform vec3 uSlTexMean;
uniform float uSlTexRough;
vec3 slTw = vec3(0.0, 1.0, 0.0);
vec2 slUx; vec2 slUy; vec2 slUz;
vec3 slArm = vec3(1.0, 1.0, 0.0);
float slTexK = 0.0;
vec4 slTri(sampler2D t) { return texture2D(t, slUx) * slTw.x + texture2D(t, slUy) * slTw.y + texture2D(t, slUz) * slTw.z; }
#endif
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
#ifdef SL_TEX
{
  // Triplanar projection of the scanned PBR set: weights from the geometric normal.
  vec3 slGN = normalize(cross(dFdx(vSlPos), dFdy(vSlPos)));
  vec3 slW3 = pow(abs(slGN), vec3(6.0));
  slTw = slW3 / (slW3.x + slW3.y + slW3.z);
  vec3 slQ = vSlPos * uSlTex.x;
  slUx = slQ.zy; slUy = slQ.xz; slUz = slQ.xy;
  slTexK = uSlTexOn;
  if (uSlMicro.w > 0.5) {
    // merged vertex-coloured campus: only the dark, flat ground (roads, parking) is asphalt
    slTexK *= smoothstep(0.92, 0.99, abs(slGN.y)) * (1.0 - smoothstep(0.05, 0.6, abs(vSlPos.y)))
      * (1.0 - smoothstep(0.035, 0.09, dot(diffuseColor.rgb, vec3(0.3333))));
  }
  if (slTexK > 0.0) {
    vec3 slDet = slTri(tSlAlbedo).rgb / max(uSlTexMean, vec3(0.02));
    slDet = mix(vec3(dot(slDet, vec3(0.3333))), slDet, uSlTex.y);
    slArm = slTri(tSlArm).rgb;
    diffuseColor.rgb *= mix(vec3(1.0), slDet * mix(1.0, slArm.r, 0.8), slTexK);
  }
}
#endif
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

  // Standing water in the low spots of flat ground (large-scale height mask):
  // darker, more saturated albedo; the roughness/normal chunks turn it into a mirror.
  if (uSlMicro.z > 0.0) {
    float slUpF = smoothstep(0.92, 0.99, abs(normalize(cross(dFdx(vSlPos), dFdy(vSlPos))).y));
    float slLowF = 1.0 - smoothstep(0.05, 0.6, abs(vSlPos.y));
    float slPud = slN3(vSlPos * 0.21 + 4.0) * 0.55 + slN3(vSlPos * 0.67 + 9.0) * 0.3 + slN3(vSlPos * 2.1 + 2.0) * 0.15;
    slWetK = smoothstep(0.58, 0.66, slPud) * slUpF * slLowF * uSlMicro.z;
    if (uSlMicro.w > 0.5) slWetK *= 1.0 - smoothstep(0.035, 0.09, dot(diffuseColor.rgb, vec3(0.3333)));
    // damp halo around each puddle
    float slDamp = smoothstep(0.46, 0.60, slPud) * slUpF * slLowF * uSlMicro.z * 0.5;
    if (uSlMicro.w > 0.5) slDamp *= 1.0 - smoothstep(0.035, 0.09, dot(diffuseColor.rgb, vec3(0.3333)));
    float slLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    diffuseColor.rgb = mix(vec3(slLum), diffuseColor.rgb, 1.0 + 0.3 * slDamp);
    diffuseColor.rgb *= 1.0 - 0.45 * max(slDamp, slWetK);
    slWetK = max(slWetK, slDamp * 0.35);
  }
}
`;

const FRAG_METAL = /* glsl */ `
#ifdef SL_SURF
if (vSlSurf.x > 0.0) metalnessFactor = vSlSurf.y;
#endif
`;

const FRAG_ROUGH = /* glsl */ `
#ifdef SL_SURF
if (vSlSurf.x > 0.0) roughnessFactor = vSlSurf.x;
#endif
#ifdef SL_TEX
roughnessFactor *= mix(1.0, clamp(slArm.g / uSlTexRough, 0.4, 1.8), slTexK);
#endif
roughnessFactor += uSlMacro.y * ((slMac2 - 0.5) * 1.4 + (slMac - 0.5) * 0.8);
roughnessFactor = mix(roughnessFactor, 0.035, smoothstep(0.3, 0.9, slWetK));
roughnessFactor = clamp(roughnessFactor, 0.03, 1.0);
`;

/** Procedural micro-relief: perturbs the shading normal from a world-space height field. */
const FRAG_NORMAL = /* glsl */ `
float slProcBump = uSlMicro.x;
#ifdef SL_TEX
if (slTexK > 0.0) {
  // Whiteout-blended triplanar normal mapping in world space.
  float slNs = uSlTex.z * slTexK * (1.0 - smoothstep(0.3, 0.9, slWetK));
  vec3 slWN = inverseTransformDirection(normal, viewMatrix);
  vec3 slNx = texture2D(tSlNormal, slUx).xyz * 2.0 - 1.0;
  vec3 slNy = texture2D(tSlNormal, slUy).xyz * 2.0 - 1.0;
  vec3 slNz = texture2D(tSlNormal, slUz).xyz * 2.0 - 1.0;
  slNx = vec3(slNx.xy * slNs + slWN.zy, abs(slNx.z) * slWN.x);
  slNy = vec3(slNy.xy * slNs + slWN.xz, abs(slNy.z) * slWN.y);
  slNz = vec3(slNz.xy * slNs + slWN.xy, abs(slNz.z) * slWN.z);
  vec3 slWorldN = normalize(slNx.zyx * slTw.x + slNy.xzy * slTw.y + slNz.xyz * slTw.z);
  normal = normalize((viewMatrix * vec4(slWorldN, 0.0)).xyz);
  slProcBump *= 1.0 - slTexK;
}
#endif
if (slProcBump > 0.0) {
  vec3 slBp = vSlPos * uSlMicro.y;
  // Fade out before the grain goes sub-pixel so it never sparkles.
  float slBf = clamp(1.6 - length(fwidth(slBp)) * 1.3, 0.0, 1.0) * (1.0 - smoothstep(0.3, 0.9, slWetK));
  if (slBf > 0.0) {
    float slHt = (slN3(slBp) * 0.6 + slN3(slBp * 2.7 + 3.1) * 0.4) * slProcBump * slBf * 0.012;
    vec3 slSx = dFdx(-vViewPosition);
    vec3 slSy = dFdy(-vViewPosition);
    vec3 slR1 = cross(slSy, normal);
    vec3 slR2 = cross(normal, slSx);
    float slDet = dot(slSx, slR1);
    vec3 slGrad = sign(slDet) * (dFdx(slHt) * slR1 + dFdy(slHt) * slR2);
    normal = normalize(abs(slDet) * normal - slGrad);
  }
}
`;

export function applySurfaceDetail<T extends THREE.MeshStandardMaterial>(
  material: T,
  detail: SurfaceDetail,
): T {
  const macro = { value: [detail.albedo, detail.roughness, detail.scale, detail.grime] };
  const micro = {
    value: [detail.bump ?? 0, detail.bumpScale ?? 30, detail.wet ?? 0, detail.wetDarkOnly ? 1 : 0],
  };
  material.userData.surfaceDetail = detail;
  const set = detail.texture ? getSurfaceTextureSet(detail.texture) : null;
  if (set) {
    material.defines = { ...(material.defines ?? {}), SL_TEX: '' };
  }
  if (detail.vertexSurface) {
    material.defines = { ...(material.defines ?? {}), SL_SURF: '' };
  }
  const tex = {
    value: [1 / (detail.textureSize ?? 2), detail.textureChroma ?? 0.25, detail.textureNormal ?? 1, 0],
  };
  material.onBeforeCompile = shader => {
    shader.uniforms.uSlMacro = macro;
    shader.uniforms.uSlMicro = micro;
    if (set) {
      shader.uniforms.tSlAlbedo = set.albedo;
      shader.uniforms.tSlNormal = set.normal;
      shader.uniforms.tSlArm = set.arm;
      shader.uniforms.uSlTexOn = set.ready;
      shader.uniforms.uSlTexMean = set.mean;
      shader.uniforms.uSlTexRough = set.meanRoughness;
      shader.uniforms.uSlTex = tex;
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERT_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAG_COLOR}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${FRAG_ROUGH}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${FRAG_METAL}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${FRAG_NORMAL}`);
  };
  material.customProgramCacheKey = () =>
    `sol-surface-detail${set ? '-tex' : ''}${detail.vertexSurface ? '-surf' : ''}`;
  return material;
}
