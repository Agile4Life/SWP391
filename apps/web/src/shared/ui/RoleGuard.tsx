import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { purchaseAuthPath } from '../lib/purchaseIntent';
import { homePath, type UserSession } from '../api/client';
import { useCurrentUser } from '../api/useCurrentUser';

type AllowedRole = UserSession['role'] | 'RECEPTIONIST' | 'CENTER_MANAGER';

const ROLE_ALIASES: Record<string, UserSession['role']> = {
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  COACH: 'COACH',
  STAFF: 'STAFF',
  RECEPTIONIST: 'STAFF',
  MANAGER: 'MANAGER',
  CENTER_MANAGER: 'MANAGER',
};

function normalizeRole(role: string): string {
  const upper = role.trim().toUpperCase();
  return ROLE_ALIASES[upper] ?? upper;
}

/**
 * Chặn route theo vai trò: chưa đăng nhập thì về /login (kèm returnTo), sai vai trò thì về trang chủ của vai
 * trò đó, đúng thì render route con. Tự chuẩn hóa alias vai trò backend (RECEPTIONIST → STAFF, CENTER_MANAGER → MANAGER).
 */
export function RoleGuard({ allowedRoles }: { allowedRoles: readonly AllowedRole[] }) {
  const user = useCurrentUser();
  const location = useLocation();
  if (!user) {
    return <Navigate to={purchaseAuthPath('/login', `?returnTo=${encodeURIComponent(location.pathname + location.search)}`)} replace />;
  }
  const normalizedUserRole = normalizeRole(user.role);
  if (!allowedRoles.some((role) => normalizeRole(role) === normalizedUserRole)) {
    return <Navigate to={homePath(user.role)} replace />;
  }
  return <Outlet />;
}
