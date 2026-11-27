import { useStaffI18n, type StaffMessage, staffError as errorMessage } from '../operations/staffI18n';
import { LoadingImage } from '../../shared/ui/LoadingImage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, getCurrentUser } from '../../shared/api/client';
import { RefreshButton } from '../../shared/ui/RefreshButton';
import { StatusMark } from '../../shared/ui/StatusMark';
import { PageHeader } from '../../shared/ui/PageHeader';
import { formatCenterTimeSeconds } from '../../shared/lib/centerTime';
import { checkinApi, type CheckinDto } from './checkinApi';
import './staff-check-in.css';
import { GateQrPanel } from './GateQrPanel';
import { QrCameraScanner } from '../checkin/QrCameraScanner';
import { Link } from 'react-router-dom';

/** Trung tâm chỉ vận hành một cổng duy nhất nên quầy lễ tân không cần chọn cổng. */
const GATE = 'Turnstile A1 - Sảnh Chính';
const GATE_ID = 'A1';

/** Định dạng giờ:phút:giây theo múi giờ trung tâm. */
const formatTime = (iso?: string | null): string => formatCenterTimeSeconds(iso, iso ?? '—');

/** Lượt check-in được chấp nhận (GRANTED hoặc SUCCESS). */
const isCheckinGranted = (status?: string | null): boolean => {
  if (!status) return false;
  const normalized = status.trim().toUpperCase();
  return normalized === 'GRANTED' || normalized === 'SUCCESS';
};

