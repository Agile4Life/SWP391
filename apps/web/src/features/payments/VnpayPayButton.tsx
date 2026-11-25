import type { SourceMessage } from '../../shared/i18n/language';
import { useLanguage } from '../../shared/i18n/language';
import { sourceMessage, useI18n } from '../../shared/i18n';
import { useEffect, useRef, useState } from 'react';
import { formatPrice } from '../../shared/lib/membershipPresentation';
import { notify } from '../../shared/lib/portalNotices';
import { useConfirm } from '../../shared/ui/ConfirmDialog';
import { payWithWallet } from '../wallet/walletApi';
import { createVnpayCheckout, navigateToVnpay, type VnpayTarget } from './vnpayApi';
import { cancelVnpayTarget, releaseAbandonedVnpay, rememberActiveVnpay } from './vnpaySession';

/** Lỗi cho biết giao dịch VNPay trước đó vẫn đang chờ xác nhận (nên cần mở khóa). */
function isAwaitingVnpayError(cause: unknown): boolean {
  if (!cause || typeof cause !== 'object') return false;
  const code = (cause as { code?: string }).code;
  return code === 'VNPAY_AWAITING_CONFIRMATION' || code === 'ORDER_AWAITING_PAYMENT';
}

function toLocalizableError(reason: unknown, vi: string, en: string): Error | SourceMessage {
  return reason instanceof Error && reason.name === 'Error' && reason.message ? reason : sourceMessage(vi, en);
}

/**
 * Nút thanh toán một khoản bằng VNPay hoặc Ví SÖL: lấy đối tượng thanh toán (target hoặc prepare), mở cổng
 * VNPay hay trừ ví, và cho phép mở khóa giao dịch đang chờ xác nhận.
 */
