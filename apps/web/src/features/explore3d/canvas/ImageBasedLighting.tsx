/* eslint-disable react-refresh/only-export-components */
import { Environment as DreiEnvironment, Lightformer } from '@react-three/drei';
import { useDocumentTheme, type ExploreTheme } from '../renderers/materials';
import { getAtmosphere } from './atmosphere';
import { SkyProbe } from './SkyProbe';
import { useExploreStore, type QualityTier } from '../state/exploreStore';

/**
 * Cấu hình ánh sáng dựa trên ảnh (IBL): bật hay tắt, độ phân giải, cường độ và các tấm đèn của probe phản
 * chiếu.
 */
export interface ImageBasedLightingConfig {
  enabled: boolean;
  resolution: number;
  /** Hệ số nhân toàn cảnh cho reflection probe đã bake (scene.environmentIntensity). */
  intensity: number;
  panels: {
    id: string;
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
    color: string;
    intensity: number;
    form?: 'rect' | 'circle';
  }[];
}

/**
 * Tính cấu hình reflection probe thủ tục kiểu studio theo theme và mức chất lượng (bỏ qua ở mức chất lượng thấp).
 * Các vật liệu trong cảnh đã khai báo `envMapIntensity` và metalness, nhưng nếu không có environment map thì kim loại
 * và bề mặt bóng sẽ không có gì để phản chiếu và trông như nhựa phẳng. Probe được dựng từ vài tấm đèn (không cần tải
 * file HDR) và chỉ bake một lần.
 */
export function getImageBasedLightingConfig(
  theme: ExploreTheme,
  tier: QualityTier,
): ImageBasedLightingConfig {
  const isDark = theme === 'dark';
  return {
    enabled: tier !== 'low',
    resolution: tier === 'high' ? 256 : 128,
    // Vòm trời (SkyProbe) hiện cung cấp phần lớn ánh sáng môi trường theo phong cách Saltline:
    // ánh sáng bầu trời dựa trên ảnh thay vì nguồn ambient phẳng.
    intensity: getAtmosphere(theme).skyLight,
    panels: [
      {
        id: 'key-softbox',
        position: [10, 14, 8],
        rotation: [-Math.PI / 3, Math.PI / 5, 0],
        scale: [16, 10, 1],
        color: '#fff4ea',
        intensity: isDark ? 0.5 : 0.8,
      },
      {
        id: 'cool-fill',
        position: [-14, 8, -6],
        rotation: [0, Math.PI / 2.4, 0],
        scale: [12, 8, 1],
        color: '#dfe9f5',
        intensity: isDark ? 0.35 : 0.6,
      },
      {
        id: 'salmon-accent',
        position: [0, 4, -16],
        rotation: [0, 0, 0],
        scale: [22, 3, 1],
        color: '#e1aa98',
        intensity: 0.5,
      },
      {
        id: 'ceiling-strip',
        position: [0, 18, 0],
        rotation: [Math.PI / 2, 0, 0],
        scale: [26, 4, 1],
        color: '#ffffff',
        intensity: isDark ? 0.45 : 0.75,
      },
      {
        id: 'window-horizon-strip',
        position: [-18, 7, 18],
        rotation: [0, -Math.PI / 4, 0],
        scale: [24, 3.5, 1],
        color: isDark ? '#ffd4b2' : '#fff8ee',
        intensity: isDark ? 0.42 : 0.68,
      },
    ],
  };
}

/**
 * Probe phản chiếu thủ tục kiểu studio để kim loại và bề mặt bóng có thứ để phản chiếu; dựng từ vài tấm đèn,
 * không cần tải HDR.
 */
export function ImageBasedLighting() {
  const theme = useDocumentTheme();
  const tier = useExploreStore(s => s.tier);
  const cfg = getImageBasedLightingConfig(theme, tier);

  if (!cfg.enabled) return null;

  return (
    <DreiEnvironment
      key={`${theme}-${cfg.resolution}`}
      frames={1}
      resolution={cfg.resolution}
      environmentIntensity={cfg.intensity}
    >
      <SkyProbe theme={theme} />
      {cfg.panels.map(panel => (
        <Lightformer
          key={panel.id}
          form={panel.form ?? 'rect'}
          position={panel.position}
          rotation={panel.rotation}
          scale={panel.scale}
          color={panel.color}
          intensity={panel.intensity}
        />
      ))}
    </DreiEnvironment>
  );
}

export default ImageBasedLighting;
