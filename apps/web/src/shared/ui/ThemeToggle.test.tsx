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
