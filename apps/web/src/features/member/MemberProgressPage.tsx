import { memberText } from './memberI18n';
import { useLanguage } from '../../shared/i18n/language';
import { useEffect, useState } from 'react';
import { PageHeader } from '../../shared/ui/PageHeader';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { getMyProgressMetrics, getMyTrainingPlans, type ProgressMetric, type TrainingPlan } from './memberProgressApi';
import { weeklyMeasurements, type WeeklyPoint } from './progressPresentation';
import './member-progress.css';
import { centerNowParts } from '../../shared/lib/centerTime';
import { ActiveTrainingPlan } from './ActiveTrainingPlan';
import { WorkoutHistory } from './WorkoutHistory';

/** Số đo HLV nhập trong buổi đánh giá sức khỏe, ngoài cân nặng và BMI đã có biểu đồ. */
const EXTRA_METRICS: { key: 'height' | 'bodyFat' | 'muscleMass'; vi: string; en: string; unit: string }[] = [
  { key: 'height', vi: 'Cao', en: 'Height', unit: ' cm' },
  { key: 'bodyFat', vi: 'Mỡ', en: 'Body fat', unit: '%' },
  { key: 'muscleMass', vi: 'Cơ', en: 'Muscle', unit: ' kg' },
];

type LoadState<T> = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; data: T };

