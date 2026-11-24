import { Navigate } from 'react-router-dom';
import { getCurrentUser, homePath } from '../api/client';

/** Trang gốc của portal: chuyển hướng tới trang chủ theo vai trò của người dùng, chưa đăng nhập thì về /login. */
export function PortalHome() {
  const user = getCurrentUser();
  return <Navigate to={user ? homePath(user.role) : '/login'} replace />;
}
