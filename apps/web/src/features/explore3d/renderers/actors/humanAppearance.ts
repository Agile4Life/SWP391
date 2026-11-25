import * as THREE from 'three';
import type { ActorOutfitPalette } from './liveActorsConfig';

/**
 * Biến đổi các nhân vật nền Quaternius (mặc định mặc đồ lót) thành người tập gym, người bơi,
 * người tập yoga và nhân viên SÖL: đồ thể thao dựng thành lớp vỏ skinned hiệu chỉnh theo giới tính
 * ôm ngoài cơ thể, giày thể thao điêu khắc, cắt bỏ vùng da bị che dưới áo (không bị xuyên khớp),
 * kiểu tóc và râu tùy chọn gắn vào xương đầu cùng tông da tự nhiên.
 */

/** Giới tính của nhân vật: nam hoặc nữ. */
export type Gender = 'male' | 'female';
/** Kiểu trang phục: thể thao, bơi, đi chân đất hoặc nhân viên. */
export type WearMode = 'athletic' | 'swim' | 'barefoot' | 'staff';
/** Tên kiểu tóc có sẵn (cắt ngắn, dài, búi...). */
export type HairStyleName =
  | 'hair-simpleparted'
  | 'hair-buzzed'
  | 'hair-long'
  | 'hair-buns'
  | 'hair-buzzedfemale';

export const HAIR_STYLES: Record<Gender, readonly HairStyleName[]> = {
  male: ['hair-simpleparted', 'hair-buzzed', 'hair-simpleparted'],
  female: ['hair-long', 'hair-buns', 'hair-buzzedfemale', 'hair-long'],
};

/** Tài nguyên mô hình người: nhân vật theo giới tính, kiểu tóc và texture da. */
export interface HumanAssets {
  /** Cảnh nhân vật theo giới tính (thân, mắt, lông mày trên cùng bộ xương rig). */
  characters: Record<Gender, THREE.Object3D>;
  /** Cảnh kiểu tóc (và `hair-beard`), dạng mesh tĩnh trong không gian tư thế nghỉ của nhân vật. */
  hair: Record<string, THREE.Object3D>;
  /** Texture da sáng (các nhân vật đóng gói sẵn mang texture da tối). */
  skinLight: Record<Gender, THREE.Texture>;
}

/**
 * Kiểu trang phục của nhân vật: mỗi cờ thay đổi đường cắt hoặc chi tiết của đồ thể thao.
 */
export interface OutfitVariant {
  /** Tay áo ngắn; nếu false là áo ba lỗ (tank top). */
  sleeves: boolean;
  /** Áo ngắn (crop top) để hở phần eo. */
  crop: boolean;
  /** Quần legging ôm sát tới trên mắt cá thay vì quần đùi rộng. */
  leggings: boolean;
  /** Sọc tương phản trên ngực và dọc hai bên ống quần. */
  stripe: boolean;
  /** Băng cổ tay thấm mồ hôi ở cả hai cổ tay. */
  wristbands: boolean;
  /** Băng đô ngang trán. */
  headband: boolean;
}

/** Diện mạo của một nhân vật: giới tính, bảng màu, kiểu tóc, trang phục, mũ bơi và kiểu mặc. */
export interface HumanLook {
  gender: Gender;
  palette: ActorOutfitPalette;
  hairStyle: HairStyleName;
  outfit: OutfitVariant;
  /** Người bơi đội mũ silicone trơn cùng màu tóc thay vì để kiểu tóc. */
  swimCap: boolean;
  /** Trang phục theo hoạt động (mặc định `athletic`, `swim`, `barefoot`, `staff`). */
  wear?: WearMode;
  /** Râu tỉa gọn gắn vào xương đầu cho nhân vật nam. */
  beard?: boolean;
}

// Các loại vải, dùng làm chỉ mục cho bảng màu và bảng độ nhám của một bộ trang phục.
const TOP = 0;
const BOTTOM = 1;
const SHOE = 2;
const SOLE = 3;
const SOCK = 4;
const TRIM = 5;
const WAISTBAND = 6;
const STRIPE = 7;

/** Các mốc kích thước cơ thể theo giới (eo, gấu quần, gấu legging...). */
interface GenderLandmarks {
  waist: number;
  shortsHem: number;
  leggingsHem: number;
  pantsHem: number;
  jammerHem: number;
  cropHem: number;
  armpit: number;
  torsoHalfWidth: number;
  strapOuter: number;
  sleeveEndX: number;
  armLow: number;
  armHigh: number;
  wristStart: number;
  wristEnd: number;
  neckFront: number;
  neckShoulder: number;
  collarX: number;
  collarLow: number;
  footCenterX: number;
  soleTop: number;
  shoeTop: number;
  sockTop: number;
  headbandY: number;
  headbandRx: number;
  headbandRz: number;
}

