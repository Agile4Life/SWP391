import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useComponentReveal } from './useComponentReveal';

let host: HTMLDivElement;
let root: Root;
let frames: FrameRequestCallback[];
beforeEach(() => {
  frames = [];
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', vi.fn(callback => { frames.push(callback); return frames.length; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('scrollY', 0);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
function Landing() {
  const ref = useRef<HTMLDivElement>(null);
  useComponentReveal(ref, '/');
  return <div ref={ref}><div className="fit-scroll-progress" /><header className="fit-header" /></div>;
}

it('coalesces fast scrolling into one frame and keeps progress styles out of the page root', async () => {
  await act(async () => root.render(<Landing />));
  frames.length = 0;
  vi.stubGlobal('scrollY', 500);
  await act(async () => {
    for (let i = 0; i < 20; i++) window.dispatchEvent(new Event('scroll'));
  });
  expect(frames).toHaveLength(1);
  await act(async () => frames[0](0));
  const page = host.firstElementChild as HTMLElement;
  expect(page.style.getPropertyValue('--fit-scroll-progress')).toBe('');
  expect(page.querySelector<HTMLElement>('.fit-scroll-progress')!.style.transform).toBe('scaleX(1.0000)');
  expect(page.querySelector('.fit-header')!.classList.contains('is-scrolled')).toBe(true);
});
