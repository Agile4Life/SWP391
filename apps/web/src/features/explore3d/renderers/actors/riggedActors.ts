import { useSyncExternalStore } from 'react';
import type { SceneDoc, Vec3 } from '../../scene/schema';
import type { RiggedHandPropSpec } from './riggedHandProps';
import type { LevelMode } from '../../state/exploreStore';
import {
  getActorWorldAnchor,
  solveHumanPose,
  type ActorActivityKind,
  type HumanPoseAngles,
  type LiveActorDefinition,
} from './liveActorsConfig';
import { benchPress } from './humanPoses';
import type { PoseOverride } from './humanRetarget';

/**
 * Hoạt ảnh thu chuyển động (mocap) do AnimationMixer phát: tên clip (hoặc chọn theo nhân vật), hệ số tốc độ và
 * chuỗi clip kết hợp.
 */
export interface RiggedClipSpec {
  /** Tên clip hoạt ảnh, hoặc hàm chọn clip theo từng nhân vật (ví dụ jab hoặc cross). */
  clip: string | ((actorId: string) => string);
  /** Hệ số nhân với tốc độ riêng của nhân vật. */
  timeScale: number;
  /** Chuỗi combo tùy chọn được chuyển mượt (crossfade) qua các nhịp (ví dụ tổ hợp đấm jab-cross). */
  comboClips?: readonly string[];
  /** Trang bị găng đấm bốc có đệm ở cả hai tay. */
  glovesInHands?: boolean;
}

/**
 * Bộ xương được điều khiển mỗi khung hình từ góc tư thế của hoạt động (`solveHumanPose`): khóa chân xuống đất, độ
 * cao hông và vật cầm tay.
 */
export interface RiggedPoseSpec {
  /** Giữ bàn chân thấp hơn chạm đất bằng cách dời hông; tắt đối với các tư thế ngồi. */
  groundLock: boolean;
  /** Độ cao hông tính bằng mét khi `groundLock` tắt (ví dụ ngồi trên xe đạp). */
  hipsHeight?: number;
  /** Vật cầm tay gắn vào xương bàn tay; thay thế vật thể dựng bằng mã của cùng hoạt động. */
  handProp?: RiggedHandPropSpec;
  /** Độ xoắn của bàn tay quanh cẳng tay (radian), giá trị tĩnh hoặc theo pha (ví dụ xoay cổ tay khi cuốn tạ, úp cổ tay tạo xoáy topspin). */
  forearmRoll?:
    | Partial<Record<'left' | 'right', number>>
    | ((
        phase: number,
        actor?: LiveActorDefinition,
        timeSec?: number,
      ) => Partial<Record<'left' | 'right', number>>);
  /** Vẽ thanh đòn tạ cầm giữa hai bàn tay. */
  barbellInHands?: boolean;
  /** Đặt một quả tạ tay vào mỗi bàn tay. */
  dumbbellsInHands?: boolean;
  /** Tư thế mà các góc không diễn tả được (như nằm); nhận vào pha chuyển động của nhân vật. */
  override?: (phase: number) => PoseOverride;
}

/** Pha chuyển động giống bộ giải thủ tục để hai bản nhân vật luôn khớp nhịp nhau. */
export function getActorPhase(actor: LiveActorDefinition, timeSec: number): number {
  return timeSec * actor.speed * 3.2 + actor.phaseOffset;
}

/** Mã băm chuỗi ổn định (dùng để chọn biến thể theo nhân vật). */
export function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Chọn giữa hai clip theo mã băm của nhân vật (chẵn chọn a, lẻ chọn b). */
const pick = (a: string, b: string) => (actorId: string) => (hashString(actorId) % 2 === 0 ? a : b);

/** Dữ liệu motion capture từ Universal Animation Library (tên clip giống trong `human-animations.glb`). */
export const HUMAN_CLIP_ACTIVITIES: Partial<Record<ActorActivityKind, RiggedClipSpec>> = {
  'treadmill-run': { clip: 'Jog_Fwd_Loop', timeScale: 1 },
  'walking-patrol': { clip: 'Walk_Loop', timeScale: 1 },
  'lounge-chat': {
    clip: id => (id.endsWith('member-1') ? 'Sitting_Talking_Loop' : 'Idle_Talking_Loop'),
    timeScale: 0.85,
  },
  'boxing-spar': {
    clip: pick('Punch_Jab', 'Punch_Cross'),
    comboClips: ['Punch_Jab', 'Punch_Cross', 'Punch_Jab'],
    glovesInHands: true,
    timeScale: 1,
  },
  'heavy-bag-boxer': {
    clip: pick('Punch_Cross', 'Punch_Jab'),
    comboClips: ['Punch_Cross', 'Punch_Jab', 'Punch_Cross'],
    glovesInHands: true,
    timeScale: 1,
  },
  'swim-freestyle': { clip: 'Swim_Fwd_Loop', timeScale: 1 },
};

/**
 * Cây vợt cầm ở tay bên phải của hình dựng bằng mã (+X, tương ứng tay trái `hand_l` của bộ xương),
 * cán hướng theo trục nắm và hơi nghiêng về phía ngọn.
 */