// Đo trực tiếp từ `human-male.glb` (1.82 m, bắp tay trên x=0.212, bàn tay x=0.706, cổ y=1.52)
// và `human-female.glb` (1.775 m, bắp tay trên x=0.152, bàn tay x=0.641, cổ y=1.485).
const LANDMARKS: Record<Gender, GenderLandmarks> = {
  male: {
    waist: 1.02,
    shortsHem: 0.69,
    leggingsHem: 0.23,
    pantsHem: 0.135,
    jammerHem: 0.6,
    cropHem: 1.19,
    armpit: 1.34,
    torsoHalfWidth: 0.198,
    strapOuter: 0.175,
    sleeveEndX: 0.35,
    armLow: 1.35,
    armHigh: 1.54,
    wristStart: 0.6,
    wristEnd: 0.655,
    neckFront: 1.445,
    neckShoulder: 1.502,
    collarX: 0.12,
    collarLow: 1.415,
    footCenterX: 0.131,
    soleTop: 0.034,
    shoeTop: 0.118,
    sockTop: 0.205,
    headbandY: 1.738,
    headbandRx: 0.097,
    headbandRz: 0.131,
  },
  female: {
    waist: 1.0,
    shortsHem: 0.7,
    leggingsHem: 0.22,
    pantsHem: 0.13,
    jammerHem: 0.83,
    cropHem: 1.18,
    armpit: 1.302,
    torsoHalfWidth: 0.148,
    strapOuter: 0.142,
    sleeveEndX: 0.285,
    armLow: 1.325,
    armHigh: 1.485,
    wristStart: 0.545,
    wristEnd: 0.598,
    neckFront: 1.395,
    neckShoulder: 1.452,
    collarX: 0.105,
    collarLow: 1.37,
    footCenterX: 0.125,
    soleTop: 0.032,
    shoeTop: 0.114,
    sockTop: 0.198,
    headbandY: 1.694,
    headbandRx: 0.089,
    headbandRz: 0.12,
  },
};

/** Một lớp áo quần (shell): hình học và loại vải của từng đỉnh để tô màu theo bộ đồ. */
interface Shell {
  geometry: THREE.BufferGeometry;
  /** Loại vải của từng đỉnh, dùng để tô màu lớp vỏ theo từng bộ trang phục. */
  kind: Uint8Array;
}

const shells = new Map<string, Shell>();
const occludedBodies = new Map<string, THREE.BufferGeometry>();

/** Hàm làm mượt (smoothstep) trong [0, 1]. */
const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/**
 * Độ nhám theo loại vải: jersey cotton/poly mờ, lycra bóng mượt, đế ngoài cao su.
 */
function roughnessForKind(kind: number, wear: WearMode, v: OutfitVariant): number {
  if (wear === 'swim') return 0.36;
  switch (kind) {
    case SOLE:
      return 0.76;
    case SHOE:
      return 0.48;
    case SOCK:
      return 0.88;
    case WAISTBAND:
      return 0.68;
    case TRIM:
    case STRIPE:
      return 0.58;
    case BOTTOM:
      return v.leggings || wear === 'barefoot' ? 0.46 : 0.78;
    default:
      return v.crop ? 0.54 : 0.82;
  }
}

/**
 * Loại vải tại một điểm trên cơ thể ở tư thế nghỉ, hoặc -1 tại vùng da để trần.
 */
