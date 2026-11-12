import { useState } from 'react';
import { sourceMessage, useI18n } from '../../shared/i18n';
import { getCurrentUser } from '../../shared/api/client';
import { formatCenterDate, formatCenterDateTime } from '../../shared/lib/centerTime';
import { localizableError } from '../../shared/lib/errorMessage';
import { notify } from '../../shared/lib/portalNotices';
import { useConfirm } from '../../shared/ui/ConfirmDialog';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { formatVnd } from '../shop/shopFormat';
import { PaymentInvoice } from './PaymentInvoice';
import { receptionApi, type PaymentMethod, type PaymentResponseDto, type PendingSubscriptionItem, type UnpaidCoachBooking } from './receptionApi';
import type { CounterQueue } from './useCounterQueue';

type CounterMethod = Extract<PaymentMethod, 'cash' | 'pos' | 'bank_transfer'>;
const METHODS: Array<{ value: CounterMethod; vi: string; en: string }> = [
  { value: 'cash', vi: 'Tiền mặt', en: 'Cash' },
  { value: 'pos', vi: 'Thẻ / POS', en: 'Card / POS' },
  { value: 'bank_transfer', vi: 'Chuyển khoản', en: 'Bank transfer' },
];

interface Invoice { payment: PaymentResponseDto; memberName: string; membershipCode: string | null; packageName: string }

/**
 * Orders paid at the counter, for the manager: membership requests waiting for payment and unpaid 1:1 sessions.
 * It sits inside the manager's Orders tab next to the product orders, and uses the same API as the reception desk.
 */
