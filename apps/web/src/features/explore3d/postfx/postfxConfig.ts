import type { ExploreTheme } from '../renderers/materials';
import type { QualityTier } from '../state/exploreStore';

/**
 * Cinematic post-processing presets, adapted from the Saltline render study
 * (HDR buffer → half-res SSAO → dual-filter bloom → filmic grade → FXAA/sharpen/grain).
 * Pure data so it can be unit tested without WebGL.
 */
export interface PostFxConfig {
  /** MSAA samples on the HDR scene target (0/2/4). */
  msaa: number;
  /** Max internal pixels; larger drawing buffers render below native size and get upscaled. */
  pixelBudget: number;
  ao: {
    enabled: boolean;
    taps: number;
    /** World-space radius (m) near the camera and far away (overview shots). */
    radiusNear: number;
    radiusFar: number;
    intensity: number;
    /** How strongly AO darkens already-lit pixels (AO should mostly hit ambient light). */
    strength: number;
    fadeStart: number;
    fadeEnd: number;
  };
  bloom: {
    enabled: boolean;
    levels: number;
    /** Energy-conserving mix factor: col = mix(col, bloom, strength). */
    strength: number;
    upMix: number;
  };
  grade: {
    exposure: number;
    /** 0 = pure ACES, 1 = pure AgX. */
    agxMix: number;
    /** Teal shadows / warm highlights split tone, 0..1. */
    splitTone: number;
    curve: number;
    blackLift: number;
    saturation: number;
    vignette: number;
    chromaticAberration: number;
  };
  final: {
    fxaa: boolean;
    sharpen: number;
    grain: number;
  };
}

export function getPostFxConfig(tier: QualityTier, theme: ExploreTheme): PostFxConfig {
  const isDark = theme === 'dark';
  const high = tier === 'high';
  const low = tier === 'low';

  return {
    msaa: high ? 4 : tier === 'medium' ? 2 : 0,
    pixelBudget: high ? 4_200_000 : tier === 'medium' ? 2_400_000 : 1_300_000,
    ao: {
      enabled: !low,
      taps: high ? 16 : 10,
      radiusNear: 0.55,
      radiusFar: 1.7,
      intensity: isDark ? 1.5 : 1.25,
      strength: isDark ? 0.92 : 0.8,
      fadeStart: 160,
      fadeEnd: 300,
    },
    bloom: {
      enabled: !low,
      levels: 6,
      strength: isDark ? 0.075 : 0.05,
      upMix: 0.62,
    },
    grade: {
      exposure: isDark ? 1.12 : 1.04,
      agxMix: 0.25,
      splitTone: isDark ? 0.75 : 0.45,
      curve: isDark ? 0.2 : 0.14,
      blackLift: isDark ? 1 : 0.6,
      saturation: isDark ? 1.08 : 1.04,
      vignette: isDark ? 0.22 : 0.1,
      chromaticAberration: high ? 0.0011 : 0,
    },
    final: {
      fxaa: true,
      sharpen: low ? 0.18 : 0.3,
      grain: isDark ? 0.018 : 0.01,
    },
  };
}

/** Internal render scale (≤ 1) that keeps width × height inside the pixel budget. */
export function getInternalScale(width: number, height: number, budget: number): number {
  const pixels = Math.max(1, width * height);
  if (pixels <= budget) return 1;
  return Math.max(0.5, Math.sqrt(budget / pixels));
}