function WeeklyChart({ points, metric, label, unit }: { points: WeeklyPoint[]; metric: 'weight' | 'bmi'; label: string; unit: string }) {
  useLanguage();
  const values = points.map((point) => point[metric]);
  const available = values.filter((value): value is number => value != null);
  if (available.length === 0) return <p className="portal-empty">{memberText("Chưa có số đo ")}{label.toLowerCase()}.</p>;
  const min = Math.min(...available);
  const max = Math.max(...available);
  const span = Math.max(max - min, 1);
  const x = (index: number) => 34 + index * 84;
  const y = (value: number) => 148 - ((value - min) / span) * 110;
  const width = Math.max(350, 68 + (points.length - 1) * 84);
  // Nối các điểm có số đo thành một đường liền, kể cả khi có tuần thiếu số đo.
  const segments: string[][] = [values.flatMap((value, index) => value == null ? [] : [`${x(index)},${y(value)}`])];
  return <div className="member-progress-chart-scroll"><svg className="member-progress-chart" width={width} height="205" viewBox={`0 0 ${width} 205`} role="img" aria-label={memberText(`${label} theo tuần, ${unit}`, `${label} by week, ${unit}`)}>
    <line x1="34" y1="160" x2={width - 24} y2="160" stroke="currentColor" opacity=".3" />
    {segments.map((segment, index) => <polyline key={index} points={segment.join(' ')} fill="none" stroke="var(--portal-salmon)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />)}
    {points.map((point, index) => <g key={point.weekStart}>
      {point[metric] != null && <circle cx={x(index)} cy={y(point[metric])} r="5" fill="var(--portal-salmon)"><title>{`${point.weekStart}: ${point[metric]} ${unit}`}</title></circle>}
      <text x={x(index)} y="187" textAnchor="middle" fill="currentColor" fontSize="12">{`${point.weekStart.slice(8, 10)}/${point.weekStart.slice(5, 7)}`}</text>
    </g>)}
  </svg></div>;
}

function ProgressSummary({ points }: { points: WeeklyPoint[] }) {
  useLanguage();
  const tile = (metric: 'weight' | 'bmi', label: string, unit: string) => {
    const values = points.map((point) => point[metric]).filter((value): value is number => value != null);
    if (values.length === 0) return null;
    const latest = values[values.length - 1];
    const delta = values.length > 1 ? Math.round((latest - values[0]) * 10) / 10 : null;
    return <div className="progress-summary__tile">
      <span className="progress-summary__label">{label}</span>
      <strong className="progress-summary__value">{latest}<small> {unit}</small></strong>
      {delta !== null && <span className={`progress-summary__delta${delta === 0 ? '' : delta < 0 ? ' is-down' : ' is-up'}`}>{delta > 0 ? '+' : ''}{delta} {memberText('so với tuần đầu', 'since the first week')}</span>}
    </div>;
  };
  const tiles = [tile('weight', memberText('Cân nặng hiện tại'), 'kg'), tile('bmi', memberText('BMI hiện tại'), '')].filter(Boolean);
  if (tiles.length === 0) return null;
  return <div className="progress-summary">{tiles}</div>;
}

export function MemberProgressPage() {
  useLanguage();
 const [tab, setTab] = useState<'progress' | 'history'>('progress');
 const [date, setDate] = useState(() => centerNowParts().date);
 useEffect(() => {
  const update = () => setDate(centerNowParts().date);
  const timer = window.setInterval(update, 30000);
  window.addEventListener('focus', update);
  return () => { window.clearInterval(timer); window.removeEventListener('focus', update); };
 }, []);
 return <div data-i18n-managed className="portal-container member-progress">
   <PageHeader title={memberText("Tiến độ thể lực")} />
   <div className="portal-tabs workout-tabs" role="tablist" aria-label={memberText("Nội dung tiến độ")}>
     <button type="button" role="tab" className={`portal-tab${tab === 'progress' ? ' active' : ''}`} aria-selected={tab === 'progress'} onClick={() => setTab('progress')}>{memberText("Tiến độ & Giáo án")}</button>
     <button type="button" role="tab" className={`portal-tab${tab === 'history' ? ' active' : ''}`} aria-selected={tab === 'history'} onClick={() => setTab('history')}>{memberText("Lịch sử tập luyện")}</button>
   </div>
   <div hidden={tab !== 'progress'}><DailyProgress key={date} today={date} /></div>
   {tab === 'history' && <WorkoutHistory />}
 </div>;
}
function DailyProgress({ today }: { today: string }) {
  useLanguage();
  const [metrics, setMetrics] = useState<LoadState<ProgressMetric[]>>({ kind: 'loading' });
  const [plans, setPlans] = useState<LoadState<TrainingPlan[]>>({ kind: 'loading' });
  const [metricRetry, setMetricRetry] = useState(0);
  const [planRetry, setPlanRetry] = useState(0);

  useEffect(() => {
    let active = true;
    getMyProgressMetrics().then((data) => { if (active) setMetrics({ kind: 'ready', data }); })
      .catch(() => { if (active) setMetrics({ kind: 'error' }); });
    return () => { active = false; };
  }, [metricRetry]);
  useEffect(() => {
    let active = true;
    getMyTrainingPlans().then((data) => { if (active) setPlans({ kind: 'ready', data }); })
      .catch(() => { if (active) setPlans({ kind: 'error' }); });
    return () => { active = false; };
  }, [planRetry]);

  const points = metrics.kind === 'ready' ? weeklyMeasurements(metrics.data) : [];
  const extras = EXTRA_METRICS.filter((extra) => points.some((point) => point[extra.key] != null));
  return <div className="member-progress">
    <ActiveTrainingPlan state={plans} today={today} onRetry={() => { setPlans({ kind: 'loading' }); setPlanRetry((value) => value + 1); }} />
    <section data-i18n-managed className="portal-card" aria-labelledby="progress-metrics-title">
      <div className="portal-card-header"><h2 id="progress-metrics-title" className="portal-card-title">{memberText("Thay đổi qua các tuần")}</h2></div>
      {metrics.kind === 'loading' ? <LoadingSkeleton label={memberText("Đang tải số đo…")} variant="cards" count={2} /> : metrics.kind === 'error' ? <div role="alert">{memberText("Không thể tải số đo. ")}<button type="button" className="member-progress-link" onClick={() => { setMetrics({ kind: 'loading' }); setMetricRetry((value) => value + 1); }}>{memberText("Thử lại")}</button></div> : points.length === 0 ? <p className="portal-empty">{memberText("Chưa có đánh giá sức khỏe từ huấn luyện viên.")}</p> : <div className="member-progress-charts">
        <ProgressSummary points={points} />
        <div><h3>{memberText("Cân nặng ")}<small>kg</small></h3><WeeklyChart points={points} metric="weight" label={memberText("Cân nặng ")} unit="kg" /></div>
        <div><h3>{memberText("Chỉ số BMI")}</h3><WeeklyChart points={points} metric="bmi" label="BMI" unit="BMI" /></div>
        <div className="member-progress-values">{points.map((point) => <p key={point.weekStart}><time dateTime={point.weekStart}>{memberText("Tuần ")}{`${point.weekStart.slice(8, 10)}/${point.weekStart.slice(5, 7)}`}</time><span>{point.weight == null ? '—' : `${point.weight} kg`}</span><span>{point.bmi == null ? '—' : `BMI ${point.bmi}`}</span>{extras.map((extra) => <span key={extra.key}>{point[extra.key] == null ? '—' : `${memberText(extra.vi, extra.en)} ${point[extra.key]}${extra.unit}`}</span>)}</p>)}</div>
      </div>}
    </section>
  </div>;
}
