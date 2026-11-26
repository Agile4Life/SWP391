import { useCallback, useEffect, useRef, useState } from 'react';
import { sourceMessage, useI18n } from '../../shared/i18n';
import { PageHeader } from '../../shared/ui/PageHeader';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { RefreshButton } from '../../shared/ui/RefreshButton';
import { useConfirm } from '../../shared/ui/ConfirmDialog';
import { localizableError } from '../../shared/lib/errorMessage';
import { centerNowParts, formatCenterDate, formatCenterDateTime } from '../../shared/lib/centerTime';
import { notify } from '../../shared/lib/portalNotices';
import {
  approveHold,
  fetchHoldDocument,
  listHolds,
  rejectHold,
  withdrawHoldForMember,
  type HoldDetail,
  type HoldStatus,
} from '../member/holdApi';

/** Bộ lọc trạng thái yêu cầu bảo lưu (hoặc tất cả). */
type Filter = HoldStatus | 'ALL';
const FILTERS: Filter[] = ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'ALL'];

/**
 * Màn lễ tân/quản lý xử lý yêu cầu bảo lưu: xem hồ sơ y tế đính kèm, duyệt hoặc từ chối (kèm lý do), rút yêu
 * cầu hộ hội viên và lưu giữ lịch sử.
 */
