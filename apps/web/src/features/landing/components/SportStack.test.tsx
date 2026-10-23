import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SportStack } from './SportStack';

let host: HTMLDivElement;
let root: Root;
let reducedMotion = false;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  reducedMotion = false;
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reducedMotion, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  host = document.createElement('div'); document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove(); vi.useRealTimers(); vi.unstubAllGlobals();
});
const render = () => act(async () => root.render(<MemoryRouter><SportStack classPath="/login" /></MemoryRouter>));
const current = () => host.querySelector<HTMLElement>('[data-depth="0"]')!;
const next = () => [...host.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === 'Bộ môn tiếp theo')!;

it('shows one complete sport at a time and keeps other cards out of keyboard navigation', async () => {
  await render();
  expect(host.querySelectorAll('.fit-sport-stack-card')).toHaveLength(4);
  expect(current().textContent).toContain('Bơi lội');
  expect(current().textContent).toContain('Nội dung luyện tập');
  expect(current().querySelector('a')?.getAttribute('href')).toBe('/login');
  expect(host.querySelectorAll('[inert]')).toHaveLength(3);
});

it('moves cards to the back in order, ignores repeated clicks during motion and loops', async () => {
  await render();
  for (const name of ['Tennis', 'Cầu lông', 'Bóng rổ', 'Bơi lội']) {
    await act(async () => { next().click(); next().click(); });
    expect(next().getAttribute('aria-disabled')).toBe('true');
    await act(async () => vi.advanceTimersByTime(900));
    expect(current().textContent).toContain(name);
    expect(next().getAttribute('aria-disabled')).toBe('false');
  }
});

it('switches immediately when reduced motion is requested', async () => {
  reducedMotion = true;
  await render();
  await act(async () => next().click());
  expect(current().textContent).toContain('Tennis');
  expect(next().getAttribute('aria-disabled')).toBe('false');
});
