import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentUser } from '../../shared/api/client';
import { PageHeader } from '../../shared/ui/PageHeader';
import { useStaffI18n } from '../operations/staffI18n';
import { MembershipRequestHistory } from './MembershipRequestHistory';
import { WalletTopupHistory } from './WalletTopupHistory';

/**
 * Tab lịch sử của lễ tân: yêu cầu gói tập đã xử lý và các lần nạp ví đã thu; chỉ quản lý và nhân viên được xem.
 *
 * History tab of the front desk: membership requests it processed and wallet top-ups it took.
 */
export function StaffRequestHistoryPage() {
  const { t } = useStaffI18n();
  const role = getCurrentUser()?.role;
  // Chỉ quản lý và nhân viên có quyền xem.
  const hasAccess = useMemo(() => role === 'MANAGER' || role === 'STAFF', [role]);
  if (!hasAccess) {
    return (
      <div data-i18n-managed className="portal-container" data-testid="reception-history-forbidden-guard">
        <div className="portal-card">
          <div className="portal-state" style={{ padding: '60px 24px', textAlign: 'center' }}>
            <h2 className="portal-state__title">{t("Không có quyền truy cập")}</h2>
            <Link to="/portal" className="btn-secondary">{t("Về trang chủ Portal")}</Link>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div data-i18n-managed className="portal-container">
      <PageHeader title={t("Lịch sử giao dịch")} />
      <MembershipRequestHistory />
      <WalletTopupHistory />
    </div>
  );
}