export function CounterRequestsPanel({ queue }: { queue: CounterQueue }) {
  const { t } = useI18n();
  const [confirm, confirmDialog] = useConfirm();
  const [methods, setMethods] = useState<Record<number, CounterMethod>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const { pending, unpaidPt, loading, error, reload } = queue;
  const methodOf = (id: number): CounterMethod => methods[id] ?? 'cash';

  async function collect(item: PendingSubscriptionItem) {
    if (busyKey) return;
    setBusyKey(`sub-${item.id}`);
    try {
      const payment = await receptionApi.processPayment({
        memberId: item.memberId, subscriptionId: item.id, packageId: item.packageId, amount: item.packagePrice,
        method: methodOf(item.id), notes: 'Thanh toán gói tập tại quầy',
      });
      setInvoice({ payment, memberName: item.memberName, membershipCode: item.membershipCode, packageName: item.packageName });
      notify(payment.invoiceNumber
        ? t(`Đã xác nhận thu tiền. Hóa đơn: ${payment.invoiceNumber}`, `Payment collected. Invoice: ${payment.invoiceNumber}`)
        : t('Đã ghi nhận thanh toán; chưa có số hóa đơn.', 'Payment recorded; no invoice number yet.'), 'success', { record: true });
    } catch (cause) {
      notify(t(localizableError(cause, 'Giao dịch thanh toán thất bại.')), 'error');
    } finally {
      setBusyKey(null);
      await reload();
    }
  }

  async function cancel(item: PendingSubscriptionItem) {
    if (busyKey) return;
    const ok = await confirm({
      title: sourceMessage('Hủy yêu cầu gói tập?', 'Cancel this membership request?'),
      message: sourceMessage(
        `Yêu cầu #${item.id} (${item.packageName}) của ${item.memberName} sẽ bị hủy, hội viên cần đăng ký lại.`,
        `Request #${item.id} (${item.packageName}) from ${item.memberName} will be cancelled and the member has to apply again.`,
      ),
      confirmLabel: sourceMessage('Hủy yêu cầu', 'Cancel request'),
      cancelLabel: sourceMessage('Giữ yêu cầu', 'Keep request'),
      danger: true,
    });
    if (!ok) return;
    setBusyKey(`sub-${item.id}`);
    try {
      await receptionApi.cancelPendingSubscription(item.id);
      notify(t(`Đã hủy yêu cầu gói tập #${item.id} của ${item.memberName}.`, `Cancelled request #${item.id} from ${item.memberName}.`), 'success', { record: true });
    } catch (cause) {
      notify(t(localizableError(cause, 'Hủy yêu cầu gói tập thất bại.')), 'error');
    } finally {
      setBusyKey(null);
      await reload();
    }
  }

  async function collectPt(item: UnpaidCoachBooking, method: CounterMethod) {
    if (busyKey) return;
    setBusyKey(`pt-${item.id}`);
    try {
      await receptionApi.confirmCoachBookingPayment(item.id, method);
      notify(t(`Đã thu tiền buổi PT #${item.id} của ${item.memberName}.`, `Collected payment for 1:1 session #${item.id} from ${item.memberName}.`), 'success', { record: true });
    } catch (cause) {
      notify(t(localizableError(cause, 'Không thể xác nhận thu tiền buổi PT.')), 'error');
    } finally {
      setBusyKey(null);
      await reload();
    }
  }

  return (
    <section data-i18n-managed className="stack" aria-label={t('Đơn tại quầy', 'Counter orders')}>
      <p className="muted" style={{ margin: 0 }}>
        {t('Yêu cầu gói tập và buổi PT 1:1 đang chờ thu tiền tại quầy. Danh sách tự cập nhật mỗi 30 giây; nút làm mới ở đầu trang tải lại ngay.', 'Membership requests and 1:1 sessions waiting to be paid at the counter. The list refreshes every 30 seconds; the refresh button at the top reloads it now.')}
      </p>

      {error && <div className="portal-card" role="alert"><strong>{t(error)}</strong></div>}

      <div className="portal-card">
        <h2 className="portal-card-title">{t(`Gói tập chờ thu tiền (${pending.length})`, `Memberships awaiting payment (${pending.length})`)}</h2>
        {loading ? <LoadingSkeleton label={t('Đang tải yêu cầu gói tập…', 'Loading membership requests…')} count={2} /> : pending.length === 0 ? (
          <p className="muted" role="status">{t('Không có yêu cầu gói tập nào chờ thu tiền.', 'No membership requests are waiting for payment.')}</p>
        ) : (
          <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-label={t('Yêu cầu gói tập chờ thu tiền', 'Membership requests awaiting payment')}>
            {pending.map((item) => (
              <li key={item.id} data-testid={`counter-request-${item.id}`} className="portal-card" style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <strong>{item.memberName}</strong>{item.membershipCode ? <span className="badge badge-neutral" style={{ marginLeft: 8 }}>{item.membershipCode}</span> : null}
                    <div className="muted">{item.memberPhone || item.memberEmail}</div>
                  </div>
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatVnd(item.packagePrice)}</strong>
                </div>
                <div className="muted">
                  #{item.id} · {item.packageName} · {formatCenterDate(item.startDate)} → {formatCenterDate(item.endDate)} · {t('Gửi lúc', 'Requested')} {formatCenterDateTime(item.createdAt)}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <label className="shop-sr-only" htmlFor={`counter-method-${item.id}`}>{t('Hình thức thu tiền', 'Payment method')}</label>
                  <select id={`counter-method-${item.id}`} className="portal-select" style={{ width: 'auto' }} value={methodOf(item.id)} disabled={busyKey !== null}
                    onChange={(event) => setMethods((current) => ({ ...current, [item.id]: event.target.value as CounterMethod }))}>
                    {METHODS.map((method) => <option key={method.value} value={method.value}>{t(method.vi, method.en)}</option>)}
                  </select>
                  <button type="button" className="btn-primary btn-sm" disabled={busyKey !== null} onClick={() => void collect(item)}>
                    {busyKey === `sub-${item.id}` ? t('Đang xử lý…', 'Processing…') : t('Xác nhận thu tiền', 'Confirm payment')}
                  </button>
                  <button type="button" className="btn-secondary btn-sm" disabled={busyKey !== null} onClick={() => void cancel(item)}>{t('Hủy yêu cầu', 'Cancel request')}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="portal-card">
        <h2 className="portal-card-title">{t(`Buổi PT 1:1 chờ thu tiền (${unpaidPt.length})`, `1:1 sessions awaiting payment (${unpaidPt.length})`)}</h2>
        {loading ? <LoadingSkeleton label={t('Đang tải buổi PT…', 'Loading 1:1 sessions…')} count={2} /> : unpaidPt.length === 0 ? (
          <p className="muted" role="status">{t('Không có buổi PT nào chờ thu tiền.', 'No 1:1 sessions are waiting for payment.')}</p>
        ) : (
          <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-label={t('Buổi PT chờ thu tiền', '1:1 sessions awaiting payment')}>
            {unpaidPt.map((item) => (
              <li key={item.id} data-testid={`counter-pt-${item.id}`} className="portal-card" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <strong>{item.memberName}</strong>
                  <div className="muted">PT #{item.id} · {t('HLV', 'Coach')} {item.coachName} · {item.bookingDate} {item.startTime.slice(0, 5)}–{item.endTime.slice(0, 5)} · <strong>{formatVnd(item.hourlyRate)}</strong></div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn-primary btn-sm" disabled={busyKey !== null} onClick={() => void collectPt(item, 'cash')}>
                    {busyKey === `pt-${item.id}` ? t('Đang xử lý…', 'Processing…') : t('Đã thu tiền mặt', 'Cash collected')}
                  </button>
                  <button type="button" className="btn-secondary btn-sm" disabled={busyKey !== null} onClick={() => void collectPt(item, 'bank_transfer')}>{t('Đã nhận chuyển khoản', 'Bank transfer received')}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {confirmDialog}
      {invoice && <PaymentInvoice payment={invoice.payment} memberName={invoice.memberName} membershipCode={invoice.membershipCode} packageName={invoice.packageName}
        cashierName={getCurrentUser()?.name} onClose={() => setInvoice(null)} />}
    </section>
  );
}
