import { useEffect, useState } from 'react';
import { listHolds, type HoldDetail, type HoldStatus } from '../member/holdApi';
import { staffMessage, useStaffI18n, type StaffMessage } from '../operations/staffI18n';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { RefreshButton } from '../../shared/ui/RefreshButton';
import { Select } from '../../shared/ui/Select';
import { formatCenterDate, formatCenterDateTime } from '../../shared/lib/centerTime';
import './request-history.css';

type ProcessedStatus = Exclude<HoldStatus, 'PENDING'>;
const LABELS: Record<ProcessedStatus, StaffMessage> = {
  APPROVED: staffMessage('Đã duyệt', 'Approved'),
  REJECTED: staffMessage('Từ chối', 'Rejected'),
  COMPLETED: staffMessage('Hoàn tất', 'Completed'),
};

/** Chỉ đọc thông tin bảo lưu gần nhất do Backend trả về, không dựng audit log. */
export function HoldRequestHistory() {
  const { t } = useStaffI18n();
  const [items, setItems] = useState<HoldDetail[]>([]);
  const [filter, setFilter] = useState<ProcessedStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<StaffMessage>('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    listHolds('ALL')
      .then(data => { if (active) setItems(data); })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause : staffMessage('Không tải được lịch sử bảo lưu.', 'Unable to load hold history.'));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  // Luôn loại PENDING/null/trạng thái lạ, kể cả khi API trả về tất cả.
  const visible = items.filter(item => item.holdStatus != null
    && Object.hasOwn(LABELS, item.holdStatus) && (filter === 'ALL' || item.holdStatus === filter));

  return (
    <section className="portal-card request-history request-history--holds" aria-label={t('Lịch sử bảo lưu gói tập', 'Membership hold history')} data-testid="hold-request-history">
      <div className="portal-card-header hold-history__filters">
        <Select aria-label={t('Trạng thái bảo lưu', 'Hold status')} value={filter} onChange={event => setFilter(event.target.value as typeof filter)}>
          <option value="ALL">{t('Tất cả trạng thái đã xử lý', 'All processed statuses')}</option>
          {Object.entries(LABELS).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
        </Select>
        <RefreshButton label={t('Làm mới lịch sử bảo lưu', 'Refresh hold history')} disabled={loading} onClick={() => setReload(value => value + 1)} />
      </div>
      <p className="muted hold-history__note">{t('Chỉ hiển thị thông tin bảo lưu gần nhất của mỗi gói tập, không phải nhật ký mọi lần gửi hoặc rút đơn.', 'Shows only the latest hold information for each membership, not a log of every submission or withdrawal.')}</p>
      {loading ? <LoadingSkeleton label={t('Đang tải lịch sử bảo lưu…', 'Loading hold history…')} variant="table" count={3} /> : error ? (
        <div className="portal-alert" role="alert">
          <span>{t(error)}</span>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setReload(value => value + 1)}>{t('Thử lại', 'Retry')}</button>
        </div>
      ) : visible.length === 0 ? (
        <p className="muted" role="status">{t('Không có lịch sử bảo lưu phù hợp.', 'No matching hold history.')}</p>
      ) : (
        <div className="portal-table-wrapper">
          <table className="portal-table">
            <thead><tr>
              <th scope="col">{t('Hội viên', 'Member')}</th><th scope="col">{t('Gói tập', 'Membership')}</th>
              <th scope="col">{t('Bắt đầu bảo lưu', 'Hold start')}</th><th scope="col">{t('Kết thúc bảo lưu', 'Hold end')}</th>
              <th scope="col">{t('Trạng thái', 'Status')}</th><th scope="col">{t('Lý do', 'Reason')}</th>
              <th scope="col">{t('Thời gian xử lý', 'Processed at')}</th>
            </tr></thead>
            <tbody>{visible.map(item => (
              <tr key={item.id}>
                <td><strong>{item.memberName ?? '—'}</strong>{item.membershipCode && <div className="muted">{item.membershipCode}</div>}</td>
                <td>{item.packageName ?? '—'}</td>
                <td>{item.holdStartDate ? formatCenterDate(item.holdStartDate) : '—'}</td>
                <td>{item.holdEndDate ? formatCenterDate(item.holdEndDate) : '—'}</td>
                <td><span className={`badge ${item.holdStatus === 'APPROVED' ? 'badge-success' : item.holdStatus === 'REJECTED' ? 'badge-danger' : 'badge-neutral'}`}>{t(LABELS[item.holdStatus as ProcessedStatus])}</span></td>
                <td>{item.holdReason ?? '—'}{item.holdRejectionReason && <div>{t('Lý do từ chối', 'Rejection reason')}: {item.holdRejectionReason}</div>}</td>
                <td>{item.holdResolvedAt ? formatCenterDateTime(item.holdResolvedAt) : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
