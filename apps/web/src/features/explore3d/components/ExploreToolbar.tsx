import { useI18n } from '../../../shared/i18n';
import { useExploreStore, type WallMode } from '../state/exploreStore';

interface WallModeOption {
  mode: WallMode;
  labelVi: string;
  labelEn: string;
}

const WALL_MODES: readonly WallModeOption[] = [
  { mode: 'cutaway', labelVi: 'Cắt tường', labelEn: 'Cutaway' },
  { mode: 'up', labelVi: 'Tường cao', labelEn: 'Walls up' },
  { mode: 'down', labelVi: 'Hạ tường', labelEn: 'Walls down' },
] as const;

export function ExploreToolbar() {
  const { lang, t } = useI18n();
  const wallMode = useExploreStore(state => state.wallMode);
  const viewMode = useExploreStore(state => state.viewMode);
  const tourActive = useExploreStore(state => state.tourActive);
  const walkMode = useExploreStore(state => state.walkMode);
  const flyToOverview = useExploreStore(state => state.flyToOverview);
  const setWallMode = useExploreStore(state => state.setWallMode);
  const setViewMode = useExploreStore(state => state.setViewMode);
  const startTour = useExploreStore(state => state.startTour);
  const stopTour = useExploreStore(state => state.stopTour);
  const setWalkMode = useExploreStore(state => state.setWalkMode);

  const handleToggleTour = () => {
    if (tourActive) {
      stopTour();
    } else {
      startTour();
    }
  };

  const handleToggleWalk = () => {
    setWalkMode(!walkMode);
  };

  const handleToggleViewMode = () => {
    setViewMode(viewMode === '3d' ? '2d' : '3d');
  };

  const handleZoom = (direction: 'in' | 'out') => {
    window.dispatchEvent(
      new CustomEvent('explore3d:zoom', { detail: { direction } }),
    );
  };

  return (
    <div
      className="explore3d-toolbar"
      data-testid="explore3d-toolbar"
      role="toolbar"
      aria-label={t('Thanh công cụ điều khiển không gian 3D', '3D Space Control Toolbar')}
    >
      <button
        type="button"
        className="explore3d-toolbar-btn"
        data-testid="explore3d-btn-overview"
        onClick={flyToOverview}
      >
        {t('Toàn cảnh', 'Overview')}
      </button>

      <div
        className="explore3d-toolbar-segment"
        role="group"
        aria-label={t('Phóng to thu nhỏ', 'Zoom controls')}
      >
        <button
          type="button"
          className="explore3d-toolbar-btn explore3d-toolbar-btn--segment"
          data-testid="explore3d-btn-zoom-out"
          aria-label={t('Thu nhỏ góc nhìn', 'Zoom out')}
          title={t('Thu nhỏ (−)', 'Zoom out (−)')}
          onClick={() => handleZoom('out')}
        >
          −
        </button>
        <button
          type="button"
          className="explore3d-toolbar-btn explore3d-toolbar-btn--segment"
          data-testid="explore3d-btn-zoom-in"
          aria-label={t('Phóng to góc nhìn', 'Zoom in')}
          title={t('Phóng to (+)', 'Zoom in (+)')}
          onClick={() => handleZoom('in')}
        >
          +
        </button>
      </div>

      <div
        className="explore3d-toolbar-segment"
        role="group"
        aria-label={t('Chế độ tường', 'Wall mode')}
      >
        {WALL_MODES.map(opt => {
          const active = wallMode === opt.mode;
          const label = lang === 'en' ? opt.labelEn : opt.labelVi;
          return (
            <button
              key={opt.mode}
              type="button"
              className={`explore3d-toolbar-btn explore3d-toolbar-btn--segment${active ? ' is-active' : ''}`}
              data-testid={`explore3d-wallmode-${opt.mode}`}
              aria-pressed={active}
              onClick={() => setWallMode(opt.mode)}
            >
              {label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className={`explore3d-toolbar-btn${tourActive ? ' is-active' : ''}`}
        data-testid="explore3d-btn-tour"
        aria-pressed={tourActive}
        onClick={handleToggleTour}
      >
        {t('Tham quan có hướng dẫn', 'Guided tour')}
      </button>

      <button
        type="button"
        className={`explore3d-toolbar-btn${walkMode ? ' is-active' : ''}`}
        data-testid="explore3d-btn-walk"
        aria-pressed={walkMode}
        onClick={handleToggleWalk}
      >
        {t('Đi bộ góc nhìn 1.65m', 'Walk view')}
      </button>

      <button
        type="button"
        className={`explore3d-toolbar-btn explore3d-toolbar-btn--accent${viewMode === '2d' ? ' is-active' : ''}`}
        data-testid="explore3d-btn-viewmode"
        aria-pressed={viewMode === '2d'}
        onClick={handleToggleViewMode}
      >
        {viewMode === '3d' ? t('Sơ đồ 2D', '2D Plan') : t('Mô hình 3D', '3D View')}
      </button>
    </div>
  );
}

export default ExploreToolbar;
