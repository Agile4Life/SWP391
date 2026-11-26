import { Navigate, useParams } from 'react-router-dom';
import { getCurrentUser } from '../shared/api/client';

/** Chuyển hướng liên kết cũ `/staff/attendance/:sessionId` sang `/coach/attendance/:sessionId`. */
export function LegacyAttendanceRedirect() {
  const { sessionId } = useParams<{ sessionId: string }>();
  return <Navigate to={sessionId ? `/coach/attendance/${sessionId}` : '/coach/attendance'} replace />;
}

/** Chuyển hướng liên kết cũ `/staff/classes` về `/manager/classes` cho Quản lý và `/staff/reception` cho Lễ tân. */
export function LegacyClassesRedirect() {
  const role = getCurrentUser()?.role;
  return <Navigate to={role === 'MANAGER' ? '/manager/classes' : '/staff/reception'} replace />;
}

/** Chuyển hướng liên kết lễ tân đã ngừng (`/staff/orders`, `/staff/pt-attendance`) thẳng về trang đích theo vai trò. */
export function LegacyStaffRouteRedirect() {
  const role = getCurrentUser()?.role;
  return <Navigate to={role === 'MANAGER' ? '/manager/reports' : '/staff/reception'} replace />;
}
