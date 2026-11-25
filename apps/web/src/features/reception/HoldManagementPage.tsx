import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../shared/i18n';
import { PageHeader } from '../../shared/ui/PageHeader';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
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
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [items, setItems] = useState<HoldDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | Error | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Tải danh sách yêu cầu theo bộ lọc.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listHolds(filter));
    } catch (cause) {
      setItems([]);
      setError(localizableError(cause, 'Không tải được danh sách bảo lưu. Vui lòng thử lại.'));
    } finally {
      setLoading(false);
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
    setBusyId(item.id);
    setError(null);
    try {
      if (approve) await approveHold(item.id); else await rejectHold(item.id, reason ?? '');
      notify(approve ? t('Đã duyệt bảo lưu.', 'Hold approved.') : t('Đã từ chối bảo lưu.', 'Hold rejected.'), 'success');
      setRejectingId(null);
      setRejectReason('');
      await load();
    } catch (cause) {
      setError(localizableError(cause, 'Không thể xử lý yêu cầu. Vui lòng thử lại.'));
      await load();
    } finally {
      setBusyId(null);
    }
  }

  // Rút yêu cầu bảo lưu thay hội viên.
  async function withdraw(item: HoldDetail) {
    if (busyId !== null) return;
    setBusyId(item.id);
    setError(null);
    try {
      await withdrawHoldForMember(item.id);
      notify(t('Đã hủy bảo lưu cho hội viên.', 'The hold was cancelled for the member.'), 'success');
      await load();
    } catch (cause) {
      setError(localizableError(cause, 'Không thể hủy bảo lưu. Vui lòng thử lại.'));
      await load();
    } finally {
      setBusyId(null);
    }
  }

  // Mở tài liệu đính kèm trong tab mới qua object URL (thu hồi sau 60 giây).
  async function openDocument(item: HoldDetail, documentId: number) {
    try {
      const blob = await fetchHoldDocument(item.id, documentId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (cause) {
      setError(localizableError(cause, 'Không mở được giấy tờ. Vui lòng thử lại.'));
    }
  }

  return (
    <div data-i18n-managed className="portal-container hold-management">
      <PageHeader title={t('Quản lý bảo lưu', 'Hold management')} />
      <div role="tablist" className="portal-tabs" aria-label={t('Lọc theo trạng thái', 'Filter by status')} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {FILTERS.map((value) => (
          <button key={value} type="button" role="tab" aria-selected={filter === value}
            className={`portal-tab ${filter === value ? 'active' : ''}`} onClick={() => setFilter(value)}>
            {filterLabel[value]}
          </button>
        ))}
      </div>
      {error && <div className="portal-alert" role="alert">{t(error)}</div>}
      {loading ? <LoadingSkeleton label={t('Đang tải danh sách bảo lưu', 'Loading holds')} /> : items.length === 0 ? (
        <div className="portal-card" role="status">{t('Không có yêu cầu bảo lưu nào.', 'No hold requests.')}</div>
      ) : (
        <ul className="stack" style={{ listStyle: 'none', padding: 0 }} aria-label={t('Danh sách bảo lưu', 'Hold list')}>
          {items.map((item) => (
            <li key={item.id} className="portal-card stack" data-testid={`hold-${item.id}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <strong>{item.memberName ?? '—'} {item.membershipCode ? `(${item.membershipCode})` : ''}</strong>
                <span className={`badge ${item.holdStatus === 'PENDING' ? 'badge-warning' : item.holdStatus === 'APPROVED' ? 'badge-success' : item.holdStatus === 'REJECTED' ? 'badge-danger' : 'badge-neutral'}`}>{item.holdStatus ? filterLabel[item.holdStatus] ?? item.holdStatus : '—'}</span>
              </div>
              <div>{item.packageName} · {t('hiệu lực', 'valid')} {formatCenterDate(item.startDate)} – {formatCenterDate(item.endDate)}</div>
              {item.holdStartDate && item.holdEndDate && (
                <div>{t('Bảo lưu', 'Hold')}: <strong>{formatCenterDate(item.holdStartDate)} – {formatCenterDate(item.holdEndDate)}</strong></div>
              )}
              {item.holdReason && <div>{t('Lý do', 'Reason')}: {item.holdReason}</div>}
              {item.holdStatus === 'REJECTED' && item.holdRejectionReason && (
                <div>{t('Lý do từ chối', 'Rejection reason')}: {item.holdRejectionReason}</div>
              )}
              {item.holdRequestedAt && <small>{t('Nộp lúc', 'Filed')} {formatCenterDateTime(item.holdRequestedAt)}</small>}
              {item.documents.length > 0 ? (
                <ul aria-label={t('Giấy tờ đính kèm', 'Attached documents')} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, listStyle: 'none', padding: 0 }}>
                  {item.documents.map((document) => (
                    <li key={document.id}>
                      <button type="button" className="btn-secondary btn-sm" onClick={() => void openDocument(item, document.id)}>{document.fileName}</button>
                    </li>
                  ))}
                </ul>
              ) : <small>{t('Chưa có giấy tờ đính kèm.', 'No documents attached.')}</small>}
              {item.holdStatus === 'APPROVED' && item.status === 'active' && !!item.holdStartDate && item.holdStartDate > centerNowParts().date && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-secondary" disabled={busyId !== null} onClick={() => void withdraw(item)}>
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
                    className="portal-input"
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
                    <button type="button" className="btn-secondary" disabled={busyId !== null} onClick={() => { setRejectingId(null); setRejectReason(''); }}>{t('Giữ lại', 'Keep')}</button>
                    <button type="submit" className="btn-primary" disabled={busyId !== null || !rejectReason.trim()}>{t('Xác nhận từ chối', 'Confirm rejection')}</button>
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
                <small className="meta-label">{t('Duyệt sẽ hủy các buổi PT trong giai đoạn bảo lưu.', 'Approving cancels PT sessions within the hold.')}</small>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
