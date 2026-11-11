import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { getInternalScale, getPostFxConfig } from '../postfx/postfxConfig';
import { SOFT_SHADOW_TAPS, patchSoftShadowChunk } from '../postfx/softShadows';
import { GRADE_FRAG, SSAO_FRAG } from '../postfx/shaders';

describe('Cinematic post-processing presets', () => {
  it('scales MSAA, AO taps and pixel budget with the quality tier', () => {
    const high = getPostFxConfig('high', 'dark');
    const medium = getPostFxConfig('medium', 'dark');
    const low = getPostFxConfig('low', 'dark');
    expect(high.msaa).toBe(4);
    expect(medium.msaa).toBe(2);
    expect(low.msaa).toBe(0);
    expect(high.ao.taps).toBeGreaterThan(medium.ao.taps);
    expect(high.pixelBudget).toBeGreaterThan(medium.pixelBudget);
    expect(medium.pixelBudget).toBeGreaterThan(low.pixelBudget);
  });

  it('skips the expensive passes (AO, bloom) on the low tier', () => {
    const low = getPostFxConfig('low', 'light');
    expect(low.ao.enabled).toBe(false);
    expect(low.bloom.enabled).toBe(false);
    expect(low.final.fxaa).toBe(true);
  });

  it('keeps the grade subtle: energy-conserving bloom and gentle vignette', () => {
    for (const theme of ['dark', 'light'] as const) {
      const cfg = getPostFxConfig('high', theme);
      expect(cfg.bloom.strength).toBeGreaterThan(0);
      expect(cfg.bloom.strength).toBeLessThanOrEqual(0.1);
      expect(cfg.grade.vignette).toBeLessThanOrEqual(0.3);
      expect(cfg.grade.saturation).toBeLessThanOrEqual(1);
      expect(cfg.grade.agxMix).toBeCloseTo(0.25, 3);
    }
  });

  it('downscales only when the drawing buffer exceeds the budget', () => {
    expect(getInternalScale(1920, 1080, 4_200_000)).toBe(1);
    const s = getInternalScale(2880, 1800, 4_200_000);
    expect(s).toBeLessThan(1);
    expect(2880 * s * 1800 * s).toBeLessThanOrEqual(4_200_000 + 1);
    expect(getInternalScale(10000, 10000, 1_000_000)).toBe(0.5);
  });

  it('ships shaders that keep the sky out of the haze and AO', () => {
    expect(GRADE_FRAG).toContain('d < 0.99999');
    expect(SSAO_FRAG).toContain('d0 >= 0.99999');
  });
});

describe('Soft shadow chunk patch', () => {
  it('replaces the 5-tap PCF block with a wider, edge-faded Vogel loop', () => {
    const chunks = { shadowmap_pars_fragment: THREE.ShaderChunk.shadowmap_pars_fragment };
    // The canvas module may already have patched the live chunk; test on a pristine-looking copy.
    if (!chunks.shadowmap_pars_fragment.includes('vogelDiskSample( 0, 5, phi )')) {
      expect(chunks.shadowmap_pars_fragment).toContain(`vogelDiskSample( i, ${SOFT_SHADOW_TAPS}, phi )`);
      return;
    }
    expect(patchSoftShadowChunk(chunks)).toBe(true);
    expect(chunks.shadowmap_pars_fragment).toContain(`vogelDiskSample( i, ${SOFT_SHADOW_TAPS}, phi )`);
    expect(chunks.shadowmap_pars_fragment).toContain('slEdge');
    expect(chunks.shadowmap_pars_fragment).not.toContain('vogelDiskSample( 0, 5, phi )');
  });

  it('returns false instead of corrupting an unknown chunk layout', () => {
    const chunks = { shadowmap_pars_fragment: 'float getShadow() { return 1.0; }' };
    expect(patchSoftShadowChunk(chunks)).toBe(false);
    expect(chunks.shadowmap_pars_fragment).toBe('float getShadow() { return 1.0; }');
  });
});
