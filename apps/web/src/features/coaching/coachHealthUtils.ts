import type { HealthMetric } from '../member/profileApi';

export interface HealthMetricsSummary {
  memberId: number;
  heightCm?: number;
  weightKg?: number;
  bmi?: number;
}

export function calculateAutoBmi(heightCm?: number | null, weightKg?: number | null): number | undefined {
  if (heightCm == null || weightKg == null || !Number.isFinite(heightCm) || !Number.isFinite(weightKg) || heightCm <= 0 || weightKg <= 0) return undefined;
  const heightMeters = heightCm / 100;
  return Math.round((weightKg / (heightMeters * heightMeters)) * 10) / 10;
}

export function summarizeHealthMetrics(memberId: number, rows: readonly Pick<HealthMetric, 'metricName' | 'metricValue'>[]): HealthMetricsSummary {
  let heightCm: number | undefined;
  let weightKg: number | undefined;
  let recordedBmi: number | undefined;
  for (const row of rows) {
    const metric = row.metricName?.toLowerCase();
    const val = Number(row.metricValue);
    if (!Number.isFinite(val) || val <= 0) continue;
    if (metric === 'height' && heightCm === undefined) heightCm = val;
    else if (metric === 'weight' && weightKg === undefined) weightKg = val;
    else if (metric === 'bmi' && recordedBmi === undefined) recordedBmi = val;
  }
  return { memberId, heightCm, weightKg, bmi: calculateAutoBmi(heightCm, weightKg) ?? recordedBmi };
}
