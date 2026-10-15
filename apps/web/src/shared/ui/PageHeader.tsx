import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  /** Từ in nghiêng kiểu editorial đặt sau tiêu đề, giống "Sanctuary" ở landing. */
  flourish?: string;
  subtitle?: string;
  actions?: ReactNode;
}

/** Đầu trang dùng chung; kiểu chữ và màu được định nghĩa trong theme của portal. */
export function PageHeader({ eyebrow, title, flourish, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="portal-header">
      <div>
        {eyebrow && <p className="portal-eyebrow">{eyebrow}</p>}
        <h1 className="portal-title">
          {title}
          {flourish && <> {flourish}</>}
        </h1>
        {subtitle && <p className="portal-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="portal-header__actions">{actions}</div>}
    </div>
  );
}
