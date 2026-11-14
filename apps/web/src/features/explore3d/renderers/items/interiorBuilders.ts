import * as THREE from 'three';
import type { ItemKind } from '../../scene/schema';
import type { GymBuilderHelpers } from './gymBuilders';

type Geo = THREE.BufferGeometry;

/**
 * Realistic lobby, service, spa and circulation furniture. Footprints and the
 * side each piece faces match the earlier box-built versions; construction now
 * follows real joinery and fittings: plinths with shadow gaps, slatted timber,
 * polished stone tops, brushed-steel hardware, glass panels and upholstery.
 * Brand salmon is used as thin accents, never as whole blocks.
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

  /** Flat display on a small stand, facing +Z, tilted back by `tilt`. */
  const monitor = (x: number, y: number, z: number, w = 0.5, hh = 0.3, tilt = -0.12, ry = 0): Geo[] => [
    disc(0.09, 0.012, steel, [x, y + 0.006, z], 'y', 16),
    cyl(0.012, 0.012, hh * 0.6, steel, [x, y + hh * 0.3, z], undefined, 8),
    rbox(w, hh, 0.022, 0.008, plinth, [x, y + hh * 0.75, z + 0.01], [tilt, ry, 0]),
    box(w - 0.03, hh - 0.03, 0.004, P.screen, [x, y + hh * 0.75, z + 0.023], [tilt, ry, 0]),
  ];

  /** Row of vertical timber battens along X on a dark backing. */
  const battens = (width: number, height: number, y: number, z: number, color: string, pitch = 0.11): Geo[] => {
    const parts: Geo[] = [box(width, height, 0.02, plinth, [0, y, z - 0.02])];
    const n = Math.floor(width / pitch);
    for (let i = 0; i < n; i++) {
      parts.push(box(pitch * 0.55, height, 0.035, color, [-width / 2 + pitch * (i + 0.5), y, z]));
    }
    return parts;
  };

  const buildReceptionDesk = (): Geo =>
    fit(
      [
        // recessed plinth, carcass, slatted timber front
        box(5.1, 0.1, 1.3, plinth, [0, 0.05, 0]),
        rbox(5.3, 0.9, 1.44, 0.03, body, [0, 0.56, 0]),
        ...battens(5.2, 0.84, 0.56, 0.745, P.wood),
        // LED shadow line under the transaction counter
        box(5.3, 0.012, 0.02, P.salmonBright, [0, 1.035, 0.76]),
        // polished stone transaction counter and lower work surface
        rbox(5.4, 0.06, 0.62, 0.02, stone, [0, 1.09, 0.48]),
        box(5.2, 0.03, 0.8, woodDark, [0, 1.0, -0.24]),
        ...monitor(-1.2, 1.015, -0.3),
        ...monitor(1.2, 1.015, -0.3),
        rbox(0.4, 0.015, 0.13, 0.005, plinth, [-1.2, 1.022, -0.02]),
        rbox(0.4, 0.015, 0.13, 0.005, plinth, [1.2, 1.022, -0.02]),
        // card reader, bell, brochure stand on the counter
        rbox(0.09, 0.04, 0.16, 0.012, plinth, [0.3, 1.14, 0.5], [-0.3, 0, 0]),
        disc(0.035, 0.03, brass, [-0.4, 1.135, 0.52], 'y', 16),
        box(0.22, 0.26, 0.012, glass, [2.1, 1.25, 0.5], [-0.2, 0, 0]),
      ],
      dims['reception-desk'],
    );

  const buildQrTurnstile = (): Geo =>
    fit(
      [
        ...[-1, 1].flatMap(s => [
          // stainless pedestal with dark side inlay and top cap
          rbox(0.22, 0.96, 1.5, 0.06, steel, [s * 0.48, 0.48, 0]),
          box(0.224, 0.6, 1.1, plinth, [s * 0.48, 0.5, 0]),
          rbox(0.24, 0.03, 1.54, 0.012, chrome, [s * 0.48, 0.975, 0]),
          // hinge post and frameless glass wing
          cyl(0.022, 0.022, 0.8, chrome, [s * 0.36, 0.52, 0], undefined, 12),
          rbox(0.33, 0.74, 0.014, 0.006, glass, [s * 0.185, 0.54, 0]),
          // status light bar on the entry face
          box(0.02, 0.5, 0.012, s > 0 ? P.salmonBright : P.screenGlow, [s * 0.48, 0.55, 0.757]),
        ]),
        // QR / card reader window set into the right-hand cap
        rbox(0.16, 0.014, 0.22, 0.006, plinth, [0.48, 0.997, 0.5]),
        box(0.1, 0.004, 0.1, P.screenGlow, [0.48, 1.006, 0.5]),
        rbox(0.16, 0.014, 0.22, 0.006, plinth, [-0.48, 0.997, 0.5]),
      ],
      dims['qr-turnstile'],
    );

  const buildKioskCheckin = (): Geo =>
    fit(
      [
        rbox(0.6, 0.03, 0.5, 0.012, steel, [0, 0.015, 0]),
        rbox(0.3, 0.98, 0.1, 0.03, body, [0, 0.52, -0.06], [-0.1, 0, 0]),
        // tilted touchscreen head
        rbox(0.58, 0.78, 0.055, 0.025, plinth, [0, 1.14, 0.0], [-0.22, 0, 0]),
        box(0.5, 0.62, 0.004, P.screen, [0, 1.165, 0.034], [-0.22, 0, 0]),
        disc(0.012, 0.006, glass, [0, 1.49, -0.045], 'z', 10),
        // reader shelf with card slot and receipt outlet
        rbox(0.3, 0.05, 0.14, 0.015, panel, [0, 0.72, 0.1], [-0.35, 0, 0]),
        box(0.12, 0.006, 0.02, plinth, [0, 0.745, 0.115], [-0.35, 0, 0]),
        box(0.5, 0.008, 0.012, P.salmon, [0, 0.79, 0.1], [-0.22, 0, 0]),
      ],
      dims['kiosk-checkin'],
    );

  const buildCardPrinter = (): Geo =>
    fit(
      [
        box(1.0, 0.08, 0.66, plinth, [0, 0.04, 0]),
        rbox(1.06, 0.74, 0.74, 0.02, body, [0, 0.45, 0]),
        // two timber doors with a shadow gap and bar handles
        box(0.5, 0.68, 0.02, P.wood, [-0.262, 0.45, 0.372]),
        box(0.5, 0.68, 0.02, P.wood, [0.262, 0.45, 0.372]),
        cyl(0.008, 0.008, 0.2, chrome, [-0.05, 0.5, 0.395], undefined, 8),
        cyl(0.008, 0.008, 0.2, chrome, [0.05, 0.5, 0.395], undefined, 8),
        rbox(1.1, 0.04, 0.78, 0.012, stone, [0, 0.84, 0]),
        // card printer with feed hopper, output slot and status light
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

  const buildSupplementShelf = (): Geo => {
    const parts: Geo[] = [
      // gondola: plinth, back panel, end panels, header
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

  const buildNutritionBoard = (): Geo =>
    fit(
      [
        ...[-0.96, 0.96].flatMap(x => [
          rbox(0.14, 0.03, 0.46, 0.01, steel, [x, 0.015, 0]),
          cyl(0.03, 0.03, 1.86, steel, [x, 0.95, 0], undefined, 12),
        ]),
        // framed matte menu panel with printed rows
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

  const buildTrophyTotem = (): Geo => {
    const parts: Geo[] = [
      rbox(0.96, 0.16, 0.56, 0.02, stone, [0, 0.08, 0]),
      rbox(0.74, 1.7, 0.3, 0.03, body, [0, 1.02, 0]),
      // recessed back-lit streak tiles
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

  const buildCoachPodium = (): Geo =>
    fit(
      [
        box(1.26, 0.08, 0.84, plinth, [0, 0.04, 0]),
        rbox(1.24, 0.94, 0.68, 0.025, body, [0, 0.55, 0]),
        ...battens(1.14, 0.84, 0.55, 0.352, P.wood, 0.095),
        // sloped reading top with a raised lip
        rbox(1.36, 0.04, 0.82, 0.012, stone, [0, 1.06, 0], [0.16, 0, 0]),
        box(1.36, 0.03, 0.02, steel, [0, 1.015, 0.405]),
        // two tablets resting on the slope
        rbox(0.4, 0.26, 0.014, 0.008, plinth, [-0.28, 1.1, -0.05], [0.16 - PI2, 0, 0]),
        box(0.36, 0.22, 0.003, P.screen, [-0.28, 1.109, -0.048], [0.16 - PI2, 0, 0]),
        rbox(0.4, 0.26, 0.014, 0.008, plinth, [0.28, 1.1, -0.05], [0.16 - PI2, 0, 0]),
        box(0.36, 0.22, 0.003, P.screenGlow, [0.28, 1.109, -0.048], [0.16 - PI2, 0, 0]),
      ],
      dims['coach-podium'],
    );

  const buildConsultationPod = (): Geo => {
    const chair = (s: number): Geo[] => [
      // slim steel legs, upholstered seat and wrap-around back
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

  const buildLockerBank = (): Geo => {
    const parts: Geo[] = [
      box(3.1, 0.08, 0.5, plinth, [0, 0.04, -0.14]),
      rbox(3.16, 1.9, 0.58, 0.015, body, [0, 1.03, -0.14]),
      // changing bench: timber slats on a bent steel frame
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
        // louvre vents, number plate, RFID lock with status light
        for (let v = 0; v < 4; v++) parts.push(box(0.22, 0.008, 0.004, plinth, [x, y + 0.34 - v * 0.03, 0.17]));
        parts.push(box(0.07, 0.035, 0.004, chrome, [x, y + 0.16, 0.17]));
        parts.push(box(0.05, 0.1, 0.018, plinth, [x + 0.19, y, 0.176]));
        parts.push(disc(0.008, 0.004, P.screenGlow, [x + 0.19, y + 0.03, 0.186], 'z', 8));
        parts.push(cyl(0.006, 0.006, 0.07, chrome, [x + 0.19, y - 0.085, 0.18], undefined, 6));
      }
    }
    return fit(parts, dims['locker-bank']);
  };

  const buildSaunaBench = (): Geo => {
    const parts: Geo[] = [];
    const slats = (cx: number, y: number, z0: number, n: number, len: number, color: string) => {
      for (let i = 0; i < n; i++) parts.push(rbox(len, 0.035, 0.11, 0.01, color, [cx, y, z0 + i * 0.125]));
    };
    // lower and upper slatted benches on timber bearers, slatted backrest
    slats(-0.42, 0.44, 0.02, 6, 3.28, P.woodLight);
    slats(-0.42, 0.86, -0.82, 6, 3.28, P.woodLight);
    for (const x of [-1.9, -0.42, 1.06]) {
      parts.push(box(0.07, 0.42, 0.7, P.wood, [x, 0.21, 0.33]));
      parts.push(box(0.07, 0.84, 0.72, P.wood, [x, 0.42, -0.5]));
      parts.push(box(0.05, 0.5, 0.04, P.wood, [x, 1.14, -0.86], [-0.12, 0, 0]));
    }
    for (const y of [1.0, 1.14, 1.28]) parts.push(rbox(3.28, 0.09, 0.025, 0.008, P.woodLight, [-0.42, y, -0.845 - (y - 1) * 0.12], [-0.12, 0, 0]));
    parts.push(box(3.28, 0.3, 0.02, P.wood, [-0.42, 0.24, 0.7]));
    // heater: brushed-steel body filled with stones behind a timber guard
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

  const buildJacuzziTub = (): Geo => {
    const parts: Geo[] = [
      // surround: plinth, clad walls, polished stone coping around an open basin
      box(3.5, 0.08, 3.1, plinth, [0, 0.04, 0]),
      rbox(3.56, 0.8, 0.3, 0.02, body, [0, 0.46, -1.43]),
      rbox(3.56, 0.8, 0.3, 0.02, body, [0, 0.46, 1.43]),
      rbox(0.3, 0.8, 2.56, 0.02, body, [-1.63, 0.46, 0]),
      rbox(0.3, 0.8, 2.56, 0.02, body, [1.63, 0.46, 0]),
      rbox(3.6, 0.05, 0.36, 0.015, stone, [0, 0.885, -1.42]),
      rbox(3.6, 0.05, 0.36, 0.015, stone, [0, 0.885, 1.42]),
      rbox(0.36, 0.05, 2.5, 0.015, stone, [-1.62, 0.885, 0]),
      rbox(0.36, 0.05, 2.5, 0.015, stone, [1.62, 0.885, 0]),
      // acrylic shell and water sitting below the coping
      box(2.96, 0.4, 0.03, tile, [0, 0.68, -1.265]),
      box(2.96, 0.4, 0.03, tile, [0, 0.68, 1.265]),
      box(0.03, 0.4, 2.5, tile, [-1.465, 0.68, 0]),
      box(0.03, 0.4, 2.5, tile, [1.465, 0.68, 0]),
      box(2.92, 0.02, 2.5, P.water, [0, 0.8, 0]),
      // head rests, grab rail, entry steps
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
    // chrome jets around the shell
    for (let i = 0; i < 6; i++) {
      parts.push(disc(0.04, 0.012, chrome, [-1.1 + i * 0.44, 0.7, -1.245], 'z', 12));
      parts.push(disc(0.04, 0.012, chrome, [-1.1 + i * 0.44, 0.7, 1.245], 'z', 12));
    }
    return fit(parts, dims['jacuzzi-tub']);
  };

  const buildJuiceBar = (): Geo => {
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
      // chilled display well with a chrome sneeze-guard frame (vertex-coloured glass
      // would be opaque and hide the produce, so the guard is left as an open frame)
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
      // citrus press and POS terminal
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

  const buildStairCore = (): Geo => {
    const parts: Geo[] = [];
    const clearWidth = 2.88;
    const stairZ0 = 1.95;
    const stairZ1 = -1.95;
    const stairY0 = 0.08;
    const stairY1 = 3.72;
    const steps = 18;

    const rise = (stairY1 - stairY0) / (steps - 1);
    const going = (stairZ1 - stairZ0) / (steps - 1);

    // Continuous wide architectural steps (zero center spine wall - unobstructed 2.88m path)
    for (let i = 0; i < steps; i++) {
      const y = stairY0 + i * rise;
      const z = stairZ0 + i * going;
      // Hardwood / terrazzo step tread
      parts.push(rbox(clearWidth, 0.065, 0.28, 0.012, P.wood, [0, y, z]));
      // Contrasting safety tactile nosing strip
      parts.push(box(clearWidth, 0.012, 0.035, rubber, [0, y + 0.033, z + 0.12]));
    }

    // Top arrival landing tread connecting flush to upper floor level
    parts.push(rbox(clearWidth, 0.08, 0.42, 0.015, stone, [0, stairY1, stairZ1]));

    // Steel stringer beams and underside soffit
    const slope = Math.atan2(stairY1 - stairY0, Math.abs(stairZ1 - stairZ0));
    const spanLen = Math.hypot(stairY1 - stairY0, stairZ1 - stairZ0) + 0.28;
    const midY = (stairY0 + stairY1) * 0.5;
    const midZ = (stairZ0 + stairZ1) * 0.5;

    // Structural underside soffit
    parts.push(box(clearWidth, 0.035, spanLen, panel, [0, midY - 0.22, midZ], [-slope, 0, 0]));

    // Heavy steel side stringers along lateral boundaries
    for (const sx of [-clearWidth * 0.5 - 0.03, clearWidth * 0.5 + 0.03]) {
      parts.push(box(0.06, 0.32, spanLen, steel, [sx, midY - 0.12, midZ], [-slope, 0, 0]));
    }

    // Left and right transparent architectural glass & brushed-steel balustrades
    for (const sx of [-clearWidth * 0.5 - 0.07, clearWidth * 0.5 + 0.07]) {
      // Tempered safety glass balustrade panel
      parts.push(box(0.018, 0.92, spanLen, '#c8d4e0', [sx, midY + 0.46, midZ], [-slope, 0, 0]));

      // Sturdy vertical steel baluster posts
      for (let i = 0; i < steps; i += 3) {
        const py = stairY0 + i * rise;
        const pz = stairZ0 + i * going;
        parts.push(cyl(0.016, 0.016, 0.96, steel, [sx, py + 0.48, pz], undefined, 8));
      }

      // Brushed stainless steel ergonomic round handrail
      parts.push(
        ...tube(
          [
            [sx, stairY0 + 0.96, stairZ0 + 0.15],
            [sx, stairY1 + 0.96, stairZ1 - 0.15],
          ],
          0.024,
          chrome,
          10,
        ),
      );
    }

    return fit(parts, dims['stair-core']);
  };

  const buildElevatorCore = (): Geo =>
    fit(
      [
        box(2.58, 0.14, 2.58, plinth, [0, 0.07, 0]),
        rbox(2.58, 0.24, 2.58, 0.02, body, [0, 3.68, 0]),
        // steel-framed glass shaft around the cab
        ...[
          [-1.22, -1.22],
          [1.22, -1.22],
          [-1.22, 1.22],
          [1.22, 1.22],
        ].map(([x, z]) => box(0.12, 3.5, 0.12, steel, [x, 1.86, z])),
        box(2.32, 3.4, 0.016, glass, [0, 1.86, -1.22]),
        box(0.016, 3.4, 2.32, glass, [-1.22, 1.86, 0]),
        box(0.016, 3.4, 2.32, glass, [1.22, 1.86, 0]),
        box(2.32, 0.06, 0.06, steel, [0, 2.5, -1.22]),
        box(0.06, 0.06, 2.32, steel, [-1.22, 2.5, 0]),
        box(0.06, 0.06, 2.32, steel, [1.22, 2.5, 0]),
        // cab with brushed-steel portal and centre-opening doors
        rbox(1.96, 2.4, 1.96, 0.03, panel, [0, 1.36, -0.08]),
        box(2.32, 3.4, 0.03, body, [0, 1.86, 1.2]),
        box(1.76, 2.3, 0.02, steel, [0, 1.3, 1.22]),
        box(0.8, 2.14, 0.012, chrome, [-0.405, 1.22, 1.236]),
        box(0.8, 2.14, 0.012, chrome, [0.405, 1.22, 1.236]),
        box(0.008, 2.14, 0.014, plinth, [0, 1.22, 1.238]),
        // floor indicator and call panel
        rbox(0.5, 0.12, 0.02, 0.008, plinth, [0, 2.55, 1.235]),
        box(0.16, 0.06, 0.004, P.salmonBright, [0, 2.55, 1.247]),
        rbox(0.1, 0.24, 0.016, 0.006, steel, [1.02, 1.2, 1.226]),
        disc(0.018, 0.006, P.screenGlow, [1.02, 1.24, 1.236], 'z', 10),
        disc(0.018, 0.006, chrome, [1.02, 1.16, 1.236], 'z', 10),
      ],
      dims['elevator-core'],
    );

  const buildStartingBlock = (): Geo =>
    fit(
      [
        rbox(0.5, 0.03, 0.5, 0.01, chrome, [0, 0.015, 0]),
        rbox(0.2, 0.52, 0.24, 0.03, steel, [0, 0.3, 0.04], [-0.14, 0, 0]),
        // sloped platform with a non-slip top and adjustable rear kick plate
        rbox(0.72, 0.07, 0.74, 0.02, white, [0, 0.62, 0], [0.16, 0, 0]),
        box(0.64, 0.008, 0.66, rubber, [0, 0.658, 0], [0.16, 0, 0]),
        rbox(0.56, 0.22, 0.03, 0.01, rubber, [0, 0.76, 0.3], [-0.5, 0, 0]),
        box(0.16, 0.12, 0.006, P.salmon, [0, 0.6, -0.386], [0.16, 0, 0]),
        // backstroke grab bar
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

  const buildYogaMat = (): Geo =>
    fit(
      [
        rbox(0.74, 0.012, 1.82, 0.005, fabricWarm, [0, 0.006, 0]),
        box(0.004, 0.002, 1.5, plinth, [0, 0.0125, 0.04]),
        // cork block and a rolled strap at the head of the mat
        rbox(0.22, 0.045, 0.14, 0.012, cork, [0.18, 0.035, -0.72]),
        cyl(0.03, 0.03, 0.06, fabric, [-0.2, 0.042, -0.74], [0, 0, PI2], 12),
      ],
      dims['yoga-mat'],
    );

  const buildMeditationBolster = (): Geo =>
    fit(
      [
        // zabuton mat, round zafu cushion with a piped seam, singing bowl
        rbox(0.62, 0.05, 0.62, 0.025, fabric, [0, 0.025, 0]),
        sphere(0.25, fabricWarm, [0, 0.16, 0], [1, 0.46, 1], 20, 12),
        disc(0.252, 0.012, woodDark, [0, 0.16, 0], 'y', 24),
        shape(new THREE.SphereGeometry(0.06, 14, 6, 0, Math.PI * 2, PI2, PI2), brass, [0.24, 0.115, 0.22]),
        cyl(0.007, 0.007, 0.12, P.wood, [0.2, 0.06, 0.27], [0, 0.5, PI2], 6),
      ],
      dims['meditation-bolster'],
    );

  const buildInbodyAnalyzer = (): Geo =>
    fit(
      [
        // scale platform with stainless foot electrodes
        rbox(0.74, 0.07, 0.86, 0.03, panel, [0, 0.035, 0.12]),
        ...[-0.16, 0.16].flatMap(x => [
          rbox(0.15, 0.008, 0.2, 0.003, chrome, [x, 0.074, 0.26]),
          rbox(0.15, 0.008, 0.11, 0.003, chrome, [x, 0.074, 0.06]),
        ]),
        // column, hand-electrode holsters and grips, display head
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
