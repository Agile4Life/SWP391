import { EmptyState } from '../../shared/ui/EmptyState';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../shared/i18n';
import { PageHeader } from '../../shared/ui/PageHeader';
import { DatePicker } from '../../shared/ui/DatePicker';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { localizableError } from '../../shared/lib/errorMessage';
import { formatCenterDate } from '../../shared/lib/centerTime';
import { notify } from '../../shared/lib/portalNotices';
import { getMembershipHistory, type MemberSubscription } from './membershipApi';
import {
  fetchHoldDocument,
  getHoldDetail,
  getHoldPolicy,
  submitHoldRequest,
  withdrawHoldRequest,
  type HoldDetail,
  type HoldPolicy,
} from './holdApi';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

function isoDate(date: Date): string {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

function inclusiveDays(start: string, end: string): number {
  return Math.round((new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86400000) + 1;
}

/** The subscription a hold applies to: the one running today, else one that is already frozen. */
function pickSubscription(history: MemberSubscription[]): MemberSubscription | null {
  const today = isoDate(new Date());
  return history.find((item) => item.status === 'active' && item.startDate <= today && item.endDate >= today)
    ?? history.find((item) => item.status === 'frozen')
    ?? null;
}

export function MemberHoldPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | Error | null>(null);
  const [subscription, setSubscription] = useState<MemberSubscription | null>(null);
  const [policy, setPolicy] = useState<HoldPolicy | null>(null);
  const [detail, setDetail] = useState<HoldDetail | null>(null);
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [formError, setFormError] = useState<string | Error | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const history = await getMembershipHistory();
      const picked = pickSubscription(history);
      setSubscription(picked);
      if (picked) {
        const [nextPolicy, nextDetail] = await Promise.all([
          getHoldPolicy(picked.id),
          picked.holdStatus || picked.status === 'frozen' ? getHoldDetail(picked.id) : Promise.resolve(null),
        ]);
        setPolicy(nextPolicy);
        setDetail(nextDetail);
      } else {
        setPolicy(null);
        setDetail(null);
      }
    } catch (error) {
      setLoadError(localizableError(error, 'Không tải được thông tin bảo lưu. Vui lòng thử lại.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const earliestStart = useMemo(() => addDays(isoDate(new Date()), 2), []);
  const status = detail?.holdStatus ?? null;
  // A pending request, or an approved hold that has not started yet, can still be withdrawn.
  const canWithdraw = status === 'PENDING'
    || (status === 'APPROVED' && subscription?.status === 'active' && !!detail?.holdStartDate && detail.holdStartDate > isoDate(new Date()));
  const canRequest = !!subscription && !!policy?.allowed && !policy.alreadyUsed
    && subscription.status === 'active' && status !== 'PENDING' && status !== 'APPROVED';

  function onPickFiles(list: FileList | null) {
    setFormError(null);
    if (!list) return;
    const picked = Array.from(list);
    if (policy && picked.length > policy.maxDocuments) {
      setFormError(t(`Chỉ được đính kèm tối đa ${policy.maxDocuments} tệp.`, `You can attach at most ${policy.maxDocuments} files.`));
      return;
    }
    const bad = picked.find((file) => !ACCEPTED_TYPES.includes(file.type) || file.size > (policy?.maxDocumentBytes ?? 0));
    if (bad) {
      setFormError(t(
        `Tệp "${bad.name}" không hợp lệ. Chỉ nhận ảnh JPG, PNG hoặc PDF, mỗi tệp tối đa ${Math.round((policy?.maxDocumentBytes ?? 0) / 1048576)} MB.`,
        `"${bad.name}" is not valid. Use JPG, PNG or PDF files of at most ${Math.round((policy?.maxDocumentBytes ?? 0) / 1048576)} MB each.`,
      ));
      return;
    }
    setFiles(picked);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!subscription || !policy || busy) return;
    if (!reason.trim()) { setFormError(t('Vui lòng nhập lý do bảo lưu.', 'Please enter the reason for the hold.')); return; }
    if (!startDate || !endDate || endDate < startDate) { setFormError(t('Vui lòng chọn ngày bắt đầu và kết thúc hợp lệ.', 'Please choose valid start and end dates.')); return; }
    if (startDate < earliestStart) { setFormError(t(`Đơn phải nộp trước ngày bắt đầu ít nhất ${policy.noticeHours} giờ.`, `The request must be filed at least ${policy.noticeHours} hours before the start.`)); return; }
    const days = inclusiveDays(startDate, endDate);
    if (days < policy.minDays || days > policy.maxDays) {
      setFormError(t(`Thời gian bảo lưu phải từ ${policy.minDays} đến ${policy.maxDays} ngày.`, `The hold must last between ${policy.minDays} and ${policy.maxDays} days.`));
      return;
    }
    if (startDate < subscription.startDate || endDate > subscription.endDate) {
      setFormError(t('Thời gian bảo lưu phải nằm trong thời hạn gói tập.', 'The hold must fall inside your membership period.'));
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await submitHoldRequest(subscription.id, { reason: reason.trim(), startDate, endDate, files });
      notify(t('Đã gửi đơn bảo lưu. Lễ tân sẽ xem xét giấy tờ của bạn.', 'Hold request sent. Reception will review your paperwork.'), 'success');
      setReason(''); setStartDate(''); setEndDate(''); setFiles([]);
      await load();
    } catch (error) {
      setFormError(localizableError(error, 'Không thể gửi đơn bảo lưu. Vui lòng thử lại.'));
    } finally {
      setBusy(false);
    }
  }

  async function onWithdraw() {
    if (!subscription || busy) return;
    setBusy(true);
    try {
      await withdrawHoldRequest(subscription.id);
      notify(t('Đã rút đơn bảo lưu.', 'Hold request withdrawn.'), 'success');
      await load();
    } catch (error) {
      setFormError(localizableError(error, 'Không thể rút đơn bảo lưu. Vui lòng thử lại.'));
    } finally {
      setBusy(false);
    }
  }

  async function openDocument(documentId: number) {
    if (!subscription) return;
    try {
      const blob = await fetchHoldDocument(subscription.id, documentId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      setFormError(localizableError(error, 'Không mở được giấy tờ. Vui lòng thử lại.'));
    }
  }

  const statusLabel: Record<string, string> = {
    PENDING: t('Đang chờ duyệt', 'Pending review'),
    APPROVED: t('Đã duyệt', 'Approved'),
    REJECTED: t('Bị từ chối', 'Rejected'),
    COMPLETED: t('Đã hoàn tất', 'Completed'),
  };

  return (
    <div data-i18n-managed className="portal-container member-hold">
      <PageHeader title={t('Bảo lưu gói tập', 'Membership hold')} />
      {loading ? <LoadingSkeleton label={t('Đang tải thông tin bảo lưu', 'Loading hold information')} /> : loadError ? (
        <div className="portal-card" role="alert">
          <p>{t(loadError)}</p>
          <button type="button" className="btn-secondary btn-sm" onClick={() => void load()}>{t('Thử lại', 'Retry')}</button>
        </div>
      ) : !subscription || !policy ? (
        <EmptyState icon="clock" title={t('Chưa có gói để bảo lưu', 'No membership to put on hold')}
          description={t('Bảo lưu chỉ áp dụng cho gói tập đang hoạt động.', 'Holds only apply to an active membership.')}
          actions={<Link to="/member/packages" className="btn-primary">{t('Xem gói tập', 'See memberships')}</Link>} />
      ) : (
        <>
          <section className="portal-card stack" aria-label={t('Quy định bảo lưu', 'Hold rules')}>
            <h2 className="portal-card-title">{subscription.packageName}</h2>
            <p className="hold-validity">{t(`Hiệu lực ${formatCenterDate(subscription.startDate)} – ${formatCenterDate(subscription.endDate)}.`, `Valid ${formatCenterDate(subscription.startDate)} – ${formatCenterDate(subscription.endDate)}.`)}</p>
            {policy.allowed ? (
              <ul className="hold-rules">
                <li>{t(`Tối đa ${policy.maxDays} ngày, tối thiểu ${policy.minDays} ngày.`, `Between ${policy.minDays} and ${policy.maxDays} days.`)}</li>
                <li>{t('Mỗi gói chỉ được bảo lưu một lần.', 'Each package can be put on hold only once.')}</li>
                <li>{t(`Nộp đơn trước ngày bắt đầu ít nhất ${policy.noticeHours} giờ (có thể đính kèm giấy tờ nếu có).`, `File at least ${policy.noticeHours} hours before it starts (supporting documents optional).`)}</li>
                <li>{t('Khi được duyệt, các buổi PT và đặt sân trong giai đoạn bảo lưu sẽ tự hủy; ngày bảo lưu được cộng vào hạn gói.', 'When approved, PT sessions and courts booked during the hold are cancelled and the held days are added to your expiry.')}</li>
              </ul>
            ) : (
              <p className="hold-notice hold-notice--info" role="status">{t('Gói này không được bảo lưu. Chỉ gói 3 tháng và gói Platinum 1 tháng được bảo lưu.', 'This package cannot be put on hold. Only 3-month packages and the 1-month Platinum package can be held.')}</p>
            )}
          </section>

          {detail && status && (
            <section className="portal-card stack" aria-label={t('Đơn bảo lưu hiện tại', 'Current hold request')} data-testid="hold-current">
              <h2 className="portal-card-title">{t('Đơn bảo lưu', 'Hold request')}: <span className={`badge ${status === 'APPROVED' ? 'badge-success' : status === 'REJECTED' ? 'badge-danger' : status === 'PENDING' ? 'badge-warning' : 'badge-neutral'}`}>{statusLabel[status] ?? status}</span></h2>
              {detail.holdStartDate && detail.holdEndDate && (
                <p className="hold-period"><strong>{formatCenterDate(detail.holdStartDate)} – {formatCenterDate(detail.holdEndDate)}</strong></p>
              )}
              {detail.holdReason && <p className="hold-reason">{t('Lý do', 'Reason')}: {detail.holdReason}</p>}
              {detail.documents.length > 0 && (
                <ul aria-label={t('Giấy tờ đã nộp', 'Submitted documents')}>
                  {detail.documents.map((document) => (
                    <li key={document.id}>
                      <button type="button" className="btn-secondary btn-sm" onClick={() => void openDocument(document.id)}>{document.fileName}</button>
                    </li>
                  ))}
                </ul>
              )}
              {canWithdraw && (
                <div>
                  <button type="button" className="btn-secondary" disabled={busy} onClick={() => void onWithdraw()}>
                    {status === 'PENDING' ? t('Rút đơn', 'Withdraw request') : t('Hủy bảo lưu chưa bắt đầu', 'Cancel the hold before it starts')}
                  </button>
                  {status === 'APPROVED' && <small style={{ display: 'block' }}>{t('Các lịch PT và đặt sân đã hủy khi duyệt sẽ không tự khôi phục; gói được trả lại lượt bảo lưu.', 'PT sessions and courts cancelled at approval are not restored; the package gets its hold back.')}</small>}
                </div>
              )}
              {status === 'REJECTED' && <p className="hold-notice hold-notice--warn" role="status">{t('Đơn bị từ chối. Bạn có thể nộp đơn mới.', 'The request was rejected. You can file a new one.')}</p>}
            </section>
          )}

          {policy.alreadyUsed && status !== 'PENDING' && status !== 'APPROVED' && (
            <div className="portal-card hold-notice hold-notice--info" role="status">{t('Gói này đã dùng lượt bảo lưu duy nhất.', 'This package has already used its only hold.')}</div>
          )}

          {canRequest && (
            <form className="portal-card stack" onSubmit={(event) => void onSubmit(event)} aria-label={t('Làm đơn bảo lưu', 'File a hold request')}>
              <h2 className="portal-card-title">{t('Làm đơn bảo lưu', 'File a hold request')}</h2>
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="hold-start">{t('Ngày bắt đầu', 'Start date')}</label>
                <DatePicker id="hold-start" min={earliestStart} max={subscription.endDate}
                  value={startDate} onChange={(event) => setStartDate(event.target.value)} disabled={busy} />
              </div>
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="hold-end">{t('Ngày kết thúc', 'End date')}</label>
                <DatePicker id="hold-end" min={startDate || earliestStart} max={subscription.endDate}
                  value={endDate} onChange={(event) => setEndDate(event.target.value)} disabled={busy} />
              </div>
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="hold-reason">{t('Lý do bảo lưu *', 'Reason *')}</label>
                <textarea id="hold-reason" className="portal-input" rows={3} maxLength={500} value={reason}
                  onChange={(event) => setReason(event.target.value)} disabled={busy} style={{ width: '100%', resize: 'vertical' }} />
              </div>
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="hold-files">{t('Giấy tờ đính kèm nếu có (JPG, PNG, PDF)', 'Supporting documents if any (JPG, PNG, PDF)')}</label>
                <input id="hold-files" className="portal-input" type="file" multiple accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                  onChange={(event) => onPickFiles(event.target.files)} disabled={busy} />
                {files.length > 0 && <small className="hold-files">{files.map((file) => file.name).join(', ')}</small>}
              </div>
              {formError && <p role="alert" style={{ color: 'var(--portal-danger, #fca5a5)' }}>{t(formError)}</p>}
              <div><button type="submit" className="btn-primary" disabled={busy}>{busy ? t('Đang gửi…', 'Sending…') : t('Gửi đơn bảo lưu', 'Send hold request')}</button></div>
            </form>
          )}
          {!canRequest && formError && <p role="alert" style={{ color: 'var(--portal-danger, #fca5a5)' }}>{t(formError)}</p>}
        </>
      )}
    </div>
  );
}
