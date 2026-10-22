import { useLayoutEffect, type RefObject } from 'react';

/** Reveal components once; document scrolling stays entirely native. */
export function useComponentReveal(container: RefObject<HTMLDivElement | null>, route: string) {
  useLayoutEffect(() => {
    const root = container.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const targets = [...root.querySelectorAll<HTMLElement>('[data-reveal]')];
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let observer: IntersectionObserver | undefined;

    const reveal = (element: HTMLElement) => {
      element.classList.add('is-visible');
      observer?.unobserve(element);
    };
    const configure = () => {
      observer?.disconnect();
      if (preference.matches) {
        targets.forEach((element) => element.classList.remove('fit-reveal-ready', 'is-visible'));
        return;
      }
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) reveal(entry.target as HTMLElement);
        });
      }, { threshold: .12, rootMargin: '0px 0px -24px 0px' });
      targets.forEach((element) => {
        if (element.classList.contains('is-visible')) return;
        element.classList.add('fit-reveal-ready');
        observer?.observe(element);
      });
    };
    const onFocus = (event: FocusEvent) => {
      const element = (event.target as HTMLElement).closest<HTMLElement>('[data-reveal]');
      if (element && root.contains(element)) reveal(element);
    };

    configure();
    preference.addEventListener('change', configure);
    root.addEventListener('focusin', onFocus);
    return () => {
      observer?.disconnect();
      preference.removeEventListener('change', configure);
      root.removeEventListener('focusin', onFocus);
      targets.forEach((element) => element.classList.remove('fit-reveal-ready', 'is-visible'));
    };
  }, [container, route]);
}