function clothAt(
  x: number,
  y: number,
  normalX: number,
  normalZ: number,
  gender: Gender,
  wear: WearMode,
  v: OutfitVariant,
): number {
  const L = LANDMARKS[gender];

  if (wear === 'swim') {
    if (gender === 'male') {
      if (y >= L.jammerHem && y < L.waist) {
        if (y >= L.waist - 0.038) return WAISTBAND;
        if (y < L.jammerHem + 0.02) return TRIM;
        if (x > 0.075 && Math.abs(normalX) > 0.88) return STRIPE;
        return BOTTOM;
      }
      return -1;
    }
    // Đồ bơi thể thao liền thân lưng chữ Y ôm sát cho nữ.
    const hipCut = 0.82 + 0.085 * smooth((x - 0.045) / 0.12);
    const inner = y < L.armpit || x < L.strapOuter;
    if (y >= hipCut && inner) {
      const neckTop =
        normalZ >= 0
          ? 1.365 + 0.082 * smooth((x - 0.038) / 0.088)
          : 1.35 + 0.092 * smooth((0.105 - Math.abs(x - 0.068)) / 0.065);
      const cappedNeck = Math.min(L.neckShoulder, neckTop);
      if (y >= cappedNeck) return -1;
      if (y > cappedNeck - 0.022 || y < hipCut + 0.02) return TRIM;
      if (x > 0.092 && Math.abs(normalX) > 0.84 && y > 0.96 && y < 1.26) return STRIPE;
      return TOP;
    }
    return -1;
  }

  const hasShoes = wear !== 'barefoot';
  if (hasShoes) {
    if (y < L.shoeTop) {
      if (y < L.soleTop) return SOLE;
      if (y > L.shoeTop - 0.015) return WAISTBAND;
      if (
        y > L.shoeTop - 0.032 &&
        Math.abs(x - L.footCenterX) < 0.022 &&
        normalZ > 0.35
      ) {
        return TRIM;
      }
      if (
        y >= L.soleTop + 0.018 &&
        y < L.shoeTop - 0.026 &&
        Math.abs(normalX) > 0.78 &&
        normalZ > -0.075 &&
        normalZ < 0.065
      ) {
        return STRIPE;
      }
      return SHOE;
    }
    if (wear !== 'staff' && y < L.sockTop) {
      return y > L.sockTop - 0.018 ? TRIM : SOCK;
    }
  }

  const isStaff = wear === 'staff';
  const sleeves = isStaff ? true : v.sleeves;
  const crop = isStaff ? false : v.crop;
  const leggings = !isStaff && (v.leggings || wear === 'barefoot');
  const hem = isStaff ? L.shoeTop : leggings ? L.leggingsHem : L.shortsHem;
  const waistTop = crop ? L.waist + 0.068 : L.waist;
  const untuckedDrop = 0.056;
  const topHem = crop ? L.cropHem : L.waist - untuckedDrop;
  const shoulderLimit = sleeves ? L.torsoHalfWidth : L.strapOuter;
  const inner = y < L.armpit || x < shoulderLimit;

  // Đánh giá TOP trước BOTTOM để áo thả ngoài rủ tự nhiên qua cạp quần đùi.
  if (y >= topHem && inner) {
    const neckCurve = L.neckFront + (L.neckShoulder - L.neckFront) * smooth((x - 0.045) / (L.collarX - 0.035));
    if (y >= neckCurve) return -1;
    if (x < L.collarX + 0.014 && y > L.collarLow - 0.005) return TRIM;
    if (isStaff && x < 0.016 && normalZ > 0.55 && y > L.collarLow - 0.11 && y <= L.collarLow) return WAISTBAND;
    if (crop && y < topHem + 0.026) return WAISTBAND;
    if ((v.stripe || isStaff) && y > L.armpit - 0.095 && y < L.armpit - 0.064 && normalZ > 0.25) return STRIPE;
    return TOP;
  }

  if (y >= hem && y < waistTop) {
    if (crop && y >= waistTop - 0.044) return WAISTBAND;
    if (isStaff && y < hem + 0.024) return WAISTBAND;
    if (!isStaff && !leggings && y < hem + 0.024) return TRIM;
    if ((v.stripe || isStaff) && x > 0.065 && Math.abs(normalX) > 0.92) return STRIPE;
    return BOTTOM;
  }

  if (y >= L.armLow && y < L.armHigh && x >= shoulderLimit) {
    if (sleeves && x < L.sleeveEndX) return x > L.sleeveEndX - 0.026 ? TRIM : TOP;
    if (!isStaff && v.wristbands && x >= L.wristStart && x < L.wristEnd) return TRIM;
  }
  return -1;
}

/**
 * Độ dày đệm giữa vải và da (m) kèm độ rủ tự nhiên, gấu áo thả ngoài và cổ tay áo bo ôm.
 */
function standOff(kind: number, y: number, x: number, gender: Gender, wear: WearMode, v: OutfitVariant): number {
  const L = LANDMARKS[gender];
  if (wear === 'swim') {
    return kind === WAISTBAND || kind === TRIM ? 0.0055 : 0.0045;
  }
  const isStaff = wear === 'staff';
  const crop = isStaff ? false : v.crop;
  const leggings = !isStaff && (v.leggings || wear === 'barefoot');
  const shirtHem = L.waist - 0.056;

  switch (kind) {
    case SOLE:
      return 0.017;
    case SHOE:
      return 0.011;
    case SOCK: {
      const cuffTaper = smooth((L.sockTop - y) / 0.016);
      return 0.004 + 0.0025 * cuffTaper;
    }
    case WAISTBAND:
      return 0.0105;
    case BOTTOM:
    case STRIPE:
    case TRIM: {
      if (y < L.sockTop && wear !== 'staff') return 0.0065;
      if (y >= L.armLow && x >= L.strapOuter) {
        // Cổ tay áo hoặc băng cổ tay: viền bo gân với mép ngoài thuôn ôm sát.
        const cuffEdge = x < L.sleeveEndX + 0.02 ? smooth((L.sleeveEndX - x) / 0.022) : 1;
        return 0.0072 + 0.0042 * cuffEdge;
      }
      if (kind === TRIM && y > L.collarLow - 0.008 && x < L.collarX + 0.02) {
        // Viền cổ tròn / cổ polo bo gân nổi.
        const neckLip = smooth((L.neckShoulder + 0.008 - y) / 0.02);
        return 0.0068 + 0.0024 * neckLip;
      }
      if (y >= (crop ? L.cropHem : shirtHem)) {
        const collarTaper = smooth((L.neckShoulder - y) / 0.025);
        return 0.0065 + 0.0118 * smooth((L.armpit - y) / (L.armpit - shirtHem)) * collarTaper;
      }
      if (isStaff) {
        // Quần chinos/quần thể thao ống côn cho nhân viên, nằm gọn dưới gấu áo polo.
        const hipRelax = Math.sin(smooth((y - L.shoeTop) / (shirtHem - L.shoeTop)) * Math.PI * 0.82);
        return 0.0062 + 0.0068 * hipRelax;
      }
      if (leggings) {
        const seatGuard = smooth((y - 0.72) / 0.16);
        return 0.0048 + 0.0014 * smooth((y - L.leggingsHem) / 0.03) + 0.0048 * seatGuard;
      }
      // Quần đùi thể thao cắt gọn: nằm sát dưới gấu áo thả, loe nhẹ về phía đùi với viền gấu cuộn.
      const shortsTop = crop ? L.waist : shirtHem;
      const drape = smooth((shortsTop - y) / (shortsTop - L.shortsHem));
      const hemTaper = 0.78 + 0.22 * smooth((y - L.shortsHem) / 0.018);
      const hemWelt = y < L.shortsHem + 0.024 ? 0.0016 : 0;
      return (0.0064 + 0.0155 * drape) * hemTaper + hemWelt;
    }
    default: {
      if (x >= L.strapOuter && y >= L.armLow) {
        const sleeveTaper = 0.68 + 0.32 * smooth((L.sleeveEndX - x) / 0.026);
        return 0.0112 * sleeveTaper;
      }
      if (crop) {
        return 0.0055 + 0.0028 * smooth((y - L.cropHem) / 0.04);
      }
      const collarTaper = smooth((L.neckShoulder - y) / 0.024);
      const drape = smooth((L.armpit - y) / (L.armpit - shirtHem));
      const hemLip = y < shirtHem + 0.024 ? 0.0018 * smooth((y - shirtHem) / 0.006) : 0;
      return (0.0065 + 0.0122 * drape) * collarTaper + hemLip;
    }
  }
}

