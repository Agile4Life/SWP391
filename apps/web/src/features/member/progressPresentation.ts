import type { TrainingItem, TrainingPlan } from './memberProgressApi';

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
