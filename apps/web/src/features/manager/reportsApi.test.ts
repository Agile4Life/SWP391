import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reportsApi } from './reportsApi';
import * as client from '../../shared/api/client';

vi.mock('../../shared/api/client', () => ({
  apiFetch: vi.fn(),
}));

describe('reportsApi', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('fetches daily revenue with query params', async () => {
    const mockDaily = [{ date: '2026-10-01', revenue: 5000000, transactionCount: 2 }];
    vi.mocked(client.apiFetch).mockResolvedValueOnce(mockDaily);

    const result = await reportsApi.getDailyRevenue('2026-10-01', '2026-10-07');
    expect(client.apiFetch).toHaveBeenCalledWith('/reports/revenue/daily?startDate=2026-10-01&endDate=2026-10-07');
    expect(result).toEqual(mockDaily);
  });

  it('fetches package revenue with query params', async () => {
    const mockPackages = [
      { packageId: 1, packageName: 'Gói 1 Tháng', revenue: 3000000, subscriptionCount: 3, percentage: 100 },
    ];
    vi.mocked(client.apiFetch).mockResolvedValueOnce(mockPackages);

    const result = await reportsApi.getPackageRevenue('2026-10-01', '2026-10-07');
    expect(client.apiFetch).toHaveBeenCalledWith('/reports/revenue/by-package?startDate=2026-10-01&endDate=2026-10-07');
    expect(result).toEqual(mockPackages);
  });

  it('computes summary accurately', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const mockDaily = [
      { date: today, revenue: 2000000, transactionCount: 1 },
      { date: '2026-09-20', revenue: 3000000, transactionCount: 2 },
    ];
    const mockPackages = [
      { packageId: 1, packageName: 'VIP 3 Tháng', revenue: 5000000, subscriptionCount: 3, percentage: 100 },
    ];

    vi.mocked(client.apiFetch)
      .mockResolvedValueOnce(mockDaily)
      .mockResolvedValueOnce(mockPackages)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ expiredCount: 4, renewedCount: 3, renewalRate: 75 });

    const summary = await reportsApi.getSummary('2026-09-01', '2026-10-15');
    expect(summary.periodRevenue).toBe(5000000);
    expect(summary.todayRevenue).toBe(2000000);
    expect(summary.packagesSoldCount).toBe(3);
    expect(summary.renewalRate).toBe(75);
    expect(client.apiFetch).toHaveBeenCalledWith('/reports/renewal-rate?startDate=2026-09-01&endDate=2026-10-15');
    expect(summary.dailyRevenue).toHaveLength(2);
  });
  it('uses actual individual payments instead of synthesizing transactions from daily totals', async () => {
    const transactions = [
      { id: 78, invoiceNumber: 'SCMS-REAL-78', memberName: 'Nguyễn An', packageName: 'Gold', amount: 750000, method: 'cash', paidAt: '2026-10-05T18:45:12' },
      { id: 77, invoiceNumber: null, memberName: 'Trần Bình', packageName: null, amount: 250000, method: 'bank_transfer', paidAt: '2026-10-05T10:20:00' },
    ];
    vi.mocked(client.apiFetch)
      .mockResolvedValueOnce([{ date: '2026-10-05', revenue: 1000000, transactionCount: 2 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(transactions)
      .mockResolvedValueOnce({ expiredCount: 0, renewedCount: 0, renewalRate: null });

    const summary = await reportsApi.getSummary('2026-10-01', '2026-10-05');

    expect(summary.recentTransactions).toEqual(transactions);
    expect(client.apiFetch).toHaveBeenCalledWith('/reports/transactions/recent?startDate=2026-10-01&endDate=2026-10-05');
  });

  it('keeps recent transactions empty when no real payments are returned', async () => {
    vi.mocked(client.apiFetch)
      .mockResolvedValueOnce([{ date: '2026-10-05', revenue: 1000000, transactionCount: 2 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ expiredCount: 0, renewedCount: 0, renewalRate: null });
    expect((await reportsApi.getSummary('2026-10-01', '2026-10-05')).recentTransactions).toEqual([]);
  });

});
