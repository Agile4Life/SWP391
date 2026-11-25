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
}

/** Hộp thoại dựa trên <dialog> gốc: có sẵn focus trap, phím Esc và backdrop. */
export function Modal({ title, onClose, children, busy = false, className, returnFocusRef }: ModalProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const pressStartedOnBackdrop = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      // Khi hủy thành công, khung chờ được thay bằng danh mục trước khi cleanup chạy.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const returnTarget = returnFocusRef?.current;
      if (returnTarget?.isConnected) returnTarget.focus({ preventScroll: true });
    };
  }, [returnFocusRef]);

  return (
    <dialog
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-busy={busy}
      className={`portal-dialog ${className || ''}`.trim()}
      aria-labelledby={titleId}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const dialog = event.currentTarget;
        if (event.target instanceof Element && event.target.closest('dialog') !== dialog) return;
        const controls = [...dialog.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')]
          .filter(element => element.closest('dialog') === dialog && element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls.at(-1);
        if (!first) { event.preventDefault(); dialog.focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
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
