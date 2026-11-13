import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../shared/i18n';
import { PageHeader } from '../../shared/ui/PageHeader';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { RefreshButton } from '../../shared/ui/RefreshButton';
import { localizableError } from '../../shared/lib/errorMessage';
import { formatCenterDateTime } from '../../shared/lib/centerTime';
import { notify } from '../../shared/lib/portalNotices';
import { approveKyc, listPendingKyc, rejectKyc, type KycSubmission } from './kycReviewApi';

/** How often the open page looks for new submissions, so the desk sees a member's upload without reloading. */
const AUTO_REFRESH_MS = 30_000;

/** Receptionists and managers compare the declared number with the document photos, then approve or reject. */
export function KycReviewPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<KycSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | Error | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reason, setReason] = useState('');

  // `silent` refreshes keep what is on screen: no skeleton, and a failed background refresh does not wipe the list.
  const load = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError(null); }
    try {
      const fresh = await listPendingKyc();
      setItems(fresh);
      if (silent) setError(null);
    } catch (cause) {
      if (!silent) {
        setItems([]);
        setError(localizableError(cause, 'Không tải được hồ sơ chờ duyệt. Vui lòng thử lại.'));
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // The page used to load once on open, so a document sent while the receptionist already had it open never showed up.
  useEffect(() => {
    const refresh = () => { if (document.visibilityState !== 'hidden') void load(true); };
    const timer = window.setInterval(refresh, AUTO_REFRESH_MS);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);

  async function decide(item: KycSubmission, approve: boolean) {
    if (busyId !== null) return;
    if (!approve && !reason.trim()) {
      setError(t('Vui lòng nhập lý do từ chối.', 'Please enter a reason for the rejection.'));
      return;
    }
    setBusyId(item.memberId);
    setError(null);
    try {
      if (approve) await approveKyc(item.memberId); else await rejectKyc(item.memberId, reason.trim());
      notify(approve ? t('Đã duyệt hồ sơ.', 'Document approved.') : t('Đã từ chối hồ sơ.', 'Document rejected.'), 'success');
      setRejecting(null);
      setReason('');
      await load();
    } catch (cause) {
      setError(localizableError(cause, 'Không thể xử lý hồ sơ. Vui lòng thử lại.'));
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div data-i18n-managed className="portal-container kyc-review">
      <PageHeader title={t('Duyệt hồ sơ định danh', 'Identity review')}
        actions={<RefreshButton label={t('Làm mới danh sách hồ sơ', 'Refresh submissions')} disabled={loading} onClick={() => void load()} />} />
      {error && <div className="portal-card" role="alert"><strong>{t(error)}</strong></div>}
      {loading ? <LoadingSkeleton label={t('Đang tải hồ sơ chờ duyệt', 'Loading submissions')} /> : items.length === 0 ? (
        <div className="portal-card" role="status">{t('Không có hồ sơ nào chờ duyệt.', 'No submissions are waiting for review.')}</div>
      ) : (
        <ul className="stack" style={{ listStyle: 'none', padding: 0 }} aria-label={t('Hồ sơ chờ duyệt', 'Submissions awaiting review')}>
          {items.map((item) => (
            <li key={item.memberId} className="portal-card stack" data-testid={`kyc-${item.memberId}`}>
              <div className="kyc-card__head">
                <div>
                  <h2 className="kyc-card__name">{item.fullName ?? '—'}</h2>
                  {item.membershipCode && <span className="badge badge-neutral">{item.membershipCode}</span>}
                </div>
                {item.submittedAt && <span className="kyc-card__time">{t('Gửi lúc', 'Submitted')} {formatCenterDateTime(item.submittedAt)}</span>}
              </div>
              <dl className="kyc-card__doc">
                <div>
                  <dt>{item.documentType === 'PASSPORT' ? t('Hộ chiếu', 'Passport') : t('CCCD', 'Identity card')}</dt>
                  <dd>{item.citizenId ? <strong className="kyc-card__number">{item.citizenId}</strong> : <span className="kyc-card__missing">{t('Chưa có số giấy tờ', 'No document number')}</span>}</dd>
                </div>
                {item.nationality && <div><dt>{t('Quốc tịch', 'Nationality')}</dt><dd>{item.nationality}</dd></div>}
              </dl>
              <div className="kyc-card__images">
                {([['front', item.frontImageUrl, t('Mặt trước', 'Front')], ['back', item.backImageUrl, t('Mặt sau', 'Back')]] as const).map(([side, url, label]) => url ? (
                  <a key={side} className="kyc-card__image" href={url} target="_blank" rel="noreferrer" aria-label={t(`Mở ảnh ${label} ở cửa sổ mới`, `Open ${label} image in a new tab`)}>
                    <img src={url} alt={t(`${label} giấy tờ`, `Document ${label.toLowerCase()}`)} />
                    <span>{label}</span>
                  </a>
                ) : (
                  <div key={side} className="kyc-card__image kyc-card__image--empty"><span>{label}: {t('chưa có ảnh', 'no photo')}</span></div>
                ))}
              </div>
              {rejecting === item.memberId ? (
                <div className="portal-form-group">
                  <label className="portal-label" htmlFor={`kyc-reason-${item.memberId}`}>{t('Lý do từ chối *', 'Reason for rejection *')}</label>
                  <textarea id={`kyc-reason-${item.memberId}`} className="portal-input" rows={2} maxLength={255} value={reason}
                    onChange={(event) => setReason(event.target.value)} style={{ width: '100%' }} />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                    <button type="button" className="btn-secondary" onClick={() => { setRejecting(null); setReason(''); }}>{t('Hủy', 'Cancel')}</button>
                    <button type="button" className="btn-danger" disabled={busyId !== null} onClick={() => void decide(item, false)}>{t('Xác nhận từ chối', 'Confirm rejection')}</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-secondary" disabled={busyId !== null} onClick={() => { setRejecting(item.memberId); setReason(''); }}>{t('Từ chối', 'Reject')}</button>
                  <button type="button" className="btn-primary" disabled={busyId !== null} onClick={() => void decide(item, true)}>{t('Duyệt', 'Approve')}</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
