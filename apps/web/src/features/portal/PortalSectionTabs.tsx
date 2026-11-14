import { NavLink } from 'react-router-dom';
import type { Language } from '../../shared/i18n';
import { getTabLabel, type PortalNavTab } from './portalNavigation';

interface PortalSectionTabsProps {
  label: string;
  tabs: PortalNavTab[];
  pathname: string;
  lang: Language;
}

/**
 * Thanh chuyển màn trong một mục sidebar gộp (vd. Thẻ ↔ Quét QR). Mỗi tab là route riêng,
 * nên deep link, nút Back và quyền truy cập giữ nguyên; chỉ hiện ở đúng các màn thuộc nhóm.
 */
export function PortalSectionTabs({ label, tabs, pathname, lang }: PortalSectionTabsProps) {
  const activeInGroup = tabs.some(
    tab =>
      pathname === tab.to ||
      pathname.startsWith(`${tab.to}/`) ||
      (tab.to === '/member/products' && pathname === '/member/checkout'),
  );
  if (!activeInGroup) return null;
  return (
    <nav className="portal-section-tabs" aria-label={label}>
      {tabs.map(tab => (
        <NavLink key={tab.to} to={tab.to} className="portal-section-tab">
          {getTabLabel(tab, lang)}
        </NavLink>
      ))}
    </nav>
  );
}
