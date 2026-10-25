import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentUser } from '../../shared/api/client';
import { StatusMark } from '../../shared/ui/StatusMark';
import { PageHeader } from '../../shared/ui/PageHeader';
import { Select } from '../../shared/ui/Select';
import { toast } from '../../shared/ui/toast';
import { checkinApi, type CheckinDto } from './checkinApi';
import './staff-check-in.css';

const formatTime = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const isCheckinGranted = (status?: string | null): boolean => {
  if (!status) return false;
  const normalized = status.trim().toUpperCase();
  return normalized === 'GRANTED' || normalized === 'SUCCESS';
};

export function StaffCheckInPage() {
  const currentUser = getCurrentUser();

  // BR-01: Chỉ RECEPTIONIST / STAFF và CENTER_MANAGER / MANAGER được truy cập
  const hasAccess = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'MANAGER' || currentUser.role === 'STAFF';
  }, [currentUser]);

  const [scanCode, setScanCode] = useState('');
  const [selectedGate, setSelectedGate] = useState('Turnstile A1 - Sảnh Chính');
  const [isScanning, setIsScanning] = useState(false);
  const [checkingOutId, setCheckingOutId] = useState<number | null>(null);
  const checkoutBusy = useRef(false);
  const [historyView, setHistoryView] = useState<'inside' | 'recent'>('inside');

  const [currentResult, setCurrentResult] = useState<CheckinDto | null>(null);
  const [recentCheckins, setRecentCheckins] = useState<CheckinDto[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const list = await checkinApi.getHistory();
      setRecentCheckins(list);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải lịch sử ra vào cổng.';
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

  const executeScan = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setIsScanning(true);
    try {
      const res = await checkinApi.scan({ qrCode: trimmed, gate: selectedGate });
      setCurrentResult(res);
      setScanCode('');
      setRecentCheckins((prev) => [res, ...prev.filter((item) => item.id !== res.id)]);
      if (isCheckinGranted(res.status)) {
        toast(`Mở cổng: Xác thực thành công cho ${res.memberName || 'Hội viên'}`, 'success');
      } else {
        toast(`Cửa khóa: ${res.denialReason || 'Từ chối vào trung tâm'}`, 'error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối tới hệ thống cửa check-in';
      const deniedRecord: CheckinDto = {
        id: Date.now(),
        memberId: 0,
        memberName: trimmed,
        checkInTime: new Date().toISOString(),
        checkOutTime: null,
        method: 'qr_code',
        gate: selectedGate,
        status: 'DENIED',
        denialReason: msg,
      };
      setCurrentResult(deniedRecord);
      toast(msg, 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void executeScan(scanCode);
  };

  const handleCheckout = async (checkinId: number) => {
    if (checkoutBusy.current) return;
    checkoutBusy.current = true;
    setCheckingOutId(checkinId);
    try {
      const updated = await checkinApi.checkout(checkinId);
      setRecentCheckins((prev) => prev.map((item) => (item.id === checkinId ? updated : item)));
      if (currentResult?.id === checkinId) {
        setCurrentResult(updated);
      }
      toast('Đã ghi nhận hội viên checkout thành công!', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Checkout thất bại.';
      toast(msg, 'error');
    } finally {
      checkoutBusy.current = false;
      setCheckingOutId(null);
    }
  };

  const isGranted = isCheckinGranted(currentResult?.status);
  const openVisits = recentCheckins.filter((record) => isCheckinGranted(record.status) && !record.checkOutTime);
  const visibleVisits = historyView === 'inside' ? openVisits : recentCheckins.slice(0, 10);

  if (!hasAccess) {
    return (
      <div className="portal-container">
        <PageHeader eyebrow="Lễ tân" title="Kiểm soát ra vào cổng" />
        <div className="portal-card" style={{ padding: '32px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <StatusMark type="error" size={56} />
          </div>
          <h2 style={{ color: '#B91C1C', marginBottom: '8px' }}>Truy cập bị từ chối (403 Forbidden)</h2>
          <p style={{ color: '#6A635D' }}>
            Chức năng quầy kiểm soát ra vào chỉ dành riêng cho tài khoản <strong>STAFF</strong> hoặc{' '}
            <strong>MANAGER</strong>. Vui lòng đăng nhập với tài khoản hợp lệ.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-container checkin-page">
      <PageHeader
        eyebrow="Lễ tân &amp; Kiểm soát sảnh"
        title="Check-in & Checkout tại cổng"
        actions={
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void loadHistory()}
            disabled={loadingHistory}
          >
            Làm mới nhật ký
          </button>
        }
      />

      <div className="checkin-layout">
        {/* Scanner Panel */}
        <div className="portal-card">
          <div className="portal-card-header">
            <h2 className="portal-card-title">Mắt đọc mã QR cổng Turnstile</h2>
          </div>

          <form onSubmit={handleSubmit} style={{ marginBottom: '24px', display: 'grid', gap: '14px' }}>
            <div>
              <label className="portal-label" htmlFor="checkin-gate-select">
                Cổng kiểm soát
              </label>
              <Select
                id="checkin-gate-select"
                className="portal-select"
                value={selectedGate}
                onChange={(e) => setSelectedGate(e.target.value)}
                disabled={isScanning}
              >
                <option value="Turnstile A1 - Sảnh Chính">Turnstile A1 - Sảnh Chính</option>
                <option value="Turnstile A2 - Sảnh Chính">Turnstile A2 - Sảnh Chính</option>
                <option value="Turnstile B1 - Tầng Mezzanine">Turnstile B1 - Tầng Mezzanine</option>
              </Select>
            </div>

            <div>
              <label className="portal-label" htmlFor="checkin-qr-input">
                Mã QR hội viên
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  id="checkin-qr-input"
                  type="text"
                  className="portal-input"
                  placeholder="Nhập mã QR thẻ hội viên (ví dụ: SUB-10-ABCD1234)..."
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value)}
                  disabled={isScanning}
                  autoFocus
                />
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isScanning || !scanCode.trim()}
                  data-testid="scan-submit-button"
                >
                  {isScanning ? 'Đang quét...' : 'Check-in'}
                </button>
              </div>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#8C847C' }}>
              * Ô nhập tự động bắt sự kiện <strong>Enter</strong> từ máy quét barcode chuyên dụng.
            </div>
          </form>

          {/* Quick Simulation Buttons for QA / Demo */}
          <div
            style={{
              padding: '12px 14px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '6px',
              marginBottom: '20px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div className="meta-label" style={{ marginBottom: '8px', fontSize: '0.72rem', letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>
              PHÍM MÔ PHỎNG THỬ NGHIỆM NHANH
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => void executeScan('QR-VALID')}
                disabled={isScanning}
              >
                ✓ Thẻ hợp lệ (QR-VALID)
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => void executeScan('QR-EXPIRED')}
                disabled={isScanning}
                style={{ color: '#fca5a5' }}
              >
                ✕ Thẻ hết hạn (QR-EXPIRED)
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => void executeScan('QR-NON-EXISTENT-999')}
                disabled={isScanning}
                style={{ color: '#fca5a5' }}
              >
                ✕ Không tồn tại
              </button>
            </div>
          </div>

          {/* Visual Door Gate Feedback */}
          {currentResult ? (
            <div
              key={currentResult.id}
              role="status"
              data-testid="checkin-result-banner"
              className={`gate-result gate-result--${isGranted ? 'granted' : 'denied'}`}
              style={{
                borderRadius: '6px',
                padding: '24px',
                textAlign: 'center',
                backgroundColor: isGranted ? '#20372b' : '#3d2828',
                border: `2px solid ${isGranted ? '#86EFAC' : '#FCA5A5'}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                <StatusMark type={isGranted ? 'success' : 'error'} size={60} />
              </div>

              <h3
                style={{
                  margin: '0 0 8px 0',
                  color: isGranted ? '#86efac' : '#fca5a5',
                  fontSize: '1.2rem',
                }}
              >
                {isGranted ? 'CỬA MỞ: XÁC THỰC HỢP LỆ' : 'CỬA KHÓA: TỪ CHỐI CHECK-IN'}
              </h3>

              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '4px' }}>
                {currentResult.memberName || 'Mã QR không xác định'} {currentResult.memberId ? `(HV #${currentResult.memberId})` : ''}
              </div>

              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                {currentResult.gate || selectedGate} — {formatTime(currentResult.checkInTime)}
              </div>

              {currentResult.denialReason && (
                <div style={{ marginTop: '10px', color: '#fca5a5', fontWeight: 600, fontSize: '0.85rem' }}>
                  ⚠️ {currentResult.denialReason}
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                border: '2px dashed rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                padding: '36px 20px',
                textAlign: 'center',
                color: 'var(--color-text-muted)',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🚪</div>
              <div style={{ fontWeight: 600 }}>Chưa có lượt quét gần nhất</div>
              <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                Quét mã QR từ ứng dụng hội viên để xem trạng thái mở cổng tại đây
              </div>
            </div>
          )}
        </div>

        {/* Keep open visits separate from the latest ten audit entries */}
        <div className="portal-card">
          <div className="portal-card-header">
            <h2 className="portal-card-title">Theo dõi ra vào hôm nay</h2>
          </div>

          <div className="portal-tabs" aria-label="Danh sách ra vào" style={{ marginBottom: '16px' }}>
            <button
              type="button"
              className={`portal-tab ${historyView === 'inside' ? 'active' : ''}`}
              aria-pressed={historyView === 'inside'}
              onClick={() => setHistoryView('inside')}
            >
              Đang trong trung tâm ({openVisits.length})
            </button>
            <button
              type="button"
              className={`portal-tab ${historyView === 'recent' ? 'active' : ''}`}
              aria-pressed={historyView === 'recent'}
              onClick={() => setHistoryView('recent')}
            >
              10 lượt gần nhất
            </button>
          </div>

          {historyError && (
            <div
              style={{
                marginBottom: 16,
                padding: '12px 16px',
                backgroundColor: '#3d2828',
                border: '1px solid #F8B4B4',
                borderRadius: 6,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
              data-testid="checkin-history-error"
            >
              <span style={{ color: '#fca5a5', fontSize: '0.88rem' }}>{historyError}</span>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => void loadHistory()}
              >
                Thử lại
              </button>
            </div>
          )}

          {loadingHistory ? (
            <div
              style={{ display: 'grid', gap: 10, padding: '8px 0' }}
              data-testid="checkin-history-loading"
              aria-busy="true"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="portal-skeleton" style={{ height: 52, borderRadius: 8 }} />
              ))}
            </div>
          ) : visibleVisits.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--color-text-muted)' }} data-testid="checkin-history-empty">
              {historyView === 'inside'
                ? 'Không có hội viên đang trong trung tâm từ các lượt vào hôm nay. Chọn “10 lượt gần nhất” để xem nhật ký.'
                : 'Chưa có lượt check-in nào được ghi nhận.'}
            </div>
          ) : (
            <div className="portal-table-wrapper">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th className="checkin-actions">Ra về</th>
                    <th>Hội viên</th>
                    <th>Giờ vào / ra</th>
                    <th>Cổng</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleVisits.map((rec, i) => {
                    const ok = isCheckinGranted(rec.status);
                    return (
                      <tr key={rec.id} className="row-in" style={{ '--i': i } as React.CSSProperties}>
                        <td className="checkin-actions">
                          {ok && !rec.checkOutTime ? (
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              aria-label={`Checkout / Ra về: ${rec.memberName || `HV #${rec.memberId}`}`}
                              disabled={checkingOutId !== null}
                              onClick={() => void handleCheckout(rec.id)}
                            >
                              {checkingOutId === rec.id ? 'Đang ghi nhận...' : 'Checkout / Ra về'}
                            </button>
                          ) : rec.checkOutTime ? (
                            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Đã ra về</span>
                          ) : '—'}
                        </td>
                        <td>
                          <div>{rec.memberName || 'Thẻ QR không xác định'}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                            {rec.memberId ? `HV #${rec.memberId}` : 'Chưa định danh'}
                          </div>
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          <div>Vào: {formatTime(rec.checkInTime)}</div>
                          {rec.checkOutTime && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                              Ra: {formatTime(rec.checkOutTime)}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>{rec.gate || 'Sảnh chính'}</td>
                        <td>
                          <span className={`badge ${ok ? 'badge-success' : 'badge-danger'}`}>
                            {ok ? 'Mở Cổng' : 'Từ Chối'}
                          </span>
                          {rec.denialReason && (
                            <div style={{ fontSize: '0.72rem', color: '#fca5a5', marginTop: 2 }}>
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
