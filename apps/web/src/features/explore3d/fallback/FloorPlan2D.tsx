import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useI18n } from '../../../shared/i18n';
import {
  EMPTY_LIVE_SNAPSHOT,
  resolveBindings,
  type NormalizedItemStatus,
  type ResolvedSceneBindings,
} from '../data/bindings';
import {
  LEVEL_ORDER,
  polygonBounds2D,
  type LevelCode,
  type Vec2,
} from '../scene/schema';
import {
  getLevelByCode,
  hotspotsOfZone,
  itemsOfZone,
  levelOf,
  wallsOfLevel,
  zonesOfLevel,
} from '../scene/selectors';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { useExploreStore } from '../state/exploreStore';

export interface FloorPlan2DProps {
  bindings?: ResolvedSceneBindings;
}

function polygonToSvgPoints(polygon: Vec2[]): string {
  return polygon.map(([x, z]) => `${x},${z}`).join(' ');
}

function polygonCentroid(polygon: Vec2[]): Vec2 {
  const b = polygonBounds2D(polygon);
  return [(b.minX + b.maxX) * 0.5, (b.minZ + b.maxZ) * 0.5];
}

function getItemFillColor(status: NormalizedItemStatus, isSelected: boolean): string {
  if (isSelected) return '#ce9180';
  switch (status) {
    case 'active':
    case 'available':
      return '#5c8f73';
    case 'maintenance':
      return '#e0a050';
    case 'broken':
      return '#c95b5b';
    case 'retired':
    case 'closed':
      return '#6b6b6b';
    default:
      return '#8a8682';
  }
}

