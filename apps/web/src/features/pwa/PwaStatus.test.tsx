import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PwaStatus } from './PwaStatus';
import { capturePwaInstall, clearInstallPrompt } from './registerPwa';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  clearInstallPrompt();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});
it('shows offline guidance and recovers when online', async () => {
  await act(async () => root.render(<PwaStatus />));
  await act(async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    window.dispatchEvent(new Event('offline'));
  });
  expect(host.textContent).toContain('Đang ngoại tuyến');
  expect(host.textContent).toContain('check-in');
  await act(async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    window.dispatchEvent(new Event('online'));
  });
  expect(host.textContent).not.toContain('Đang ngoại tuyến');
});
it('uses the Android browser install prompt only after a tap', async () => {
  await act(async () => root.render(<PwaStatus />));
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) });
  await act(async () => window.dispatchEvent(event));
  expect(prompt).not.toHaveBeenCalled();
  const button = [...host.querySelectorAll('button')].find(b => b.textContent?.includes('Cài SÖL'))!;
  await act(async () => button.click());
  expect(prompt).toHaveBeenCalledOnce();
  expect(host.textContent).not.toContain('Cài SÖL');
});
it('hides installation controls after the browser confirms installation', async () => {
  await act(async () => root.render(<PwaStatus />));
  await act(async () => window.dispatchEvent(new Event('appinstalled')));
  expect(host.querySelector('button')).toBeNull();
});
it('keeps installation in the menu without duplicating the offline banner', async () => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  await act(async () => root.render(<><PwaStatus mode="status" /><PwaStatus mode="install" /></>));
  expect(host.querySelectorAll('[role="status"]')).toHaveLength(1);
  expect(host.querySelectorAll('.pwa-install-button')).toHaveLength(1);
});
it('retains an install event received on the public page before the portal mounts', async () => {
  capturePwaInstall();
  const prompt = vi.fn().mockResolvedValue(undefined);
  window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: 'dismissed' }) }));
  await act(async () => root.render(<PwaStatus mode="install" />));
  expect(host.textContent).toContain('Cài SÖL');
  await act(async () => (host.querySelector('button') as HTMLButtonElement).click());
  expect(prompt).toHaveBeenCalledOnce();
});
