import * as THREE from 'three';
import type { ItemKind } from '../../scene/schema';
import type { GymBuilderHelpers } from './gymBuilders';

/** Viết tắt cho THREE.BufferGeometry. */
type Geo = THREE.BufferGeometry;

/**
 * Tạo các hàm dựng nội thất sảnh, dịch vụ, spa và lối đi thực tế. Diện tích chiếm chỗ và hướng
 * mặt trước của mỗi món khớp với các phiên bản dựng bằng hộp trước đó; kết cấu tuân theo mộc và
 * phụ kiện thật: chân đế có khe bóng, gỗ ốp nan dọc, mặt đá đánh bóng, phụ kiện thép xước,
 * tấm kính và đệm bọc vải. Màu hồng salmon thương hiệu chỉ dùng làm điểm nhấn mảnh, không tô thành mảng khối lớn.
 */
export function createInteriorBuilders(h: GymBuilderHelpers): Partial<Record<ItemKind, () => Geo>> {
  const { P, dims, box, cyl, sphere, roundedBox: rbox, tube, disc, shape, surface, fit } = h;

  const stone = surface('#cdc9c1', 0.22, 0);
  const plinth = surface('#0d0d0e', 0.7, 0);
  const white = surface('#ecebe6', 0.28, 0);
  const fabric = surface('#58544e', 0.92, 0);
  const fabricWarm = surface('#86594a', 0.92, 0);
  const woodDark = surface('#6a4a37', 0.5, 0);
  const cork = surface('#b08d63', 0.85, 0);
  const brass = surface('#b3935a', 0.28, 1);
  const rocks = surface('#57534e', 0.95, 0);
  const tile = surface('#e4e2dc', 0.18, 0);
  const rubber = surface('#0f0f11', 0.9, 0);
  const steel = P.metal;
  const chrome = P.metalLight;
  const body = P.charcoal;
  const panel = P.charcoalSoft;
  const glass = P.glass;
  const PI2 = Math.PI / 2;

  /** Màn hình phẳng trên chân đế nhỏ, hướng +Z, ngả ra sau một góc `tilt`. */
  const monitor = (x: number, y: number, z: number, w = 0.5, hh = 0.3, tilt = -0.12, ry = 0): Geo[] => [
    disc(0.09, 0.012, steel, [x, y + 0.006, z], 'y', 16),
    cyl(0.012, 0.012, hh * 0.6, steel, [x, y + hh * 0.3, z], undefined, 8),
    rbox(w, hh, 0.022, 0.008, plinth, [x, y + hh * 0.75, z + 0.01], [tilt, ry, 0]),
    box(w - 0.03, hh - 0.03, 0.004, P.screen, [x, y + hh * 0.75, z + 0.023], [tilt, ry, 0]),
  ];

  /** Hàng nan gỗ đứng dọc theo trục X trên nền tối. */
  const battens = (width: number, height: number, y: number, z: number, color: string, pitch = 0.11): Geo[] => {
    const parts: Geo[] = [box(width, height, 0.02, plinth, [0, y, z - 0.02])];
    const n = Math.floor(width / pitch);
    for (let i = 0; i < n; i++) {
      parts.push(box(pitch * 0.55, height, 0.035, color, [-width / 2 + pitch * (i + 0.5), y, z]));
    }
    return parts;
  };

  /** Quầy lễ tân: chân đế lõm, thân, mặt trước ốp nan gỗ và mặt đá. */
  const buildReceptionDesk = (): Geo =>
    fit(
      [
        // chân đế lõm, thân quầy, mặt trước ốp nan gỗ
        box(5.1, 0.1, 1.3, plinth, [0, 0.05, 0]),
        rbox(5.3, 0.9, 1.44, 0.03, body, [0, 0.56, 0]),
        ...battens(5.2, 0.84, 0.56, 0.745, P.wood),
        // dải LED hắt khe sáng dưới mặt quầy giao dịch
        box(5.3, 0.012, 0.02, P.salmonBright, [0, 1.035, 0.76]),
        // mặt quầy giao dịch bằng đá đánh bóng và mặt bàn làm việc thấp hơn
        rbox(5.4, 0.06, 0.62, 0.02, stone, [0, 1.09, 0.48]),
        box(5.2, 0.03, 0.8, woodDark, [0, 1.0, -0.24]),
        ...monitor(-1.2, 1.015, -0.3),
        ...monitor(1.2, 1.015, -0.3),
        rbox(0.4, 0.015, 0.13, 0.005, plinth, [-1.2, 1.022, -0.02]),
        rbox(0.4, 0.015, 0.13, 0.005, plinth, [1.2, 1.022, -0.02]),
        // đầu đọc thẻ, chuông bàn và kệ tờ rơi trên mặt quầy
        rbox(0.09, 0.04, 0.16, 0.012, plinth, [0.3, 1.14, 0.5], [-0.3, 0, 0]),
        disc(0.035, 0.03, brass, [-0.4, 1.135, 0.52], 'y', 16),
        box(0.22, 0.26, 0.012, glass, [2.1, 1.25, 0.5], [-0.2, 0, 0]),
      ],
      dims['reception-desk'],
    );

  /** Cổng soát vé QR (turnstile): trụ hai bên, cánh chắn và đầu đọc. */
  const buildQrTurnstile = (): Geo =>
    fit(
      [
        ...[-1, 1].flatMap(s => [
          // trụ thép không gỉ với mảng ốp tối hai bên và nắp trên
          rbox(0.22, 0.96, 1.5, 0.06, steel, [s * 0.48, 0.48, 0]),
          box(0.224, 0.6, 1.1, plinth, [s * 0.48, 0.5, 0]),
          rbox(0.24, 0.03, 1.54, 0.012, chrome, [s * 0.48, 0.975, 0]),
          // trụ bản lề và cánh kính không khung
          cyl(0.022, 0.022, 0.8, chrome, [s * 0.36, 0.52, 0], undefined, 12),
          rbox(0.33, 0.74, 0.014, 0.006, glass, [s * 0.185, 0.54, 0]),
          // thanh đèn trạng thái ở mặt lối vào
          box(0.02, 0.5, 0.012, s > 0 ? P.salmonBright : P.screenGlow, [s * 0.48, 0.55, 0.757]),
        ]),
        // cửa sổ đầu đọc QR / thẻ đặt trên nắp trụ bên phải
        rbox(0.16, 0.014, 0.22, 0.006, plinth, [0.48, 0.997, 0.5]),
        box(0.1, 0.004, 0.1, P.screenGlow, [0.48, 1.006, 0.5]),
        rbox(0.16, 0.014, 0.22, 0.006, plinth, [-0.48, 0.997, 0.5]),
      ],
      dims['qr-turnstile'],
    );

  /** Máy check-in tự phục vụ (kiosk): đế, thân, màn hình và đầu quét. */
  const buildKioskCheckin = (): Geo =>
    fit(
      [
        rbox(0.6, 0.03, 0.5, 0.012, steel, [0, 0.015, 0]),
        rbox(0.3, 0.98, 0.1, 0.03, body, [0, 0.52, -0.06], [-0.1, 0, 0]),
        // đầu màn hình cảm ứng nghiêng
        rbox(0.58, 0.78, 0.055, 0.025, plinth, [0, 1.14, 0.0], [-0.22, 0, 0]),
        box(0.5, 0.62, 0.004, P.screen, [0, 1.165, 0.034], [-0.22, 0, 0]),
        disc(0.012, 0.006, glass, [0, 1.49, -0.045], 'z', 10),
        // khay đầu đọc gồm khe quét thẻ và khe ra hóa đơn
        rbox(0.3, 0.05, 0.14, 0.015, panel, [0, 0.72, 0.1], [-0.35, 0, 0]),
        box(0.12, 0.006, 0.02, plinth, [0, 0.745, 0.115], [-0.35, 0, 0]),
        box(0.5, 0.008, 0.012, P.salmon, [0, 0.79, 0.1], [-0.22, 0, 0]),
      ],
      dims['kiosk-checkin'],
    );

  /** Máy in thẻ hội viên: thân máy, khay và màn hình. */
  const buildCardPrinter = (): Geo =>
    fit(
      [
        box(1.0, 0.08, 0.66, plinth, [0, 0.04, 0]),
        rbox(1.06, 0.74, 0.74, 0.02, body, [0, 0.45, 0]),
        // hai cánh tủ gỗ có khe bóng và tay nắm dạng thanh
        box(0.5, 0.68, 0.02, P.wood, [-0.262, 0.45, 0.372]),
        box(0.5, 0.68, 0.02, P.wood, [0.262, 0.45, 0.372]),
        cyl(0.008, 0.008, 0.2, chrome, [-0.05, 0.5, 0.395], undefined, 8),
        cyl(0.008, 0.008, 0.2, chrome, [0.05, 0.5, 0.395], undefined, 8),
        rbox(1.1, 0.04, 0.78, 0.012, stone, [0, 0.84, 0]),
        // máy in thẻ có phễu nạp phôi, khe trả thẻ và đèn trạng thái
        rbox(0.36, 0.24, 0.42, 0.04, white, [-0.24, 0.98, 0]),
        rbox(0.2, 0.1, 0.16, 0.02, plinth, [-0.24, 1.13, -0.08]),
        box(0.2, 0.012, 0.02, plinth, [-0.24, 0.94, 0.212]),
        box(0.2, 0.01, 0.12, panel, [-0.24, 0.905, 0.26]),
        disc(0.01, 0.006, P.screenGlow, [-0.1, 1.04, 0.212], 'z', 8),
        ...monitor(0.26, 0.86, -0.08, 0.42, 0.3, -0.15, -0.2),
        rbox(0.14, 0.03, 0.2, 0.01, plinth, [0.24, 0.875, 0.2]),
      ],
      dims['card-printer'],
    );

  /** Kệ trưng bày thực phẩm bổ sung: chân đế, vách sau, vách bên, tiêu đề và các tầng kệ. */
  const buildSupplementShelf = (): Geo => {
    const parts: Geo[] = [
      // kệ trưng bày: chân đế, vách hậu, hai vách đầu hồi, bảng tiêu đề
      box(1.9, 0.12, 0.66, plinth, [0, 0.06, 0]),
      box(1.96, 2.0, 0.03, panel, [0, 1.06, -0.33]),
      box(0.03, 2.0, 0.6, body, [-0.965, 1.06, -0.04]),
      box(0.03, 2.0, 0.6, body, [0.965, 1.06, -0.04]),
      rbox(1.96, 0.18, 0.1, 0.02, body, [0, 1.99, 0.2]),
      box(1.2, 0.07, 0.006, P.salmonBright, [0, 1.99, 0.253]),
    ];
    const shelfYs = [0.14, 0.6, 1.07, 1.53];
    shelfYs.forEach((y, s) => {
      parts.push(box(1.9, 0.025, 0.58, white, [0, y, -0.03]));
      parts.push(box(1.9, 0.035, 0.008, plinth, [0, y, 0.262]));
      for (let c = 0; c < 6; c++) {
        const x = -0.78 + c * 0.312;
        const r = s === 0 ? 0.105 : 0.085;
        const hgt = s === 0 ? 0.3 : 0.24;
        const tone = (s + c) % 3 === 0 ? plinth : (s + c) % 3 === 1 ? white : woodDark;
        parts.push(cyl(r, r, hgt, tone, [x, y + 0.012 + hgt / 2, 0.02], undefined, 16));
        parts.push(cyl(r * 0.96, r * 0.96, 0.035, (s + c) % 2 === 0 ? P.salmon : plinth, [x, y + 0.03 + hgt, 0.02], undefined, 16));
        parts.push(cyl(r + 0.002, r + 0.002, hgt * 0.45, (s + c) % 2 === 0 ? white : P.salmonBright, [x, y + 0.012 + hgt * 0.5, 0.02], undefined, 16));
      }
    });
    return fit(parts, dims['supplement-shelf']);
  };

  /** Bảng dinh dưỡng: hai trụ và bảng hiển thị. */
  const buildNutritionBoard = (): Geo =>
    fit(
      [
        ...[-0.96, 0.96].flatMap(x => [
          rbox(0.14, 0.03, 0.46, 0.01, steel, [x, 0.015, 0]),
          cyl(0.03, 0.03, 1.86, steel, [x, 0.95, 0], undefined, 12),
        ]),
        // bảng thực đơn bề mặt lì đóng khung có các dòng chữ in
        rbox(2.2, 1.34, 0.05, 0.015, woodDark, [0, 1.18, 0]),
        box(2.08, 1.22, 0.01, plinth, [0, 1.18, 0.026]),
        box(1.2, 0.1, 0.004, white, [-0.38, 1.66, 0.033]),
        box(1.9, 0.006, 0.004, P.salmon, [0, 1.56, 0.033]),
        ...[1.42, 1.26, 1.1, 0.94, 0.78].flatMap((y, i) => [
          box(0.9 + ((i * 37) % 5) * 0.08, 0.035, 0.004, white, [-0.5 + ((i * 37) % 5) * 0.04, y, 0.033]),
          box(0.22, 0.035, 0.004, P.salmonBright, [0.82, y, 0.033]),
        ]),
      ],
      dims['nutrition-board'],
    );

  /** Trụ trưng bày cúp: đế đá, thân và các ngăn kính. */
  const buildTrophyTotem = (): Geo => {
    const parts: Geo[] = [
      rbox(0.96, 0.16, 0.56, 0.02, stone, [0, 0.08, 0]),
      rbox(0.74, 1.7, 0.3, 0.03, body, [0, 1.02, 0]),
      // các ô thành tích âm tường có đèn nền
      box(0.62, 1.2, 0.004, plinth, [0, 0.98, 0.1505]),
      disc(0.21, 0.05, brass, [0, 1.96, 0], 'z', 32),
      disc(0.16, 0.056, body, [0, 1.96, 0], 'z', 32),
    ];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        parts.push(
          box(0.16, 0.22, 0.004, (r + c) % 2 === 0 ? P.salmonBright : P.salmon, [-0.19 + c * 0.19, 0.56 + r * 0.28, 0.152]),
        );
      }
    }
    return fit(parts, dims['trophy-totem']);
  };

  /** Bục HLV: bệ, mặt và phần trang trí. */
  const buildCoachPodium = (): Geo =>
    fit(
      [
        box(1.26, 0.08, 0.84, plinth, [0, 0.04, 0]),
        rbox(1.24, 0.94, 0.68, 0.025, body, [0, 0.55, 0]),
        ...battens(1.14, 0.84, 0.55, 0.352, P.wood, 0.095),
        // mặt đọc nghiêng có gờ chặn phía trước
        rbox(1.36, 0.04, 0.82, 0.012, stone, [0, 1.06, 0], [0.16, 0, 0]),
        box(1.36, 0.03, 0.02, steel, [0, 1.015, 0.405]),
        // hai máy tính bảng đặt trên mặt nghiêng
        rbox(0.4, 0.26, 0.014, 0.008, plinth, [-0.28, 1.1, -0.05], [0.16 - PI2, 0, 0]),
        box(0.36, 0.22, 0.003, P.screen, [-0.28, 1.109, -0.048], [0.16 - PI2, 0, 0]),
        rbox(0.4, 0.26, 0.014, 0.008, plinth, [0.28, 1.1, -0.05], [0.16 - PI2, 0, 0]),
        box(0.36, 0.22, 0.003, P.screenGlow, [0.28, 1.109, -0.048], [0.16 - PI2, 0, 0]),
      ],
      dims['coach-podium'],
    );

  /** Phòng tư vấn (pod): bàn và hai ghế bọc vải ôm lưng. */
  const buildConsultationPod = (): Geo => {
    // Ghế bọc: chân thép mảnh, đệm ngồi và lưng ôm (s là bên trái/phải).
    const chair = (s: number): Geo[] => [
      ...[-0.22, 0.22].flatMap(z => [
        cyl(0.012, 0.012, 0.24, steel, [s * 0.5, 0.12, z], undefined, 8),
        cyl(0.012, 0.012, 0.24, steel, [s * 0.86, 0.12, z], undefined, 8),
      ]),
      rbox(0.52, 0.16, 0.56, 0.06, fabric, [s * 0.68, 0.32, 0]),
      rbox(0.14, 0.44, 0.56, 0.06, fabricWarm, [s * 0.9, 0.6, 0], [0, 0, s * 0.12]),
      rbox(0.4, 0.2, 0.08, 0.035, fabricWarm, [s * 0.74, 0.5, -0.27]),
      rbox(0.4, 0.2, 0.08, 0.035, fabricWarm, [s * 0.74, 0.5, 0.27]),
    ];
    return fit(
      [
        disc(0.3, 0.02, steel, [0, 0.01, 0], 'y', 28),
        cyl(0.035, 0.045, 0.7, steel, [0, 0.37, 0], undefined, 14),
        disc(0.44, 0.035, P.wood, [0, 0.74, 0], 'y', 36),
        disc(0.445, 0.012, plinth, [0, 0.722, 0], 'y', 36),
        rbox(0.26, 0.012, 0.19, 0.006, plinth, [0, 0.764, 0.02]),
        box(0.23, 0.003, 0.16, P.screen, [0, 0.771, 0.02]),
        ...chair(-1),
        ...chair(1),
      ],
      dims['consultation-pod'],
    );
  };

  /** Tủ khóa: đế, thân tủ, cánh tủ và tay khóa. */
  const buildLockerBank = (): Geo => {
    const parts: Geo[] = [
      box(3.1, 0.08, 0.5, plinth, [0, 0.04, -0.14]),
      rbox(3.16, 1.9, 0.58, 0.015, body, [0, 1.03, -0.14]),
      // ghế thay đồ: nan gỗ trên khung thép uốn
      ...[-1.36, 0, 1.36].flatMap(x =>
        tube(
          [
            [x, 0.02, 0.14],
            [x, 0.42, 0.14],
            [x, 0.42, 0.4],
            [x, 0.02, 0.4],
          ],
          0.018,
          steel,
          8,
          0.04,
        ),
      ),
      ...[0.15, 0.225, 0.3, 0.375].map(z => rbox(3.08, 0.03, 0.062, 0.01, P.woodLight, [0, 0.455, z])),
    ];
    for (let col = 0; col < 6; col++) {
      const x = -1.3 + col * 0.52;
      for (const y of [1.5, 0.58]) {
        parts.push(box(0.5, 0.88, 0.02, P.wood, [x, y, 0.158]));
        // khe thoáng khí, bảng số tủ và khóa RFID kèm đèn trạng thái
        for (let v = 0; v < 4; v++) parts.push(box(0.22, 0.008, 0.004, plinth, [x, y + 0.34 - v * 0.03, 0.17]));
        parts.push(box(0.07, 0.035, 0.004, chrome, [x, y + 0.16, 0.17]));
        parts.push(box(0.05, 0.1, 0.018, plinth, [x + 0.19, y, 0.176]));
        parts.push(disc(0.008, 0.004, P.screenGlow, [x + 0.19, y + 0.03, 0.186], 'z', 8));
        parts.push(cyl(0.006, 0.006, 0.07, chrome, [x + 0.19, y - 0.085, 0.18], undefined, 6));
      }
    }
    return fit(parts, dims['locker-bank']);
  };

  /** Ghế sauna bằng nan gỗ theo bậc. */
  const buildSaunaBench = (): Geo => {
    const parts: Geo[] = [];
    // Một hàng nan ghế gồm n thanh dài len tại vị trí cho trước.
    const slats = (cx: number, y: number, z0: number, n: number, len: number, color: string) => {
      for (let i = 0; i < n; i++) parts.push(rbox(len, 0.035, 0.11, 0.01, color, [cx, y, z0 + i * 0.125]));
    };
    // băng ghế nan gỗ tầng dưới và tầng trên đặt trên dầm gỗ, kèm tựa lưng nan gỗ
    slats(-0.42, 0.44, 0.02, 6, 3.28, P.woodLight);
    slats(-0.42, 0.86, -0.82, 6, 3.28, P.woodLight);
    for (const x of [-1.9, -0.42, 1.06]) {
      parts.push(box(0.07, 0.42, 0.7, P.wood, [x, 0.21, 0.33]));
      parts.push(box(0.07, 0.84, 0.72, P.wood, [x, 0.42, -0.5]));
      parts.push(box(0.05, 0.5, 0.04, P.wood, [x, 1.14, -0.86], [-0.12, 0, 0]));
    }
    for (const y of [1.0, 1.14, 1.28]) parts.push(rbox(3.28, 0.09, 0.025, 0.008, P.woodLight, [-0.42, y, -0.845 - (y - 1) * 0.12], [-0.12, 0, 0]));
    parts.push(box(3.28, 0.3, 0.02, P.wood, [-0.42, 0.24, 0.7]));
    // lò sưởi: thân thép xước chất đầy đá sauna phía sau khung chắn bằng gỗ
    parts.push(rbox(0.6, 0.74, 0.5, 0.03, steel, [1.68, 0.37, -0.18]));
    parts.push(box(0.5, 0.3, 0.004, plinth, [1.68, 0.3, 0.072]));
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4;
      parts.push(
        sphere(0.07 + (i % 3) * 0.012, rocks, [1.68 + Math.cos(a) * 0.17 * ((i % 4) / 3), 0.76 + (i % 2) * 0.035, -0.18 + Math.sin(a) * 0.14 * ((i % 5) / 4)], [1, 0.75, 1.1], 7, 5),
      );
    }
    for (const [x, z] of [
      [1.3, 0.16],
      [2.06, 0.16],
      [1.3, -0.52],
      [2.06, -0.52],
    ] as const) {
      parts.push(box(0.045, 0.92, 0.045, P.wood, [x, 0.46, z]));
    }
    parts.push(box(0.8, 0.045, 0.045, P.wood, [1.68, 0.9, 0.16]));
    parts.push(box(0.045, 0.045, 0.72, P.wood, [1.3, 0.9, -0.18]));
    parts.push(box(0.045, 0.045, 0.72, P.wood, [2.06, 0.9, -0.18]));
    return fit(parts, dims['sauna-bench']);
  };

  /** Bồn jacuzzi: thành bồn ốp, đá viền quanh lòng bồn mở và vòi. */
  const buildJacuzziTub = (): Geo => {
    const parts: Geo[] = [
      // thành bao ngoài: chân đế, vách ốp, viền đá đánh bóng quanh lòng bồn mở
      box(3.5, 0.08, 3.1, plinth, [0, 0.04, 0]),
      rbox(3.56, 0.8, 0.3, 0.02, body, [0, 0.46, -1.43]),
      rbox(3.56, 0.8, 0.3, 0.02, body, [0, 0.46, 1.43]),
      rbox(0.3, 0.8, 2.56, 0.02, body, [-1.63, 0.46, 0]),
      rbox(0.3, 0.8, 2.56, 0.02, body, [1.63, 0.46, 0]),
      rbox(3.6, 0.05, 0.36, 0.015, stone, [0, 0.885, -1.42]),
      rbox(3.6, 0.05, 0.36, 0.015, stone, [0, 0.885, 1.42]),
      rbox(0.36, 0.05, 2.5, 0.015, stone, [-1.62, 0.885, 0]),
      rbox(0.36, 0.05, 2.5, 0.015, stone, [1.62, 0.885, 0]),
      // lòng bồn acrylic và mặt nước nằm thấp hơn viền đá
      box(2.96, 0.4, 0.03, tile, [0, 0.68, -1.265]),
      box(2.96, 0.4, 0.03, tile, [0, 0.68, 1.265]),
      box(0.03, 0.4, 2.5, tile, [-1.465, 0.68, 0]),
      box(0.03, 0.4, 2.5, tile, [1.465, 0.68, 0]),
      box(2.92, 0.02, 2.5, P.water, [0, 0.8, 0]),
      // gối tựa đầu, tay vịn và bậc bước lên xuống
      rbox(0.5, 0.07, 0.2, 0.03, white, [-0.9, 0.93, -1.32]),
      rbox(0.5, 0.07, 0.2, 0.03, white, [0.9, 0.93, -1.32]),
      ...tube(
        [
          [-0.5, 0.9, 1.4],
          [-0.5, 1.3, 1.4],
          [-0.5, 1.3, 1.0],
          [-0.5, 0.8, 1.0],
        ],
        0.02,
        chrome,
        10,
        0.1,
      ),
      rbox(1.4, 0.19, 0.3, 0.015, P.wood, [0.3, 0.095, 1.7]),
      rbox(1.4, 0.19, 0.14, 0.015, P.wood, [0.3, 0.285, 1.63]),
    ];
    // các đầu phun nước mạ chrome quanh lòng bồn
    for (let i = 0; i < 6; i++) {
      parts.push(disc(0.04, 0.012, chrome, [-1.1 + i * 0.44, 0.7, -1.245], 'z', 12));
      parts.push(disc(0.04, 0.012, chrome, [-1.1 + i * 0.44, 0.7, 1.245], 'z', 12));
    }
    return fit(parts, dims['jacuzzi-tub']);
  };

  /** Quầy nước ép: quầy, máy xay, ghế và kệ. */
  const buildJuiceBar = (): Geo => {
    // Máy xay sinh tố (cối kính, đế, nắp) tại vị trí x.
    const blender = (x: number, lid: string): Geo[] => [
      rbox(0.16, 0.12, 0.18, 0.025, plinth, [x, 1.1, -0.1]),
      cyl(0.075, 0.055, 0.24, glass, [x, 1.28, -0.1], undefined, 14),
      cyl(0.078, 0.078, 0.03, lid, [x, 1.415, -0.1], undefined, 14),
      disc(0.012, 0.01, chrome, [x, 1.09, 0.0], 'z', 8),
    ];
    const parts: Geo[] = [
      box(3.6, 0.1, 1.1, plinth, [0, 0.05, 0]),
      rbox(3.76, 0.9, 1.26, 0.025, body, [0, 0.55, 0]),
      ...battens(3.66, 0.82, 0.55, 0.642, P.wood),
      box(3.76, 0.012, 0.02, P.salmonBright, [0, 0.985, 0.66]),
      rbox(3.84, 0.05, 1.4, 0.015, stone, [0, 1.025, 0.02]),
      // khay trưng bày làm mát với khung chắn chrome (kính tô màu đỉnh sẽ đục
      // và che mất hoa quả bên trong nên khung chắn để hở)
      rbox(1.36, 0.05, 0.5, 0.012, steel, [-1.05, 1.075, 0.17]),
      ...tube(
        [
          [-1.7, 1.05, 0.4],
          [-1.7, 1.38, 0.4],
          [-0.4, 1.38, 0.4],
          [-0.4, 1.05, 0.4],
        ],
        0.012,
        chrome,
        8,
        0.04,
      ),
      ...tube(
        [
          [-1.7, 1.38, 0.4],
          [-1.7, 1.38, -0.06],
        ],
        0.012,
        chrome,
      ),
      ...tube(
        [
          [-0.4, 1.38, 0.4],
          [-0.4, 1.38, -0.06],
        ],
        0.012,
        chrome,
      ),
      ...blender(0.36, plinth),
      ...blender(0.66, P.salmon),
      // máy ép cam và máy tính tiền POS
      rbox(0.2, 0.3, 0.22, 0.04, steel, [1.0, 1.2, -0.1]),
      cyl(0.07, 0.05, 0.08, chrome, [1.0, 1.39, -0.1], undefined, 14),
      ...monitor(1.44, 1.05, 0.1, 0.4, 0.26, -0.25),
    ];
    const fruit = [surface('#c96a2b', 0.6, 0), surface('#b8a13a', 0.6, 0), surface('#7d9a3c', 0.6, 0)];
    for (let i = 0; i < 12; i++) {
      parts.push(sphere(0.045, fruit[i % 3], [-1.6 + i * 0.1, 1.145, 0.08 + (i % 3) * 0.09], undefined, 8, 6));
    }
    return fit(parts, dims['juice-bar']);
  };

  /** Lõi cầu thang: các vế thang, chiếu nghỉ, lan can và vách bao. */
  const buildStairCore = (): Geo => {
    const parts: Geo[] = [];
    const treadW = 3.04;
    const landingW = 3.2;

    // Khung bao kiến trúc chính xác [3.60, 4.56, 4.28]:
    // - Ngưỡng chân thang đặt tại y = 0.00 (z = +2.14)
    // - Chiếu nghỉ giữa thang đặt tại y = 1.90 (z = 0.00)
    // - Cầu tới đỉnh thang phẳng mặt sàn trên tại y = 3.80 (z = -2.14)
    // - Tay vịn công thái học đạt đỉnh tại y = 4.56 (+0.76 m trên chiếu nghỉ trên)
    parts.push(box(landingW, 0.08, 0.52, stone, [0, 0.04, 1.88]));
    parts.push(box(treadW, 0.014, 0.036, P.salmonBright, [0, 0.081, 1.66]));

    // Chiếu nghỉ kết cấu giữa thang + dầm ngang thép chịu lực + khe nhấn ấm
    parts.push(box(landingW, 0.12, 0.64, stone, [0, 1.84, 0]));
    parts.push(box(landingW - 0.16, 0.14, 0.22, steel, [0, 1.71, 0]));
    parts.push(box(treadW, 0.014, 0.032, P.salmon, [0, 1.901, 0.28]));
    parts.push(box(treadW, 0.014, 0.032, P.salmon, [0, 1.901, -0.28]));

    // Cầu tới đỉnh thang nối phẳng với sàn tầng trên tại y = 3.80, z = -2.14
    parts.push(box(landingW, 0.14, 0.52, stone, [0, 3.73, -1.88]));
    parts.push(box(treadW, 0.014, 0.038, rubber, [0, 3.795, -1.65]));

    const flights = [
      { y0: 0.23, y1: 1.69, z0: 1.54, z1: 0.42 },
      { y0: 2.13, y1: 3.59, z0: -0.42, z1: -1.54 },
    ] as const;

    const stepsPerFlight = 8;
    for (const fl of flights) {
      const rise = (fl.y1 - fl.y0) / (stepsPerFlight - 1);
      const going = (fl.z1 - fl.z0) / (stepsPerFlight - 1);

      for (let i = 0; i < stepsPerFlight; i++) {
        const y = fl.y0 + i * rise;
        const z = fl.z0 + i * going;
        // Mặt bậc gỗ sồi ấm nguyên khối + nẹp mũi chống trượt tối + cổ bậc lùi tạo khe bóng
        parts.push(box(treadW, 0.068, 0.25, P.wood, [0, y - 0.034, z]));
        parts.push(box(treadW - 0.04, 0.01, 0.032, rubber, [0, y + 0.003, z + 0.102]));
        parts.push(box(treadW - 0.18, 0.145, 0.024, plinth, [0, y - 0.1, z - 0.09]));
      }

      // Dầm cốn thép phân đoạn hai bên + cặp dầm sống thép âm nằm trọn dưới mặt bậc gỗ sồi
      const dy = fl.y1 - fl.y0;
      const dz = fl.z0 - fl.z1;
      const slope = Math.atan2(dy, dz);
      const spanLen = Math.hypot(dy, dz) - 0.36;
      const midY = (fl.y0 + fl.y1) * 0.5 - 0.2 + 0.06;
      const midZ = (fl.z0 + fl.z1) * 0.5 - 0.05;

      for (const sx of [-1.46, 1.46]) {
        parts.push(box(0.065, 0.11, spanLen, body, [sx, midY - 0.05, midZ], [slope, 0, 0]));
        parts.push(box(0.072, 0.022, spanLen, steel, [sx, midY + 0.015, midZ], [slope, 0, 0]));
      }
      for (const bx of [-0.62, 0.62]) {
        parts.push(box(0.08, 0.11, spanLen, panel, [bx, midY - 0.06, midZ], [slope, 0, 0]));
      }
    }

    // Khớp nối ngang của dầm cốn qua chiếu nghỉ giữa và các chiếu nghỉ đầu cuối
    for (const sx of [-1.46, 1.46]) {
      parts.push(box(0.065, 0.22, 0.72, body, [sx, 1.74, 0]));
      parts.push(box(0.08, 0.04, 0.36, steel, [sx, 0.02, 1.88]));
      parts.push(box(0.08, 0.16, 0.44, body, [sx, 3.68, -1.88]));
    }

    // Cột lan can thép hở, 3 tầng thanh giằng chrome và tay vịn gỗ sồi ấm (không dùng kính giả bị đục!)
    for (const side of [-1, 1] as const) {
      const postX = side * 1.66;
      const bracketX = side * 1.76;

      // Ngàm gắn ngoài xác định đúng tổng chiều rộng 3.60 m (`±1.80 m`)
      parts.push(box(0.08, 0.06, 0.14, steel, [bracketX, 0.12, 1.92]));
      parts.push(box(0.08, 0.06, 0.14, steel, [bracketX, 1.92, 0]));
      parts.push(box(0.08, 0.06, 0.14, steel, [bracketX, 3.82, -1.92]));

      const postAnchors: Array<[number, number]> = [
        [0.08, 1.96],
        [0.44, 1.38],
        [1.06, 0.9],
        [1.69, 0.42],
        [1.9, 0.0],
        [2.34, -0.58],
        [2.96, -1.06],
        [3.59, -1.54],
        [3.8, -1.96],
      ];
      for (const [py, pz] of postAnchors) {
        parts.push(box(0.026, 0.74, 0.042, body, [postX, py + 0.37, pz]));
        parts.push(box(0.036, 0.022, 0.056, chrome, [postX, py + 0.73, pz]));
      }

      // Ba thanh giằng chrome xước song song + tay vịn gỗ sồi công thái học dọc theo cả 5 đoạn
      const railProfile: Array<[number, number]> = [
        [0.08, 1.98],
        [0.23, 1.54],
        [1.9, 0.3],
        [1.9, -0.3],
        [3.8, -1.62],
        [3.8, -1.98],
      ];
      for (const rodH of [0.22, 0.41, 0.59]) {
        parts.push(
          ...tube(
            railProfile.map(([ry, rz]) => [postX, ry + rodH, rz] as [number, number, number]),
            0.008,
            chrome,
            5,
          ),
        );
      }
      parts.push(
        ...tube(
          railProfile.map(([ry, rz]) => [postX, ry + 0.738, rz] as [number, number, number]),
          0.022,
          P.woodLight,
          8,
        ),
      );
      // Nắp chụp đầu tay vịn mạ chrome đạt đỉnh gọn gàng tại y = 4.560
      parts.push(box(0.046, 0.044, 0.12, chrome, [postX, 4.538, -1.96]));
    }

    return fit(parts, dims['stair-core']);
  };

  /** Lõi thang máy: bệ granite chạm đất và mũ penthouse than chì nhô ra với viền salmon đặc trưng của SÖL. */
  const buildElevatorCore = (): Geo =>
    fit(
      [
        // Bệ granite chạm đất và mũ penthouse than chì nhô ra với dải viền salmon đặc trưng SÖL
        box(2.58, 0.14, 2.58, plinth, [0, 0.07, 0]),
        rbox(2.54, 0.2, 2.54, 0.02, body, [0, 3.64, 0]),
        box(2.58, 0.06, 2.58, P.salmon, [0, 3.77, 0]),
        // Trụ góc thép tối kiến trúc và tấm ốp màu than chì lì (không dùng kính giả màu xanh dương đục)
        ...[
          [-1.21, -1.21],
          [1.21, -1.21],
          [-1.21, 1.21],
          [1.21, 1.21],
        ].map(([x, z]) => box(0.14, 3.44, 0.14, body, [x, 1.84, z])),
        box(2.3, 3.4, 0.04, panel, [0, 1.84, -1.2]),
        box(0.04, 3.4, 2.3, panel, [-1.2, 1.84, 0]),
        box(0.04, 3.4, 2.3, panel, [1.2, 1.84, 0]),
        // Các đường chỉ ngang thép kiến trúc trên mặt bên và mặt sau
        ...[1.22, 2.44].flatMap(ty => [
          box(2.36, 0.05, 0.07, steel, [0, ty, -1.21]),
          box(0.07, 0.05, 2.36, steel, [-1.21, ty, 0]),
          box(0.07, 0.05, 2.36, steel, [1.21, ty, 0]),
        ]),
        // Vách cổng trước, khung bao thép xước lõm sâu và cửa mở hai cánh từ giữa
        box(2.3, 3.4, 0.05, body, [0, 1.84, 1.19]),
        box(1.84, 2.34, 0.05, steel, [0, 1.28, 1.215]),
        box(1.68, 2.22, 0.03, plinth, [0, 1.23, 1.228]),
        box(0.79, 2.16, 0.024, steel, [-0.408, 1.21, 1.242]),
        box(0.79, 2.16, 0.024, steel, [0.408, 1.21, 1.242]),
        box(0.04, 2.16, 0.028, chrome, [-0.04, 1.21, 1.246]),
        box(0.04, 2.16, 0.028, chrome, [0.04, 1.21, 1.246]),
        // Bảng chỉ báo tầng kỹ thuật số ánh ấm và hộp nút gọi tầng bằng inox xước
        rbox(0.56, 0.13, 0.028, 0.008, plinth, [0, 2.58, 1.24]),
        box(0.22, 0.055, 0.008, P.salmonBright, [0, 2.58, 1.256]),
        rbox(0.11, 0.26, 0.02, 0.006, chrome, [1.04, 1.2, 1.232]),
        disc(0.018, 0.008, P.salmonBright, [1.04, 1.25, 1.244], 'z', 10),
        disc(0.018, 0.008, body, [1.04, 1.15, 1.244], 'z', 10),
      ],
      dims['elevator-core'],
    );

  /** Bục xuất phát hồ bơi. */
  const buildStartingBlock = (): Geo =>
    fit(
      [
        rbox(0.5, 0.03, 0.5, 0.01, chrome, [0, 0.015, 0]),
        rbox(0.2, 0.52, 0.24, 0.03, steel, [0, 0.3, 0.04], [-0.14, 0, 0]),
        // mặt bục nghiêng có lớp chống trượt và tấm đạp sau điều chỉnh được
        rbox(0.72, 0.07, 0.74, 0.02, white, [0, 0.62, 0], [0.16, 0, 0]),
        box(0.64, 0.008, 0.66, rubber, [0, 0.658, 0], [0.16, 0, 0]),
        rbox(0.56, 0.22, 0.03, 0.01, rubber, [0, 0.76, 0.3], [-0.5, 0, 0]),
        box(0.16, 0.12, 0.006, P.salmon, [0, 0.6, -0.386], [0.16, 0, 0]),
        // thanh nắm xuất phát bơi ngửa
        ...tube(
          [
            [-0.3, 0.56, -0.26],
            [-0.3, 0.42, -0.36],
            [0.3, 0.42, -0.36],
            [0.3, 0.56, -0.26],
          ],
          0.016,
          chrome,
          8,
          0.05,
        ),
      ],
      dims['starting-block'],
    );

  /** Thảm yoga. */
  const buildYogaMat = (): Geo =>
    fit(
      [
        rbox(0.74, 0.012, 1.82, 0.005, fabricWarm, [0, 0.006, 0]),
        box(0.004, 0.002, 1.5, plinth, [0, 0.0125, 0.04]),
        // gạch tập bằng bần và dây tập cuộn tròn ở đầu thảm
        rbox(0.22, 0.045, 0.14, 0.012, cork, [0.18, 0.035, -0.72]),
        cyl(0.03, 0.03, 0.06, fabric, [-0.2, 0.042, -0.74], [0, 0, PI2], 12),
      ],
      dims['yoga-mat'],
    );

  /** Gối thiền (zafu) và thảm zabuton, kèm chuông xướng. */
  const buildMeditationBolster = (): Geo =>
    fit(
      [
        // thảm zabuton, gối tròn zafu có đường viền gân, chuông xướng
        rbox(0.62, 0.05, 0.62, 0.025, fabric, [0, 0.025, 0]),
        sphere(0.25, fabricWarm, [0, 0.16, 0], [1, 0.46, 1], 20, 12),
        disc(0.252, 0.012, woodDark, [0, 0.16, 0], 'y', 24),
        shape(new THREE.SphereGeometry(0.06, 14, 6, 0, Math.PI * 2, PI2, PI2), brass, [0.24, 0.115, 0.22]),
        cyl(0.007, 0.007, 0.12, P.wood, [0.2, 0.06, 0.27], [0, 0.5, PI2], 6),
      ],
      dims['meditation-bolster'],
    );

  /** Máy phân tích thành phần cơ thể InBody: bục cân và điện cực inox. */
  const buildInbodyAnalyzer = (): Geo =>
    fit(
      [
        // bục cân kèm các điện cực bàn chân bằng inox
        rbox(0.74, 0.07, 0.86, 0.03, panel, [0, 0.035, 0.12]),
        ...[-0.16, 0.16].flatMap(x => [
          rbox(0.15, 0.008, 0.2, 0.003, chrome, [x, 0.074, 0.26]),
          rbox(0.15, 0.008, 0.11, 0.003, chrome, [x, 0.074, 0.06]),
        ]),
        // trụ đứng, giá gác cùng tay cầm điện cực và đầu màn hình hiển thị
        rbox(0.17, 1.14, 0.12, 0.035, white, [0, 0.62, -0.28], [-0.1, 0, 0]),
        ...[-1, 1].flatMap(s => [
          ...tube(
            [
              [s * 0.08, 0.98, -0.3],
              [s * 0.3, 0.98, -0.28],
              [s * 0.34, 0.9, -0.14],
            ],
            0.014,
            steel,
            8,
            0.05,
          ),
          ...tube(
            [
              [s * 0.34, 0.9, -0.14],
              [s * 0.34, 0.99, 0.02],
            ],
            0.022,
            plinth,
          ),
        ]),
        rbox(0.36, 0.28, 0.05, 0.02, white, [0, 1.22, -0.34], [-0.38, 0, 0]),
        box(0.3, 0.2, 0.004, P.screenGlow, [0, 1.23, -0.314], [-0.38, 0, 0]),
      ],
      dims['inbody-analyzer'],
    );

  return {
    'reception-desk': buildReceptionDesk,
    'qr-turnstile': buildQrTurnstile,
    'kiosk-checkin': buildKioskCheckin,
    'card-printer': buildCardPrinter,
    'supplement-shelf': buildSupplementShelf,
    'nutrition-board': buildNutritionBoard,
    'trophy-totem': buildTrophyTotem,
    'coach-podium': buildCoachPodium,
    'consultation-pod': buildConsultationPod,
    'locker-bank': buildLockerBank,
    'sauna-bench': buildSaunaBench,
    'jacuzzi-tub': buildJacuzziTub,
    'juice-bar': buildJuiceBar,
    'stair-core': buildStairCore,
    'elevator-core': buildElevatorCore,
    'starting-block': buildStartingBlock,
    'yoga-mat': buildYogaMat,
    'meditation-bolster': buildMeditationBolster,
    'inbody-analyzer': buildInbodyAnalyzer,
  };
}
