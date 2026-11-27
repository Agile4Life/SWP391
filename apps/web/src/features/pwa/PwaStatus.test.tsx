import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PwaStatus } from './PwaStatus';
import { capturePwaInstall, clearInstallPrompt } from './registerPwa';

const pwaUpdateMock = vi.hoisted(() => {
  let registration: ServiceWorkerRegistration | null = null;
  const listeners = new Set<() => void>();
  const applyPwaUpdate = vi.fn(() => true);
  return {
    getWaiting: () => registration,
    setWaiting(next: ServiceWorkerRegistration | null) {
      registration = next;
      listeners.forEach(listener => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    applyPwaUpdate,
  };
});

vi.mock('./registerPwa', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./registerPwa')>();
  return {
    ...actual,
    getWaitingRegistration: () => pwaUpdateMock.getWaiting(),
    subscribePwaUpdate: (listener: () => void) => pwaUpdateMock.subscribe(listener),
    applyPwaUpdate: () => pwaUpdateMock.applyPwaUpdate(),
  };
});

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  clearInstallPrompt();
  pwaUpdateMock.setWaiting(null);
  pwaUpdateMock.applyPwaUpdate.mockClear();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
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

it('shows desktop install instructions on desktop browsers and Android instructions on Android (P3-FE-05)', async () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0');
  await act(async () => root.render(<PwaStatus mode="install" />));
  await act(async () => host.querySelector<HTMLButtonElement>('.pwa-install-button')!.click());
  expect(host.textContent).toContain('Chrome hoặc Edge trên máy tính');
  expect(host.textContent).not.toContain('Chrome trên Android');

  await act(async () => root.unmount());
  root = createRoot(host);
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/131.0.0.0 Mobile');
  await act(async () => root.render(<PwaStatus mode="install" />));
  await act(async () => host.querySelector<HTMLButtonElement>('.pwa-install-button')!.click());
  expect(host.textContent).toContain('Chrome trên Android');
});

it('shows the offline notice in a centered alertdialog that closes via × and re-opens on subsequent offline events', async () => {
  await act(async () => root.render(<PwaStatus mode="status" />));
  expect(host.querySelector('dialog')).toBeNull();
  expect(host.querySelector('.pwa-status')?.children).toHaveLength(0);

  await act(async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    window.dispatchEvent(new Event('offline'));
  });
  const dialog = host.querySelector<HTMLDialogElement>('dialog.portal-dialog[role="alertdialog"][open]');
  expect(dialog).not.toBeNull();
  expect(dialog?.classList.contains('pwa-status__dialog')).toBe(true);
  expect(dialog?.getAttribute('aria-describedby')).toBe('pwa-status-message');
  expect(dialog?.querySelector('.portal-card-title')?.textContent).toBe('Đang ngoại tuyến');
  expect(dialog?.querySelector('.portal-alert.portal-alert--warning.pwa-status__alert[role="status"]')).not.toBeNull();
  expect([...dialog!.querySelectorAll('button')].filter(b => /^(Đóng|Close)$/i.test(b.textContent?.trim() ?? ''))).toHaveLength(0);

  await act(async () => dialog?.querySelector<HTMLButtonElement>('.portal-dialog__close')!.click());
  expect(host.querySelector('dialog')).toBeNull();

  await act(async () => {
    window.dispatchEvent(new Event('offline'));
  });
  expect(host.querySelector('dialog.portal-dialog[role="alertdialog"][open]')).not.toBeNull();
});

it('shows the update-available notice in a centered alertdialog with an Update button, no bottom Close button, and closes via ×', async () => {
  await act(async () => root.render(<PwaStatus mode="status" />));
  const reg1 = { waiting: { state: 'installed' } as ServiceWorker } as ServiceWorkerRegistration;
  await act(async () => pwaUpdateMock.setWaiting(reg1));

  const dialog = host.querySelector<HTMLDialogElement>('dialog.portal-dialog[role="alertdialog"][open]');
  expect(dialog).not.toBeNull();
  expect(dialog?.classList.contains('pwa-status__dialog')).toBe(true);
  expect(dialog?.getAttribute('aria-describedby')).toBe('pwa-status-message');
  expect(dialog?.querySelector('.portal-card-title')?.textContent).toBe('Đã có phiên bản mới');
  expect(dialog?.querySelector('.portal-alert.portal-alert--info.pwa-status__alert[role="status"]')).not.toBeNull();

  const buttons = [...dialog!.querySelectorAll('button')];
  const updateButton = buttons.find(b => b.textContent?.trim() === 'Cập nhật');
  expect(updateButton).toBeDefined();
  expect(updateButton?.classList.contains('btn-primary')).toBe(true);
  expect(buttons.filter(b => /^(Đóng|Close)$/i.test(b.textContent?.trim() ?? ''))).toHaveLength(0);

  await act(async () => dialog?.querySelector<HTMLButtonElement>('.portal-dialog__close')!.click());
  expect(host.querySelector('dialog')).toBeNull();

  const reg2 = { waiting: { state: 'installed' } as ServiceWorker } as ServiceWorkerRegistration;
  await act(async () => pwaUpdateMock.setWaiting(reg2));
  const reopened = host.querySelector<HTMLDialogElement>('dialog.portal-dialog[role="alertdialog"][open]');
  expect(reopened).not.toBeNull();
  await act(async () => reopened?.querySelector<HTMLButtonElement>('.pwa-status__actions .btn-primary')!.click());
  expect(pwaUpdateMock.applyPwaUpdate).toHaveBeenCalledOnce();
});

it('shows install error in a centered alertdialog with priority and closes via ×', async () => {
  const prompt = vi.fn().mockRejectedValue(new Error('Prompt blocked'));
  await act(async () => root.render(<PwaStatus mode="install" />));
  await act(async () => {
    window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: 'dismissed' }) }));
  });
  await act(async () => host.querySelector<HTMLButtonElement>('.pwa-install-button')!.click());

  const dialog = host.querySelector<HTMLDialogElement>('dialog.portal-dialog[role="alertdialog"][open]');
  expect(dialog).not.toBeNull();
  expect(dialog?.querySelector('.portal-card-title')?.textContent).toBe('Không thể thực hiện');
  expect(dialog?.querySelector('.portal-alert.portal-alert--error.pwa-status__alert[role="alert"]')).not.toBeNull();
  expect(dialog?.textContent).toContain('Chưa thể mở cài đặt.');

  await act(async () => dialog?.querySelector<HTMLButtonElement>('.portal-dialog__close')!.click());
  expect(host.querySelector('dialog')).toBeNull();
});