const RACKET = {
  kind: 'racket',
  bone: 'hand_l',
  position: [0.032, 0.08, 0.02],
  // Cán vợt nhô ra theo trục nắm ngón cái/trỏ (+Z của `hand_l`) nghiêng 20° ra phía ngọn (+Y), mặt vợt song song lòng bàn tay (+X).
  rotation: [-Math.PI / 2 - 0.35, 0, 0],
} as const;

/**
 * Các hoạt động có bộ xương đi theo cùng góc tư thế với hình dựng bằng mã, nên chuyển động
 * đúng nhịp và quỹ đạo mà không cần clip motion capture.
 */
export const HUMAN_POSE_ACTIVITIES: Partial<Record<ActorActivityKind, RiggedPoseSpec>> = {
  'upright-bike': { groundLock: false, hipsHeight: 0.93 },
  'elliptical-stride': { groundLock: true },
  'inbody-scan': { groundLock: true },
  'receptionist-greet': { groundLock: true },
  'yoga-flow': { groundLock: true },
  'barbell-squat': { groundLock: true, barbellInHands: true },
  'bench-press': { groundLock: false, barbellInHands: true, override: benchPress },
  'dumbbell-curl': {
    groundLock: true,
    dumbbellsInHands: true,
    forearmRoll: phase => ({
      left: (0.5 - 0.5 * Math.cos(phase * 1.2)) * 1.45,
      right: -(0.5 - 0.5 * Math.cos(phase * 1.2 + Math.PI)) * 1.45,
    }),
  },
  'badminton-player': { groundLock: true, handProp: { ...RACKET, size: 1.08 } },
  'tennis-player': {
    groundLock: true,
    handProp: { ...RACKET, size: 1.24 },
    // Xoay cẳng tay theo pha (đánh thuận tay và trái tay luân phiên).
    forearmRoll: (phase, actor, timeSec) => {
      const c =
        actor && timeSec !== undefined
          ? (((timeSec * actor.speed * 0.55 + actor.phaseOffset / Math.PI) % 4) + 4) % 4
          : (((phase * (0.55 / 3.2)) % 4) + 4) % 4;
      const dFh = c > 2 ? c - 4 : c;
      const dBh = c - 2;
      if (Math.abs(dFh) < 0.52) {
        // Thuận tay: hạ cổ tay (-0.75) -> đánh ngang tầm eo (-0.38 tại dFh=0) -> vẩy gạt nước tạo xoáy topspin (+0.85)
        if (dFh <= 0) {
          const u = (dFh + 0.52) / 0.52;
          return { right: -0.75 + 0.37 * Math.sin(u * Math.PI * 0.5) };
        }
        const u = dFh / 0.52;
        return { right: -0.38 + 1.23 * (u * u * (3 - 2 * u)) };
      }
      if (Math.abs(dBh) < 0.52) {
        // Trái tay: vươn qua phía trái (+0.42 tại dBh=0) -> mở cao qua vai phải (-0.65)
        if (dBh <= 0) {
          const u = (dBh + 0.52) / 0.52;
          return { right: 0.65 - 0.23 * Math.sin(u * Math.PI * 0.5), left: -0.35 };
        }
        const u = dBh / 0.52;
        return { right: 0.42 - 1.07 * (u * u * (3 - 2 * u)), left: -0.2 };
      }
      return { right: -0.35, left: 0.25 };
    },
  },
  'pt-coach-tablet': {
    groundLock: true,
    // Ngửa lòng bàn tay để máy tính bảng nằm phẳng trên `hand_r` (pháp tuyến lòng bàn tay -X lật lên) và nghiêng về phía HLV.
    forearmRoll: { left: Math.PI },
    handProp: {
      kind: 'tablet',
      bone: 'hand_r',
      position: [-0.03, 0.095, 0.01],
      rotation: [0, 0, Math.PI / 2 - 0.25],
      size: 1.15,
    },
  },
};

/** Đường dẫn các file nhân vật Quaternius đã đóng gói trong `public/models/explore3d/humans/` (xem `scripts/build-human-assets.py`). */
export const HUMAN_ASSET_URLS = {
  male: '/models/explore3d/humans/human-male.glb',
  female: '/models/explore3d/humans/human-female.glb',
  animations: '/models/explore3d/humans/human-animations.glb',
  skinLight: {
    male: '/models/explore3d/humans/skin-male-light.jpg',
    female: '/models/explore3d/humans/skin-female-light.jpg',
  },
  hair: {
    'hair-simpleparted': '/models/explore3d/humans/hair-simpleparted.glb',
    'hair-buzzed': '/models/explore3d/humans/hair-buzzed.glb',
    'hair-beard': '/models/explore3d/humans/hair-beard.glb',
    'hair-long': '/models/explore3d/humans/hair-long.glb',
    'hair-buns': '/models/explore3d/humans/hair-buns.glb',
    'hair-buzzedfemale': '/models/explore3d/humans/hair-buzzedfemale.glb',
  },
} as const;

