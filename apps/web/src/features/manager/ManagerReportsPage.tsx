import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCurrentUser } from '../../shared/api/client';
import { PageHeader } from '../../shared/ui/PageHeader';
import { toast } from '../../shared/ui/toast';
import { reportsApi, type ReportSummary } from './reportsApi';

const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')} đ`;

export function ManagerReportsPage() {
  const currentUser = getCurrentUser();

  // BR-01: Chỉ CENTER_MANAGER được xem báo cáo doanh thu tài chính
  const hasAccess = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'MANAGER';
  }, [currentUser]);

  // Bộ lọc khoảng ngày mặc định: 30 ngày gần nhất
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const thirtyDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }, []);

  const [startDate, setStartDate] = useState(thirtyDaysAgoStr);
  const [endDate, setEndDate] = useState(todayStr);

  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [hoveredBar, setHoveredBar] = useState<{ date: string; revenue: number; count: number } | null>(null);

  const fetchReports = useCallback(async (start: string, end: string) => {
    if (start > end) {
      toast('Ngày bắt đầu không được lớn hơn ngày kết thúc.', 'error');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await reportsApi.getSummary(start, end);
      setSummary(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải báo cáo doanh thu.';
      setError(msg);
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasAccess) return;
    void fetchReports(thirtyDaysAgoStr, todayStr);
  }, [hasAccess, fetchReports, thirtyDaysAgoStr, todayStr]);

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchReports(startDate, endDate);
  };

  const handleQuickRange = (days: number) => {
    const end = todayStr;
    const d = new Date();
    d.setDate(d.getDate() - days);
    const start = d.toISOString().slice(0, 10);
    setStartDate(start);
    setEndDate(end);
    void fetchReports(start, end);
  };

  // 403 Forbidden Guard
  if (!hasAccess) {
    return (
      <div className="portal-container" data-testid="reports-forbidden-guard">
        <div className="portal-card">
          <div className="portal-state" style={{ padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '16px' }} role="img" aria-label="Forbidden">
              🚫
            </div>
            <h2 className="portal-state__title" style={{ fontSize: '1.5rem', marginBottom: '8px' }}>
              403 - Quyền truy cập bị từ chối
            </h2>
            <p style={{ color: '#7E7771', maxWidth: '480px', margin: '0 auto 20px auto' }}>
              Chỉ Quản lý trung tâm (Center Manager) mới có quyền truy cập báo cáo tài chính &amp; doanh thu.
            </p>
            <a href="/portal" className="btn-secondary">
              Về trang chủ Portal
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Tìm giá trị max doanh thu trong chart để chuẩn hóa tỷ lệ cột
  const dailyData = summary?.dailyRevenue || [];
  const maxDailyRevenue = Math.max(...dailyData.map((d) => d.revenue), 1);

  return (
    <div className="portal-container">
      <PageHeader
        eyebrow="Quản lý trung tâm"
        title="Báo cáo Doanh thu & Thống kê"
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => toast('Tính năng xuất file Excel/PDF đang chuẩn bị triển khai.', 'success')}
            >
              Xuất Báo Cáo
            </button>
          </div>
        }
      />

      {/* Bộ lọc khoảng ngày (Interactive Filter) */}
      <div className="portal-card" style={{ marginBottom: '24px' }}>
        <form onSubmit={handleApplyFilter} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.88rem', color: '#7E7771', fontWeight: 600 }}>Từ ngày:</span>
            <input
              type="date"
              className="portal-input"
              style={{ width: '160px', padding: '8px 12px' }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.88rem', color: '#7E7771', fontWeight: 600 }}>Đến ngày:</span>
            <input
              type="date"
              className="portal-input"
              style={{ width: '160px', padding: '8px 12px' }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Đang lọc...' : 'Áp Dụng Lọc'}
          </button>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.82rem' }}
              onClick={() => handleQuickRange(7)}
            >
              7 ngày qua
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.82rem' }}
              onClick={() => handleQuickRange(30)}
            >
              30 ngày qua
            </button>
          </div>
        </form>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="portal-card" style={{ marginBottom: '24px' }}>
          <div className="portal-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚠️</div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Lỗi khi tải dữ liệu báo cáo</h3>
            <p style={{ color: '#7E7771', marginBottom: '16px' }}>{error}</p>
            <button type="button" className="btn-primary" onClick={() => fetchReports(startDate, endDate)}>
              Thử Lại
            </button>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="metrics-grid" style={{ marginBottom: '24px' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="metric-card" style={{ opacity: 0.6 }}>
              <div className="metric-label">Đang tải số liệu...</div>
              <div className="metric-value">---</div>
            </div>
          ))}
        </div>
      )}

      {/* 4 Thẻ KPI Metrics (AC: Doanh thu ngày, Doanh thu tháng, Số gói bán ra, Tỷ lệ gia hạn) */}
      {!loading && !error && summary && (
        <div className="metrics-grid" style={{ marginBottom: '24px' }}>
          <div className="metric-card">
            <div className="metric-label">DOANH THU NGÀY (HÔM NAY)</div>
            <div className="metric-value">{vnd(summary.todayRevenue)}</div>
            <div className="metric-trend" style={{ color: summary.todayRevenue > 0 ? '#2E7D32' : '#7E7771' }}>
              {summary.todayRevenue > 0 ? '↑ Giao dịch phát sinh trong ngày' : 'Chưa có giao dịch hôm nay'}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-label">DOANH THU THÁNG (TOÀN KỲ)</div>
            <div className="metric-value">{vnd(summary.periodRevenue)}</div>
            <div className="metric-trend">Từ {startDate} đến {endDate}</div>
          </div>

          <div className="metric-card">
            <div className="metric-label">SỐ GÓI BÁN RA</div>
            <div className="metric-value">{summary.packagesSoldCount}</div>
            <div className="metric-trend">Gói dịch vụ đã thanh toán</div>
          </div>

          <div className="metric-card">
            <div className="metric-label">TỶ LỆ GIA HẠN</div>
            {/* BR-03: Tỷ lệ gia hạn = số lượt gia hạn / số gói hết hạn trong kỳ; mẫu số bằng 0 hiển thị "—" thay vì lỗi chia 0 */}
            <div className="metric-value">
              {summary.renewalRate !== null ? `${summary.renewalRate.toFixed(1)}%` : '—'}
            </div>
            <div className="metric-trend">
              {summary.renewalRate !== null ? 'Khách hàng tiếp tục duy trì' : 'Không có gói hết hạn trong kỳ'}
            </div>
          </div>
        </div>
      )}

      {/* Biểu đồ doanh thu hàng ngày & Cơ cấu doanh thu */}
      {!loading && !error && summary && (
        <div className="reports-charts-grid">
          {/* Biểu đồ cột SVG */}
          <div className="portal-card" style={{ minWidth: 0, overflow: 'hidden' }}>
            <div className="portal-card-header" style={{ marginBottom: '16px' }}>
              <h2 className="portal-card-title">Biểu Đồ Doanh Thu Theo Ngày</h2>
              <span style={{ fontSize: '0.82rem', color: '#7E7771' }}>Rê chuột vào cột để xem chi tiết</span>
            </div>

            {dailyData.length === 0 || dailyData.every((d) => d.revenue === 0) ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#7E7771' }}>
                Không có dữ liệu phát sinh doanh thu trong kỳ được chọn.
              </div>
            ) : (
              <div>
                {/* Khu vực tooltip hiển thị khi hover */}
                <div style={{ height: '32px', marginBottom: '8px', fontSize: '0.88rem', fontWeight: 600 }}>
                  {hoveredBar ? (
                    <span style={{ color: '#A06D3B' }}>
                      📅 Ngày {hoveredBar.date}: <strong>{vnd(hoveredBar.revenue)}</strong> ({hoveredBar.count} giao dịch)
                    </span>
                  ) : (
                    <span style={{ color: '#7E7771', fontWeight: 400 }}>Di chuột lên cột để xem doanh thu cụ thể</span>
                  )}
                </div>

                {/* Khung vẽ cột */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: dailyData.length > 15 ? '4px' : '8px',
                    height: '210px',
                    paddingBottom: '32px',
                    borderBottom: '1px solid #ECE7E1',
                    overflowX: 'auto',
                    overflowY: 'hidden',
                  }}
                >
                  {dailyData.map((d) => {
                    const heightPercent = d.revenue > 0 ? Math.max(8, Math.round((d.revenue / maxDailyRevenue) * 100)) : 0;
                    const isHovered = hoveredBar?.date === d.date;
                    const dateFormatted = d.date.slice(5).replace('-', '/');
                    return (
                      <div
                        key={d.date}
                        style={{
                          flex: '1 0 16px',
                          maxWidth: '40px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          height: '100%',
                          justifyContent: 'flex-end',
                        }}
                        onMouseEnter={() => setHoveredBar({ date: d.date, revenue: d.revenue, count: d.transactionCount })}
                        onMouseLeave={() => setHoveredBar(null)}
                      >
                        <div
                          style={{
                            width: '100%',
                            height: `${heightPercent}%`,
                            background: isHovered ? '#8B572A' : '#1A1614',
                            borderRadius: '4px 4px 0 0',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                          }}
                        />
                        <span
                          style={{
                            fontSize: '0.65rem',
                            color: '#7E7771',
                            marginTop: '8px',
                            transform: 'rotate(-45deg)',
                            whiteSpace: 'nowrap',
                            display: 'inline-block',
                          }}
                        >
                          {dateFormatted}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Cơ cấu doanh thu theo gói */}
          <div className="portal-card" style={{ minWidth: 0, overflow: 'hidden' }}>
            <div className="portal-card-header" style={{ marginBottom: '16px' }}>
              <h2 className="portal-card-title">Cơ Cấu Doanh Thu Theo Gói Tập</h2>
            </div>

            {summary.packageRevenue.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#7E7771' }}>
                Chưa có gói tập nào phát sinh doanh thu trong kỳ này.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {summary.packageRevenue.map((pkg) => (
                  <div key={pkg.packageId}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '6px' }}>
                      <span><strong>{pkg.packageName}</strong> ({pkg.subscriptionCount} lượt)</span>
                      <span><strong>{vnd(pkg.revenue)}</strong> ({pkg.percentage}%)</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#F0ECE6', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.min(100, pkg.percentage)}%`,
                          height: '100%',
                          background: '#1A1614',
                          borderRadius: '4px',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bảng danh sách giao dịch gần nhất */}
      {!loading && !error && summary && (
        <div className="portal-card">
          <div className="portal-card-header" style={{ marginBottom: '16px' }}>
            <h2 className="portal-card-title">Giao Dịch Thanh Toán Gần Nhất</h2>
            <span style={{ fontSize: '0.82rem', color: '#7E7771' }}>Cập nhật theo thời gian thực</span>
          </div>

          {summary.recentTransactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#7E7771' }}>
              Chưa có giao dịch thanh toán nào được ghi nhận.
            </div>
          ) : (
            <div className="portal-table-wrapper" tabIndex={0} role="region" aria-label="Giao dịch gần đây, cuộn ngang để xem đầy đủ">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Mã Hóa Đơn</th>
                    <th>Hội Viên</th>
                    <th>Dịch Vụ / Gói Tập</th>
                    <th>Số Tiền</th>
                    <th>Hình Thức</th>
                    <th>Thời Gian</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{tx.invoiceNumber}</td>
                      <td>{tx.memberName}</td>
                      <td>{tx.packageName}</td>
                      <td style={{ fontWeight: 600, color: '#2E7D32' }}>{vnd(tx.amount)}</td>
                      <td>
                        <span className="badge badge-success" style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                          {tx.method}
                        </span>
                      </td>
                      <td style={{ color: '#7E7771', fontSize: '0.84rem' }}>{tx.paidAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
