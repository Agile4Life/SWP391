import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExploreCanvas } from './canvas/ExploreCanvas';
import { WebGLGate } from './canvas/WebGLGate';
import { DetailPanel } from './components/DetailPanel';
import { ExploreBreadcrumb } from './components/ExploreBreadcrumb';
import { ExploreSearchModal } from './components/ExploreSearchModal';
import { ExploreToolbar } from './components/ExploreToolbar';
import { LevelSwitcher } from './components/LevelSwitcher';
import { useLiveCenterData } from './data/useLiveCenterData';
import './explore3d.css';
import { FloorPlan2D } from './fallback/FloorPlan2D';
import { PerfOverlay } from './perf/PerfOverlay';
import { SOL_CENTER_SCENE } from './scene/solCenter.scene';
import { zoneOf } from './scene/selectors';
import {
  loadExploreSessionView,
  parseExploreSearchParams,
} from './state/deepLink';
import { useExploreStore } from './state/exploreStore';
import { GuidedTour } from './tour/GuidedTour';

export function ExplorePage() {
  const [searchParams] = useSearchParams();
  const selectedId = useExploreStore(state => state.selectedId);
  const viewMode = useExploreStore(state => state.viewMode);

  const parsedParams = parseExploreSearchParams(searchParams);
  const perfEnabled = Boolean(parsedParams.perf || parsedParams.bench);
  const benchEnabled = Boolean(parsedParams.bench);

  // Sync URL deep-link params or restore previous session view on mount / param change
  useEffect(() => {
    const parsed = parseExploreSearchParams(searchParams);
    const hasUrlOverrides = Boolean(
      parsed.level || parsed.selectedId || parsed.viewMode,
    );

    const store = useExploreStore.getState();

    if (parsed.viewMode) {
      store.setViewMode(parsed.viewMode);
    } else if (!store.webglUnavailable && store.contextLostCount < 2 && store.viewMode !== '3d') {
      store.setViewMode('3d');
    }

    if (hasUrlOverrides) {
      if (parsed.level && !parsed.selectedId) {
        store.setFocusLevel(parsed.level);
      }
      if (parsed.selectedId) {
        store.selectNode(parsed.selectedId, { syncLevel: true });
      }
      return;
    }

    const saved = loadExploreSessionView();
    if (saved) {
      useExploreStore.setState({
        focusLevel: saved.focusLevel,
        selectedId: saved.selectedId,
        levelMode: saved.levelMode,
        wallMode: saved.wallMode,
      });
    }
  }, [searchParams]);

  const activeZone = zoneOf(SOL_CENTER_SCENE, selectedId);
  const { snapshot, bindings, loading, error, refresh } = useLiveCenterData(
    activeZone?.id ?? null,
  );

  return (
    <div className="explore3d-page" data-testid="explore3d-page">
      <div
        className="explore3d-Stage explore3d-stage"
        data-testid="explore3d-stage"
        data-html2canvas-ignore="true"
      >
        <ExploreBreadcrumb />
        <LevelSwitcher />
        <PerfOverlay visible={perfEnabled} />

        {viewMode === '3d' ? (
          <WebGLGate fallback={<FloorPlan2D bindings={bindings} />}>
            <ExploreCanvas bindings={bindings} benchEnabled={benchEnabled} />
          </WebGLGate>
        ) : (
          <FloorPlan2D bindings={bindings} />
        )}

        <GuidedTour />
        <ExploreToolbar />
      </div>

      <DetailPanel
        bindings={bindings}
        snapshot={snapshot}
        loading={loading}
        error={error}
        onRefresh={() => void refresh()}
      />

      <ExploreSearchModal />
    </div>
  );
}

export default ExplorePage;
