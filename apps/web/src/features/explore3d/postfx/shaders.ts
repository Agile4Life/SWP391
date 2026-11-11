/**
 * GLSL for the Explore 3D cinematic pipeline. Techniques follow the Saltline
 * render study: IGN-rotated sampling, depth-aware blurs, bilateral upsample,
 * Karis-averaged 13-tap bloom, ACES/AgX blend, teal–orange split tone,
 * FXAA + edge-aware sharpen + luminance-weighted grain + dither.
 */

export const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const COMMON = /* glsl */ `
float slIGN(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}
float slLuma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}
float slHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`;

const LINEAR_DEPTH = /* glsl */ `
uniform float uNear;
uniform float uFar;
float slLinearDepth(float d) {
  return uNear * uFar / (uFar - d * (uFar - uNear));
}
`;

/** Half-res SSAO. Output: r = AO, g = linear depth (for depth-aware blur/upsample). */
export const SSAO_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tDepth;
uniform vec2 uDepthSize;
uniform float uTanHalf;
uniform float uAspect;
uniform float uRadiusNear;
uniform float uRadiusFar;
uniform float uIntensity;
uniform float uFadeStart;
uniform float uFadeEnd;
${COMMON}
${LINEAR_DEPTH}
#ifndef AO_TAPS
#define AO_TAPS 12
#endif

vec3 viewPos(vec2 uv, float z) {
  vec2 ndc = uv * 2.0 - 1.0;
  return vec3(ndc * vec2(uTanHalf * uAspect, uTanHalf) * z, -z);
}

float depthAt(vec2 uv) {
  return slLinearDepth(texture2D(tDepth, uv).r);
}

void main() {
  // Fetch an even texel of the full-res depth so sloped floors do not get AO stripes.
  ivec2 px = ivec2(floor(vUv * uDepthSize * 0.5)) * 2;
  float d0 = texelFetch(tDepth, px, 0).r;
  if (d0 >= 0.99999) {
    gl_FragColor = vec4(1.0, uFar, 0.0, 1.0);
    return;
  }
  vec2 uv0 = (vec2(px) + 0.5) / uDepthSize;
  float z0 = slLinearDepth(d0);
  vec3 P = viewPos(uv0, z0);

  // Normal from depth: pick the neighbour closer in depth to avoid bleeding over silhouettes.
  vec2 t = 2.0 / uDepthSize;
  float zl = depthAt(uv0 - vec2(t.x, 0.0));
  float zr = depthAt(uv0 + vec2(t.x, 0.0));
  float zd = depthAt(uv0 - vec2(0.0, t.y));
  float zu = depthAt(uv0 + vec2(0.0, t.y));
  vec3 dx = abs(zl - z0) < abs(zr - z0)
    ? P - viewPos(uv0 - vec2(t.x, 0.0), zl)
    : viewPos(uv0 + vec2(t.x, 0.0), zr) - P;
  vec3 dy = abs(zd - z0) < abs(zu - z0)
    ? P - viewPos(uv0 - vec2(0.0, t.y), zd)
    : viewPos(uv0 + vec2(0.0, t.y), zu) - P;
  vec3 n = normalize(cross(dx, dy));

  float R = mix(uRadiusNear, uRadiusFar, clamp(z0 / 60.0, 0.0, 1.0));
  float rUv = R / (2.0 * z0 * uTanHalf);
  rUv = clamp(rUv, 3.0 / uDepthSize.y, 0.12);
  float bias = 0.008 + 0.0018 * z0;

  float phi = slIGN(gl_FragCoord.xy) * 6.2831853;
  float sum = 0.0;
  float R2 = R * R;
  for (int i = 0; i < AO_TAPS; i++) {
    float f = (float(i) + 0.5) / float(AO_TAPS);
    float ang = f * 6.2831853 * 3.0 + phi;
    vec2 off = vec2(cos(ang) / uAspect, sin(ang)) * f * rUv;
    vec2 suv = uv0 + off;
    float zs = depthAt(suv);
    vec3 v = viewPos(suv, zs) - P;
    float vv = dot(v, v);
    float w = max(R2 - vv, 0.0);
    sum += w * w * w * max((dot(v, n) - bias) / (vv + 0.004), 0.0);
  }
  float R6 = R2 * R2 * R2;
  float ao = max(0.0, 1.0 - uIntensity * sum * 5.0 / (R6 * float(AO_TAPS)));
  ao = mix(ao, 1.0, smoothstep(uFadeStart, uFadeEnd, z0));
  gl_FragColor = vec4(ao, z0, 0.0, 1.0);
}
`;

/** 7-tap separable blur that never crosses depth discontinuities. */
export const DEPTH_BLUR_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tInput;
uniform vec2 uDir;
uniform float uTol;
void main() {
  vec4 c = texture2D(tInput, vUv);
  float zc = c.g;
  float acc = 0.0;
  float wsum = 0.0;
  for (int i = -3; i <= 3; i++) {
    vec4 s = texture2D(tInput, vUv + uDir * float(i));
    float w = (1.0 - 0.22 * abs(float(i))) * max(0.0, 1.0 - abs(s.g - zc) / (uTol * zc + 0.02));
    acc += s.r * w;
    wsum += w;
  }
  gl_FragColor = vec4(acc / max(wsum, 1e-4), zc, 0.0, 1.0);
}
`;

