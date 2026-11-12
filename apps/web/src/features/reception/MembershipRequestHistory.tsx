import { useEffect, useState } from 'react';
import { useStaffI18n, staffMessage, staffError, type StaffMessage } from '../operations/staffI18n';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { RefreshButton } from '../../shared/ui/RefreshButton';
import { Select } from '../../shared/ui/Select';
import { formatCenterDateTime } from '../../shared/lib/centerTime';
import { receptionApi, type RequestHistoryItem } from './receptionApi';
import './request-history.css';

const TYPE_LABELS: Record<RequestHistoryItem['type'], StaffMessage> = {
  REGISTER: staffMessage('Đăng ký', 'Register'),
  RENEW: staffMessage('Gia hạn', 'Renewal'),
  UPGRADE: staffMessage('Nâng cấp', 'Upgrade'),
};
const OUTCOME_LABELS: Record<RequestHistoryItem['outcome'], StaffMessage> = {
  APPROVED: staffMessage('Đã thu tiền & kích hoạt', 'Paid & activated'),
  CANCELLED: staffMessage('Đã hủy', 'Cancelled'),
};
const METHOD_LABELS: Record<string, StaffMessage> = {
  cash: staffMessage('Tiền mặt', 'Cash'),
  pos: staffMessage('Thẻ (POS)', 'Card (POS)'),
  bank_transfer: staffMessage('Chuyển khoản', 'Bank transfer'),
  online_wallet: staffMessage('VNPay / Ví SÖL', 'VNPay / SÖL Wallet'),
};
const vnd = (amount: number | null) => (amount == null ? '—' : `${Number(amount).toLocaleString('vi-VN')} ₫`);

type Filter = 'ALL' | RequestHistoryItem['type'];

/** Requests the desk already processed (paid or cancelled), so approved upgrades can be looked up and reconciled. */
export function MembershipRequestHistory({ refreshKey = 0 }: { refreshKey?: number }) {
  const { t } = useStaffI18n();
  const [items, setItems] = useState<RequestHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<StaffMessage>('');
  const [days, setDays] = useState(30);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    receptionApi.getRequestHistory(days)
      .then((data) => { if (active) setItems(data); })
      .catch((err) => { if (active) setError(staffError(err, 'Không tải được lịch sử xử lý yêu cầu gói tập.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [days, reload, refreshKey]);

  const visible = filter === 'ALL' ? items : items.filter((item) => item.type === filter);

  return (
    <section className="portal-card" aria-label={t('Lịch sử xử lý yêu cầu gói tập')} data-testid="request-history">
      <div className="portal-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 className="portal-card-title">{t('Lịch sử xử lý yêu cầu gói tập')}</h2>
        <div className="request-history__filters">
          <Select aria-label={t('Loại yêu cầu')} value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="ALL">{t('Tất cả loại')}</option>
            <option value="REGISTER">{t(TYPE_LABELS.REGISTER)}</option>
            <option value="RENEW">{t(TYPE_LABELS.RENEW)}</option>
            <option value="UPGRADE">{t(TYPE_LABELS.UPGRADE)}</option>
          </Select>
          <Select aria-label={t('Khoảng thời gian')} value={String(days)} onChange={(e) => setDays(Number(e.target.value))}>
            <option value="7">{t('7 ngày qua')}</option>
            <option value="30">{t('30 ngày qua')}</option>
            <option value="90">{t('90 ngày qua')}</option>
          </Select>
          <RefreshButton label={t('Làm mới lịch sử')} onClick={() => setReload((n) => n + 1)} disabled={loading} />
        </div>
      </div>
      {loading ? (
        <LoadingSkeleton label={t('Đang tải lịch sử…')} variant="table" count={3} />
      ) : error ? (
        <div role="alert"><p>{t(error)}</p><button type="button" className="btn-secondary btn-sm" onClick={() => setReload((n) => n + 1)}>{t('Thử lại')}</button></div>
      ) : visible.length === 0 ? (
        <p className="muted" style={{ padding: '16px 0' }}>{t('Chưa có yêu cầu nào được xử lý trong khoảng thời gian này.')}</p>
      ) : (
        <div className="portal-table-wrapper">
          <table className="portal-table">
            <thead>
              <tr>
                <th scope="col">{t('Thời điểm')}</th>
                <th scope="col">{t('Hội viên')}</th>
                <th scope="col">{t('Loại')}</th>
                <th scope="col">{t('Gói')}</th>
                <th scope="col">{t('Số tiền')}</th>
                <th scope="col">{t('Kết quả')}</th>
                <th scope="col">{t('Người xử lý')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={`${item.subscriptionId}-${item.outcome}`}>
                  <td>{item.processedAt ? formatCenterDateTime(item.processedAt) : '—'}</td>
                  <td>{item.memberName}{item.membershipCode ? <span className="muted"> · {item.membershipCode}</span> : null}</td>
                  <td>{t(TYPE_LABELS[item.type])}</td>
                  <td>{item.previousPackageName && item.type === 'UPGRADE' ? `${item.previousPackageName} → ${item.packageName ?? ''}` : item.packageName ?? '—'}</td>
                  <td>{vnd(item.amount)}{item.paymentMethod ? <span className="muted"> · {t(METHOD_LABELS[item.paymentMethod] ?? item.paymentMethod)}</span> : null}</td>
                  <td>{t(OUTCOME_LABELS[item.outcome])}</td>
                  <td>{item.processedByName ?? (item.outcome === 'APPROVED' ? t('Hội viên tự thanh toán') : '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
