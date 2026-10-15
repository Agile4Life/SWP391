import { useState, useEffect } from 'react';
import { getCurrentUser } from '../../shared/api/client';
import { toast } from '../../shared/ui/toast';
import { PageHeader } from '../../shared/ui/PageHeader';

export function MemberCardPage() {
  const currentUser = getCurrentUser();
  const holderName = (currentUser?.name || 'Nguyễn Văn An').toUpperCase();
  const [secondsLeft, setSecondsLeft] = useState(60);

  // Dynamic QR auto-refresh countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 1 ? prev - 1 : 60));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const checkinLogs = [
    { date: '26/09/2026', time: '07:15', gate: 'Gate A - Sảnh Chính', method: 'Dynamic QR', status: 'Hợp lệ' },
    { date: '24/09/2026', time: '17:42', gate: 'Gate B - Thang Máy Tầng 2', method: 'Dynamic QR', status: 'Hợp lệ' },
    { date: '22/09/2026', time: '18:05', gate: 'Gate A - Sảnh Chính', method: 'Dynamic QR', status: 'Hợp lệ' },
    { date: '20/09/2026', time: '08:30', gate: 'Gate C - Hồ Bơi Oasis', method: 'Dynamic QR', status: 'Hợp lệ' },
  ];

  const payments = [
    { id: 'INV-2026-00452', package: 'The Sanctuary (3 Tháng)', amount: '7.500.000 đ', date: '15/09/2026', method: 'Chuyển khoản VietQR', status: 'PAID' },
    { id: 'INV-2026-00128', package: 'The Essential (1 Tháng)', amount: '2.800.000 đ', date: '15/08/2026', method: 'POS Quẹt thẻ', status: 'PAID' },
  ];

  return (
    <div className="portal-container">
      <PageHeader
        eyebrow="Hội viên"
        title="Thẻ thành viên"
        actions={<span className="badge badge-success">Gói tập đang hoạt động</span>}
      />

      <div className="grid-2">
        {/* Luxury Gold Virtual Member Card */}
        <div
          className="pass-card"
          style={{
            background: 'var(--portal-pass-bg, linear-gradient(135deg, #2B2420 0%, #1A1614 60%, #3A322C 100%))',
            borderRadius: '4px',
            padding: '36px',
            color: '#FAF8F5',
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--portal-pass-line, rgba(194, 166, 132, 0.35))',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '380px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.4rem',
                  letterSpacing: '0.18em',
                  fontWeight: 600,
                  color: '#FAF8F5',
                }}
              >
                SÖL WELLNESS SANCTUARY
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--portal-pass-accent, #C2A684)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                VIP RESIDENCY MEMBER PASS
              </div>
            </div>

            <span
              style={{
                background: 'var(--portal-pass-accent, #C2A684)',
                color: '#1A1614',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.15em',
                padding: '4px 10px',
                borderRadius: '4px',
              }}
            >
              ACTIVE
            </span>
          </div>

          {/* Dynamic QR Display */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '28px', margin: '24px 0' }}>
            {/* SVG Simulated QR */}
            <div
              style={{
                background: '#FFFFFF',
                padding: '12px',
                borderRadius: '8px',
                width: '120px',
                height: '120px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 20px rgba(0, 0, 0, 0.3)',
              }}
            >
              <svg width="100" height="100" viewBox="0 0 100 100" fill="#1A1614">
                <rect x="0" y="0" width="30" height="30" />
                <rect x="5" y="5" width="20" height="20" fill="white" />
                <rect x="10" y="10" width="10" height="10" />

                <rect x="70" y="0" width="30" height="30" />
                <rect x="75" y="5" width="20" height="20" fill="white" />
                <rect x="80" y="10" width="10" height="10" />

                <rect x="0" y="70" width="30" height="30" />
                <rect x="5" y="75" width="20" height="20" fill="white" />
                <rect x="10" y="80" width="10" height="10" />

                <rect x="38" y="38" width="24" height="24" />
                <rect x="42" y="10" width="16" height="10" />
                <rect x="70" y="45" width="18" height="14" />
                <rect x="45" y="70" width="20" height="18" />
              </svg>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--portal-pass-muted, #B8AFA6)', letterSpacing: '0.12em', marginBottom: '4px' }}>
                MÃ QR CỬA TỰ ĐỘNG
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '1.05rem', letterSpacing: '0.1em', color: '#FAF8F5' }}>
                SOL-MB89-9831
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--portal-pass-accent, #C2A684)', marginTop: '8px' }}>
                ⟳ Tự động làm mới sau: <strong>{secondsLeft}s</strong>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--portal-pass-muted, #9E958C)', marginTop: '4px' }}>
                Đưa mã vào mắt đọc turnstile tại sảnh chính để vào cổng.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '16px' }}>
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--portal-pass-muted, #B8AFA6)', letterSpacing: '0.1em' }}>CHỦ THẺ</div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{holderName}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--portal-pass-muted, #B8AFA6)', letterSpacing: '0.1em' }}>MÃ HỘI VIÊN</div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>MB-2026-089</div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--portal-pass-muted, #B8AFA6)', letterSpacing: '0.1em' }}>NGÀY HẾT HẠN</div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--portal-pass-accent, #C2A684)' }}>26/12/2026</div>
            </div>
          </div>
        </div>

        {/* Subscription Specifications */}
        <div className="portal-card">
          <div className="portal-card-header">
            <h2 className="portal-card-title">Chi Tiết Hợp Đồng Hội Viên</h2>
          </div>

          <div className="kv-list">
            <div className="kv-row">
              <span>Tên gói tập</span>
              <strong>The Sanctuary Residency</strong>
            </div>

            <div className="kv-row">
              <span>Ngày kích hoạt</span>
              <span>15/09/2026</span>
            </div>

            <div className="kv-row">
              <span>Ngày hết hạn</span>
              <strong style={{ color: 'var(--portal-success, #15803d)' }}>26/12/2026 (Còn 42 ngày)</strong>
            </div>

            <div className="kv-row">
              <span>Lớp nhóm kèm theo</span>
              <span>Không giới hạn</span>
            </div>

            <div className="kv-row">
              <span>HLV cá nhân 1-1 còn lại</span>
              <strong>3 / 4 buổi</strong>
            </div>
          </div>

          <button
            type="button"
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: '24px' }}
            onClick={() => toast('Yêu cầu gia hạn hợp đồng đã được chuyển tới quầy Lễ tân!', 'success')}
          >
            Gia Hạn Hợp Đồng Hội Viên
          </button>
        </div>
      </div>

      {/* Tables: Check-in Logs & Invoices */}
      <div className="grid-2" style={{ marginTop: '28px' }}>
        {/* Check-in Log Table */}
        <div className="portal-card">
          <div className="portal-card-header">
            <h2 className="portal-card-title">Nhật Ký Quét Cổng Turnstile</h2>
          </div>

          <div className="portal-table-wrapper">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Giờ</th>
                  <th>Cổng quét</th>
                  <th>Phương thức</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {checkinLogs.map((log, i) => (
                  <tr key={i}>
                    <td>{log.date}</td>
                    <td style={{ fontWeight: 600 }}>{log.time}</td>
                    <td>{log.gate}</td>
                    <td>{log.method}</td>
                    <td><span className="badge badge-success">{log.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invoice & Payments History */}
        <div className="portal-card">
          <div className="portal-card-header">
            <h2 className="portal-card-title">Hóa Đơn &amp; Lịch Sử Thanh Toán</h2>
          </div>

          <div className="portal-table-wrapper">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Mã Hóa Đơn</th>
                  <th>Khoản mục</th>
                  <th>Số tiền</th>
                  <th>Hình thức</th>
                  <th>Tình trạng</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{p.id}</td>
                    <td>{p.package}</td>
                    <td style={{ fontWeight: 600 }}>{p.amount}</td>
                    <td>{p.method}</td>
                    <td><span className="badge badge-success">{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
