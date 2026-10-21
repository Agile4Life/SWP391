<<<<<<< Updated upstream
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

  if (!hasAccess) {
    return (
      <div className="portal-container" data-testid="checkin-forbidden-guard">
        <div className="portal-card">
          <div className="portal-state" style={{ padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '16px' }} role="img" aria-label="Forbidden">
              🚫
            </div>
            <h2 className="portal-state__title" style={{ fontSize: '1.5rem', marginBottom: '8px' }}>
              403 - Quyền truy cập bị từ chối
            </h2>
            <p style={{ color: '#7E7771', maxWidth: '480px', margin: '0 auto 20px auto' }}>
              Chỉ Lễ tân (Receptionist) và Quản lý trung tâm (Center Manager) mới có quyền vận hành cổng kiểm soát QR Check-in.
            </p>
            <a href="/portal" className="btn-secondary">
              Về trang chủ Portal
            </a>
          </div>
        </div>
      </div>
    );
  }

  const executeScan = async (codeToScan: string) => {
    const trimmed = codeToScan.trim();
    if (!trimmed) {
      toast('Vui lòng nhập hoặc quét mã QR thẻ hội viên.', 'error');
      return;
    }
    if (isScanning) return;

    setIsScanning(true);
    try {
      const res = await checkinApi.scan({
        qrCode: trimmed,
        gate: selectedGate,
      });
      setCurrentResult(res);
      setRecentCheckins((prev) => [res, ...prev.filter((item) => item.id !== res.id)]);
      setScanCode('');

      if (isCheckinGranted(res.status)) {
        toast(`Check-in hợp lệ: ${res.memberName || 'Hội viên'}`, 'success');
      } else {
        toast(res.denialReason || 'Từ chối mở cổng: Thẻ không hợp lệ hoặc đã hết hạn.', 'error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể xác thực mã QR lúc này.';
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
=======
import React, { useState, useEffect, useRef } from 'react';
import { StatusMark } from '../../shared/ui/StatusMark';
import { PageHeader } from '../../shared/ui/PageHeader';
import { toast } from '../../shared/ui/toast';
import { getCurrentUser } from '../../shared/api/client';
import { checkinApi, validateQrFormat, type CheckinDto } from './checkinApi';

export function StaffCheckInPage() {
  const currentUser = getCurrentUser();
  // BR-01: Chỉ RECEPTIONIST / CENTER_MANAGER (map thành STAFF / MANAGER trong UI session)
  const isAuthorized = currentUser?.role === 'STAFF' || currentUser?.role === 'MANAGER';

  const [scanCode, setScanCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<CheckinDto | null>(null);
  const [recentCheckins, setRecentCheckins] = useState<CheckinDto[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // BR-01: Ref để input luôn tự động focus cho máy quét barcode
  const inputRef = useRef<HTMLInputElement>(null);

  // BR-04: Lưu vết mã vừa quét gần nhất và thời gian để chống quét trùng liên tiếp (debounce 3s)
  const lastScanRef = useRef<{ code: string; timestamp: number } | null>(null);
  const DEBOUNCE_MS = 3000;

  // Tải lịch sử ban đầu và duy trì focus
  useEffect(() => {
    if (!isAuthorized) return;

    let isMounted = true;
    checkinApi
      .getHistory()
      .then((data) => {
        if (isMounted) {
          // BR-05: Giới hạn 10 lượt gần nhất
          setRecentCheckins(data.slice(0, 10));
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingHistory(false);
      });

    // Luôn focus vào ô quét khi vào trang
    inputRef.current?.focus();

    return () => {
      isMounted = false;
    };
  }, [isAuthorized]);

  // Đảm bảo input luôn giữ focus khi click trong khu vực quét
  const handleScannerClick = () => {
    inputRef.current?.focus();
  };

  const handleScanAction = async (codeToScan: string) => {
    const raw = codeToScan.trim();

    // BR-03: Chuỗi QR rỗng hoặc sai định dạng bị chặn ở FE
    const validation = validateQrFormat(raw);
    if (!validation.valid) {
      setValidationError(validation.error || 'Mã QR không đúng định dạng');
      toast(validation.error || 'Mã QR không đúng định dạng', 'error');
      inputRef.current?.focus();
      return;
    }

    // BR-04: Chống quét trùng liên tiếp (debounce) trong 3 giây
    const now = Date.now();
    if (
      lastScanRef.current &&
      lastScanRef.current.code.toLowerCase() === raw.toLowerCase() &&
      now - lastScanRef.current.timestamp < DEBOUNCE_MS
    ) {
      const waitSec = Math.ceil((DEBOUNCE_MS - (now - lastScanRef.current.timestamp)) / 1000);
      const msg = `Mã này vừa được quét. Vui lòng đợi ${waitSec} giây trước khi quét lại.`;
      setValidationError(msg);
      toast(msg, 'error');
      inputRef.current?.focus();
      return;
    }

    // Ghi nhận lượt quét hợp lệ để debounce
    lastScanRef.current = { code: raw, timestamp: now };
    setValidationError(null);
    setIsScanning(true);

    try {
      // BR-02 & BR-03: Gọi BE thực hiện xác thực, kể cả mã không tồn tại để BE ghi nhận DENIED
      const res = await checkinApi.scan(raw);
      setCurrentResult(res);
      setScanCode('');

      // BR-05: Cập nhật 10 lượt gần nhất tức thì, gồm cả GRANTED và DENIED
      setRecentCheckins((prev) => [res, ...prev.filter((item) => item.id !== res.id)].slice(0, 10));

      if (res.status === 'GRANTED') {
        toast(`Mở cổng: Xác thực thành công cho ${res.memberName || 'Hội viên'}`, 'success');
      } else {
        toast(`Cửa khóa: ${res.denialReason || 'Từ chối vào trung tâm'}`, 'error');
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi kết nối tới hệ thống cửa check-in';
      setValidationError(errorMsg);
      toast(errorMsg, 'error');
    } finally {
      setIsScanning(false);
      // BR-01: Tự động focus lại input ngay sau khi kết thúc quét
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
>>>>>>> Stashed changes
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
<<<<<<< Updated upstream
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
=======
    if (isScanning) return;
    handleScanAction(scanCode);
  };

  const formatTime = (timeStr?: string | null) => {
    if (!timeStr) return '--:--:--';
    try {
      const d = new Date(timeStr);
      return isNaN(d.getTime()) ? timeStr : d.toLocaleTimeString('vi-VN');
    } catch {
      return timeStr;
    }
  };

  // BR-01: Chặn người dùng không có vai trò phù hợp
  if (!isAuthorized) {
    return (
      <div className="portal-container">
        <PageHeader eyebrow="Lễ tân" title="Kiểm soát ra vào cổng" />
        <div className="portal-card" style={{ padding: '32px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <StatusMark type="error" size={56} />
          </div>
          <h2 style={{ color: '#B91C1C', marginBottom: '8px' }}>Truy cập bị từ chối (403 Forbidden)</h2>
          <p style={{ color: '#6A635D' }}>
            Chức năng quầy kiểm soát ra vào chỉ dành riêng cho tài khoản <strong>RECEPTIONIST</strong> hoặc{' '}
            <strong>CENTER_MANAGER</strong>. Vui lòng đăng nhập với tài khoản hợp lệ.
          </p>
        </div>
      </div>
    );
  }
>>>>>>> Stashed changes

  return (
    <div className="portal-container checkin-page">
      <PageHeader
<<<<<<< Updated upstream
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
=======
        eyebrow="Quầy Lễ Tân & An Ninh"
        title="Kiểm soát ra vào (Turnstile Check-in)"
        actions={
          <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#16A34A',
                display: 'inline-block',
              }}
            />
            Máy quét cổng sẵn sàng
          </span>
        }
      />

      <div className="grid-2">
        {/* Scanner Control Panel */}
        <div className="portal-card" onClick={handleScannerClick}>
>>>>>>> Stashed changes
          <div className="portal-card-header">
            <h2 className="portal-card-title">Mắt đọc mã QR cổng Turnstile</h2>
          </div>

<<<<<<< Updated upstream
          <form onSubmit={handleSubmit} style={{ marginBottom: '24px', display: 'grid', gap: '14px' }}>
            <div>
              <label className="portal-label" htmlFor="checkin-gate-select">
                Cổng kiểm soát (Turnstile Gate)
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
                Quét hoặc Nhập Chuỗi Mã QR:
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
=======
          <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
            <label className="portal-label" htmlFor="qr-scanner-input">
              Quét mã thẻ QR hoặc nhập chuỗi định danh:
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                id="qr-scanner-input"
                ref={inputRef}
                type="text"
                className="portal-input"
                placeholder="Đặt con trỏ tại đây hoặc quét mã thẻ..."
                value={scanCode}
                onChange={(e) => {
                  setScanCode(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                disabled={isScanning}
                autoComplete="off"
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '1rem',
                  letterSpacing: '0.05em',
                  boxShadow: '0 0 0 1px rgba(194, 166, 132, 0.4)',
                }}
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={isScanning || !scanCode.trim()}
                style={{ minWidth: '120px' }}
              >
                {isScanning ? 'Đang đọc...' : 'Xác thực'}
              </button>
>>>>>>> Stashed changes
            </div>
            {validationError && (
              <div style={{ marginTop: '8px', color: '#B91C1C', fontSize: '0.85rem', fontWeight: 500 }}>
                ⚠️ {validationError}
              </div>
            )}
            <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#8C847C' }}>
              * Ô nhập tự động bắt sự kiện <strong>Enter</strong> từ máy quét barcode chuyên dụng và luôn tự động lấy
              tiêu điểm (focus).
            </div>
          </form>

<<<<<<< Updated upstream
          {/* Visual Door Gate Feedback */}
          {currentResult && (
=======
          {/* Quick Simulation Buttons for QA / Demo */}
          <div
            style={{
              padding: '14px 16px',
              background: 'var(--color-bg-warm, #F7F5F0)',
              borderRadius: '4px',
              marginBottom: '24px',
              border: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <div className="meta-label" style={{ marginBottom: '8px', fontSize: '0.72rem', letterSpacing: '0.1em' }}>
              PHÍM MÔ PHỎNG THỬ NGHIỆM NHANH (GỌI API THỰC TẾ)
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => handleScanAction('QR-VALID')}
                disabled={isScanning}
              >
                ✓ Thẻ hợp lệ (QR-VALID)
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => handleScanAction('QR-EXPIRED')}
                disabled={isScanning}
                style={{ color: '#b91c1c' }}
              >
                ✕ Thẻ hết hạn (QR-EXPIRED)
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => handleScanAction('QR-NON-EXISTENT-999')}
                disabled={isScanning}
                style={{ color: '#b91c1c' }}
              >
                ✕ Mã không tồn tại (QR-NON-EXISTENT)
              </button>
            </div>
          </div>

          {/* BR-02: Visual Door Gate Feedback (Xanh = GRANTED, Đỏ = DENIED) */}
          {currentResult ? (
>>>>>>> Stashed changes
            <div
              key={currentResult.id}
              role="status"
              data-testid="checkin-result-banner"
              className={`gate-result gate-result--${isGranted ? 'granted' : 'denied'}`}
              style={{
                borderRadius: '6px',
                padding: '24px',
                textAlign: 'center',
<<<<<<< Updated upstream
                backgroundColor: isGranted ? '#F0FDF4' : '#FEF2F2',
                border: `2px solid ${isGranted ? '#86EFAC' : '#FCA5A5'}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                <StatusMark type={isGranted ? 'success' : 'error'} size={64} />
=======
                backgroundColor: currentResult.status === 'GRANTED' ? '#F0FDF4' : '#FEF2F2',
                border: `2px solid ${currentResult.status === 'GRANTED' ? '#86EFAC' : '#FCA5A5'}`,
                boxShadow:
                  currentResult.status === 'GRANTED'
                    ? '0 10px 25px rgba(34, 197, 94, 0.12)'
                    : '0 10px 25px rgba(239, 68, 68, 0.12)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                <StatusMark type={currentResult.status === 'GRANTED' ? 'success' : 'error'} size={60} />
>>>>>>> Stashed changes
              </div>

              <h3
                style={{
<<<<<<< Updated upstream
                  margin: '0 0 8px 0',
                  color: isGranted ? '#15803D' : '#B91C1C',
                }}
              >
                {isGranted ? 'CỬA MỞ: XÁC THỰC HỢP LỆ' : 'CỬA KHÓA: TỪ CHỐI CHECK-IN'}
              </h3>

              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1A1614', marginBottom: '4px' }}>
                {currentResult.memberName || 'Mã QR không xác định'} {currentResult.memberId ? `(HV #${currentResult.memberId})` : ''}
              </div>

              <div style={{ fontSize: '0.82rem', color: '#6A635D' }}>
                {currentResult.gate || selectedGate} — {formatTime(currentResult.checkInTime)}
              </div>

              {currentResult.denialReason && (
                <div style={{ marginTop: '10px', color: '#B91C1C', fontWeight: 600, fontSize: '0.85rem' }}>
                  ⚠️ {currentResult.denialReason}
=======
                  margin: '0 0 12px 0',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: currentResult.status === 'GRANTED' ? '#15803D' : '#B91C1C',
                  letterSpacing: '0.04em',
                }}
              >
                {currentResult.status === 'GRANTED'
                  ? 'CỬA MỞ: XÁC THỰC HỢP LỆ (GRANTED)'
                  : 'CỬA KHÓA: TỪ CHỐI CHECK-IN (DENIED)'}
              </h3>

              {/* Thông tin thẻ hội viên */}
              {currentResult.status === 'GRANTED' ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    justifyContent: 'center',
                    background: '#FFFFFF',
                    padding: '16px 20px',
                    borderRadius: '6px',
                    border: '1px solid #DCFCE7',
                    maxWidth: '440px',
                    margin: '0 auto',
                  }}
                >
                  {/* Ảnh đại diện */}
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      background: '#DCFCE7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.2rem',
                      fontWeight: 700,
                      color: '#15803D',
                      flexShrink: 0,
                      border: '2px solid #86EFAC',
                    }}
                  >
                    {currentResult.avatarUrl ? (
                      <img
                        src={currentResult.avatarUrl}
                        alt={currentResult.memberName || 'Member Avatar'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      (currentResult.memberName || 'HV').slice(0, 2).toUpperCase()
                    )}
                  </div>

                  {/* Chi tiết tên, mã, loại gói, số ngày còn hạn */}
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1A1614' }}>
                      {currentResult.memberName || 'Hội viên'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#6A635D', fontFamily: 'monospace' }}>
                      Mã HV: {currentResult.memberCode || `MB-2026-${String(currentResult.memberId || 0).padStart(3, '0')}`}
                    </div>
                    <div style={{ fontSize: '0.84rem', color: '#2B2420', marginTop: '2px', fontWeight: 600 }}>
                      Gói: {currentResult.packageName || 'Gói thành viên'}
                    </div>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: currentResult.remainingDays != null && currentResult.remainingDays <= 7 ? '#D97706' : '#15803D',
                        marginTop: '2px',
                      }}
                    >
                      {currentResult.remainingDays != null
                        ? currentResult.remainingDays > 0
                          ? `⏱ Còn ${currentResult.remainingDays} ngày hiệu lực`
                          : '⏱ Hết hạn hôm nay'
                        : '✓ Đang hoạt động'}
                    </div>
                  </div>
                </div>
              ) : (
                /* Thẻ đỏ DENIED kèm lý do chi tiết */
                <div
                  style={{
                    background: '#FFFFFF',
                    padding: '16px 20px',
                    borderRadius: '6px',
                    border: '1px solid #FEE2E2',
                    maxWidth: '440px',
                    margin: '0 auto',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ color: '#B91C1C', fontWeight: 700, fontSize: '0.95rem', marginBottom: '6px' }}>
                    ⚠️ Lý do từ chối: {currentResult.denialReason || 'Mã không tồn tại hoặc gói tập không hợp lệ'}
                  </div>
                  {currentResult.memberName && (
                    <div style={{ fontSize: '0.85rem', color: '#4B4540' }}>
                      Hội viên: <strong>{currentResult.memberName}</strong> ({currentResult.memberCode || `ID #${currentResult.memberId}`})
                    </div>
                  )}
                  {currentResult.packageName && (
                    <div style={{ fontSize: '0.82rem', color: '#6A635D', marginTop: '2px' }}>
                      Gói dịch vụ: {currentResult.packageName}
                    </div>
                  )}
                  <div style={{ fontSize: '0.78rem', color: '#8C847C', marginTop: '8px', fontStyle: 'italic' }}>
                    Yêu cầu hội viên xuất trình giấy tờ tùy thân hoặc chuyển hướng sang quầy Lễ tân xử lý.
                  </div>
>>>>>>> Stashed changes
                </div>
              )}

              <div style={{ marginTop: '14px', fontSize: '0.78rem', color: '#6A635D' }}>
                Cổng: <strong>{currentResult.gate || 'Turnstile A1'}</strong> · Thời gian:{' '}
                <strong>{formatTime(currentResult.checkInTime)}</strong>
              </div>
            </div>
          ) : (
            <div
              style={{
                border: '2px dashed #D6CEBE',
                borderRadius: '6px',
                padding: '36px 20px',
                textAlign: 'center',
                color: '#8C847C',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🚪</div>
              <div style={{ fontWeight: 600, color: '#4B4540' }}>Chưa có lượt quét gần nhất</div>
              <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                Quét mã QR từ ứng dụng hội viên để xem trạng thái mở cổng tại đây
              </div>
            </div>
          )}
        </div>

<<<<<<< Updated upstream
        {/* Keep open visits separate from the latest ten audit entries. */}
        <div className="portal-card">
          <div className="portal-card-header">
            <h2 className="portal-card-title">Theo dõi ra vào hôm nay</h2>
          </div>

          <div className="portal-tabs" aria-label="Danh sách ra vào">
            <button type="button" className={`portal-tab ${historyView === 'inside' ? 'active' : ''}`}
              aria-pressed={historyView === 'inside'} onClick={() => setHistoryView('inside')}>
              Đang trong trung tâm ({openVisits.length})
            </button>
            <button type="button" className={`portal-tab ${historyView === 'recent' ? 'active' : ''}`}
              aria-pressed={historyView === 'recent'} onClick={() => setHistoryView('recent')}>
              10 lượt gần nhất
            </button>
=======
        {/* BR-05: Live Stream Table 10 lượt gần nhất */}
        <div className="portal-card">
          <div className="portal-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="portal-card-title">Nhật ký 10 lượt ra vào gần nhất</h2>
            <span style={{ fontSize: '0.78rem', color: '#8C847C' }}>Tự động cập nhật sau mỗi lượt quét</span>
          </div>

          <div className="portal-table-wrapper">
            <table className="portal-table">
              <thead>
                <tr>
                  <th style={{ width: '85px' }}>Thời gian</th>
                  <th>Hội viên</th>
                  <th>Gói dịch vụ</th>
                  <th style={{ width: '100px' }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingHistory ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: '#8C847C' }}>
                      Đang tải lịch sử check-in hôm nay...
                    </td>
                  </tr>
                ) : recentCheckins.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: '#8C847C' }}>
                      Chưa ghi nhận lượt ra vào nào hôm nay.
                    </td>
                  </tr>
                ) : (
                  recentCheckins.map((rec, i) => (
                    <tr key={`${rec.id}-${i}`} className="row-in" style={{ '--i': i } as React.CSSProperties}>
                      <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>{formatTime(rec.checkInTime)}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#1A1614' }}>
                          {rec.memberName || (rec.memberId ? `Hội viên #${rec.memberId}` : 'Khách vãng lai / Mã lạ')}
                        </div>
                        {rec.memberCode && (
                          <div style={{ fontSize: '0.72rem', color: '#8C847C', fontFamily: 'monospace' }}>
                            {rec.memberCode}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: '#4B4540' }}>
                        {rec.packageName || '--'}
                      </td>
                      <td>
                        <span
                          className={`badge ${rec.status === 'GRANTED' ? 'badge-success' : 'badge-danger'}`}
                          title={rec.denialReason || undefined}
                          style={{ cursor: rec.denialReason ? 'help' : 'default' }}
                        >
                          {rec.status === 'GRANTED' ? '✓ Mở Cổng' : '✕ Từ Chối'}
                        </span>
                        {rec.denialReason && (
                          <div
                            style={{
                              fontSize: '0.7rem',
                              color: '#B91C1C',
                              marginTop: '2px',
                              maxWidth: '160px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={rec.denialReason}
                          >
                            {rec.denialReason}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
>>>>>>> Stashed changes
          </div>

          {historyError && (
            <div
              style={{
                marginBottom: 16,
                padding: '12px 16px',
                backgroundColor: '#FDF2F2',
                border: '1px solid #F8B4B4',
                borderRadius: 6,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
              data-testid="checkin-history-error"
            >
              <span style={{ color: '#9B1C1C', fontSize: '0.88rem' }}>{historyError}</span>
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
            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#7E7771' }} data-testid="checkin-history-empty">
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
                            <span style={{ fontSize: '0.78rem', color: '#6A635D' }}>Đã ra về</span>
                          ) : '—'}
                        </td>
                        <td>
                          <div>{rec.memberName || 'Thẻ QR không xác định'}</div>
                          <div style={{ fontSize: '0.72rem', color: '#8C847C' }}>
                            {rec.memberId ? `HV #${rec.memberId}` : 'Chưa định danh'}
                          </div>
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          <div>Vào: {formatTime(rec.checkInTime)}</div>
                          {rec.checkOutTime && (
                            <div style={{ fontSize: '0.75rem', color: '#6A635D' }}>
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
                            <div style={{ fontSize: '0.72rem', color: '#B91C1C', marginTop: 2 }}>
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
