import { EmptyState } from '../../shared/ui/EmptyState';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { sourceMessage, useI18n, type SourceMessage } from '../../shared/i18n';
import { useConfirm } from '../../shared/ui/ConfirmDialog';
import { FilePicker } from '../../shared/ui/FilePicker';
import { PageHeader } from '../../shared/ui/PageHeader';
import { DatePicker } from '../../shared/ui/DatePicker';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { centerNowParts, formatCenterDate } from '../../shared/lib/centerTime';
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

function toLocalizableError(error: unknown, vi: string, en: string): Error | SourceMessage {
  return error instanceof Error && error.name === 'Error' && error.message ? error : sourceMessage(vi, en);
}

/** Rút gọn tên file đính kèm quá dài nhưng vẫn giữ phần mở rộng (.jpg, .pdf). */
function formatAttachmentName(fileName: string): string {
  if (fileName.length <= 32) return fileName;
  const dot = fileName.lastIndexOf('.');
  const ext = dot > 0 && fileName.length - dot <= 6 ? fileName.slice(dot) : '';
  return `${fileName.slice(0, 16)}…${fileName.slice(fileName.length - ext.length - 8)}`;
}

/** Cộng/trừ số ngày vào ngày YYYY-MM-DD (không phụ thuộc múi giờ trình duyệt). */
function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Số ngày tính cả hai đầu của khoảng [start, end] theo lịch UTC. */
function inclusiveDays(start: string, end: string): number {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86400000) + 1;
}

/**
 * Tính ngày bắt đầu sớm nhất theo múi giờ trung tâm + `noticeHours` (khớp backend:
 * `start.atStartOfDay() >= now.plusHours(noticeHours)`).
 */
function earliestStartFromNotice(noticeHours: number, now = new Date()): string {
  const threshold = new Date(now.getTime() + Math.max(0, noticeHours) * 3_600_000);
  const parts = centerNowParts(threshold);
  return parts.time === '00:00' ? parts.date : addDays(parts.date, 1);
}

/**
 * Chọn gói áp dụng bảo lưu: gói đang hoạt động hôm nay (giờ trung tâm), nếu không thì gói đang bảo lưu.
 */
function pickSubscription(history: MemberSubscription[]): MemberSubscription | null {
  const today = centerNowParts().date;
  return history.find((item) => item.status === 'active' && item.startDate <= today && item.endDate >= today)
    ?? history.find((item) => item.status === 'frozen')
    ?? null;
}

/**
 * Trang bảo lưu của hội viên: xem chính sách, gửi yêu cầu bảo lưu kèm tài liệu y tế, xem tình trạng, rút yêu
 * cầu và mở tài liệu đã nộp.
 */
