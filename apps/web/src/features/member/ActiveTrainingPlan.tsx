import { EmptyState } from '../../shared/ui/EmptyState';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { useLanguage } from '../../shared/i18n/language';
import { memberText } from './memberI18n';
import { activePlans, planDays } from './progressPresentation';
import type { TrainingItem, TrainingPlan } from './memberProgressApi';

export type PlanLoadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; data: TrainingPlan[] };

function dayLabel(day: number | null): string {
  switch (day) {
    case 1: return memberText('Thứ 2', 'Monday');
    case 2: return memberText('Thứ 3', 'Tuesday');
    case 3: return memberText('Thứ 4', 'Wednesday');
    case 4: return memberText('Thứ 5', 'Thursday');
    case 5: return memberText('Thứ 6', 'Friday');
    case 6: return memberText('Thứ 7', 'Saturday');
    case 7: return memberText('Chủ nhật', 'Sunday');
    default: return memberText('Không cố định ngày', 'Any day');
  }
}

const formatDate = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

function Dose({ item }: { item: TrainingItem }) {
  return <div className="member-progress-dose">
    {item.sets != null && item.reps != null && <span>{item.sets}{memberText(' hiệp × ')}{item.reps}{memberText(' lần')}</span>}
    {item.durationMinutes != null && <span>{item.durationMinutes}{memberText(' phút')}</span>}
    {item.restSeconds != null && <span>{memberText('Nghỉ ')}{item.restSeconds}{memberText(' giây')}</span>}
  </div>;
}

/** Lịch giáo án HLV đã soạn và đang áp dụng cho hội viên, theo từng thứ trong tuần. */
export function ActiveTrainingPlan({ state, today, onRetry }: { state: PlanLoadState; today: string; onRetry: () => void }) {
  useLanguage();
  const plans = state.kind === 'ready' ? activePlans(state.data, today) : [];
  return <section data-i18n-managed id="coach-training-plan" className="portal-card" aria-labelledby="coach-training-plan-title">
    <div className="portal-card-header"><h2 id="coach-training-plan-title" className="portal-card-title">{memberText('Lịch giáo án của huấn luyện viên')}</h2></div>
    {state.kind === 'loading' ? <LoadingSkeleton label={memberText('Đang tải giáo án…')} count={3} />
      : state.kind === 'error' ? <div role="alert">{memberText('Không thể tải giáo án. ')}<button type="button" className="member-progress-link" onClick={onRetry}>{memberText('Thử lại')}</button></div>
      : plans.length === 0 ? <EmptyState variant="plain" icon="check" title={memberText('Chưa có giáo án đang áp dụng.')} description={memberText('Giáo án do huấn luyện viên soạn sẽ hiện ở đây sau khi được áp dụng. Giáo án của huấn luyện viên dành cho hội viên gói Gold trở lên.', 'The plan your coach writes appears here once applied. Coach plans are included from the Gold package.')} />
      : plans.map((plan) => <article key={plan.id} className="member-progress-plan">
        <header className="member-progress-plan__head">
          <h3>{plan.goal || memberText('Giáo án đang áp dụng')}</h3>
          <p className="muted">{plan.coachName || memberText('Huấn luyện viên')} · {formatDate(plan.startDate)} – {formatDate(plan.endDate)}</p>
        </header>
        {plan.items.length === 0 ? <p className="portal-empty">{memberText('Giáo án này chưa có bài tập nào.')}</p>
          : planDays(plan).map(({ day, items }) => <div key={String(day)} className="member-progress-plan__day">
            <h4 className="member-progress-day">{dayLabel(day)}</h4>
            <ol className="member-progress-exercises">{items.map((item) => <li key={item.id}>
              <div><strong>{item.exerciseName}</strong>{item.description && <p>{item.description}</p>}</div>
              <Dose item={item} />
            </li>)}</ol>
          </div>)}
      </article>)}
  </section>;
}
