import { apiFetch } from '../../shared/api/client';
import { centerNowParts } from '../../shared/lib/centerTime';

/** Doanh thu một ngày: số tiền và số giao dịch. */
export interface DailyRevenue {
  date: string;
  revenue: number;
  transactionCount: number;
}

/** Doanh thu theo gói: số tiền, số lượt đăng ký và phần trăm. */
export interface PackageRevenue {
  packageId: number;
  packageName: string;
  revenue: number;
  subscriptionCount: number;
  percentage: number;
}

/** Giao dịch gần đây: hóa đơn, hội viên, gói, số tiền, phương thức và thời điểm. */
export interface RecentTransaction {
  id: number;
  invoiceNumber: string | null;
  memberName: string;
  email?: string | null;
  phone?: string | null;
  packageName: string | null;
  amount: number;
  method: string;
  paidAt: string;
}

/**
 * Tóm tắt báo cáo: doanh thu kỳ và hôm nay, số gói bán, tỷ lệ gia hạn (null khi mẫu số 0), doanh thu theo
 * ngày/gói và giao dịch gần đây.
 */
export interface ReportSummary {
  periodRevenue: number;
  todayRevenue: number;
  packagesSoldCount: number;
  renewalRate: number | null; // BR-03: null nếu mẫu số bằng 0 -> hiển thị '—'
  dailyRevenue: DailyRevenue[];
  packageRevenue: PackageRevenue[];
  recentTransactions: RecentTransaction[];
}

/** Yêu cầu hủy gói: hội viên, gói, lý do, trạng thái duyệt, số tiền hoàn và người xử lý. */
export interface CancellationRequestDto {
  id: number;
  memberId: number;
  memberName: string | null;
  subscriptionId: number;
  packageName: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
  resolvedById?: number | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  refundAmount?: number | null;
  requestedById?: number | null;
  requestedByName?: string | null;
}

/** Gom các hàm API báo cáo và yêu cầu hủy gói. */
export const reportsApi = {
  // Lấy doanh thu theo ngày trong khoảng.
  getDailyRevenue: async (startDate?: string, endDate?: string): Promise<DailyRevenue[]> => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiFetch<DailyRevenue[]>(`/reports/revenue/daily${qs}`);
  },

  // Lấy doanh thu theo gói trong khoảng.
  getPackageRevenue: async (startDate?: string, endDate?: string): Promise<PackageRevenue[]> => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiFetch<PackageRevenue[]>(`/reports/revenue/by-package${qs}`);
  },

  // Tổng hợp báo cáo: gọi song song doanh thu ngày/gói, giao dịch gần đây và tỷ lệ gia hạn, rồi tính doanh thu kỳ, hôm nay và số gói bán.
  getSummary: async (startDate: string, endDate: string): Promise<ReportSummary> => {
    const params = new URLSearchParams({ startDate, endDate });
    const [daily, packages, recentTransactions, renewal] = await Promise.all([
      reportsApi.getDailyRevenue(startDate, endDate),
      reportsApi.getPackageRevenue(startDate, endDate),
      apiFetch<RecentTransaction[]>(`/reports/transactions/recent?${params.toString()}`),
      apiFetch<{ renewalRate: number | null }>(`/reports/renewal-rate?${params.toString()}`),
    ]);

    // BR-02: Doanh thu thuần = thanh toán thành công trừ hoàn tiền
    const periodRevenue = daily.reduce((sum, d) => sum + (Number(d.revenue) || 0), 0);
    const packagesSoldCount = packages.reduce((sum, p) => sum + (Number(p.subscriptionCount) || 0), 0);

    const todayStr = centerNowParts().date;
    const todayItem = daily.find((d) => d.date === todayStr);
    const todayRevenue = todayItem ? Number(todayItem.revenue) || 0 : 0;

    const renewalRate = renewal.renewalRate;

    return {
      periodRevenue,
      todayRevenue,
      packagesSoldCount,
      renewalRate,
      dailyRevenue: daily,
      packageRevenue: packages,
      recentTransactions,
    };
  },

  /**
   * SCRUM-79 / SCRUM-84: Lưu ảnh chụp báo cáo định kỳ (Snapshot JSONB)
   */
  createSnapshot: async (payload: CreateSnapshotPayload): Promise<ReportSnapshotDto> => {
    return apiFetch<ReportSnapshotDto>('/reports/snapshots/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Lấy danh sách các ảnh chụp snapshot đã lưu
   */
  getSnapshots: async (): Promise<ReportSnapshotDto[]> => {
    return apiFetch<ReportSnapshotDto[]>('/reports/snapshots');
  },

  /**
   * Lấy danh sách yêu cầu hủy gói tập & hoàn tiền về Ví do Lễ tân trình duyệt
   */
  getCancellationRequests: async (): Promise<CancellationRequestDto[]> => {
    return apiFetch<CancellationRequestDto[]>('/memberships/cancellations');
  },

  // Quản lý phê duyệt yêu cầu hủy gói (kèm ghi chú và số tiền hoàn).
  approveCancellationRequest: async (id: number, note?: string, refundAmount?: number): Promise<CancellationRequestDto> => {
    return apiFetch<CancellationRequestDto>(`/memberships/cancellations/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ note: note || 'Quản lý phê duyệt hủy gói & hoàn tiền về Ví', refundAmount }),
    });
  },

  // Quản lý từ chối yêu cầu hủy gói (kèm ghi chú).
  rejectCancellationRequest: async (id: number, note?: string): Promise<CancellationRequestDto> => {
    return apiFetch<CancellationRequestDto>(`/memberships/cancellations/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ note: note || 'Quản lý từ chối yêu cầu hủy gói' }),
    });
  },
};

/** Dữ liệu tạo ảnh chụp báo cáo: loại, khoảng thời gian và nội dung. */
export interface CreateSnapshotPayload {
  reportType: 'revenue' | 'membership' | 'class_utilization';
  periodStart: string;
  periodEnd: string;
  data: string;
  generatedById?: number;
}

/** Một ảnh chụp báo cáo đã lưu: loại, khoảng thời gian, nội dung, người tạo và thời điểm. */
export interface ReportSnapshotDto {
  id: number;
  reportType: string;
  periodStart: string;
  periodEnd: string;
  data: string;
  generatedById?: number;
  generatedByName?: string;
  generatedAt: string;
}