/** Quầy Check-in: quét thẻ hội viên, QR cổng và lịch sử ra/vào; không có thao tác Check-out thủ công. */
export function StaffCheckInPage() {
  const { t } = useStaffI18n();
  const currentUser = getCurrentUser();

  // BR-01: Chỉ RECEPTIONIST / STAFF và CENTER_MANAGER / MANAGER được truy cập
  const hasAccess = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'MANAGER' || currentUser.role === 'STAFF';
  }, [currentUser]);

  const [scanCode, setScanCode] = useState('');
  const [scanError, setScanError] = useState<StaffMessage | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scanInFlight = useRef(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const [currentResult, setCurrentResult] = useState<CheckinDto | null>(null);
  const [denialMessage, setDenialMessage] = useState<StaffMessage | null>(null);
  const [recentCheckins, setRecentCheckins] = useState<CheckinDto[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<StaffMessage | null>(null);

  // Tải lịch sử check-in hôm nay.
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const list = await checkinApi.getHistory();
      setRecentCheckins(list);
    } catch (err: unknown) {
      const msg = errorMessage(err, 'Không thể tải lịch sử ra vào cổng.');
      setHistoryError(msg);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (hasAccess) {
      void loadHistory();
    }
  }, [hasAccess, loadHistory]);

  if (!hasAccess) {
    return (
      <div data-i18n-managed className="portal-container" data-testid="checkin-forbidden-guard">
        <div className="portal-card">
          <div className="portal-state" style={{ padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.25rem', fontWeight: 700, color: 'var(--portal-danger, #fca5a5)', marginBottom: '12px' }} role="img" aria-label="Forbidden">
              403
            </div>
            <h2 className="portal-state__title" style={{ fontSize: '1.5rem', marginBottom: '8px' }}>
              {t("Không có quyền truy cập")}</h2>
            <p style={{ color: 'var(--color-text-muted)', maxWidth: '480px', margin: '0 auto 20px auto' }}>
              {t("Chỉ Lễ tân và Quản lý trung tâm mới vận hành được cổng check-in.")}</p>
            <Link to="/portal" className="btn-secondary">
              {t("Về trang chủ Portal")}</Link>
          </div>
        </div>
      </div>
    );
  }

  // Quét mã thẻ hội viên: mã rỗng thì báo lỗi, mã QR cổng (SOL:GATE:) không dùng ở quầy, còn lại gửi lên backend.
  const executeScan = async (codeToScan: string) => {
    const trimmed = codeToScan.trim();
    if (!trimmed) {
      setScanError('Vui lòng nhập hoặc quét mã QR thẻ hội viên.');
      return;
    }
    if (scanInFlight.current) return;
    // Mã QR cổng là để hội viên tự quét; nhân viên chỉ quét mã trên thẻ của hội viên.
    if (trimmed.startsWith('SOL:GATE:')) {
      setScanError('Đây là mã QR cổng. Hãy quét mã trên thẻ hội viên.');
      return;
    }
    setScanError(null);

    scanInFlight.current = true;
    setIsScanning(true);
    try {
      const res = await checkinApi.scan({
        qrCode: trimmed,
        gate: GATE,
      });
      setDenialMessage(null);
      setCurrentResult(res);
      setRecentCheckins((prev) => [res, ...prev.filter((item) => item.id !== res.id)]);
      setScanCode('');
    } catch (err: unknown) {
      const msg = errorMessage(err, 'Không thể xác thực mã QR lúc này.');
      const isNetworkError = (err instanceof ApiError && err.status === 0) || err instanceof TypeError;
      if (isNetworkError) {
        setCurrentResult(null);
        setDenialMessage(null);
        setScanError(msg);
      } else {
        const deniedRecord: CheckinDto = {
          id: Date.now(),
          memberId: null,
          memberName: null,
          checkInTime: new Date().toISOString(),
          checkOutTime: null,
          method: 'qr_code',
          gate: GATE,
          status: 'DENIED',
          denialReason: msg instanceof Error ? msg.message : typeof msg === 'string' ? msg : msg.vi,
        };
        setScanError(null);
        setDenialMessage(msg);
        setCurrentResult(deniedRecord);
      }
    } finally {
      scanInFlight.current = false;
      setIsScanning(false);
    }
  };

  // Gửi biểu mẫu quét mã.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void executeScan(scanCode);
  };

  const isGranted = isCheckinGranted(currentResult?.status);
  const visibleVisits = recentCheckins.slice(0, 10);

  return (
    <div data-i18n-managed className="portal-container checkin-page">
      <PageHeader
        title={t('Check-in')}
        actions={
          <RefreshButton label={t("Làm mới nhật ký")} onClick={() => void loadHistory()} disabled={loadingHistory} />
        }
      />

      <div className="checkin-layout">
        {/* Thẻ bên trái: trình quét thẻ hội viên và QR cổng để check-in */}
        <div className="portal-card">
          <div className="portal-card-header">
            <h2 className="portal-card-title">{t("Quét mã hội viên")}</h2>
          </div>

          <form onSubmit={handleSubmit} style={{ marginBottom: '24px', display: 'grid', gap: '14px' }}>
            <div>
              <label className="portal-label" htmlFor="checkin-qr-input">
                {t("Mã QR hội viên")}</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  id="checkin-qr-input"
                  type="text"
                  className="portal-input"
                  placeholder={t("Nhập mã QR thẻ hội viên (ví dụ: SUB-10-ABCD1234)...")}
                  value={scanCode}
                  onChange={(e) => { setScanCode(e.target.value); if (scanError) setScanError(null); }}
                  disabled={isScanning}
                  aria-invalid={scanError ? true : undefined}
                  aria-describedby={scanError ? 'checkin-qr-error' : undefined}
                  autoFocus
                />
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isScanning || !scanCode.trim()}
                  data-testid="scan-submit-button" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                >
                  {isScanning ? t('Đang quét...') : 'Check-in'}
                </button>
              </div>
              {scanError && <p id="checkin-qr-error" className="form-error" role="alert">{t(scanError)}</p>}
            </div>
          </form>

          <div style={{ marginBottom: '24px' }}>
            <button type="button" className="btn-secondary" aria-expanded={cameraOpen} onClick={() => setCameraOpen((open) => !open)}>
              {cameraOpen ? t('Đóng camera') : t('Quét QR thẻ hội viên bằng camera')}
            </button>
            {cameraOpen && (
              <QrCameraScanner
                onScan={(code) => void executeScan(code)}
                disabled={isScanning}
                hint={t("Đưa mã QR trên thẻ hội viên vào khung. Bấm “Quét lại” cho người kế tiếp.")}
              />
            )}
          </div>

          <GateQrPanel gateId={GATE_ID} />

          {/* Phản hồi trực quan trạng thái mở/khóa cổng */}
          {currentResult && (
            <div data-i18n-managed
              key={currentResult.id}
              role={isGranted ? 'status' : 'alert'}
              data-testid="checkin-result-banner"
              className={`gate-result gate-result--${isGranted ? 'granted' : 'denied'}`}
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                <StatusMark type={isGranted ? 'success' : 'error'} size={64} />
              </div>

              {isGranted && currentResult.avatarUrl && (
                <LoadingImage src={currentResult.avatarUrl} alt={t(`Ảnh hội viên ${currentResult.memberName || ''}`, `Member photo ${currentResult.memberName || ''}`)}
                  referrerPolicy="no-referrer" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: '50%', marginBottom: 12 }} />
              )}

              <h3
                style={{
                  margin: '0 0 8px 0',
                  color: isGranted ? 'var(--portal-success)' : 'var(--portal-danger)',
                }}
              >
                {isGranted ? t('CỬA MỞ: XÁC THỰC HỢP LỆ') : t('CỬA KHÓA: TỪ CHỐI CHECK-IN')}
              </h3>

              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '4px', fontVariantNumeric: 'tabular-nums' }}>
                {currentResult.memberName || t('Mã QR không xác định')}{' '}
                {currentResult.memberId ? `(${t(`HV #${currentResult.memberId}`, `Member #${currentResult.memberId}`)})` : ''}
              </div>

              {isGranted && currentResult.packageName && <div>{t("Gói tập: ")}{currentResult.packageName}</div>}
              {isGranted && currentResult.remainingDays != null && (
                <div style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {t(`Còn ${currentResult.remainingDays} ngày`, `${currentResult.remainingDays} days left`)}
                </div>
              )}

              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {currentResult.gate || GATE} — {formatTime(currentResult.checkInTime)}
              </div>

              {(denialMessage || currentResult.denialReason) && (
                <div data-i18n-managed style={{ marginTop: '10px', color: 'var(--portal-danger)', fontWeight: 600, fontSize: '0.85rem' }}>
                  {denialMessage ? t(denialMessage) : currentResult.denialReason}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Nhật ký giữ nguyên giờ vào/ra Backend trả về cho 10 lượt gần nhất. */}
        <div className="portal-card">
          <div className="portal-card-header">
            <h2 className="portal-card-title">{t("Lượt check-in gần đây")}</h2>
          </div>

          {historyError && (
            <div data-i18n-managed
              className="portal-alert"
              role="alert"
              style={{ marginBottom: 16 }}
              data-testid="checkin-history-error"
            >
              <span>{t(historyError)}</span>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => void loadHistory()}
              >
                {t("Thử lại")}</button>
            </div>
          )}

          {loadingHistory ? (
            <div data-i18n-managed
              style={{ display: 'grid', gap: 10, padding: '8px 0' }}
              data-testid="checkin-history-loading"
              aria-busy="true"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <div data-i18n-managed key={n} className="portal-skeleton" style={{ height: 52, borderRadius: 8 }} />
              ))}
            </div>
          ) : historyError && visibleVisits.length === 0 ? null : visibleVisits.length === 0 ? (
            <div data-i18n-managed style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--color-text-muted)' }} data-testid="checkin-history-empty">
              {t('Chưa có lượt check-in nào được ghi nhận.')}
            </div>
          ) : (
            <div data-i18n-managed className="portal-table-wrapper">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>{t("Hội viên")}</th>
                    <th>{t("Giờ vào / ra")}</th>
                    <th>{t("Cổng")}</th>
                    <th>{t("Trạng thái")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleVisits.map((rec, i) => {
                    const ok = isCheckinGranted(rec.status);
                    const memberIdLabelVi = rec.memberId ? `HV #${rec.memberId}` : 'Chưa định danh';
                    const memberIdLabelEn = rec.memberId ? `Member #${rec.memberId}` : 'Unidentified';
                    return (
                      <tr data-i18n-managed key={rec.id} className="row-in" style={{ '--i': i } as React.CSSProperties}>
                        <td>
                          <div>{rec.memberName || t('Thẻ QR không xác định')}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                            {t(memberIdLabelVi, memberIdLabelEn)}
                          </div>
                        </td>
                        <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          <div>{t('Vào:', 'Entry:')} {formatTime(rec.checkInTime)}</div>
                          {rec.checkOutTime && (
                            <div data-i18n-managed style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                              {t('Ra:', 'Exit:')} {formatTime(rec.checkOutTime)}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>{rec.gate || t('Sảnh chính')}</td>
                        <td>
                          <span className={`badge ${ok ? 'badge-success' : 'badge-danger'}`}>
                            {ok ? t('Mở Cổng') : t('Từ Chối')}
                          </span>
                          {rec.denialReason && (
                            <div data-i18n-managed style={{ fontSize: '0.75rem', color: 'var(--portal-danger)', marginTop: 2 }}>
                              {rec.denialReason}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
