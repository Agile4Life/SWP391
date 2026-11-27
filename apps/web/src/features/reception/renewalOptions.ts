import { staffMessage, type StaffMessage } from '../operations/staffI18n';
import type { RenewalCandidate, RenewalChainNode } from './receptionApi';

/** Thông báo lỗi chung khi kỳ gói không gia hạn được. */
const reviewPeriod = () => staffMessage(
  'Không thể gia hạn kỳ đã chọn. Vui lòng chọn kỳ khác hoặc nhờ quản lý kiểm tra.',
  'This period cannot be renewed. Choose another period or ask a manager to review it.',
);

/** Đọc ngày YYYY-MM-DD thành mốc thời gian UTC; ngày không tồn tại thì trả null. */
function dateValue(value: string): number | null {
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
}

/** Chỉ đưa cuối chuỗi đã xác minh vào dropdown; không gộp các lần mua độc lập cùng gói. */
export function eligibleRenewalOptions(
  candidates: readonly RenewalCandidate[],
  packages: readonly { id: number; durationDays: number }[],
  today: string,
): { options: RenewalCandidate[]; error: StaffMessage | null } {
  const byId = new Map<number, RenewalChainNode>();
  const duplicates = new Set<number>();
  const childCounts = new Map<number, number>();
  for (const item of candidates) {
    if (byId.has(item.id)) duplicates.add(item.id);
    byId.set(item.id, item);
  }
  const paidIds = new Set(byId.keys());
  const relationFields = ['id', 'memberId', 'packageId', 'previousSubscriptionId', 'startDate', 'endDate', 'status'] as const;
  // Metadata chỉ bổ sung quan hệ thật. Bản sao mâu thuẫn hoặc lẫn kỳ trả phí phải bị chặn.
  for (const candidate of candidates) {
    for (const ancestor of candidate.excludedTrialAncestors ?? []) {
      const existing = byId.get(ancestor.id);
      if (ancestor.memberId !== candidate.memberId) { duplicates.add(candidate.id); continue; }
      if (paidIds.has(ancestor.id) || (existing && relationFields.some(field => existing[field] !== ancestor[field]))) {
        duplicates.add(ancestor.id);
      } else {
        byId.set(ancestor.id, ancestor);
      }
    }
  }
  for (const node of byId.values()) {
    if (node.previousSubscriptionId != null) {
      childCounts.set(node.previousSubscriptionId, (childCounts.get(node.previousSubscriptionId) ?? 0) + 1);
    }
  }
  const options: RenewalCandidate[] = [];
  let error: StaffMessage | null = null;
  for (const candidate of candidates) {
    const visited = new Set<number>();
    let current: RenewalChainNode | undefined = candidate;
    let valid = true;
    // Đọc ngược tới gốc để phát hiện cả nhánh lỗi phía trước kỳ cuối, vòng lặp và liên kết thiếu.
    while (current) {
      if (visited.has(current.id) || duplicates.has(current.id)
        || (childCounts.get(current.id) ?? 0) > 1
        || !['active', 'expired'].includes(current.status.toLowerCase())
        || dateValue(current.startDate) === null || dateValue(current.endDate) === null
        || current.startDate > current.endDate || current.previousSubscriptionId === undefined) {
        valid = false; break;
      }
      visited.add(current.id);
      if (current.previousSubscriptionId === null) break;
      const parent = byId.get(current.previousSubscriptionId);
      if (!parent || parent.memberId !== current.memberId
        || current.startDate < parent.endDate
        || (parent.packageId === current.packageId && current.startDate === parent.endDate)) {
        valid = false; break;
      }
      current = parent;
    }
    if (!valid) { error ??= reviewPeriod(); continue; }
    if (childCounts.has(candidate.id)) continue;
    const duration = packages.find(pkg => pkg.id === candidate.packageId)?.durationDays;
    if (!duration || !Number.isInteger(duration) || duration < 1 || dateValue(today) === null) {
      error ??= reviewPeriod(); continue;
    }
    const reason = renewalOptionError(candidate, candidates, packages, today);
    if (reason) { error ??= reason; continue; }
    options.push(candidate);
  }
  return { options, error };
}

/** Chỉ chặn lỗi chứng minh được từ DTO thật; backend vẫn kiểm tra toàn bộ lịch sử và quyền gia hạn. */
export function renewalOptionError(
  candidate: RenewalCandidate,
  candidates: readonly RenewalCandidate[],
  packages: readonly { id: number; durationDays: number }[],
  today: string,
): StaffMessage | null {
  // Backend gia hạn từ cuối chuỗi cùng package, không từ ngày kết thúc của kỳ lịch sử đã chọn.
  let tail = candidate;
  const visited = new Set<number>();
  while (true) {
    if (visited.has(tail.id)) return reviewPeriod();
    visited.add(tail.id);
    const next = candidates.filter(item => item.previousSubscriptionId === tail.id);
    if (next.length > 1) return reviewPeriod();
    if (next.length === 0) break;
    const successor = next[0];
    if (successor.packageId !== tail.packageId) {
      return staffMessage(
        `Kỳ ${tail.packageName} đã được thay bằng ${successor.packageName}. Vui lòng chọn kỳ hiện tại.`,
        `The ${tail.packageName} period was replaced by ${successor.packageName}. Choose the current period.`,
      );
    }
    if (successor.startDate <= tail.endDate) return reviewPeriod();
    tail = successor;
  }

  // Thiếu liên kết hoặc thời hạn thì không đoán; để API quyết định thay vì chặn nhầm kỳ hợp lệ.
  if (candidates.some(item => item.previousSubscriptionId === undefined)) return null;
  const duration = packages.find(pkg => pkg.id === tail.packageId)?.durationDays;
  const tailEnd = dateValue(tail.endDate);
  const todayValue = dateValue(today);
  if (!duration || !Number.isInteger(duration) || duration < 1 || tailEnd === null || todayValue === null) return null;
  const start = tailEnd < todayValue ? todayValue : tailEnd + 86400000;
  const end = start + (duration - 1) * 86400000;
  const overlap = candidates.find(item => {
    const itemStart = dateValue(item.startDate);
    const itemEnd = dateValue(item.endDate);
    return itemStart !== null && itemEnd !== null && itemStart <= itemEnd && itemStart <= end && itemEnd >= start;
  });
  if (!overlap) return null;
  if (overlap.startDate > today || overlap.endDate < today) {
    return staffMessage(
      `Không thể gia hạn gói ${candidate.packageName} vì trùng thời hạn với kỳ ${overlap.packageName} đã thanh toán. Vui lòng chọn gói hợp lệ.`,
      `Cannot renew ${candidate.packageName} because its renewal overlaps a paid ${overlap.packageName} period. Please choose an eligible package.`,
    );
  }
  return staffMessage(
    `Không thể gia hạn gói ${candidate.packageName} vì trùng thời hạn với gói ${overlap.packageName} hiện tại. Vui lòng chọn gói hợp lệ.`,
    `Cannot renew ${candidate.packageName} because its renewal overlaps the existing ${overlap.packageName} period. Please choose an eligible package.`,
  );
}
