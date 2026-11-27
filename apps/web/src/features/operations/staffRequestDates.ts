import { centerNowParts } from '../../shared/lib/centerTime';
import type { StaffInternalRequestDto } from './staffRequestApi';

// Chỉ là dấu hiệu hiển thị; trạng thái lưu vẫn là PENDING và Backend quyết định quyền duyệt.
export function isOverdueLeave(request: StaffInternalRequestDto): boolean {
  return request.requestType === 'LEAVE' && request.status === 'PENDING'
    && !!request.startDate && request.startDate <= centerNowParts().date;
}
