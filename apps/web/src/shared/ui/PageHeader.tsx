import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  /** Từ in nghiêng kiểu editorial đặt sau tiêu đề, giống "Sanctuary" ở landing. */
  flourish?: string;
  actions?: ReactNode;
}

/** Đầu trang chuẩn của portal: chỉ hiển thị tiêu đề trang và cụm nút thao tác (đã bỏ dòng eyebrow phía trên). */
export function PageHeader({ title, flourish, actions }: PageHeaderProps) {
  return (
    <div className="portal-header">
      <div>
        <h1 className="portal-title">
          {title}
          {flourish && <> {flourish}</>}
        </h1>
      </div>
      {actions && <div className="portal-header__actions">{actions}</div>}
    </div>
  );
}
