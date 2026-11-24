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
  host = document.createElement('div'); document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove(); vi.unstubAllGlobals(); vi.useRealTimers(); vi.clearAllMocks();
});
// Dựng component vào DOM giả để kiểm thử.
const render = () => act(async () => root.render(<MemoryRouter><SportStack ptPath="/member/classes?tab=pt" /></MemoryRouter>));
// Kích hoạt một bước của phần giới thiệu.
const activate = async (index: number) => act(async () => {
  const target = host.querySelectorAll('.fit-sport-story-step')[index];
  intersect([{ target, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
});
// Tiến đồng hồ giả thêm 500 ms.
const advance = () => act(async () => vi.advanceTimersByTime(500));
// Môn đang được hiển thị (active).
const shown = () => host.querySelector<HTMLElement>('.fit-sport-story-visual.is-active')?.dataset.sport;

it('shows only Gym with its PT booking CTA and mobile illustration', async () => {
  await render();
  expect(host.querySelectorAll('.fit-sport-story-step')).toHaveLength(1);
  expect(host.querySelector('.fit-sport-story-step h3')?.textContent).toBe('Gym');
  expect(host.querySelectorAll('.fit-sport-story-inline img')).toHaveLength(1);
  expect([...host.querySelectorAll('a')].map(a => a.getAttribute('href'))).toEqual(['/member/classes?tab=pt']);
  expect(host.textContent).not.toMatch(/Bơi lội|Boxing|Tennis|Cầu lông|Yoga/);
});

it('keeps Gym stable for scrolling, keyboard focus and reduced motion', async () => {
  await render();
  await activate(0);
  await act(async () => host.querySelector('a')!.focus());
  preference.matches = true;
  await act(async () => preference.addEventListener.mock.calls[0][1]());
  await advance();
  expect(shown()).toBe('gym');
  expect(host.querySelector<HTMLElement>('.fit-sport-story-rail i')?.style.top).toBe('0%');
  expect(host.querySelector('.is-leaving')).toBeNull();
});
