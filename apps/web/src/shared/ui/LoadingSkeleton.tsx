import './loading-skeleton.css';

/** Props của khung chờ: nhãn đọc cho trình đọc màn hình, kiểu (thẻ, hàng, bảng, hồ sơ), số mục và class. */
interface LoadingSkeletonProps {
  label: string;
  variant?: 'cards' | 'rows' | 'table' | 'profile';
  count?: number;
  className?: string;
}

/**
 * Khung chờ (skeleton) báo trạng thái đang tải; phần hình chỉ để trang trí, nhãn chỉ dành cho trình đọc màn
 * hình.
 */
export function LoadingSkeleton({ label, variant = 'rows', count = 4, className = '' }: LoadingSkeletonProps) {
  return <div className={`loading-skeleton loading-skeleton--${variant} ${className}`} role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">{label}</span>
    <div className="loading-skeleton__content" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => <div className="loading-skeleton__item" key={index}>
        {variant === 'table' ? Array.from({ length: 5 }, (_, column) => <span key={column} className="loading-skeleton__line" />) : <>
          <span className={variant === 'cards' ? 'loading-skeleton__media' : 'loading-skeleton__avatar'} />
          <div className="loading-skeleton__body">
            <span className="loading-skeleton__line loading-skeleton__line--title" />
            <span className="loading-skeleton__line" />
            <span className="loading-skeleton__line loading-skeleton__line--short" />
          </div>
        </>}
      </div>)}
    </div>
  </div>;
}
