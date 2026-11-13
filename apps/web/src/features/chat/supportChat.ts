import { ApiError } from '../../shared/api/client';
import { sourceMessage } from '../../shared/i18n';
import type { ChatError } from './chatMessages';
import type { SupportMessage, SupportTicket } from '../member/memberSupportApi';

/**
 * Hỗ trợ & Khiếu nại chạy trên cùng mô hình hội thoại với Tin nhắn: mỗi phiếu là một cuộc trò chuyện giữa hội viên và lễ tân.
 * Phân loại vẫn được lưu ở đầu tiêu đề phiếu (`[Gói tập] …`) để lễ tân/quản lý lọc và đọc như trước.
 */
export const SUPPORT_CATEGORIES = [
  { value: 'Gói tập', vi: 'Gói tập', en: 'Membership' },
  { value: 'Thiết bị', vi: 'Thiết bị', en: 'Equipment' },
  { value: 'Lịch học', vi: 'Lịch học', en: 'Class schedule' },
  { value: 'Khác', vi: 'Khác', en: 'Other' },
] as const;
export type SupportCategory = typeof SUPPORT_CATEGORIES[number]['value'];

export const SUPPORT_SUBJECT_MAX = 150;
export const SUPPORT_MESSAGE_MAX = 2000;

export const SUPPORT_STATUS_LABEL: Record<SupportTicket['status'], [string, string]> = {
  open: ['Đang chờ', 'Waiting'],
  in_progress: ['Đang xử lý', 'In progress'],
  resolved: ['Đã giải quyết', 'Resolved'],
  closed: ['Đã đóng', 'Closed'],
};

const PREFIX = /^\[(Gói tập|Thiết bị|Lịch học|Khác)\] /;

export function categoryOf(subject: string): SupportCategory {
  const match = PREFIX.exec(subject);
  return (match?.[1] as SupportCategory | undefined) ?? 'Khác';
}

export function displaySubject(subject: string): string {
  return subject.replace(PREFIX, '');
}

/** Dòng đầu của tin nhắn đầu tiên làm tiêu đề phiếu; nội dung đầy đủ nằm ở phần mô tả (bong bóng đầu tiên). */
export function buildSubject(category: SupportCategory, text: string): string {
  const firstLine = text.trim().split(/\r?\n/)[0].replace(/\s+/g, ' ');
  const prefix = `[${category}] `;
  const room = SUPPORT_SUBJECT_MAX - prefix.length;
  const title = firstLine.length > room ? `${firstLine.slice(0, room - 1).trimEnd()}…` : firstLine;
  return prefix + title;
}

export function uniqueMessages(messages: SupportMessage[]): SupportMessage[] {
  return [...new Map(messages.map(message => [message.id, message])).values()];
}

export function supportError(cause: unknown): ChatError {
  return cause instanceof ApiError ? cause : sourceMessage('Không thể hoàn tất yêu cầu. Vui lòng thử lại.', 'Unable to complete the request. Please try again.');
}

export function isAccessDenied(cause: unknown): boolean {
  return cause instanceof ApiError && (cause.status === 403 || cause.status === 404);
}

export interface SupportBubble { id: string; mine: boolean; sender: string | null; text: string; at: string }

/** Nội dung phiếu ban đầu hiển thị như tin nhắn đầu tiên của hội viên, sau đó là các tin trao đổi. */
export function supportBubbles(ticket: SupportTicket | null, messages: SupportMessage[], memberIsMe: boolean): SupportBubble[] {
  const bubbles: SupportBubble[] = [];
  if (ticket?.description?.trim()) bubbles.push({ id: 'description', mine: memberIsMe, sender: ticket.memberName ?? null, text: ticket.description, at: ticket.createdAt });
  for (const message of messages) {
    const fromMember = message.senderRole === 'MEMBER';
    bubbles.push({ id: String(message.id), mine: fromMember === memberIsMe, sender: message.senderName, text: message.message, at: message.createdAt });
  }
  return bubbles;
}