/** Applies AO (bilateral upsample) to the HDR scene. AO only occludes ambient-ish light. */
export const COMPOSITE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform sampler2D tAO;
uniform vec2 uAOSize;
uniform float uStrength;
uniform float uExposure;
${COMMON}
${LINEAR_DEPTH}
void main() {
  vec4 scene = texture2D(tScene, vUv);
  float d = texture2D(tDepth, vUv).r;
  if (d >= 0.99999) {
    gl_FragColor = scene;
    return;
  }
  float zc = slLinearDepth(d);
  vec2 base = vUv * uAOSize - 0.5;
  vec2 i0 = floor(base);
  vec2 f = base - i0;
  float acc = 0.0;
  float wsum = 0.0;
  for (int y = 0; y < 2; y++) {
    for (int x = 0; x < 2; x++) {
      vec2 o = vec2(float(x), float(y));
      ivec2 p = ivec2(clamp(i0 + o, vec2(0.0), uAOSize - 1.0));
      vec4 s = texelFetch(tAO, p, 0);
      vec2 bw = mix(1.0 - f, f, o);
      float w = bw.x * bw.y / (0.015 + abs(s.g - zc) / zc);
      acc += s.r * w;
      wsum += w;
    }
  }
  float ao = acc / max(wsum, 1e-5);
  float lit = smoothstep(0.16, 0.85, slLuma(scene.rgb) * uExposure);
  float a = mix(1.0, ao, uStrength * (1.0 - 0.8 * lit));
  // Slightly cool occlusion: shadows lean teal like the grade.
  vec3 aoTint = mix(vec3(a), vec3(1.0), vec3(0.0, 0.03, 0.07) * (1.0 - a));
  gl_FragColor = vec4(scene.rgb * aoTint, scene.a);
}
`;

/** 13-tap downsample (Jimenez 2014). First level uses partial Karis average against fireflies. */
export const BLOOM_DOWN_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tInput;
uniform vec2 uTexel;
uniform float uKaris;
${COMMON}
vec3 s(vec2 o) { return min(texture2D(tInput, vUv + o * uTexel).rgb, vec3(64.0)); }
float kw(vec3 c) { return 1.0 / (1.0 + slLuma(c)); }
void main() {
  vec3 a = s(vec2(-2.0, 2.0)), b = s(vec2(0.0, 2.0)), c = s(vec2(2.0, 2.0));
  vec3 d = s(vec2(-2.0, 0.0)), e = s(vec2(0.0, 0.0)), f = s(vec2(2.0, 0.0));
  vec3 g = s(vec2(-2.0, -2.0)), h = s(vec2(0.0, -2.0)), i = s(vec2(2.0, -2.0));
  vec3 j = s(vec2(-1.0, 1.0)), k = s(vec2(1.0, 1.0));
  vec3 l = s(vec2(-1.0, -1.0)), m = s(vec2(1.0, -1.0));
  vec3 col;
  if (uKaris > 0.5) {
    vec3 g0 = (j + k + l + m) * 0.25;
    vec3 g1 = (a + b + d + e) * 0.25;
    vec3 g2 = (b + c + e + f) * 0.25;
    vec3 g3 = (d + e + g + h) * 0.25;
    vec3 g4 = (e + f + h + i) * 0.25;
    float w0 = kw(g0) * 0.5, w1 = kw(g1) * 0.125, w2 = kw(g2) * 0.125;
    float w3 = kw(g3) * 0.125, w4 = kw(g4) * 0.125;
    col = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4);
  } else {
    col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

/** 3×3 tent upsample of the lower level, blended with the current level. */
export const BLOOM_UP_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tLow;
uniform sampler2D tCur;
uniform vec2 uTexel;
uniform float uMix;
void main() {
  vec3 t = vec3(0.0);
  t += texture2D(tLow, vUv + vec2(-1.0, 1.0) * uTexel).rgb;
  t += texture2D(tLow, vUv + vec2(0.0, 1.0) * uTexel).rgb * 2.0;
  t += texture2D(tLow, vUv + vec2(1.0, 1.0) * uTexel).rgb;
  t += texture2D(tLow, vUv + vec2(-1.0, 0.0) * uTexel).rgb * 2.0;
  t += texture2D(tLow, vUv).rgb * 4.0;
  t += texture2D(tLow, vUv + vec2(1.0, 0.0) * uTexel).rgb * 2.0;
  t += texture2D(tLow, vUv + vec2(-1.0, -1.0) * uTexel).rgb;
  t += texture2D(tLow, vUv + vec2(0.0, -1.0) * uTexel).rgb * 2.0;
  t += texture2D(tLow, vUv + vec2(1.0, -1.0) * uTexel).rgb;
  t /= 16.0;
  gl_FragColor = vec4(mix(texture2D(tCur, vUv).rgb, t, uMix), 1.0);
}
`;

