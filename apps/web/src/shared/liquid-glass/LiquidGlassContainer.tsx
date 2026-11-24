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
 * Khung kính mờ bằng CSS thuần (backdrop-filter), thay cho pipeline WebGL cũ để không giật khi cuộn trên điện
 * thoại.
 *
 * Pure CSS frosted surface (`backdrop-filter: blur(22px) saturate(145%)`).
 * Replaces the former WebGL + html2canvas DOM snapshot pipeline to avoid
 * main-thread pauses and canvas composition overhead on mobile/scroll.
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
