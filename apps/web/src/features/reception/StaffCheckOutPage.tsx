import { StaffCheckInPage } from './StaffCheckInPage';

/**
 * Tab check-out của lễ tân: QR cổng cho hội viên ra và các lượt còn ở trong trung tâm.
 *
 * Check-out tab of the front desk: the gate QR members scan to leave, and the visits still inside.
 */
export function StaffCheckOutPage() {
  return <StaffCheckInPage mode="out" />;
}
