import { PortalShell } from '../../features/portal/PortalShell';
import './portal.css';
import '../../features/portal/portal-shell.css';

/** Khung chung của portal: chỉ hiển thị PortalShell (sidebar, topbar và vùng nội dung). */
export function AppLayout() {
  return <PortalShell />;
}
