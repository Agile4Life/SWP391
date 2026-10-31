import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { purchaseAuthPath } from '../lib/purchaseIntent';
import { getCurrentUser, homePath } from '../api/client';

export function RoleGuard({ allowedRoles }: { allowedRoles: string[] }) {
  const user = getCurrentUser();
  const location = useLocation();
  if (!user) {
    return <Navigate to={purchaseAuthPath('/login', `?returnTo=${encodeURIComponent(location.pathname + location.search)}`)} replace />;
  }
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={homePath(user.role)} replace />;
  }
  return <Outlet />;
}
