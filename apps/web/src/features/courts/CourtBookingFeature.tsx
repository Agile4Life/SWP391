import { memberText, memberRenderMessage, memberNotify, memberMessage } from '../member/memberI18n';
import type { SourceMessage } from '../../shared/i18n/language';
import { useLanguage } from '../../shared/i18n/language';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useActivePlan } from '../member/useActivePlan';
import { PageHeader } from '../../shared/ui/PageHeader';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { Modal } from '../../shared/ui/Modal';
import { RefreshButton } from '../../shared/ui/RefreshButton';
import { ApiError } from '../../shared/api/client';
import { addDays } from '../../shared/lib/recurrence';
import { matchesDiscipline } from '../../shared/lib/disciplines';
import { CourtBookingList, CourtLoadError } from './CourtBookingList';
import { CourtPolicyCard } from './CourtPolicyCard';
import { courtsApi, type CourtQuota, formatVnd, COURT_DISCIPLINES, centerDate, shortTime, displayDate, courtError, type Court, type CourtSlot } from './courtsApi';
import './courts.css';

import { DatePicker } from '../../shared/ui/DatePicker';
const SLOT_LABELS = { free: 'Trống', booked: 'Đã đặt', class: 'Đang có lớp', past: 'Đã qua' };
export function CourtBookingFeature() {
  const plan = useActivePlan();
  useLanguage();
  const [params, setParams] = useSearchParams();
  const discipline = COURT_DISCIPLINES.find(item => matchesDiscipline(params.get('discipline') ?? params.get('sport') ?? 'Tennis', item.name))?.name ?? 'Tennis';
  const [date, setDate] = useState(centerDate);
  const [refresh, setRefresh] = useState(0);
  const [rows, setRows] = useState<{ court: Court; slots: CourtSlot[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | SourceMessage>('');
  const [selection, setSelection] = useState<{ court: Court; slot: CourtSlot; date: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | SourceMessage>('');
  const [conflict, setConflict] = useState(false);
  const [needsMembership, setNeedsMembership] = useState(false);
  const [quota, setQuota] = useState<CourtQuota | null>(null);
  const [view, setView] = useState<'booking' | 'rules'>('booking');
  const gridHeading = useRef<HTMLHeadingElement>(null);
  const today = centerDate();
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today;
  const reload = () => setRefresh(value => value + 1);

  useEffect(() => {
    let current = true;
    setLoading(true); setError(''); setRows([]);
    if (!validDate) { setLoading(false); return; }
    void courtsApi.courts(discipline).then(async courts => Promise.all(courts.map(async court => ({ court, slots: await courtsApi.availability(court.id, date) }))))
      .then(result => { if (current) setRows(result); })
      .catch(reason => { if (current) setError(courtError(reason)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [discipline, date, refresh, validDate]);

  useEffect(() => {
    let current = true;
    if (validDate) void courtsApi.quota(date).then(result => { if (current) setQuota(result); }).catch(() => { if (current) setQuota(null); });
    return () => { current = false; };
  }, [date, refresh, validDate]);

  const remainingQuota = Math.max(0, quota?.remaining ?? 0);
  const covered = remainingQuota > 0;
  const price = selection?.slot.price ?? 0;
  const book = async () => {
    if (!selection || busy) return;
    setBusy(true); setActionError('');
    try {
      await courtsApi.book({ roomId: selection.court.id, date: selection.date, startTime: selection.slot.startTime, ...(covered ? {} : { paymentMethod: 'vnpay' }) });
      setSelection(null); reload(); memberNotify(covered ? 'Đã đặt sân thành công.' : memberMessage(`Đã đặt sân (phụ phí ${formatVnd(price)}). Vui lòng hoàn tất thanh toán qua VNPay hoặc Ví SÖL.`, `Court booked (surcharge ${formatVnd(price)}). Please complete payment via VNPay or SÖL Wallet.`), 'success', { record: true });
    } catch (reason) {
      setActionError(courtError(reason));
      setNeedsMembership(reason instanceof ApiError && reason.code === 'COURT_BOOKING_MEMBERSHIP_INVALID');
      if (reason instanceof ApiError && reason.status === 409) { setConflict(true); reload(); }
    } finally { setBusy(false); }
  };

  return <div data-i18n-managed className="portal-container court-page">
    <PageHeader title={memberText("Đặt sân")} />
    {plan === 'no' && <div className="portal-alert portal-alert--info" role="status" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span>{memberText("Cần có gói tập đang hoạt động để đặt sân.")}</span>
      <Link className="btn-primary btn-sm" to="/member/packages">{memberText("Xem gói tập")}</Link>
    </div>}
    <div className="portal-tabs" role="tablist" aria-label={memberText("Đặt sân", "Court booking")}>
      <button type="button" role="tab" id="court-tab-booking" aria-selected={view === 'booking'} aria-controls="court-panel" className={`portal-tab ${view === 'booking' ? 'active' : ''}`} onClick={() => setView('booking')}>{memberText("Đặt sân", "Book a court")}</button>
      <button type="button" role="tab" id="court-tab-rules" aria-selected={view === 'rules'} aria-controls="court-panel" className={`portal-tab ${view === 'rules' ? 'active' : ''}`} onClick={() => setView('rules')}>{memberText("Quy định đặt sân", "Booking rules")}</button>
    </div>
    <div id="court-panel" role="tabpanel" aria-labelledby={view === 'booking' ? 'court-tab-booking' : 'court-tab-rules'}>
    {view === 'rules' ? (quota?.packageName ? <CourtPolicyCard quota={quota} /> : <div className="portal-card portal-state">{memberText("Chưa có quy định đặt sân. Cần có gói tập đang hoạt động.", "No court booking rules yet. An active membership is required.")}</div>) : <>
    <div className="portal-tabs" aria-label={memberText("Bộ môn có sân")}>
      {COURT_DISCIPLINES.map(item => <button key={item.id} type="button" className={`portal-tab ${item.name === discipline ? 'active' : ''}`} aria-pressed={item.name === discipline} onClick={() => setParams({ discipline: item.name }, { replace: true })}>{item.name}</button>)}
    </div>
    <div className="court-filters"><label className="portal-form-group" htmlFor="court-date"><span className="portal-label">{memberText("Ngày đặt")}</span><DatePicker id="court-date" min={today} max={quota ? addDays(today, quota.advanceDays) : undefined} value={date} onChange={event => setDate(event.target.value)} /></label></div>
    <section data-i18n-managed aria-labelledby="court-grid-title">
      <div className="court-section-header">
        <h2 id="court-grid-title" className="portal-card-title" tabIndex={-1} ref={gridHeading}>{memberText("Khung giờ theo sân")}</h2>
        <RefreshButton variant="bare" label={memberText("Làm mới lịch sân")} disabled={loading || busy} onClick={reload} className={loading ? 'is-loading' : ''} />
      </div>
      {!validDate ? <p role="alert">{memberText("Chọn ngày từ hôm nay trở đi.")}</p> : loading ? <LoadingSkeleton label={memberText("Đang tải sân")} variant="cards" count={2} /> : error ? <CourtLoadError message={memberRenderMessage(error)} retry={reload} /> : !rows.length ? <div className="portal-card portal-state">{memberText("Chưa có sân cho bộ môn này")}</div> : <div className="court-grid">
        {rows.map(({ court, slots }) => <article className="portal-card court-card" key={court.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h3 className="portal-card-title" style={{ margin: 0 }}>{court.name}</h3>
            <Link to={`/member/explore?item=${encodeURIComponent(court.name)}`} className="btn-secondary btn-sm">{memberText("Xem trong 3D", "View in 3D")}</Link>
          </div>
          <p className="muted">{court.location ? `${court.location} · ` : ''}{shortTime(court.openTime)}–{shortTime(court.closeTime)}</p>
          <div className="court-slots">{slots.map(slot => <button type="button" key={slot.startTime} className={`court-slot court-slot--${slot.status}`} disabled={slot.status !== 'free' || busy} onClick={() => { setActionError(''); setNeedsMembership(false); setConflict(false); setSelection({ court, slot, date }); }} aria-label={`${court.name}, ${shortTime(slot.startTime)}–${shortTime(slot.endTime)}, ${memberText(SLOT_LABELS[slot.status])}`}><strong>{shortTime(slot.startTime)}–{shortTime(slot.endTime)}</strong><span>{memberText(SLOT_LABELS[slot.status])}</span></button>)}</div>
          {!slots.length && <p className="muted">{memberText("Chưa có khung giờ cho ngày này.")}</p>}
        </article>)}
      </div>}
    </section>
    <CourtBookingList refresh={refresh} onChanged={reload} />
    </>}
    </div>
    {selection && <Modal title={memberText("Xác nhận đặt sân")} busy={busy} onClose={() => setSelection(null)} returnFocusRef={gridHeading}>
      <p><strong>{selection.court.name}</strong> · {selection.court.disciplineName}</p>
      <p>{displayDate(selection.date)} · {shortTime(selection.slot.startTime)}–{shortTime(selection.slot.endTime)}</p>
      <div className="court-pricing">
        {covered ? (
          <p>{memberText("Còn ")}<strong>{remainingQuota}</strong>{memberText(" lượt đặt sân miễn phí trong tháng này; buổi này sẽ dùng 1 lượt.")}</p>
        ) : (
          <p>{memberText("Còn ")}<strong>{remainingQuota}</strong>{memberText(" lượt đặt sân miễn phí trong tháng này. Phụ phí đặt sân: ")}<strong>{formatVnd(price)}</strong>.</p>
        )}
      </div>
      {!covered && (
        <p className="muted">{memberText("Thanh toán bằng VNPay, Ví SÖL hoặc tiền mặt tại quầy Lễ tân. Lượt VNPay chưa thanh toán sau 15 phút sẽ tự hủy, lượt tiền mặt được giữ chỗ đến 2 giờ trước giờ bắt đầu.", "Pay with VNPay, SÖL Wallet or cash at the front desk. Unpaid VNPay bookings are cancelled after 15 minutes and counter bookings are held until 2 hours before start.")}</p>
      )}
      <p className="muted">{memberText("Hủy trước giờ bắt đầu ít nhất 2 giờ.")}</p>
      {actionError && <div className="portal-alert" role="alert"><p style={{ margin: 0 }}>{memberRenderMessage(actionError)}</p>{needsMembership && <div style={{ marginTop: 8 }}><Link to="/member/packages" className="btn-secondary btn-sm">{memberText("Xem / Đăng ký gói tập")}</Link></div>}</div>}
      <div className="court-modal-actions">
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => setSelection(null)}>{memberText("Quay lại")}</button>
        <button type="button" className="btn-primary" disabled={busy || conflict} onClick={() => void book()}>{busy ? memberText("Đang đặt…") : covered ? memberText("Xác nhận đặt") : memberText("Đặt sân & Thanh toán sau qua VNPay / Ví SÖL")}</button>
      </div>
    </Modal>}
  </div>;
}
