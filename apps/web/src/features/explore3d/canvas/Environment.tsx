/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  buildCampusSceneGeometries,
  buildCampusSignageGeometry,
  createCampusSignageTexture,
} from '../renderers/architecture/buildCampusGeometry';
import {
  getExploreThemePalette,
  useDocumentTheme,
  useExploreMaterials,
} from '../renderers/materials';
import { useExploreStore } from '../state/exploreStore';
import {
  SURFACE_DETAIL_PRESETS,
  applyArchitecturalGlassShader,
  applySurfaceDetail,
  createFoliageMaterialBundle,
  createWaterSurfaceMaterial,
} from '../renderers/surfaceDetail';
import { getAtmosphere } from './atmosphere';
import { isExteriorWorldVisible } from './LevelStack';
import { PracticalLights } from './PracticalLights';
import { SkyDome } from './SkyProbe';

/** Giới hạn quảng trường quanh tòa nhà (min/max X, Z và độ cao). */
export const PLAZA_BOUNDS = {
  minX: -45,
  maxX: 58,
  minZ: -30,
  maxZ: 30,
  y: -0.04,
} as const;

/** Giới hạn lối đi vào cửa chính. */
export const ENTRANCE_WALKWAY_BOUNDS = {
  minX: -4,
  maxX: 8,
  minZ: 16,
  maxZ: 22,
  y: -0.025,
} as const;

