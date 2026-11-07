import { Fragment } from 'react';
import { useI18n } from '../../../shared/i18n';
import { PortalIcon } from '../../portal/PortalIcon';
import type { SceneNode } from '../scene/schema';
import { breadcrumb } from '../scene/selectors';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { useExploreStore } from '../state/exploreStore';

function getBreadcrumbLabel(node: SceneNode, lang: 'vi' | 'en'): string {
  if (node.type === 'site') {
    return lang === 'en' ? 'SÖL Center' : 'Tổ hợp SÖL';
  }
  if (node.type === 'level') {
    return lang === 'en' ? `Level ${node.code}` : `Tầng ${node.code}`;
  }
  if (node.type === 'hotspot') {
    return lang === 'en' ? node.title.en : node.title.vi;
  }
  if ('name' in node) {
    return lang === 'en' ? node.name.en : node.name.vi;
  }
  return node.id;
}

export function ExploreBreadcrumb() {
  const { lang, t } = useI18n();
  const selectedId = useExploreStore(state => state.selectedId);
  const focusLevel = useExploreStore(state => state.focusLevel);
  const flyToOverview = useExploreStore(state => state.flyToOverview);
  const setFocusLevel = useExploreStore(state => state.setFocusLevel);
  const selectNode = useExploreStore(state => state.selectNode);
  const setSearchOpen = useExploreStore(state => state.setSearchOpen);

  const effectiveTargetId =
    selectedId ?? (focusLevel !== 'ALL' ? `lvl-${focusLevel.toLowerCase()}` : 'site-sol');
  const trail = breadcrumb(SOL_CENTER_SCENE, effectiveTargetId);

  const handleCrumbClick = (node: SceneNode) => {
    if (node.type === 'site') {
      flyToOverview();
      return;
    }
    if (node.type === 'level') {
      setFocusLevel(node.code);
      return;
    }
    selectNode(node.id);
  };

  return (
    <header
      className="explore3d-breadcrumb-bar"
      data-testid="explore3d-breadcrumb"
      aria-label={t('Thanh điều hướng vị trí 3D', '3D Location Breadcrumb Bar')}
    >
      <nav
        className="explore3d-breadcrumb-nav"
        aria-label={t('Đường dẫn vị trí', 'Breadcrumb')}
      >
        <ol className="explore3d-breadcrumb-list">
          {trail.map((node, index) => {
            const isLast = index === trail.length - 1;
            const label = getBreadcrumbLabel(node, lang);
            return (
              <Fragment key={node.id}>
                {index > 0 && (
                  <li className="explore3d-breadcrumb-sep" aria-hidden="true">
                    ›
                  </li>
                )}
                <li className="explore3d-breadcrumb-item">
                  <button
                    type="button"
                    className={`explore3d-breadcrumb-btn${isLast ? ' is-active' : ''}`}
                    data-testid={`explore3d-crumb-${node.id}`}
                    aria-current={isLast ? 'location' : undefined}
                    onClick={() => handleCrumbClick(node)}
                  >
                    {label}
                  </button>
                </li>
              </Fragment>
            );
          })}
        </ol>
      </nav>

      <div className="explore3d-breadcrumb-actions">
        <span
          className="explore3d-sim-badge"
          data-testid="explore3d-sim-badge"
          title={t(
            'Mô hình kiến trúc 3D minh hoạ kết hợp trạng thái dữ liệu trực tiếp từ hệ thống',
            'Illustrative 3D architectural model combined with live system telemetry',
          )}
        >
          {t('Mô phỏng minh hoạ', 'Illustrative simulation')}
        </span>

        <button
          type="button"
          className="explore3d-search-btn"
          data-testid="explore3d-search-trigger"
          aria-label={t('Tìm khu vực hoặc thiết bị', 'Search zones or equipment')}
          title={t('Tìm khu vực hoặc thiết bị (/)', 'Search zones or equipment (/)')}
          onClick={() => setSearchOpen(true)}
        >
          <PortalIcon name="search" size={18} />
          <kbd className="explore3d-search-kbd" aria-hidden="true">
            /
          </kbd>
        </button>
      </div>
    </header>
  );
}

export default ExploreBreadcrumb;
