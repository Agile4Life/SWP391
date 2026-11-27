import { useSourceLanguage, sourceText } from "../../shared/i18n/sourceText";
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Modal } from '../../shared/ui/Modal';
import { applyPwaUpdate, capturePwaInstall, clearInstallPrompt, getInstallPrompt, getWaitingRegistration, subscribePwaInstall, subscribePwaUpdate } from './registerPwa';
import './pwa.css';

/** Cho biết ứng dụng đang chạy ở chế độ đã cài (standalone) trên trình duyệt thường hoặc iOS. */
function standalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * Hiển thị trạng thái PWA trong hộp thoại giữa màn hình (lỗi cài đặt, cập nhật bản mới, mất mạng) cùng nút cài
 * ứng dụng và hướng dẫn cài đặt; mode chọn hiện phần trạng thái, phần cài đặt hoặc cả hai.
 */
export function PwaStatus({ mode = 'all' }: { mode?: 'status' | 'install' | 'all' }) {
  useSourceLanguage();
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [dismissedOffline, setDismissedOffline] = useState(false);
  const [installed, setInstalled] = useState(standalone);
  const installPrompt = useSyncExternalStore(subscribePwaInstall, getInstallPrompt, () => null);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [installError, setInstallError] = useState(false);
  const waiting = useSyncExternalStore(subscribePwaUpdate, getWaitingRegistration, () => null);
  const waitingKey = waiting?.waiting ?? waiting;
  const [dismissedWaiting, setDismissedWaiting] = useState<ServiceWorker | ServiceWorkerRegistration | null>(null);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = !ios && /Android/i.test(navigator.userAgent);

  useEffect(() => {
    if (!waitingKey) setDismissedWaiting(null);
  }, [waitingKey]);

  useEffect(() => {
    capturePwaInstall();
    // Có mạng lại.
    const online = () => { setOffline(false); setDismissedOffline(false); };
    // Mất mạng.
    const disconnected = () => { setOffline(true); setDismissedOffline(false); };
    // Cài xong thì đánh dấu đã cài và đóng phần hướng dẫn.
    const didInstall = () => { setInstalled(true); setHelp(false); };
    const mode = window.matchMedia?.('(display-mode: standalone)');
    // Chế độ hiển thị đổi thì cập nhật trạng thái đã cài.
    const changedMode = () => setInstalled(standalone());
    window.addEventListener('online', online);
    window.addEventListener('offline', disconnected);
    window.addEventListener('appinstalled', didInstall);
    mode?.addEventListener('change', changedMode);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', disconnected);
      window.removeEventListener('appinstalled', didInstall);
      mode?.removeEventListener('change', changedMode);
    };
  }, []);

  // Cài ứng dụng: chưa có lời nhắc cài thì mở hướng dẫn, ngược lại hiện lời nhắc của trình duyệt và ghi nhận lựa chọn.
  const install = async () => {
    if (!installPrompt) { setInstallError(false); setHelp(true); return; }
    setBusy(true);
    setInstallError(false);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
    } catch { setInstallError(true); }
    finally { clearInstallPrompt(); setBusy(false); }
  };

  const activeNotice: 'installError' | 'waiting' | 'offline' | null = help
    ? null
    : installError
      ? 'installError'
      : mode !== 'install' && waitingKey && dismissedWaiting !== waitingKey
        ? 'waiting'
        : mode !== 'install' && offline && !dismissedOffline
          ? 'offline'
          : null;

  const noticeTitle = activeNotice === 'installError'
    ? sourceText({ vi: 'Không thể thực hiện', en: 'Unable to complete' })
    : activeNotice === 'waiting'
      ? sourceText({ vi: 'Đã có phiên bản mới', en: 'New version available' })
      : sourceText({ vi: 'Đang ngoại tuyến', en: 'You are offline' });

  const closeNotice = () => {
    if (activeNotice === 'installError') setInstallError(false);
    else if (activeNotice === 'waiting') setDismissedWaiting(waitingKey);
    else if (activeNotice === 'offline') setDismissedOffline(true);
  };

  return (
    <div className="pwa-status" aria-label={sourceText("Ứng dụng SÖL")}>
      {mode !== 'status' && !installed && (
        <button type="button" className="pwa-install-button" disabled={busy} onClick={() => void install()}>
          {busy ? sourceText('Đang mở cài đặt…') : installPrompt ? sourceText('Cài SÖL trên điện thoại') : sourceText('Thêm SÖL vào màn hình chính')}
        </button>
      )}
      {activeNotice && (
        <Modal
          key={activeNotice}
          role="alertdialog"
          ariaDescribedBy="pwa-status-message"
          className="pwa-status__dialog"
          title={noticeTitle}
          onClose={closeNotice}
        >
          {activeNotice === 'installError' && (
            <div className="portal-alert portal-alert--error pwa-status__alert" role="alert">
              <p id="pwa-status-message" className="pwa-status__message">
                {sourceText("Chưa thể mở cài đặt. Hãy thử thêm ứng dụng từ menu trình duyệt.")}
              </p>
            </div>
          )}
          {activeNotice === 'waiting' && (
            <>
              <div className="portal-alert portal-alert--info pwa-status__alert" role="status">
                <p id="pwa-status-message" className="pwa-status__message">
                  {sourceText("Đã có phiên bản mới. Hoàn tất thao tác đang làm trước khi cập nhật.")}
                </p>
              </div>
              <div className="form-actions pwa-status__actions">
                <button
                  className="btn-primary"
                  type="button"
                  disabled={offline || busy}
                  onClick={() => { if (applyPwaUpdate()) setBusy(true); }}
                >
                  {sourceText("Cập nhật")}
                </button>
              </div>
            </>
          )}
          {activeNotice === 'offline' && (
            <div className="portal-alert portal-alert--warning pwa-status__alert" role="status">
              <p id="pwa-status-message" className="pwa-status__message">
                <strong>{sourceText("Đang ngoại tuyến.")}</strong> {sourceText(" Kết nối mạng để tải dữ liệu, gửi tin nhắn hoặc check-in.")}
              </p>
            </div>
          )}
        </Modal>
      )}
      {help && <Modal title={ios || android ? sourceText("SÖL trên điện thoại") : sourceText({ vi: 'Cài đặt ứng dụng SÖL', en: 'Install SÖL app' })} onClose={() => setHelp(false)}>
        <p className="portal-subtitle">{ios || android ? sourceText("Mở nhanh portal từ màn hình chính và dùng camera để check-in.") : sourceText({ vi: 'Mở nhanh portal trong cửa sổ riêng từ thanh tác vụ hoặc màn hình máy tính.', en: 'Launch the portal in its own window from your desktop or taskbar.' })}</p>
        {ios ? <ol className="pwa-install-steps"><li>{sourceText("Mở website này bằng Safari.")}</li><li>{sourceText("Chọn Chia sẻ, rồi Thêm vào MH chính.")}</li><li>{sourceText("Nếu có tùy chọn Mở dưới dạng ứng dụng web, hãy bật và chọn Thêm.")}</li></ol>
          : android ? <ol className="pwa-install-steps"><li>{sourceText("Mở website này bằng Chrome trên Android.")}</li><li>{sourceText("Mở menu ⋮, chọn Cài đặt ứng dụng hoặc Thêm vào màn hình chính.")}</li><li>{sourceText("Xác nhận cài đặt, rồi mở biểu tượng SÖL.")}</li></ol>
            : <ol className="pwa-install-steps"><li>{sourceText({ vi: 'Mở website này bằng Chrome hoặc Edge trên máy tính.', en: 'Open this website in Chrome or Edge on your computer.' })}</li><li>{sourceText({ vi: 'Chọn biểu tượng cài đặt trên thanh địa chỉ hoặc mở menu trình duyệt, rồi chọn Cài đặt ứng dụng.', en: 'Click the install icon in the address bar or open the browser menu and select Install app.' })}</li><li>{sourceText({ vi: 'Xác nhận cài đặt để mở nhanh SÖL từ màn hình chính hoặc thanh tác vụ.', en: 'Confirm the installation to launch SÖL directly from your desktop or taskbar.' })}</li></ol>}
        <p className="portal-subtitle">{sourceText("Check-in cần kết nối mạng.")}</p>
      </Modal>}
    </div>
  );
}
