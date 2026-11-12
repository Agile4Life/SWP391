import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ThemeProvider, ThemeToggle } from './ThemeToggle';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});
const render = () => act(async () => root.render(<ThemeProvider><ThemeToggle /></ThemeProvider>));

it('defaults to light, toggles both ways and saves the choice', async () => {
  await render();
  const button = host.querySelector('button')!;
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(localStorage.getItem('scms_theme')).toBe('light');
  expect(button.getAttribute('aria-label')).toBe('Bật chế độ tối');
  await act(async () => button.click());
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(localStorage.getItem('scms_theme')).toBe('dark');
  expect(button.getAttribute('aria-label')).toBe('Bật chế độ sáng');
  await act(async () => button.click());
  expect(localStorage.getItem('scms_theme')).toBe('light');
});

it.each(['light', 'dark'])('restores saved %s theme when the application mounts', async (theme) => {
  localStorage.setItem('scms_theme', theme);
  await render();
  expect(document.documentElement.dataset.theme).toBe(theme);
});

it('still switches when browser storage is unavailable', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  await render();
  expect(document.documentElement.dataset.theme).toBe('light');
  await act(async () => host.querySelector('button')!.click());
  expect(document.documentElement.dataset.theme).toBe('dark');
});

it('reveals the new theme with a circle from the toggle when View Transitions are available', async () => {
  const animate = vi.fn();
  (document.documentElement as unknown as { animate: unknown }).animate = animate;
  const start = vi.fn((update: () => void) => { update(); return { ready: Promise.resolve(), finished: Promise.resolve() }; });
  (document as unknown as { startViewTransition: unknown }).startViewTransition = start;
  await render();
  await act(async () => host.querySelector('button')!.click());
  await act(async () => { await Promise.resolve(); });
  expect(start).toHaveBeenCalledTimes(1);
  expect(document.documentElement.dataset.theme).toBe('dark');
  const [keyframes, options] = animate.mock.calls[0] as [{ clipPath: string[] }, { duration: number; pseudoElement: string }];
  expect(keyframes.clipPath[0]).toMatch(/^circle\(0px at /);
  expect(options).toMatchObject({ duration: 450, pseudoElement: '::view-transition-new(root)' });
  expect(document.documentElement.hasAttribute('data-theme-vt')).toBe(false);
  delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
  delete (document.documentElement as unknown as { animate?: unknown }).animate;
});

it('switches instantly when the user prefers reduced motion', async () => {
  const start = vi.fn();
  (document as unknown as { startViewTransition: unknown }).startViewTransition = start;
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} }));
  await render();
  await act(async () => host.querySelector('button')!.click());
  expect(start).not.toHaveBeenCalled();
  expect(document.documentElement.dataset.theme).toBe('dark');
  vi.unstubAllGlobals();
  delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
});
