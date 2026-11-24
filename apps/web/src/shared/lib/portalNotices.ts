import { useSyncExternalStore } from 'react';
import type { SourceMessage } from '../i18n/language';
import { toast } from '../ui/toast';

/**
 * Thông báo phát sinh tại client (kết quả thao tác, trạng thái đồng bộ…) thay cho banner chèn trong trang.
 * Mọi thao tác đều có toast ngắn (thành công/lỗi) để phản hồi ngay; chỉ sự kiện quan trọng
 * (giao dịch, thanh toán, xác nhận, đăng ký/hủy/bảo lưu gói…) mới truyền `record: true` để lưu vào bảng chuông.
 */
export type PortalNoticeType = 'success' | 'error' | 'info';

/**
 * Một thông báo trong portal: loại, nội dung (kèm bản dịch), thời điểm, đã đọc chưa, đường dẫn đích và khóa
 * chống trùng.
 */
export interface PortalNotice {
  id: number;
  type: PortalNoticeType;
  message: string;
  translation?: SourceMessage;
  createdAt: number;
  read: boolean;
  destination?: string;
  key?: string;
  action?: { label: string; run: () => void; translation?: SourceMessage };
}

const MAX_NOTICES = 30;
let notices: PortalNotice[] = [];
let sequence = 0;
const listeners = new Set<() => void>();

/** Thay danh sách thông báo và báo cho các listener. */
function commit(next: PortalNotice[]) {
  notices = next;
  listeners.forEach((listener) => listener());
}

/** `key` thay thế thông báo cùng khóa (ví dụ trạng thái đồng bộ) để không lặp lại. */
export function notify(message: string, type: PortalNoticeType = 'info', options: { translation?: SourceMessage; key?: string; destination?: string; action?: PortalNotice['action']; silent?: boolean; record?: boolean } = {}) {
  if (type !== 'info' && !options.silent) {
    if (options.translation) toast(message, type, options.translation);
    else toast(message, type);
  }
  if (!options.record) return;
  // Nơi phát thông báo có thể chỉ định trang xem kết quả; mặc định giữ hành vi cũ cho các role khác.
  const notice: PortalNotice = { id: ++sequence, type, message, translation: options.translation, createdAt: Date.now(), read: false, destination: options.destination ?? (typeof window !== 'undefined' ? window.location.pathname : undefined), key: options.key, action: options.action };
  commit([notice, ...notices.filter((item) => !options.key || item.key !== options.key)].slice(0, MAX_NOTICES));
}

/** Gỡ thông báo theo khóa khi tình trạng đã hết (ví dụ đồng bộ lại thành công). */
export function resolveNotice(key: string) {
  if (notices.some((item) => item.key === key)) commit(notices.filter((item) => item.key !== key));
}

/** Đánh dấu mọi thông báo là đã đọc. */
export function markNoticesRead() {
  if (notices.some((item) => !item.read)) commit(notices.map((item) => ({ ...item, read: true })));
}

/** Xóa toàn bộ thông báo. */
export function clearNotices() {
  if (notices.length) commit([]);
}

/** Lấy danh sách thông báo hiện tại. */
export const getNotices = () => notices;
/** Đăng ký listener nhận thay đổi danh sách thông báo; trả về hàm hủy đăng ký. */
export function subscribeNotices(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Hook React đọc danh sách thông báo và tự render lại khi thay đổi. */
export function usePortalNotices(): PortalNotice[] {
  return useSyncExternalStore(subscribeNotices, getNotices, getNotices);
}
