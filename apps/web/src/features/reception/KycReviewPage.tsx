import { useCallback, useEffect, useState } from 'react';
import { sourceMessage, useI18n } from '../../shared/i18n';
import { PageHeader } from '../../shared/ui/PageHeader';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { RefreshButton } from '../../shared/ui/RefreshButton';
import { useConfirm } from '../../shared/ui/ConfirmDialog';
import { localizableError } from '../../shared/lib/errorMessage';
import { formatCenterDateTime } from '../../shared/lib/centerTime';
import { notify } from '../../shared/lib/portalNotices';
import { approveKyc, listPendingKyc, rejectKyc, type KycSubmission } from './kycReviewApi';

/** Chu kỳ kiểm tra hồ sơ mới khi trang đang mở để quầy lễ tân thấy ảnh hội viên tải lên mà không cần tải lại trang. */
const AUTO_REFRESH_MS = 30_000;

/**
 * Màn duyệt hồ sơ xác minh danh tính (KYC) của hội viên: lễ tân và quản lý đối chiếu số giấy tờ đã khai với ảnh
 * chụp giấy tờ, sau đó duyệt (có xác nhận) hoặc từ chối kèm lý do bắt buộc.
 */
export function KycReviewPage() {
  const { t } = useI18n();
  const [confirm, confirmDialog] = useConfirm();
  const [items, setItems] = useState<KycSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | Error | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reason, setReason] = useState('');

  // Tải danh sách hồ sơ chờ duyệt; chế độ `silent` giữ nguyên dữ liệu trên màn hình (không hiện khung xương, và lượt làm mới nền bị lỗi không xóa danh sách).
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

  // Trước đây trang chỉ tải một lần khi mở, nên giấy tờ gửi lên khi lễ tân đã mở sẵn trang không tự hiển thị.
  useEffect(() => {
    // Tự tải lại ngầm khi tab đang hiển thị.
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

  // Duyệt hoặc từ chối hồ sơ; từ chối bắt buộc có lý do.
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

  // Xác nhận với nhân viên (kèm loại giấy tờ và số) trước khi duyệt.
  async function confirmApprove(item: KycSubmission) {
    if (busyId !== null) return;
    const docLabelVi = item.documentType === 'PASSPORT' ? 'Hộ chiếu' : 'CCCD';
    const docLabelEn = item.documentType === 'PASSPORT' ? 'Passport' : 'Identity card';
    const docSummaryVi = item.citizenId ? `${docLabelVi}: ${item.citizenId}` : `${docLabelVi} — chưa khai số`;
    const docSummaryEn = item.citizenId ? `${docLabelEn}: ${item.citizenId}` : `${docLabelEn} — no number declared`;
    const ok = await confirm({
      title: sourceMessage('Xác nhận duyệt hồ sơ định danh?', 'Approve identity submission?'),
      message: sourceMessage(
        `Xác nhận đã đối chiếu ảnh giấy tờ hợp lệ của ${item.fullName ?? 'hội viên'} (${docSummaryVi})?`,
        `Confirm you verified the document photos for ${item.fullName ?? 'this member'} (${docSummaryEn})?`,
      ),
      confirmLabel: sourceMessage('Xác nhận duyệt', 'Confirm approval'),
      cancelLabel: sourceMessage('Kiểm tra lại', 'Review again'),
    });
    if (!ok) return;
    await decide(item, true);
  }

  return (
    <div data-i18n-managed className="portal-container kyc-review">
      <PageHeader title={t('Duyệt hồ sơ định danh', 'Identity review')}
        actions={<RefreshButton label={t('Làm mới danh sách hồ sơ', 'Refresh submissions')} disabled={loading} onClick={() => void load()} />} />
      <p className="kyc-review__intro">{t('Đối chiếu thông tin hội viên với ảnh giấy tờ trước khi duyệt hồ sơ.', 'Check member details against the document photos before approving a submission.')}</p>
      {error && <div className="portal-alert" role="alert">{t(error)}</div>}
      {loading ? <LoadingSkeleton label={t('Đang tải hồ sơ chờ duyệt', 'Loading submissions')} /> : items.length === 0 ? (
        <div className="portal-card kyc-review__empty" role="status">{t('Không có hồ sơ nào chờ duyệt.', 'No submissions are waiting for review.')}</div>
      ) : (
        <ul className="kyc-review__list" aria-label={t('Hồ sơ chờ duyệt', 'Submissions awaiting review')}>
          {items.map((item) => (
            <li key={item.memberId} className="portal-card kyc-card" data-testid={`kyc-${item.memberId}`}>
              <div className="kyc-card__head">
                <div>
                  <h2 className="kyc-card__name">{item.fullName ?? '—'}</h2>
                  {item.membershipCode && <p className="kyc-card__code">{t('Mã hội viên', 'Member code')}: <strong>{item.membershipCode}</strong></p>}
                </div>
                <div className="kyc-card__status">
                  <span className="badge kyc-card__pending">{t('Chờ duyệt', 'Pending review')}</span>
                  {item.submittedAt && <span className="kyc-card__time">{t('Gửi lúc', 'Submitted')} {formatCenterDateTime(item.submittedAt)}</span>}
                </div>
              </div>
              <div className="kyc-card__body">
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
              </div>
              {rejecting === item.memberId ? (
                <div className="portal-form-group kyc-card__rejection">
                  <label className="portal-label" htmlFor={`kyc-reason-${item.memberId}`}>{t('Lý do từ chối *', 'Reason for rejection *')}</label>
                  <textarea id={`kyc-reason-${item.memberId}`} className="portal-textarea" rows={2} maxLength={255} value={reason}
                    onChange={(event) => setReason(event.target.value)} />
                  <div className="kyc-card__actions">
                    <button type="button" className="btn-secondary" onClick={() => { setRejecting(null); setReason(''); }}>{t('Hủy', 'Cancel')}</button>
                    <button type="button" className="btn-danger" disabled={busyId !== null} onClick={() => void decide(item, false)}>{t('Xác nhận từ chối', 'Confirm rejection')}</button>
                  </div>
                </div>
              ) : (
                <div className="kyc-card__actions">
                  <button type="button" className="btn-secondary" disabled={busyId !== null} onClick={() => { setRejecting(item.memberId); setReason(''); }}>{t('Từ chối', 'Reject')}</button>
                  <button type="button" className="btn-primary" disabled={busyId !== null} onClick={() => void confirmApprove(item)}>{t('Duyệt', 'Approve')}</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {confirmDialog}
    </div>
  );
}
