import type { KeyboardEvent } from 'react';
import { useI18n } from '../../../shared/i18n';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { getLevels } from '../scene/selectors';
import type { LevelCode } from '../scene/schema';
import { useExploreStore, type LevelMode } from '../state/exploreStore';

/** Một lựa chọn tầng: mã (hoặc tất cả), nhãn ngắn và nhãn song ngữ. */
interface LevelOption {
  code: LevelCode | 'ALL';
  shortLabel: string;
  labelVi: string;
  labelEn: string;
}

const levelOptions: readonly LevelOption[] = [
  { code: 'ALL', shortLabel: 'ALL', labelVi: 'Tất cả', labelEn: 'All' },
  { code: 'RF', shortLabel: 'RF', labelVi: 'RF · Sân hiên', labelEn: 'RF · Terrace' },
  { code: 'L2', shortLabel: 'L2', labelVi: 'L2 · PT', labelEn: 'L2 · PT' },
  { code: 'L1', shortLabel: 'L1', labelVi: 'L1 · Sảnh & Gym', labelEn: 'L1 · Main' },
  { code: 'B1', shortLabel: 'B1', labelVi: 'B1 · Thay đồ', labelEn: 'B1 · Changing' },
  { code: 'OUT', shortLabel: 'OUT', labelVi: 'OUT · Tennis', labelEn: 'OUT · Tennis' },
] as const;

// Chỉ cho chọn tầng còn tồn tại trong scene; tránh chuyển camera tới sân đã bỏ.
const LEVEL_OPTIONS = levelOptions.filter(option => option.code === 'ALL' || getLevels(SOL_CENTER_SCENE).some(level => level.code === option.code));

/** Một lựa chọn chế độ xếp tầng: chế độ và nhãn song ngữ. */
interface ModeOption {
  mode: LevelMode;
  labelVi: string;
  labelEn: string;
}

const MODE_OPTIONS: readonly ModeOption[] = [
  { mode: 'stacked', labelVi: 'Gộp tầng', labelEn: 'Stacked' },
  { mode: 'exploded', labelVi: 'Tách tầng', labelEn: 'Exploded' },
  { mode: 'solo', labelVi: 'Tầng đơn', labelEn: 'Solo' },
] as const;

/** Bộ chuyển tầng và chế độ xếp tầng (gộp, tách, một tầng), điều khiển được bằng phím mũi tên. */
export function LevelSwitcher() {
  const { lang, t } = useI18n();
  const focusLevel = useExploreStore(state => state.focusLevel);
  const levelMode = useExploreStore(state => state.levelMode);
  const setFocusLevel = useExploreStore(state => state.setFocusLevel);
  const setLevelMode = useExploreStore(state => state.setLevelMode);

  // Phím mũi tên chuyển sang tầng kế/trước và chọn nó.
  const handleLevelKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      nextIndex = (index + 1) % LEVEL_OPTIONS.length;
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      nextIndex = (index - 1 + LEVEL_OPTIONS.length) % LEVEL_OPTIONS.length;
    }
    if (nextIndex !== null) {
      const nextOption = LEVEL_OPTIONS[nextIndex];
      setFocusLevel(nextOption.code);
      const container = event.currentTarget.parentElement;
      const buttons = container?.querySelectorAll<HTMLButtonElement>('button[data-level-code]');
      buttons?.[nextIndex]?.focus();
    }
  };

  return (
    <aside
      className="explore3d-level-switcher"
      data-testid="explore3d-level-switcher"
      aria-label={t('Bộ chọn tầng và chế độ hiển thị tầng', 'Floor level and stack mode switcher')}
    >
      <div
        className="explore3d-level-pill-group"
        role="group"
        aria-label={t('Chọn tầng', 'Select floor level')}
      >
        {LEVEL_OPTIONS.map((opt, idx) => {
          const active = focusLevel === opt.code;
          const displayLabel = lang === 'en' ? opt.labelEn : opt.labelVi;
          return (
            <button
              key={opt.code}
              type="button"
              className={`explore3d-level-btn${active ? ' is-active' : ''}`}
              data-testid={`explore3d-level-${opt.code}`}
              data-level-code={opt.code}
              aria-pressed={active}
              onClick={() => setFocusLevel(opt.code)}
              onKeyDown={e => handleLevelKeyDown(e, idx)}
            >
              <span className="explore3d-level-btn__label">{displayLabel}</span>
            </button>
          );
        })}
      </div>

      <div
        className="explore3d-level-mode-group"
        role="group"
        aria-label={t('Chế độ xếp tầng', 'Floor stack mode')}
      >
        {MODE_OPTIONS.map(opt => {
          const active = levelMode === opt.mode;
          const label = lang === 'en' ? opt.labelEn : opt.labelVi;
          return (
            <button
              key={opt.mode}
              type="button"
              className={`explore3d-mode-btn${active ? ' is-active' : ''}`}
              data-testid={`explore3d-levelmode-${opt.mode}`}
              aria-pressed={active}
              onClick={() => setLevelMode(opt.mode)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export default LevelSwitcher;