export function HoldManagementPage() {
  const { t } = useI18n();
  const [confirm, confirmDialog] = useConfirm();
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [items, setItems] = useState<HoldDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | Error | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [openingDocKey, setOpeningDocKey] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const loadSeqRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Tải danh sách yêu cầu theo bộ lọc; dùng bộ đếm request để loại kết quả cũ khi chuyển tab nhanh và cho phép giữ nguyên lỗi thao tác.
  const load = useCallback(async (options?: { preserveError?: boolean }) => {
    const preserveError = Boolean(options?.preserveError);
    const reqId = ++loadSeqRef.current;
    if (!preserveError) {
      setLoading(true);
      setError(null);
    }
    try {
      const fresh = await listHolds(filter);
      if (!mountedRef.current || reqId !== loadSeqRef.current) return;
      setItems(fresh);
    } catch (cause) {
      if (!mountedRef.current || reqId !== loadSeqRef.current) return;
      if (!preserveError) {
        setItems([]);
        setError(localizableError(cause, 'Không tải được danh sách bảo lưu. Vui lòng thử lại.'));
      }
    } finally {
      if (mountedRef.current && reqId === loadSeqRef.current && !preserveError) {
        setLoading(false);
      }
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const filterLabel: Record<Filter, string> = {
    PENDING: t('Chờ duyệt', 'Pending'),
    APPROVED: t('Đã duyệt', 'Approved'),
    REJECTED: t('Từ chối', 'Rejected'),
    COMPLETED: t('Đã hoàn tất', 'Completed'),
    ALL: t('Tất cả', 'All'),
  };

  // Duyệt hoặc từ chối một yêu cầu; một thời điểm chỉ xử lý một yêu cầu.
  async function decide(item: HoldDetail, approve: boolean, reason?: string) {
    if (busyId !== null) return;
    if (approve) {
      const memberDisplay = item.memberName ?? t('hội viên', 'this member');
      const rangeText = item.holdStartDate && item.holdEndDate
        ? `${formatCenterDate(item.holdStartDate)} – ${formatCenterDate(item.holdEndDate)}`
        : '—';
      const ok = await confirm({
        title: sourceMessage('Xác nhận duyệt bảo lưu?', 'Confirm hold approval?'),
        message: sourceMessage(
          `Duyệt yêu cầu bảo lưu gói "${item.packageName}" của ${memberDisplay} (${rangeText})? Thao tác này sẽ tự động hủy các khóa học nhóm (có thể mất phí/lượt nếu duyệt dưới 3 ngày trước khai giảng) và các buổi PT 1:1 trong thời gian bảo lưu.`,
          `Approve freeze request for "${item.packageName}" of ${memberDisplay} (${rangeText})? This automatically cancels scheduled group courses (tuition or quota may be forfeited if approved less than 3 days before start) and 1:1 PT sessions during the hold period.`,
        ),
        confirmLabel: sourceMessage('Xác nhận duyệt bảo lưu', 'Confirm hold approval'),
        cancelLabel: sourceMessage('Hủy', 'Cancel'),
      });
      if (!ok) return;
    }
    setBusyId(item.id);
    setError(null);
    try {
      if (approve) await approveHold(item.id); else await rejectHold(item.id, reason ?? '');
      const noticeMsg = approve
        ? sourceMessage('Đã duyệt bảo lưu.', 'Hold approved.')
        : sourceMessage('Đã từ chối bảo lưu.', 'Hold rejected.');
      notify(t(noticeMsg), 'success', { translation: noticeMsg });
      setRejectingId(null);
      setRejectReason('');
      await load();
    } catch (cause) {
      const errMsg = localizableError(cause, 'Không thể xử lý yêu cầu. Vui lòng thử lại.');
      setError(errMsg);
      await load({ preserveError: true });
    } finally {
      setBusyId(null);
    }
  }

  // Rút yêu cầu bảo lưu thay hội viên sau khi xác nhận rõ tác động.
  async function withdraw(item: HoldDetail) {
    if (busyId !== null) return;
    const memberDisplay = item.memberName ?? t('hội viên', 'this member');
    const rangeText = item.holdStartDate && item.holdEndDate
      ? `${formatCenterDate(item.holdStartDate)} – ${formatCenterDate(item.holdEndDate)}`
      : '—';
    const ok = await confirm({
      title: sourceMessage('Hủy bảo lưu cho hội viên?', 'Cancel scheduled hold?'),
      message: sourceMessage(
        `Hủy lịch bảo lưu (${rangeText}) gói "${item.packageName}" của ${memberDisplay}? Gói tập sẽ tiếp tục hoạt động bình thường mà không tạm dừng. Không thể hoàn tác.`,
        `Cancel scheduled hold (${rangeText}) for "${item.packageName}" of ${memberDisplay}? The membership will remain active without freezing. This cannot be undone.`,
      ),
      confirmLabel: sourceMessage('Xác nhận hủy bảo lưu', 'Confirm cancel hold'),
      cancelLabel: sourceMessage('Giữ bảo lưu', 'Keep hold'),
      danger: true,
    });
    if (!ok) return;
    setBusyId(item.id);
    setError(null);
    try {
      await withdrawHoldForMember(item.id);
      const noticeMsg = sourceMessage('Đã hủy bảo lưu cho hội viên.', 'The hold was cancelled for the member.');
      notify(t(noticeMsg), 'success', { translation: noticeMsg });
      await load();
    } catch (cause) {
      const errMsg = localizableError(cause, 'Không thể hủy bảo lưu. Vui lòng thử lại.');
      setError(errMsg);
      await load({ preserveError: true });
    } finally {
      setBusyId(null);
    }
  }

  // Mở tài liệu đính kèm trong tab mới qua object URL (có chặn bấm đúp và fallback tải xuống nếu trình duyệt chặn popup).
  async function openDocument(item: HoldDetail, documentId: number, fileName: string) {
    const key = `${item.id}-${documentId}`;
    if (openingDocKey === key) return;
    setOpeningDocKey(key);
    try {
      const blob = await fetchHoldDocument(item.id, documentId);
      const url = URL.createObjectURL(blob);
      const popup = window.open(url, '_blank', 'noopener');
      if (!popup) {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName || `document-${documentId}`;
        link.rel = 'noopener';
        document.body.append(link);
        link.click();
        link.remove();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (cause) {
      setError(localizableError(cause, 'Không mở được giấy tờ. Vui lòng thử lại.'));
    } finally {
      setOpeningDocKey(null);
    }
  }

  return (
    <div data-i18n-managed className="portal-container hold-management">
      <PageHeader
        title={t('Quản lý bảo lưu', 'Hold management')}
        actions={<RefreshButton label={t('Làm mới danh sách bảo lưu', 'Refresh hold requests')} disabled={loading} onClick={() => void load()} />}
      />
      <div role="tablist" className="portal-tabs" aria-label={t('Lọc theo trạng thái', 'Filter by status')} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {FILTERS.map((value) => (
          <button key={value} type="button" role="tab" aria-selected={filter === value}
            className={`portal-tab ${filter === value ? 'active' : ''}`} onClick={() => setFilter(value)}>
            {filterLabel[value]}
          </button>
        ))}
      </div>
      {error && (
        <div className="portal-alert" role="alert">
          <span>{t(error)}</span>
          <button type="button" className="btn-secondary btn-sm" onClick={() => void load()}>{t('Thử lại', 'Retry')}</button>
        </div>
      )}
      {loading ? <LoadingSkeleton label={t('Đang tải danh sách bảo lưu', 'Loading holds')} /> : error && items.length === 0 ? null : items.length === 0 ? (
        <div className="portal-card" role="status">{t('Không có yêu cầu bảo lưu nào.', 'No hold requests.')}</div>
      ) : (
        <ul className="stack" style={{ listStyle: 'none', padding: 0 }} aria-label={t('Danh sách bảo lưu', 'Hold list')}>
          {items.map((item) => (
            <li key={item.id} className="portal-card stack" data-testid={`hold-${item.id}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{item.memberName ?? '—'} {item.membershipCode ? `(${item.membershipCode})` : ''}</strong>
                <span className={`badge ${item.holdStatus === 'PENDING' ? 'badge-warning' : item.holdStatus === 'APPROVED' ? 'badge-success' : item.holdStatus === 'REJECTED' ? 'badge-danger' : 'badge-neutral'}`}>{item.holdStatus ? filterLabel[item.holdStatus] ?? item.holdStatus : '—'}</span>
              </div>
              <div style={{ fontVariantNumeric: 'tabular-nums' }}>{item.packageName} · {t('hiệu lực', 'valid')} {formatCenterDate(item.startDate)} – {formatCenterDate(item.endDate)}</div>
              {item.holdStartDate && item.holdEndDate && (
                <div style={{ fontVariantNumeric: 'tabular-nums' }}>{t('Bảo lưu', 'Hold')}: <strong>{formatCenterDate(item.holdStartDate)} – {formatCenterDate(item.holdEndDate)}</strong></div>
              )}
              {item.holdReason && <div>{t('Lý do', 'Reason')}: {item.holdReason}</div>}
              {item.holdStatus === 'REJECTED' && item.holdRejectionReason && (
                <div>{t('Lý do từ chối', 'Rejection reason')}: {item.holdRejectionReason}</div>
              )}
              {item.holdRequestedAt && <small className="meta-label" style={{ fontVariantNumeric: 'tabular-nums' }}>{t('Nộp lúc', 'Filed')} {formatCenterDateTime(item.holdRequestedAt)}</small>}
              {item.documents.length > 0 ? (
                <ul aria-label={t('Giấy tờ đính kèm', 'Attached documents')} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, listStyle: 'none', padding: 0 }}>
                  {item.documents.map((document) => {
                    const docKey = `${item.id}-${document.id}`;
                    return (
                      <li key={document.id}>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          disabled={openingDocKey === docKey}
                          onClick={() => void openDocument(item, document.id, document.fileName)}
                        >
                          {document.fileName}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : <small className="meta-label">{t('Chưa có giấy tờ đính kèm.', 'No documents attached.')}</small>}
              {item.holdStatus === 'APPROVED' && item.status === 'active' && !!item.holdStartDate && item.holdStartDate > centerNowParts().date && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-danger" disabled={busyId !== null} onClick={() => void withdraw(item)}>
                    {t('Hủy bảo lưu (chưa bắt đầu)', 'Cancel hold (not started)')}
                  </button>
                </div>
              )}
              {item.holdStatus === 'PENDING' && rejectingId === item.id && (
                <form
                  className="stack"
                  onSubmit={(event) => { event.preventDefault(); if (rejectReason.trim()) void decide(item, false, rejectReason.trim()); }}
                >
                  <label className="portal-label" htmlFor={`hold-reject-reason-${item.id}`}>{t('Lý do từ chối *', 'Rejection reason *')}</label>
                  <textarea
                    id={`hold-reject-reason-${item.id}`}
                    className="portal-textarea"
                    rows={3}
                    maxLength={500}
                    required
                    placeholder={t('Vd: giấy tờ chưa hợp lệ, thời gian bảo lưu không phù hợp', 'e.g. documents are not valid, the requested dates do not fit')}
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    disabled={busyId !== null}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                  <small className="meta-label">{t('Hội viên sẽ thấy lý do này và có thể nộp đơn mới. Không thể hoàn tác.', 'The member will see this reason and may file a new request. This cannot be undone.')}</small>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn-secondary" disabled={busyId !== null} onClick={() => { setRejectingId(null); setRejectReason(''); }}>{t('Hủy', 'Cancel')}</button>
                    <button type="submit" className="btn-danger" disabled={busyId !== null || !rejectReason.trim()}>{t('Xác nhận từ chối', 'Confirm rejection')}</button>
                  </div>
                </form>
              )}
              {item.holdStatus === 'PENDING' && rejectingId !== item.id && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-secondary" disabled={busyId !== null} onClick={() => { setRejectingId(item.id); setRejectReason(''); }}>{t('Từ chối', 'Reject')}</button>
                  <button type="button" className="btn-primary" disabled={busyId !== null} onClick={() => void decide(item, true)}>{t('Duyệt bảo lưu', 'Approve hold')}</button>
                </div>
              )}
              {item.holdStatus === 'PENDING' && (
                <small className="meta-label">
                  {t(
                    'Duyệt bảo lưu sẽ hủy các khóa học nhóm (có thể mất phí/lượt nếu duyệt dưới 3 ngày trước khai giảng) và các buổi PT 1:1 trong giai đoạn bảo lưu.',
                    'Approving cancels both group courses (tuition or quota may be forfeited if approved less than 3 days before start) and 1:1 PT sessions during the hold.',
                  )}
                </small>
              )}
            </li>
          ))}
        </ul>
      )}
      {confirmDialog}
    </div>
  );
}
