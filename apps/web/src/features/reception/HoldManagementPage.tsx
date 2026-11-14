import { useConfirm } from '../../shared/ui/ConfirmDialog';
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

type Filter = HoldStatus | 'ALL';
const FILTERS: Filter[] = ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'ALL'];

/** Receptionist and manager screen: review hold requests with their medical paperwork and keep the history. */
export function HoldManagementPage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [items, setItems] = useState<HoldDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | Error | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirm, confirmDialog] = useConfirm();

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

  async function decide(item: HoldDetail, approve: boolean) {
    if (busyId !== null) return;
    if (!approve && !(await confirm({
      title: { vi: 'Từ chối đơn bảo lưu?', en: 'Reject this hold request?' },
      message: { vi: 'Hội viên sẽ được báo là đơn bị từ chối và có thể nộp đơn mới. Thao tác này không thể hoàn tác.', en: 'The member will be told the request was rejected and may submit a new one. This cannot be undone.' },
      confirmLabel: { vi: 'Từ chối', en: 'Reject' },
      cancelLabel: { vi: 'Giữ lại', en: 'Keep' },
      danger: true,
    }))) return;
    setBusyId(item.id);
    setError(null);
    try {
      if (approve) await approveHold(item.id); else await rejectHold(item.id);
      notify(approve ? t('Đã duyệt bảo lưu.', 'Hold approved.') : t('Đã từ chối bảo lưu.', 'Hold rejected.'), 'success');
      await load();
    } catch (cause) {
      setError(localizableError(cause, 'Không thể xử lý yêu cầu. Vui lòng thử lại.'));
      await load();
    } finally {
      setBusyId(null);
    }
  }

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
      {confirmDialog}
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
              {item.holdStatus === 'PENDING' && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-secondary" disabled={busyId !== null} onClick={() => void decide(item, false)}>{t('Từ chối', 'Reject')}</button>
                  <button type="button" className="btn-primary" disabled={busyId !== null} onClick={() => void decide(item, true)}>{t('Duyệt bảo lưu', 'Approve hold')}</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