export function VnpayPayButton({
  target,
  prepare,
  amount,
  disabled = false,
  allowWallet = true,
  onPaid,
}: {
  target?: VnpayTarget;
  prepare?: () => Promise<VnpayTarget>;
  amount?: number;
  disabled?: boolean;
  allowWallet?: boolean;
  onPaid?: () => void;
}) {
  useLanguage();
  const { t } = useI18n();
  const [confirm, confirmDialog] = useConfirm();
  const [busy, setBusy] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [awaitingLockTarget, setAwaitingLockTarget] = useState<VnpayTarget | null>(null);
  const [error, setError] = useState<string | Error | SourceMessage>('');
  const sending = useRef(false);
  const unlocking = useRef(false);

  useEffect(() => {
    if (typeof releaseAbandonedVnpay === 'function') {
      void releaseAbandonedVnpay();
    }
    // Quay lại trang từ bộ nhớ đệm thì mở lại nút và hủy phiên VNPay bỏ dở.
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      sending.current = false;
      setBusy(false);
      setWalletBusy(false);
      if (typeof releaseAbandonedVnpay === 'function') {
        void releaseAbandonedVnpay();
      }
    };
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, []);

  // Thanh toán qua VNPay: chuẩn bị đối tượng, tạo phiên thanh toán rồi chuyển sang cổng VNPay.
  async function pay() {
    if (sending.current || disabled) return;
    sending.current = true;
    setBusy(true);
    setError('');
    setAwaitingLockTarget(null);
    let resolvedOrder: VnpayTarget | undefined = target;
    try {
      const order = prepare ? await prepare() : target;
      resolvedOrder = order;
      if (!order) throw Object.assign(new Error('Không tìm thấy khoản cần thanh toán.'), { translation: sourceMessage('Không tìm thấy khoản cần thanh toán.', "Payment item not found.") });
      const checkout = await createVnpayCheckout(order);
      if (checkout.reference && typeof rememberActiveVnpay === 'function') {
        rememberActiveVnpay(checkout.reference);
      }
      navigateToVnpay(checkout.paymentUrl);
    } catch (reason) {
      if (isAwaitingVnpayError(reason) && resolvedOrder) {
        setAwaitingLockTarget(resolvedOrder);
      }
      setError(toLocalizableError(reason, 'Không thể mở thanh toán VNPay. Vui lòng thử lại.', 'Unable to open VNPay payment. Please try again.'));
      setBusy(false);
      sending.current = false;
    }
  }

  // Thanh toán bằng số dư Ví SÖL sau khi xác nhận, thành công thì cập nhật ví/thông báo và gọi onPaid.
  async function handlePayWithWallet() {
    if (!allowWallet || sending.current || disabled) return;
    const formattedAmount = typeof amount === 'number' && Number.isFinite(amount) && amount > 0 ? formatPrice(amount) : null;
    const confirmed = await confirm({
      title: sourceMessage('Xác nhận thanh toán bằng Ví SÖL?', 'Confirm SÖL Wallet payment?'),
      message: formattedAmount
        ? sourceMessage(
          `Số tiền ${formattedAmount} sẽ được trừ trực tiếp từ số dư Ví SÖL của bạn.`,
          `${formattedAmount} will be deducted directly from your SÖL Wallet balance.`,
        )
        : sourceMessage(
          'Số tiền thanh toán sẽ được trừ trực tiếp từ số dư Ví SÖL của bạn.',
          'The payment amount will be deducted directly from your SÖL Wallet balance.',
        ),
      confirmLabel: sourceMessage('Xác nhận thanh toán', 'Confirm payment'),
      cancelLabel: sourceMessage('Hủy', 'Cancel'),
    });
    if (!confirmed || sending.current || disabled) return;
    sending.current = true;
    setWalletBusy(true);
    setError('');
    setAwaitingLockTarget(null);
    let resolvedOrder: VnpayTarget | undefined = target;
    try {
      const order = prepare ? await prepare() : target;
      resolvedOrder = order;
      if (!order) throw Object.assign(new Error('Không tìm thấy khoản cần thanh toán.'), { translation: sourceMessage('Không tìm thấy khoản cần thanh toán.', 'Payment item not found.') });
      await payWithWallet(order);
      window.dispatchEvent(new CustomEvent('wallet-updated'));
      window.dispatchEvent(new CustomEvent('member-notifications-changed'));
      notify(t("Thanh toán bằng Ví SÖL thành công.", "SÖL Wallet payment successful."), 'success', { translation: sourceMessage("Thanh toán bằng Ví SÖL thành công.", "SÖL Wallet payment successful."),  record: true });
      onPaid?.();
    } catch (reason) {
      if (isAwaitingVnpayError(reason) && resolvedOrder) {
        setAwaitingLockTarget(resolvedOrder);
      }
      setError(toLocalizableError(
        reason,
        'Không thể thanh toán bằng Ví SÖL. Vui lòng kiểm tra số dư hoặc nạp thêm tiền vào Ví.',
        'Unable to pay with SÖL Wallet. Please check your balance or top up your wallet.',
      ));
    } finally {
      setWalletBusy(false);
      sending.current = false;
    }
  }

  // Mở khóa giao dịch VNPay đang chờ xác nhận bằng cách hủy nó.
  async function handleUnlock() {
    const lockTarget = awaitingLockTarget ?? target;
    if (!lockTarget || unlocking.current || typeof cancelVnpayTarget !== 'function') return;
    unlocking.current = true;
    setUnlockBusy(true);
    try {
      await cancelVnpayTarget(lockTarget);
      setError('');
      setAwaitingLockTarget(null);
      window.dispatchEvent(new CustomEvent('vnpay-attempt-released'));
    } catch (reason) {
      setError(toLocalizableError(reason, 'Không thể mở khóa giao dịch VNPay. Vui lòng thử lại.', 'Unable to unlock VNPay transaction. Please try again.'));
    } finally {
      unlocking.current = false;
      setUnlockBusy(false);
    }
  }

  return (
    <div className="stack" data-i18n-managed>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn-primary" disabled={busy || walletBusy || unlockBusy || disabled} onClick={() => void pay()}>
          {busy ? t("Đang chuyển tới VNPay…", "Redirecting to VNPay…") : t("Thanh toán VNPay", "Pay with VNPay")}
        </button>
        {allowWallet && (
          <button
            type="button"
            className="btn-secondary"
            data-testid="pay-with-wallet-btn"
            disabled={busy || walletBusy || unlockBusy || disabled}
            onClick={() => void handlePayWithWallet()}
          >
            {walletBusy ? t("Đang trừ Ví…", "Charging wallet…") : t("Thanh toán bằng Ví SÖL", "Pay with SÖL Wallet")}
          </button>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {t(error)}
        </p>
      )}
      {awaitingLockTarget && (
        <div>
          <button
            type="button"
            className="btn-secondary btn-sm"
            disabled={unlockBusy}
            onClick={() => void handleUnlock()}
          >
            {unlockBusy ? t("Đang mở khóa…", "Unlocking…") : t("Đã thoát VNPay? Mở khóa giao dịch", "Exited VNPay? Unlock transaction")}
          </button>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
