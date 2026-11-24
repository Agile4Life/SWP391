import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../../shared/i18n';
import { prefersReducedMotion } from '../camera/cameraMath';
import { useExploreStore } from '../state/exploreStore';
import { TOUR_STEPS } from './tourSteps';

/**
 * Thanh tour tham quan có hướng dẫn: tự chuyển qua các bước (chọn đối tượng, đổi tầng), có nút trước/sau, tạm
 * dừng/tiếp tục và nút kêu gọi hành động; tự tạm dừng khi người dùng tương tác với canvas.
 */
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

  // Chọn nút và đồng bộ tầng khi bước tour thay đổi
  useEffect(() => {
    if (!tourActive || !currentStep) return;
    selectNode(currentStep.nodeId, { syncLevel: true });
    if (currentStep.level === 'ALL') {
      useExploreStore.setState({ focusLevel: 'ALL' });
    }
  }, [tourActive, safeIndex, currentStep, selectNode]);

  // Bộ hẹn giờ tự chuyển bước (tắt khi tạm dừng hoặc khi bật prefers-reduced-motion)
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

  // Tự động tạm dừng nếu người dùng thao tác thủ công lên canvas
  useEffect(() => {
    if (!tourActive || tourPaused) return;

    // Người dùng bấm hoặc cuộn trên canvas 3D thì tạm dừng tour (bỏ qua thao tác trên chính thanh tour).
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

  // Về bước trước (vòng lại bước cuối).
  const handlePrev = () => {
    const prevIdx = (safeIndex - 1 + totalSteps) % totalSteps;
    setTourStep(prevIdx);
  };

  // Sang bước sau; hết bước thì dừng tour.
  const handleNext = () => {
    if (safeIndex + 1 < totalSteps) {
      setTourStep(safeIndex + 1);
    } else {
      stopTour();
    }
  };

  // Bật/tắt tạm dừng.
  const handleTogglePause = () => {
    if (tourPaused) {
      resumeTour();
    } else {
      pauseTour();
    }
  };

  // Bấm nút hành động của bước: tạm dừng tour rồi chuyển tới trang đích.
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
        bottom: '3.75rem',
        transform: 'translateX(-50%)',
        zIndex: 25,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '0.35rem',
        width: 'min(660px, calc(100% - 13rem))',
        background: 'var(--explore-surface-elevated)',
        border: '1px solid var(--explore-border-accent)',
        borderRadius: '16px',
        padding: '0.65rem 0.95rem',
        color: 'var(--explore-ink)',
        boxShadow: 'var(--explore-shadow)',
        backdropFilter: 'blur(14px)',
        whiteSpace: 'normal',
      }}
    >
      <div
        className="explore3d-tour-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.6rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            className="explore3d-tour-counter"
            data-testid="explore3d-tour-counter"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.14rem 0.55rem',
              borderRadius: '999px',
              background: 'rgb(var(--sol-accent-rgb) / .18)',
              border: '1px solid var(--explore-border-accent)',
              color: 'var(--explore-accent)',
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
              letterSpacing: '0.06em',
              color: 'var(--explore-ink-muted)',
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
                fontSize: '0.75rem',
                color: 'var(--explore-accent)',
                fontWeight: 600,
              }}
            >
              · {reducedMotion ? t('Chuyển bước thủ công', 'Manual step mode') : t('Đang tạm dừng', 'Paused')}
            </span>
          )}
        </div>

        {/* Các chấm chỉ báo bước */}
        <div
          role="tablist"
          aria-label={t('Các điểm dừng tham quan', 'Tour stops')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
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
                  minWidth: '24px',
                  minHeight: '24px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  background: 'transparent',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: 'block',
                    width: active ? '18px' : '7px',
                    height: '7px',
                    borderRadius: '999px',
                    background: active ? 'var(--explore-accent)' : 'var(--explore-border)',
                    transition: 'width 160ms ease, background 160ms ease',
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <h3
        className="explore3d-tour-title"
        style={{
          margin: 0,
          fontSize: '0.92rem',
          fontWeight: 700,
          color: 'var(--explore-ink)',
        }}
      >
        {titleText}
      </h3>
      <p
        className="explore3d-tour-caption"
        style={{
          margin: '0 0 0.2rem',
          fontSize: '0.78rem',
          lineHeight: 1.4,
          color: 'var(--explore-ink-muted)',
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
          gap: '0.45rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handlePrev}
            aria-label={t('Điểm dừng trước', 'Previous tour stop')}
            className="explore3d-tour-bar__pill-btn"
            style={{
              minHeight: '32px',
              padding: '0.28rem 0.7rem',
              borderRadius: '999px',
              border: '1px solid var(--explore-border)',
              background: 'var(--explore-chip-bg)',
              color: 'var(--explore-ink)',
              fontSize: '0.75rem',
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
              className="explore3d-tour-bar__pill-btn"
              style={{
                minHeight: '32px',
                padding: '0.28rem 0.75rem',
                borderRadius: '999px',
                border: '1px solid var(--explore-border-accent)',
                background: 'rgb(var(--sol-accent-rgb) / .14)',
                color: 'var(--explore-ink)',
                fontSize: '0.75rem',
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
            className="explore3d-tour-bar__pill-btn"
            style={{
              minHeight: '32px',
              padding: '0.28rem 0.7rem',
              borderRadius: '999px',
              border: '1px solid var(--explore-border)',
              background: 'var(--explore-chip-bg)',
              color: 'var(--explore-ink)',
              fontSize: '0.75rem',
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
              minHeight: '32px',
              padding: '0.28rem 0.65rem',
              borderRadius: '999px',
              border: '1px solid transparent',
              background: 'transparent',
              color: 'var(--explore-ink-muted)',
              fontSize: '0.75rem',
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
          className="explore3d-tour-bar__pill-btn explore3d-tour-bar__pill-btn--primary"
          style={{
            minHeight: '32px',
            padding: '0.32rem 0.85rem',
            borderRadius: '999px',
            border: '1px solid var(--explore-accent)',
            background: 'var(--explore-accent)',
            color: 'var(--explore-on-accent)',
            fontSize: '0.76rem',
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
