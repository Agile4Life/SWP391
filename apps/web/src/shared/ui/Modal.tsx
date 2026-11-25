import { useI18n } from '../i18n';
import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';

/** Props của hộp thoại: tiêu đề, hàm đóng, nội dung, đang bận, class và phần tử nhận lại focus khi đóng. */
interface ModalProps {
  title: ReactNode;
  // Gọi khi người dùng đóng hộp thoại.
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
  className?: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
  role?: 'dialog' | 'alertdialog';
  ariaDescribedBy?: string;
}

const FOCUSABLE_SELECTOR = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(', ');

/** Hộp thoại dựa trên <dialog> gốc: có sẵn focus trap, phím Esc và backdrop. */
export function Modal({
  title,
  onClose,
  children,
  busy = false,
  className,
  returnFocusRef,
  role = 'dialog',
  ariaDescribedBy,
}: ModalProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const pressStartedOnBackdrop = useRef(false);
  const returnFocusTargetRef = useRef(returnFocusRef);

  useEffect(() => {
    returnFocusTargetRef.current = returnFocusRef;
  }, [returnFocusRef]);

  useEffect(() => {
    const dialog = ref.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      const activeBeforeClose = document.activeElement;
      const focusWasInsideDialog = !activeBeforeClose || activeBeforeClose === document.body || Boolean(dialog?.contains(activeBeforeClose));
      if (dialog?.open) dialog.close();
      if (focusWasInsideDialog) {
        // Khi hủy thành công, khung chờ được thay bằng danh mục trước khi cleanup chạy.
        const returnTarget = returnFocusTargetRef.current?.current ?? previouslyFocused;
        if (returnTarget?.isConnected) returnTarget.focus({ preventScroll: true });
      }
    };
  }, []);

  return (
    <dialog
      ref={ref}
      role={role}
      aria-modal="true"
      aria-busy={busy}
      className={`portal-dialog ${className || ''}`.trim()}
      aria-labelledby={titleId}
      aria-describedby={ariaDescribedBy}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const dialog = event.currentTarget;
        if (event.target instanceof Element && event.target.closest('dialog') !== dialog) return;
        const controls = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
          .filter((element) => {
            if (element.closest('dialog') !== dialog) return false;
            if (element.tabIndex < 0) return false;
            if (element.matches(':disabled')) return false;
            if (element.getAttribute('aria-hidden') === 'true') return false;
            const closedDetails = element.closest('details:not([open])');
            if (closedDetails && !(element.tagName === 'SUMMARY' && element.parentElement === closedDetails)) return false;
            return element.getClientRects().length > 0;
          });
        const first = controls[0];
        const last = controls.at(-1);
        if (!first) { event.preventDefault(); dialog.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus(); }
      }}
      tabIndex={-1}
      onCancel={(e) => {
        // Đóng hộp thoại chọn tệp phát sự kiện `cancel` nổi bọt từ <input type="file">: đó không phải thao tác bấm Esc
        // của chính hộp thoại, nên không được đóng hộp thoại (tránh làm mất nội dung người dùng đã nhập).
        if (e.target !== e.currentTarget) return;
        e.stopPropagation();
        e.preventDefault();
        if (!busy) onClose();
      }}
      // Sự kiện click được phát trên dialog khi người dùng bôi đen chữ từ trong ô nhập kéo ra ngoài nền tối; chỉ thao tác
      // nhấn bắt đầu ngay trên nền tối mới là chủ ý bấm ra ngoài, nhờ đó không làm mất dữ liệu đang nhập.
      onPointerDown={(e) => { pressStartedOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => {
        const fromBackdrop = pressStartedOnBackdrop.current;
        pressStartedOnBackdrop.current = false;
        if (fromBackdrop && e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="portal-dialog__body">
        <div className="portal-dialog__header">
          <h2 id={titleId} className="portal-card-title">{title}</h2>
          <button type="button" className="portal-dialog__close" aria-label={t('Đóng hộp thoại')} disabled={busy} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
