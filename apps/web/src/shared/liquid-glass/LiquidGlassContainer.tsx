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
 * Bề mặt kính mờ bằng CSS thuần (`backdrop-filter: blur(var(--glass-blur)) saturate(145%)`).
 * Chỉ bật `backdrop-filter` khi `active` là `true` để tránh chồng lớp GPU khi ẩn/đóng.
 */
export function LiquidGlassContainer({
  shape = 'pill',
  borderRadius,
  tintOpacity,
  blurRadius,
  active = true,
  className = '',
  style,
  children,
}: LiquidGlassContainerProps) {
  const shapeClass = shape === 'pill' ? 'glass-container-pill' : '';
  const glassStyle: Record<string, string | number> = {};

  if (typeof blurRadius === 'number' && Number.isFinite(blurRadius) && blurRadius >= 0) {
    glassStyle['--glass-blur'] = `${blurRadius}px`;
  }
  if (typeof tintOpacity === 'number' && Number.isFinite(tintOpacity)) {
    glassStyle['--glass-tint-opacity'] = String(Math.min(1, Math.max(0, tintOpacity)));
  }
  if (shape === 'circle') {
    glassStyle.borderRadius = '50%';
    glassStyle.aspectRatio = '1 / 1';
    glassStyle.padding = 0;
  } else if (shape === 'rounded' && typeof borderRadius === 'number') {
    glassStyle.borderRadius = `${borderRadius}px`;
  }

  const mergedStyle: CSSProperties | undefined =
    Object.keys(glassStyle).length > 0 || style
      ? ({ ...glassStyle, ...style } as CSSProperties)
      : undefined;

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
