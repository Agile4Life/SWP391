/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import {
  getExploreThemePalette,
  useDocumentTheme,
  type ExploreTheme,
} from '../renderers/materials';
import type { LevelCode } from '../scene/schema';
import { getAtmosphere } from './atmosphere';
import { useExploreStore, type QualityTier } from '../state/exploreStore';

const LEVEL_ELEVATION_BY_CODE: Record<LevelCode, number> = {
  B1: -4.5,
  L1: 0.0,
  L2: 5.76,
  RF: 11.26,
  OUT: 0.0,
};

const SUN_DISTANCE = 115;

/** Cấu hình ngân sách ánh sáng: ánh sáng môi trường, bán cầu, ánh nắng định hướng và độ phân giải bản đồ bóng. */
export interface LightingBudgetConfig {
  ambient: {
    color: string;
    intensity: number;
  };
  hemisphere: {
    skyColor: string;
    groundColor: string;
    intensity: number;
  };
  keyLight: {
    position: [number, number, number];
    color: string;
    intensity: number;
    castShadow: boolean;
    shadowMapSize: [number, number];
    shadowBounds: {
      left: number;
      right: number;
      top: number;
      bottom: number;
      near: number;
      far: number;
    };
    shadowBias: number;
    shadowNormalBias: number;
    /** Bán kính bộ lọc đĩa Vogel theo đơn vị shadow texel (độ rộng vùng bán ảnh). */
    shadowRadius: number;
  };
  fillLight: {
    position: [number, number, number];
    color: string;
    intensity: number;
    castShadow: false;
  };
  rimLight: {
    position: [number, number, number];
    color: string;
    intensity: number;
    castShadow: false;
  };
}

/** Tính cấu hình ánh sáng theo theme và mức chất lượng (nắng HDR mạnh kết hợp ánh sáng bầu trời). */
export function getLightingBudgetConfig(
  theme: ExploreTheme,
  tier: QualityTier,
): LightingBudgetConfig {
  const palette = getExploreThemePalette(theme);
  // Kiểu Saltline: shadow map độ phân giải cao (4096) ở mức high, 2048 ở mức medium.
  const mapResolution = tier === 'high' ? 3072 : 2048;
  const isDark = theme === 'dark';
  // Mô hình chiếu sáng kiểu Saltline: một nguồn nắng HDR mạnh + ánh sáng bầu trời dựa trên ảnh,
  // kèm một lượng nhỏ ánh sáng ambient phẳng. Mức low không có sky probe nên giữ
  // nguồn hemisphere/ambient bổ trợ mạnh hơn.
  const hasSkyProbe = tier !== 'low';
  const atmosphere = getAtmosphere(theme);
  return {
    ambient: {
      color: isDark ? '#fff5ec' : '#ffffff',
      intensity: hasSkyProbe ? (isDark ? 0.06 : 0.05) : isDark ? 0.5 : 0.62,
    },
    hemisphere: {
      skyColor: hasSkyProbe ? (isDark ? '#6f8fc4' : '#bcd0e8') : palette.skyColor,
      groundColor: hasSkyProbe ? (isDark ? '#241c18' : '#6b5a4c') : palette.groundColor,
      intensity: hasSkyProbe ? (isDark ? 0.3 : 0.28) : isDark ? 0.98 : 1.05,
    },
    // Mặt trời theo thời điểm trong ngày (xem atmosphere.ts): giờ vàng ở theme sáng, mặt trời chạng vạng
    // rất thấp ở theme tối. Ánh nắng chiếu xiên từ bên trái camera mặc định để bóng đổ dài vào khung hình.
    // Cường độ ở dải HDR; bước chỉnh màu hậu kỳ sẽ nén mượt phần sáng chói.
    keyLight: {
      position: atmosphere.sunPosition,
      color: atmosphere.sunColor,
      intensity: atmosphere.sunIntensity,
      castShadow: tier !== 'low',
      shadowMapSize: [mapResolution, mapResolution],
      shadowBounds: {
        left: -58,
        right: 58,
        top: 44,
        bottom: -44,
        near: 1,
        far: 230,
      },
      shadowBias: -0.00012,
      shadowNormalBias: 0.02,
      shadowRadius: tier === 'high' ? 3.2 : 2.4,
    },
    fillLight: {
      position: [34, 18, -10],
      color: isDark ? '#7f9fd6' : '#cfe0f6',
      // Ánh sáng bổ trợ hắt bầu trời tông lạnh từ phía đối diện mặt trời (tương phản xanh lam & cam).
      intensity: hasSkyProbe ? (isDark ? 0.3 : 0.34) : isDark ? 0.8 : 0.7,
      castShadow: false,
    },
    rimLight: {
      position: [-30, 22, -34],
      color: isDark ? '#ff9a6a' : '#f5c2ae',
      intensity: isDark ? 0.4 : 0.36,
      castShadow: false,
    },
  };
}

