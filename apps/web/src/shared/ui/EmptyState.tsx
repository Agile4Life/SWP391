import type { ReactNode } from 'react';
import { PortalIcon, type PortalIconName } from '../../features/portal/PortalIcon';

interface EmptyStateProps {
  icon?: PortalIconName;
  title: string;
  description?: string;
  /** Nút/liên kết hành động (tối đa hai). */
  actions?: ReactNode;
  /** `card`: tự có nền thẻ (dùng ngoài thẻ); `plain`: nằm trong thẻ sẵn có. */
  variant?: 'card' | 'plain';
  role?: 'status' | 'alert';
}

/** Trạng thái rỗng/chặn dùng chung: biểu tượng, một tiêu đề, một câu giải thích và một hành động. */
export function EmptyState({ icon = 'package', title, description, actions, variant = 'card', role }: EmptyStateProps) {
  return (
    <div className={`empty-state ${variant === 'card' ? 'portal-card' : ''}`} role={role}>
      <span className="empty-state__icon" aria-hidden="true"><PortalIcon name={icon} size={26} /></span>
      <h2 className="empty-state__title">{title}</h2>
      {description && <p className="empty-state__text">{description}</p>}
      {actions && <div className="empty-state__actions">{actions}</div>}
    </div>
  );
}
