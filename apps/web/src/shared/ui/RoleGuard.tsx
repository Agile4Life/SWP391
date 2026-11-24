import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { purchaseAuthPath } from '../lib/purchaseIntent';
import { homePath } from '../api/client';
import { useCurrentUser } from '../api/useCurrentUser';

/**
 * Chặn route theo vai trò: chưa đăng nhập thì về /login (kèm returnTo), sai vai trò thì về trang chủ của vai
 * trò đó, đúng thì render route con.
 */
export function RoleGuard({ allowedRoles }: { allowedRoles: string[] }) {
  const user = useCurrentUser();
  const location = useLocation();
  if (!user) {
    return <Navigate to={purchaseAuthPath('/login', `?returnTo=${encodeURIComponent(location.pathname + location.search)}`)} replace />;
  }
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={homePath(user.role)} replace />;
  }
  return <Outlet />;
}
