/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneDoc } from '../scene/schema';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { getLevelByCode, getLevelWorldY } from '../scene/selectors';
import { useExploreStore } from '../state/exploreStore';

/** Props của hồ bơi: cảnh. */
export interface PoolProps {
  scene?: SceneDoc;
}

/** Kích thước và vị trí tâm của hồ bơi Oasis (rộng 25 m, sâu 12 m). */
const OASIS_POOL_DIMENSIONS = {
  centerX: -6.0,
  centerZ: -5.5,
  width: 25.0,
  depth: 12.0,
} as const;

/** Raycast rỗng để mặt nước không bắt sự kiện chuột. */
const NOOP_RAYCAST = () => null;

/** Tạo texture đáy hồ bằng canvas (không có document thì dùng texture một điểm ảnh). */
export function createPoolBasinTexture(): THREE.Texture {
  if (typeof document === 'undefined') {
    const data = new Uint8Array([24, 68, 96, 255]);
    const tex = new THREE.DataTexture(data, 1, 1);
    tex.needsUpdate = true;
    return tex;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Nền gạch mosaic xanh nước đậm
    ctx.fillStyle = '#153b56';
    ctx.fillRect(0, 0, 2048, 1024);

    // Đường lưới gạch mosaic gốm mảnh (bước 32px)
    ctx.strokeStyle = 'rgba(135, 205, 240, 0.12)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 2048; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1024);
      ctx.stroke();
    }
    for (let y = 0; y <= 1024; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(2048, y);
      ctx.stroke();
    }

    // Đường ron gạch kiến trúc chính (bước 64px) cho độ sắc nét cao
    ctx.strokeStyle = 'rgba(165, 222, 248, 0.24)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= 2048; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1024);
      ctx.stroke();
    }
    for (let y = 0; y <= 1024; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(2048, y);
      ctx.stroke();
    }

    // Khung viền gạch chu vi sắc nét
    ctx.strokeStyle = 'rgba(206, 145, 128, 0.55)';
    ctx.lineWidth = 6;
    ctx.strokeRect(24, 24, 2000, 976);

    // Đường phân cách giữa Làn 01 và Làn 02 (tỉ lệ 2x)
    ctx.save();
    ctx.setLineDash([36, 24]);
    ctx.strokeStyle = 'rgba(250, 249, 246, 0.62)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(72, 512);
    ctx.lineTo(1976, 512);
    ctx.stroke();
    ctx.restore();

    // Vạch chữ T dẫn làn đáy hồ chuẩn FINA cho Làn 01 (y=256) và Làn 02 (y=768) (tỉ lệ 2x)
    const laneYs = [256, 768];
    for (const ly of laneYs) {
      // Viền gốm sáng tương phản quanh vạch làn và thanh ngang chữ T
      ctx.fillStyle = 'rgba(225, 244, 255, 0.35)';
      ctx.fillRect(164, ly - 24, 1720, 48);
      ctx.fillRect(148, ly - 92, 44, 184);
      ctx.fillRect(1856, ly - 92, 44, 184);

      // Vạch dẫn hướng đáy hồ chính màu tối
      ctx.fillStyle = '#091b29';
      ctx.fillRect(168, ly - 20, 1712, 40);
      // Thanh ngang chữ T hai đầu
      ctx.fillRect(152, ly - 88, 36, 176);
      ctx.fillRect(1860, ly - 88, 36, 176);

      // Thanh nhấn đích quay vòng màu salmon
      ctx.fillStyle = '#ce9180';
      ctx.fillRect(160, ly - 72, 20, 144);
      ctx.fillRect(1868, ly - 72, 20, 144);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Tạo texture vân sáng dưới nước (caustics) có thể lặp. */
export function createWaterCausticsTexture(): THREE.Texture {
  if (typeof document === 'undefined') {
    const data = new Uint8Array([58, 124, 165, 255]);
    const tex = new THREE.DataTexture(data, 1, 1);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#297496';
    ctx.fillRect(0, 0, 512, 512);

    // Các dải sóng vân sáng caustics thủ tục chính sắc nét (tỉ lệ 2x)
    ctx.strokeStyle = 'rgba(230, 249, 255, 0.34)';
    ctx.lineWidth = 5;
    for (let row = 0; row < 8; row++) {
      const baseY = row * 64 + 32;
      ctx.beginPath();
      for (let x = 0; x <= 512; x += 8) {
        const wave = Math.sin((x / 512) * Math.PI * 4 + row * 0.9) * 12;
        if (x === 0) {
          ctx.moveTo(x, baseY + wave);
        } else {
          ctx.lineTo(x, baseY + wave);
        }
      }
      ctx.stroke();
    }

    // Các sợi vân sáng caustics giao thoa phụ giúp ánh khúc xạ mặt nước lung linh sắc nét hơn
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 2.5;
    for (let col = 0; col < 8; col++) {
      const baseX = col * 64 + 32;
      ctx.beginPath();
      for (let y = 0; y <= 512; y += 8) {
        const wave = Math.cos((y / 512) * Math.PI * 4 + col * 1.1) * 10;
        if (y === 0) {
          ctx.moveTo(baseX + wave, y);
        } else {
          ctx.lineTo(baseX + wave, y);
        }
      }
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 2);
  texture.anisotropy = 16;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

const createPoolWaterCausticTexture = createWaterCausticsTexture;

/** Hook cho biết người dùng có bật giảm chuyển động không. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Cập nhật khi tùy chọn giảm chuyển động đổi.
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/**
 * Hồ bơi Oasis ở tầng B1: đáy hồ, mặt nước chuyển động (đứng yên khi giảm chuyển động), thành hồ, làn bơi và
 * tương tác chọn/rê.
 */
export function Pool({ scene = SOL_CENTER_SCENE }: PoolProps) {
  const levelMode = useExploreStore(s => s.levelMode);
  const walkMode = useExploreStore(s => s.walkMode);
  const focusLevel = useExploreStore(s => s.focusLevel);
  const selectNode = useExploreStore(s => s.selectNode);
  const setHoveredId = useExploreStore(s => s.setHoveredId);
  const prefersReducedMotion = usePrefersReducedMotion();

  const effectiveLevelMode = walkMode ? 'stacked' : levelMode;

  // Tầng B1.
  const levelB1 = useMemo(() => getLevelByCode(scene, 'B1'), [scene]);
  const waterTexRef = useRef<THREE.Texture | null>(null);

  // Tạo texture và vật liệu của đáy hồ và mặt nước.
  const resources = useMemo(() => {
    const basinTex = createPoolBasinTexture();
    const waterTex = createPoolWaterCausticTexture();

    const basinMat = new THREE.MeshStandardMaterial({
      name: 'oasis-pool-basin-mat',
      map: basinTex,
      roughness: 0.34,
      metalness: 0.12,
      envMapIntensity: 1.2,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    const waterMat = new THREE.MeshStandardMaterial({
      name: 'oasis-pool-water-mat',
      color: '#3a8bb2',
      map: waterTex,
      roughness: 0.1,
      metalness: 0.18,
      envMapIntensity: 1.35,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    });

    const copingMat = new THREE.MeshStandardMaterial({
      name: 'oasis-pool-coping-mat',
      color: '#38383d',
      roughness: 0.48,
      metalness: 0.16,
      envMapIntensity: 1.15,
    });

    const accentTrimMat = new THREE.MeshStandardMaterial({
      name: 'oasis-pool-salmon-trim-mat',
      color: '#ce9180',
      emissive: '#ce9180',
      emissiveIntensity: 0.1,
      roughness: 0.34,
      metalness: 0.28,
      envMapIntensity: 1.25,
    });

    const unitPlaneGeom = new THREE.PlaneGeometry(1, 1);

    const { width, depth } = OASIS_POOL_DIMENSIONS;
    const borderThickness = 0.42;
    const copingBoxes = [
      new THREE.BoxGeometry(width + borderThickness * 2, 0.16, borderThickness).translate(
        0,
        0.08,
        -(depth * 0.5 + borderThickness * 0.5),
      ),
      new THREE.BoxGeometry(width + borderThickness * 2, 0.16, borderThickness).translate(
        0,
        0.08,
        depth * 0.5 + borderThickness * 0.5,
      ),
      new THREE.BoxGeometry(borderThickness, 0.16, depth).translate(
        -(width * 0.5 + borderThickness * 0.5),
        0.08,
        0,
      ),
      new THREE.BoxGeometry(borderThickness, 0.16, depth).translate(
        width * 0.5 + borderThickness * 0.5,
        0.08,
        0,
      ),
    ];
    const copingGeom = new THREE.BufferGeometry();
    {
      const positions = new Float32Array(24 * 4 * 3);
      const normals = new Float32Array(24 * 4 * 3);
      const indices = new Uint16Array(36 * 4);
      for (let b = 0; b < 4; b += 1) {
        const box = copingBoxes[b]!;
        positions.set(box.getAttribute('position').array as Float32Array, b * 24 * 3);
        normals.set(box.getAttribute('normal').array as Float32Array, b * 24 * 3);
        const idx = box.getIndex()!;
        for (let i = 0; i < 36; i += 1) {
          indices[b * 36 + i] = idx.getX(i) + b * 24;
        }
        box.dispose();
      }
      copingGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      copingGeom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      copingGeom.setIndex(new THREE.BufferAttribute(indices, 1));
    }

    const trimBoxes = [
      new THREE.BoxGeometry(0.08, 0.02, depth).translate(width * 0.5 + 0.04, 0.165, 0),
      new THREE.BoxGeometry(0.08, 0.02, depth).translate(-(width * 0.5 + 0.04), 0.165, 0),
    ];
    const trimGeom = new THREE.BufferGeometry();
    {
      const positions = new Float32Array(24 * 2 * 3);
      const normals = new Float32Array(24 * 2 * 3);
      const indices = new Uint16Array(36 * 2);
      for (let b = 0; b < 2; b += 1) {
        const box = trimBoxes[b]!;
        positions.set(box.getAttribute('position').array as Float32Array, b * 24 * 3);
        normals.set(box.getAttribute('normal').array as Float32Array, b * 24 * 3);
        const idx = box.getIndex()!;
        for (let i = 0; i < 36; i += 1) {
          indices[b * 36 + i] = idx.getX(i) + b * 24;
        }
        box.dispose();
      }
      trimGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      trimGeom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      trimGeom.setIndex(new THREE.BufferAttribute(indices, 1));
    }

    return {
      basinTex,
      waterTex,
      basinMat,
      waterMat,
      copingMat,
      accentTrimMat,
      unitPlaneGeom,
      copingGeom,
      trimGeom,
    };
  }, []);

  useEffect(() => {
    waterTexRef.current = resources.waterTex;
    return () => {
      waterTexRef.current = null;
      resources.basinMat.dispose();
      resources.waterMat.dispose();
      resources.copingMat.dispose();
      resources.accentTrimMat.dispose();
      resources.basinTex.dispose();
      resources.waterTex.dispose();
      resources.unitPlaneGeom.dispose();
      resources.copingGeom.dispose();
      resources.trimGeom.dispose();
    };
  }, [resources]);

  const hideBuriedB1 =
    !walkMode && effectiveLevelMode === 'stacked' && focusLevel === 'ALL';
  const hideFarWalkB1 =
    walkMode && focusLevel !== 'B1' && focusLevel !== 'L1' && focusLevel !== 'ALL';
  const isB1Visible =
    !hideBuriedB1 &&
    !hideFarWalkB1 &&
    (effectiveLevelMode !== 'solo' || focusLevel === 'ALL' || focusLevel === 'B1');
  const canAnimate =
    isB1Visible && !prefersReducedMotion && (focusLevel === 'B1' || focusLevel === 'ALL');

  // Dịch chuyển gợn sóng UV nhẹ chỉ khi khung hình đang được vẽ chủ động (KHÔNG ép chạy 60fps khi nhàn rỗi)
  useFrame((_, delta) => {
    const tex = waterTexRef.current;
    if (!canAnimate || !tex) return;
    const step = Math.min(delta, 0.1);
    tex.offset.x = (tex.offset.x + step * 0.035) % 1;
    tex.offset.y = (tex.offset.y + step * 0.018) % 1;
  });

  if (!isB1Visible) {
    return null;
  }

  const b1WorldY = levelB1 ? getLevelWorldY(levelB1, effectiveLevelMode) : -4.5;
  const { centerX, centerZ, width, depth } = OASIS_POOL_DIMENSIONS;

  // Bấm: chọn hồ bơi.
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    selectNode('zone-b1-pool');
  };

  // Bấm đúp: chọn hồ bơi và bay vừa khung.
  const handleDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    selectNode('zone-b1-pool', { fit: true });
  };

  // Rê vào: đặt hồ bơi đang rê.
  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHoveredId('zone-b1-pool');
  };

  // Rê ra: bỏ hồ bơi đang rê.
  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHoveredId(null);
  };

  return (
    <group name="sol-oasis-pool" position={[centerX, b1WorldY, centerZ]}>
      {/* Đáy bể lát gạch với vạch chữ T chuẩn FINA */}
      <mesh
        position={[0, 0.018, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[width, depth, 1]}
        geometry={resources.unitPlaneGeom}
        material={resources.basinMat}
        receiveShadow
        raycast={NOOP_RAYCAST}
      />

      {/* Mặt nước bán trong suốt có vân sáng caustics */}
      <mesh
        position={[0, 0.14, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[width - 0.1, depth - 0.1, 1]}
        geometry={resources.unitPlaneGeom}
        material={resources.waterMat}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      />

      {/* Gờ đá ốp viền thành bể đã gộp */}
      <mesh geometry={resources.copingGeom} material={resources.copingMat} raycast={NOOP_RAYCAST} />

      {/* Dải nhấn rãnh tràn màu salmon SÖL đã gộp */}
      <mesh geometry={resources.trimGeom} material={resources.accentTrimMat} raycast={NOOP_RAYCAST} />
    </group>
  );
}

export default Pool;
