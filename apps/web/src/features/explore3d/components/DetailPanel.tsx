import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../../shared/i18n';
import { formatCenterDate } from '../../../shared/lib/centerTime';
import { LoadingSkeleton } from '../../../shared/ui/LoadingSkeleton';
import type {
  LiveCenterSnapshot,
  NormalizedEquipmentStatus,
  NormalizedItemStatus,
  NormalizedRoomStatus,
  ResolvedSceneBindings,
} from '../data/bindings';
import type {
  HotspotAction,
  HotspotNode,
  ItemNode,
  LevelNode,
  ZoneNode,
} from '../scene/schema';
import {
  allHotspots,
  getLevels,
  getNode,
  hotspotsOfZone,
  itemsOfZone,
  levelOf,
  zoneOf,
  zonesOfLevel,
} from '../scene/selectors';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { saveExploreSessionView } from '../state/deepLink';
import { useExploreStore } from '../state/exploreStore';

export interface DetailPanelProps {
  bindings: ResolvedSceneBindings;
  snapshot?: LiveCenterSnapshot;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

function buildNavigateHref(to: string, query?: Record<string, string>): string {
  if (!query || Object.keys(query).length === 0) return to;
  const [base, existingQs] = to.split('?');
  const sp = new URLSearchParams(existingQs ?? '');
  for (const [k, v] of Object.entries(query)) {
    sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

function getRoomStatusLabel(
  status: NormalizedRoomStatus,
  t: (vi: string, en: string) => string,
): string {
  switch (status) {
    case 'available':
      return t('Sẵn sàng', 'Available');
    case 'maintenance':
      return t('Đang bảo trì', 'Maintenance');
    case 'closed':
      return t('Đóng cửa', 'Closed');
    default:
      return t('Không có dữ liệu trực tiếp', 'No live data available');
  }
}

function getEquipmentStatusLabel(
  status: NormalizedEquipmentStatus | NormalizedItemStatus,
  t: (vi: string, en: string) => string,
): string {
  switch (status) {
    case 'active':
    case 'available':
      return t('Hoạt động', 'Active');
    case 'maintenance':
      return t('Đang bảo trì', 'Maintenance');
    case 'broken':
      return t('Báo hỏng', 'Broken');
    case 'retired':
    case 'closed':
      return t('Ngừng sử dụng', 'Retired');
    default:
      return t('Không có dữ liệu trực tiếp', 'No live data available');
  }
}

function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')}đ`;
}

export function DetailPanel({
  bindings,
  loading = false,
  error = null,
  onRefresh,
}: DetailPanelProps) {
  const { lang, t } = useI18n();
  const navigate = useNavigate();

  const selectedId = useExploreStore(state => state.selectedId);
  const focusLevel = useExploreStore(state => state.focusLevel);
  const levelMode = useExploreStore(state => state.levelMode);
  const wallMode = useExploreStore(state => state.wallMode);
  const selectNode = useExploreStore(state => state.selectNode);
  const setFocusLevel = useExploreStore(state => state.setFocusLevel);
  const flyToOverview = useExploreStore(state => state.flyToOverview);
  const flyToViewpoint = useExploreStore(state => state.flyToViewpoint);

  const selectedNode = getNode(SOL_CENTER_SCENE, selectedId);

  const persistCurrentView = () => {
    const vp = SOL_CENTER_SCENE.nodes['site-sol'].type === 'site'
      ? SOL_CENTER_SCENE.nodes['site-sol'].viewpoints[0]
      : null;
    saveExploreSessionView({
      position: vp ? vp.position : [46, 36, 48],
      target: vp ? vp.target : [4, 2, 0],
      focusLevel,
      selectedId,
      levelMode,
      wallMode,
    });
  };

  const handleNavigate = (href: string) => {
    persistCurrentView();
    navigate(href);
  };

  const handleHotspotAction = (action: HotspotAction) => {
    if (action.type === 'open-chat') {
      window.dispatchEvent(
        new CustomEvent('scms:open-chat', {
          detail: { topic: action.topic ?? 'concierge' },
        }),
      );
      return;
    }
    if (action.type === 'focus-level') {
      setFocusLevel(action.level);
      return;
    }
    const href = buildNavigateHref(action.to, action.query);
    handleNavigate(href);
  };

  const renderLiveDataBanner = (nodeHasLive: boolean) => {
    if (loading) return null;
    if (!bindings.hasLiveData || Boolean(error) || !nodeHasLive) {
      return (
        <div
          className="explore3d-live-status-banner is-offline"
          data-testid="explore3d-no-live-data"
          role="status"
        >
          <div className="explore3d-live-status-banner__text">
            <strong>{t('Không có dữ liệu trực tiếp', 'No live data available')}</strong>
            <span>
              {error
                ? error
                : t(
                    'Đang hiển thị cấu trúc không gian tĩnh; không tạo số liệu giả.',
                    'Showing static spatial layout; no fabricated metrics.',
                  )}
            </span>
          </div>
          {onRefresh && (
            <button
              type="button"
              className="explore3d-btn explore3d-btn--secondary"
              data-testid="explore3d-retry-btn"
              onClick={onRefresh}
            >
              {t('Thử lại', 'Retry')}
            </button>
          )}
        </div>
      );
    }
    return null;
  };

  const renderHotspotCard = (hs: HotspotNode) => {
    const title = lang === 'en' ? hs.title.en : hs.title.vi;
    const subtitle = lang === 'en' ? hs.subtitle.en : hs.subtitle.vi;
    const ctaText = lang === 'en' ? hs.action.ctaLabel.en : hs.action.ctaLabel.vi;
    const secondaryLabel =
      hs.action.type === 'navigate' && hs.action.secondaryLabel
        ? lang === 'en'
          ? hs.action.secondaryLabel.en
          : hs.action.secondaryLabel.vi
        : null;
    const secondaryTo = hs.action.type === 'navigate' ? hs.action.secondaryTo : undefined;

    return (
      <div
        key={hs.id}
        className="explore3d-hotspot-card"
        data-testid={`detail-hotspot-${hs.id}`}
      >
        <div className="explore3d-hotspot-card__header">
          {hs.badge && <span className="explore3d-chip">{hs.badge}</span>}
          <h4 className="explore3d-hotspot-card__title">{title}</h4>
        </div>
        <p className="explore3d-hotspot-card__subtitle">{subtitle}</p>
        <div className="explore3d-cta-group">
          <button
            type="button"
            className="explore3d-btn explore3d-btn--primary"
            data-testid={`hotspot-cta-${hs.id}`}
            onClick={() => handleHotspotAction(hs.action)}
          >
            {ctaText}
          </button>
          {secondaryTo && secondaryLabel && (
            <button
              type="button"
              className="explore3d-btn explore3d-btn--secondary"
              data-testid={`hotspot-secondary-cta-${hs.id}`}
              onClick={() => handleNavigate(secondaryTo)}
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderZoneDetails = (zone: ZoneNode) => {
    const lvl = levelOf(SOL_CENTER_SCENE, zone.id);
    const zBinding = bindings.zones[zone.id];
    const zoneHotspots = hotspotsOfZone(SOL_CENTER_SCENE, zone.id);
    const zoneItems = itemsOfZone(SOL_CENTER_SCENE, zone.id);
    const hasLive = Boolean(zBinding?.hasLiveData && bindings.hasLiveData && !error);

    return (
      <div className="explore3d-detail-section" data-testid={`detail-zone-${zone.id}`}>
        <div className="explore3d-detail-badges">
          <span className="explore3d-chip">{zone.code}</span>
          {lvl && <span className="explore3d-chip">{lvl.code}</span>}
          <span
            className={`explore3d-status-pill is-${zBinding?.roomStatus ?? 'unknown'}`}
            data-testid="detail-zone-status"
          >
            {getRoomStatusLabel(zBinding?.roomStatus ?? 'unknown', t)}
          </span>
          {zBinding?.tierRequired && (
            <span
              className={`explore3d-tier-badge is-${zBinding.tierRequired.toLowerCase()}`}
              data-testid="detail-zone-tier"
            >
              {zBinding.tierRequired}
            </span>
          )}
        </div>

        <h2 className="explore3d-detail-title">
          {lang === 'en' ? zone.name.en : zone.name.vi}
        </h2>
        <p className="explore3d-detail-desc">
          {lang === 'en' ? zone.description.en : zone.description.vi}
        </p>

        {renderLiveDataBanner(hasLive)}

        {zBinding?.tierLocked && (
          <div className="explore3d-tier-lock-card" data-testid="detail-tier-locked">
            <p className="explore3d-tier-lock-card__text">
              {t(
                'Khu vực này yêu cầu thẻ hội viên hạng PLATINUM đang hiệu lực.',
                'This sanctuary requires an active PLATINUM membership tier.',
              )}
            </p>
            <button
              type="button"
              className="explore3d-btn explore3d-btn--primary"
              data-testid="detail-tier-upgrade-cta"
              onClick={() => handleNavigate('/member/packages')}
            >
              {t('Nâng cấp gói Platinum', 'Upgrade to Platinum')}
            </button>
          </div>
        )}

        {(zBinding?.capacity != null || zBinding?.locationLabel || zBinding?.openHoursLabel) && (
          <dl className="explore3d-metrics-grid" data-testid="detail-zone-metrics">
            {zBinding?.capacity != null && (
              <div className="explore3d-metric-box">
                <dt>{t('Sức chứa tối đa', 'Max capacity')}</dt>
                <dd data-testid="detail-zone-capacity">{zBinding.capacity}</dd>
              </div>
            )}
            {zBinding?.openHoursLabel && (
              <div className="explore3d-metric-box">
                <dt>{t('Giờ mở cửa', 'Open hours')}</dt>
                <dd>{zBinding.openHoursLabel}</dd>
              </div>
            )}
            {zBinding?.locationLabel && (
              <div className="explore3d-metric-box is-wide">
                <dt>{t('Vị trí', 'Location')}</dt>
                <dd>{zBinding.locationLabel}</dd>
              </div>
            )}
          </dl>
        )}

        {/* Viewpoint quick chips */}
        {zone.viewpoints.length > 0 && (
          <div className="explore3d-subsection">
            <h3 className="explore3d-subsection-title">
              {t('Góc nhìn đề xuất', 'Suggested viewpoints')}
            </h3>
            <div className="explore3d-chip-row">
              {zone.viewpoints.map(vp => (
                <button
                  key={vp.id}
                  type="button"
                  className="explore3d-viewpoint-chip"
                  onClick={() => flyToViewpoint(vp)}
                >
                  {vp.label ? (lang === 'en' ? vp.label.en : vp.label.vi) : vp.kind}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Equipment summary table */}
        {zBinding && zBinding.equipmentSummary.groups.length > 0 && (
          <div className="explore3d-subsection" data-testid="detail-equipment-summary">
            <div className="explore3d-subsection-header">
              <h3 className="explore3d-subsection-title">
                {t('Thiết bị trực tiếp', 'Live equipment')}
              </h3>
              <span className="explore3d-chip">
                {zBinding.equipmentSummary.activeUnits}/{zBinding.equipmentSummary.totalUnits}{' '}
                {t('hoạt động', 'active')}
              </span>
            </div>
            <div className="explore3d-equipment-table-wrap">
              <table className="explore3d-equipment-table">
                <thead>
                  <tr>
                    <th>{t('Thiết bị', 'Equipment')}</th>
                    <th>{t('SL', 'Qty')}</th>
                    <th>{t('Trạng thái', 'Status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {zBinding.equipmentSummary.groups.map(group => {
                    const matchingItem = zoneItems.find(
                      it =>
                        it.liveEquipmentBinding?.equipmentCode.toUpperCase() ===
                        group.code.toUpperCase(),
                    );
                    return (
                      <tr
                        key={group.code}
                        data-testid={`detail-eq-row-${group.code}`}
                        onClick={() => matchingItem && selectNode(matchingItem.id)}
                        style={{ cursor: matchingItem ? 'pointer' : 'default' }}
                      >
                        <td>
                          <div className="explore3d-eq-name">{group.name}</div>
                          <div className="explore3d-eq-code">{group.code}</div>
                        </td>
                        <td>
                          <span className="explore3d-eq-qty">{group.quantity}</span>
                          {group.overflowCount > 0 && group.overflowLabel && (
                            <span
                              className="explore3d-overflow-badge"
                              data-testid={`detail-eq-overflow-${group.code}`}
                            >
                              {group.overflowLabel}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`explore3d-status-pill is-${group.status}`}>
                            {getEquipmentStatusLabel(group.status, t)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Courts summary */}
        {zBinding && zBinding.courtsSummary.courts.length > 0 && (
          <div className="explore3d-subsection" data-testid="detail-courts-summary">
            <div className="explore3d-subsection-header">
              <h3 className="explore3d-subsection-title">
                {t('Sân & Làn trực tiếp', 'Live courts & lanes')}
              </h3>
              <span className="explore3d-chip">
                {zBinding.courtsSummary.availableCourts}/{zBinding.courtsSummary.totalCourts}{' '}
                {t('sẵn sàng', 'available')}
              </span>
            </div>
            <div className="explore3d-court-list">
              {zBinding.courtsSummary.courts.map(court => {
                const matchingItem = zoneItems.find(
                  it =>
                    it.liveCourtBinding?.courtName.toLowerCase() === court.name.toLowerCase(),
                );
                return (
                  <div
                    key={court.id}
                    className="explore3d-court-card"
                    data-testid={`detail-court-${court.id}`}
                  >
                    <div className="explore3d-court-card__info">
                      <strong>{court.name}</strong>
                      <div className="explore3d-court-card__meta">
                        {court.openTime && court.closeTime && (
                          <span>
                            {court.openTime.slice(0, 5)} – {court.closeTime.slice(0, 5)}
                          </span>
                        )}
                        {court.availableSlotsToday != null && (
                          <span>
                            · {court.availableSlotsToday} {t('khung trống hôm nay', 'free slots today')}
                          </span>
                        )}
                        {court.nextFreeSlot && (
                          <span>
                            · {t('Trống kế tiếp', 'Next free')}: {court.nextFreeSlot}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="explore3d-court-card__actions">
                      {matchingItem && (
                        <button
                          type="button"
                          className="explore3d-btn explore3d-btn--secondary"
                          onClick={() => selectNode(matchingItem.id)}
                        >
                          {t('Chọn sân', 'Focus')}
                        </button>
                      )}
                      <button
                        type="button"
                        className="explore3d-btn explore3d-btn--primary"
                        onClick={() =>
                          handleNavigate(
                            zone.liveBinding?.courtDiscipline
                              ? `/member/courts?sport=${encodeURIComponent(zone.liveBinding.courtDiscipline)}`
                              : '/member/courts',
                          )
                        }
                      >
                        {t('Đặt sân', 'Book')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upcoming class sessions */}
        {zBinding && zBinding.upcomingSessions.length > 0 && (
          <div className="explore3d-subsection" data-testid="detail-upcoming-sessions">
            <h3 className="explore3d-subsection-title">
              {t('Buổi học sắp tới tại khu vực này', 'Upcoming sessions in this zone')}
            </h3>
            <ul className="explore3d-session-list">
              {zBinding.upcomingSessions.map(session => (
                <li key={session.id} className="explore3d-session-item">
                  <div className="explore3d-session-item__title">{session.className}</div>
                  <div className="explore3d-session-item__meta">
                    <span>
                      {formatCenterDate(session.sessionDate)} · {session.startTime.slice(0, 5)} –{' '}
                      {session.endTime.slice(0, 5)}
                    </span>
                    {session.coachName && <span>· {session.coachName}</span>}
                    {session.bookedCount != null && session.capacity != null && (
                      <span>
                        · {session.bookedCount}/{session.capacity}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Zone Hotspots & Direct Portal CTAs */}
        {zoneHotspots.length > 0 && (
          <div className="explore3d-subsection" data-testid="detail-zone-hotspots">
            <h3 className="explore3d-subsection-title">
              {t('Tác vụ & Điều hướng nhanh', 'Quick actions & portal links')}
            </h3>
            <div className="explore3d-hotspot-list">
              {zoneHotspots.map(hs => renderHotspotCard(hs))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderItemDetails = (item: ItemNode) => {
    const parentZone = zoneOf(SOL_CENTER_SCENE, item.id);
    const lvl = levelOf(SOL_CENTER_SCENE, item.id);
    const iBinding = bindings.items[item.id];
    const zoneHotspots = parentZone ? hotspotsOfZone(SOL_CENTER_SCENE, parentZone.id) : [];
    const hasLive = Boolean(iBinding?.hasLiveData && bindings.hasLiveData && !error);

    return (
      <div className="explore3d-detail-section" data-testid={`detail-item-${item.id}`}>
        <div className="explore3d-detail-badges">
          <span className="explore3d-chip">{item.kind}</span>
          {lvl && <span className="explore3d-chip">{lvl.code}</span>}
          {iBinding && (
            <span
              className={`explore3d-status-pill is-${iBinding.status}`}
              data-testid="detail-item-status"
            >
              {getEquipmentStatusLabel(iBinding.status, t)}
            </span>
          )}
        </div>

        <h2 className="explore3d-detail-title">
          {lang === 'en' ? item.name.en : item.name.vi}
        </h2>

        {parentZone && (
          <p className="explore3d-detail-parent">
            {t('Thuộc khu vực', 'Located in')}:{' '}
            <button
              type="button"
              className="explore3d-inline-link"
              onClick={() => selectNode(parentZone.id)}
            >
              {lang === 'en' ? parentZone.name.en : parentZone.name.vi}
            </button>
          </p>
        )}

        {renderLiveDataBanner(
          item.liveEquipmentBinding || item.liveCourtBinding ? hasLive : bindings.hasLiveData && !error,
        )}

        <dl className="explore3d-metrics-grid">
          <div className="explore3d-metric-box">
            <dt>{t('Kích thước (R×S×C)', 'Dimensions (W×D×H)')}</dt>
            <dd>
              {`${item.dimensions[0]}m × ${item.dimensions[2]}m × ${item.dimensions[1]}m`}
            </dd>
          </div>

          {item.liveEquipmentBinding && (
            <>
              <div className="explore3d-metric-box">
                <dt>{t('Mã thiết bị', 'Equipment code')}</dt>
                <dd data-testid="detail-item-eq-code">
                  {iBinding?.equipmentCode ?? item.liveEquipmentBinding.equipmentCode}
                </dd>
              </div>
              <div className="explore3d-metric-box">
                <dt>{t('Vị trí máy', 'Station slot')}</dt>
                <dd>
                  #{item.liveEquipmentBinding.instanceSlot + 1}
                  {iBinding?.quantity != null ? ` / ${iBinding.quantity}` : ''}
                  {iBinding && iBinding.overflowCount > 0 && (
                    <span className="explore3d-overflow-badge">+{iBinding.overflowCount}</span>
                  )}
                </dd>
              </div>
            </>
          )}

          {item.liveCourtBinding && (
            <>
              <div className="explore3d-metric-box">
                <dt>{t('Sân / Làn', 'Court / Lane')}</dt>
                <dd>{iBinding?.courtName ?? item.liveCourtBinding.courtName}</dd>
              </div>
              {iBinding?.availableSlotsToday != null && (
                <div className="explore3d-metric-box">
                  <dt>{t('Khung trống hôm nay', 'Free slots today')}</dt>
                  <dd>{iBinding.availableSlotsToday}</dd>
                </div>
              )}
              {iBinding?.nextFreeSlot && (
                <div className="explore3d-metric-box">
                  <dt>{t('Khung trống kế tiếp', 'Next free slot')}</dt>
                  <dd>{iBinding.nextFreeSlot}</dd>
                </div>
              )}
            </>
          )}
        </dl>

        <div className="explore3d-cta-group">
          <button
            type="button"
            className="explore3d-btn explore3d-btn--secondary"
            data-testid="detail-item-fit-btn"
            onClick={() => selectNode(item.id, { fit: true })}
          >
            {t('Khung cận cảnh', 'Fit to view')}
          </button>

          {item.liveCourtBinding && (
            <button
              type="button"
              className="explore3d-btn explore3d-btn--primary"
              data-testid="detail-item-book-court-btn"
              onClick={() =>
                handleNavigate(
                  parentZone?.liveBinding?.courtDiscipline
                    ? `/member/courts?sport=${encodeURIComponent(parentZone.liveBinding.courtDiscipline)}`
                    : '/member/courts',
                )
              }
            >
              {t('Đặt lịch sân / làn này', 'Book this court / lane')}
            </button>
          )}
        </div>

        {zoneHotspots.length > 0 && (
          <div className="explore3d-subsection">
            <h3 className="explore3d-subsection-title">
              {t('Tính năng khu vực', 'Zone features')}
            </h3>
            <div className="explore3d-hotspot-list">
              {zoneHotspots.map(hs => renderHotspotCard(hs))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderHotspotDetails = (hs: HotspotNode) => {
    const parentZone = zoneOf(SOL_CENTER_SCENE, hs.id);
    const lvl = levelOf(SOL_CENTER_SCENE, hs.id);

    return (
      <div className="explore3d-detail-section" data-testid={`detail-hotspot-view-${hs.id}`}>
        <div className="explore3d-detail-badges">
          {hs.badge && <span className="explore3d-chip">{hs.badge}</span>}
          {lvl && <span className="explore3d-chip">{lvl.code}</span>}
        </div>

        <h2 className="explore3d-detail-title">
          {lang === 'en' ? hs.title.en : hs.title.vi}
        </h2>
        <p className="explore3d-detail-desc">
          {lang === 'en' ? hs.subtitle.en : hs.subtitle.vi}
        </p>

        {parentZone && (
          <p className="explore3d-detail-parent">
            {t('Khu vực', 'Zone')}:{' '}
            <button
              type="button"
              className="explore3d-inline-link"
              onClick={() => selectNode(parentZone.id)}
            >
              {lang === 'en' ? parentZone.name.en : parentZone.name.vi}
            </button>
          </p>
        )}

        {renderLiveDataBanner(bindings.hasLiveData && !error)}

        {/* Live summary blocks by liveSummaryKey */}
        {hs.liveSummaryKey === 'membership' && bindings.membership && (
          <div className="explore3d-live-card" data-testid="detail-live-membership">
            <div className="explore3d-live-card__title">{bindings.membership.packageName}</div>
            <div className="explore3d-live-card__meta">
              <span className="explore3d-chip">{bindings.membership.tier}</span>
              <span>{bindings.membership.status}</span>
              {bindings.membership.remainingDays != null && (
                <span>
                  · {bindings.membership.remainingDays} {t('ngày còn lại', 'days remaining')}
                </span>
              )}
            </div>
          </div>
        )}

        {hs.liveSummaryKey === 'streak' && bindings.streak && (
          <div className="explore3d-live-card" data-testid="detail-live-streak">
            <div className="explore3d-live-card__title">
              {t('Chuỗi hiện tại', 'Current streak')}: {bindings.streak.currentStreak}{' '}
              {t('ngày', 'days')}
            </div>
            <div className="explore3d-live-card__meta">
              {t('Kỷ lục', 'Longest')}: {bindings.streak.longestStreak} {t('ngày', 'days')}
            </div>
          </div>
        )}

        {hs.liveSummaryKey === 'shop' && bindings.products.length > 0 && (
          <div className="explore3d-subsection" data-testid="detail-live-shop">
            <h3 className="explore3d-subsection-title">
              {t('Sản phẩm nổi bật trên kệ', 'Featured shelf products')}
            </h3>
            <ul className="explore3d-product-list">
              {bindings.products.slice(0, 4).map(p => {
                const perServing =
                  p.servingsPerContainer && p.servingsPerContainer > 0
                    ? Math.round(p.price / p.servingsPerContainer)
                    : null;
                return (
                  <li key={p.id} className="explore3d-product-item">
                    <div className="explore3d-product-item__name">{p.name}</div>
                    <div className="explore3d-product-item__price">
                      <strong>{formatVnd(p.price)}</strong>
                      {perServing != null && (
                        <span>
                          {' '}
                          · {formatVnd(perServing)} / {t('lần dùng', 'serving')}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {hs.liveSummaryKey === 'coaches' && bindings.coaches.length > 0 && (
          <div className="explore3d-subsection" data-testid="detail-live-coaches">
            <h3 className="explore3d-subsection-title">
              {t('Đội ngũ Huấn luyện viên SÖL', 'SÖL Coaching Team')}
            </h3>
            <ul className="explore3d-coach-list">
              {bindings.coaches.slice(0, 4).map(c => (
                <li key={c.id} className="explore3d-coach-item">
                  <strong>{c.fullName}</strong>
                  {c.specialty && <span> · {c.specialty}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {renderHotspotCard(hs)}
      </div>
    );
  };

  const renderOverviewDirectory = (focusedLevelNode: LevelNode | null) => {
    const levels = getLevels(SOL_CENTER_SCENE);
    const hotspots = allHotspots(SOL_CENTER_SCENE);

    return (
      <div className="explore3d-detail-section" data-testid="detail-overview-directory">
        {focusedLevelNode ? (
          <>
            <div className="explore3d-detail-badges">
              <span className="explore3d-chip">{focusedLevelNode.code}</span>
            </div>
            <h2 className="explore3d-detail-title">
              {lang === 'en' ? focusedLevelNode.name.en : focusedLevelNode.name.vi}
            </h2>
            <p className="explore3d-detail-desc">
              {lang === 'en' ? focusedLevelNode.subtitle.en : focusedLevelNode.subtitle.vi}
            </p>
          </>
        ) : (
          <>
            <h2 className="explore3d-detail-title">
              {t('Tổ hợp SÖL Fitness & Wellness', 'SÖL Fitness & Wellness Center')}
            </h2>
            <p className="explore3d-detail-desc">
              {t(
                'Chọn bất kỳ tầng, khu vực hoặc thiết bị trên mô hình để xem trạng thái trực tiếp và đi thẳng tới tính năng tương ứng.',
                'Select any floor, zone or equipment in the model to inspect live telemetry and jump directly to member features.',
              )}
            </p>
          </>
        )}

        {renderLiveDataBanner(bindings.hasLiveData && !error)}

        {/* Campus & Exterior Viewpoints */}
        {SOL_CENTER_SCENE.nodes['site-sol']?.type === 'site' &&
          SOL_CENTER_SCENE.nodes['site-sol'].viewpoints.length > 0 && (
            <div className="explore3d-subsection" data-testid="detail-campus-viewpoints">
              <h3 className="explore3d-subsection-title">
                {t('Góc nhìn ngoại cảnh & toàn khu', 'Campus & exterior viewpoints')}
              </h3>
              <div className="explore3d-chip-row">
                {SOL_CENTER_SCENE.nodes['site-sol'].viewpoints.map(vp => (
                  <button
                    key={vp.id}
                    type="button"
                    className="explore3d-viewpoint-chip"
                    data-testid={`campus-viewpoint-${vp.id}`}
                    onClick={() => {
                      setFocusLevel('ALL');
                      flyToViewpoint(vp);
                    }}
                  >
                    {vp.label ? (lang === 'en' ? vp.label.en : vp.label.vi) : vp.kind}
                  </button>
                ))}
              </div>
            </div>
          )}

        {/* Zones grouped by level */}
        <div className="explore3d-subsection">
          <h3 className="explore3d-subsection-title">
            {t('Khu vực theo tầng', 'Zones by floor level')}
          </h3>
          {levels.map(lvl => {
            const lvlZones = zonesOfLevel(SOL_CENTER_SCENE, lvl.code);
            return (
              <div key={lvl.id} className="explore3d-directory-group">
                <div className="explore3d-directory-group__header">
                  <button
                    type="button"
                    className="explore3d-directory-level-btn"
                    onClick={() => setFocusLevel(lvl.code)}
                  >
                    <strong>{lvl.code}</strong> ·{' '}
                    {lang === 'en' ? lvl.name.en : lvl.name.vi}
                  </button>
                </div>
                <div className="explore3d-directory-zone-list">
                  {lvlZones.map(z => {
                    const zb = bindings.zones[z.id];
                    return (
                      <button
                        key={z.id}
                        type="button"
                        className="explore3d-directory-zone-btn"
                        data-testid={`directory-zone-${z.id}`}
                        onClick={() => selectNode(z.id, { syncLevel: true })}
                      >
                        <span className="explore3d-directory-zone-btn__name">
                          {lang === 'en' ? z.name.en : z.name.vi}
                        </span>
                        {zb && zb.roomStatus !== 'unknown' && (
                          <span className={`explore3d-status-pill is-${zb.roomStatus}`}>
                            {getRoomStatusLabel(zb.roomStatus, t)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Complete Member Feature Quick Directory (100% of hotspots) */}
        <div className="explore3d-subsection" data-testid="detail-feature-directory">
          <h3 className="explore3d-subsection-title">
            {t('Danh bạ Tính năng Hội viên', 'Member Feature Quick Directory')}
          </h3>
          <div className="explore3d-hotspot-list">
            {hotspots.map(hs => renderHotspotCard(hs))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <aside
      className="explore3d-detail-panel"
      data-testid="explore3d-detail-panel"
      aria-label={t('Chi tiết khu vực và trạng thái trực tiếp', 'Zone details and live status')}
    >
      <div className="explore3d-detail-panel__top">
        <span
          className="explore3d-sim-badge"
          data-testid="detail-sim-badge"
        >
          {t('Mô phỏng minh hoạ', 'Illustrative simulation')}
        </span>

        {selectedNode && selectedNode.type !== 'site' && (
          <button
            type="button"
            className="explore3d-detail-close"
            data-testid="detail-back-overview"
            onClick={() => flyToOverview()}
          >
            {t('Toàn cảnh', 'Overview')}
          </button>
        )}
      </div>

      {loading && (
        <div className="explore3d-detail-loading" data-testid="detail-loading">
          <LoadingSkeleton
            label={t('Đang tải dữ liệu trực tiếp...', 'Loading live center data...')}
            variant="rows"
            count={3}
          />
        </div>
      )}

      <div className="explore3d-detail-panel__body">
        {selectedNode?.type === 'zone'
          ? renderZoneDetails(selectedNode)
          : selectedNode?.type === 'item'
            ? renderItemDetails(selectedNode)
            : selectedNode?.type === 'hotspot'
              ? renderHotspotDetails(selectedNode)
              : selectedNode?.type === 'level'
                ? renderOverviewDirectory(selectedNode)
                : renderOverviewDirectory(null)}
      </div>
    </aside>
  );
}

export default DetailPanel;
