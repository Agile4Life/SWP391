import { StaffCheckInPage } from './StaffCheckInPage';

/** Check-out tab of the front desk: the gate QR members scan to leave, and the visits still inside. */
export function StaffCheckOutPage() {
  return <StaffCheckInPage mode="out" />;
}
