// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { getImageBasedLightingConfig } from '../canvas/ImageBasedLighting';

describe('Image based lighting probe', () => {
  it('is disabled on the low quality tier so weak devices skip the cubemap bake', () => {
    expect(getImageBasedLightingConfig('dark', 'low').enabled).toBe(false);
    expect(getImageBasedLightingConfig('light', 'low').enabled).toBe(false);
  });

  it('bakes a larger probe on high than on medium and stays subtle', () => {
    const high = getImageBasedLightingConfig('dark', 'high');
    const medium = getImageBasedLightingConfig('dark', 'medium');
    expect(high.enabled).toBe(true);
    expect(medium.enabled).toBe(true);
    expect(high.resolution).toBeGreaterThan(medium.resolution);
    // Existing ambient/hemisphere/key lights are already tuned; the probe only adds reflections.
    expect(high.intensity).toBeGreaterThan(0);
    expect(high.intensity).toBeLessThanOrEqual(0.7);
  });

  it('uses unique panel ids and positive intensities in both themes', () => {
    for (const theme of ['dark', 'light'] as const) {
      const { panels } = getImageBasedLightingConfig(theme, 'high');
      expect(panels.length).toBeGreaterThanOrEqual(3);
      expect(new Set(panels.map(p => p.id)).size).toBe(panels.length);
      for (const panel of panels) {
        expect(panel.intensity).toBeGreaterThan(0);
      }
    }
  });
});
