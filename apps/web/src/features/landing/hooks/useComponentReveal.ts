import { useLayoutEffect, type RefObject } from 'react';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Replay entrances on viewport re-entry and drive scroll-linked UI progress; document scrolling stays native. */
export function useComponentReveal(container: RefObject<HTMLDivElement | null>, route: string) {
  useLayoutEffect(() => {
    const root = container.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const targets = new Set<HTMLElement>();
    const heroSelector = '.fit-hero-title, .fit-hero-copy, .fit-hero-athlete, .fit-hero-anatomy-stage, .fit-hero-action';
    const selector = `[data-reveal], ${heroSelector}`;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let observer: IntersectionObserver | undefined;
    let sectionObserver: IntersectionObserver | undefined;
    let previousScrollY = window.scrollY;
    let direction: 'up' | 'down' = 'down';

    const syncScrollEffects = () => {
      const currentScrollY = window.scrollY;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = clamp(currentScrollY / maxScroll, 0, 1);
      root.style.setProperty('--fit-scroll-progress', preference.matches ? '0' : progress.toFixed(4));

      const header = root.querySelector<HTMLElement>('.fit-header');
      if (header) {
        header.classList.toggle('is-scrolled', currentScrollY > 36);
      }

      if (preference.matches) return;

      const hero = root.querySelector<HTMLElement>('.fit-hero');
      if (hero) {
        const heroHeight = Math.max(1, hero.offsetHeight);
        const heroProgress = clamp(currentScrollY / heroHeight, 0, 1);
        hero.style.setProperty('--fit-hero-scroll', heroProgress.toFixed(3));
      }

      root.querySelectorAll<HTMLElement>('[data-scroll-scrub="manifesto"]').forEach((manifesto) => {
        const rect = manifesto.getBoundingClientRect();
        const start = window.innerHeight * 0.88;
        const end = window.innerHeight * 0.28;
        const scrub = clamp((start - rect.top) / Math.max(1, start - end), 0, 1);
        const words = manifesto.querySelectorAll<HTMLElement>('.fit-manifesto-word > span');
        const total = Math.max(1, words.length);
        words.forEach((word, index) => {
          const wordStart = (index / total) * 0.76;
          const wordProgress = clamp((scrub - wordStart) / 0.24, 0, 1);
          word.style.opacity = (0.18 + wordProgress * 0.82).toFixed(3);
        });
      });

      const finalCta = root.querySelector<HTMLElement>('.fit-final-cta');
      if (finalCta) {
        const rect = finalCta.getBoundingClientRect();
        const ctaProgress = clamp((window.innerHeight - rect.top) / Math.max(1, window.innerHeight * 0.72), 0, 1);
        finalCta.style.setProperty('--fit-cta-progress', ctaProgress.toFixed(3));
      }
    };

    const onScroll = () => {
      const currentScrollY = window.scrollY;
      syncScrollEffects();
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
      sectionObserver?.disconnect();
      [...targets].forEach(unregister);
      if (preference.matches) {
        root.style.setProperty('--fit-scroll-progress', '0');
        root.querySelector<HTMLElement>('.fit-hero')?.style.removeProperty('--fit-hero-scroll');
        root.querySelectorAll<HTMLElement>('.fit-manifesto-word > span').forEach((word) => {
          word.style.opacity = '1';
        });
        root.querySelector<HTMLElement>('.fit-final-cta')?.style.removeProperty('--fit-cta-progress');
        return;
      }
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

      const trackedSections = root.querySelectorAll<HTMLElement>('section[id]');
      if (trackedSections.length > 0) {
        sectionObserver = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const id = entry.target.getAttribute('id');
            if (!id) return;
            root.querySelectorAll<HTMLElement>('.fit-nav a[data-nav-target]').forEach((link) => {
              link.classList.toggle('is-active', link.dataset.navTarget === id);
            });
          });
        }, { rootMargin: '-40% 0px -50% 0px' });
        trackedSections.forEach((section) => sectionObserver?.observe(section));
      }

      syncScrollEffects();
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
    window.addEventListener('resize', syncScrollEffects, { passive: true });
    root.addEventListener('focusin', onFocus);
    return () => {
      observer?.disconnect();
      sectionObserver?.disconnect();
      mutations.disconnect();
      preference.removeEventListener('change', configure);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', syncScrollEffects);
      root.removeEventListener('focusin', onFocus);
      [...targets].forEach(unregister);
    };
  }, [container, route]);
}
