import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../../shared/i18n';
import { prefersReducedMotion } from '../camera/cameraMath';
import { useExploreStore } from '../state/exploreStore';
import { TOUR_STEPS } from './tourSteps';

export function GuidedTour() {
  const { lang, t } = useI18n();
  const navigate = useNavigate();

  const tourActive = useExploreStore(state => state.tourActive);
  const tourPaused = useExploreStore(state => state.tourPaused);
  const tourStepIndex = useExploreStore(state => state.tourStepIndex);
  const selectNode = useExploreStore(state => state.selectNode);
  const setTourStep = useExploreStore(state => state.setTourStep);
  const pauseTour = useExploreStore(state => state.pauseTour);
  const resumeTour = useExploreStore(state => state.resumeTour);
  const stopTour = useExploreStore(state => state.stopTour);

  const totalSteps = TOUR_STEPS.length;
  const safeIndex = Math.min(Math.max(0, tourStepIndex), totalSteps - 1);
  const currentStep = TOUR_STEPS[safeIndex];
  const reducedMotion = prefersReducedMotion();

  // Select node & sync level when tour step changes
  useEffect(() => {
    if (!tourActive || !currentStep) return;
    selectNode(currentStep.nodeId, { syncLevel: true });
    if (currentStep.level === 'ALL') {
      useExploreStore.setState({ focusLevel: 'ALL' });
    }
  }, [tourActive, safeIndex, currentStep, selectNode]);

  // Auto-advance timer (disabled when paused or under prefers-reduced-motion)
  useEffect(() => {
    if (!tourActive || tourPaused || reducedMotion || !currentStep) return;

    const timer = window.setTimeout(() => {
      if (safeIndex + 1 < totalSteps) {
        setTourStep(safeIndex + 1);
      } else {
        stopTour();
      }
    }, currentStep.durationMs);

    return () => window.clearTimeout(timer);
  }, [tourActive, tourPaused, reducedMotion, safeIndex, totalSteps, currentStep, setTourStep, stopTour]);

  // Pause automatically if the user manually interacts with the canvas
  useEffect(() => {
    if (!tourActive || tourPaused) return;

    const handleCanvasInteraction = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-testid="explore3d-tour-bar"]')) return;
      if (
        target.tagName === 'CANVAS' ||
        Boolean(target.closest('.explore3d-canvas-stage, [data-explore3d-canvas]'))
      ) {
        pauseTour();
      }
    };

    window.addEventListener('pointerdown', handleCanvasInteraction, { passive: true });
    window.addEventListener('wheel', handleCanvasInteraction, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleCanvasInteraction);
      window.removeEventListener('wheel', handleCanvasInteraction);
    };
  }, [tourActive, tourPaused, pauseTour]);

  if (!tourActive || !currentStep) {
    return null;
  }

  const titleText = lang === 'en' ? currentStep.title.en : currentStep.title.vi;
  const captionText = lang === 'en' ? currentStep.caption.en : currentStep.caption.vi;
  const ctaText = lang === 'en' ? currentStep.ctaLabel.en : currentStep.ctaLabel.vi;

  const handlePrev = () => {
    const prevIdx = (safeIndex - 1 + totalSteps) % totalSteps;
    setTourStep(prevIdx);
  };

  const handleNext = () => {
    if (safeIndex + 1 < totalSteps) {
      setTourStep(safeIndex + 1);
    } else {
      stopTour();
    }
  };

  const handleTogglePause = () => {
    if (tourPaused) {
      resumeTour();
    } else {
      pauseTour();
    }
  };

  const handleCtaClick = () => {
    pauseTour();
    navigate(currentStep.ctaTo);
  };

  return (
    <section
      className="explore3d-tour-bar"
      data-testid="explore3d-tour-bar"
      aria-label={t('Thanh điều khiển Tham quan 3D có hướng dẫn', 'Guided 3D Tour Controls')}
      aria-live="polite"
      style={{
        position: 'absolute',
        left: '50%',
        bottom: '4.75rem',
        transform: 'translateX(-50%)',
        zIndex: 25,
        width: 'min(760px, calc(100% - 2rem))',
        background: 'rgba(32, 32, 32, 0.94)',
        border: '1px solid rgba(206, 145, 128, 0.38)',
        borderRadius: '16px',
        padding: '0.875rem 1.125rem',
        color: '#faf9f6',
        boxShadow: '0 18px 42px rgba(0, 0, 0, 0.48)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div
        className="explore3d-tour-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          marginBottom: '0.35rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span
            className="explore3d-tour-counter"
            data-testid="explore3d-tour-counter"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.18rem 0.6rem',
              borderRadius: '999px',
              background: 'rgba(206, 145, 128, 0.18)',
              border: '1px solid rgba(206, 145, 128, 0.45)',
              color: '#ce9180',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
            }}
          >
            {safeIndex + 1} / {totalSteps}
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'rgba(250, 249, 246, 0.68)',
              fontWeight: 600,
            }}
          >
            {currentStep.level === 'ALL'
              ? t('Toàn cảnh', 'Overview')
              : `${t('Tầng', 'Level')} ${currentStep.level}`}
          </span>
          {(tourPaused || reducedMotion) && (
            <span
              style={{
                fontSize: '0.72rem',
                color: '#e1aa98',
                fontWeight: 600,
              }}
            >
              · {reducedMotion ? t('Chuyển bước thủ công', 'Manual step mode') : t('Đang tạm dừng', 'Paused')}
            </span>
          )}
        </div>

        {/* Step dots */}
        <div
          role="tablist"
          aria-label={t('Các điểm dừng tham quan', 'Tour stops')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
        >
          {TOUR_STEPS.map((step, idx) => {
            const active = idx === safeIndex;
            return (
              <button
                key={step.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`${idx + 1}. ${lang === 'en' ? step.title.en : step.title.vi}`}
                onClick={() => setTourStep(idx)}
                style={{
                  width: active ? '20px' : '8px',
                  height: '8px',
                  borderRadius: '999px',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  background: active ? '#ce9180' : 'rgba(250, 249, 246, 0.25)',
                  transition: 'width 160ms ease, background 160ms ease',
                }}
              />
            );
          })}
        </div>
      </div>

      <h3
        className="explore3d-tour-title"
        style={{
          margin: '0 0 0.25rem',
          fontSize: '1rem',
          fontWeight: 700,
          color: '#faf9f6',
        }}
      >
        {titleText}
      </h3>
      <p
        className="explore3d-tour-caption"
        style={{
          margin: '0 0 0.75rem',
          fontSize: '0.85rem',
          lineHeight: 1.45,
          color: 'rgba(250, 249, 246, 0.82)',
        }}
      >
        {captionText}
      </p>

      <div
        className="explore3d-tour-actions"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handlePrev}
            aria-label={t('Điểm dừng trước', 'Previous tour stop')}
            style={{
              minHeight: '38px',
              padding: '0.4rem 0.8rem',
              borderRadius: '999px',
              border: '1px solid rgba(250, 249, 246, 0.22)',
              background: 'rgba(255, 255, 255, 0.06)',
              color: '#faf9f6',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ← {t('Trước', 'Prev')}
          </button>

          {!reducedMotion && (
            <button
              type="button"
              onClick={handleTogglePause}
              aria-label={
                tourPaused
                  ? t('Tiếp tục tham quan tự động', 'Resume guided tour')
                  : t('Tạm dừng tham quan tự động', 'Pause guided tour')
              }
              style={{
                minHeight: '38px',
                padding: '0.4rem 0.85rem',
                borderRadius: '999px',
                border: '1px solid rgba(206, 145, 128, 0.45)',
                background: 'rgba(206, 145, 128, 0.14)',
                color: '#e1aa98',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {tourPaused ? `▶ ${t('Tiếp tục', 'Resume')}` : `❚❚ ${t('Tạm dừng', 'Pause')}`}
            </button>
          )}

          <button
            type="button"
            onClick={handleNext}
            aria-label={t('Điểm dừng tiếp theo', 'Next tour stop')}
            style={{
              minHeight: '38px',
              padding: '0.4rem 0.8rem',
              borderRadius: '999px',
              border: '1px solid rgba(250, 249, 246, 0.22)',
              background: 'rgba(255, 255, 255, 0.06)',
              color: '#faf9f6',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {safeIndex + 1 < totalSteps
              ? `${t('Tiếp', 'Next')} →`
              : t('Hoàn tất', 'Finish')}
          </button>

          <button
            type="button"
            onClick={stopTour}
            aria-label={t('Thoát chế độ tham quan', 'Exit guided tour')}
            style={{
              minHeight: '38px',
              padding: '0.4rem 0.75rem',
              borderRadius: '999px',
              border: '1px solid transparent',
              background: 'transparent',
              color: 'rgba(250, 249, 246, 0.72)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ✕ {t('Thoát', 'Exit')}
          </button>
        </div>

        <button
          type="button"
          onClick={handleCtaClick}
          data-testid="explore3d-tour-cta"
          style={{
            minHeight: '38px',
            padding: '0.45rem 1rem',
            borderRadius: '999px',
            border: '1px solid #ce9180',
            background: '#ce9180',
            color: '#202020',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {ctaText} →
        </button>
      </div>
    </section>
  );
}

export default GuidedTour;