/**
 * Ánh sáng của cảnh: nắng định hướng có bóng, ánh sáng môi trường và bán cầu theo theme, mức chất lượng, tầng
 * đang xem và chế độ đi bộ.
 */
export function Lights() {
  const theme = useDocumentTheme();
  const tier = useExploreStore(s => s.tier);
  const focusLevel = useExploreStore(s => s.focusLevel);
  const walkMode = useExploreStore(s => s.walkMode);
  const invalidate = useThree(s => s.invalidate);
  const gl = useThree(s => s.gl);
  const lightRef = useRef<THREE.DirectionalLight>(null);

  const cfg = getLightingBudgetConfig(theme, tier);
  const activeLevelCode: LevelCode = focusLevel === 'ALL' ? 'L1' : focusLevel;
  const ceilingY = LEVEL_ELEVATION_BY_CODE[activeLevelCode] + 3.45;
  // Đèn nội thất tông ấm suy giảm theo quy luật vật lý; lúc chạng vạng đây là nguồn sáng chính trong nhà.
  const interiorBoost = (walkMode ? 1.35 : 1.0) * (theme === 'dark' ? 26 : 12);

  // Camera tạo bóng đặt tại nguồn sáng: đẩy đủ xa dọc theo hướng mặt trời
  // để toàn bộ khuôn viên nằm phía trước nó, kể cả khi mặt trời rất thấp.
  const [sx, sy, sz] = cfg.keyLight.position;
  const sunScale = SUN_DISTANCE / Math.hypot(sx, sy, sz);
  const sunPosition: [number, number, number] = [sx * sunScale, sy * sunScale, sz * sunScale];

  const lightDir = useRef(new THREE.Vector3());
  const lightRight = useRef(new THREE.Vector3());
  const lightUp = useRef(new THREE.Vector3());
  const targetPos = useRef(new THREE.Vector3());
  const snappedPos = useRef(new THREE.Vector3());
  const yUp = useRef(new THREE.Vector3(0, 1, 0));

  useEffect(() => {
    invalidate();
  }, [theme, tier, focusLevel, walkMode, invalidate]);

  // Mặt trời cố định nên shadow map chỉ cần theo các vật đổ bóng di động (người, xe):
  // làm mới mỗi 3 khung hình (20 Hz ở 60 fps) giữ bóng sắc nét mà giảm chi phí shadow-pass.
  const shadowFrame = useRef(0);
  useFrame(({ camera, gl }) => {
    gl.shadowMap.autoUpdate = false;
    shadowFrame.current += 1;
    gl.shadowMap.needsUpdate = shadowFrame.current % 3 === 1;

    const light = lightRef.current;
    if (!light) return;

    if (walkMode) {
      const halfExtent = 22.0;
      const mapWidth = light.shadow.mapSize.x || 2048;
      const texelSize = (2 * halfExtent) / mapWidth;

      lightDir.current.set(sx, sy, sz).normalize();
      lightRight.current.crossVectors(yUp.current, lightDir.current).normalize();
      lightUp.current.crossVectors(lightDir.current, lightRight.current).normalize();

      targetPos.current.set(camera.position.x, 0, camera.position.z);
      const u = targetPos.current.dot(lightRight.current);
      const v = targetPos.current.dot(lightUp.current);
      const uSnapped = Math.round(u / texelSize) * texelSize;
      const vSnapped = Math.round(v / texelSize) * texelSize;

      snappedPos.current
        .copy(lightRight.current)
        .multiplyScalar(uSnapped)
        .addScaledVector(lightUp.current, vSnapped)
        .addScaledVector(lightDir.current, targetPos.current.dot(lightDir.current));

      light.target.position.copy(snappedPos.current);
      light.target.updateMatrixWorld();
      light.position.copy(snappedPos.current).addScaledVector(lightDir.current, SUN_DISTANCE);

      const cam = light.shadow.camera;
      if (cam.left !== -halfExtent || cam.right !== halfExtent) {
        cam.left = -halfExtent;
        cam.right = halfExtent;
        cam.top = halfExtent;
        cam.bottom = -halfExtent;
        cam.near = 1;
        cam.far = SUN_DISTANCE + 45;
        cam.updateProjectionMatrix();
      }
    } else {
      const cam = light.shadow.camera;
      if (cam.left !== cfg.keyLight.shadowBounds.left) {
        light.target.position.set(0, 0, 0);
        light.target.updateMatrixWorld();
        light.position.set(sunPosition[0], sunPosition[1], sunPosition[2]);
        cam.left = cfg.keyLight.shadowBounds.left;
        cam.right = cfg.keyLight.shadowBounds.right;
        cam.top = cfg.keyLight.shadowBounds.top;
        cam.bottom = cfg.keyLight.shadowBounds.bottom;
        cam.near = cfg.keyLight.shadowBounds.near;
        cam.far = cfg.keyLight.shadowBounds.far;
        cam.updateProjectionMatrix();
      }
    }
  });
  useEffect(
    () => () => {
      gl.shadowMap.autoUpdate = true;
    },
    [gl],
  );

  return (
    <group name="sol-lights">
      <ambientLight color={cfg.ambient.color} intensity={cfg.ambient.intensity} />
      <hemisphereLight
        args={[
          cfg.hemisphere.skyColor,
          cfg.hemisphere.groundColor,
          cfg.hemisphere.intensity,
        ]}
      />
      <directionalLight
        ref={lightRef}
        position={sunPosition}
        color={cfg.keyLight.color}
        intensity={cfg.keyLight.intensity}
        castShadow={cfg.keyLight.castShadow}
        shadow-mapSize={cfg.keyLight.shadowMapSize}
        shadow-camera-left={cfg.keyLight.shadowBounds.left}
        shadow-camera-right={cfg.keyLight.shadowBounds.right}
        shadow-camera-top={cfg.keyLight.shadowBounds.top}
        shadow-camera-bottom={cfg.keyLight.shadowBounds.bottom}
        shadow-camera-near={cfg.keyLight.shadowBounds.near}
        shadow-camera-far={cfg.keyLight.shadowBounds.far}
        shadow-bias={cfg.keyLight.shadowBias}
        shadow-normalBias={cfg.keyLight.shadowNormalBias}
        shadow-radius={cfg.keyLight.shadowRadius}
      />
      <directionalLight
        position={cfg.fillLight.position}
        color={cfg.fillLight.color}
        intensity={cfg.fillLight.intensity}
        castShadow={false}
      />
      <directionalLight
        position={cfg.rimLight.position}
        color={cfg.rimLight.color}
        intensity={cfg.rimLight.intensity}
        castShadow={false}
      />
      {/* Đèn trần nội thất kiến trúc tông ấm ở tầng đang hoạt động */}
      {/* Mỗi point light được tính cho mọi pixel có ánh sáng trong cảnh (~3 fps mỗi đèn trên chip M4) và
          hầu như không thấy rõ ở góc nhìn toàn khuôn viên, nên chỉ bật khi đang tập trung vào một tầng;
          đặt tại tâm khối thay cho bộ ba đèn cũ để giữ nguyên độ ấm tương đương. */}
      {(walkMode || focusLevel !== 'ALL') && (
        <pointLight
          position={[2.5, ceilingY, 0]}
          color="#ffe7d4"
          intensity={3.6 * interiorBoost}
          distance={42}
          decay={2}
          castShadow={false}
        />
      )}
    </group>
  );
}

export default Lights;