/** Dựng lưới quảng trường (đường kẻ theo bước step mét). */
export function buildPlazaGridGeometry(
  minX: number = PLAZA_BOUNDS.minX,
  maxX: number = PLAZA_BOUNDS.maxX,
  minZ: number = PLAZA_BOUNDS.minZ,
  maxZ: number = PLAZA_BOUNDS.maxZ,
  step = 4,
): THREE.BufferGeometry {
  const points: number[] = [];
  for (let x = minX; x <= maxX; x += step) {
    points.push(x, 0, minZ, x, 0, maxZ);
  }
  for (let z = minZ; z <= maxZ; z += step) {
    points.push(minX, 0, z, maxX, 0, z);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geom;
}

const SHARED_PLAZA_PLANE = new THREE.PlaneGeometry(1, 1);
const TERRAIN_DISC = new THREE.CircleGeometry(1000, 64);
/** Raycast rỗng để môi trường không bắt sự kiện chuột. */
const NOOP_RAYCAST = () => null;

/**
 * Môi trường của khuôn viên: quảng trường, địa hình tới chân trời, kiến trúc, cây, nước, xe, biển hiệu và thành
 * phố nền theo theme và tầng/chế độ đang xem.
 */
export function Environment() {
  const theme = useDocumentTheme();
  const palette = getExploreThemePalette(theme);
  const materials = useExploreMaterials(theme);
  const focusLevel = useExploreStore(s => s.focusLevel);
  const levelMode = useExploreStore(s => s.levelMode);
  const walkMode = useExploreStore(s => s.walkMode);
  const tier = useExploreStore(s => s.tier);
  const practicals = getAtmosphere(theme).practicals;
  const invalidate = useThree(s => s.invalidate);

  const plazaY =
    levelMode === 'exploded'
      ? -10.82
      : focusLevel === 'B1'
        ? -4.82
        : PLAZA_BOUNDS.y;

  // Hình học khuôn viên theo theme.
  const campusScene = useMemo(() => buildCampusSceneGeometries(theme), [theme]);
  // Vật liệu kiến trúc khuôn viên.
  const campusMaterial = useMemo(
    () =>
      applySurfaceDetail(
        new THREE.MeshStandardMaterial({
          name: 'sol-campus-architecture',
          vertexColors: true,
          roughness: 0.78,
          metalness: 0.0,
          envMapIntensity: 1.25,
        }),
        SURFACE_DETAIL_PRESETS.campus,
      ),
    [],
  );
  // Vật liệu kính kiến trúc.
  const campusGlassMaterial = useMemo(
    () =>
      applyArchitecturalGlassShader(
        new THREE.MeshStandardMaterial({
          name: 'sol-campus-glass',
          vertexColors: true,
          roughness: 0.04,
          metalness: 0.16,
          transparent: true,
          opacity: 0.36,
          depthWrite: false,
          side: THREE.DoubleSide,
          envMapIntensity: 2.0,
        }),
        theme === 'light',
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => {
    (campusGlassMaterial.userData.setGlassTheme as ((isLight: boolean) => void) | undefined)?.(
      theme === 'light',
    );
  }, [campusGlassMaterial, theme]);
  // Vật liệu nước của khuôn viên.
  const campusWaterBundle = useMemo(
    () => createWaterSurfaceMaterial('sol-campus-water', theme === 'light'),
    [theme],
  );
  // Vật liệu tán lá cây.
  const foliageBundle = useMemo(
    () => createFoliageMaterialBundle('sol-campus-foliage', theme === 'light'),
    [theme],
  );
  // Vật liệu xe sử dụng thuộc tính `surf` trên từng đỉnh để lớp sơn kim loại và mâm xe bóng sáng trong khi lốp cao su giữ độ mờ.
  const vehicleMaterial = useMemo(
    () =>
      applySurfaceDetail(
        new THREE.MeshStandardMaterial({
          name: 'sol-campus-vehicles',
          vertexColors: true,
          roughness: 0.22,
          metalness: 0.0,
          envMapIntensity: 1.4,
        }),
        SURFACE_DETAIL_PRESETS.vehicle,
      ),
    [],
  );
  useEffect(
    () => () => {
      campusScene.opaque.dispose();
      campusScene.glass.dispose();
      campusScene.water.dispose();
      campusScene.vehicles.dispose();
      campusScene.foliage.dispose();
    },
    [campusScene],
  );
  useEffect(() => () => campusMaterial.dispose(), [campusMaterial]);
  useEffect(() => () => campusGlassMaterial.dispose(), [campusGlassMaterial]);
  useEffect(() => () => campusWaterBundle.material.dispose(), [campusWaterBundle]);
  useEffect(
    () => () => {
      foliageBundle.material.dispose();
      foliageBundle.depthMaterial.dispose();
      foliageBundle.texture.dispose();
    },
    [foliageBundle],
  );
  useEffect(() => () => vehicleMaterial.dispose(), [vehicleMaterial]);
  const castShadows = tier !== 'low';
  const showRooftopSigns =
    levelMode !== 'solo' || focusLevel === 'ALL' || focusLevel === 'RF';
  const showGroundCampus = isExteriorWorldVisible(levelMode, focusLevel);
  const rooftopOffsetY = levelMode === 'exploded' ? 12.0 : 0;

  useFrame(({ clock }) => {
    if (!showGroundCampus) return;
    const t = clock.elapsedTime;
    campusWaterBundle.setTime(t);
    foliageBundle.setTime(t);
  });

  // Hình học biển hiệu.
  const signageGeometry = useMemo(
    () => buildCampusSignageGeometry(rooftopOffsetY, showRooftopSigns),
    [rooftopOffsetY, showRooftopSigns],
  );
  // Biển hiệu có đèn phát sáng trên ngưỡng 1.0 lúc chạng vạng để tạo hiệu ứng bloom như bảng đèn thật.
  const signageMaterialBundle = useMemo(() => {
    const tex = createCampusSignageTexture();
    const mat = new THREE.MeshBasicMaterial({
      name: 'sol-campus-signage-atlas-mat',
      map: tex ?? undefined,
      color: tex ? '#ffffff' : '#ce9180',
      side: THREE.DoubleSide,
      toneMapped: !practicals,
    });
    if (tex && practicals) mat.color.setScalar(2.4);
    return { tex, mat };
  }, [practicals]);

  useEffect(() => {
    invalidate();
  }, [theme, plazaY, levelMode, focusLevel, practicals, tier, invalidate]);

  useEffect(() => {
    return () => {
      signageGeometry.dispose();
    };
  }, [signageGeometry]);

  useEffect(() => {
    return () => {
      signageMaterialBundle.mat.dispose();
      signageMaterialBundle.tex?.dispose();
    };
  }, [signageMaterialBundle]);

  const plazaWidth = PLAZA_BOUNDS.maxX - PLAZA_BOUNDS.minX;
  const plazaDepth = PLAZA_BOUNDS.maxZ - PLAZA_BOUNDS.minZ;
  const plazaCenterX = (PLAZA_BOUNDS.minX + PLAZA_BOUNDS.maxX) * 0.5;
  const plazaCenterZ = (PLAZA_BOUNDS.minZ + PLAZA_BOUNDS.maxZ) * 0.5;

  // Lưới quảng trường.
  const gridGeometry = useMemo(() => buildPlazaGridGeometry(), []);

  // Địa hình trải dài tới đường chân trời để khuôn viên nằm trong một không gian thật thay vì khoảng trống;
  // lớp sương mù hậu kỳ sẽ hòa tan phần rìa địa hình vào bầu trời.
  const terrainColor = getAtmosphere(theme).terrain;
  // Vật liệu địa hình.
  const terrainMaterial = useMemo(
    () =>
      applySurfaceDetail(
        new THREE.MeshStandardMaterial({ name: 'sol-terrain', roughness: 0.92, metalness: 0 }),
        SURFACE_DETAIL_PRESETS.terrain,
      ),
    [],
  );
  useEffect(() => {
    terrainMaterial.color.set(terrainColor);
  }, [terrainMaterial, terrainColor]);
  useEffect(() => () => terrainMaterial.dispose(), [terrainMaterial]);

  useEffect(() => {
    return () => {
      gridGeometry.dispose();
    };
  }, [gridGeometry]);

  return (
    <>
      <color attach="background" args={[palette.canvasBg]} />
      {/* Bầu trời + sương mù theo độ cao thay thế cho sương mù phẳng: lớp sương mù được áp dụng ở bước chỉnh màu hậu kỳ. */}
      <SkyDome theme={theme} />

      <PracticalLights
        tier={tier}
        offsetY={plazaY - PLAZA_BOUNDS.y}
        visible={practicals && showGroundCampus}
        walkMode={walkMode}
      />

      <group name="sol-plaza-environment">
        {/* Mặt phẳng quảng trường nền [-45..58] X, [-30..30] Z */}
        <mesh
          position={[plazaCenterX, plazaY, plazaCenterZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[plazaWidth, plazaDepth, 1]}
          geometry={SHARED_PLAZA_PLANE}
          material={materials.plazaGround}
          receiveShadow
          raycast={NOOP_RAYCAST}
        />

        <mesh
          name="sol-terrain"
          position={[plazaCenterX, plazaY - 0.05, plazaCenterZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          geometry={TERRAIN_DISC}
          material={terrainMaterial}
          receiveShadow
          raycast={NOOP_RAYCAST}
        />

        {/* Các đường lưới kiến trúc mờ nhẹ */}
        <lineSegments
          position={[0, plazaY + 0.008, 0]}
          geometry={gridGeometry}
          material={materials.plazaGrid}
        />

        {/* Toàn bộ khuôn viên ngoại thất 3D: Cổng chính, Chốt bảo vệ, Bãi đỗ ô tô & xe máy, Trạm sạc xe điện, Đài phun nước, Mái đón, Cây xanh & Đèn đường */}
        <mesh
          name="sol-campus-architecture"
          visible={showGroundCampus}
          geometry={campusScene.opaque}
          material={campusMaterial}
          castShadow={castShadows}
          receiveShadow
          raycast={NOOP_RAYCAST}
        />
        <mesh
          name="sol-campus-foliage"
          visible={showGroundCampus}
          geometry={campusScene.foliage}
          material={foliageBundle.material}
          customDepthMaterial={foliageBundle.depthMaterial}
          castShadow={castShadows}
          receiveShadow
          raycast={NOOP_RAYCAST}
        />
        <mesh
          name="sol-campus-glass"
          visible={showGroundCampus}
          geometry={campusScene.glass}
          material={campusGlassMaterial}
          raycast={NOOP_RAYCAST}
        />
        <mesh
          name="sol-campus-water"
          visible={showGroundCampus}
          geometry={campusScene.water}
          material={campusWaterBundle.material}
          receiveShadow
          raycast={NOOP_RAYCAST}
        />
        <mesh
          name="sol-campus-vehicles"
          visible={showGroundCampus}
          geometry={campusScene.vehicles}
          material={vehicleMaterial}
          castShadow={castShadows}
          receiveShadow
          raycast={NOOP_RAYCAST}
        />

        {/* Biển hiệu 3D phát sáng trên mái nhà, biển cổng chính, biển mái đón sảnh, biển bãi đỗ xe và sân tennis */}
        <mesh
          name="sol-campus-signage"
          visible={showGroundCampus}
          geometry={signageGeometry}
          material={signageMaterialBundle.mat}
          raycast={NOOP_RAYCAST}
        />
      </group>
    </>
  );
}

export default Environment;
