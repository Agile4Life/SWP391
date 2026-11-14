import * as THREE from 'three';
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
  /** Read per-vertex [roughness, metalness] from the `surf` attribute (instanced/merged items). */
  vertexSurface?: boolean;
  /** Break up repetitive tile repetition on large stone plazas with multi-scale stochastic modulation. */
  stochasticPlaza?: boolean;
  /** Fade out triplanar texture, noise, puddles and procedural bump beyond this distance (m) from camera. */
  maxDist?: number;
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
  tile: { albedo: 0.06, roughness: 0.1, scale: 0.5, grime: 0.2, bump: 0.12, bumpScale: 22, texture: 'floor_tiles_06', textureSize: 2.4, stochasticPlaza: true },
  plaza: { albedo: 0.07, roughness: 0.09, scale: 0.45, grime: 0.22, bump: 0.18, bumpScale: 26, wet: 0.08, texture: 'floor_tiles_06', textureSize: 3.2, textureChroma: 0.2, textureNormal: 0.72, stochasticPlaza: true },
  turf: { albedo: 0.16, roughness: 0.08, scale: 0.8, grime: 0.3, bump: 1.4, bumpScale: 90, texture: 'leafy_grass', textureSize: 3, textureChroma: 0.35 },
  wall: { ...BASE.wall, texture: 'concrete_wall_008', textureSize: 3.2 },
  plaster: { ...BASE.wall, texture: 'grey_plaster', textureSize: 3 },
  wood: { ...BASE.wood, texture: 'wood_floor_deck', textureSize: 2.2, textureChroma: 0.5 },
  parquet: { ...BASE.wood, texture: 'laminate_floor_02', textureSize: 2.6, textureChroma: 0.5 },
  walkway: { ...BASE.floor, texture: 'smooth_concrete_floor', textureSize: 3 },
  ground: { albedo: 0.16, roughness: 0.12, scale: 0.3, grime: 0.6, bump: 1.1, bumpScale: 46, wet: 1, texture: 'asphalt_02', textureSize: 4 },
  campus: { albedo: 0.08, roughness: 0.09, scale: 0.42, grime: 0.28, bump: 0.42, bumpScale: 32, wet: 0.45, wetDarkOnly: true, texture: 'asphalt_02', textureSize: 3.8, vertexSurface: true },
  cityOpaque: { albedo: 0.08, roughness: 0.09, scale: 0.36, grime: 0.28, bump: 0.38, bumpScale: 30, wet: 0.42, wetDarkOnly: true, texture: 'asphalt_02', textureSize: 4.0, vertexSurface: true, maxDist: 145 },
  terrain: { albedo: 0.26, roughness: 0.1, scale: 0.045, grime: 0.5, bump: 1.2, bumpScale: 40, wet: 0.3, texture: 'leafy_grass', textureSize: 11, textureChroma: 0.8 },
  item: { albedo: 0.05, roughness: 0.07, scale: 2.5, grime: 0.12, bump: 0.25, bumpScale: 60 },
  equipment: { albedo: 0.03, roughness: 0.06, scale: 5, grime: 0.05, bump: 0.03, bumpScale: 140, vertexSurface: true },
  vehicle: { albedo: 0.02, roughness: 0.03, scale: 3.5, grime: 0.04, bump: 0, vertexSurface: true },
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
uniform float uSlMaxDist;
float slMac = 0.5;
float slMac2 = 0.5;
float slWetK = 0.0;
float slDistK = 1.0;
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
vec2 slDxX; vec2 slDyX; vec2 slDxY; vec2 slDyY; vec2 slDxZ; vec2 slDyZ;
vec3 slArm = vec3(1.0, 1.0, 0.0);
float slTexK = 0.0;
// Skip projections whose weight is negligible: axis-aligned surfaces (almost everything here) need 1 fetch, not 3.
vec4 slTri(sampler2D t) {
  vec4 r = vec4(0.0);
  if (slTw.x > 0.012) r += textureGrad(t, slUx, slDxX, slDyX) * slTw.x;
  if (slTw.y > 0.012) r += textureGrad(t, slUy, slDxY, slDyY) * slTw.y;
  if (slTw.z > 0.012) r += textureGrad(t, slUz, slDxZ, slDyZ) * slTw.z;
  return r / max(slTw.x * step(0.012, slTw.x) + slTw.y * step(0.012, slTw.y) + slTw.z * step(0.012, slTw.z), 1e-3);
}
#endif
float slH(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
#ifdef SL_STOCHASTIC_PLAZA
float slHash2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
#endif
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
vec3 slGN = normalize(cross(dFdx(vSlPos), dFdy(vSlPos)));
slDistK = uSlMaxDist > 0.0 ? 1.0 - smoothstep(uSlMaxDist * 0.55, uSlMaxDist, length(vViewPosition)) : 1.0;
float slLumD = dot(diffuseColor.rgb, vec3(0.3333));
float slGreenRatio = (diffuseColor.g - max(diffuseColor.r, diffuseColor.b)) / max(slLumD, 0.005);
// Neutral dark ground (both Dark #161b24 and Light #384150/#434d5e asphalt) gets asphalt_02 & damp puddles; grass/foliage and stone do not.
float slDarkMask = (1.0 - smoothstep(0.085, 0.16, slLumD)) * (1.0 - smoothstep(0.05, 0.2, slGreenRatio));
#ifdef SL_TEX
{
  // Triplanar projection of the scanned PBR set: weights from the geometric normal.
  vec3 slW3 = pow(abs(slGN), vec3(6.0));
  slTw = slW3 / (slW3.x + slW3.y + slW3.z);
  vec3 slQ = vSlPos * uSlTex.x;
  slUx = slQ.zy; slUy = slQ.xz; slUz = slQ.xy;
  slDxX = dFdx(slUx); slDyX = dFdy(slUx); slDxY = dFdx(slUy); slDyY = dFdy(slUy); slDxZ = dFdx(slUz); slDyZ = dFdy(slUz);
  slTexK = uSlTexOn * slDistK;
  if (uSlMicro.w > 0.5) {
    // merged vertex-coloured campus/city: only dark flat ground (roads, parking) is asphalt
    slTexK *= smoothstep(0.92, 0.99, abs(slGN.y)) * (1.0 - smoothstep(0.05, 0.6, abs(vSlPos.y))) * slDarkMask;
  }
  if (slTexK > 0.005) {
    vec3 slDet = slTri(tSlAlbedo).rgb / max(uSlTexMean, vec3(0.02));
    slDet = mix(vec3(dot(slDet, vec3(0.3333))), slDet, uSlTex.y);
    slArm = slTri(tSlArm).rgb;
    diffuseColor.rgb *= mix(vec3(1.0), slDet * mix(1.0, slArm.r, 0.8), slTexK);
  }
}
#endif
{
  // Presets or distance-culled fragments that skip macro detail avoid evaluating 3D value noise.
  if (uSlMacro.x + uSlMacro.y + uSlMacro.w > 0.0) {
    vec3 slMp = vSlPos * uSlMacro.z;
    // Derivatives must run outside non-uniform distance checks for WebGL2 compliance.
    float slFine = clamp(1.0 - length(fwidth(slMp)) * 0.9, 0.0, 1.0);
    if (slDistK > 0.005) {
      slMac = slN3(slMp);
      slMac2 = mix(0.5, slN3(slMp * 3.7 + 11.3), slFine);
      float slM = slMac * 0.65 + slMac2 * 0.35 - 0.5;
      diffuseColor.rgb *= 1.0 + uSlMacro.x * slDistK * slM * 2.0;
      float slGr = smoothstep(0.5, 0.85, slMac * 0.6 + slMac2 * 0.4) * uSlMacro.w * slDistK;
      diffuseColor.rgb *= 1.0 - slGr * 0.35;
    }
  }

  // Standing water in the low spots of flat ground (large-scale height mask):
  // darker, more saturated albedo; the roughness/normal chunks turn it into a mirror.
  if (uSlMicro.z > 0.0) {
    float slUpF = smoothstep(0.92, 0.99, abs(slGN.y));
    float slLowF = 1.0 - smoothstep(0.05, 0.6, abs(vSlPos.y));
    float slDark = uSlMicro.w > 0.5 ? slDarkMask : 1.0;
    // Puddle noises only evaluate on nearby, low, flat, dark asphalt ground.
    if (slUpF * slLowF * slDark * slDistK > 0.005) {
      float slPud = slN3(vSlPos * 0.21 + 4.0) * 0.55 + slN3(vSlPos * 0.67 + 9.0) * 0.3 + slN3(vSlPos * 2.1 + 2.0) * 0.15;
      slWetK = smoothstep(0.58, 0.66, slPud) * slUpF * slLowF * uSlMicro.z * slDistK * slDark;
      // damp halo around each puddle
      float slDamp = smoothstep(0.46, 0.60, slPud) * slUpF * slLowF * uSlMicro.z * 0.5 * slDistK * slDark;
      float slLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
      diffuseColor.rgb = mix(vec3(slLum), diffuseColor.rgb, 1.0 + 0.3 * slDamp);
      diffuseColor.rgb *= 1.0 - 0.45 * max(slDamp, slWetK);
      slWetK = max(slWetK, slDamp * 0.35);
    }
  }

#ifdef SL_STOCHASTIC_PLAZA
  if (slDistK > 0.005) {
    vec2 pzPos = vSlPos.xz;
    vec2 pzTile = floor(pzPos / 1.6);
    float pzH = slHash2(pzTile);
    float pzH2 = slHash2(pzTile + vec2(7.3, 11.9));
    vec3 mineralShift = vec3((pzH - 0.5) * 0.08, (pzH2 - 0.5) * 0.04, -(pzH - 0.5) * 0.07);
    diffuseColor.rgb *= 1.0 + mineralShift * slDistK * 1.35;

    vec2 pzFract = abs(fract(pzPos / 1.6) - 0.5);
    float pzEdge = max(pzFract.x, pzFract.y);
    float pzGrout = smoothstep(0.46, 0.495, pzEdge) * 0.16 * slDistK;
    diffuseColor.rgb *= (1.0 - pzGrout);

    float pzMacro = slN3(vSlPos * 0.08 + 15.0) * 0.6 + slN3(vSlPos * 0.22 + 4.0) * 0.4;
    diffuseColor.rgb *= 1.0 + (pzMacro - 0.5) * 0.14 * slDistK;
  }
#endif
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
roughnessFactor += uSlMacro.y * slDistK * ((slMac2 - 0.5) * 1.4 + (slMac - 0.5) * 0.8);
#ifdef SL_STOCHASTIC_PLAZA
if (slDistK > 0.005) {
  vec2 pzTileR = floor(vSlPos.xz / 1.6);
  float pzHR = slHash2(pzTileR);
  roughnessFactor += (pzHR - 0.5) * 0.07 * slDistK;
}
#endif
roughnessFactor = mix(roughnessFactor, 0.035, smoothstep(0.3, 0.9, slWetK));
roughnessFactor = clamp(roughnessFactor, 0.03, 1.0);
`;

/** Procedural micro-relief: perturbs the shading normal from a world-space height field. */
const FRAG_NORMAL = /* glsl */ `
float slProcBump = uSlMicro.x;
#ifdef SL_TEX
if (slTexK > 0.005) {
  // Whiteout-blended triplanar normal mapping in world space.
  float slNs = uSlTex.z * slTexK * (1.0 - smoothstep(0.3, 0.9, slWetK));
  vec3 slWN = inverseTransformDirection(normal, viewMatrix);
  vec3 slNx = vec3(0.0, 0.0, 1.0);
  vec3 slNy = vec3(0.0, 0.0, 1.0);
  vec3 slNz = vec3(0.0, 0.0, 1.0);
  if (slTw.x > 0.012) slNx = textureGrad(tSlNormal, slUx, slDxX, slDyX).xyz * 2.0 - 1.0;
  if (slTw.y > 0.012) slNy = textureGrad(tSlNormal, slUy, slDxY, slDyY).xyz * 2.0 - 1.0;
  if (slTw.z > 0.012) slNz = textureGrad(tSlNormal, slUz, slDxZ, slDyZ).xyz * 2.0 - 1.0;
  slNx = vec3(slNx.xy * slNs + slWN.zy, abs(slNx.z) * slWN.x);
  slNy = vec3(slNy.xy * slNs + slWN.xz, abs(slNy.z) * slWN.y);
  slNz = vec3(slNz.xy * slNs + slWN.xy, abs(slNz.z) * slWN.z);
  vec3 slWorldN = normalize(slNx.zyx * slTw.x + slNy.xzy * slTw.y + slNz.xyz * slTw.z);
  normal = normalize((viewMatrix * vec4(slWorldN, 0.0)).xyz);
  slProcBump *= 1.0 - slTexK;
}
#endif
if (uSlMicro.x > 0.0) {
  vec3 slBp = vSlPos * uSlMicro.y;
  // Fade out before grain goes sub-pixel or past maxDist; keep derivative calls in uniform branch.
  float slBf = clamp(1.6 - length(fwidth(slBp)) * 1.3, 0.0, 1.0) * (1.0 - smoothstep(0.3, 0.9, slWetK)) * slDistK;
  float slHt = (slProcBump * slBf > 0.001)
    ? (slN3(slBp) * 0.6 + slN3(slBp * 2.7 + 3.1) * 0.4) * slProcBump * slBf * 0.012
    : 0.0;
  vec3 slSx = dFdx(-vViewPosition);
  vec3 slSy = dFdy(-vViewPosition);
  vec3 slR1 = cross(slSy, normal);
  vec3 slR2 = cross(normal, slSx);
  float slDet = dot(slSx, slR1);
  vec3 slGrad = sign(slDet) * (dFdx(slHt) * slR1 + dFdy(slHt) * slR2);
  if (slProcBump * slBf > 0.001) {
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
  const maxDist = { value: detail.maxDist ?? 0 };
  material.userData.surfaceDetail = detail;
  const set = detail.texture ? getSurfaceTextureSet(detail.texture) : null;
  if (set) {
    material.defines = { ...(material.defines ?? {}), SL_TEX: '' };
  }
  if (detail.vertexSurface) {
    material.defines = { ...(material.defines ?? {}), SL_SURF: '' };
  }
  if (detail.stochasticPlaza) {
    material.defines = { ...(material.defines ?? {}), SL_STOCHASTIC_PLAZA: '' };
  }
  const tex = {
    value: [1 / (detail.textureSize ?? 2), detail.textureChroma ?? 0.25, detail.textureNormal ?? 1, 0],
  };
  material.onBeforeCompile = shader => {
    shader.uniforms.uSlMacro = macro;
    shader.uniforms.uSlMicro = micro;
    shader.uniforms.uSlMaxDist = maxDist;
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
    `sol-surface-detail${set ? '-tex' : ''}${detail.vertexSurface ? '-surf' : ''}${detail.stochasticPlaza ? '-stoch' : ''}`;
  return material;
}

/**
 * Architectural water surface material with analytical capillary ripples in world space.
 * Zero texture fetches and no extra height derivatives — safe across WebGL2/Metal at 60 FPS.
 */
export function createWaterSurfaceMaterial(
  name: string,
  isLight: boolean,
): { material: THREE.MeshStandardMaterial; setTime: (t: number) => void } {
  const timeUniform = { value: 0 };
  const setTime = (t: number): void => {
    timeUniform.value = t;
  };
  const material = new THREE.MeshStandardMaterial({
    name,
    color: isLight ? '#1c4e63' : '#0f2836',
    roughness: 0.05,
    metalness: 0.08,
    envMapIntensity: 1.65,
    transparent: true,
    opacity: 0.86,
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.uWaterTime = timeUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWaterPos;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvWaterPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWaterPos;\nuniform float uWaterTime;')
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
{
  vec2 wp = vWaterPos.xz;
  float wFade = clamp(1.4 - length(fwidth(wp)) * 1.6, 0.0, 1.0);
  float t = uWaterTime;
  float p1 = wp.x * 2.8 + wp.y * 1.35 + t * 1.5;
  float p2 = wp.x * -1.9 + wp.y * 3.3 - t * 1.25;
  float p3 = wp.x * 5.6 - wp.y * 4.8 + t * 2.3;
  float p4 = wp.x * 12.0 + wp.y * 8.4 + t * 3.6;
  float gx = (cos(p1) * 2.8 * 0.02 + cos(p2) * -1.9 * 0.016 + cos(p3) * 5.6 * 0.0075 + cos(p4) * 12.0 * 0.0028) * wFade;
  float gz = (cos(p1) * 1.35 * 0.02 + cos(p2) * 3.3 * 0.016 + cos(p3) * -4.8 * 0.0075 + cos(p4) * 8.4 * 0.0028) * wFade;
  // Anisotropic perturbation: stretches specular highlights along view reflection column
  vec3 wWorldN = normalize(vec3(-gx, 1.0, -gz * 1.5));
  normal = normalize((viewMatrix * vec4(wWorldN, 0.0)).xyz);
}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
{
  vec2 wpR = vWaterPos.xz;
  float tR = uWaterTime;
  float p1R = wpR.x * 2.8 + wpR.y * 1.35 + tR * 1.5;
  float waveCrest = clamp(abs(cos(p1R)) * 0.032, 0.0, 0.035);
  roughnessFactor = clamp(roughnessFactor + waveCrest, 0.03, 0.12);
}`,
      );
  };
  material.customProgramCacheKey = () => 'sol-water-ripple';
  return { material, setTime };
}

/**
 * Procedural compound leaf-cluster texture generator for alpha-tested canopies.
 * Produces crisp serrated leaf silhouettes with natural green gradients and
 * a clean alpha mask suitable for alphaTest = 0.42.
 */
export function createProceduralFoliageTexture(): THREE.DataTexture {
  const size = 256;
  const data = new Uint8Array(size * size * 4);

  const leaflets: { cx: number; cy: number; rx: number; ry: number; angle: number }[] = [
    { cx: 128, cy: 226, rx: 14, ry: 26, angle: 0 },
    { cx: 104, cy: 194, rx: 13, ry: 24, angle: -0.45 },
    { cx: 152, cy: 194, rx: 13, ry: 24, angle: 0.45 },
    { cx: 88, cy: 154, rx: 15, ry: 27, angle: -0.62 },
    { cx: 168, cy: 154, rx: 15, ry: 27, angle: 0.62 },
    { cx: 78, cy: 114, rx: 16, ry: 28, angle: -0.75 },
    { cx: 178, cy: 114, rx: 16, ry: 28, angle: 0.75 },
    { cx: 74, cy: 74, rx: 15, ry: 26, angle: -0.85 },
    { cx: 182, cy: 74, rx: 15, ry: 26, angle: 0.85 },
    { cx: 84, cy: 38, rx: 13, ry: 22, angle: -0.92 },
    { cx: 172, cy: 38, rx: 13, ry: 22, angle: 0.92 },
  ];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (y * size + x) * 4;
      let alpha = 0;
      let r = 55;
      let g = 95;
      let b = 40;

      const stemDist = Math.abs(x - 128);
      if (y >= 15 && y <= 220 && stemDist <= 2.8) {
        alpha = Math.max(alpha, 255);
        r = 85;
        g = 110;
        b = 48;
      }

      for (const lf of leaflets) {
        const dx = x - lf.cx;
        const dy = y - lf.cy;
        const cosA = Math.cos(lf.angle);
        const sinA = Math.sin(lf.angle);
        const lx = (dx * cosA + dy * sinA) / lf.rx;
        const ly = (-dx * sinA + dy * cosA) / lf.ry;
        const distSq = lx * lx + ly * ly;
        if (distSq < 1.0) {
          const edgeDist = 1.0 - Math.sqrt(distSq);
          const leafAlpha = Math.min(255, Math.floor(edgeDist * 4.0 * 255));
          if (leafAlpha > alpha) {
            alpha = leafAlpha;
            const midSpine = Math.abs(lx);
            const spineK = Math.max(0, 1.0 - midSpine * 2.2);
            r = Math.floor(48 + spineK * 28 + (1.0 - edgeDist) * 12);
            g = Math.floor(92 + spineK * 45 + (1.0 - edgeDist) * 20);
            b = Math.floor(36 + spineK * 18);
          }
        }
      }

      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = alpha;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export interface FoliageMaterialBundle {
  material: THREE.MeshStandardMaterial;
  depthMaterial: THREE.MeshDepthMaterial;
  setTime: (t: number) => void;
  texture: THREE.DataTexture;
}

/**
 * High-realism foliage material bundle with wind-swaying vertex displacement,
 * subsurface translucency sheen, and an alpha-tested customDepthMaterial that
 * casts authentic dappled leaf shadows onto ground and architecture.
 */
export function createFoliageMaterialBundle(
  name: string,
  isLight: boolean,
): FoliageMaterialBundle {
  const timeUniform = { value: 0 };
  const setTime = (t: number): void => {
    timeUniform.value = t;
  };
  const texture = createProceduralFoliageTexture();
  const material = new THREE.MeshStandardMaterial({
    name,
    map: texture,
    alphaTest: 0.42,
    transparent: false,
    side: THREE.DoubleSide,
    roughness: 0.72,
    metalness: 0.0,
    vertexColors: true,
    envMapIntensity: 1.25,
  });

  const foliageVertPars = /* glsl */ `
uniform float uFoliageTime;
#ifdef USE_WIND_WEIGHT
attribute float windWeight;
#endif
`;

  const foliageVertProject = /* glsl */ `
vec4 fWPos = modelMatrix * vec4(transformed, 1.0);
float fPhase = fWPos.x * 0.42 + fWPos.z * 0.36 + uFoliageTime * 2.1;
float fGust = sin(fWPos.x * 0.11 + fWPos.z * 0.08 + uFoliageTime * 0.75) * 0.5 + 0.5;
vec3 fWindDir = normalize(vec3(1.0, 0.18, 0.55));
float fSway = (sin(fPhase) * 0.13 + sin(fPhase * 2.2) * 0.05) * (0.6 + 0.7 * fGust);
#ifdef USE_WIND_WEIGHT
float fWeight = windWeight;
#else
float fWeight = clamp((transformed.y - 0.2) * 0.5, 0.0, 1.0);
#endif
transformed += fWindDir * (fSway * fWeight);
#include <project_vertex>
`;

  material.defines = { ...(material.defines ?? {}), USE_WIND_WEIGHT: '' };
  material.onBeforeCompile = shader => {
    shader.uniforms.uFoliageTime = timeUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${foliageVertPars}`)
      .replace('#include <project_vertex>', foliageVertProject);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <lights_fragment_end>',
        /* glsl */ `#include <lights_fragment_end>
{
  vec3 fSunDirView = normalize((viewMatrix * vec4(-0.6, 0.72, 0.35, 0.0)).xyz);
  vec3 fViewDir = normalize(vViewPosition);
  float fBacklight = pow(saturate(dot(fViewDir, -fSunDirView)), 2.0) * (0.4 + 0.6 * abs(dot(normal, fSunDirView)));
  reflectedLight.directDiffuse += diffuseColor.rgb * fBacklight * ${isLight ? '0.42' : '0.12'};
}`,
      );
  };
  material.customProgramCacheKey = () => `sol-foliage-mat-${isLight ? 'light' : 'dark'}`;

  const depthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: texture,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
  });
  depthMaterial.defines = { ...(depthMaterial.defines ?? {}), USE_WIND_WEIGHT: '' };
  depthMaterial.onBeforeCompile = shader => {
    shader.uniforms.uFoliageTime = timeUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${foliageVertPars}`)
      .replace('#include <project_vertex>', foliageVertProject);
  };
  depthMaterial.customProgramCacheKey = () => 'sol-foliage-depth';

  return { material, depthMaterial, setTime, texture };
}

/**
 * GPU Single-Pass Ray-Cast Parallax Interior Mapping for city skyline glazing.
 * Simulates multi-floor illuminated office spaces with slabs, ceiling troffers,
 * back/side walls, randomized occupancy, and exterior glass Fresnel reflection.
 */
export function applyCityGlazingShader<T extends THREE.MeshStandardMaterial>(
  material: T,
  isLight: boolean,
): T {
  const isLightUniform = { value: isLight ? 1 : 0 };
  material.onBeforeCompile = shader => {
    shader.uniforms.uIsLight = isLightUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vCityWorldPos;\nvarying vec3 vCityWorldNorm;',
      )
      .replace(
        '#include <project_vertex>',
        /* glsl */ `#include <project_vertex>
vCityWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vCityWorldNorm = normalize((modelMatrix * vec4(normal, 0.0)).xyz);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
varying vec3 vCityWorldPos;
varying vec3 vCityWorldNorm;
uniform float uIsLight;
float slCityHash3(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
{
  vec3 cN = normalize(vCityWorldNorm);
  float isVertical = 1.0 - smoothstep(0.12, 0.45, abs(cN.y));
  if (isVertical > 0.02) {
    vec3 cV = normalize(vCityWorldPos - cameraPosition);
    vec3 cT = normalize(vec3(-cN.z, 0.0, cN.x));
    vec3 cB = vec3(0.0, 1.0, 0.0);
    vec3 rayIn = vec3(dot(cV, cT), dot(cV, cB), -dot(cV, cN));
    if (rayIn.z > 0.03) {
      vec3 roomDim = vec3(3.6, 3.2, 4.2);
      vec3 roomID = floor(vCityWorldPos / roomDim);
      float startX = fract(dot(vCityWorldPos, cT) / roomDim.x);
      float startY = fract(vCityWorldPos.y / roomDim.y);

      float tX = (rayIn.x > 0.0 ? (1.0 - startX) : -startX) / (rayIn.x + 1e-4);
      float tY = (rayIn.y > 0.0 ? (1.0 - startY) : -startY) / (rayIn.y + 1e-4);
      float tZ = 1.0 / rayIn.z;

      float tHit = min(tZ, min(max(0.0, tX), max(0.0, tY)));
      vec3 hitPos = vec3(startX, startY, 0.0) + rayIn * tHit;

      float rH = slCityHash3(roomID);
      float rH2 = fract(rH * 37.19);
      float rOcc = step(uIsLight > 0.5 ? 0.35 : 0.45, rH);
      vec3 warmL = vec3(1.0, 0.88, 0.72);
      vec3 coolL = vec3(0.82, 0.92, 1.0);
      vec3 lightCol = mix(warmL, coolL, rH2);

      vec3 intCol = vec3(0.06, 0.07, 0.08);
      if (tHit == tY && rayIn.y > 0.0) {
        float troffer = smoothstep(0.32, 0.36, abs(fract(hitPos.x * 2.2) - 0.5));
        intCol = mix(vec3(0.11), lightCol * (uIsLight > 0.5 ? 1.5 : 3.6), troffer * rOcc);
      } else if (tHit == tY && rayIn.y < 0.0) {
        intCol = vec3(0.12, 0.13, 0.14) * (0.8 + 0.35 * rOcc);
      } else if (tHit == tZ) {
        float art = step(0.68, fract(hitPos.x * 2.8 + rH));
        intCol = mix(vec3(0.14, 0.15, 0.17), lightCol * 0.42, art * rOcc);
      } else {
        intCol = vec3(0.13, 0.14, 0.15) * (0.75 + 0.3 * rOcc);
      }

      vec2 mullion = abs(fract(vCityWorldPos.xy / vec2(1.8, 1.6)) - 0.5);
      float isMullion = step(0.47, max(mullion.x, mullion.y));
      float fresnel = pow(1.0 - max(0.0, dot(-cV, cN)), 3.0) * 0.52 + 0.18;
      vec3 finalInt = mix(intCol, vec3(0.03, 0.03, 0.04), isMullion);
      diffuseColor.rgb = mix(finalInt, diffuseColor.rgb, fresnel);
    }
  }
}`,
      );
  };
  material.customProgramCacheKey = () => `sol-city-glaze-${isLight ? 'light' : 'dark'}`;
  return material;
}
