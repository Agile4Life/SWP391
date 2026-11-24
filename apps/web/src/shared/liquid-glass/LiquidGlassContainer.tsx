import type { CSSProperties, ReactNode } from 'react';
import './liquid-glass.css';

/** Hình dạng khung kính mờ: viên thuốc, tròn hoặc bo góc. */
export type LiquidGlassShape = 'pill' | 'circle' | 'rounded';

/** Props của khung kính mờ: hình dạng, bo góc, độ mờ/độ phủ màu, bật/tắt hiệu ứng, class, style và nội dung con. */
interface LiquidGlassContainerProps {
  shape?: LiquidGlassShape;
  borderRadius?: number;
  tintOpacity?: number;
  blurRadius?: number;
  active?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * Bề mặt kính mờ bằng CSS thuần (`backdrop-filter: blur(22px) saturate(145%)`).
 * Thay thế pipeline chụp DOM WebGL + html2canvas cũ để tránh nghẽn main-thread và chi phí dựng canvas khi cuộn hoặc
 * dùng trên thiết bị di động.
 */
export function LiquidGlassContainer({
  shape = 'pill',
  borderRadius,
  active = true,
  className = '',
  style,
  children,
}: LiquidGlassContainerProps) {
  const shapeClass =
    shape === 'circle' ? 'glass-container-circle' : shape === 'pill' ? 'glass-container-pill' : '';
  const mergedStyle =
    shape === 'rounded' && typeof borderRadius === 'number'
      ? { borderRadius: `${borderRadius}px`, ...style }
      : style;

  return (
    <div
      className={`glass-container ${shapeClass} ${active ? 'is-active' : ''} ${className}`.trim()}
      style={mergedStyle}
      aria-hidden={children ? undefined : true}
    >
      {children}
    </div>
  );
}
