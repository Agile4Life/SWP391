import { StaffCheckInPage } from './StaffCheckInPage';

/**
 * Tab check-out của quầy lễ tân: mã QR cổng để hội viên quét ra về và danh sách lượt còn ở trong trung tâm.
 */
export function StaffCheckOutPage() {
  return <StaffCheckInPage mode="out" />;
}
