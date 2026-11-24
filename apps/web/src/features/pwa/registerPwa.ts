let waitingRegistration: ServiceWorkerRegistration | null = null;
const listeners = new Set<() => void>();
let registrationStarted = false;
/** Sự kiện beforeinstallprompt của trình duyệt: gọi prompt() và chờ lựa chọn của người dùng. */
export interface InstallPrompt extends Event {
  // Hiện hộp thoại cài ứng dụng của trình duyệt.
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
let pendingInstallPrompt: InstallPrompt | null = null;
let captureStarted = false;
const installListeners = new Set<() => void>();

/** Lấy lời nhắc cài ứng dụng đang giữ lại (nếu có). */
export function getInstallPrompt() { return pendingInstallPrompt; }
/** Đăng ký listener theo dõi lời nhắc cài; trả về hàm hủy đăng ký. */
export function subscribePwaInstall(listener: () => void) {
  installListeners.add(listener);
  return () => { installListeners.delete(listener); };
}
/** Xóa lời nhắc cài đã dùng và báo cho các listener. */
export function clearInstallPrompt() {
  pendingInstallPrompt = null;
  installListeners.forEach(listener => listener());
}
/**
 * Bắt sự kiện beforeinstallprompt (chặn banner mặc định, giữ lại để dùng sau) và appinstalled; chỉ đăng ký một
 * lần.
 */
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

/** Lấy bản service worker đang chờ kích hoạt (nếu có). */
export function getWaitingRegistration() { return waitingRegistration; }
/** Đăng ký listener theo dõi có bản cập nhật mới; trả về hàm hủy đăng ký. */
export function subscribePwaUpdate(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/**
 * Áp dụng bản cập nhật: báo worker đang chờ chạy ngay và tải lại trang khi worker mới nắm quyền; trả false nếu
 * không có bản chờ.
 */
export function applyPwaUpdate() {
  const worker = waitingRegistration?.waiting;
  if (!worker) return false;
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  worker.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

/**
 * Đăng ký service worker (chỉ ở bản production): lưu thêm các file /assets đã tải vào cache, báo khi có bản mới
 * đang chờ và kiểm tra cập nhật khi online; không bao giờ tự kích hoạt bản mới.
 */
export async function registerPwa() {
  // Capture even on public pages, before the authenticated portal is mounted.
  capturePwaInstall();
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || registrationStarted) return;
  registrationStarted = true;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
    // Initial route chunks may finish before the first worker controls this page.
    // Gửi danh sách file /assets cùng nguồn đã tải cho service worker để lưu cache.
    const syncAssets = (entries: PerformanceEntry[]) => {
      const paths = entries.flatMap(entry => {
        const url = new URL(entry.name, window.location.href);
        return url.origin === window.location.origin && url.pathname.startsWith('/assets/') && !url.search ? [url.pathname] : [];
      });
      if (paths.length) navigator.serviceWorker.controller?.postMessage({ type: 'CACHE_VISITED_ASSETS', paths: [...new Set(paths)] });
    };
    // Đồng bộ mọi tài nguyên đã tải tới thời điểm này.
    const syncLoadedAssets = () => syncAssets(performance.getEntriesByType('resource'));
    navigator.serviceWorker.addEventListener('controllerchange', syncLoadedAssets);
    if (typeof PerformanceObserver !== 'undefined') {
      new PerformanceObserver(list => syncAssets(list.getEntries())).observe({ entryTypes: ['resource'] });
    }
    syncLoadedAssets();
    // Báo có bản cập nhật khi có worker đang chờ và trang đã được worker cũ điều khiển.
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
