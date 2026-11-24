import * as THREE from 'three';
import type { PoseOverride } from './humanRetarget';

/**
 * Các tư thế mà góc nghiêng/dạng của `solveHumanPose` không biểu diễn được. Hệ tọa độ: +Y hướng lên,
 * +Z là hướng mặt nhân vật khi yaw = 0, +X là phía bên trái của nhân vật ở tư thế nghỉ.
 */

const HALF_PI = Math.PI / 2;

/** Nằm ngửa, đầu hướng về +Z, mặt ngửa lên trên: Ry(180°) sau Rx(-90°). */
const SUPINE = new THREE.Quaternion().setFromEuler(new THREE.Euler(-HALF_PI, Math.PI, 0, 'YXZ'));
/** Bàn chân đặt phẳng trên sàn với mũi chân hướng ra xa đầu. */
const FEET_AWAY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

/** Nội suy tuyến tính giữa a và b theo t. */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Vector hướng chuẩn hóa từ ba thành phần. */
const dir = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize();
/** Quaternion xoay quanh trục X một góc x. */
const tilt = (x: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), x);

/**
 * Tư thế đẩy tạ trên ghế nghiêng điều chỉnh của SÖL (tựa lưng 26.4°, mặt ghế ở y = 0.50 m):
 * xương chậu đặt sát khe ghế, cột sống tựa lên phần đệm lưng, đầu gối co với giày đặt phẳng
 * trên sàn và cẳng tay đẩy thanh tạ thẳng đứng phía trên ngực trên.
 */
export function benchPress(phase: number): PoseOverride {
  const rise = 0.5 - 0.5 * Math.cos(phase); // 0 = thanh tạ gần ngực trên, 1 = duỗi tay khóa khớp có kiểm soát
  const flare = lerp(1.68, 0.44, rise);
  const forearm = 0.44 * rise;
  // Sau phép xoay nằm ngửa, phía bên trái của nhân vật (+X ở tư thế nghỉ) hướng về -X.
  // Hướng cánh tay theo bên trái/phải và độ dạng tay.
  const arm = (side: -1 | 1) => dir(side * Math.sin(flare), Math.cos(flare), -0.18);
  // Hướng cẳng tay theo bên trái/phải và độ duỗi.
  const fore = (side: -1 | 1) => dir(side * Math.sin(forearm), Math.cos(forearm), -0.1);
  return {
    hipsPosition: [0, 0.07, -0.22],
    rotations: {
      Hips: SUPINE,
      Spine: tilt(-0.2),
      Spine1: tilt(-0.15),
      Spine2: tilt(-0.11),
    },
    aims: {
      LeftArm: arm(-1),
      LeftForeArm: fore(-1),
      RightArm: arm(1),
      RightForeArm: fore(1),
      // Đùi dạng ra trên đệm ghế và cẳng chân đặt gọn xuống sàn gym.
      LeftUpLeg: dir(-0.32, -0.13, -0.94),
      LeftLeg: dir(-0.1, -0.97, -0.22),
      RightUpLeg: dir(0.32, -0.13, -0.94),
      RightLeg: dir(0.1, -0.97, -0.22),
    },
    footTurn: FEET_AWAY,
  };
}
