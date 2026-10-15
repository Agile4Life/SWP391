import React, { useState } from 'react';
import { StatusMark } from '../../shared/ui/StatusMark';
import { PageHeader } from '../../shared/ui/PageHeader';

interface CheckInRecord {
  id: string;
  memberCode: string;
  name: string;
  packageName: string;
  time: string;
  gate: string;
  status: 'GRANTED' | 'DENIED';
  reason?: string;
}

export function StaffCheckInPage() {
  const [scanCode, setScanCode] = useState('');
  const [currentResult, setCurrentResult] = useState<CheckInRecord | null>(null);

  const [recentCheckins, setRecentCheckins] = useState<CheckInRecord[]>([
    {
      id: 'CK-901',
      memberCode: 'MB-2026-089',
      name: 'Nguyễn Văn An',
      packageName: 'The Sanctuary (3 Tháng)',
      time: '07:15:20',
      gate: 'Turnstile A1 - Sảnh Chính',
      status: 'GRANTED',
    },
    {
      id: 'CK-900',
      memberCode: 'MB-2026-104',
      name: 'Lê Hoàng Minh',
      packageName: 'The Essential (1 Tháng)',
      time: '07:08:44',
      gate: 'Turnstile A2 - Sảnh Chính',
      status: 'DENIED',
      reason: 'Gói tập đã hết hạn từ ngày 20/09/2026',
    },
    {
      id: 'CK-899',
      memberCode: 'MB-2026-042',
      name: 'Phạm Thu Thảo',
      packageName: 'The Sovereign (1 Năm VIP)',
      time: '06:55:12',
      gate: 'Turnstile B1 - Tầng Mezzanine',
      status: 'GRANTED',
    },
  ]);

  const handleSimulateScan = (codeToScan: string) => {
    const isExpired = codeToScan.includes('EXPIRED') || codeToScan.includes('104');
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    const result: CheckInRecord = {
      id: `CK-${Math.floor(1000 + Math.random() * 9000)}`,
      memberCode: isExpired ? 'MB-2026-104' : 'MB-2026-089',
      name: isExpired ? 'Lê Hoàng Minh' : 'Nguyễn Văn An',
      packageName: isExpired ? 'The Essential (Hết hạn)' : 'The Sanctuary VIP',
      time: timeStr,
      gate: 'Turnstile A1 - Sảnh Chính',
      status: isExpired ? 'DENIED' : 'GRANTED',
      reason: isExpired ? 'Gói tập đã hết hạn. Yêu cầu chuyển quầy Lễ tân gia hạn.' : undefined,
    };

    setCurrentResult(result);
    setRecentCheckins((prev) => [result, ...prev]);
    setScanCode('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanCode.trim()) return;
    handleSimulateScan(scanCode);
  };

  return (
    <div className="portal-container">
      <PageHeader
        eyebrow="Lễ tân"
        title="Check-in cổng"
      />

      <div className="grid-2">
        {/* Scanner Simulation Panel */}
        <div className="portal-card">
          <div className="portal-card-header">
            <h2 className="portal-card-title">Mắt đọc mã QR cổng turnstile</h2>
          </div>

          <form onSubmit={handleSubmit} style={{ marginBottom: '24px' }}>
            <label className="portal-label">Quét hoặc Nhập Chuỗi Mã QR:</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                className="portal-input"
                placeholder="Nhập mã QR hoặc Mã HV (ví dụ: SOL-MB89-9831)..."
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
              />
              <button type="submit" className="btn-primary">
                Check-in
              </button>
            </div>
          </form>

          {/* Quick Simulation Buttons */}
          <div style={{ padding: '16px', background: 'var(--color-bg-warm)', borderRadius: '3px', marginBottom: '24px' }}>
            <div className="meta-label" style={{ marginBottom: '10px' }}>
              Quét thử
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => handleSimulateScan('SOL-VALID-089')}
              >
                Quét Thẻ Hợp Lệ (Active)
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => handleSimulateScan('SOL-EXPIRED-104')}
                style={{ color: 'var(--portal-danger, #b91c1c)' }}
              >
                Quét Thẻ Hết Hạn (Deny)
              </button>
            </div>
          </div>

          {/* Visual Door Gate Feedback */}
          {currentResult && (
            <div
              key={currentResult.id}
              role="status"
              className={`gate-result gate-result--${currentResult.status === 'GRANTED' ? 'granted' : 'denied'}`}
              style={{
                borderRadius: '3px',
                padding: '24px',
                textAlign: 'center',
                backgroundColor: currentResult.status === 'GRANTED' ? 'var(--portal-success-bg, #F0FDF4)' : 'var(--portal-danger-bg, #FEF2F2)',
                border: `2px solid ${currentResult.status === 'GRANTED' ? 'var(--portal-success-line, #86EFAC)' : 'var(--portal-danger-line, #FCA5A5)'}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                <StatusMark type={currentResult.status === 'GRANTED' ? 'success' : 'error'} size={64} />
              </div>

              <h3
                style={{
                  margin: '0 0 8px 0',
                  color: currentResult.status === 'GRANTED' ? 'var(--portal-success, #15803D)' : 'var(--portal-danger, #B91C1C)',
                }}
              >
                {currentResult.status === 'GRANTED' ? 'CỬA MỞ: XÁC THỰC HỢP LỆ' : 'CỬA KHÓA: TỪ CHỐI CHECK-IN'}
              </h3>

              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--portal-text, #1A1614)', marginBottom: '4px' }}>
                {currentResult.name} ({currentResult.memberCode})
              </div>

              <div style={{ fontSize: '0.82rem', color: 'var(--portal-muted, #6A635D)' }}>{currentResult.packageName}</div>

              {currentResult.reason && (
                <div style={{ marginTop: '10px', color: 'var(--portal-danger, #B91C1C)', fontWeight: 600, fontSize: '0.85rem' }}>
                  ⚠️ {currentResult.reason}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live Stream Table */}
        <div className="portal-card">
          <div className="portal-card-header">
            <h2 className="portal-card-title">Nhật Ký Lượt Ra Vào Hôm Nay</h2>
          </div>

          <div className="portal-table-wrapper">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Hội viên</th>
                  <th>Cổng</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {recentCheckins.map((rec, i) => (
                  <tr key={rec.id} className="row-in" style={{ '--i': i } as React.CSSProperties}>
                    <td style={{ fontWeight: 600 }}>{rec.time}</td>
                    <td>
                      <div>{rec.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--portal-muted, #8C847C)' }}>{rec.memberCode}</div>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{rec.gate}</td>
                    <td>
                      <span
                        className={`badge ${rec.status === 'GRANTED' ? 'badge-success' : 'badge-danger'}`}
                      >
                        {rec.status === 'GRANTED' ? 'Mở Cổng' : 'Từ Chối'}
                      </span>
                    </td>
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
