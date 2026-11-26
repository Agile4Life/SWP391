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
// Component phụ chỉ phục vụ kiểm thử.
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

it('reveals tall mobile containers by visible pixel height and keeps sectionObserver active under reduced motion (P2-FE-11)', async () => {
  const observerCallbacks: { callback: IntersectionObserverCallback; options?: IntersectionObserverInit }[] = [];
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      observerCallbacks.push({ callback, options });
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  vi.stubGlobal('innerHeight', 700);

  function TallLanding() {
    const ref = useRef<HTMLDivElement>(null);
    useComponentReveal(ref, '/');
    return (
      <div ref={ref}>
        <nav className="fit-nav">
          <a data-nav-target="packages" href="/#packages">Packages</a>
        </nav>
        <section id="packages">
          <div data-reveal="soft" id="tall-block">Tall mobile schedule</div>
        </section>
      </div>
    );
  }

  await act(async () => root.render(<TallLanding />));
  const tallBlock = host.querySelector<HTMLElement>('#tall-block')!;
  const revealObserver = observerCallbacks.find((entry) => Array.isArray(entry.options?.threshold))!;
  expect(revealObserver).toBeDefined();

  // Tall block only has 4% ratio (below 0.12) but 96px visible (>= min(700*0.12, 80) = 80px) -> must become visible!
  await act(async () => {
    revealObserver.callback(
      [{
        target: tallBlock,
        isIntersecting: true,
        intersectionRatio: 0.04,
        intersectionRect: { height: 96 } as DOMRectReadOnly,
        boundingClientRect: { top: 20 } as DOMRectReadOnly,
      } as unknown as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
  });
  expect(tallBlock.classList.contains('is-visible')).toBe(true);

  // Under prefers-reduced-motion: reduce, sectionObserver still stays active and highlights nav links!
  await act(async () => root.unmount());
  observerCallbacks.length = 0;
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  root = createRoot(host);
  await act(async () => root.render(<TallLanding />));

  const sectionObs = observerCallbacks.find((entry) => entry.options?.rootMargin === '-35% 0px -50% 0px');
  expect(sectionObs).toBeDefined();
  const pkgSection = host.querySelector<HTMLElement>('#packages')!;
  await act(async () => {
    sectionObs!.callback(
      [{ target: pkgSection, isIntersecting: true } as unknown as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
  });
  expect(host.querySelector('.fit-nav a[data-nav-target="packages"]')?.classList.contains('is-active')).toBe(true);
});