/** Một đỉnh góc của tam giác áo: vị trí, pháp tuyến và các ảnh hưởng xương (tối đa bốn) kèm trọng số. */
interface Corner {
  p: THREE.Vector3;
  n: THREE.Vector3;
  /** Tối đa bốn ảnh hưởng xương: chỉ số và trọng số. */
  bones: number[];
  weights: number[];
}

/**
 * Dịch chuyển đỉnh trang phục để tạo khuôn giày thể thao thực tế và ngăn tự xuyên ở đùi trong.
 */
function displaceClothVertex(
  c: Corner,
  kind: number,
  gender: Gender,
  wear: WearMode,
  v: OutfitVariant,
  outPos: THREE.Vector3,
  outNor: THREE.Vector3,
): void {
  const L = LANDMARKS[gender];
  const px = c.p.x;
  const py = c.p.y;
  const pz = c.p.z;
  const ax = Math.abs(px);
  const push = standOff(kind, py, ax, gender, wear, v);

  // Tạo khuôn giày thể thao ôm ngoài ngón chân trần (`y < L.shoeTop` khi có mang giày).
  if (wear !== 'swim' && wear !== 'barefoot' && py < L.shoeTop) {
    const signX = px >= 0 ? 1 : -1;
    const cx = signX * L.footCenterX;
    const dx = px - cx;
    const soleFlare = py < L.soleTop ? 0.015 : 0.0095;
    let sx = px + c.n.x * soleFlare + (dx >= 0 ? 1 : -1) * 0.003;
    if (Math.abs(sx) < 0.055) sx = signX * 0.055;
    const heelCup = py >= L.soleTop && pz < -0.04 ? 0.004 : 0;
    const tonguePuff =
      py >= L.soleTop + 0.012 && pz > 0.005 && pz < 0.095 && Math.abs(dx) < 0.024 ? 0.0045 : 0;
    const sz = pz + c.n.z * (py < L.soleTop ? 0.015 : 0.01) + (pz > 0.02 ? 0.006 : -heelCup) + tonguePuff;

    // Vòm mũi giày mượt nối qua khe giữa các ngón chân thành hộp mũi giày chạy/sân gọn gàng.
    const zNorm = Math.max(0, pz + 0.01) / 0.145;
    const xNorm = dx / 0.062;
    const arch = Math.max(0, 1 - zNorm * zNorm) * Math.max(0, 1 - xNorm * xNorm);
    const vampFloor = py >= L.soleTop ? L.soleTop + 0.035 * Math.sqrt(arch) + tonguePuff * 0.6 : py;
    const sy = Math.max(py + c.n.y * (py < L.soleTop ? 0.006 : 0.009), vampFloor);

    outPos.set(sx, sy, sz);
    outNor
      .set((sx - cx) / 0.065, py < L.soleTop ? 0.08 : 0.52, (sz + 0.01) / 0.15)
      .normalize()
      .lerp(c.n, 0.35)
      .normalize();
    return;
  }

  let nx = c.n.x;
  const ny = c.n.y;
  const nz = c.n.z;

  // Chống tự xuyên đùi trong: giảm lực đẩy theo trục X hướng vào tâm gần đường giữa để quần không vượt qua x = 0.
  if (py >= 0.45 && py < L.waist && ax < 0.09 && px * nx < 0) {
    nx *= smooth((ax - 0.018) / 0.072);
  }

  let ox = px + nx * push;
  const oy = py + ny * push;
  const oz = pz + nz * push;

  // Dưới đường đáy quần (`y < 0.83`), vỏ mỗi ống quần luôn nằm đúng bên của nó so với x = 0.
  if (py >= 0.12 && py < 0.83 && Math.abs(ox) < 0.006) {
    const legSign = px > 1e-4 ? 1 : px < -1e-4 ? -1 : nx >= 0 ? 1 : -1;
    ox = legSign * 0.006;
  }

  outPos.set(ox, oy, oz);
  outNor.copy(c.n);
}

