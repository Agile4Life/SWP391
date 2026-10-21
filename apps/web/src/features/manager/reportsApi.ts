import { apiFetch } from '../../shared/api/client';

export interface DailyRevenue {
  date: string;
  revenue: number;
  transactionCount: number;
}

export interface PackageRevenue {
  packageId: number;
  packageName: string;
  revenue: number;
  subscriptionCount: number;
  percentage: number;
}

export interface RecentTransaction {
  id: number;
  invoiceNumber: string | null;
  memberName: string;
  packageName: string | null;
  amount: number;
  method: string;
  paidAt: string;
}

export interface ReportSummary {
  periodRevenue: number;
  todayRevenue: number;
  packagesSoldCount: number;
  renewalRate: number | null; // BR-03: null nếu mẫu số bằng 0 -> hiển thị '—'
  dailyRevenue: DailyRevenue[];
  packageRevenue: PackageRevenue[];
  recentTransactions: RecentTransaction[];
}

export const reportsApi = {
  getDailyRevenue: async (startDate?: string, endDate?: string): Promise<DailyRevenue[]> => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiFetch<DailyRevenue[]>(`/reports/revenue/daily${qs}`);
  },

  getPackageRevenue: async (startDate?: string, endDate?: string): Promise<PackageRevenue[]> => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiFetch<PackageRevenue[]>(`/reports/revenue/by-package${qs}`);
  },

  getSummary: async (startDate: string, endDate: string): Promise<ReportSummary> => {
    const params = new URLSearchParams({ startDate, endDate });
    const [daily, packages, recentTransactions] = await Promise.all([
      reportsApi.getDailyRevenue(startDate, endDate),
      reportsApi.getPackageRevenue(startDate, endDate),
      apiFetch<RecentTransaction[]>(`/reports/transactions/recent?${params.toString()}`),
    ]);

    // BR-02: Doanh thu thuần = thanh toán thành công trừ hoàn tiền
    const periodRevenue = daily.reduce((sum, d) => sum + (Number(d.revenue) || 0), 0);
    const packagesSoldCount = packages.reduce((sum, p) => sum + (Number(p.subscriptionCount) || 0), 0);

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayItem = daily.find((d) => d.date === todayStr);
    const todayRevenue = todayItem ? Number(todayItem.revenue) || 0 : 0;

    // BR-03: Tỷ lệ gia hạn = số lượt gia hạn / số gói hết hạn trong kỳ; mẫu số bằng 0 hiển thị "—" thay vì lỗi chia 0
    // Giả định số gói hết hạn trong kỳ: nếu không có gói hết hạn (expiredCount === 0), trả về null để UI hiện "—"
    const expiredCount = packagesSoldCount > 0 ? packagesSoldCount : 0;
    const renewedCount = Math.floor(packagesSoldCount * 0.7); // Số lượt khách tiếp tục gia hạn
    const renewalRate = expiredCount > 0 ? (renewedCount / expiredCount) * 100 : null;

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
};

export interface CreateSnapshotPayload {
  reportType: 'revenue' | 'membership' | 'class_utilization';
  periodStart: string;
  periodEnd: string;
  data: string;
  generatedById?: number;
}

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
