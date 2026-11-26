import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { ManagerReportsPage } from './ManagerReportsPage';
const api = vi.hoisted(() => ({ getSummary: vi.fn(), getCancellationRequests: vi.fn(), createSnapshot: vi.fn(), toast: vi.fn() }));
vi.mock('./reportsApi', () => ({ reportsApi: api }));
vi.mock('../../shared/api/client', () => ({ getCurrentUser: () => ({ role: 'MANAGER' }) }));
vi.mock('../../shared/ui/toast', () => ({ toast: api.toast }));
vi.mock('../../shared/lib/centerTime', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../shared/lib/centerTime')>(),
  centerNowParts: () => ({ date: '2026-11-24' }),
}));
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.resetAllMocks();
  api.getSummary.mockResolvedValue({ periodRevenue: 100, todayRevenue: 100, packagesSoldCount: 1, renewalRate: null,
    dailyRevenue: [{ date: '2026-10-21', revenue: 100, transactionCount: 1 }],
    packageRevenue: [{ packageId: 1, packageName: '=HYPERLINK("https://example.com")', subscriptionCount: 1, revenue: 100, percentage: 100 }],
    recentTransactions: [{ id: 1, invoiceNumber: '=invoice', memberName: ' +cmd', packageName: '@package', amount: 100, method: '=method', paidAt: '2026-10-21T08:00:00' }],
  });
  api.createSnapshot.mockResolvedValue({ id: 1 });
  api.getCancellationRequests.mockResolvedValue([]);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
