import { useLayoutEffect, type RefObject } from 'react';

/** Replay entrances on viewport re-entry; document scrolling stays native. */
export function useComponentReveal(container: RefObject<HTMLDivElement | null>, route: string) {
  useLayoutEffect(() => {
    const root = container.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const targets = new Set<HTMLElement>();
    const heroSelector = '.fit-hero-title, .fit-hero-copy, .fit-hero-athlete, .fit-hero-anatomy-stage, .fit-hero-action';
    const selector = `[data-reveal], ${heroSelector}`;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let observer: IntersectionObserver | undefined;
    let previousScrollY = window.scrollY;
    let direction: 'up' | 'down' = 'down';
    const onScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY === previousScrollY) return;
      const nextDirection = currentScrollY < previousScrollY ? 'up' : 'down';
      previousScrollY = currentScrollY;
      if (nextDirection === direction) return;
      direction = nextDirection;
      targets.forEach((element) => {
        if (!element.classList.contains('is-visible')) element.dataset.revealDirection = direction;
      });
    };

    const reveal = (element: HTMLElement) => {
      if (preference.matches) return;
      element.classList.add('is-visible');
    };
    const register = (element: HTMLElement) => {
      if (preference.matches || targets.has(element)) return;
      if (element.matches(heroSelector)) element.dataset.reveal = 'hero';
      targets.add(element);
      element.classList.add('fit-reveal-ready');
      observer?.observe(element);
    };
    const unregister = (element: HTMLElement) => {
      observer?.unobserve(element);
      targets.delete(element);
      element.classList.remove('fit-reveal-ready', 'is-visible');
      delete element.dataset.revealDirection;
    };
    const visit = (node: Node, callback: (element: HTMLElement) => void) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.matches(selector)) callback(node);
      node.querySelectorAll<HTMLElement>(selector).forEach(callback);
    };
    const configure = () => {
      observer?.disconnect();
      [...targets].forEach(unregister);
      if (preference.matches) return;
      observer = new IntersectionObserver((entries) => {
        if (preference.matches) return;
        onScroll();
        entries.forEach((entry) => {
          const element = entry.target as HTMLElement;
          if (entry.isIntersecting && entry.intersectionRatio >= .12) {
            if (!element.classList.contains('is-visible')) element.dataset.revealDirection = direction;
            reveal(element);
          } else if (!entry.isIntersecting) {
            element.dataset.revealDirection = entry.boundingClientRect.top < 0 ? 'up' : 'down';
            element.classList.remove('is-visible');
          }
        });
      }, { threshold: [0, .12] });
      root.querySelectorAll<HTMLElement>(selector).forEach(register);
    };
    const onFocus = (event: FocusEvent) => {
      const element = (event.target as HTMLElement).closest<HTMLElement>('[data-reveal]');
      if (element && root.contains(element)) reveal(element);
    };

    configure();
    const mutations = new MutationObserver((changes) => changes.forEach((change) => {
      change.removedNodes.forEach((node) => visit(node, unregister));
      change.addedNodes.forEach((node) => visit(node, register));
    }));
    mutations.observe(root, { childList: true, subtree: true });
    preference.addEventListener('change', configure);
    window.addEventListener('scroll', onScroll, { passive: true });
    root.addEventListener('focusin', onFocus);
    return () => {
      observer?.disconnect();
      mutations.disconnect();
      preference.removeEventListener('change', configure);
      window.removeEventListener('scroll', onScroll);
      root.removeEventListener('focusin', onFocus);
      [...targets].forEach(unregister);
    };
  }, [container, route]);
}
