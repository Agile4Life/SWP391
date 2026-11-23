export function calculateAutoBmi(heightCm?: number | null, weightKg?: number | null): number | undefined {
  if (heightCm == null || weightKg == null || !Number.isFinite(heightCm) || !Number.isFinite(weightKg) || heightCm <= 0 || weightKg <= 0) return undefined;
  const heightMeters = heightCm / 100;
  return Math.round((weightKg / (heightMeters * heightMeters)) * 10) / 10;
}
