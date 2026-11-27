import { useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { getCurrentUser } from '../../shared/api/client';
import { useStaffI18n } from '../operations/staffI18n';
import { MembershipRequestHistory } from './MembershipRequestHistory';
import { WalletTopupHistory } from './WalletTopupHistory';
import { HoldRequestHistory } from './HoldRequestHistory';
import { PortalSectionTabs } from '../portal/PortalSectionTabs';

/**
 * Tab lịch sử của quầy lễ tân: yêu cầu gói tập đã xử lý và các lần nạp ví đã thu; chỉ quản lý và nhân viên được xem.
 */
export function StaffRequestHistoryPage() {
  const { t, lang } = useStaffI18n();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const role = getCurrentUser()?.role;
  const canViewHolds = role === 'STAFF';
  const requestedTab = params.get('tab');
  const tab = requestedTab === 'wallet' ? 'wallet' : requestedTab === 'holds' && canViewHolds ? 'holds' : 'membership';
  const tabLink = (value: string) => {
    const next = new URLSearchParams(params);
    next.set('tab', value);
    return `${pathname}?${next.toString()}`;
  };
  const tabs = [
    { to: tabLink('membership'), label: 'Lịch sử xử lý yêu cầu gói tập', en: 'Membership request history' },
    { to: tabLink('wallet'), label: 'Lịch sử nạp tiền vào Ví SÖL', en: 'SÖL Wallet top-up history' },
    ...(canViewHolds ? [{ to: tabLink('holds'), label: 'Lịch sử bảo lưu gói tập', en: 'Membership hold history' }] : []),
  ];
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
    <>
      <PortalSectionTabs label={t('Lịch sử giao dịch', 'Transaction history')} tabs={tabs} pathname={pathname} lang={lang} activeTo={tabLink(tab)} />
      <div data-i18n-managed className="portal-container reception-history-page">
        {/* Giữ các bảng mounted để chuyển tab/Back không tải lại hay mất bộ lọc hiện có. */}
        <div data-history-panel="membership" hidden={tab !== 'membership'}><MembershipRequestHistory /></div>
        <div data-history-panel="wallet" hidden={tab !== 'wallet'}><WalletTopupHistory /></div>
        {canViewHolds && <div data-history-panel="holds" hidden={tab !== 'holds'}><HoldRequestHistory /></div>}
      </div>
    </>
  );
}
