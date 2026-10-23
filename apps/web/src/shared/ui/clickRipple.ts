const TARGETS = 'a, button, [role="button"], .btn-primary, .btn-secondary, .btn-danger';
const IGNORE_CONTAINERS = '.ui-select, .luxury-datepicker-wrap, .luxury-timepicker-wrap';

/** Gắn một lần: vòng sóng tại điểm click trên nút hành động (bỏ qua dropdown/datepicker). */
export function installClickRipple(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const target = e.target as Element | null;
    if (!target || target.closest(IGNORE_CONTAINERS)) return;
    const el = target.closest(TARGETS);
    if (!el || (el as HTMLButtonElement).disabled) return;

    const ripple = document.createElement('span');
    ripple.className = 'click-ripple';
    ripple.style.left = `${e.clientX}px`;
    ripple.style.top = `${e.clientY}px`;
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    document.body.appendChild(ripple);
  });
}
