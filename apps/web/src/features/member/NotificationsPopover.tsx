import { useLanguage } from '../../shared/i18n/language';
import { useI18n } from '../../shared/i18n';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { MemberNotificationsPanel } from './MemberNotificationsPage';

export function NotificationsPopover({ onClose, triggerRef }: { onClose: () => void; triggerRef: RefObject<HTMLElement | null> }) {
  useLanguage();
  const { t } = useI18n();
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<CSSProperties>();

  // Neo popover ngay dưới chuông: căn giữa theo nút, kẹp trong viewport.
  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 12;
    const width = Math.min(400, window.innerWidth - margin * 2);
    const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, margin), window.innerWidth - width - margin);
    const top = rect.bottom + 10;
    setPosition({ top, left, right: 'auto', maxHeight: Math.max(240, Math.min(560, window.innerHeight - top - margin)) });
  }, [triggerRef]);

  useLayoutEffect(() => {
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [place]);

  useEffect(() => {
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) onClose();
    };
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('keydown', escape);
      document.removeEventListener('pointerdown', outside);
    };
  }, [onClose, triggerRef]);

  return <section data-i18n-managed ref={panel} id="portal-notifications" className="notification-popover" style={position} role="dialog" aria-label={t('Thông báo', "Notifications")}>
    <header className="notification-popover__header"><h2>{t('Thông báo', "Notifications")}</h2><button ref={closeButton} type="button" className="portal-icon-button" aria-label={t('Đóng thông báo', "Close notification")} onClick={onClose}><span aria-hidden="true">×</span></button></header>
    <MemberNotificationsPanel onNavigate={onClose} />
  </section>;
}
