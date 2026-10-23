import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SportStack } from './SportStack';

let host: HTMLDivElement;
let root: Root;
let resize: () => void;
let preference: { matches: boolean; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  preference = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', () => preference);
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resize = callback; }
    observe() {}
    disconnect() {}
  });
  host = document.createElement('div'); document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove(); vi.unstubAllGlobals();
});
const render = () => act(async () => root.render(<MemoryRouter><SportStack classPath="/login" /></MemoryRouter>));

it('sends the front card behind the deck as native scroll advances and reverses on scroll up', async () => {
  await render();
  const track = host.querySelector<HTMLElement>('.fit-sport-stack-track')!;
  const deck = host.querySelector<HTMLElement>('.fit-sport-stack-deck')!;
  const cards = [...host.querySelectorAll<HTMLElement>('.fit-sport-stack-card')];
  vi.stubGlobal('scrollY', 0);
  vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({ top: 1000 } as DOMRect);
  Object.defineProperty(deck, 'offsetHeight', { configurable: true, value: 750 });
  vi.stubGlobal('innerHeight', 1000);
  await act(async () => resize());
  const step = Number(track.style.getPropertyValue('--stack-step'));
  const stickyTop = parseFloat(deck.style.getPropertyValue('--stack-top'));
  vi.stubGlobal('scrollY', 1000 - stickyTop + step * .7);
  await act(async () => window.dispatchEvent(new Event('scroll')));
  expect(cards[0].classList.contains('is-leaving')).toBe(true);
  expect(cards[0].style.transform).toContain('rotate(');
  vi.stubGlobal('scrollY', 1000 - stickyTop + step);
  await act(async () => window.dispatchEvent(new Event('scroll')));
  expect(cards[1].dataset.depth).toBe('0');
  expect(cards[0].dataset.depth).toBe('3');
  vi.stubGlobal('scrollY', 1000 - stickyTop);
  await act(async () => window.dispatchEvent(new Event('scroll')));
  expect(cards[0].dataset.depth).toBe('0');
  expect(cards[0].classList.contains('is-leaving')).toBe(false);
  expect(host.querySelector('button')).toBeNull();
});

it('shows every card without movement when reduced motion changes live', async () => {
  await render();
  expect(host.querySelectorAll('[inert]')).toHaveLength(3);
  preference.matches = true;
  const change = preference.addEventListener.mock.calls[0][1];
  await act(async () => change());
  expect(host.querySelectorAll('[inert]')).toHaveLength(0);
  expect(host.querySelectorAll('[aria-hidden="true"][data-sport]')).toHaveLength(0);
});

it('pins below the header on short screens and releases within one small scroll after the final card', async () => {
  await render();
  const track = host.querySelector<HTMLElement>('.fit-sport-stack-track')!;
  const deck = host.querySelector<HTMLElement>('.fit-sport-stack-deck')!;
  Object.defineProperty(deck, 'offsetHeight', { configurable: true, value: 1000 });
  vi.stubGlobal('innerHeight', 650);
  await act(async () => resize());
  expect(parseFloat(deck.style.getPropertyValue('--stack-top'))).toBe(108);
  expect(Number(track.style.getPropertyValue('--stack-scale'))).toBeCloseTo(.518);
  const step = Number(track.style.getPropertyValue('--stack-step'));
  expect(parseFloat(track.style.getPropertyValue('--stack-travel')) - step * 3).toBe(48);
});

it('does not recalculate geometry or rewrite accessibility during an unchanged scroll phase', async () => {
  await render();
  const track = host.querySelector<HTMLElement>('.fit-sport-stack-track')!;
  const geometry = vi.spyOn(track, 'getBoundingClientRect');
  const card = host.querySelector<HTMLElement>('.fit-sport-stack-card')!;
  const attributes = vi.spyOn(card, 'setAttribute');
  await act(async () => window.dispatchEvent(new Event('scroll')));
  await act(async () => window.dispatchEvent(new Event('scroll')));
  expect(geometry).not.toHaveBeenCalled();
  expect(attributes).not.toHaveBeenCalled();
});

it('reserves viewport space for the section heading and hint above the cards', async () => {
  await render();
  const track = host.querySelector<HTMLElement>('.fit-sport-stack-track')!;
  const viewport = host.querySelector<HTMLElement>('.fit-sport-stack-stage')!;
  const frame = host.querySelector<HTMLElement>('.fit-sport-stack-deck-frame')!;
  const deck = host.querySelector<HTMLElement>('.fit-sport-stack-deck')!;
  Object.defineProperty(viewport, 'offsetHeight', { configurable: true, value: 620 });
  Object.defineProperty(deck, 'offsetHeight', { configurable: true, value: 500 });
  Object.defineProperty(frame, 'offsetHeight', { configurable: true, value: 500 });
  vi.stubGlobal('innerHeight', 650);
  await act(async () => resize());
  expect(Number(track.style.getPropertyValue('--stack-scale'))).toBeCloseTo(.796);
  expect(parseFloat(track.style.getPropertyValue('--stack-height'))).toBe(620);
});

it('reacts to the first small scroll at every card boundary without a reading dead zone', async () => {
  await render();
  const track = host.querySelector<HTMLElement>('.fit-sport-stack-track')!;
  const cards = [...host.querySelectorAll<HTMLElement>('.fit-sport-stack-card')];
  vi.stubGlobal('scrollY', 0);
  vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({ top: 1000 } as DOMRect);
  vi.stubGlobal('innerHeight', 900);
  await act(async () => resize());
  const step = Number(track.style.getPropertyValue('--stack-step'));
  expect(step).toBeGreaterThanOrEqual(540);
  expect(step).toBeLessThanOrEqual(630);
  for (let index = 0; index < 3; index++) {
    vi.stubGlobal('scrollY', 892 + step * index);
    await act(async () => window.dispatchEvent(new Event('scroll')));
    const before = cards[index].style.transform;
    vi.stubGlobal('scrollY', 892 + step * index + 8);
    await act(async () => window.dispatchEvent(new Event('scroll')));
    expect(cards[index].style.transform).not.toBe(before);
    expect(cards[index].classList.contains('is-leaving')).toBe(true);
  }
});
