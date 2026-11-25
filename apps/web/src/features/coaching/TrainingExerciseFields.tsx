import { useStaffI18n } from '../operations/staffI18n';
import type { ExerciseValues } from './trainingExercise';

import { Select } from '../../shared/ui/Select';

/** Chuyển giá trị chuỗi từ ô số thành số hữu hạn hoặc null (chặn NaN vào controlled input). */
function parseNumberField(raw: string): number | null {
  if (raw.trim() === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Các ô nhập một bài tập: tên, mô tả, thứ, số hiệp, số lần lặp, thời lượng và thời gian nghỉ. */
export function TrainingExerciseFields({ prefix, value, onChange }: { prefix: string; value: ExerciseValues; onChange: (value: ExerciseValues) => void }) {
  const { t } = useStaffI18n();
  const numbers = [
    ['sets', 'Số hiệp', 'Sets', 1, 'sets'],
    ['reps', 'Số lần lặp / hiệp', 'Reps / set', 1, 'reps'],
    ['durationMinutes', 'Thời lượng (phút)', 'Duration (minutes)', 1, 'duration'],
    ['restSeconds', 'Nghỉ giữa hiệp (giây)', 'Rest between sets (seconds)', 0, 'rest'],
  ] as const;
  return <div data-i18n-managed className="plan-exercise-fields">
    <label className="portal-form-group plan-exercise-fields__wide" htmlFor={`${prefix}-name`}><span className="portal-label">{t("Tên bài tập")}</span><input id={`${prefix}-name`} className="portal-input" required maxLength={150} value={value.exerciseName} onChange={event => onChange({ ...value, exerciseName: event.target.value })} /></label>
    <label className="portal-form-group plan-exercise-fields__wide" htmlFor={`${prefix}-day`}><span className="portal-label">{t("Ngày tập")}</span><Select id={`${prefix}-day`} className="portal-select" value={String(value.dayOfWeek ?? '')} onChange={event => onChange({ ...value, dayOfWeek: event.target.value ? Number(event.target.value) : null })}><option value="">{t("Chưa chọn ngày")}</option>{[1, 2, 3, 4, 5, 6, 7].map(day => <option key={day} value={day}>{day === 7 ? t('Chủ nhật') : t(`Thứ ${day + 1}`, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day - 1])}</option>)}</Select></label>
    {numbers.map(([key, labelVi, labelEn, min, suffix]) => {
      const current = value[key];
      const finite = current != null && Number.isFinite(current);
      return <label key={key} className="portal-form-group" htmlFor={`${prefix}-${suffix}`}><span className="portal-label">{t(labelVi, labelEn)}</span><input id={`${prefix}-${suffix}`} className="portal-input" type="number" min={min} step={1} aria-invalid={current != null && (!finite || !Number.isInteger(current) || current < min) ? true : undefined} value={finite ? current : ''} onChange={event => onChange({ ...value, [key]: parseNumberField(event.target.value) })} /></label>;
    })}
    <label className="portal-form-group plan-exercise-fields__wide" htmlFor={`${prefix}-description`}><span className="portal-label">{t("Hướng dẫn / ghi chú")}</span><textarea id={`${prefix}-description`} className="portal-input" rows={3} value={value.description ?? ''} onChange={event => onChange({ ...value, description: event.target.value })} /></label>
  </div>;
}
