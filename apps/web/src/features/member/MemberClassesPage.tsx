import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../shared/ui/PageHeader';
import { ApiError } from '../../shared/api/client';
import { filterSessions, getMyWaitlists, getSessions, type ClassSessionDto, type WaitlistDto } from './memberClassesApi';

const days = [
  ['ALL', 'Tất cả các ngày'], ['1', 'Thứ 2'], ['2', 'Thứ 3'], ['3', 'Thứ 4'],
  ['4', 'Thứ 5'], ['5', 'Thứ 6'], ['6', 'Thứ 7'], ['0', 'Chủ nhật'],
];

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (['SCHEDULING_CLASS_FULL', 'CLASS_CAPACITY_EXCEEDED'].includes(error.code ?? ''))
      return 'Lớp đã đầy. Hãy tải lại lịch để xem sĩ số mới.';
    if (['SCHEDULING_MEMBERSHIP_INVALID', 'MEMBERSHIP_INACTIVE_OR_EXPIRED'].includes(error.code ?? ''))
      return 'Gói tập chưa hoạt động hoặc đã hết hạn. Vui lòng xem các gói tập.';
    return error.message;
  }
  return 'Không thể tải lịch học. Vui lòng thử lại.';
}

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function MemberClassesPage() {
  const [tab, setTab] = useState<'schedule' | 'my'>('schedule');
  const [sessions, setSessions] = useState<ClassSessionDto[]>([]);
  const [waitlists, setWaitlists] = useState<WaitlistDto[]>([]);
  const [discipline, setDiscipline] = useState('ALL');
  const [day, setDay] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [waitlistsLoading, setWaitlistsLoading] = useState(true);
  const [waitlistsError, setWaitlistsError] = useState('');
  const [waitlistsRetry, setWaitlistsRetry] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const nextSessions = await getSessions();
        if (active) setSessions(nextSessions);
      } catch (cause) {
        if (active) setError(errorMessage(cause));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [retry]);

  useEffect(() => {
    let active = true;
    async function loadWaitlists() {
      setWaitlistsLoading(true);
      setWaitlistsError('');
      try {
        const nextWaitlists = await getMyWaitlists();
        if (active) setWaitlists(nextWaitlists);
      } catch (cause) {
        if (active) setWaitlistsError(errorMessage(cause));
      } finally {
        if (active) setWaitlistsLoading(false);
      }
    }
    void loadWaitlists();
    return () => { active = false; };
  }, [waitlistsRetry]);

  const disciplines = [...new Set(['Gym', 'Yoga', 'Pilates', 'Boxing', ...sessions.map((item) => item.disciplineName).filter(Boolean)])];
  const visible = filterSessions(sessions, discipline, day);
  const activeWaitlists = waitlists.filter((item) => item.status === 'waiting' || item.status === 'notified');

  return <div className="portal-container">
    <PageHeader eyebrow="Hội viên" title="Lịch học & đặt chỗ" />
    <p className="row-card__meta">Lịch tuần này (Thứ 2–Chủ nhật)</p>
    <div className="filter-chips" role="group" aria-label="Lọc theo bộ môn">
      {['ALL', ...disciplines].map((value) => <button key={value} type="button"
        className={`filter-chip ${discipline === value ? 'is-active' : ''}`}
        aria-pressed={discipline === value} onClick={() => setDiscipline(value)}>
        {value === 'ALL' ? 'Tất cả bộ môn' : value}
      </button>)}
    </div>
    <div style={{ margin: '16px 0 24px' }}>
      <label htmlFor="member-classes-day" className="meta-label" style={{ marginRight: 12 }}>Thứ trong tuần</label>
      <select id="member-classes-day" value={day} onChange={(event) => setDay(event.target.value)}>
        {days.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </div>
    <div className="portal-tabs" role="tablist" aria-label="Lịch học">
      <button type="button" role="tab" aria-selected={tab === 'schedule'} className={`portal-tab ${tab === 'schedule' ? 'active' : ''}`}
        onClick={() => setTab('schedule')}>Lịch lớp học</button>
      <button type="button" role="tab" aria-selected={tab === 'my'} className={`portal-tab ${tab === 'my' ? 'active' : ''}`}
        onClick={() => setTab('my')}>Lịch học của tôi</button>
    </div>

    {tab === 'schedule' ? loading ? <div className="portal-card portal-empty" role="status">Đang tải lịch học...</div> : error ?
      <div className="portal-card portal-empty" role="alert"><h3>Không tải được lịch học</h3><p>{error}</p>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setRetry((value) => value + 1)}>Thử lại</button>
      </div> : <div className="stack">
        {sessions.length === 0 ? <div className="portal-card portal-empty"><h3>Chưa có lịch học</h3><p>Vui lòng quay lại sau.</p></div> :
          visible.length === 0 ? <div className="portal-card portal-empty"><h3>Không có buổi học phù hợp</h3><p>Hãy thử bộ lọc khác.</p></div> :
          visible.map((item) => {
            const [year, month, date] = item.sessionDate.split('-');
            const now = new Date();
            const past = item.sessionDate < localToday() ||
              (item.sessionDate === localToday() && item.startTime.slice(0, 5) <= now.toTimeString().slice(0, 5));
            const unavailable = past || item.status !== 'scheduled';
            return <div key={item.id} className="portal-card portal-card--list">
              <div><div className="row-card__meta"><span className="badge badge-info">{item.disciplineName}</span> · {date}/{month}/{year}</div>
                <h3 className="row-card__title">{item.className}</h3>
                <div className="row-card__meta">{item.startTime.slice(0, 5)}–{item.endTime.slice(0, 5)} · {item.roomName} · HLV {item.coachName}</div>
                <div className="row-card__meta">Trạng thái: {item.status === 'scheduled' ? 'Đã lên lịch' : item.status === 'cancelled' ? 'Đã hủy' : item.status}</div>
              </div>
              <div style={{ textAlign: 'right' }}><div className="meta-label">SỨC CHỨA · SỐ ĐÃ ĐĂNG KÝ*</div>
                <strong>{item.bookedCount} / {item.capacity}</strong><div style={{ marginTop: 10 }}>
                  <button type="button" className="btn-secondary btn-sm" disabled title="Đang chờ backend lưu đăng ký theo buổi học">
                    {unavailable ? 'Không thể đặt' : item.bookedCount < item.capacity ? 'Đặt chỗ ngay' : 'Tham gia hàng chờ'}
                  </button>
                </div></div>
            </div>;
          })}
        <p className="row-card__meta">* Backend hiện tính số đã đăng ký theo lớp, chưa xác nhận riêng từng buổi. Đặt chỗ và hàng chờ đang chờ đồng bộ backend theo buổi học.</p>
        <p className="row-card__meta">Chưa thể kiểm tra gói tập trước thao tác. <Link to="/#packages">Xem gói tập</Link></p>
      </div> : <div className="stack">
        <div className="portal-card portal-empty"><h3>Lịch đã đặt chưa khả dụng</h3>
          <p>Backend chưa cung cấp danh sách đăng ký và buổi học tương ứng. Chưa thể hiển thị hoặc hủy đặt chỗ chính xác.</p></div>
        {waitlistsLoading ? <div className="portal-card portal-empty" role="status">Đang tải hàng chờ...</div> :
          waitlistsError ? <div className="portal-card portal-empty" role="alert">
            <h3>Không tải được hàng chờ</h3><p>{waitlistsError}</p>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setWaitlistsRetry((value) => value + 1)}>Thử lại hàng chờ</button>
          </div> : null}
        {!waitlistsLoading && !waitlistsError && activeWaitlists.length > 0 && <h3 className="row-card__title">Hàng chờ của tôi</h3>}
        {!waitlistsLoading && !waitlistsError && activeWaitlists.map((item) => <div key={item.id} className="portal-card portal-card--list">
          <div><h3 className="row-card__title">{item.className}</h3>
            <div className="row-card__meta">{item.status === 'waiting' ? 'Đang chờ' : 'Đã được thông báo'} · Đăng ký chờ: {item.requestedAt.replace('T', ' ').slice(0, 16)}</div>
            <div className="row-card__meta">Backend chưa xác định buổi học và vị trí hàng chờ.</div>
          </div>
        </div>)}
      </div>}
  </div>;
}
