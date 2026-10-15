import { OverviewDemoNote, OverviewHeader, OverviewLink, OverviewPanel, OverviewStat } from '../portal/OverviewComponents';
import { PortalIcon } from '../../shared/ui/PortalIcon';

const operations = [
  { title: 'Lớp học & Xếp lịch', description: 'Lớp tập, phòng và huấn luyện viên', to: '/staff/classes', icon: 'calendar' as const },
  { title: 'Hội viên & Phân quyền', description: 'Tài khoản và quyền truy cập', to: '/manager/users', icon: 'users' as const },
  { title: 'Quầy lễ tân', description: 'Tra cứu hội viên và thanh toán', to: '/staff/reception', icon: 'wallet' as const },
];
const revenue = [
  { name: 'Sanctuary VIP', detail: 'Gói 3 tháng', value: '1.125.000.000 đ', share: 61 },
  { name: 'Sovereign Annual', detail: 'Gói 1 năm', value: '468.000.000 đ', share: 25 },
  { name: 'The Essential', detail: 'Gói 1 tháng', value: '252.000.000 đ', share: 14 },
];

export function ManagerDashboardPage() {
  return (
    <div className="portal-container portal-overview">
      <OverviewHeader />
      <section className="overview-stats" aria-label="Tổng quan vận hành">
        <OverviewStat icon="wallet" status="Tháng 09" accent value="1,845" unit="tỷ đồng" title="Doanh thu trung tâm" detail="Tăng 14,2% so với tháng trước" to="/manager/reports" />
        <OverviewStat icon="users" status="Tháng 09" value="128" unit="hội viên mới" title="Cộng đồng hội viên" detail="Thêm 22 người so với tháng trước" to="/manager/users" />
        <OverviewStat icon="layers" status="Công suất" value="86,4" unit="% lấp đầy" title="Không gian tập luyện" detail="Theo dõi lớp học và phòng tập" to="/staff/classes" />
        <OverviewStat icon="scan" status="Tháng 09" accent value="4.920" unit="lượt check-in" title="Lượt đến trung tâm" detail="Trung bình 180 lượt mỗi ngày" to="/staff/check-in" />
      </section>
      <div className="overview-columns">
        <div className="overview-column">
          <OverviewPanel icon="calendar" title="Điều hành trung tâm" actions={<OverviewLink to="/staff/classes">Xem lịch</OverviewLink>}>
            <div className="overview-operations">{operations.map((operation) => <div className="overview-operation" key={operation.to}><span className="overview-icon"><PortalIcon name={operation.icon} /></span><div><h3>{operation.title}</h3><p>{operation.description}</p></div><OverviewLink to={operation.to}>Mở</OverviewLink></div>)}</div>
          </OverviewPanel>
          <OverviewPanel icon="chart" title="Cơ cấu doanh thu" actions={<OverviewLink to="/manager/reports">Báo cáo</OverviewLink>}>
            <div className="overview-revenue">{revenue.map((item) => <div key={item.name}><div className="overview-revenue-label"><span>{item.name}<small>{item.detail}</small></span><strong>{item.share}%</strong></div><meter min="0" max="100" value={item.share} aria-label={`Tỷ trọng doanh thu ${item.name}`}>{item.share}%</meter><p>{item.value}</p></div>)}</div>
          </OverviewPanel>
        </div>
        <div className="overview-column">
          <OverviewPanel icon="users" title="Không gian quản trị" actions={<OverviewLink to="/manager/users">Quản lý</OverviewLink>}>
            <div className="overview-circle"><div className="overview-avatars" aria-hidden="true"><span>QL</span><span>LT</span><span>HL</span></div><h3>Cùng vận hành một SÖL tốt hơn</h3><p>Kết nối quản lý, lễ tân và huấn luyện viên trong một không gian.</p></div>
          </OverviewPanel>
          <OverviewPanel icon="layers" title="Danh mục vận hành" actions={<OverviewLink to="/manager/catalogs">Quản lý</OverviewLink>}>
            <div className="overview-quick-links"><OverviewLink to="/manager/catalogs">Bộ môn & chương trình tập</OverviewLink><OverviewLink to="/manager/catalogs">Phòng tập & sức chứa</OverviewLink><OverviewLink to="/manager/catalogs">Gói tập & bảng giá</OverviewLink></div>
          </OverviewPanel>
          <OverviewPanel icon="file" title="Tài chính & Kiểm soát" actions={<OverviewLink to="/manager/reports">Chi tiết</OverviewLink>}>
            <p className="overview-wellness-copy">Xem cơ cấu doanh thu theo gói dịch vụ và nhật ký hoạt động của trung tâm.</p><OverviewLink to="/manager/reports">Mở báo cáo & nhật ký</OverviewLink>
          </OverviewPanel>
        </div>
      </div>
      <OverviewDemoNote />
    </div>
  );
}
