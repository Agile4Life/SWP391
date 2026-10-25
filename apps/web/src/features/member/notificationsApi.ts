import { apiFetch } from '../../shared/api/client';

export interface MemberNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  relatedEntityType: string | null;
  relatedEntityId: number | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPage {
  content: MemberNotification[];
  number: number;
  totalPages: number;
}

export const getNotifications = (page = 0) =>
  apiFetch<NotificationPage>(`/notifications?page=${page}&size=20`);
export const getUnreadCount = async () =>
  (await apiFetch<{ count: number }>('/notifications/unread-count')).count;
export const markNotificationRead = (id: number) =>
  apiFetch<void>(`/notifications/${id}/read`, { method: 'PATCH' });
export const markAllNotificationsRead = () =>
  apiFetch<void>('/notifications/read-all', { method: 'PATCH' });

export function notificationDestination(notification: Pick<MemberNotification, 'relatedEntityType' | 'type'>): string | null {
  switch (notification.relatedEntityType) {
    case 'class_session':
    case 'class_enrollment': return '/member/classes';
    case 'membership_subscription': return '/member/packages';
    case 'payment': return '/member/packages';
    default:
      if (notification.type === 'class_reminder' || notification.type === 'schedule_change') return '/member/classes';
      if (notification.type === 'payment' || notification.type === 'package_expiry') return '/member/packages';
      return null;
  }
}
