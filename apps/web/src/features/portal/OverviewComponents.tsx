import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentUser } from '../../shared/api/client';
import { PortalIcon, type PortalIconName } from '../../shared/ui/PortalIcon';

export function OverviewHeader() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Ho_Chi_Minh' }).format(now));
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  return <header className="overview-header"><p className="overview-date"><PortalIcon name="clock" /><time dateTime={now.toISOString()}>{date}</time></p><h1>{greeting}, {getCurrentUser()?.name || 'bạn'}</h1></header>;
}

export function OverviewStat({ icon, status, accent, value, unit, title, detail, to }: {
  icon: PortalIconName; status: string; accent?: boolean; value: string; unit: string; title: string; detail: string; to: string;
}) {
  return (
    <article className="overview-stat">
      <div className="overview-stat-top"><span className="overview-icon"><PortalIcon name={icon} /></span><span className={`overview-status${accent ? ' overview-status--accent' : ''}`}>{status}</span><Link to={to} className="overview-stat-link" aria-label={`Xem ${title.toLowerCase()}`}><PortalIcon name="arrow" /></Link></div>
      <div className="overview-ring"><span className="overview-ring-dot" /><strong>{value}</strong><span>{unit}</span></div>
      <h2>{title}</h2><p>{detail}</p>
    </article>
  );
}

export function OverviewPanel({ icon, title, actions, children, className = '' }: {
  icon: PortalIconName; title: string; actions?: ReactNode; children: ReactNode; className?: string;
}) {
  return <section className={`overview-panel ${className}`} aria-label={title}><header className="overview-panel-header"><h2><span className="overview-icon"><PortalIcon name={icon} /></span><span>{title}</span></h2>{actions && <div className="overview-panel-actions">{actions}</div>}</header>{children}</section>;
}

export function OverviewLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="overview-text-link">{children}<PortalIcon name="chevron" /></Link>;
}

export function OverviewDemoNote() {
  return <p className="overview-data-note"><span aria-hidden="true" />Số liệu và lịch trên trang tổng quan là dữ liệu minh họa.</p>;
}
