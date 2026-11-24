import { useEffect, useRef } from 'react';

/** Các cửa sổ nổi góc phải (Tin nhắn, Trợ lý AI) dùng chung một vị trí: mở cái này thì đóng cái kia. */
const FLOATING_PANEL_EVENT = 'sol-floating-panel';

/** Phát sự kiện báo một panel nổi vừa mở để các panel khác tự đóng. */
export function announceFloatingPanel(id: string) {
  window.dispatchEvent(new CustomEvent<string>(FLOATING_PANEL_EVENT, { detail: id }));
}

/** Hook đóng panel hiện tại khi một panel nổi khác (khác id) mở ra. */
export function useCloseWhenOtherPanelOpens(id: string, close: () => void) {
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; }, [close]);
  useEffect(() => {
    // Panel khác mở thì gọi hàm đóng mới nhất của panel này.
    const onOpen = (event: Event) => { if ((event as CustomEvent<string>).detail !== id) closeRef.current(); };
    window.addEventListener(FLOATING_PANEL_EVENT, onOpen);
    return () => window.removeEventListener(FLOATING_PANEL_EVENT, onOpen);
  }, [id]);
}
