import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Hộp thoại dựa trên <dialog> gốc: có sẵn focus trap, phím Esc và backdrop. */
export function Modal({ title, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="portal-dialog"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      aria-labelledby="portal-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="portal-dialog__body" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <div className="portal-dialog__header">
          <h2 id="portal-dialog-title" className="portal-card-title">{title}</h2>
          <button type="button" className="portal-dialog__close" aria-label="Đóng" onClick={onClose}>
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
