const TARGETS = 'a, button, [role="button"], .btn-primary, .btn-secondary, .btn-danger';
const IGNORE_CONTAINERS = '.ui-select, .luxury-datepicker-wrap, .luxury-timepicker-wrap';
const RIPPLE_FALLBACK_MS = 750;

/** Gắn một lần: vòng sóng tại điểm click trên nút hành động (bỏ qua dropdown/datepicker). */
export function installClickRipple(): void {
  const reducedMotionQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  document.addEventListener('pointerdown', (e) => {
    if (reducedMotionQuery?.matches) return;
    if (e.button !== 0) return;
    const target = e.target as Element | null;
    if (!target || target.closest(IGNORE_CONTAINERS)) return;
    const el = target.closest(TARGETS);
    if (!el || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return;

    const ripple = document.createElement('span');
    ripple.className = 'click-ripple';
    ripple.setAttribute('aria-hidden', 'true');
    ripple.style.left = `${e.clientX}px`;
    ripple.style.top = `${e.clientY}px`;
    let removed = false;
    const cleanup = () => {
      if (removed) return;
      removed = true;
      window.clearTimeout(fallbackTimer);
      ripple.remove();
    };
    const fallbackTimer = window.setTimeout(cleanup, RIPPLE_FALLBACK_MS);
    ripple.addEventListener('animationend', cleanup, { once: true });
    ripple.addEventListener('animationcancel', cleanup, { once: true });
    document.body.appendChild(ripple);
  });
}
