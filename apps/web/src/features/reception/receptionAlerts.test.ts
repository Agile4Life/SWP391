import { expect, it } from 'vitest';
import { createReceptionAlertTracker } from './receptionAlerts';
import type { MemberNotification } from '../member/notificationsApi';
const item = (id: number, actionPath = '/staff/kyc'): MemberNotification => ({ id, title: 'New request', message: '', type: 'system', relatedEntityType: null, relatedEntityId: null, isRead: false, createdAt: '2026-11-25T10:00:00', actionPath });
it('seeds old notifications, emits new work once and never marks it read', () => {
  const track = createReceptionAlertTracker();
  expect(track([item(1)])).toEqual([]);
  const request = item(2); expect(track([request, item(1)])).toEqual([request]);
  expect(request.isRead).toBe(false); expect(track([request])).toEqual([]);
  expect(track([item(3, '/member/packages')])).toEqual([]);
  expect(track([{ ...item(4), isRead: true }])).toEqual([]);
});
it('ignores old items newly visible and unrelated reception history', () => {
  const track = createReceptionAlertTracker(); track([item(10)]);
  expect(track([item(9), item(11, '/staff/reception-history')])).toEqual([]);
});
