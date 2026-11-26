import { useEffect, useState } from 'react';
import { formatPrice } from '../../shared/lib/membershipPresentation';
import { useStaffI18n, staffMessage, staffError, type StaffMessage } from '../operations/staffI18n';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { RefreshButton } from '../../shared/ui/RefreshButton';
import { Select } from '../../shared/ui/Select';
import { formatCenterDateTime } from '../../shared/lib/centerTime';
import { receptionApi, type CounterTopupHistoryItem } from './receptionApi';
import './request-history.css';
import { historyMatches, sortHistory } from './historySearch';

const METHOD_LABELS: Record<string, StaffMessage> = {
  cash: staffMessage('Tiền mặt', 'Cash'),
  pos: staffMessage('Thẻ (POS)', 'Card (POS)'),
  bank_transfer: staffMessage('Chuyển khoản', 'Bank transfer'),
};
/** Định dạng số tiền VND. */
const vnd = (amount: number) => formatPrice(Number(amount));

/**
 * Lịch sử các lần nạp ví tại quầy lễ tân, phục vụ tra cứu và đối soát số tiền mặt đã thu.
 */
export function WalletTopupHistory({ refreshKey = 0 }: { refreshKey?: number }) {
  const { t } = useStaffI18n();
  const [items, setItems] = useState<CounterTopupHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<StaffMessage>('');
  const [days, setDays] = useState(30);
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState('newest');
  const [outcome, setOutcome] = useState('ALL');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    receptionApi.getCounterTopupHistory(days)
      .then((data) => { if (active) setItems(data); })
      .catch((err) => { if (active) setError(staffError(err, 'Không tải được lịch sử nạp ví tại quầy.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [days, reload, refreshKey]);

  const visible = sortHistory(items.filter(item => historyMatches(query, [item.memberName, item.membershipCode, item.paymentId]) && (outcome === 'ALL' || item.paymentMethod === outcome)), item => item.paidAt, order);
  return (
    <section className="portal-card request-history request-history--wallet" aria-label={t('Lịch sử nạp tiền vào Ví SÖL')} data-testid="wallet-topup-history">
      <div className="portal-card-header request-history__header">
        <h2 className="portal-card-title">{t('Lịch sử nạp tiền vào Ví SÖL')}</h2>
        <div className="request-history__filters">
          <input type="search" className="portal-input" aria-label={t('Tìm lịch sử nạp ví', 'Search wallet history')} placeholder={t('Tên, mã hội viên, mã giao dịch', 'Name, member code, transaction ID')} value={query} onChange={e => setQuery(e.target.value)} />
          <Select aria-label={t('Sắp xếp', 'Sort order')} value={order} onChange={e => setOrder(e.target.value)}>
            <option value="newest">{t('Mới nhất trước', 'Newest first')}</option><option value="oldest">{t('Cũ nhất trước', 'Oldest first')}</option>
          </Select>
          <Select aria-label={t('Phương thức nạp', 'Topup method')} value={outcome} onChange={e => setOutcome(e.target.value)}>
            <option value="ALL">{t('Tất cả', 'All')}</option>
            <option value="cash">{t('Tiền mặt', 'Cash')}</option><option value="bank_transfer">{t('Chuyển khoản', 'Bank transfer')}</option><option value="pos">{t('Thẻ (POS)', 'Card (POS)')}</option>
          </Select>
          <Select aria-label={t('Khoảng thời gian')} value={String(days)} onChange={(e) => setDays(Number(e.target.value))}>
            <option value="1">{t('Hôm nay', 'Today')}</option><option value="0">{t('Tất cả thời gian', 'All time')}</option>
            <option value="7">{t('7 ngày qua')}</option>
            <option value="30">{t('30 ngày qua')}</option>
            <option value="90">{t('90 ngày qua')}</option>
          </Select>
          <RefreshButton label={t('Làm mới lịch sử nạp ví')} onClick={() => setReload((n) => n + 1)} disabled={loading} />
        </div>
      </div>
      {loading ? (
        <LoadingSkeleton label={t('Đang tải lịch sử…')} variant="table" count={3} />
      ) : error ? (
        <div className="portal-alert" role="alert">
          <span>{t(error)}</span>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setReload((n) => n + 1)}>{t('Thử lại', 'Retry')}</button>
        </div>
      ) : visible.length === 0 ? (
        <p className="muted" style={{ padding: '16px 0' }}>
          {items.length > 0
            ? t('Không có giao dịch nạp ví nào khớp từ khóa hoặc bộ lọc hiện tại.', 'No wallet top-ups match your search or current filters.')
            : t('Chưa có giao dịch nạp ví nào tại quầy trong khoảng thời gian này.', 'No counter wallet top-ups in this period.')}
        </p>
      ) : (
        <div className="portal-table-wrapper">
          <table className="portal-table">
            <thead>
              <tr>
                <th scope="col">{t('Thời điểm')}</th>
                <th scope="col">{t('Hội viên')}</th>
                <th scope="col">{t('Số tiền')}</th>
                <th scope="col">{t('Phương thức nạp')}</th>
                <th scope="col">{t('Thu bởi')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.paymentId}>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{item.paidAt ? formatCenterDateTime(item.paidAt) : '—'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>#{item.paymentId} · {item.memberName}{item.membershipCode ? <span className="muted"> · {item.membershipCode}</span> : null}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{vnd(item.amount)}</td>
                  <td>{item.paymentMethod ? t(METHOD_LABELS[item.paymentMethod] ?? item.paymentMethod) : '—'}</td>
                  <td>{item.receivedByName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
