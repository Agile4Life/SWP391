import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CAMPUS_FLAGPOLE_ANCHORS } from '../renderers/architecture/buildCampusGeometry';
import { buildCityMetropolis, buildGymCrown } from '../renderers/architecture/buildCityMetropolis';
import { useDocumentTheme, type ExploreTheme } from '../renderers/materials';
import {
  SURFACE_DETAIL_PRESETS,
  applyArchitecturalGlassShader,
  applyCityGlazingShader,
  applySurfaceDetail,
  createFoliageMaterialBundle,
} from '../renderers/surfaceDetail';
import { useExploreStore } from '../state/exploreStore';
import { CityLife } from './CityLife';
import { CitySky } from './CitySky';
import { CityTraffic } from './CityTraffic';
import { isExteriorWorldVisible } from './LevelStack';

/** Raycast rỗng để thành phố nền không bắt sự kiện chuột. */
const NOOP_RAYCAST = () => null;

/**
 * Thành phố nền: đường chân trời, lưới đường, cầu cạn metro, kính, cây và cờ khuôn viên động theo gió.
 */
export function CityMetropolis() {
  const theme = useDocumentTheme();
  const tier = useExploreStore(s => s.tier);
  const levelMode = useExploreStore(s => s.levelMode);
  const focusLevel = useExploreStore(s => s.focusLevel);
  // Hình học thành phố theo theme và mức chất lượng.
  const city = useMemo(() => buildCityMetropolis(theme, tier), [theme, tier]);
  const visible = isExteriorWorldVisible(levelMode, focusLevel);

  // Vật liệu đặc (bê tông quét/nhựa đường) lấy hạt bề mặt và độ nhám từ thuộc tính `surf` trên từng đỉnh.
  const opaqueMat = useMemo(
    () =>
      applySurfaceDetail(
        new THREE.MeshStandardMaterial({ name: 'sol-city-opaque', vertexColors: true, roughness: 0.78, envMapIntensity: 1.05 }),
        SURFACE_DETAIL_PRESETS.cityOpaque,
      ),
    [],
  );
  // Vật liệu kim loại.
  const metalMat = useMemo(
    () =>
      applySurfaceDetail(
        new THREE.MeshStandardMaterial({ name: 'sol-city-metal', vertexColors: true, roughness: 0.38, metalness: 0.65, envMapIntensity: 1.5 }),
        // Độ nổi 80 chu kỳ/m nhỏ hơn kích thước pixel ở khoảng cách camera khóa, nên bỏ qua.
        { ...SURFACE_DETAIL_PRESETS.metal, bump: 0, albedo: 0, roughness: 0 },
      ),
    [],
  );
  useEffect(() => () => opaqueMat.dispose(), [opaqueMat]);
  useEffect(() => () => metalMat.dispose(), [metalMat]);
  // Vật liệu kính mái bán trong suốt để vẫn nhìn thấy tầng penthouse bên dưới khi quan sát từ trên cao.
  const roofGlassMat = useMemo(
    () =>
      applyArchitecturalGlassShader(
        new THREE.MeshStandardMaterial({
          name: 'sol-gym-roof-glass',
          vertexColors: true,
          roughness: 0.06,
          metalness: 0.16,
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
          envMapIntensity: 1.95,
        }),
        theme === 'light',
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => {
    (roofGlassMat.userData.setGlassTheme as ((isLight: boolean) => void) | undefined)?.(
      theme === 'light',
    );
  }, [roofGlassMat, theme]);
  useEffect(() => () => roofGlassMat.dispose(), [roofGlassMat]);
  // Vật liệu kính của các tòa nhà.
  const glassMat = useMemo(
    () =>
      applyCityGlazingShader(
        new THREE.MeshStandardMaterial({
          name: 'sol-city-glass',
          vertexColors: true,
          roughness: 0.16,
          metalness: 0.62,
          envMapIntensity: 1.15,
        }),
        theme === 'light',
      ),
    [theme],
  );
  // Vật liệu tán lá cây của thành phố.
  const cityFoliageBundle = useMemo(
    () => createFoliageMaterialBundle('sol-city-foliage', theme === 'light'),
    [theme],
  );
  useEffect(
    () => () => {
      cityFoliageBundle.material.dispose();
      cityFoliageBundle.depthMaterial.dispose();
      cityFoliageBundle.texture.dispose();
    },
    [cityFoliageBundle],
  );
  // Vật liệu phát sáng, không tone map.
  const emissiveMat = useMemo(
    () => new THREE.MeshBasicMaterial({ name: 'sol-city-emissive', vertexColors: true, toneMapped: false }),
    [],
  );
  useEffect(() => () => glassMat.dispose(), [glassMat]);
  useEffect(() => () => emissiveMat.dispose(), [emissiveMat]);

  useFrame(({ clock }) => {
    if (!visible) return;
    cityFoliageBundle.setTime(clock.elapsedTime);
  });

  return (
    <group name="sol-city-metropolis" visible={visible}>
      <mesh name="sol-city-opaque" geometry={city.opaqueGeometry} material={opaqueMat} receiveShadow raycast={NOOP_RAYCAST} />
      <mesh name="sol-city-metal" geometry={city.metalGeometry} material={metalMat} receiveShadow raycast={NOOP_RAYCAST} />
      <mesh name="sol-city-glass" geometry={city.glassGeometry} material={glassMat} raycast={NOOP_RAYCAST} />
      <mesh name="sol-city-emissive" geometry={city.emissiveGeometry} material={emissiveMat} raycast={NOOP_RAYCAST} />
      <mesh name="sol-city-foliage" geometry={city.foliageGeometry} material={cityFoliageBundle.material} receiveShadow raycast={NOOP_RAYCAST} />
      <GymCrown theme={theme} glassMat={roofGlassMat} emissiveMat={emissiveMat} opaqueMat={opaqueMat} metalMat={metalMat} />
      <CityTraffic />
      <CityLife city={city} />
      <CitySky />
      <Flags isLight={theme === 'light'} />
    </group>
  );
}

/** Các lá cờ trên cột cờ khuôn viên, uốn lượn theo gió. */
function Flags({ isLight }: { isLight: boolean }) {
  const invalidate = useThree(s => s.invalidate);
  // Tạo mặt phẳng và vật liệu cho từng lá cờ theo vị trí cột.
  const flags = useMemo(
    () =>
      CAMPUS_FLAGPOLE_ANCHORS.map(a => {
        const geom = new THREE.PlaneGeometry(a.width, a.height, 12, 3);
        geom.translate(a.width / 2, 0, 0);
        const mat = new THREE.MeshStandardMaterial({
          color: a.variant === 'salmon' ? (isLight ? '#d9826a' : '#e8a090') : '#1e293b',
          side: THREE.DoubleSide,
          roughness: 0.82,
        });
        const base = Float32Array.from(geom.getAttribute('position').array);
        return { a, geom, mat, base };
      }),
    [isLight],
  );
  useEffect(
    () => () => {
      flags.forEach(f => {
        f.geom.dispose();
        f.mat.dispose();
      });
    },
    [flags],
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (const f of flags) {
      const pos = f.geom.getAttribute('position') as THREE.BufferAttribute;
      const norm = f.geom.getAttribute('normal') as THREE.BufferAttribute;
      const invW = 1 / f.a.width;
      for (let i = 0; i < pos.count; i += 1) {
        const x = f.base[i * 3]!;
        const k = x * invW;
        const phase = x * 5 - t * 4 + f.a.z;
        const sinP = Math.sin(phase);
        const cosP = Math.cos(phase);
        pos.setZ(i, sinP * 0.1 * k);
        pos.setY(i, f.base[i * 3 + 1]! + Math.sin(x * 3 - t * 3) * 0.03 * k);
        const dzdx = 0.1 * invW * (sinP + x * 5 * cosP);
        const invLen = 1 / Math.hypot(dzdx, 1);
        norm.setXYZ(i, -dzdx * invLen, 0, invLen);
      }
      pos.needsUpdate = true;
      norm.needsUpdate = true;
    }
    invalidate();
  });
  return (
    <>
      {flags.map(f => (
        <mesh key={f.a.id} geometry={f.geom} material={f.mat} position={[f.a.x, f.a.y, f.a.z]} castShadow raycast={NOOP_RAYCAST} />
      ))}
    </>
  );
}

