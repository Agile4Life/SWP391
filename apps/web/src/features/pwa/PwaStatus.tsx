import { useEffect, useState, useSyncExternalStore } from 'react';
import { Modal } from '../../shared/ui/Modal';
import { applyPwaUpdate, capturePwaInstall, clearInstallPrompt, getInstallPrompt, getWaitingRegistration, subscribePwaInstall, subscribePwaUpdate } from './registerPwa';
import './pwa.css';

function standalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function PwaStatus({ mode = 'all' }: { mode?: 'status' | 'install' | 'all' }) {
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [installed, setInstalled] = useState(standalone);
  const installPrompt = useSyncExternalStore(subscribePwaInstall, getInstallPrompt, () => null);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [installError, setInstallError] = useState(false);
  const waiting = useSyncExternalStore(subscribePwaUpdate, getWaitingRegistration, () => null);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  useEffect(() => {
    capturePwaInstall();
    const online = () => setOffline(false);
    const disconnected = () => setOffline(true);
    const didInstall = () => { setInstalled(true); setHelp(false); };
    const mode = window.matchMedia?.('(display-mode: standalone)');
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

  const install = async () => {
    if (!installPrompt) { setHelp(true); return; }
    setBusy(true);
    setInstallError(false);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
    } catch { setInstallError(true); }
    finally { clearInstallPrompt(); setBusy(false); }
  };

  return <div className="pwa-status" aria-label="Ứng dụng SÖL">
    {mode !== 'install' && offline && <p className="pwa-status__notice" role="status"><strong>Đang ngoại tuyến.</strong> Kết nối mạng để tải dữ liệu, gửi tin nhắn hoặc check-in.</p>}
    {mode !== 'install' && waiting && <div className="pwa-status__notice" role="status"><span>Đã có phiên bản mới. Hoàn tất thao tác đang làm trước khi cập nhật.</span><button className="btn-secondary" type="button" disabled={offline || busy} onClick={() => { if (applyPwaUpdate()) setBusy(true); }}>Cập nhật</button></div>}
    {mode !== 'status' && !installed && <button type="button" className="pwa-install-button" disabled={busy} onClick={() => void install()}>{busy ? 'Đang mở cài đặt…' : installPrompt ? 'Cài SÖL trên điện thoại' : 'Thêm SÖL vào màn hình chính'}</button>}
    {installError && <p className="pwa-status__notice" role="alert">Chưa thể mở cài đặt. Hãy thử thêm ứng dụng từ menu trình duyệt.</p>}
    {help && <Modal title="SÖL trên điện thoại" onClose={() => setHelp(false)}>
      <p className="portal-subtitle">Mở nhanh portal từ màn hình chính và dùng camera để check-in.</p>
      {ios ? <ol className="pwa-install-steps"><li>Mở website này bằng Safari.</li><li>Chọn Chia sẻ, rồi Thêm vào MH chính.</li><li>Nếu có tùy chọn Mở dưới dạng ứng dụng web, hãy bật và chọn Thêm.</li></ol>
        : <ol className="pwa-install-steps"><li>Mở website này bằng Chrome trên Android.</li><li>Mở menu ⋮, chọn Cài đặt ứng dụng hoặc Thêm vào màn hình chính.</li><li>Xác nhận cài đặt, rồi mở biểu tượng SÖL.</li></ol>}
      <p className="portal-subtitle">Ứng dụng mở thẳng portal. Bạn cần đăng nhập nếu phiên đã hết hạn; check-in cần kết nối mạng.</p>
    </Modal>}
  </div>;
}
