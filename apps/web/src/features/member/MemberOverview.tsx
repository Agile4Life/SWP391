import { useState } from 'react';
import { Link } from 'react-router-dom';
import { OverviewDemoNote, OverviewHeader, OverviewLink, OverviewPanel, OverviewStat } from '../portal/OverviewComponents';
import { PortalIcon } from '../../shared/ui/PortalIcon';

const sessions = [
  { name: 'Zenith Reformer Pilates', time: '17:30', end: '18:30', coach: 'Elena Vũ', room: 'Studio 01', day: 'today' },
  { name: 'Olympus Strength Conditioning', time: '08:00', end: '09:30', coach: 'Minh Trí', room: 'Arena 02', day: 'tomorrow' },
];

export function MemberOverview() {
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const selected = sessions.filter((session) => session.day === day);
  return (
    <div className="portal-container portal-overview">
      <OverviewHeader />
      <section className="overview-stats" aria-label="Tổng quan hội viên">
        <OverviewStat icon="card" status="Đang hoạt động" value="72" unit="ngày còn lại" title="Gói tập của bạn" detail="Hết hạn ngày 26/12/2026" to="/member/card" />
        <OverviewStat icon="activity" status="Tháng này" accent value="18" unit="buổi tập" title="Nhịp tập luyện" detail="Thêm 4 buổi so với tháng trước" to="/member/classes" />
        <OverviewStat icon="spark" status="Đã ghi nhận" value="21,8" unit="BMI" title="Sức khỏe của bạn" detail="Cập nhật hồ sơ thể chất" to="/member/profile" />
        <OverviewStat icon="calendar" status="Sắp diễn ra" accent value="2" unit="buổi đã đặt" title="Lịch tập sắp tới" detail="Một khoảng thời gian cho bạn" to="/member/classes" />
      </section>
      <div className="overview-columns">
        <div className="overview-column">
          <OverviewPanel icon="calendar" title="Lịch tập của bạn" actions={<div className="overview-day-tabs" role="group" aria-label="Chọn ngày tập"><button type="button" aria-pressed={day === 'today'} onClick={() => setDay('today')}>Hôm nay</button><button type="button" aria-pressed={day === 'tomorrow'} onClick={() => setDay('tomorrow')}>Ngày mai</button></div>}>
            <div className="overview-session-list" aria-live="polite">
              {selected.length ? selected.map((session) => <div key={session.name} className="overview-session"><div className="overview-session-time"><strong>{session.time}</strong><span>{session.end}</span></div><div className="overview-session-info"><h3>{session.name}</h3><p>{session.room} <span>·</span> HLV {session.coach}</p></div><span className="overview-status">Đã đặt</span></div>) : <p className="overview-empty">Bạn chưa có lịch tập trong ngày này.</p>}
            </div>
            <Link to="/member/classes" className="overview-add-button"><PortalIcon name="plus" />Đặt lớp mới</Link>
          </OverviewPanel>
          <OverviewPanel icon="card" title="Thẻ hội viên" actions={<OverviewLink to="/member/card">Xem thẻ</OverviewLink>}>
            <div className="overview-membership"><span className="overview-membership-mark">SÖL</span><div><h3>Không gian dành riêng cho bạn</h3><p>Thẻ hội viên, mã QR và hóa đơn của bạn.</p></div><PortalIcon name="scan" /></div>
            <div className="overview-key-values"><div><span>Gói tập</span><strong>Sanctuary VIP</strong></div><div><span>Thời hạn</span><strong>26/12/2026</strong></div></div>
          </OverviewPanel>
          <OverviewPanel icon="book" title="Lối tắt dành cho bạn">
            <div className="overview-quick-links"><OverviewLink to="/member/classes">Khám phá lớp học</OverviewLink><OverviewLink to="/member/card">Thẻ hội viên & hóa đơn</OverviewLink><OverviewLink to="/member/profile">Cập nhật hồ sơ cá nhân</OverviewLink></div>
          </OverviewPanel>
        </div>
        <div className="overview-column">
          <OverviewPanel icon="users" title="Đồng hành cùng bạn" actions={<OverviewLink to="/member/classes">Xem lịch</OverviewLink>}>
            <div className="overview-circle"><div className="overview-avatars" aria-hidden="true"><span>EV</span><span>MT</span><span>AN</span></div><h3>Mỗi buổi tập, một kết nối</h3><p>Gặp huấn luyện viên trong các lớp Pilates, Strength và Yoga tại SÖL.</p></div>
          </OverviewPanel>
          <OverviewPanel icon="activity" title="Hồ sơ sức khỏe" actions={<OverviewLink to="/member/profile">Cập nhật</OverviewLink>}>
            <div className="overview-health"><div><span>Cân nặng</span><strong>68,5 <small>kg</small></strong></div><div><span>Chỉ số BMI</span><strong>21,8</strong></div><div><span>Tỷ lệ mỡ</span><strong>14,2 <small>%</small></strong></div></div>
            <p className="overview-panel-caption">Theo dõi chỉ số và mục tiêu trong hồ sơ sức khỏe của bạn.</p>
          </OverviewPanel>
          <OverviewPanel icon="spark" title="Dành thời gian cho bản thân">
            <p className="overview-wellness-copy">Một buổi tập nhẹ, một nhịp thở sâu. Chọn lớp học phù hợp với nhịp sống của bạn hôm nay.</p><OverviewLink to="/member/classes">Tìm lớp tập phù hợp</OverviewLink>
          </OverviewPanel>
        </div>
      </div>
      <OverviewDemoNote />
    </div>
  );
}