export function MemberHoldPage() {
  const { t } = useI18n();
  const [confirm, confirmDialog] = useConfirm();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | Error | SourceMessage | null>(null);
  const [subscription, setSubscription] = useState<MemberSubscription | null>(null);
  const [policy, setPolicy] = useState<HoldPolicy | null>(null);
  const [detail, setDetail] = useState<HoldDetail | null>(null);
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [formError, setFormError] = useState<string | Error | SourceMessage | null>(null);
  const [invalidFields, setInvalidFields] = useState<{ startDate?: boolean; endDate?: boolean; reason?: boolean }>({});
  const [busy, setBusy] = useState(false);

  // Tải gói hiện tại, chính sách và yêu cầu bảo lưu hiện có.
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
      setLoadError(toLocalizableError(error, 'Không tải được thông tin bảo lưu. Vui lòng thử lại.', 'Unable to load hold information. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const today = centerNowParts().date;
  // Ngày bắt đầu sớm nhất theo giờ trung tâm + policy.noticeHours.
  const earliestStart = useMemo(() => earliestStartFromNotice(policy?.noticeHours ?? 24), [policy?.noticeHours]);
  const status = detail?.holdStatus ?? null;
  // Yêu cầu đang chờ duyệt, hoặc bảo lưu đã duyệt nhưng chưa bắt đầu, vẫn có thể rút lại.
  const canWithdraw = status === 'PENDING'
    || (status === 'APPROVED' && subscription?.status === 'active' && !!detail?.holdStartDate && detail.holdStartDate > today);
  const canRequest = !!subscription && !!policy?.allowed && !policy.alreadyUsed
    && subscription.status === 'active' && status !== 'PENDING' && status !== 'APPROVED';

  // Chọn tệp đính kèm, kiểm tra số lượng và dung lượng theo chính sách.
  function onPickFiles(list: FileList | null) {
    setFormError(null);
    if (!list) return;
    const picked = Array.from(list);
    if (policy && picked.length > policy.maxDocuments) {
      setFormError(sourceMessage(
        `Chỉ được đính kèm tối đa ${policy.maxDocuments} tệp.`,
        `You can attach at most ${policy.maxDocuments} files.`,
      ));
      return;
    }
    const bad = picked.find((file) => !ACCEPTED_TYPES.includes(file.type) || file.size > (policy?.maxDocumentBytes ?? 0));
    if (bad) {
      const maxMb = Math.round((policy?.maxDocumentBytes ?? 0) / 1048576);
      setFormError(sourceMessage(
        `Tệp "${bad.name}" không hợp lệ. Chỉ nhận ảnh JPG, PNG hoặc PDF, mỗi tệp tối đa ${maxMb} MB.`,
        `"${bad.name}" is not valid. Use JPG, PNG or PDF files of at most ${maxMb} MB each.`,
      ));
      return;
    }
    setFiles(picked);
  }

  // Gửi yêu cầu bảo lưu sau khi kiểm tra lý do, khoảng ngày, thời hạn báo trước và độ dài bảo lưu.
  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!subscription || !policy || busy) return;
    setInvalidFields({});
    if (!reason.trim()) {
      setInvalidFields({ reason: true });
      setFormError(sourceMessage('Vui lòng nhập lý do bảo lưu.', 'Please enter the reason for the hold.'));
      return;
    }
    if (!startDate || !endDate || endDate < startDate) {
      setInvalidFields({ startDate: !startDate || endDate < startDate, endDate: !endDate || endDate < startDate });
      setFormError(sourceMessage('Vui lòng chọn ngày bắt đầu và kết thúc hợp lệ.', 'Please choose valid start and end dates.'));
      return;
    }
    if (startDate < earliestStart) {
      setInvalidFields({ startDate: true });
      setFormError(sourceMessage(
        `Đơn phải nộp trước ngày bắt đầu ít nhất ${policy.noticeHours} giờ.`,
        `The request must be filed at least ${policy.noticeHours} hours before the start.`,
      ));
      return;
    }
    const days = inclusiveDays(startDate, endDate);
    if (days < policy.minDays || days > policy.maxDays) {
      setInvalidFields({ startDate: true, endDate: true });
      setFormError(sourceMessage(
        `Thời gian bảo lưu phải từ ${policy.minDays} đến ${policy.maxDays} ngày.`,
        `The hold must last between ${policy.minDays} and ${policy.maxDays} days.`,
      ));
      return;
    }
    if (startDate < subscription.startDate || endDate > subscription.endDate) {
      setInvalidFields({ startDate: startDate < subscription.startDate, endDate: endDate > subscription.endDate });
      setFormError(sourceMessage('Thời gian bảo lưu phải nằm trong thời hạn gói tập.', 'The hold must fall inside your membership period.'));
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await submitHoldRequest(subscription.id, { reason: reason.trim(), startDate, endDate, files });
      const msg = sourceMessage('Đã gửi đơn bảo lưu. Lễ tân sẽ xem xét giấy tờ của bạn.', 'Hold request sent. Reception will review your paperwork.');
      notify(t(msg), 'success', { translation: msg });
      setReason(''); setStartDate(''); setEndDate(''); setFiles([]); setInvalidFields({});
      await load();
    } catch (error) {
      setFormError(toLocalizableError(error, 'Không thể gửi đơn bảo lưu. Vui lòng thử lại.', 'Unable to submit hold request. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  // Rút yêu cầu bảo lưu đang chờ hoặc đã duyệt nhưng chưa bắt đầu.
  async function onWithdraw() {
    if (!subscription || busy) return;
    const isApproved = status === 'APPROVED';
    const confirmed = await confirm({
      title: isApproved
        ? sourceMessage('Hủy bảo lưu chưa bắt đầu?', 'Cancel upcoming hold?')
        : sourceMessage('Rút đơn bảo lưu?', 'Withdraw hold request?'),
      message: isApproved
        ? sourceMessage(
          'Bạn có chắc muốn hủy bảo lưu đã duyệt? Các khóa học nhóm và buổi PT 1:1 đã bị hủy khi duyệt sẽ không tự khôi phục; gói tập sẽ được trả lại lượt bảo lưu.',
          'Are you sure you want to cancel this approved hold? Group courses and 1:1 PT sessions cancelled at approval will not be restored; your package hold allowance will be returned.',
        )
        : sourceMessage(
          'Bạn có chắc muốn rút đơn bảo lưu đang chờ duyệt này không?',
          'Are you sure you want to withdraw this pending hold request?',
        ),
      confirmLabel: isApproved
        ? sourceMessage('Hủy bảo lưu', 'Cancel hold')
        : sourceMessage('Rút đơn', 'Withdraw request'),
      cancelLabel: sourceMessage('Để sau', 'Keep'),
      danger: isApproved,
    });
    if (!confirmed) return;
    setBusy(true);
    setFormError(null);
    try {
      await withdrawHoldRequest(subscription.id);
      const msg = sourceMessage('Đã rút đơn bảo lưu.', 'Hold request withdrawn.');
      notify(t(msg), 'success', { translation: msg });
      await load();
    } catch (error) {
      setFormError(toLocalizableError(error, 'Không thể rút đơn bảo lưu. Vui lòng thử lại.', 'Unable to withdraw hold request. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  // Mở tài liệu đã nộp trong tab mới qua object URL (fallback tải trực tiếp nếu bị chặn popup, thu hồi sau 60 giây).
  async function openDocument(documentId: number, fileName?: string) {
    if (!subscription) return;
    try {
      const blob = await fetchHoldDocument(subscription.id, documentId);
      const url = URL.createObjectURL(blob);
      const popup = window.open(url, '_blank', 'noopener');
      if (!popup) {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName || `hold-document-${documentId}`;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      setFormError(toLocalizableError(error, 'Không mở được giấy tờ. Vui lòng thử lại.', 'Unable to open document. Please try again.'));
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
        <div className="portal-alert portal-alert--error" role="alert">
          <span>{t(loadError)}</span>
          <button type="button" className="btn-secondary btn-sm" style={{ flexShrink: 0 }} onClick={() => void load()}>{t('Thử lại', 'Retry')}</button>
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
                <li>{t(
                  'Khi được duyệt, cả các khóa học nhóm (hoàn lượt/học phí nếu hủy trước ngày khai giảng ít nhất 3 ngày; muộn hơn sẽ mất lượt/không hoàn) lẫn các buổi PT 1:1 trong giai đoạn bảo lưu sẽ tự hủy (buổi PT dùng lượt của gói được trả lại lượt); ngày bảo lưu được cộng vào hạn gói.',
                  'When approved, both group courses (credit/fee refunded if cancelled at least 3 days before the course start date; forfeited afterward) and 1:1 PT sessions during the hold are cancelled (package PT sessions are returned); held days are added to your expiry.',
                )}</li>
              </ul>
            ) : (
              <p className="hold-notice hold-notice--info" role="status">{t('Gói này không được bảo lưu. Gói trải nghiệm và gói 1 tháng cũ hạng Silver/Gold không có quyền bảo lưu.', 'This package cannot be put on hold. The trial and the old 1-month Silver/Gold packages have no hold allowance.')}</p>
            )}
          </section>

          {detail && status && (
            <section className="portal-card stack" aria-label={t('Đơn bảo lưu hiện tại', 'Current hold request')} data-testid="hold-current">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h2 className="portal-card-title" style={{ margin: 0 }}>{t('Đơn bảo lưu', 'Hold request')}</h2>
                <span className={`badge ${status === 'APPROVED' ? 'badge-success' : status === 'REJECTED' ? 'badge-danger' : status === 'PENDING' ? 'badge-warning' : 'badge-neutral'}`}>{statusLabel[status] ?? status}</span>
              </div>
              {detail.holdStartDate && detail.holdEndDate && (
                <p className="hold-period"><strong>{formatCenterDate(detail.holdStartDate)} – {formatCenterDate(detail.holdEndDate)}</strong></p>
              )}
              {detail.holdReason && <p className="hold-reason"><strong>{t('Lý do', 'Reason')}:</strong> {detail.holdReason}</p>}
              {detail.documents.length > 0 && (
                <ul
                  aria-label={t('Giấy tờ đã nộp', 'Submitted documents')}
                  style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: 8 }}
                >
                  {detail.documents.map((document) => (
                    <li key={document.id}>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        title={document.fileName}
                        onClick={() => void openDocument(document.id, document.fileName)}
                      >
                        {formatAttachmentName(document.fileName)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {canWithdraw && (
                <div>
                  <button type="button" className="btn-secondary" disabled={busy} onClick={() => void onWithdraw()}>
                    {status === 'PENDING' ? t('Rút đơn', 'Withdraw request') : t('Hủy bảo lưu chưa bắt đầu', 'Cancel the hold before it starts')}
                  </button>
                  {status === 'APPROVED' && <small className="meta-label" style={{ display: 'block' }}>{t('Các khóa học nhóm và buổi PT 1:1 đã hủy khi duyệt sẽ không tự khôi phục; gói được trả lại lượt bảo lưu.', 'Group courses and 1:1 PT sessions cancelled at approval are not restored; the package gets its hold back.')}</small>}
                </div>
              )}
              {status === 'REJECTED' && <p className="hold-notice hold-notice--warn" role="status">{t('Đơn bị từ chối. Bạn có thể nộp đơn mới.', 'The request was rejected. You can file a new one.')}{detail.holdRejectionReason ? <> {t('Lý do từ Lễ tân', 'Reception\'s reason')}: <strong>{detail.holdRejectionReason}</strong></> : null}</p>}
            </section>
          )}

          {policy.alreadyUsed && status !== 'PENDING' && status !== 'APPROVED' && (
            <p className="hold-notice hold-notice--info" role="status" style={{ marginBottom: 20 }}>{t('Gói này đã dùng lượt bảo lưu duy nhất.', 'This package has already used its only hold.')}</p>
          )}

          {canRequest && (
            <form className="portal-card stack" onSubmit={(event) => void onSubmit(event)} aria-label={t('Làm đơn bảo lưu', 'File a hold request')}>
              <h2 className="portal-card-title">{t('Làm đơn bảo lưu', 'File a hold request')}</h2>
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="hold-start">{t('Ngày bắt đầu', 'Start date')}</label>
                <DatePicker id="hold-start" min={earliestStart} max={subscription.endDate}
                  aria-invalid={invalidFields.startDate ? 'true' : undefined}
                  value={startDate} onChange={(event) => { setStartDate(event.target.value); setInvalidFields((prev) => ({ ...prev, startDate: false })); }} disabled={busy} />
              </div>
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="hold-end">{t('Ngày kết thúc', 'End date')}</label>
                <DatePicker id="hold-end" min={startDate || earliestStart} max={subscription.endDate}
                  aria-invalid={invalidFields.endDate ? 'true' : undefined}
                  value={endDate} onChange={(event) => { setEndDate(event.target.value); setInvalidFields((prev) => ({ ...prev, endDate: false })); }} disabled={busy} />
              </div>
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="hold-reason">{t('Lý do bảo lưu *', 'Reason *')}</label>
                <textarea id="hold-reason" className="portal-textarea" rows={3} maxLength={500} value={reason}
                  aria-invalid={invalidFields.reason ? 'true' : undefined}
                  onChange={(event) => { setReason(event.target.value); setInvalidFields((prev) => ({ ...prev, reason: false })); }} disabled={busy} style={{ width: '100%', resize: 'vertical' }} />
              </div>
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="hold-files">{t('Giấy tờ đính kèm nếu có (JPG, PNG, PDF)', 'Supporting documents if any (JPG, PNG, PDF)')}</label>
                <FilePicker id="hold-files" multiple accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                  fileNames={files.map((file) => file.name)} onChange={(event) => onPickFiles(event.target.files)} disabled={busy} />
              </div>
              {formError && <p className="form-error" role="alert">{t(formError)}</p>}
              <div><button type="submit" className="btn-primary" disabled={busy}>{busy ? t('Đang gửi…', 'Sending…') : t('Gửi đơn bảo lưu', 'Send hold request')}</button></div>
            </form>
          )}
          {!canRequest && formError && <p className="form-error" role="alert">{t(formError)}</p>}
        </>
      )}
      {confirmDialog}
    </div>
  );
}