export function FloorPlan2D({ bindings }: FloorPlan2DProps) {
  const { lang, t } = useI18n();
  const focusLevel = useExploreStore(state => state.focusLevel);
  const selectedId = useExploreStore(state => state.selectedId);
  const selectNode = useExploreStore(state => state.selectNode);
  const setFocusLevel = useExploreStore(state => state.setFocusLevel);

  const resolvedBindings = useMemo(
    () => bindings ?? resolveBindings(SOL_CENTER_SCENE, EMPTY_LIVE_SNAPSHOT),
    [bindings],
  );

  const [activeLevel, setActiveLevel] = useState<LevelCode>(() =>
    focusLevel !== 'ALL' ? focusLevel : 'L1',
  );

  // Sync activeLevel when focusLevel changes to a specific level
  useEffect(() => {
    if (focusLevel !== 'ALL') {
      setActiveLevel(focusLevel);
    }
  }, [focusLevel]);

  // Also sync activeLevel if selectedId belongs to a level
  useEffect(() => {
    if (!selectedId) return;
    const lvl = levelOf(SOL_CENTER_SCENE, selectedId);
    if (lvl) {
      setActiveLevel(lvl.code);
    }
  }, [selectedId]);

  // Global keyboard shortcuts when 2D floor plan is active (0..5, F, R, Esc, /)
  useEffect(() => {
    const isTypingElement = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      return target.isContentEditable;
    };

    const handleWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (isTypingElement(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const state = useExploreStore.getState();

      if (event.key === 'Escape') {
        if (state.searchOpen) {
          state.setSearchOpen(false);
        } else if (state.tourActive) {
          state.stopTour();
        } else if (state.selectedId) {
          state.selectNode(null);
        }
        return;
      }

      if (event.key === '/') {
        event.preventDefault();
        state.setSearchOpen(true);
        return;
      }

      if (event.key === '0') {
        event.preventDefault();
        state.setFocusLevel('ALL');
        return;
      }

      if (event.key >= '1' && event.key <= '5') {
        event.preventDefault();
        const levelIndex = Number(event.key) - 1;
        const levelCode = LEVEL_ORDER[levelIndex];
        if (levelCode) {
          setActiveLevel(levelCode);
          state.setFocusLevel(levelCode);
        }
        return;
      }

      if (event.key === 'f' || event.key === 'F') {
        if (state.selectedId) {
          event.preventDefault();
          state.flyToNode(state.selectedId, true);
        }
        return;
      }

      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        state.flyToOverview();
      }
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, []);

  const levelNode = getLevelByCode(SOL_CENTER_SCENE, activeLevel) ?? getLevelByCode(SOL_CENTER_SCENE, 'L1')!;
  const zones = zonesOfLevel(SOL_CENTER_SCENE, levelNode.code);
  const walls = wallsOfLevel(SOL_CENTER_SCENE, levelNode.code);

  const slabBounds = polygonBounds2D(levelNode.slabPolygon);
  const pad = 3.5;
  const southExtraPad = levelNode.code === 'L1' ? 8.5 : 0;
  const viewBox = `${slabBounds.minX - pad} ${slabBounds.minZ - pad} ${slabBounds.maxX - slabBounds.minX + pad * 2} ${slabBounds.maxZ - slabBounds.minZ + pad * 2 + southExtraPad}`;

  const handleSvgKeySelect = (event: KeyboardEvent, nodeId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      selectNode(nodeId);
    }
  };

  const handleSelectLevelTab = (code: LevelCode) => {
    setActiveLevel(code);
    setFocusLevel(code);
  };

  return (
    <div
      className="explore3d-floorplan-2d"
      data-testid="explore3d-floorplan-2d"
    >
      {/* 2D Level Tabs */}
      <div
        className="explore3d-floorplan-tabs"
        role="tablist"
        aria-label={t('Chọn tầng trên sơ đồ 2D', 'Select 2D floor plan level')}
      >
        {LEVEL_ORDER.map(code => {
          const lvl = getLevelByCode(SOL_CENTER_SCENE, code);
          const isCurrent = activeLevel === code;
          return (
            <button
              key={code}
              type="button"
              role="tab"
              aria-selected={isCurrent}
              className={`explore3d-floorplan-tab${isCurrent ? ' is-active' : ''}`}
              data-testid={`floorplan-tab-${code}`}
              onClick={() => handleSelectLevelTab(code)}
            >
              <strong>{code}</strong>
              {lvl && (
                <span className="explore3d-floorplan-tab__sub">
                  {lang === 'en' ? lvl.name.en : lvl.name.vi}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Interactive Architectural SVG */}
      <div className="explore3d-floorplan-canvas-wrap">
        <svg
          className="explore3d-floorplan-svg"
          data-testid={`floorplan-svg-${levelNode.code}`}
          viewBox={viewBox}
          role="img"
          aria-label={
            lang === 'en'
              ? `2D Architectural Floor Plan — ${levelNode.name.en}`
              : `Sơ đồ mặt bằng kiến trúc 2D — ${levelNode.name.vi}`
          }
        >
          {/* Level Slab Footprint */}
          <polygon
            points={polygonToSvgPoints(levelNode.slabPolygon)}
            className="explore3d-svg-slab"
            fill="#242424"
            stroke="rgba(206, 145, 128, 0.32)"
            strokeWidth={0.22}
          />

          {/* L1 Exterior Campus Forecourt: Car/EV Parking, Main Gate, Fountain & Motorbike Shelter */}
          {levelNode.code === 'L1' && (
            <g className="explore3d-svg-campus" data-testid="floorplan-campus-forecourt">
              {/* Car & EV Solar Parking Court */}
              <rect
                x={-22}
                y={16.8}
                width={16.2}
                height={5.8}
                rx={0.4}
                fill="rgba(30, 36, 46, 0.9)"
                stroke="rgba(52, 211, 153, 0.45)"
                strokeWidth={0.14}
              />
              {[-19.2, -16.5, -13.8, -11.1, -8.4].map(sx => (
                <line
                  key={sx}
                  x1={sx}
                  y1={17.1}
                  x2={sx}
                  y2={21.2}
                  stroke="rgba(248, 250, 252, 0.35)"
                  strokeWidth={0.08}
                />
              ))}
              <text
                x={-13.9}
                y={19.6}
                textAnchor="middle"
                fill="#10b981"
                fontSize={0.62}
                fontWeight={700}
              >
                {t('P · BÃI ĐỖ Ô TÔ & SẠC EV', 'P · CAR & EV PARKING')}
              </text>

              {/* Main Entrance Gate, Guard Booth & Porte-Cochère Drop-Off */}
              <rect
                x={0.5}
                y={16.4}
                width={12.4}
                height={7.4}
                rx={0.4}
                fill="rgba(206, 145, 128, 0.16)"
                stroke="#ce9180"
                strokeWidth={0.18}
              />
              <text
                x={6.7}
                y={18.6}
                textAnchor="middle"
                fill="#faf9f6"
                fontSize={0.62}
                fontWeight={700}
              >
                {t('MÁI ĐÓN SẢNH PORTE-COCHÈRE', 'PORTE-COCHÈRE DROP-OFF')}
              </text>
              <text
                x={6.7}
                y={22.8}
                textAnchor="middle"
                fill="#ce9180"
                fontSize={0.68}
                fontWeight={800}
              >
                {t('CỔNG CHÍNH SÖL · AN NINH 24/7', 'SÖL MAIN GATE · 24/7 SECURITY')}
              </text>

              {/* Reflection Fountain & Solar Car/EV + Motorbike Parking */}
              <circle
                cx={-1.8}
                cy={19.6}
                r={1.15}
                fill="rgba(56, 189, 248, 0.35)"
                stroke="#ce9180"
                strokeWidth={0.12}
              />
              <rect
                x={13.5}
                y={16.8}
                width={8.5}
                height={5.8}
                rx={0.4}
                fill="rgba(30, 36, 46, 0.9)"
                stroke="rgba(56, 189, 248, 0.45)"
                strokeWidth={0.14}
              />
              <text
                x={17.75}
                y={19.8}
                textAnchor="middle"
                fill="#38bdf8"
                fontSize={0.56}
                fontWeight={700}
              >
                {t('P · Ô TÔ EV & XE MÁY', 'P · EV CAR & MOTORBIKE')}
              </text>
            </g>
          )}

          {/* Clickable Zones */}
          {zones.map(zone => {
            const isZoneSelected = selectedId === zone.id;
            const zBinding = resolvedBindings.zones[zone.id];
            const [cx, cz] = polygonCentroid(zone.polygon);
            const zoneName = lang === 'en' ? zone.name.en : zone.name.vi;
            const statusText =
              zBinding?.roomStatus === 'available'
                ? t('Sẵn sàng', 'Available')
                : zBinding?.roomStatus === 'maintenance'
                  ? t('Bảo trì', 'Maintenance')
                  : zBinding?.roomStatus === 'closed'
                    ? t('Đóng cửa', 'Closed')
                    : null;

            return (
              <g
                key={zone.id}
                role="button"
                tabIndex={0}
                className={`explore3d-svg-zone${isZoneSelected ? ' is-selected' : ''}`}
                data-testid={`floorplan-zone-${zone.id}`}
                data-zone-id={zone.id}
                aria-label={`${zone.code} · ${zoneName}`}
                onClick={() => selectNode(zone.id)}
                onKeyDown={e => handleSvgKeySelect(e, zone.id)}
                style={{ cursor: 'pointer' }}
              >
                <polygon
                  points={polygonToSvgPoints(zone.polygon)}
                  fill={
                    isZoneSelected
                      ? 'rgba(206, 145, 128, 0.28)'
                      : 'rgba(46, 46, 46, 0.88)'
                  }
                  stroke={isZoneSelected ? '#ce9180' : 'rgba(250, 249, 246, 0.22)'}
                  strokeWidth={isZoneSelected ? 0.24 : 0.12}
                />
                <text
                  x={cx}
                  y={cz - 0.55}
                  textAnchor="middle"
                  fill={isZoneSelected ? '#ce9180' : '#faf9f6'}
                  fontSize={0.72}
                  fontWeight={700}
                >
                  {zone.code}
                </text>
                <text
                  x={cx}
                  y={cz + 0.45}
                  textAnchor="middle"
                  fill="#faf9f6"
                  fontSize={0.62}
                  fontWeight={600}
                >
                  {zoneName}
                </text>
                {statusText && (
                  <text
                    x={cx}
                    y={cz + 1.35}
                    textAnchor="middle"
                    fill={
                      zBinding?.roomStatus === 'maintenance'
                        ? '#e0a050'
                        : '#ce9180'
                    }
                    fontSize={0.52}
                    fontWeight={600}
                  >
                    {statusText}
                  </text>
                )}
              </g>
            );
          })}

          {/* Architectural Walls */}
          <g className="explore3d-svg-walls" pointerEvents="none">
            {walls.map(wall => (
              <line
                key={wall.id}
                x1={wall.start[0]}
                y1={wall.start[1]}
                x2={wall.end[0]}
                y2={wall.end[1]}
                stroke={
                  wall.material === 'glass'
                    ? 'rgba(130, 195, 225, 0.65)'
                    : wall.material === 'accent-salmon'
                      ? '#ce9180'
                      : 'rgba(250, 249, 246, 0.55)'
                }
                strokeWidth={wall.thickness}
                strokeLinecap="square"
              />
            ))}
          </g>

          {/* Zone Items (Equipment & Courts) */}
          {zones.map(zone => {
            const items = itemsOfZone(SOL_CENTER_SCENE, zone.id);
            return items.map(item => {
              const iBinding = resolvedBindings.items[item.id];
              if (iBinding && !iBinding.visible) return null;

              const isItemSelected = selectedId === item.id;
              const [ix, , iz] = item.position;
              const [w, , d] = item.dimensions;
              const deg = (item.rotationY * 180) / Math.PI;
              const fillColor = getItemFillColor(iBinding?.status ?? 'unknown', isItemSelected);
              const itemName = lang === 'en' ? item.name.en : item.name.vi;

              return (
                <g
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  className={`explore3d-svg-item${isItemSelected ? ' is-selected' : ''}`}
                  data-testid={`floorplan-item-${item.id}`}
                  aria-label={itemName}
                  transform={`translate(${ix}, ${iz}) rotate(${-deg})`}
                  onClick={e => {
                    e.stopPropagation();
                    selectNode(item.id);
                  }}
                  onKeyDown={e => handleSvgKeySelect(e, item.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {item.kind === 'planter-tree' ? (
                    <circle
                      cx={0}
                      cy={0}
                      r={Math.max(w, d) * 0.45}
                      fill={fillColor}
                      stroke={isItemSelected ? '#faf9f6' : 'rgba(0,0,0,0.45)'}
                      strokeWidth={0.08}
                    />
                  ) : (
                    <rect
                      x={-w * 0.5}
                      y={-d * 0.5}
                      width={w}
                      height={d}
                      rx={0.14}
                      fill={fillColor}
                      fillOpacity={0.78}
                      stroke={isItemSelected ? '#faf9f6' : 'rgba(250,249,246,0.35)'}
                      strokeWidth={isItemSelected ? 0.14 : 0.06}
                    />
                  )}
                  {iBinding?.overflowBadge && (
                    <text
                      x={0}
                      y={0.2}
                      textAnchor="middle"
                      fill="#202020"
                      fontSize={0.48}
                      fontWeight={800}
                    >
                      {iBinding.overflowBadge}
                    </text>
                  )}
                </g>
              );
            });
          })}

          {/* Hotspot Pins */}
          {zones.map(zone => {
            const hotspots = hotspotsOfZone(SOL_CENTER_SCENE, zone.id);
            return hotspots.map(hs => {
              const isHsSelected = selectedId === hs.id;
              const [hx, , hz] = hs.position;
              const hsTitle = lang === 'en' ? hs.title.en : hs.title.vi;

              return (
                <g
                  key={hs.id}
                  role="button"
                  tabIndex={0}
                  className={`explore3d-svg-hotspot${isHsSelected ? ' is-selected' : ''}`}
                  data-testid={`floorplan-hotspot-${hs.id}`}
                  aria-label={hsTitle}
                  transform={`translate(${hx}, ${hz})`}
                  onClick={e => {
                    e.stopPropagation();
                    selectNode(hs.id);
                  }}
                  onKeyDown={e => handleSvgKeySelect(e, hs.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    cx={0}
                    cy={0}
                    r={isHsSelected ? 0.72 : 0.56}
                    fill="#ce9180"
                    stroke="#202020"
                    strokeWidth={0.12}
                  />
                  <circle cx={0} cy={0} r={0.2} fill="#202020" />
                </g>
              );
            });
          })}
        </svg>
      </div>

      {/* Screen-reader and keyboard-accessible region listing zones & hotspots */}
      <div
        className="explore3d-floorplan-a11y-list"
        role="region"
        aria-label={t(
          'Danh sách khu vực và điểm tương tác trên tầng hiện tại',
          'Accessible list of zones and hotspots on current floor',
        )}
      >
        <div className="explore3d-floorplan-a11y-group">
          <span className="explore3d-floorplan-a11y-label">
            {t('Khu vực', 'Zones')} ({levelNode.code}):
          </span>
          {zones.map(zone => (
            <button
              key={zone.id}
              type="button"
              className={`explore3d-floorplan-a11y-btn${selectedId === zone.id ? ' is-active' : ''}`}
              data-testid={`floorplan-a11y-zone-${zone.id}`}
              aria-pressed={selectedId === zone.id}
              onClick={() => selectNode(zone.id)}
            >
              {lang === 'en' ? zone.name.en : zone.name.vi}
            </button>
          ))}
        </div>

        <div className="explore3d-floorplan-a11y-group">
          <span className="explore3d-floorplan-a11y-label">
            {t('Điểm tính năng', 'Hotspots')}:
          </span>
          {zones.flatMap(z => hotspotsOfZone(SOL_CENTER_SCENE, z.id)).map(hs => (
            <button
              key={hs.id}
              type="button"
              className={`explore3d-floorplan-a11y-btn${selectedId === hs.id ? ' is-active' : ''}`}
              data-testid={`floorplan-a11y-hotspot-${hs.id}`}
              aria-pressed={selectedId === hs.id}
              onClick={() => selectNode(hs.id)}
            >
              {lang === 'en' ? hs.title.en : hs.title.vi}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default FloorPlan2D;