/** Props của mũ mái phòng gym: theme và các vật liệu dùng chung. */
interface GymCrownProps {
  theme: ExploreTheme;
  glassMat: THREE.Material;
  emissiveMat: THREE.Material;
  opaqueMat: THREE.Material;
  metalMat: THREE.Material;
}

/**
 * Mũ mái phòng gym trên tấm mái xếp chồng; ẩn khi các tầng bị tách hoặc cô lập.
 */
function GymCrown({ theme, glassMat, emissiveMat, opaqueMat, metalMat }: GymCrownProps) {
  const levelMode = useExploreStore(s => s.levelMode);
  // Hình học mũ mái theo theme.
  const crown = useMemo(() => buildGymCrown(theme), [theme]);
  return (
    <group name="sol-gym-crown" visible={levelMode === 'stacked'}>
      <mesh geometry={crown.opaqueGeometry} material={opaqueMat} receiveShadow raycast={NOOP_RAYCAST} />
      <mesh geometry={crown.metalGeometry} material={metalMat} receiveShadow raycast={NOOP_RAYCAST} />
      <mesh geometry={crown.glassGeometry} material={glassMat} raycast={NOOP_RAYCAST} />
      <mesh geometry={crown.emissiveGeometry} material={emissiveMat} raycast={NOOP_RAYCAST} />
    </group>
  );
}
