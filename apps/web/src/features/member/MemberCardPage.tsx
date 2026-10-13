import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import { getProfile, type Profile } from './profileApi';
import { PageHeader } from '../../shared/ui/PageHeader';
import { toast } from '../../shared/ui/toast';
import { cardStatus } from './cardStatus';
import { getMySubscription, type CardSubscription } from './memberCardApi';

function displayDate(value: string) {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

export function MemberCard({ profile, subscription }: { profile: Profile; subscription: CardSubscription }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [qrImage, setQrImage] = useState('');
  const [qrLoaded, setQrLoaded] = useState(false);
  const [qrError, setQrError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const status = cardStatus(subscription.status, subscription.endDate);
  const canShowQr = (status === 'active' || status === 'warning') && Boolean(subscription.qrCode?.trim());
  const border = status === 'warning' ? '#D6A638' : status === 'active' ? '#C2A684' : '#A45A53';

  useEffect(() => {
    let cancelled = false;
    setQrImage('');
    setQrLoaded(false);
    setQrError(false);
    if (!canShowQr) return;
    QRCode.toDataURL(subscription.qrCode!, { width: 240, margin: 2 })
      .then((image) => { if (!cancelled) { setQrImage(image); setQrError(false); } })
      .catch(() => { if (!cancelled) setQrError(true); });
    return () => { cancelled = true; };
  }, [canShowQr, subscription.qrCode]);

  async function downloadCard() {
    if (!cardRef.current || !canShowQr || !qrImage || !qrLoaded || qrError || downloading) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, { backgroundColor: '#1A1614', scale: 2 });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = 'the-hoi-vien.png';
      link.click();
      toast('Đã tải thẻ hội viên về máy.');
    } catch {
      toast('Không thể tải thẻ. Vui lòng thử lại.', 'error');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <div ref={cardRef} className="pass-card" style={{ background: '#1A1614', color: '#FAF8F5', border: `2px solid ${border}`, borderRadius: 6, padding: 32, maxWidth: 600 }}>
        <div style={{ color: '#C2A684', fontFamily: 'var(--font-serif)', fontSize: 24 }}>SÖL WELLNESS SANCTUARY</div>
        <p>THẺ HỘI VIÊN ĐIỆN TỬ</p>
        <h2>{profile.fullName}</h2>
        <p>Mã hội viên: {profile.membershipCode || 'Chưa có mã hội viên'}</p>
        <p>Gói tập: {subscription.packageName}</p>
        <p>Ngày bắt đầu: {displayDate(subscription.startDate)}</p>
        <p>Ngày hết hạn: {displayDate(subscription.endDate)}</p>
        <p style={{ color: border }}>{status === 'warning' ? 'Gói tập sắp hết hạn' : status === 'expired' ? 'Gói tập đã hết hạn' : status === 'active' ? 'Gói tập đang hoạt động' : 'Gói tập chưa hoạt động'}</p>
        {canShowQr && qrImage && !qrError && <img src={qrImage} alt="Mã QR check-in của hội viên" width={180} height={180} style={{ background: 'white', padding: 8 }} onLoad={() => setQrLoaded(true)} onError={() => { setQrLoaded(false); setQrError(true); }} />}
        {canShowQr && !qrImage && !qrError && <p>Đang tạo ảnh QR…</p>}
        {qrError && <p role="alert">Không thể hiển thị mã QR. Vui lòng tải lại trang.</p>}
        {!canShowQr && <p>Chưa có mã QR hợp lệ để check-in. Vui lòng kiểm tra gói tập.</p>}
      </div>
      <button type="button" className="btn-primary" onClick={downloadCard} disabled={!canShowQr || !qrImage || !qrLoaded || qrError || downloading} style={{ marginTop: 20 }}>
        {downloading ? 'Đang tải…' : 'Tải thẻ về máy'}
      </button>
    </>
  );
}

export function MemberCardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<CardSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadCard() {
    setLoading(true);
    setError('');
    try {
      const [memberProfile, memberSubscription] = await Promise.all([getProfile(), getMySubscription()]);
      setProfile(memberProfile);
      setSubscription(memberSubscription);
    } catch {
      setError('Không thể tải thông tin thẻ hội viên. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadCard(); }, []);

  return (
    <div className="portal-container">
      <PageHeader eyebrow="Hội viên" title="Thẻ thành viên" />
      {loading && <p role="status">Đang tải thẻ hội viên…</p>}
      {error && <div role="alert"><p>{error}</p><button type="button" className="btn-secondary" onClick={() => void loadCard()}>Thử lại</button></div>}
      {!loading && !error && !subscription && (
        <div className="portal-card">
          <p>Chưa có gói tập để hiển thị thẻ hội viên.</p>
          <p>Vui lòng đăng ký hoặc gia hạn gói tập.</p>
          <a className="btn-primary" href="/#packages">Xem gói tập</a>
        </div>
      )}
      {!loading && !error && profile && subscription && <MemberCard profile={profile} subscription={subscription} />}
    </div>
  );
}
