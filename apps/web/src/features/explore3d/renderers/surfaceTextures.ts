import * as THREE from 'three';

/**
 * Tên các bộ texture PBR CC0 từ Poly Haven (đặt ở /textures/explore3d).
 *
 * CC0 PBR sets from Poly Haven, served from /textures/explore3d (see docs/3D_ASSETS.md).
 */
export type SurfaceTextureName =
  | 'asphalt_02'
  | 'smooth_concrete_floor'
  | 'concrete_wall_008'
  | 'grey_plaster'
  | 'laminate_floor_02'
  | 'wood_floor_deck'
  | 'rubber_tiles'
  | 'rubberized_track'
  | 'leafy_grass'
  | 'tatami_mat'
  | 'floor_tiles_06';

export const SURFACE_TEXTURE_BASE_URL = '/textures/explore3d';

/**
 * Bộ uniform texture dùng chung: vật liệu nào dùng bộ này cũng thấy texture ngay khi tải xong (albedo, normal,
 * ARM, cờ ready và các giá trị trung bình).
 *
 * Shared uniform objects: every material using the set sees the texture the moment it loads.
 */
export interface SurfaceTextureSet {
  name: SurfaceTextureName;
  albedo: THREE.IUniform<THREE.Texture>;
  normal: THREE.IUniform<THREE.Texture>;
  arm: THREE.IUniform<THREE.Texture>;
  /** 0 until all three maps are decoded; shaders fall back to the procedural detail. */
  ready: THREE.IUniform<number>;
  /** Mean linear albedo, so the texture adds detail without replacing the palette colour. */
  mean: THREE.IUniform<THREE.Vector3>;
  /** Mean roughness (ARM green channel). */
  meanRoughness: THREE.IUniform<number>;
  requested: boolean;
}

/** Tạo texture một điểm ảnh làm giá trị tạm trong lúc chưa tải xong. */
function placeholder(r: number, g: number, b: number): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1);
  tex.needsUpdate = true;
  return tex;
}

const sets = new Map<SurfaceTextureName, SurfaceTextureSet>();

/** Lấy (hoặc tạo) bộ texture theo tên với giá trị tạm; chưa tải thì shader dùng chi tiết thủ tục. */
export function getSurfaceTextureSet(name: SurfaceTextureName): SurfaceTextureSet {
  let set = sets.get(name);
  if (!set) {
    set = {
      name,
      albedo: { value: placeholder(255, 255, 255) },
      normal: { value: placeholder(128, 128, 255) },
      arm: { value: placeholder(255, 255, 0) },
      ready: { value: 0 },
      mean: { value: new THREE.Vector3(1, 1, 1) },
      meanRoughness: { value: 1 },
      requested: false,
    };
    sets.set(name, set);
  }
  return set;
}

/** Đổi một kênh màu sRGB (0–255) sang tuyến tính. */
function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** Tính màu trung bình (tuyến tính) của ảnh bằng cách vẽ nhỏ 8×8 lên canvas; lỗi thì null. */
function averagePixel(image: CanvasImageSource): [number, number, number] | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, 8, 8);
    const data = ctx.getImageData(0, 0, 8, 8).data;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    const n = data.length / 4;
    return [r / n, g / n, b / n];
  } catch {
    return null;
  }
}

/**
 * Bắt đầu tải mọi bộ texture mà vật liệu đã yêu cầu; gọi lặp lại an toàn, không làm gì khi không có DOM (test).
 *
 * Starts loading every texture set that a material has asked for. Safe to call
 * repeatedly; does nothing without a DOM (unit tests) so materials keep their
 * procedural detail there.
 */
export function loadSurfaceTextures(onLoaded: () => void, anisotropy = 4): void {
  if (typeof document === 'undefined') return;
  const loader = new THREE.TextureLoader();
  for (const set of sets.values()) {
    if (set.requested) continue;
    set.requested = true;
    // Dựng URL của một bản đồ (diff/nor/arm) của bộ texture.
    const url = (suffix: string) => `${SURFACE_TEXTURE_BASE_URL}/${set.name}_${suffix}.webp`;
    // Cấu hình texture: lặp, độ dị hướng và không gian màu.
    const prepare = (tex: THREE.Texture, srgb: boolean) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = anisotropy;
      tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      return tex;
    };
    Promise.all([
      loader.loadAsync(url('diff')),
      loader.loadAsync(url('nor')),
      loader.loadAsync(url('arm')),
    ])
      .then(([albedo, normal, arm]) => {
        const avg = averagePixel(albedo.image as CanvasImageSource);
        const avgArm = averagePixel(arm.image as CanvasImageSource);
        if (avg) set.mean.value.set(srgbToLinear(avg[0]), srgbToLinear(avg[1]), srgbToLinear(avg[2]));
        if (avgArm) set.meanRoughness.value = Math.max(0.05, avgArm[1] / 255);
        set.albedo.value.dispose();
        set.normal.value.dispose();
        set.arm.value.dispose();
        set.albedo.value = prepare(albedo, true);
        set.normal.value = prepare(normal, false);
        set.arm.value = prepare(arm, false);
        set.ready.value = avg ? 1 : 0;
        onLoaded();
      })
      .catch(error => {
        set.requested = false;
        console.warn(`[explore3d] Surface texture "${set.name}" failed to load; keeping procedural detail.`, error);
      });
  }
}
