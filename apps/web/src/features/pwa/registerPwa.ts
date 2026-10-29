let waitingRegistration: ServiceWorkerRegistration | null = null;
const listeners = new Set<() => void>();
let registrationStarted = false;
export interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
let pendingInstallPrompt: InstallPrompt | null = null;
let captureStarted = false;
const installListeners = new Set<() => void>();

export function getInstallPrompt() { return pendingInstallPrompt; }
export function subscribePwaInstall(listener: () => void) {
  installListeners.add(listener);
  return () => { installListeners.delete(listener); };
}
export function clearInstallPrompt() {
  pendingInstallPrompt = null;
  installListeners.forEach(listener => listener());
}
export function capturePwaInstall() {
  if (captureStarted) return;
  captureStarted = true;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    pendingInstallPrompt = event as InstallPrompt;
    installListeners.forEach(listener => listener());
  });
  window.addEventListener('appinstalled', clearInstallPrompt);
}

export function getWaitingRegistration() { return waitingRegistration; }
export function subscribePwaUpdate(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function applyPwaUpdate() {
  const worker = waitingRegistration?.waiting;
  if (!worker) return false;
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  worker.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

export async function registerPwa() {
  // Capture even on public pages, before the authenticated portal is mounted.
  capturePwaInstall();
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || registrationStarted) return;
  registrationStarted = true;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
    const announceUpdate = () => {
      if (!registration.waiting || !navigator.serviceWorker.controller) return;
      waitingRegistration = registration;
      listeners.forEach(listener => listener());
    };
    announceUpdate();
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed') announceUpdate();
      });
    });
    // Check when returning to the app; never activate a replacement automatically.
    window.addEventListener('online', () => { void registration.update().catch(() => {}); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void registration.update().catch(() => {});
    });
  } catch {
    // Installation is optional; a blocked worker must not prevent portal access.
    registrationStarted = false;
  }
}
