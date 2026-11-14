import type { SourceMessage } from '../../shared/i18n/language';
import { useLanguage } from '../../shared/i18n/language';
import { sourceMessage, useI18n } from '../../shared/i18n';
import { useEffect, useRef, useState } from 'react';
import { localizableError } from '../../shared/lib/errorMessage';
import { notify } from '../../shared/lib/portalNotices';
import { payWithWallet } from '../wallet/walletApi';
import { createVnpayCheckout, navigateToVnpay, type VnpayTarget } from './vnpayApi';
import { cancelVnpayTarget, releaseAbandonedVnpay, rememberActiveVnpay } from './vnpaySession';

function isAwaitingVnpayError(cause: unknown): boolean {
  if (!cause || typeof cause !== 'object') return false;
  const code = (cause as { code?: string }).code;
  return code === 'VNPAY_AWAITING_CONFIRMATION' || code === 'ORDER_AWAITING_PAYMENT';
}

export function VnpayPayButton({
  target,
  prepare,
  disabled = false,
  onPaid,
}: {
  target?: VnpayTarget;
  prepare?: () => Promise<VnpayTarget>;
  disabled?: boolean;
  onPaid?: () => void;
}) {
  useLanguage();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [awaitingLockTarget, setAwaitingLockTarget] = useState<VnpayTarget | null>(null);
  const [error, setError] = useState<string | Error | SourceMessage>('');
  const sending = useRef(false);

  useEffect(() => {
    if (typeof releaseAbandonedVnpay === 'function') {
      void releaseAbandonedVnpay();
    }
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
      setError(localizableError(reason, 'Không thể mở thanh toán VNPay. Vui lòng thử lại.'));
      setBusy(false);
      sending.current = false;
    }
  }

  async function handlePayWithWallet() {
    if (sending.current || disabled) return;
    sending.current = true;
    setWalletBusy(true);
    setError('');
    setAwaitingLockTarget(null);
    let resolvedOrder: VnpayTarget | undefined = target;
    try {
      const order = prepare ? await prepare() : target;
      resolvedOrder = order;
      if (!order) throw Object.assign(new Error('Không tìm thấy khoản cần thanh toán.'), { translation: sourceMessage('Không tìm thấy khoản cần thanh toán.', "Payment item not found.") });
      await payWithWallet(order);
      window.dispatchEvent(new CustomEvent('wallet-updated'));
      window.dispatchEvent(new CustomEvent('member-notifications-changed'));
      notify(t("Thanh toán bằng Ví SÖL thành công.", "SÖL Wallet payment successful."), 'success', { translation: sourceMessage("Thanh toán bằng Ví SÖL thành công.", "SÖL Wallet payment successful."),  record: true });
      onPaid?.();
    } catch (reason) {
      if (isAwaitingVnpayError(reason) && resolvedOrder) {
        setAwaitingLockTarget(resolvedOrder);
      }
      setError(localizableError(reason, 'Không thể thanh toán bằng Ví SÖL. Vui lòng kiểm tra số dư hoặc nạp thêm tiền vào Ví.'));
    } finally {
      setWalletBusy(false);
      sending.current = false;
    }
  }

  async function handleUnlock() {
    const lockTarget = awaitingLockTarget ?? target;
    if (!lockTarget || unlockBusy || typeof cancelVnpayTarget !== 'function') return;
    setUnlockBusy(true);
    try {
      await cancelVnpayTarget(lockTarget);
      setError('');
      setAwaitingLockTarget(null);
      window.dispatchEvent(new CustomEvent('vnpay-attempt-released'));
    } catch (reason) {
      setError(localizableError(reason, 'Không thể mở khóa giao dịch VNPay. Vui lòng thử lại.'));
    } finally {
      setUnlockBusy(false);
    }
  }

  return (
    <div className="stack" data-i18n-managed>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn-primary" disabled={busy || walletBusy || unlockBusy || disabled} onClick={() => void pay()}>
          {busy ? t("Đang chuyển tới VNPay…", "Redirecting to VNPay…") : t("Thanh toán VNPay", "Pay with VNPay")}
        </button>
        <button
          type="button"
          className="btn-secondary"
          data-testid="pay-with-wallet-btn"
          disabled={busy || walletBusy || unlockBusy || disabled}
          onClick={() => void handlePayWithWallet()}
        >
          {walletBusy ? t("Đang trừ Ví…", "Charging wallet…") : t("Thanh toán bằng Ví SÖL", "Pay with SÖL Wallet")}
        </button>
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
    </div>
  );
}
