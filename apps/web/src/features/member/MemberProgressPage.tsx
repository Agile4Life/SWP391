import { useEffect, useState } from 'react';
import { useLanguage } from '../../shared/i18n/language';
import { centerNowParts } from '../../shared/lib/centerTime';
import { PageHeader } from '../../shared/ui/PageHeader';
import { memberText } from './memberI18n';
import { ActiveTrainingPlan, type PlanLoadState } from './ActiveTrainingPlan';
import { getMyTrainingPlans } from './memberProgressApi';
import './member-progress.css';

export function MemberProgressPage() {
  useLanguage();
  // Trạng thái Giáo án độc lập; retry đưa UI về loading trước khi gọi lại API.
  const [plans, setPlans] = useState<PlanLoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [today, setToday] = useState(() => centerNowParts().date);

  // Dùng ngày của trung tâm để Giáo án còn hiệu lực được chọn đúng khi sang ngày mới.
  useEffect(() => {
    const update = () => setToday(centerNowParts().date);
    const timer = window.setInterval(update, 30000);
    window.addEventListener('focus', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); };
  }, []);

  useEffect(() => {
    let active = true;
    setPlans({ kind: 'loading' });
    // Chỉ lấy Giáo án HLV đã soạn; không tải số đo, lịch sử hoặc trạng thái hoàn thành bài tập.
    getMyTrainingPlans()
      .then(data => { if (active) setPlans({ kind: 'ready', data }); })
      .catch(() => { if (active) setPlans({ kind: 'error' }); });
    return () => { active = false; };
  }, [today, attempt]);

  return <div data-i18n-managed className="portal-container member-progress">
    <PageHeader title={memberText('Giáo án', 'Training plans')} />
    <ActiveTrainingPlan state={plans} today={today} onRetry={() => {
      setPlans({ kind: 'loading' });
      setAttempt(value => value + 1);
    }} />
  </div>;
}