/** Filmic grade → LDR (sRGB in rgb, luma in alpha for FXAA). */
export const GRADE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uExposure;
uniform float uAgxMix;
uniform float uSplit;
uniform float uCurve;
uniform float uLift;
uniform float uSat;
uniform float uVignette;
uniform float uCA;
uniform sampler2D tStreak;
uniform float uStreak;
uniform mat4 uInvViewProj;
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uFogColor;
uniform vec3 uFogSun;
uniform vec3 uFogParams; // density, height falloff, max
${COMMON}

vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 toneACES(vec3 color) {
  const mat3 ACESInputMat = mat3(
    vec3(0.59719, 0.07600, 0.02840),
    vec3(0.35458, 0.90834, 0.13383),
    vec3(0.04823, 0.01566, 0.83777));
  const mat3 ACESOutputMat = mat3(
    vec3(1.60475, -0.10208, -0.00327),
    vec3(-0.53108, 1.10813, -0.07276),
    vec3(-0.07367, -0.00605, 1.07602));
  color *= 1.0 / 0.6;
  color = ACESInputMat * color;
  color = RRTAndODTFit(color);
  color = ACESOutputMat * color;
  return clamp(color, 0.0, 1.0);
}
vec3 agxContrast(vec3 x) {
  vec3 x2 = x * x;
  vec3 x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}
