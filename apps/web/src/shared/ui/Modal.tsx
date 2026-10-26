import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
}

/** Hộp thoại dựa trên <dialog> gốc: có sẵn focus trap, phím Esc và backdrop. */
export function Modal({ title, onClose, children, busy = false }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  return (
    <dialog
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-busy={busy}
      className="portal-dialog"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className="portal-dialog__body" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <div className="portal-dialog__header">
          <h2 id={titleId} className="portal-card-title">{title}</h2>
          <button type="button" className="portal-dialog__close" aria-label="Đóng hộp thoại" disabled={busy} onClick={onClose}>
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
