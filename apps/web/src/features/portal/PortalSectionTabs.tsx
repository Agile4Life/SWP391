import { Link, NavLink } from 'react-router-dom';
import type { Language } from '../../shared/i18n';
import { getTabLabel, type PortalNavTab } from './portalNavigation';

/** Props của thanh tab nhóm: nhãn trợ năng, các tab, đường dẫn hiện tại và ngôn ngữ. */
interface PortalSectionTabsProps {
  label: string;
  tabs: PortalNavTab[];
  pathname: string;
  lang: Language;
  /** Tab cùng route nhưng khác query: trang gọi xác định đích đang chọn. */
  activeTo?: string;
}

/**
 * Thanh chuyển màn trong một mục sidebar gộp (vd. Thẻ ↔ Quét QR). Mỗi tab là route riêng,
 * nên deep link, nút Back và quyền truy cập giữ nguyên; chỉ hiện ở đúng các màn thuộc nhóm.
 */
export function PortalSectionTabs({ label, tabs, pathname, lang, activeTo }: PortalSectionTabsProps) {
  const activeInGroup = tabs.some(
    tab =>
      pathname === tab.to.split('?')[0] ||
      pathname.startsWith(`${tab.to.split('?')[0]}/`),
  );
  if (!activeInGroup) return null;
  return (
    <nav className="portal-section-tabs" data-tab-count={tabs.length} aria-label={label}>
      {tabs.map(tab => activeTo ? (
        <Link key={tab.to} to={tab.to} className={`portal-section-tab${activeTo === tab.to ? ' active' : ''}`} aria-current={activeTo === tab.to ? 'page' : undefined}>
          {getTabLabel(tab, lang)}
        </Link>
      ) : (
        <NavLink key={tab.to} to={tab.to} className="portal-section-tab">
          {getTabLabel(tab, lang)}
        </NavLink>
      ))}
    </nav>
  );
}