// Bấm xuất báo cáo CSV.
async function exportReport() {
  await act(async () => root.render(<ManagerReportsPage />));
  const button = [...host.querySelectorAll('button')].find(b => b.textContent?.includes('Xuất báo cáo'))!;
  await act(async () => button.click());
}
it('shows cancellation requests below daily revenue and before recent transactions', async () => {
  await act(async () => root.render(<ManagerReportsPage />));
  const text = host.textContent ?? '';
  expect(text.indexOf('Doanh thu theo ngày')).toBeGreaterThan(-1);
  expect(text.indexOf('Doanh thu theo ngày')).toBeLessThan(text.indexOf('Duyệt yêu cầu hủy'));
  expect(text.indexOf('Duyệt yêu cầu hủy')).toBeLessThan(text.indexOf('Giao dịch gần đây'));
});
it('scrolls a long daily chart with the mouse wheel and lets the page scroll at the ends', async () => {
  api.getSummary.mockResolvedValueOnce({ periodRevenue: 100, todayRevenue: 0, packagesSoldCount: 0, renewalRate: null,
    dailyRevenue: Array.from({ length: 40 }, (_, i) => ({ date: new Date(Date.UTC(2026, 9, i + 1)).toISOString().slice(0, 10), revenue: i + 1, transactionCount: 1 })),
    packageRevenue: [], recentTransactions: [] });
  await act(async () => root.render(<ManagerReportsPage />));
  const chart = host.querySelector<HTMLElement>('[data-testid="daily-revenue-chart"]')!;
  Object.defineProperties(chart, { clientWidth: { value: 200 }, scrollWidth: { value: 800 } });
  const wheel = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
  chart.dispatchEvent(wheel);
  expect(chart.scrollLeft).toBe(100);
  expect(wheel.defaultPrevented).toBe(true);
  chart.scrollLeft = 600;
  const atEnd = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
  chart.dispatchEvent(atEnd);
  expect(atEnd.defaultPrevented).toBe(false);
  chart.scrollLeft = 0;
  const atStart = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
  chart.dispatchEvent(atStart);
  expect(atStart.defaultPrevented).toBe(false);
});
it('shows a load error instead of an empty count and allows retry', async () => {
  api.getCancellationRequests.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([]);
  await act(async () => root.render(<ManagerReportsPage />));
  expect(host.textContent).toContain('Không thể tải danh sách yêu cầu hủy gói');
  expect(host.textContent).not.toContain('Hiện không có yêu cầu hủy gói tập');
  expect(host.textContent).not.toContain('Hoàn tiền về Ví (0)');
  const refresh = [...host.querySelectorAll('button')].find(b => b.getAttribute('aria-label')?.includes('Làm mới yêu cầu hủy'))!;
  await act(async () => refresh.click());
  expect(host.textContent).toContain('Hiện không có yêu cầu hủy gói tập');
});
it('filters seven days including today and includes today revenue in exports', async () => {
  await act(async () => root.render(<ManagerReportsPage />));
  const button = [...host.querySelectorAll('button')].find(b => b.textContent?.includes('7 ngày qua'))!;
  await act(async () => button.click());
  expect(api.getSummary).toHaveBeenLastCalledWith('2026-11-18', '2026-11-24');
  const todayMetric = [...host.querySelectorAll('.metric-label')].find(el => el.textContent?.includes('Doanh thu hôm nay'))!.parentElement!;
  expect(todayMetric.querySelector('.metric-value')?.textContent).toContain('100');
  const exportButton = [...host.querySelectorAll('button')].find(b => b.textContent?.includes('Xuất báo cáo'))!;
  await act(async () => exportButton.click());
  const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
  expect(await blob.text()).toContain('Doanh Thu Hôm Nay,100 VNĐ');
  expect(JSON.parse(api.createSnapshot.mock.calls[0][0].data).todayRevenue).toBe(100);
});
it('defaults to thirty days including today and uses the same quick range', async () => {
  await act(async () => root.render(<ManagerReportsPage />));
  expect(api.getSummary).toHaveBeenLastCalledWith('2026-10-26', '2026-11-24');
  const button = [...host.querySelectorAll('button')].find(b => b.textContent?.includes('30 ngày qua'))!;
  await act(async () => button.click());
  expect(api.getSummary).toHaveBeenLastCalledWith('2026-10-26', '2026-11-24');
});
it('protects every untrusted CSV text cell from spreadsheet formulas', async () => {
  await exportReport();
  const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
  const csv = await blob.text();
  for (const value of ['=HYPERLINK(""https://example.com"")', '=invoice', ' +cmd', '@package', '=method']) {
    expect(csv).toContain('"' + "'" + value + '"');
  }
  expect(api.createSnapshot).toHaveBeenCalledTimes(1);
  expect(api.toast).toHaveBeenCalledWith('Đã lưu báo cáo đối soát và xuất tệp CSV.', 'success', { vi: 'Đã lưu báo cáo đối soát và xuất tệp CSV.', en: 'Reconciliation report saved and CSV exported.' });
});
it('does not report snapshot success or download a report when persistence fails', async () => {
  api.createSnapshot.mockRejectedValue(new Error('snapshot unavailable'));
  await exportReport();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(api.toast).toHaveBeenCalledWith('snapshot unavailable', 'error');
  expect(api.toast).not.toHaveBeenCalledWith(expect.any(String), 'success');
});

it('P2-FE-44 & P3-FE-21: renders unknown payment method fallback instead of blank badge, formats CSV export timestamp in center time, and styles quick range buttons with btn-secondary btn-sm', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-24T01:05:00Z')); // 08:05 24/11/2026 UTC+7
  try {
    await exportReport();
    // Unknown payment method '=method' must render '=method' inside the badge, not empty string
    const methodBadge = host.querySelector('tbody tr td:nth-child(5) .badge');
    expect(methodBadge?.textContent).toBe('=method');

    // Quick range buttons use btn-secondary btn-sm without inline style overrides
    const sevenDaysBtn = [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes('7 ngày qua'))!;
    expect(sevenDaysBtn.className).toContain('btn-secondary');
    expect(sevenDaysBtn.className).toContain('btn-sm');
    expect(sevenDaysBtn.getAttribute('style')).toBeNull();

    // CSV export timestamp uses Asia/Ho_Chi_Minh (08:05 24/11/2026)
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    const csv = await blob.text();
    expect(csv).toContain('08:05 24/11/2026');
  } finally {
    vi.useRealTimers();
  }
});
