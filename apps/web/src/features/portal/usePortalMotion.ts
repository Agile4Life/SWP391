import { useLayoutEffect, type RefObject } from 'react';

/** Khối nội dung portal được reveal; trang mới chỉ cần dùng các class này hoặc gắn `data-reveal`. */
export const PORTAL_REVEAL_SELECTOR = [
  '[data-reveal]',
  '.portal-header',
  '.portal-tabs',
  '.portal-card',
  '.row-card',
  '.portal-table-wrapper',
  '.portal-state',
  '.portal-empty',
  '.portal-alert',
].join(', ');

/** Vùng tự quản lý chuyển động (3D, hộp thoại, skeleton tĩnh) hoặc đã tắt bằng `data-motion="off"`. */
const EXCLUDED = '[data-motion="off"], dialog, .explore3d-page, .portal-route-loading, .portal-skeleton';
/** Thẻ bố cục có thể chứa nhiều phần nhỏ; hook đi vào trong thay vì coi cả khối là một phần. */
const PART_GROUP_TAGS = 'div, section, article, header, footer, nav, form, ul, ol, dl';
/** Đơn vị nội dung trọn vẹn: luôn là một phần nhỏ, không tách tiếp (nhãn + ô nhập, dòng thông tin, hàng danh sách…). */
const PART_ATOMIC = '.portal-form-group, .kv-row, .row-card, .stat-pill, .badge, .ui-select, .action-menu, .portal-alert, .portal-state, .portal-empty, .portal-tabs';
/** Không tách thành phần nhỏ: lớp nổi, nội dung ẩn, bảng (hàng đã có hiệu ứng riêng), chỉ báo đang tải. */
const PART_SKIP = 'dialog, script, style, template, [hidden], .sr-only, table, .portal-table-wrapper, .spinner, [data-motion="off"]';
const MAX_PARTS = 12;
const STAGGER_MS = 55;
const MAX_STAGGER_STEPS = 6;

/**
 * Reveal từng component trong vùng nội dung portal khi vào viewport, phát lại ở cả hai chiều cuộn.
 * Cuộn vẫn native; component còn thấy một phần giữ nguyên trạng thái; không có IntersectionObserver
 * hoặc bật reduced motion thì nội dung hiện đầy đủ, không đăng ký gì.
 */
export function usePortalMotion(container: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const root = container.current;
    if (!root || typeof IntersectionObserver === 'undefined' || typeof window.matchMedia !== 'function') return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const targets = new Set<HTMLElement>();
    let observer: IntersectionObserver | undefined;

    /** Phần nhỏ bên trong một khối: con trực tiếp, đi sâu thêm tối đa hai cấp qua thẻ bố cục. */
    const collectParts = (element: HTMLElement, depth: number, parts: HTMLElement[]) => {
      const children = [...element.children].filter(
        (child): child is HTMLElement => child instanceof HTMLElement && !child.matches(PART_SKIP));
      children.forEach((child) => {
        const group = depth < 2 && child.children.length > 1 && child.matches(PART_GROUP_TAGS) && !child.matches(PART_ATOMIC);
        if (group) collectParts(child, depth + 1, parts);
        else parts.push(child);
      });
      return parts;
    };
    /** Đánh số các phần chưa có thứ tự; phần đang chạy animation riêng (spinner, popover…) được giữ nguyên. */
    const markParts = (element: HTMLElement) => {
      let index = 0;
      collectParts(element, 0, []).forEach((part) => {
        if (part.dataset.revealPart !== undefined) return;
        const ownAnimation = getComputedStyle(part).animationName;
        if (ownAnimation && ownAnimation !== 'none') return;
        part.dataset.revealPart = '';
        part.style.setProperty('--portal-part', String(Math.min(index++, MAX_PARTS)));
      });
    };
    const clearParts = (element: HTMLElement) => {
      element.querySelectorAll<HTMLElement>('[data-reveal-part]').forEach((part) => {
        delete part.dataset.revealPart;
        part.style.removeProperty('--portal-part');
      });
    };
    const eligible = (element: HTMLElement) =>
      !element.closest(EXCLUDED) && !element.parentElement?.closest(PORTAL_REVEAL_SELECTOR);
    const register = (element: HTMLElement) => {
      if (!observer || targets.has(element) || !eligible(element)) return;
      targets.add(element);
      element.classList.add('portal-reveal-ready');
      markParts(element);
      observer.observe(element);
    };
    const unregister = (element: HTMLElement) => {
      if (!targets.delete(element)) return;
      observer?.unobserve(element);
      element.classList.remove('portal-reveal-ready', 'is-visible');
      clearParts(element);
      element.style.removeProperty('--portal-reveal-delay');
      delete element.dataset.revealDirection;
    };
    const visit = (node: Node, callback: (element: HTMLElement) => void) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.matches(PORTAL_REVEAL_SELECTOR)) callback(node);
      node.querySelectorAll<HTMLElement>(PORTAL_REVEAL_SELECTOR).forEach(callback);
    };
    const onIntersect: IntersectionObserverCallback = (entries) => {
      const entering: IntersectionObserverEntry[] = [];
      entries.forEach((entry) => {
        const element = entry.target as HTMLElement;
        if (entry.isIntersecting) {
          if (!element.classList.contains('is-visible')) entering.push(entry);
        } else {
          // Chỉ chuẩn bị lại khi đã rời hẳn viewport; hướng vào lần sau theo phía component vừa rời đi.
          element.dataset.revealDirection = entry.boundingClientRect.top < 0 ? 'up' : 'down';
          element.classList.remove('is-visible');
        }
      });
      entering
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
        .forEach((entry, index) => {
          const element = entry.target as HTMLElement;
          element.style.setProperty('--portal-reveal-delay', `${Math.min(index, MAX_STAGGER_STEPS) * STAGGER_MS}ms`);
          element.classList.add('is-visible');
        });
    };
    const configure = () => {
      observer?.disconnect();
      observer = undefined;
      [...targets].forEach(unregister);
      if (preference.matches) return;
      observer = new IntersectionObserver(onIntersect, { threshold: 0 });
      root.querySelectorAll<HTMLElement>(PORTAL_REVEAL_SELECTOR).forEach(register);
    };
    const onFocus = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      const element = event.target.closest<HTMLElement>('.portal-reveal-ready');
      if (!element || element.classList.contains('is-visible')) return;
      element.style.setProperty('--portal-reveal-delay', '0ms');
      element.classList.add('is-visible');
    };

    configure();
    const mutations = new MutationObserver((changes) => {
      const grown = new Set<HTMLElement>();
      changes.forEach((change) => {
        change.removedNodes.forEach((node) => visit(node, unregister));
        change.addedNodes.forEach((node) => visit(node, register));
        // Nội dung mới bên trong khối đã đăng ký (dữ liệu vừa tải, kết quả lọc) cũng hiện lệch nhịp.
        const owner = change.addedNodes.length > 0 && change.target instanceof HTMLElement
          ? change.target.closest<HTMLElement>('.portal-reveal-ready') : null;
        if (owner && targets.has(owner)) grown.add(owner);
      });
      grown.forEach(markParts);
    });
    mutations.observe(root, { childList: true, subtree: true });
    preference.addEventListener('change', configure);
    root.addEventListener('focusin', onFocus);
    return () => {
      mutations.disconnect();
      preference.removeEventListener('change', configure);
      root.removeEventListener('focusin', onFocus);
      observer?.disconnect();
      [...targets].forEach(unregister);
    };
  }, [container]);
}
