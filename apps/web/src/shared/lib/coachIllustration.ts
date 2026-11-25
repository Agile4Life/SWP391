/** Chỉ các hồ sơ được cung cấp tường minh mới dùng ảnh chân dung theo tên; các ảnh còn lại là ảnh minh họa. */
const profilePortraits = new Map([
  ['huynh dac tai', '/images/fitness/coach-personal.jpg'],
  ['nguyen minh quan', '/images/fitness/coach-minh-quan.jpg'],
  ['tran thi my tram', '/images/fitness/coach-my-tram.jpg'],
]);

/** Ảnh chân dung riêng của HLV theo tên (bỏ dấu, bỏ tiền tố HLV/Coach); không có thì undefined. */
export function coachPortrait(coachName?: string | null) {
  const name = (coachName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd').toLowerCase().trim().replace(/\s+/g, ' ')
    .replace(/^(hlv|coach)[.:]?\s+/, '');
  return profilePortraits.get(name);
}

/**
 * Ảnh minh họa HLV: ưu tiên chân dung riêng, nếu không thì chọn ảnh theo chuyên môn (tennis, bơi, vận động, sức
 * mạnh) hoặc ảnh chung.
 */
export function coachIllustration(specialization: string | null, coachName?: string | null) {
  const portrait = coachPortrait(coachName);
  if (portrait) return portrait;
  const value = specialization || '';
  if (/tennis/i.test(value)) return '/images/fitness/coach-tennis.jpg';
  if (/bơi|swim|aquatic/i.test(value)) return '/images/fitness/coach-aquatics.jpg';
  if (/movement|mobility|core|yoga|giãn|chuyển động/i.test(value)) return '/images/fitness/coach-movement.webp';
  if (/strength|barbell|tạ|sức mạnh/i.test(value)) return '/images/fitness/coach-strength.webp';
  return '/images/fitness/coach-generic.jpg';
}
