import type { ProgressMetric, TrainingItem, TrainingPlan } from './memberProgressApi';
import { centerNowParts, parseCenterTime } from '../../shared/lib/centerTime';

export type WeeklyMetricKey = 'weight' | 'bmi' | 'height' | 'bodyFat' | 'muscleMass';
export interface WeeklyPoint { weekStart: string; weight: number | null; bmi: number | null; height: number | null; bodyFat: number | null; muscleMass: number | null }

const emptyPoint = (weekStart: string): WeeklyPoint => ({ weekStart, weight: null, bmi: null, height: null, bodyFat: null, muscleMass: null });

/** Cột số đo của bản ghi sức khỏe (do HLV đánh giá) trong tuần, hoặc null nếu không thuộc tập hiển thị. */
function metricKey(metric: ProgressMetric): WeeklyMetricKey | null {
  const name = metric.metricName.toLowerCase();
  const unit = metric.unit?.toLowerCase();
  if (name === 'weight') return unit === 'kg' ? 'weight' : null;
  if (name === 'bmi') return 'bmi';
  if (name === 'height') return unit === 'cm' ? 'height' : null;
  if (name === 'body_fat') return unit === '%' ? 'bodyFat' : null;
  if (name === 'muscle_mass') return unit === 'kg' ? 'muscleMass' : null;
  return null;
}

function mondayOf(dateKey: string): string | null {
  const parsed = parseCenterTime(dateKey);
  if (!parsed) return null;
  const date = new Date(`${centerNowParts(parsed).date}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}

export function weeklyMeasurements(metrics: ProgressMetric[]): WeeklyPoint[] {
  const weeks = new Map<string, WeeklyPoint>();
  const sorted = [...metrics].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  for (const metric of sorted) {
    const field = metricKey(metric);
    if (!field) continue;
    const key = mondayOf(metric.recordedAt);
    const value = Number(metric.metricValue);
    if (!key || !Number.isFinite(value) || value <= 0) continue;
    const point = weeks.get(key) ?? emptyPoint(key);
    point[field] = value;
    weeks.set(key, point);
  }
  if (weeks.size === 0) return [];
  const ordered = [...weeks.keys()].sort();
  const cursor = new Date(`${ordered[0]}T12:00:00Z`);
  const last = ordered[ordered.length - 1];
  const points: WeeklyPoint[] = [];
  while (cursor.toISOString().slice(0, 10) <= last) {
    const key = cursor.toISOString().slice(0, 10);
    points.push(weeks.get(key) ?? emptyPoint(key));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return points;
}

/** Giáo án HLV đang áp dụng cho hội viên, ưu tiên giáo án còn hiệu lực hôm nay. */
export function activePlans(plans: readonly TrainingPlan[], dateKey: string): TrainingPlan[] {
  const active = plans.filter((plan) => plan.status === 'active');
  const current = active.filter((plan) => plan.startDate <= dateKey && plan.endDate >= dateKey);
  return current.length > 0 ? current : active;
}

export interface PlanDay { day: number | null; items: TrainingItem[] }

/** Nhóm bài tập theo thứ (ISO 1–7), thứ 2 đến Chủ nhật; bài không gắn thứ xếp cuối. */
export function planDays(plan: TrainingPlan): PlanDay[] {
  const byDay = new Map<number | null, TrainingItem[]>();
  for (const item of [...plan.items].sort((a, b) => a.orderIndex - b.orderIndex)) {
    const day = item.dayOfWeek != null && item.dayOfWeek >= 1 && item.dayOfWeek <= 7 ? item.dayOfWeek : null;
    byDay.set(day, [...(byDay.get(day) ?? []), item]);
  }
  return [1, 2, 3, 4, 5, 6, 7, null].flatMap((day) => byDay.has(day) ? [{ day, items: byDay.get(day)! }] : []);
}