/**
 * Trộn hai đỉnh góc bằng cách lấy trung bình ảnh hưởng xương và giữ lại bốn xương mạnh nhất.
 */
function blend(a: Corner, b: Corner): Corner {
  const influence = new Map<number, number>();
  for (const corner of [a, b]) {
    corner.bones.forEach((bone, i) => influence.set(bone, (influence.get(bone) ?? 0) + corner.weights[i]! * 0.5));
  }
  const top = [...influence.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4);
  const total = top.reduce((sum, [, w]) => sum + w, 0) || 1;
  return {
    p: a.p.clone().add(b.p).multiplyScalar(0.5),
    n: a.n.clone().add(b.n).normalize(),
    bones: top.map(([bone]) => bone),
    weights: top.map(([, w]) => w / total),
  };
}

const MAX_SPLITS = 2;

/**
 * Dựng và cache lớp vỏ đồ thể thao cho một thân nhân vật, kiểu mặc và đường cắt.
 */
function buildShell(
  body: THREE.SkinnedMesh,
  gender: Gender,
  wear: WearMode,
  v: OutfitVariant,
  key: string,
): Shell {
  const cached = shells.get(key);
  if (cached) return cached;

  const source = body.geometry;
  const position = source.getAttribute('position');
  const normal = source.getAttribute('normal');
  const skinIndex = source.getAttribute('skinIndex');
  const skinWeight = source.getAttribute('skinWeight');
  const index = source.getIndex();
  const triangles = index ? index.count / 3 : position.count / 3;
  // Tạo đỉnh góc từ chỉ số đỉnh của mesh thân.
  const corner = (id: number): Corner => ({
    p: new THREE.Vector3(position.getX(id), position.getY(id), position.getZ(id)),
    n: new THREE.Vector3(normal.getX(id), normal.getY(id), normal.getZ(id)),
    bones: [0, 1, 2, 3].map(w => skinIndex.getComponent(id, w)),
    weights: [0, 1, 2, 3].map(w => skinWeight.getComponent(id, w)),
  });
  // Loại vải tại một đỉnh góc.
  const kindAt = (c: Corner) => clothAt(Math.abs(c.p.x), c.p.y, c.n.x, c.n.z, gender, wear, v);

  const outPosition: number[] = [];
  const outNormal: number[] = [];
  const outBones: number[] = [];
  const outWeights: number[] = [];
  const outRoughness: number[] = [];
  const outKind: number[] = [];
  const tmpPos = new THREE.Vector3();
  const tmpNor = new THREE.Vector3();

  // Phát một tam giác (chia nhỏ khi nằm ở biên giữa da và vải).
  const emit = (c0: Corner, c1: Corner, c2: Corner, depth: number) => {
    const centre = blend(blend(c0, c1), c2);
    const kinds = [kindAt(c0), kindAt(c1), kindAt(c2), kindAt(centre)];
    const hasBareEdge = kinds.some(k => k < 0) && kinds.some(k => k >= 0);
    const splitLimit = hasBareEdge ? 3 : MAX_SPLITS;
    if (depth < splitLimit && new Set(kinds).size > 1) {
      const m01 = blend(c0, c1);
      const m12 = blend(c1, c2);
      const m20 = blend(c2, c0);
      emit(c0, m01, m20, depth + 1);
      emit(m01, c1, m12, depth + 1);
      emit(m20, m12, c2, depth + 1);
      emit(m01, m12, m20, depth + 1);
      return;
    }
    const kind = kinds[3]!;
    if (kind < 0) return;
    const rough = roughnessForKind(kind, wear, v);
    for (const c of [c0, c1, c2]) {
      displaceClothVertex(c, kind, gender, wear, v, tmpPos, tmpNor);
      outPosition.push(tmpPos.x, tmpPos.y, tmpPos.z);
      outNormal.push(tmpNor.x, tmpNor.y, tmpNor.z);
      for (let w = 0; w < 4; w++) {
        outBones.push(c.bones[w] ?? 0);
        outWeights.push(c.weights[w] ?? 0);
      }
      outRoughness.push(rough);
      outKind.push(kind);
    }
  };

  for (let t = 0; t < triangles; t++) {
    // Lấy chỉ số đỉnh thứ k của tam giác t.
    const id = (k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k);
    emit(corner(id(0)), corner(id(1)), corner(id(2)), 0);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(outPosition, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(outNormal, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(outBones, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(outWeights, 4));
  geometry.setAttribute('aRoughness', new THREE.Float32BufferAttribute(outRoughness, 1));
  const shell = { geometry, kind: Uint8Array.from(outKind) };
  shells.set(key, shell);
  return shell;
}

/**
 * Sao chép nông hình học thân với index buffer lược bỏ các tam giác nằm sâu hẳn hơn 3 cm bên trong
 * trang phục đục, loại bỏ hiện tượng lộ da/đồ lót khi gập gối, hông hoặc khuỷu tay.
 */
function occludedBodyGeometry(
  source: THREE.BufferGeometry,
  gender: Gender,
  wear: WearMode,
  v: OutfitVariant,
  key: string,
): THREE.BufferGeometry {
  const cached = occludedBodies.get(key);
  if (cached) return cached;

  const index = source.getIndex();
  if (!index) return source;

  const pos = source.getAttribute('position');
  const nor = source.getAttribute('normal');
  const margin = 0.005;
  const covered = new Uint8Array(pos.count);

  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(pos.getX(i));
    const y = pos.getY(i);
    const nx = nor.getX(i);
    const nz = nor.getZ(i);
    if (
      clothAt(ax, y, nx, nz, gender, wear, v) >= 0 &&
      clothAt(ax, y + margin, nx, nz, gender, wear, v) >= 0 &&
      clothAt(ax, Math.max(0, y - margin), nx, nz, gender, wear, v) >= 0 &&
      clothAt(ax + margin, y, nx, nz, gender, wear, v) >= 0 &&
      clothAt(Math.max(0, ax - margin), y, nx, nz, gender, wear, v) >= 0
    ) {
      covered[i] = 1;
    }
  }

  const kept: number[] = [];
  for (let t = 0; t < index.count; t += 3) {
    const i0 = index.getX(t);
    const i1 = index.getX(t + 1);
    const i2 = index.getX(t + 2);
    if (covered[i0] && covered[i1] && covered[i2]) continue;
    kept.push(i0, i1, i2);
  }

  const geometry = new THREE.BufferGeometry();
  for (const name of Object.keys(source.attributes)) {
    geometry.setAttribute(name, source.getAttribute(name));
  }
  geometry.setIndex(kept);
  occludedBodies.set(key, geometry);
  return geometry;
}

const outfitGeometries = new Map<string, THREE.BufferGeometry>();
const jitter = new THREE.Color();

/**
 * Tạo hình học lớp vỏ với bảng màu của bộ trang phục này; dùng chung cho mọi nhân vật mặc cùng bộ.
 */
function outfitGeometry(
  shell: Shell,
  key: string,
  colours: readonly THREE.Color[],
  underHemY: number | null,
): THREE.BufferGeometry {
  const cached = outfitGeometries.get(key);
  if (cached) return cached;
  const geometry = new THREE.BufferGeometry();
  for (const name of Object.keys(shell.geometry.attributes)) {
    geometry.setAttribute(name, shell.geometry.getAttribute(name));
  }
  const pos = shell.geometry.getAttribute('position');
  const normal = shell.geometry.getAttribute('normal');
  const data = new Float32Array(shell.kind.length * 3);
  for (let i = 0; i < shell.kind.length; i++) {
    const k = shell.kind[i]!;
    jitter.copy(colours[k]!);
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const ny = normal.getY(i);
    // Độ rủ vi mô liên tục trong không gian & AO (không tạo bậc cạnh theo từng tam giác).
    const drape = 0.968 + 0.032 * Math.sin(py * 19.0 + Math.cos(px * 14.0) * 1.1 + Math.sin(pz * 15.0) * 0.9);
    const underShade = 1 - 0.11 * smooth((-ny - 0.15) / 0.65);
    const innerLegAo = py > 0.35 && py < 0.95 ? 0.92 + 0.08 * smooth(Math.abs(px) / 0.09) : 1;
    // Bóng tiếp xúc đổ từ gấu áo thả xuống phần trên của quần đùi/quần dài bên dưới.
    const hemAo =
      underHemY !== null && (k === BOTTOM || k === STRIPE) && py > underHemY - 0.042 && py < underHemY + 0.005
        ? 0.82 + 0.18 * smooth((underHemY - py) / 0.042)
        : 1;
    // Viền gai đế ngoài cao su sát mặt đất dọc theo 8 mm dưới cùng của giày thể thao.
    const soleTread = k === SOLE && py < 0.009 ? 0.58 + 0.42 * smooth(py / 0.009) : 1;
    jitter.multiplyScalar(drape * underShade * innerLegAo * hemAo * soleTread);
    data[i * 3] = jitter.r;
    data[i * 3 + 1] = jitter.g;
    data[i * 3 + 2] = jitter.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(data, 3));
  outfitGeometries.set(key, geometry);
  return geometry;
}

const hsl = { h: 0, s: 0, l: 0 };

/**
 * Làm dịu màu đồ thể thao: giữ trắng/ngà sắc nét đồng thời tiết chế các màu cơ bản chói gắt thành tông nhuộm thể thao.
 */
function mute(hex: string): THREE.Color {
  const color = new THREE.Color(hex);
  color.getHSL(hsl);
  const chroma = hsl.s * (1 - Math.abs(2 * hsl.l - 1));
  const maxL = chroma < 0.22 ? 0.89 : 0.74;
  const satScale = chroma < 0.22 ? 0.6 : 0.76;
  return color.setHSL(hsl.h, hsl.s * satScale, Math.min(maxL, Math.max(0.09, hsl.l * 0.95)));
}

/**
 * Bảng màu của một bộ trang phục, đánh chỉ mục theo loại vải.
 */
function outfitColours(palette: ActorOutfitPalette): THREE.Color[] {
  const top = mute(palette.top);
  const bottom = mute(palette.bottom);
  const trim = new THREE.Color(palette.accent);
  trim.getHSL(hsl);
  trim.setHSL(hsl.h, Math.min(0.8, hsl.s), Math.min(0.66, Math.max(0.42, hsl.l)));
  const shoe = mute(palette.shoe);
  const colours: THREE.Color[] = [];
  colours[TOP] = top;
  colours[BOTTOM] = bottom;
  colours[SHOE] = shoe;
  colours[SOLE] = new THREE.Color('#efede6');
  colours[SOCK] = new THREE.Color('#f4f3ee');
  colours[TRIM] = trim;
  colours[WAISTBAND] = bottom.clone().multiplyScalar(0.74);
  colours[STRIPE] = trim;
  return colours;
}

let fabric: THREE.MeshStandardMaterial | undefined;

/**
 * Vật liệu vải thể thao: dệt kim mịn, nếp căng mềm và độ nhám theo từng vùng (`aRoughness`)
 * để áo thun jersey, đồ bó lycra, thân giày da và đế ngoài cao su đổ bóng tách biệt trong một draw call.
 */
function fabricMaterial(): THREE.MeshStandardMaterial {
  if (fabric) return fabric;
  const material = new THREE.MeshStandardMaterial({
    name: 'sol-sportswear',
    vertexColors: true,
    roughness: 0.85,
    metalness: 0,
  });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aRoughness;\nvarying vec3 vFabricPos;\nvarying float vClothRoughness;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFabricPos = position;\nvClothRoughness = aRoughness;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFabricPos;\nvarying float vClothRoughness;')
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(vClothRoughness, 0.25, 0.96);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          // Fine athletic interlock knit (~2.2 mm cells) softened for sleek compression zones.
          float knitWeight = smoothstep(0.38, 0.78, vClothRoughness);
          vec3 k = vFabricPos * 1350.0;
          float rows = sin(k.y) * 0.5 + 0.5;
          float cols = sin(k.x * 1.6 + k.z * 1.6 + floor(k.y / 6.2831) * 3.14159) * 0.5 + 0.5;
          float knit = rows * 0.6 + cols * 0.4;
          // Natural tension folds across torso/waist/shorts.
          vec3 f = vFabricPos * vec3(8.5, 24.0, 8.5);
          float fold = sin(f.y + sin(f.x * 1.7) * 1.35 + sin(f.z * 1.3) * 1.15);
          vec3 bump = vec3(cos(k.x * 1.6) * 0.42, cos(k.y) * 0.68, cos(k.z * 1.6) * 0.42) * (0.042 * knitWeight)
                    + vec3(0.0, cos(f.y + sin(f.x * 1.7) * 1.35) * 0.055, 0.0) * (0.45 + 0.55 * knitWeight);
          normal = normalize(normal + bump);
          diffuseColor.rgb *= (1.0 - 0.055 * knitWeight) + 0.055 * knitWeight * knit + 0.032 * fold;
        }`,
      );
  };
  fabric = material;
  return material;
}

const skinMaterials = new Map<string, THREE.Material>();
/** Tạo (có cache) vật liệu da từ vật liệu gốc, texture sáng và màu da. */
function skinMaterial(source: THREE.Material, key: string, light: THREE.Texture | undefined, tint: THREE.Color): THREE.Material {
  const cached = skinMaterials.get(key);
  if (cached) return cached;
  const material = (source as THREE.MeshStandardMaterial).clone();
  if (light) material.map = light;
  material.color.copy(tint);
  skinMaterials.set(key, material);
  return material;
}

const hairMaterials = new Map<string, THREE.Material>();
/** Tạo (có cache) vật liệu tóc từ vật liệu gốc và màu tóc (hoặc mũ bơi trơn). */
function hairMaterial(source: THREE.Material, key: string, tint: THREE.Color, plain: boolean): THREE.Material {
  const cached = hairMaterials.get(key);
  if (cached) return cached;
  const material = (source as THREE.MeshStandardMaterial).clone();
  if (plain) {
    material.map = null;
    material.normalMap = null;
    material.roughness = 0.32;
  }
  material.color.copy(tint);
  hairMaterials.set(key, material);
  return material;
}

const headbands = new Map<string, THREE.Material>();
const headbandGeometries = new Map<Gender, THREE.BufferGeometry>();

/**
 * Dải băng quanh trán, hiệu chỉnh theo kích thước hộp sọ ở tư thế nghỉ của từng giới.
 */
function headband(gender: Gender, colour: string): THREE.Mesh {
  let geometry = headbandGeometries.get(gender);
  if (!geometry) {
    const L = LANDMARKS[gender];
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          Math.sin(a) * L.headbandRx,
          L.headbandY - Math.cos(a) * 0.011,
          Math.cos(a) * L.headbandRz - 0.005,
        ),
      );
    }
    geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 48, 0.007, 6, true);
    headbandGeometries.set(gender, geometry);
  }
  let material = headbands.get(colour);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.88 });
    headbands.set(colour, material);
  }
  return new THREE.Mesh(geometry, material);
}

const FINGER_CURL: Record<string, readonly number[]> = {
  thumb: [0.22, 0.28, 0.22],
  index: [0.38, 0.52, 0.34],
  middle: [0.44, 0.58, 0.38],
  ring: [0.48, 0.63, 0.43],
  pinky: [0.52, 0.68, 0.48],
};
const curl = new THREE.Quaternion();
const curlAxis = new THREE.Vector3(1, 0, 0);

/**
 * Gập các ngón tay: bộ xương rig đứng ở tư thế chữ T với ngón tay duỗi thẳng trông giống
 * búp bê nhựa. `grip` bằng 1 là bàn tay thả lỏng, khoảng 2 là nắm tay chặt (cầm vợt, tạ đòn, tạ đơn).
 */
export function relaxHands(model: THREE.Object3D, grip: number): void {
  for (const side of ['l', 'r']) {
    for (const [finger, angles] of Object.entries(FINGER_CURL)) {
      angles.forEach((angle, i) => {
        const bone = model.getObjectByName(`${finger}_0${i + 1}_${side}`);
        bone?.quaternion.multiply(curl.setFromAxisAngle(curlAxis, Math.min(angle * grip, 1.55)));
      });
    }
  }
}

/** Sao chép tóc mẫu và tô màu/vật liệu theo màu tóc. */
function paintHairClone(template: THREE.Object3D, keyPrefix: string, tint: THREE.Color, plain: boolean): THREE.Object3D {
  const clone = template.clone();
  clone.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = hairMaterial(mesh.material as THREE.Material, `${keyPrefix}|${tint.getHex()}|${plain}`, tint, plain);
  });
  return clone;
}

/**
 * Mặc trang phục cho nhân vật nhân bản ở tư thế nghỉ trước khi thu phóng: tông da, cắt bỏ
 * vùng da bị che dưới áo, lớp vỏ đồ thể thao, tóc, râu tùy chọn và băng đô. Mọi buffer và
 * vật liệu đều được cache.
 */
export function dressHuman(model: THREE.Object3D, assets: HumanAssets, look: HumanLook): void {
  const { palette, gender, outfit } = look;
  const wear: WearMode = look.wear ?? (look.swimCap ? 'swim' : 'athletic');
  const skin = new THREE.Color(palette.skin);
  skin.getHSL(hsl);
  const light = hsl.l > 0.6;
  const tint = new THREE.Color('#ffffff').lerp(skin, light ? 0.22 : 0.12);

  let body: THREE.SkinnedMesh | undefined;
  model.traverse(object => {
    const mesh = object as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh || !/^superhero/i.test(mesh.name)) return;
    body = mesh;
    mesh.material = skinMaterial(
      mesh.material as THREE.Material,
      `${gender}|${light}|${tint.getHex()}`,
      light ? assets.skinLight[gender] : undefined,
      tint,
    );
  });
  const bodyMesh = body as THREE.SkinnedMesh | undefined;
  if (!bodyMesh?.parent) return;

  const cut = `${gender}|${wear}|${outfit.sleeves}|${outfit.crop}|${outfit.leggings}|${outfit.stripe}|${outfit.wristbands}`;
  const shell = buildShell(bodyMesh, gender, wear, outfit, cut);
  bodyMesh.geometry = occludedBodyGeometry(bodyMesh.geometry, gender, wear, outfit, cut);

  const colours = outfitColours(palette);
  const underHemY =
    wear !== 'swim' && !(wear !== 'staff' && outfit.crop) ? LANDMARKS[gender].waist - 0.056 : null;
  const clothes = new THREE.SkinnedMesh(
    outfitGeometry(
      shell,
      `${cut}|${palette.top}|${palette.bottom}|${palette.shoe}|${palette.accent}`,
      colours,
      underHemY,
    ),
    fabricMaterial(),
  );
  clothes.name = 'sportswear';
  clothes.bind(bodyMesh.skeleton, bodyMesh.bindMatrix);
  bodyMesh.parent.add(clothes);

  // Tóc, râu và băng đô: các mesh tĩnh trong không gian tư thế nghỉ, gắn làm con của xương đầu.
  const head = model.getObjectByName('Head');
  const style = assets.hair[look.hairStyle];
  if (!head || !style) return;
  model.updateMatrixWorld(true);
  const hairTint = look.swimCap
    ? new THREE.Color(palette.hair)
    : new THREE.Color('#ffffff').lerp(new THREE.Color(palette.hair), 0.92);

  const holder = new THREE.Group();
  holder.name = 'hair';
  holder.matrixAutoUpdate = false;
  holder.matrix.copy(head.matrixWorld.clone().invert());
  holder.add(paintHairClone(style, look.hairStyle, hairTint, look.swimCap));

  if (look.beard && gender === 'male' && !look.swimCap && assets.hair['hair-beard']) {
    holder.add(paintHairClone(assets.hair['hair-beard'], 'hair-beard', hairTint, false));
  }
  if (outfit.headband && wear === 'athletic' && !look.swimCap) {
    holder.add(headband(gender, `#${colours[TRIM]!.getHexString()}`));
  }
  head.add(holder);
}
