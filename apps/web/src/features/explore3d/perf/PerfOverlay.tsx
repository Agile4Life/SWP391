import { useI18n } from '../../../shared/i18n';
import { useExploreStore } from '../state/exploreStore';

export interface PerfOverlayProps {
  visible?: boolean;
}

function isPerfQueryEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('perf') === '1' || params.get('bench') === '1';
}

export function PerfOverlay({ visible }: PerfOverlayProps) {
  const { t } = useI18n();
  const perfMetrics = useExploreStore(s => s.perfMetrics);
  const tier = useExploreStore(s => s.tier);
  const dpr = useExploreStore(s => s.dpr);

  const shouldRender = visible !== undefined ? visible : isPerfQueryEnabled();
  if (!shouldRender) {
    return null;
  }

  return (
    <aside
      data-i18n-managed
      className="explore3d-perf-overlay"
      data-testid="explore3d-perf-overlay"
      aria-label={t('Thông số hiệu năng 3D', '3D Performance Telemetry')}
      style={{
        position: 'absolute',
        top: '3.6rem',
        right: '0.85rem',
        zIndex: 30,
        minWidth: '184px',
        padding: '0.6rem 0.8rem',
        borderRadius: '12px',
        background: 'var(--explore-surface-elevated)',
        border: '1px solid var(--explore-border-accent)',
        color: 'var(--explore-ink)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '0.71rem',
        lineHeight: 1.45,
        boxShadow: 'var(--explore-shadow)',
        backdropFilter: 'blur(12px)',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          fontWeight: 700,
          color: 'var(--explore-accent)',
          marginBottom: '0.25rem',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        {t('Thông số 3D SÖL', 'SÖL 3D Telemetry')}
      </div>
      <div>{`FPS: ${perfMetrics.fps}`}</div>
      <div>{`${t('Khung hình (ms)', 'Frame (ms)')}: ${perfMetrics.frameTimeMs.toFixed(1)}`}</div>
      <div>{`${t('Lượt vẽ', 'Draw Calls')}: ${perfMetrics.drawCalls}`}</div>
      <div>{`${t('Tam giác', 'Triangles')}: ${perfMetrics.triangles.toLocaleString()}`}</div>
      <div>{`${t('Hình học', 'Geometries')}: ${perfMetrics.geometries}`}</div>
      <div>{`${t('Texture', 'Textures')}: ${perfMetrics.textures}`}</div>
      <div>{`${t('Mức chất lượng', 'Quality Tier')}: ${tier.toUpperCase()}`}</div>
      <div>{`DPR: ${dpr.toFixed(2)}`}</div>
    </aside>
  );
}

export default PerfOverlay;
