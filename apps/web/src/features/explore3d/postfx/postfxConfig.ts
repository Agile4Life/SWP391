import type { ExploreTheme } from '../renderers/materials';
import type { QualityTier } from '../state/exploreStore';

/**
 * Cấu hình hậu kỳ điện ảnh: MSAA, ngân sách điểm ảnh, SSAO, bloom, chỉnh màu, khử răng cưa, làm nét và nhiễu hạt.
 * Điều chỉnh từ nghiên cứu kết xuất Saltline (HDR buffer → SSAO nửa độ phân giải → bloom lọc kép → chỉnh màu điện ảnh → FXAA/làm nét/nhiễu hạt).
 * Thuần dữ liệu nên có thể chạy unit test mà không cần WebGL.
 */
export interface PostFxConfig {
  /** Số mẫu MSAA trên HDR scene target (0/2/4). */
  msaa: number;
  /** Số điểm ảnh nội bộ tối đa; các drawing buffer lớn hơn sẽ kết xuất ở độ phân giải thấp hơn gốc rồi phóng to. */
  pixelBudget: number;
  ao: {
    enabled: boolean;
    taps: number;
    /** Bán kính không gian thế giới (m) khi gần camera và khi ở xa (góc nhìn toàn cảnh). */
    radiusNear: number;
    radiusFar: number;
    intensity: number;
    /** Mức độ AO làm tối các điểm ảnh đã có sáng (AO chủ yếu chỉ nên tác động lên ánh sáng môi trường). */
    strength: number;
    fadeStart: number;
    fadeEnd: number;
  };
  bloom: {
    enabled: boolean;
    levels: number;
    /** Hệ số hòa trộn bảo toàn năng lượng: col = mix(col, bloom, strength). */
    strength: number;
    upMix: number;
    /** Cường độ vệt sáng anamorphic (0 = tắt) và ngưỡng HDR. */
    streak: number;
    streakThreshold: number;
  };
  grade: {
    exposure: number;
    /** 0 = thuần ACES, 1 = thuần AgX. */
    agxMix: number;
    /** Tách tông vùng tối xanh lam / vùng sáng ấm, trong khoảng 0..1. */
    splitTone: number;
    curve: number;
    blackLift: number;
    saturation: number;
    vignette: number;
    chromaticAberration: number;
  };
  final: {
    fxaa: boolean;
    sharpen: number;
    grain: number;
  };
}

/** Lấy cấu hình hậu kỳ theo mức chất lượng và theme sáng/tối. */
export function getPostFxConfig(tier: QualityTier, theme: ExploreTheme): PostFxConfig {
  const isDark = theme === 'dark';
  const high = tier === 'high';
  const low = tier === 'low';

  return {
    // MSAA trên HDR target kiểu half-float tốn hiệu năng hơn tất cả các pass khác cộng lại (đo trên M4:
    // 4x = 21 fps, 0 = 43 fps); FXAA + làm nét đảm nhận chất lượng cạnh để giữ vững ngân sách 60 fps.
    msaa: 0,
    pixelBudget: high ? 1_360_000 : tier === 'medium' ? 1_300_000 : 1_100_000,
    ao: {
      enabled: !low,
      taps: high ? 9 : 8,
      radiusNear: 0.55,
      radiusFar: 1.7,
      intensity: isDark ? 1.5 : 1.25,
      strength: isDark ? 0.92 : 0.8,
      fadeStart: 160,
      fadeEnd: 300,
    },
    bloom: {
      enabled: !low,
      levels: 5,
      strength: isDark ? 0.085 : 0.055,
      upMix: 0.62,
      streak: 0,
      streakThreshold: 2.2,
    },
    grade: {
      exposure: isDark ? 1.35 : 0.8,
      agxMix: 0.25,
      splitTone: isDark ? 0.7 : 0.5,
      curve: isDark ? 0.24 : 0.2,
      blackLift: isDark ? 1 : 0.8,
      // Màu sắc tự nhiên, hơi tiết chế: độ bão hòa quá cao sẽ tạo cảm giác "hoạt hình".
      saturation: isDark ? 0.96 : 0.94,
      vignette: isDark ? 0.3 : 0.2,
      chromaticAberration: high ? 0.0011 : 0,
    },
    final: {
      fxaa: true,
      sharpen: low ? 0.18 : 0.3,
      grain: isDark ? 0.018 : 0.01,
    },
  };
}

/**
 * Hệ số tỷ lệ kết xuất nội bộ (≤ 1) giúp giữ tích width × height nằm trong ngân sách điểm ảnh.
 */
export function getInternalScale(width: number, height: number, budget: number): number {
  const pixels = Math.max(1, width * height);
  if (pixels <= budget) return 1;
  return Math.max(0.5, Math.sqrt(budget / pixels));
}