vec3 toneAgX(vec3 color) {
  const mat3 SRGB_TO_2020 = mat3(
    vec3(0.6274, 0.0691, 0.0164), vec3(0.3293, 0.9195, 0.0880), vec3(0.0433, 0.0113, 0.8956));
  const mat3 R2020_TO_SRGB = mat3(
    vec3(1.6605, -0.1246, -0.0182), vec3(-0.5876, 1.1329, -0.1006), vec3(-0.0728, -0.0083, 1.1187));
  const mat3 Inset = mat3(
    vec3(0.856627153315983, 0.137318972929847, 0.11189821299995),
    vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903),
    vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
  const mat3 Outset = mat3(
    vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826),
    vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294),
    vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
  const float minEv = -12.47393;
  const float maxEv = 4.026069;
  color = Inset * (SRGB_TO_2020 * color);
  color = clamp((log2(max(color, 1e-10)) - minEv) / (maxEv - minEv), 0.0, 1.0);
  color = agxContrast(color);
  // "Punchy" look: a little more power and saturation.
  float l = slLuma(color);
  color = pow(max(color, 0.0), vec3(1.18));
  color = l + 1.22 * (color - l);
  color = Outset * color;
  color = pow(max(vec3(0.0), color), vec3(2.2));
  return clamp(R2020_TO_SRGB * color, 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec2 c = vUv - 0.5;
  float r2 = dot(c, c);
  vec3 raw = texture2D(tScene, vUv).rgb;
  float d = texture2D(tDepth, vUv).r;
  vec3 bloom = uBloom > 0.0 ? texture2D(tBloom, vUv).rgb : raw;

  vec3 col = raw;
  if (uCA > 0.0) {
    vec2 off = c * r2 * uCA * 4.0;
    col.r = texture2D(tScene, vUv + off).r;
    col.b = texture2D(tScene, vUv - off).b;
  }

  // Aerial perspective: exponential height haze, warmer when looking toward the sun.
  // The sky dome (d == 1) already carries its own horizon haze.
  if (d < 0.99999 && uFogParams.x > 0.0) {
    vec4 wp = uInvViewProj * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
    vec3 rd = wp.xyz / wp.w - uCamPos;
    float t = length(rd);
    rd /= max(t, 1e-4);
    float b = uFogParams.y;
    float ry = abs(rd.y) < 1e-3 ? 1e-3 : rd.y;
    float od = uFogParams.x * exp(-b * max(uCamPos.y, 0.0)) * (1.0 - exp(-b * ry * t)) / (b * ry);
    float fa = min(1.0 - exp(-max(od, 0.0)), uFogParams.z);
    vec3 fc = mix(uFogColor, uFogSun, pow(max(dot(rd, uSunDir), 0.0), 3.0));
    col = mix(col, fc, fa);
  }

  col = mix(col, bloom, uBloom);
  // Anamorphic streak: cool horizontal flare off the brightest sources.
  if (uStreak > 0.0) col += texture2D(tStreak, vUv).rgb * vec3(0.45, 0.62, 1.0) * uStreak;
  col *= uExposure;
  vec3 tm = mix(toneACES(col), toneAgX(col), uAgxMix);

  float l = slLuma(tm);
  float k = smoothstep(0.03, 0.55, l);
  vec3 shadowTint = mix(vec3(1.0), vec3(0.80, 1.01, 1.13), uSplit);
  vec3 highTint = mix(vec3(1.0), vec3(1.07, 1.0, 0.90), uSplit);
  tm *= mix(shadowTint, highTint, k);

  vec3 outc = toSRGB(tm);
  outc = mix(outc, outc * outc * (3.0 - 2.0 * outc), uCurve);
  outc = outc * mix(1.0, 0.988, uLift) + vec3(0.006, 0.0085, 0.011) * uLift;
  float ls = slLuma(outc);
  outc = mix(vec3(ls), outc, uSat);

  float vig = smoothstep(0.28, 0.78, length(c));
  outc *= 1.0 - uVignette * vig * vig * (3.0 - 2.0 * vig);
  outc = clamp(outc, 0.0, 1.0);
  gl_FragColor = vec4(outc, slLuma(outc));
}
`;

/** FXAA → edge-aware unsharp mask → luminance-weighted film grain → dither. Upscales to screen. */
export const FINAL_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tInput;
uniform vec2 uTexel;
uniform vec2 uScreen;
uniform float uFxaa;
uniform float uSharpen;
uniform float uGrain;
uniform float uTime;
${COMMON}
vec4 tap(vec2 o) { return texture2D(tInput, vUv + o * uTexel); }
void main() {
  vec4 m = tap(vec2(0.0));
  float lNW = tap(vec2(-1.0, 1.0)).a;
  float lNE = tap(vec2(1.0, 1.0)).a;
  float lSW = tap(vec2(-1.0, -1.0)).a;
  float lSE = tap(vec2(1.0, -1.0)).a;
  float lM = m.a;
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
  float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  float range = lMax - lMin;
  vec3 col = m.rgb;

  if (uFxaa > 0.5 && range >= max(0.0312, lMax * 0.10)) {
    vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
    float reduce = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
    float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + reduce);
    dir = clamp(dir * rcp, -8.0, 8.0) * uTexel;
    vec3 a = 0.5 * (texture2D(tInput, vUv + dir * (1.0 / 3.0 - 0.5)).rgb +
                    texture2D(tInput, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
    vec3 b = a * 0.5 + 0.25 * (texture2D(tInput, vUv - dir * 0.5).rgb +
                               texture2D(tInput, vUv + dir * 0.5).rgb);
    float lb = slLuma(b);
    col = (lb < lMin || lb > lMax) ? a : b;
  }

  if (uSharpen > 0.0) {
    vec3 blur = (tap(vec2(1.0, 0.0)).rgb + tap(vec2(-1.0, 0.0)).rgb +
                 tap(vec2(0.0, 1.0)).rgb + tap(vec2(0.0, -1.0)).rgb) * 0.25;
    float k = uSharpen * (1.0 - smoothstep(0.04, 0.22, range));
    col += (m.rgb - blur) * k;
  }

  vec2 px = vUv * uScreen;
  float l = slLuma(col);
  float t = fract(uTime * 0.6180339) * 97.0;
  float n = slHash(px + t) + slHash(px * 1.37 + t + 17.0) - 1.0;
  float gw = mix(1.0, 0.30, smoothstep(0.0, 1.0, l)) * smoothstep(0.0, 0.035, l);
  col += n * uGrain * gw;
  col += (slHash(px + 0.5) + slHash(px.yx + 3.1) - 1.0) / 255.0;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/** Horizontal 15-tap Gaussian for the anamorphic streak; the first pass thresholds. */
export const STREAK_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tInput;
uniform vec2 uStep;
uniform float uThreshold;
void main() {
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = -7; i <= 7; i++) {
    float w = exp(-float(i * i) / 18.0);
    vec3 s = texture2D(tInput, vUv + uStep * float(i)).rgb;
    if (uThreshold > 0.0) {
      float l = max(s.r, max(s.g, s.b));
      s *= max(l - uThreshold, 0.0) / max(l, 1e-4);
    }
    acc += s * w;
    wsum += w;
  }
  gl_FragColor = vec4(acc / wsum, 1.0);
}
`;
