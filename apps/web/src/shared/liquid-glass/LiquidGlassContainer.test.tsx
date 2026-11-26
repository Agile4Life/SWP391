import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiquidGlassContainer } from './LiquidGlassContainer';

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('LiquidGlassContainer (P2-FE-26 & P3-FE-13)', () => {
  it('wires blurRadius, tintOpacity, borderRadius, and toggles .is-active based on active prop', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);

    try {
      await act(async () => {
        root.render(
          <LiquidGlassContainer
            shape="rounded"
            borderRadius={16}
            blurRadius={8}
            tintOpacity={0.04}
            active={true}
            className="custom-glass"
          />,
        );
      });

      const el = host.querySelector<HTMLDivElement>('.glass-container')!;
      expect(el).not.toBeNull();
      expect(el.classList.contains('is-active')).toBe(true);
      expect(el.classList.contains('custom-glass')).toBe(true);
      expect(el.style.getPropertyValue('--glass-blur')).toBe('8px');
      expect(el.style.getPropertyValue('--glass-tint-opacity')).toBe('0.04');
      expect(el.style.borderRadius).toBe('16px');
      expect(el.getAttribute('aria-hidden')).toBe('true');

      await act(async () => {
        root.render(
          <LiquidGlassContainer
            shape="pill"
            blurRadius={4}
            tintOpacity={0.5}
            active={false}
          >
            <span>Content</span>
          </LiquidGlassContainer>,
        );
      });

      const el2 = host.querySelector<HTMLDivElement>('.glass-container')!;
      expect(el2.classList.contains('is-active')).toBe(false);
      expect(el2.classList.contains('glass-container-pill')).toBe(true);
      expect(el2.style.getPropertyValue('--glass-blur')).toBe('4px');
      expect(el2.style.getPropertyValue('--glass-tint-opacity')).toBe('0.5');
      expect(el2.getAttribute('aria-hidden')).toBeNull();
    } finally {
      await act(async () => root.unmount());
    }
  });
});
