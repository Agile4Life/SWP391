import { useEffect, useState } from 'react';
import { formatPrice } from '../../shared/lib/membershipPresentation';
import { useStaffI18n, staffMessage, staffError, type StaffMessage } from '../operations/staffI18n';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { RefreshButton } from '../../shared/ui/RefreshButton';
import { Select } from '../../shared/ui/Select';
import { formatCenterDateTime } from '../../shared/lib/centerTime';
import { receptionApi, type CounterTopupHistoryItem } from './receptionApi';
import './request-history.css';

const METHOD_LABELS: Record<string, StaffMessage> = {
  cash: staffMessage('Tiền mặt', 'Cash'),
  pos: staffMessage('Thẻ (POS)', 'Card (POS)'),
  bank_transfer: staffMessage('Chuyển khoản', 'Bank transfer'),
};
const vnd = (amount: number) => formatPrice(Number(amount));

/** Wallet top-ups the desk took, so the cash it collected can be looked up and reconciled. */
export function WalletTopupHistory({ refreshKey = 0 }: { refreshKey?: number }) {
  const { t } = useStaffI18n();
  const [items, setItems] = useState<CounterTopupHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<StaffMessage>('');
  const [days, setDays] = useState(30);
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

  return (
    <section className="portal-card" aria-label={t('Lịch sử nạp tiền vào Ví SÖL')} data-testid="wallet-topup-history" style={{ marginTop: 24 }}>
      <div className="portal-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 className="portal-card-title">{t('Lịch sử nạp tiền vào Ví SÖL')}</h2>
        <div className="request-history__filters">
          <Select aria-label={t('Khoảng thời gian')} value={String(days)} onChange={(e) => setDays(Number(e.target.value))}>
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
        <div role="alert"><p>{t(error)}</p><button type="button" className="btn-secondary btn-sm" onClick={() => setReload((n) => n + 1)}>{t('Thử lại')}</button></div>
      ) : items.length === 0 ? (
        <p className="muted" style={{ padding: '16px 0' }}>{t('Chưa có giao dịch nạp ví nào tại quầy trong khoảng thời gian này.')}</p>
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
              {items.map((item) => (
                <tr key={item.paymentId}>
                  <td>{item.paidAt ? formatCenterDateTime(item.paidAt) : '—'}</td>
                  <td>{item.memberName}{item.membershipCode ? <span className="muted"> · {item.membershipCode}</span> : null}</td>
                  <td>{vnd(item.amount)}</td>
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
