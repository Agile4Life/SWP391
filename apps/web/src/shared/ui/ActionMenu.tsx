import { useI18n } from '../i18n';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { popoverPlacement, type PopoverPlacement } from './popoverPlacement';
import './action-menu.css';

/** Menu "⋯" cho thao tác ít dùng: giữ chúng trong tầm tay nhưng không chiếm chỗ cạnh nút chính. */
export function ActionMenu({ label, children }: { label?: string; children: ReactNode }) {
  const { t } = useI18n();
  const displayLabel = label ?? t('Thao tác khác', 'More actions');
  const root = useRef<HTMLDetailsElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<PopoverPlacement>({ v: 'down', h: 'right' });

  useEffect(() => {
    if (!isOpen) return;
    // Đóng menu bằng cách bỏ thuộc tính open của <details>.
    const close = () => {
      root.current?.removeAttribute('open');
      setIsOpen(false);
    };
    // Bấm ra ngoài menu thì đóng.
    const outside = (event: PointerEvent) => {
      if (root.current?.open && event.target instanceof Node && !root.current.contains(event.target)) close();
    };
    // Nhấn Esc thì chỉ đóng menu (không đóng <dialog> cha) và trả focus về nút mở menu.
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && root.current?.open) {
        event.preventDefault();
        event.stopPropagation();
        close();
        root.current.querySelector<HTMLElement>('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape, true);
    };
  }, [isOpen]);

  return <details
    ref={root}
    className="action-menu"
    onToggle={() => {
      const el = root.current;
      const nextOpen = Boolean(el?.open);
      setIsOpen(nextOpen);
      const trigger = el?.querySelector<HTMLElement>('summary');
      if (nextOpen && trigger) {
        const h = listRef.current?.offsetHeight || 120;
        const w = listRef.current?.offsetWidth || 190;
        setPlacement(popoverPlacement(trigger, w, h));
      }
    }}
  >
    <summary className="action-menu__trigger" aria-label={displayLabel} title={displayLabel}><span aria-hidden="true">⋯</span></summary>
    <div
      ref={listRef}
      className={`action-menu__list action-menu__list--${placement.v} action-menu__list--${placement.h}`}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('button, a')) {
          root.current?.removeAttribute('open');
          setIsOpen(false);
        }
      }}
    >
      {children}
    </div>
  </details>;
}
