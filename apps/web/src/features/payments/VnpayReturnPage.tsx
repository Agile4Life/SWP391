import type { SourceMessage } from '../../shared/i18n/language';
import { getLanguage, useLanguage } from '../../shared/i18n/language';
import { sourceMessage, useI18n } from '../../shared/i18n';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../shared/ui/PageHeader';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { formatPrice } from '../../shared/lib/membershipPresentation';
import { toast } from '../../shared/ui/toast';
import { getVnpayStatus, verifyVnpayReturn, type VnpayStatus } from './vnpayApi';
import { clearActiveVnpay } from './vnpaySession';

// Thanh toán Shop cũ trở về hóa đơn; giữ nguyên đích gói tập, lớp học và PT.
const destinations = new Set(['/member/packages', '/member/classes', '/member/classes?tab=pt', '/member/invoices']);
/** Chỉ cho phép đích quay về nằm trong danh sách cho phép. */
function isAllowedDestination(destination: string | null | undefined): destination is string {
  return Boolean(destination && destinations.has(destination));
}
function toLocalizableError(reason: unknown, vi: string, en: string): Error | SourceMessage {
  return reason instanceof Error && reason.name === 'Error' && reason.message ? reason : sourceMessage(vi, en);
}
/**
 * Trang VNPay chuyển về: xác minh chữ ký (nếu có) hoặc hỏi trạng thái giao dịch, tự kiểm tra lại tối đa 12 lần
 * mỗi 2,5 giây khi còn pending và báo kết quả.
 */
export function VnpayReturnPage() {
  useLanguage();
  const { t } = useI18n();
  const [params] = useSearchParams();
  const searchKey = params.toString();
  const reference = params.get('vnp_TxnRef') ?? '';
  const valid = /^[A-Za-z0-9]{1,32}$/.test(reference);
  const [data, setData] = useState<VnpayStatus | null>(null);
  const [error, setError] = useState<string | Error | SourceMessage>('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const verifiedCallbackRef = useRef<string | null>(null);
  useEffect(() => {
    let active = true; let timer: ReturnType<typeof setTimeout> | undefined; let attempts = 0; let notified = false;
    setData(null); setError(''); setLoading(true);
    if (!valid) { setLoading(false); return; }
    if (typeof clearActiveVnpay === 'function') clearActiveVnpay(reference);
    const currentParams = new URLSearchParams(searchKey);
    const hasSignedCallback = currentParams.has('vnp_SecureHash') && currentParams.has('vnp_ResponseCode');
    // Tải trạng thái giao dịch, báo toast một lần khi có kết quả và hẹn kiểm tra tiếp nếu còn pending.
    async function load() {
      try {
        let status: VnpayStatus;
        if (hasSignedCallback && verifiedCallbackRef.current !== searchKey && typeof verifyVnpayReturn === 'function') {
          status = await verifyVnpayReturn(Object.fromEntries(currentParams.entries()));
          verifiedCallbackRef.current = searchKey;
        } else {
          status = await getVnpayStatus(reference);
        }
        if (!active) return;
        setData(status); setError('');
        if (!notified && status.status !== 'pending') {
          notified = true;
          const isEn = getLanguage() === 'en';
          if (status.status === 'success') {
            const msg = sourceMessage('Thanh toán VNPay thành công', 'VNPay payment successful');
            toast.success(isEn ? msg.en : msg.vi, msg);
            window.dispatchEvent(new CustomEvent('wallet-updated'));
            window.dispatchEvent(new Event('member-notifications-changed'));
          } else if (status.status === 'failed') {
            const msg = sourceMessage('Thanh toán VNPay chưa thành công', 'VNPay payment unsuccessful');
            toast.error(isEn ? msg.en : msg.vi, msg);
          }
        }
        if (status.status === 'pending' && ++attempts < 12) timer = setTimeout(() => void load(), 2500);
      } catch (reason) {
        if (active) setError(toLocalizableError(reason, 'Không thể kiểm tra giao dịch. Vui lòng thử lại.', 'Unable to verify transaction. Please try again.'));
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [searchKey, reference, valid, retry]);
  const title = data?.status === 'success' ? t("Thanh toán thành công", "Payment successful") : data?.status === 'failed' ? t("Thanh toán chưa thành công", "Payment unsuccessful") : data?.status === 'refunded' ? t("Giao dịch đã hoàn tiền", "Transaction refunded") : t("Đang xác nhận thanh toán", "Confirming payment");
  return <div data-i18n-managed className="portal-container" >
    <PageHeader title={t("Kết quả thanh toán", "Payment result")} />
    <section data-i18n-managed className="portal-card stack">
      {!valid ? <p className="form-error" role="alert">{t("Không tìm thấy mã giao dịch. Vui lòng mở từ giao dịch của bạn.", "Transaction reference missing. Open this page from your transaction.")}</p> : loading ? <LoadingSkeleton label={t("Đang kiểm tra với hệ thống…", "Checking with the system…")} count={2} /> : error ? <p className="form-error" role="alert">{t(error)}</p> : data && <>
        <h2 className={`payment-result__title payment-result__title--${data.status}`} aria-live="polite">{title}</h2>
        <p className="payment-result__amount" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPrice(data.amount)}</p>
        <dl className="payment-result__ref"><dt>{t("Mã giao dịch", "Transaction reference")}</dt><dd style={{ fontVariantNumeric: 'tabular-nums' }}>{data.reference}</dd></dl>
        {data.status === 'pending' && <p className="hold-notice hold-notice--info">{t("Chưa nhận được xác nhận từ VNPay. Vui lòng chờ, đừng thanh toán lại. Nếu quá lâu, liên hệ lễ tân.", "No confirmation from VNPay yet. Please wait and do not pay again. If it takes too long, contact the front desk.")}</p>}
        {data.status === 'failed' && <p className="hold-notice hold-notice--warn">{t("Giao dịch không thành công. Bạn có thể thử lại.", "The transaction failed. You can try again.")}</p>}
        <Link className="btn-primary" to={isAllowedDestination(data.destination) ? data.destination : '/member/invoices'}>{t("Về khoản thanh toán", "Back to payment")}</Link>
      </>}
      {valid && (error || data?.status === 'pending') && <button type="button" className="btn-secondary" onClick={() => setRetry(value => value + 1)}>{t("Kiểm tra lại", "Check again")}</button>}
      {(!valid || error || data?.status === 'pending' || (data && isAllowedDestination(data.destination) && data.destination !== '/member/invoices')) && (
        <Link className="btn-secondary" to="/member/invoices">{t("Giao dịch & hóa đơn", "Transactions & invoices")}</Link>
      )}
    </section>
  </div>;
}
