/** Tìm trên toàn bộ dữ liệu API đã trả, trước khi hiển thị; không sửa mảng lịch sử gốc. */
export function historyMatches(query: string, values: (string | number | null | undefined)[]): boolean {
  const clean = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
  return clean(values.filter(v => v != null).join(' ')).includes(clean(query));
}
export function sortHistory<T>(items: T[], timestamp: (item: T) => string | null, order: string): T[] {
  return [...items].sort((a, b) => {
    const left = timestamp(a), right = timestamp(b);
    if (!left) return right ? 1 : 0;
    if (!right) return -1;
    return left.localeCompare(right) * (order === 'oldest' ? 1 : -1);
  });
}
