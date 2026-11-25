/**
 * Danh mục bộ môn chuẩn của SÖL, dùng chung cho landing, lịch lớp và bộ lọc portal.
 * Gym là bộ môn chính; Boxing và Yoga là bộ môn phụ.
 */
export const DISCIPLINES = [
  { id: 'gym', name: 'Gym', tier: 'main' },
  { id: 'boxing', name: 'Boxing', tier: 'secondary' },
  { id: 'yoga', name: 'Yoga', tier: 'secondary' },
] as const;

/** Mã bộ môn hợp lệ lấy từ danh sách DISCIPLINES. */
export type DisciplineId = typeof DISCIPLINES[number]['id'];

export const MAIN_DISCIPLINE = DISCIPLINES[0];
export const SECONDARY_DISCIPLINES = DISCIPLINES.filter((discipline) => discipline.tier === 'secondary');

/** Tên bộ môn trong catalog có thể khác tên chuẩn (ví dụ "Olympic Strength" thuộc Gym). */
const ALIASES: Record<DisciplineId, RegExp> = {
  gym: /\bgym\b|\bstrength\b|olympic|thể hình|tập tạ/i,
  boxing: /boxing|kickfit|đấm bốc/i,
  yoga: /yoga|mindful/i,
};

/**
 * Tên bộ môn có khớp bộ môn đang lọc không: bộ môn chuẩn thì so theo bí danh, bộ môn khác thì so chuỗi con
 * (không phân biệt hoa thường).
 */
export function matchesDiscipline(name: string | null | undefined, selected: string | null | undefined): boolean {
  const value = (name ?? '').trim().toLocaleLowerCase('vi');
  const filter = (selected ?? '').trim().toLocaleLowerCase('vi');
  if (!value || !filter) return false;
  const known = DISCIPLINES.find(
    (discipline) => discipline.name.toLocaleLowerCase('vi') === filter || discipline.id === filter,
  );
  if (known) return ALIASES[known.id].test(value);
  return value.includes(filter);
}

/** Bộ môn thuộc danh mục chuẩn của SÖL; bộ môn cũ còn sót trong CSDL (ví dụ Pilates) bị loại khỏi giao diện. */
export function isStandardDiscipline(name: string | null | undefined): boolean {
  const value = (name ?? '').trim().toLocaleLowerCase('vi');
  return DISCIPLINES.some((discipline) => ALIASES[discipline.id].test(value));
}
