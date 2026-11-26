import { useStaffI18n, type StaffMessage } from '../operations/staffI18n';
import { LoadingImage } from '../../shared/ui/LoadingImage';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { checkinApi } from './checkinApi';
import '../checkin/qr-checkin.css';

/**
 * Bảng mã QR của cổng cho hội viên tự quét (vào hoặc ra): tạo ảnh QR từ backend, tự làm mới mỗi 45 giây và khi
 * tab hiện lại, đếm ngược thời hạn theo cả đồng hồ thường lẫn đồng hồ đơn điệu.
 * `purpose` chỉ thay đổi phần hướng dẫn hiển thị: hội viên quét cùng một mã QR cổng để vào và để ra.
 */
export function GateQrPanel({ gateId, purpose = 'in' }: { gateId: string; purpose?: 'in' | 'out' }) {
  const { t } = useStaffI18n();
  const [qr, setQr] = useState<{ image: string; gateId: string; wallEnd: number; monotonicEnd: number } | null>(null);
  const [error, setError] = useState<StaffMessage>('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [now, setNow] = useState(() => ({ wall: Date.now(), monotonic: performance.now() }));
  useEffect(() => {
    let active = true;
    let fetching = false;
    const controller = new AbortController();
    // Lấy mã QR cổng mới và dựng ảnh; bỏ qua nếu đang tải hoặc tab đang ẩn, dữ liệu không khớp cổng thì báo lỗi.
    async function refresh() {
      if (fetching || document.hidden) return;
      fetching = true;
      const startWall = Date.now(); const startMonotonic = performance.now();
      setLoading(true); setError('');
      try {
        const response = await checkinApi.gateQr(gateId, controller.signal);
        const lifetime = Math.min(response.expiresInSeconds * 1000,
          Date.parse(response.expiresAt) - Date.parse(response.generatedAt), 60000);
        if (!response.qrCode || response.gateId !== gateId || !Number.isFinite(lifetime) || lifetime <= 0) throw new Error('invalid');
        const image = await QRCode.toDataURL(response.qrCode, { width: 360, margin: 4, errorCorrectionLevel: 'M' });
        if (active) {
          setNow({ wall: Date.now(), monotonic: performance.now() });
          setQr({ image, gateId, wallEnd: startWall + lifetime, monotonicEnd: startMonotonic + lifetime });
        }
      } catch { if (active) { setQr(null); setError('Không thể tạo mã QR cổng. Kiểm tra kết nối rồi thử lại.'); } }
      finally { fetching = false; if (active) setLoading(false); }
    }
    void refresh();
    const interval = window.setInterval(() => {
      if (active) setNow({ wall: Date.now(), monotonic: performance.now() });
    }, 500);
    const renew = window.setInterval(() => void refresh(), 45000);
    // Tab hiện lại thì bỏ mã cũ và tải mã mới.
    const resume = () => {
      setQr(null);
      setNow({ wall: Date.now(), monotonic: performance.now() });
      if (!document.hidden) void refresh();
    };
    document.addEventListener('visibilitychange', resume);
    return () => { active = false; controller.abort(); clearInterval(interval); clearInterval(renew); document.removeEventListener('visibilitychange', resume); };
  }, [gateId, retry]);
  const remaining = qr?.gateId === gateId ? Math.max(0, Math.ceil(Math.min(qr.wallEnd - now.wall, qr.monotonicEnd - now.monotonic) / 1000)) : 0;
  return <section data-i18n-managed className="gate-qr-panel" aria-label={t("Mã QR cổng cho hội viên")}>
    <h2 className="portal-card-title">{purpose === 'out' ? t("Hội viên quét QR để check-out") : t("Hội viên quét QR cổng")}</h2>
    <p className="qr-checkin-hint">{purpose === 'out'
      ? t("Mở mục Quét QR trên điện thoại, chọn Check-out rồi hướng camera vào mã bên dưới.")
      : t("Mở mục Quét QR trên điện thoại và hướng camera vào mã bên dưới.")}</p>
    {qr && remaining > 0 ? <><LoadingImage className="gate-qr-panel__image" src={qr.image} alt={purpose === 'out' ? t('Mã QR cổng check-out', 'Gate check-out QR code') : t('Mã QR cổng check-in', 'Gate check-in QR code')} onError={() => { setQr(null); setError('Không thể hiển thị mã QR. Vui lòng thử lại.'); }} /><p data-i18n-managed className="gate-qr-panel__status" style={{ fontVariantNumeric: 'tabular-nums' }}>{t("Mã còn hiệu lực ")}{remaining}{t("s · Tự làm mới")}</p></>
      : loading ? <div role="status" aria-busy="true" style={{ display: 'grid' }}><span className="sr-only">{t("Đang tạo mã QR cổng…")}</span><div className="gate-qr-panel__image portal-skeleton" aria-hidden="true" style={{ background: 'var(--portal-raised, #eeefec)' }} /></div> : !error && <p role="status">{t("Mã đã hết hạn. Vui lòng tạo mã mới.")}</p>}
    {error && <p className="qr-checkin-error" role="alert">{t(error)}</p>}
    {(!qr || remaining === 0) && <button type="button" className="btn-secondary" disabled={loading} onClick={() => setRetry((value) => value + 1)}>{t("Tạo lại mã QR cổng")}</button>}
  </section>;
}