/** Chiều cao đứng ngoài đời thực mà các nhân vật được quy đổi theo tỉ lệ, tính bằng mét. */
export const HUMAN_HEIGHT = 1.76;

/** Các xương bàn tay của bộ xương. */
export const HUMAN_HAND_BONES = ['hand_l', 'hand_r'] as const;

/** Các phần dựng bằng mã được nhân vật có xương thay thế bằng thanh tạ đòn cầm trên tay. */
export const PROCEDURAL_BARBELL_PART_NAMES: ReadonlySet<string> = new Set([
  'barbellShaft',
  'barbellPlateLeft',
  'barbellPlateRight',
]);

/** Các vật cầm tay dựng bằng mã được nhân vật có xương thay thế bằng vật gắn trực tiếp vào xương. */
export const PROCEDURAL_HAND_PROP_NAMES: ReadonlySet<string> = new Set([
  'racketShaft',
  'racketHead',
  'coachTablet',
  'dumbbellLeft',
  'dumbbellRight',
]);

/** Các phần dựng bằng mã tạo nên cơ thể người; không bao gồm đạo cụ. */
export const PROCEDURAL_BODY_PART_NAMES: ReadonlySet<string> = new Set([
  'torso',
  'hips',
  'head',
  'hair',
  'leftUpperArm',
  'leftForearm',
  'rightUpperArm',
  'rightForearm',
  'leftThigh',
  'leftShin',
  'rightThigh',
  'rightShin',
]);

/** Chuyển động của nhân vật có xương: phát clip hoặc giải tư thế theo góc. */
export type RiggedMotion =
  | { kind: 'clip'; spec: RiggedClipSpec }
  | { kind: 'pose'; spec: RiggedPoseSpec };

/** Lấy chuyển động của một hoạt động (clip hoặc tư thế); không có thì null. */
export function getRiggedMotion(activity: ActorActivityKind): RiggedMotion | null {
  const clip = HUMAN_CLIP_ACTIVITIES[activity];
  if (clip) return { kind: 'clip', spec: clip };
  const pose = HUMAN_POSE_ACTIVITIES[activity];
  return pose ? { kind: 'pose', spec: pose } : null;
}

/** Hoạt động có dùng nhân vật có xương không. */
export function isRiggedActivity(activity: ActorActivityKind): boolean {
  return getRiggedMotion(activity) !== null;
}

/** Vị trí, hướng và góc tư thế của nhân vật có xương. */
export interface RiggedPlacement {
  position: Vec3;
  yaw: number;
  pose: HumanPoseAngles;
}

/**
 * Vị trí đứng, hướng nhìn và góc tư thế của nhân vật có xương tại `timeSec`, theo cùng đường đi, độ đung đưa và
 * hướng như bản dựng bằng mã mà nó thay thế.
 */
export function computeRiggedPlacement(
  def: LiveActorDefinition,
  scene: SceneDoc,
  levelMode: LevelMode,
  timeSec: number,
): RiggedPlacement {
  const anchor = getActorWorldAnchor(def, scene, levelMode);
  const { pose, worldPos, yaw } = solveHumanPose(def, timeSec, anchor);
  // Clip mocap đã có sẵn chuyển động dời trọng tâm xương chậu và bước chân; cộng thêm độ lệch thủ tục sẽ gây trượt chân.
  if (def.activity in HUMAN_CLIP_ACTIVITIES) {
    return { position: worldPos, yaw, pose };
  }
  const total = yaw + pose.yawOffset;
  const cos = Math.cos(total);
  const sin = Math.sin(total);
  const lx = pose.rootOffset[0];
  const lz = pose.rootOffset[2];
  return {
    position: [worldPos[0] + lx * cos + lz * sin, worldPos[1], worldPos[2] - lx * sin + lz * cos],
    yaw: total,
    pose,
  };
}

// --- Danh bạ các nhân vật hiện đang vẽ dưới dạng nhân vật có xương -------------
// Instanced mesh dựng bằng mã sẽ ẩn các bộ phận của những nhân vật này; nhân vật chỉ
// được đưa vào đây sau khi mô hình đã tải xong, nên nếu tải lỗi sẽ giữ nguyên bản thủ tục.

let riggedActorIds: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

/** Đặt tập id các nhân vật đang dùng bản có xương và báo cho các listener. */
export function setRiggedActorIds(ids: Iterable<string>): void {
  riggedActorIds = new Set(ids);
  for (const listener of listeners) listener();
}

/** Lấy tập id các nhân vật đang dùng bản có xương. */
export function getRiggedActorIds(): ReadonlySet<string> {
  return riggedActorIds;
}

/** Đăng ký listener nhận thay đổi tập nhân vật có xương; trả về hàm hủy. */
export function subscribeRiggedActors(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Hook React đọc tập id nhân vật có xương và tự render lại khi đổi. */
export function useRiggedActorIds(): ReadonlySet<string> {
  return useSyncExternalStore(subscribeRiggedActors, getRiggedActorIds, getRiggedActorIds);
}
