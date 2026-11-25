import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SportStack } from './SportStack';

let host: HTMLDivElement;
let root: Root;
let intersect: IntersectionObserverCallback;
let preference: { matches: boolean; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
const disconnect = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  preference = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', () => preference);
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { intersect = callback; }
    observe() {}
    disconnect = disconnect;
  });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});

const render = () => act(async () => root.render(<MemoryRouter><SportStack classPath="/member/classes" /></MemoryRouter>));
const activate = async (index: number) => act(async () => {
  const target = host.querySelectorAll('.fit-sport-story-step')[index];
  intersect([{ target, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
});
const advance = () => act(async () => vi.advanceTimersByTime(500));
const shown = () => host.querySelector<HTMLElement>('.fit-sport-story-visual.is-active')?.dataset.sport;

it('shows all 6 disciplines with class schedule CTAs and secondary detail links', async () => {
  await render();
  expect(host.querySelectorAll('.fit-sport-story-step')).toHaveLength(6);
  expect([...host.querySelectorAll('.fit-sport-story-step h3')].map((h) => h.textContent))
    .toEqual(['Gym', 'Bơi lội', 'Boxing', 'Tennis', 'Cầu lông', 'Yoga']);
  expect(host.querySelectorAll('.fit-sport-story-inline img')).toHaveLength(6);
  const hrefs = [...host.querySelectorAll('a')].map((a) => a.getAttribute('href'));
  expect(hrefs).toContain('/member/classes?tab=classes&discipline=Gym');
  expect(hrefs).toContain('/swimming');
  expect(hrefs).toContain('/boxing');
  expect(hrefs).toContain('/tennis');
  expect(hrefs).toContain('/badminton');
  expect(hrefs).toContain('/yoga');
});

it('switches visual cleanly on scroll, keyboard focus and reduced motion', async () => {
  await render();
  await activate(5);
  await advance();
  expect(shown()).toBe('yoga');
  expect(host.querySelector<HTMLElement>('.fit-sport-story-rail i')?.style.top).toBe('100%');

  preference.matches = true;
  await act(async () => preference.addEventListener.mock.calls[0][1]());
  await activate(2);
  expect(shown()).toBe('boxing');
  expect(host.querySelector('.is-leaving')).toBeNull();
});
