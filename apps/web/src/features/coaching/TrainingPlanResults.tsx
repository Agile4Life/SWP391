import { useStaffI18n } from '../operations/staffI18n';
import { useMemo } from 'react';
import type { SavedTrainingPlan, SavedTrainingPlanItem } from './aiApi';

/** Kết quả tập luyện của giáo án theo ngày: từng bài và đã hoàn thành hay chưa. */
export interface PlanResults { planId: number; exerciseDate: string; items: { itemId: number; exerciseName: string; completed: boolean }[] }

/** Props của bảng giáo án: id và dữ liệu giáo án. */
export interface TrainingPlanResultsProps {
  planId?: number;
  plan?: SavedTrainingPlan | null;
}

/** Định dạng ngày YYYY-MM-DD thành dd/MM/yyyy (rỗng nếu không có). */
const formatDate = (iso?: string | null) => (iso ? iso.split('-').reverse().join('/') : '');

/** Nhãn thứ trong tuần theo ngôn ngữ; ngày 0 hoặc ngoài 1–7 là "linh hoạt". */
function getDayLabel(day: number, t: (vi: string, en?: string) => string): string {
  switch (day) {
    case 1: return t('Thứ 2', 'Monday');
    case 2: return t('Thứ 3', 'Tuesday');
    case 3: return t('Thứ 4', 'Wednesday');
    case 4: return t('Thứ 5', 'Thursday');
    case 5: return t('Thứ 6', 'Friday');
    case 6: return t('Thứ 7', 'Saturday');
    case 7: return t('Chủ nhật', 'Sunday');
    default: return t('Linh hoạt / Chưa cố định ngày', 'Flexible / Unscheduled day');
  }
}

/** Hiển thị giáo án nhóm theo thứ trong tuần. */
export function TrainingPlanResults({ plan }: TrainingPlanResultsProps) {
  const { t } = useStaffI18n();

  // Gom các bài tập theo thứ (bài không có thứ hợp lệ vào nhóm 0).
  const groupedDays = useMemo(() => {
    if (!plan?.items || plan.items.length === 0) return [];
    const groups = new Map<number, SavedTrainingPlanItem[]>();
    for (const item of plan.items) {
      const day = item.dayOfWeek && item.dayOfWeek >= 1 && item.dayOfWeek <= 7 ? item.dayOfWeek : 0;
      const list = groups.get(day) ?? [];
      list.push(item);
      groups.set(day, list);
    }
    const sortedDays = Array.from(groups.keys()).sort((a, b) => {
      if (a === 0) return 1;
      if (b === 0) return -1;
      return a - b;
    });
    return sortedDays.map(day => ({
      day,
      items: groups.get(day)!,
    }));
  }, [plan]);

  const itemsCount = plan?.items?.length ?? 0;

  return (
    <div data-i18n-managed>
      {plan && (
        <div style={{
          background: 'var(--portal-raised)',
          border: '1px solid var(--portal-border)',
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--portal-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
              {t("Mục tiêu huấn luyện", "Training Goal")}
            </div>
            <strong style={{ fontSize: '0.98rem', color: 'var(--portal-paper)', lineHeight: 1.45, display: 'block' }}>
              {plan.goal || t("Chưa đặt mục tiêu", "No goal specified")}
            </strong>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
            paddingTop: 10,
            borderTop: '1px solid var(--portal-border)',
            fontSize: '0.85rem'
          }}>
            <span style={{ color: 'var(--portal-muted)' }}>
              {formatDate(plan.startDate)} – {formatDate(plan.endDate)}
            </span>
            <span style={{
              fontWeight: 600,
              color: 'var(--portal-salmon)',
              background: 'rgba(232, 110, 80, 0.1)',
              padding: '3px 10px',
              borderRadius: 6
            }}>
              {itemsCount} {t("bài tập", "exercises")}
            </span>
          </div>
        </div>
      )}

      <div id="panel-all-exercises" role="region" aria-label={t("Toàn bộ bài tập giáo án", "All plan exercises")}>
        {groupedDays.length === 0 ? (
          <p className="portal-empty">{t("Giáo án chưa có bài tập nào.", "This training plan has no exercises.")}</p>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {groupedDays.map(({ day, items: dayItems }) => (
              <div key={day} style={{ background: 'var(--portal-surface)', border: '1px solid var(--portal-border)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottom: '1px solid var(--portal-border)', paddingBottom: 6 }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--portal-paper)', fontWeight: 700 }}>
                    {getDayLabel(day, t)}
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--portal-muted)' }}>
                    {dayItems.length} {t("bài tập", dayItems.length === 1 ? "exercise" : "exercises")}
                  </span>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {dayItems.map((item, idx) => (
                    <div key={item.id || idx} style={{
                      background: 'var(--portal-raised)',
                      borderRadius: 8,
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--portal-tint)', color: 'var(--portal-salmon)', display: 'inline-grid', placeItems: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
                            {idx + 1}
                          </span>
                          <strong style={{ fontSize: '0.92rem', color: 'var(--portal-paper)' }}>{item.exerciseName}</strong>
                        </div>
                        {item.description && (
                          <p style={{ margin: '4px 0 0 30px', fontSize: '0.8rem', color: 'var(--portal-muted)' }}>{item.description}</p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {item.sets != null && item.reps != null && (
                          <span className="exercise-spec-pill">
                            <strong>{item.sets}</strong> {t("hiệp", "sets")} {'×'} <strong>{item.reps}</strong> {t("lần", "reps")}
                          </span>
                        )}
                        {item.durationMinutes != null && (
                          <span className="exercise-spec-pill">
                            <strong>{item.durationMinutes}</strong> {t("phút", "min")}
                          </span>
                        )}
                        {item.restSeconds != null && item.restSeconds > 0 && (
                          <span className="exercise-spec-pill">
                            {t("Nghỉ", "Rest")} <strong>{item.restSeconds}s</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
