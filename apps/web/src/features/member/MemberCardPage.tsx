import { DaysLeft } from './DaysLeft';
import { EmptyState } from '../../shared/ui/EmptyState';
import { memberText, memberMessage, memberRenderMessage } from './memberI18n';
import type { SourceMessage } from '../../shared/i18n/language';
import { useLanguage } from '../../shared/i18n/language';
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

import { Link } from 'react-router-dom';
import { getProfile, type Profile } from './profileApi';
import { PageHeader } from '../../shared/ui/PageHeader';
import { notify } from '../../shared/lib/portalNotices';
import { cardStatus } from './cardStatus';
import { centerNowParts } from '../../shared/lib/centerTime';
import { getMembershipHistory, getMySubscription, getDynamicQr, type CardSubscription } from './memberCardApi';

/** Định dạng ngày YYYY-MM-DD thành dd/MM/yyyy (không hợp lệ thì "—"). */
function displayDate(value: string) {
  if (!validDate(value)) return '—';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

/** Kiểm tra chuỗi ngày YYYY-MM-DD hợp lệ. */
function validDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Thẻ hội viên: ảnh, họ tên, mã thẻ, gói, hạn dùng và mã QR động tự đổi; có nút tải thẻ thành ảnh. */
export function MemberCard({ profile, subscription }: { profile: Profile; subscription: CardSubscription }) {
  useLanguage();
  const cardRef = useRef<HTMLDivElement>(null);
  const [qrImage, setQrImage] = useState('');
  const [qrLoaded, setQrLoaded] = useState(false);
  const [qrError, setQrError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dynamicQr, setDynamicQr] = useState<string | null>(null);
  const paidThroughDate = subscription.paidThroughDate ?? subscription.endDate;
  const status = cardStatus(subscription.status, paidThroughDate);
  const periodStatus = cardStatus(subscription.status, subscription.endDate);
  const localToday = centerNowParts().date;
  const canShowQr =
    validDate(subscription.startDate) &&
    subscription.startDate <= localToday &&
    validDate(subscription.endDate) &&
    (periodStatus === 'active' || periodStatus === 'warning') &&
    (status === 'active' || status === 'warning') &&
    Boolean(subscription.qrCode?.trim());
  const border = status === 'warning' ? '#D6A638' : status === 'active' ? '#ce9180' : '#A45A53';

  // Lấy mã QR động theo chu kỳ
  useEffect(() => {
    if (!canShowQr || typeof getDynamicQr !== 'function') return;

    let mounted = true;

    // Lấy mã QR động mới.
    async function fetchDynamic() {
      try {
        const res = await getDynamicQr();
        if (mounted && res?.qrCode) {
          setDynamicQr(res.qrCode);
        }
      } catch {
        // Giữ lại mã luân phiên gần nhất; mã tĩnh không còn được chấp nhận tại cổng.
      }
    }

    void fetchDynamic();
    const intervalId = setInterval(() => {
      void fetchDynamic();
    }, 30000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [canShowQr]);

  // Chỉ mã ký số luân phiên mới hợp lệ tại cổng; mã định danh tĩnh không bao giờ hiển thị dạng QR để quét.
  const activeQrCode = dynamicQr;

  useEffect(() => {
    let cancelled = false;
    setQrImage('');
    setQrLoaded(false);
    setQrError(false);
    if (!canShowQr || !activeQrCode) return;
    QRCode.toDataURL(activeQrCode, { width: 240, margin: 2 })
      .then((image) => { if (!cancelled) { setQrImage(image); setQrError(false); } })
      .catch(() => { if (!cancelled) setQrError(true); });
    return () => { cancelled = true; };
  }, [canShowQr, activeQrCode]);

  // Tải thẻ thành ảnh PNG bằng html2canvas khi QR đã sẵn sàng.
  async function downloadCard() {
    if (!cardRef.current || !canShowQr || !qrImage || !qrLoaded || qrError || downloading) return;
    setDownloading(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cardRef.current, { backgroundColor: '#202020', scale: 2 });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = 'the-hoi-vien.png';
      link.click();
      notify(memberText("Đã tải thẻ hội viên về máy."), 'success', { translation: memberMessage("Đã tải thẻ hội viên về máy.") });
    } catch {
      notify(memberText("Không thể tải thẻ. Vui lòng thử lại."), 'error', { translation: memberMessage("Không thể tải thẻ. Vui lòng thử lại.") });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <div ref={cardRef} className="pass-card" style={{ background: '#202020', color: '#faf9f6', border: `2px solid ${border}`, borderRadius: 16, padding: 32, maxWidth: 760 }}>
        <div style={{ color: '#ce9180', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 24 }}>SÖL FITNESS</div>
        <p style={{ fontSize: '0.75rem', letterSpacing: '0.16em', color: '#bcb8b5', marginTop: 4 }}>{memberText("THẺ HỘI VIÊN ĐIỆN TỬ")}</p>
        <h2 style={{ margin: '14px 0 8px' }}>{profile.fullName}</h2>
        <p style={{ color: border, fontWeight: 700, margin: '0 0 4px' }}>
          {status === 'warning'
            ? memberText("Gói tập sắp hết hạn")
            : status === 'expired'
              ? memberText("Gói tập đã hết hạn")
              : status === 'active'
                ? memberText("Gói tập đang hoạt động")
                : memberText("Gói tập chưa hoạt động")}
        </p>
        <div className="pass-card__body">
          <dl className="pass-card__rows">
            <div><dt>{memberText("Mã hội viên")}</dt><dd>{profile.membershipCode || memberText("Chưa có mã hội viên")}</dd></div>
            <div><dt>{memberText("Gói tập")}</dt><dd>{subscription.packageName}</dd></div>
            <div><dt>{memberText("Bắt đầu")}</dt><dd>{displayDate(subscription.startDate)}</dd></div>
            <div><dt>{memberText("Hết hạn")}</dt><dd className="pass-card__expiry">{displayDate(paidThroughDate)} <DaysLeft endDate={paidThroughDate} /></dd></div>
          </dl>
          {canShowQr && qrImage && !qrError && (
            <div className="pass-card__qr">
              <img
                src={qrImage}
                alt={memberText("Mã QR check-in của hội viên")}
                width={180}
                height={180}
                style={{ background: 'white', padding: 8, borderRadius: 8 }}
                onLoad={() => setQrLoaded(true)}
                onError={() => {
                  setQrLoaded(false);
                  setQrError(true);
                }}
              />
              {dynamicQr ? (
                <>
                  <span className="pass-card__qr-live"><i />{memberText("Mã QR bảo mật", "Secure QR code")}</span>
                  <span className="pass-card__qr-note">{memberText("Mã tự đổi mỗi 60 giây. Mở thẻ này khi đến quầy.", "The code refreshes every 60 seconds. Open this card at the desk.")}</span>
                </>
              ) : (
                <span className="pass-card__qr-note">{memberText("Mã QR định danh: ")}<strong>{subscription.qrCode}</strong></span>
              )}
            </div>
          )}
          {canShowQr && !qrImage && !qrError && (
            <div className="portal-skeleton" style={{ width: 180, height: 180 }}>
              <span className="sr-only">{memberText("Đang tạo ảnh QR…")}</span>
            </div>
          )}
        </div>
        {qrError && <p role="alert">{memberText("Không thể hiển thị mã QR. Vui lòng tải lại trang.")}</p>}
        {!canShowQr && <p>{memberText("Chưa có mã QR hợp lệ để check-in. Vui lòng kiểm tra gói tập.")}</p>}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
        <button
          type="button"
          className="btn-primary"
          onClick={downloadCard}
          disabled={!canShowQr || !qrImage || !qrLoaded || qrError || downloading}
        >
          {downloading ? memberText("Đang tải…") : memberText("Tải thẻ về máy")}
        </button>
        {canShowQr && activeQrCode && (
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              try {
                if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
                await navigator.clipboard.writeText(activeQrCode!);
                notify(memberText("Đã sao chép mã QR check-in vào bộ nhớ tạm!"), 'success', { translation: memberMessage("Đã sao chép mã QR check-in vào bộ nhớ tạm!") });
              } catch {
                notify(memberText("Không thể sao chép mã QR. Vui lòng thử lại."), 'error', { translation: memberMessage("Không thể sao chép mã QR. Vui lòng thử lại.") });
              }
            }}
          >
            {dynamicQr ? memberText("Sao chép mã QR động", "Copy dynamic QR") : memberText("Sao chép mã QR Check-in")}
          </button>
        )}
      </div>
    </>
  );
}

/** Trang thẻ hội viên: tải hồ sơ và gói hiện tại rồi hiển thị thẻ, kèm lịch sử các kỳ gói. */
export function MemberCardPage() {
  useLanguage();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<CardSubscription | null>(null);
  const [history, setHistory] = useState<CardSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | SourceMessage>('');

  // Tải hồ sơ, gói hiện tại và lịch sử (silent thì không hiện trạng thái tải).
  async function loadCard(silent = false) {
    if (!silent) {
      setLoading(true);
      setError('');
      setHistory([]);
    }
    try {
      const [memberProfile, memberSubscription] = await Promise.all([getProfile(), getMySubscription()]);
      const memberHistory = memberSubscription ? [] : await getMembershipHistory();
      setProfile(memberProfile);
      setSubscription(memberSubscription);
      setHistory(memberHistory);
      if (silent) setError('');
    } catch {
      if (!silent) {
        setError(memberMessage("Không thể tải thông tin thẻ hội viên. Vui lòng thử lại."));
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void loadCard();
    // Làm mới ngầm khi tab đang hiển thị.
    const syncCard = () => {
      if (document.visibilityState === 'hidden') return;
      void loadCard(true);
    };
    window.addEventListener('focus', syncCard);
    window.addEventListener('online', syncCard);
    document.addEventListener('visibilitychange', syncCard);
    return () => {
      window.removeEventListener('focus', syncCard);
      window.removeEventListener('online', syncCard);
      document.removeEventListener('visibilitychange', syncCard);
    };
  }, []);

  const frozen = history.find((item) => item.status === 'frozen');
  const expired = history
    .filter((item) => validDate(item.startDate) && validDate(item.endDate) &&
      (item.status === 'expired' || (item.status === 'active' && cardStatus(item.status, item.endDate) === 'expired')))
    .sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  const latestPending = history.find((item) => item.status === 'pending_payment');
  const pending = latestPending && (!expired || latestPending.createdAt > expired.createdAt) ? latestPending : null;

  return (
    <div data-i18n-managed className="portal-container">
      <PageHeader title={memberText("Thẻ thành viên & Mã QR")} />
      {loading && (
        <div className="portal-card" role="status" aria-busy="true" style={{ maxWidth: 620 }}>
          <span className="sr-only">{memberText("Đang tải thẻ hội viên…")}</span>
          <div className="portal-skeleton-line" style={{ width: '48%', height: 18, marginBottom: 12 }} />
          <div className="portal-skeleton-line" style={{ width: '32%', height: 12, marginBottom: 20 }} />
          <div className="portal-skeleton-line" style={{ width: '60%', height: 24, marginBottom: 14 }} />
          <div className="portal-skeleton-line" style={{ width: '45%', height: 14, marginBottom: 8 }} />
          <div className="portal-skeleton-line" style={{ width: '52%', height: 14, marginBottom: 8 }} />
          <div className="portal-skeleton-line" style={{ width: '40%', height: 14, marginBottom: 20 }} />
          <div className="portal-skeleton" style={{ width: 180, height: 180 }} />
        </div>
      )}
      {error && (
        <div className="portal-card" role="alert">
          <p>{memberRenderMessage(error)}</p>
          <button type="button" className="btn-secondary" onClick={() => void loadCard()}>{memberText("Thử lại")}</button>
        </div>
      )}
      {!loading && !error && !subscription && frozen && (
        <EmptyState
          icon="card"
          title={memberText(
            `Gói tập đang tạm bảo lưu: ${frozen.packageName}`,
            `Membership is paused: ${frozen.packageName}`,
          )}
          description={
            validDate(frozen.endDate)
              ? memberText(
                  `Thời hạn gói hiện đến ${displayDate(frozen.endDate)}. Mã QR check-in tạm khóa trong thời gian bảo lưu — bạn có thể mở lại gói tập bất cứ lúc nào.`,
                  `Current period runs through ${displayDate(frozen.endDate)}. Your check-in QR code is paused during the hold — you can resume your membership anytime.`,
                )
              : memberText(
                  'Mã QR check-in tạm khóa trong thời gian bảo lưu — bạn có thể mở lại gói tập bất cứ lúc nào.',
                  'Your check-in QR code is paused during the hold — you can resume your membership anytime.',
                )
          }
          actions={
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link className="btn-primary" to="/member/packages">
                {memberText('Quản lý / Mở lại gói tập', 'Manage / Resume membership')}
              </Link>
              <Link className="btn-secondary" to="/member/hold">
                {memberText('Xem chi tiết bảo lưu', 'View hold details')}
              </Link>
            </div>
          }
        />
      )}
      {!loading && !error && !subscription && !frozen && pending && (
        <div className="portal-card" style={{ maxWidth: 620 }}>
          <div className="meta-label">{memberText("Trạng thái thẻ")}</div>
          <h3 className="portal-card-title" style={{ marginTop: 8 }}>{memberText("Đang chờ thanh toán: ")}{pending.packageName}</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            <button type="button" className="btn-secondary btn-sm" onClick={() => void loadCard()}>
              {memberText("Kiểm tra lại trạng thái")}</button>
            <Link className="btn-primary btn-sm" to="/member/packages">
              {memberText("Xem yêu cầu gói tập")}</Link>
          </div>
        </div>
      )}
      {!loading && !error && !subscription && !frozen && expired && profile && (
        <>
          <MemberCard profile={profile} subscription={{ ...expired, status: 'expired', qrCode: null }} />
          <p style={{ marginTop: 14 }}>{memberText("Gói tập đã hết hạn. ")}<Link to="/member/packages">{memberText("Xem gói tập để gia hạn")}</Link></p>
        </>
      )}
      {!loading && !error && !subscription && history.length > 0 && !frozen && !expired && !pending && (
        <EmptyState icon="card" title={memberText("Bạn không còn gói tập hiệu lực")}
          description={memberText("Đăng ký gói mới để dùng lại thẻ hội viên và mã QR check-in.")}
          actions={<Link className="btn-primary" to="/member/packages">{memberText("Xem gói tập")}</Link>} />
      )}
      {!loading && !error && !subscription && history.length === 0 && (
        <EmptyState icon="card" title={memberText("Chưa có thẻ hội viên")}
          description={memberText("Đăng ký gói tập để nhận thẻ và mã QR check-in.")}
          actions={<Link className="btn-primary" to="/member/packages">{memberText("Xem gói tập")}</Link>} />
      )}
      {!loading && !error && profile && subscription && <MemberCard profile={profile} subscription={subscription} />}
    </div>
  );
}
