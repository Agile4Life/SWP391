import * as THREE from 'three';
import type { ItemKind, Vec3 } from '../../scene/schema';

type Geo = THREE.BufferGeometry;

/** Geometry helpers owned by itemGeometries.ts (passed in to avoid a circular import). */
export interface GymBuilderHelpers {
  P: Readonly<Record<string, string>>;
  dims: Readonly<Record<ItemKind, Vec3>>;
  box: (w: number, h: number, d: number, color: string, pos?: Vec3, rot?: Vec3) => Geo;
  cyl: (
    rTop: number,
    rBottom: number,
    h: number,
    color: string,
    pos?: Vec3,
    rot?: Vec3,
    radialSegments?: number,
  ) => Geo;
  sphere: (
    radius: number,
    color: string,
    pos?: Vec3,
    scale?: Vec3,
    widthSegments?: number,
    heightSegments?: number,
  ) => Geo;
  roundedBox: (
    w: number,
    h: number,
    d: number,
    radius: number,
    color: string,
    pos?: Vec3,
    rot?: Vec3,
  ) => Geo;
  tube: (points: readonly Vec3[], radius: number, color: string, radialSegments?: number, bend?: number) => Geo[];
  disc: (
    radius: number,
    thickness: number,
    color: string,
    pos: Vec3,
    axis?: 'x' | 'y' | 'z',
    segments?: number,
  ) => Geo;
  shape: (geometry: Geo, color: string, pos?: Vec3, rot?: Vec3, scale?: Vec3) => Geo;
  surface: (color: string, roughness: number, metalness: number) => string;
  fit: (parts: Geo[], dimensions: Vec3) => Geo;
}

/**
 * Realistic commercial gym equipment. Layout (where the user stands, sits or
 * grips) matches the earlier box-built versions so the live actors still line
 * up; the construction now follows real machines: bent round-tube frames,
 * upholstered pads with soft edges, chrome guide rods, rubber bumper plates,
 * selectorised weight stacks, cables and pulleys.
 */
export function createGymBuilders(h: GymBuilderHelpers): Partial<Record<ItemKind, () => Geo>> {
  const { P, dims, box, cyl, roundedBox: rbox, tube, disc, shape, surface, fit } = h;

  // Materials that are not in the base palette.
  const rubber = surface('#0f0f11', 0.9, 0);
  const belt = surface('#151517', 0.78, 0);
  const vinyl = surface('#1b1b1e', 0.55, 0);
  const iron = surface('#232427', 0.5, 0.85);
  const chrome = P.metalLight;
  const steel = P.metal;
  const frame = P.charcoal;
  const shroud = P.charcoalSoft;
  const leather = surface('#2b211c', 0.5, 0);
  const cable = surface('#0a0a0b', 0.6, 0.3);
  const PI2 = Math.PI / 2;

  /** Thin tilted panel (screen) sitting `lift` in front of a console rotated about X by `tilt`. */
  const screenOn = (w: number, hh: number, center: Vec3, tilt: number, lift: number, color = P.screen): Geo =>
    box(w, hh, 0.012, color, [center[0], center[1] - Math.sin(tilt) * lift, center[2] + Math.cos(tilt) * lift], [
      tilt,
      0,
      0,
    ]);

  /** Olympic bar along X with sleeves, bumper plates and collars. */
  const barbell = (y: number, z: number, length: number, plateX: number): Geo[] => [
    cyl(0.014, 0.014, length, chrome, [0, y, z], [0, 0, PI2], 10),
    ...[-1, 1].flatMap(s => [
      cyl(0.026, 0.026, length / 2 - plateX + 0.1, chrome, [s * (plateX + (length / 2 - plateX) / 2 - 0.05), y, z], [0, 0, PI2], 12),
      disc(0.225, 0.055, rubber, [s * plateX, y, z]),
      disc(0.08, 0.06, steel, [s * plateX, y, z], 'x', 16),
      disc(0.2, 0.04, rubber, [s * (plateX + 0.055), y, z]),
      disc(0.115, 0.046, P.salmon, [s * (plateX + 0.055), y, z], 'x', 20),
      disc(0.045, 0.035, chrome, [s * (plateX + 0.1), y, z], 'x', 14),
    ]),
  ];

  /** Selectorised weight stack between two chrome guide rods. */
  const weightStack = (x: number, z: number, baseY: number, plates: number, w = 0.34, d = 0.12): Geo[] => {
    const parts: Geo[] = [];
    for (let i = 0; i < plates; i++) {
      parts.push(box(w, 0.042, d, iron, [x, baseY + 0.025 + i * 0.05, z]));
    }
    const top = baseY + plates * 0.05;
    parts.push(box(w, 0.06, d, frame, [x, top + 0.035, z]));
    parts.push(cyl(0.008, 0.008, 0.07, P.salmon, [x, baseY + Math.floor(plates * 0.6) * 0.05 + 0.025, z + d / 2 + 0.03], [PI2, 0, 0], 6));
    return parts;
  };

  const buildTreadmill = (): Geo => {
    const tilt = -0.42;
    const consoleCenter: Vec3 = [0, 1.28, -0.86];
    return fit(
      [
        // deck, belt, side landing rails
        rbox(0.86, 0.12, 1.9, 0.04, frame, [0, 0.1, 0.02]),
        box(0.54, 0.02, 1.56, belt, [0, 0.168, 0.12]),
        cyl(0.05, 0.05, 0.56, steel, [0, 0.12, 0.93], [0, 0, PI2], 12),
        ...[-1, 1].flatMap(s => [
          rbox(0.13, 0.05, 1.58, 0.02, shroud, [s * 0.355, 0.178, 0.1]),
          box(0.012, 0.03, 1.5, P.salmon, [s * 0.425, 0.17, 0.1]),
          disc(0.045, 0.05, rubber, [s * 0.4, 0.045, 0.9], 'x', 12),
        ]),
        // motor hood
        rbox(0.9, 0.24, 0.5, 0.09, shroud, [0, 0.2, -0.72]),
        // uprights, side handrails, front grab bar
        ...[-1, 1].flatMap(s => [
          ...tube(
            [
              [s * 0.42, 0.14, -0.7],
              [s * 0.42, 1.02, -0.88],
              [s * 0.42, 1.2, -0.84],
            ],
            0.036,
            frame,
            10,
          ),
          ...tube(
            [
              [s * 0.42, 1.12, -0.86],
              [s * 0.42, 1.08, -0.3],
              [s * 0.42, 0.97, -0.18],
            ],
            0.026,
            rubber,
            8,
          ),
        ]),
        ...tube(
          [
            [-0.42, 1.17, -0.85],
            [0.42, 1.17, -0.85],
          ],
          0.024,
          steel,
        ),
        // console, touchscreen, accent, safety key
        rbox(0.82, 0.32, 0.1, 0.04, shroud, consoleCenter, [tilt, 0, 0]),
        screenOn(0.5, 0.22, [0, 1.3, -0.86], tilt, 0.052),
        screenOn(0.5, 0.02, [0, 1.16, -0.8], tilt, 0.052, P.salmon),
        disc(0.022, 0.02, P.salmon, [0.3, 1.2, -0.79], 'z', 10),
      ],
      dims.treadmill,
    );
  };

  const buildUprightBike = (): Geo =>
    fit(
      [
        // stabilisers with rubber feet
        ...[-0.5, 0.5].flatMap(z => [
          cyl(0.035, 0.035, 0.6, frame, [0, 0.04, z], [0, 0, PI2], 10),
          disc(0.045, 0.05, rubber, [-0.3, 0.045, z], 'x', 12),
          disc(0.045, 0.05, rubber, [0.3, 0.045, z], 'x', 12),
        ]),
        // main frame spine
        ...tube(
          [
            [0, 0.06, 0.5],
            [0, 0.3, 0.24],
            [0, 0.44, -0.12],
            [0, 0.07, -0.5],
          ],
          0.045,
          frame,
          10,
        ),
        // flywheel shroud, crank, pedals
        disc(0.27, 0.15, shroud, [0, 0.37, -0.14]),
        disc(0.2, 0.156, P.salmon, [0, 0.37, -0.14]),
        disc(0.07, 0.2, steel, [0, 0.34, 0.02], 'x', 14),
        box(0.02, 0.17, 0.035, steel, [-0.11, 0.27, 0.0]),
        box(0.02, 0.17, 0.035, steel, [0.11, 0.41, 0.04]),
        rbox(0.1, 0.03, 0.16, 0.012, rubber, [-0.17, 0.2, -0.02]),
        rbox(0.1, 0.03, 0.16, 0.012, rubber, [0.17, 0.48, 0.06]),
        // seat post and saddle
        ...tube(
          [
            [0, 0.36, 0.2],
            [0, 0.93, 0.34],
          ],
          0.028,
          chrome,
        ),
        rbox(0.25, 0.08, 0.2, 0.038, vinyl, [0, 0.975, 0.42]),
        rbox(0.11, 0.065, 0.2, 0.03, vinyl, [0, 0.968, 0.26]),
        // handlebar mast, bars, display
        ...tube(
          [
            [0, 0.42, -0.2],
            [0, 1.12, -0.4],
          ],
          0.036,
          frame,
          10,
        ),
        ...tube(
          [
            [-0.26, 1.27, -0.22],
            [-0.26, 1.15, -0.36],
            [0, 1.13, -0.41],
            [0.26, 1.15, -0.36],
            [0.26, 1.27, -0.22],
          ],
          0.021,
          rubber,
          8,
          0.05,
        ),
        rbox(0.26, 0.19, 0.045, 0.02, shroud, [0, 1.23, -0.45], [-0.45, 0, 0]),
        screenOn(0.21, 0.14, [0, 1.23, -0.45], -0.45, 0.025),
      ],
      dims['upright-bike'],
    );

  const buildElliptical = (): Geo =>
    fit(
      [
        // base rails and stabilisers
        ...[-0.3, 0.3].flatMap(x =>
          tube(
            [
              [x, 0.05, -0.92],
              [x, 0.05, 0.96],
            ],
            0.04,
            frame,
            10,
          ),
        ),
        ...[-0.92, 0.96].flatMap(z => [
          cyl(0.04, 0.04, 0.84, frame, [0, 0.045, z], [0, 0, PI2], 10),
          disc(0.05, 0.05, rubber, [-0.42, 0.05, z], 'x', 12),
          disc(0.05, 0.05, rubber, [0.42, 0.05, z], 'x', 12),
        ]),
        // rear drive housing
        disc(0.36, 0.24, shroud, [0, 0.43, 0.6]),
        disc(0.22, 0.25, P.salmon, [0, 0.43, 0.6]),
        disc(0.06, 0.5, steel, [0, 0.43, 0.6], 'x', 12),
        // pedal arms and foot plates
        ...tube(
          [
            [-0.26, 0.52, 0.78],
            [-0.26, 0.25, -0.46],
          ],
          0.03,
          steel,
        ),
        ...tube(
          [
            [0.26, 0.32, 0.42],
            [0.26, 0.2, -0.56],
          ],
          0.03,
          steel,
        ),
        rbox(0.19, 0.05, 0.42, 0.02, rubber, [-0.26, 0.37, 0.14], [0.22, 0, 0]),
        rbox(0.19, 0.05, 0.42, 0.02, rubber, [0.26, 0.29, -0.06], [0.12, 0, 0]),
        // console tower
        ...tube(
          [
            [0, 0.08, -0.7],
            [0, 1.22, -0.86],
          ],
          0.06,
          frame,
          12,
        ),
        rbox(0.44, 0.3, 0.08, 0.03, shroud, [0, 1.44, -0.84], [-0.42, 0, 0]),
        screenOn(0.36, 0.2, [0, 1.44, -0.84], -0.42, 0.042),
        screenOn(0.36, 0.02, [0, 1.3, -0.78], -0.42, 0.042, P.salmon),
        ...tube(
          [
            [-0.18, 1.22, -0.62],
            [-0.14, 1.2, -0.8],
            [0.14, 1.2, -0.8],
            [0.18, 1.22, -0.62],
          ],
          0.02,
          rubber,
          8,
          0.05,
        ),
        // moving stride arms with grips
        ...tube(
          [
            [-0.36, 0.3, -0.48],
            [-0.36, 1.02, -0.5],
            [-0.36, 1.36, -0.4],
          ],
          0.025,
          chrome,
        ),
        ...tube(
          [
            [-0.36, 1.36, -0.4],
            [-0.36, 1.6, -0.34],
          ],
          0.031,
          rubber,
        ),
        ...tube(
          [
            [0.36, 0.26, -0.56],
            [0.36, 1.0, -0.6],
            [0.36, 1.34, -0.58],
          ],
          0.025,
          chrome,
        ),
        ...tube(
          [
            [0.36, 1.34, -0.58],
            [0.36, 1.58, -0.6],
          ],
          0.031,
          rubber,
        ),
      ],
      dims.elliptical,
    );

  const buildSmithMachine = (): Geo => {
    const parts: Geo[] = [
      // base
      box(0.12, 0.08, 1.52, frame, [-0.82, 0.04, 0]),
      box(0.12, 0.08, 1.52, frame, [0.82, 0.04, 0]),
      box(1.76, 0.08, 0.12, frame, [0, 0.04, -0.66]),
      // columns, braces, header
      box(0.1, 2.16, 0.1, frame, [-0.82, 1.12, -0.18]),
      box(0.1, 2.16, 0.1, frame, [0.82, 1.12, -0.18]),
      box(0.08, 2.14, 0.08, frame, [-0.82, 1.1, -0.58], [0.18, 0, 0]),
      box(0.08, 2.14, 0.08, frame, [0.82, 1.1, -0.58], [0.18, 0, 0]),
      box(1.84, 0.12, 0.2, frame, [0, 2.16, -0.24]),
      box(0.5, 0.07, 0.012, P.salmon, [0, 2.16, -0.135]),
      // chrome guide rods with linear bearings
      ...[-0.72, 0.72].flatMap(x => [
        cyl(0.02, 0.02, 2.04, chrome, [x, 1.08, -0.02], undefined, 12),
        cyl(0.04, 0.04, 0.16, steel, [x, 1.15, -0.02], undefined, 12),
      ]),
      ...barbell(1.15, -0.02, 2.14, 0.9),
    ];
    // lock-out pegs up the columns and plate storage horns
    for (const s of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        parts.push(box(0.03, 0.025, 0.07, steel, [s * 0.82, 0.5 + i * 0.16, -0.1]));
      }
      parts.push(cyl(0.024, 0.024, 0.24, chrome, [s * 0.97, 0.62, -0.5], [0, 0, PI2], 10));
      parts.push(disc(0.2, 0.05, rubber, [s * 0.98, 0.62, -0.5]));
      parts.push(disc(0.15, 0.04, rubber, [s * 1.04, 0.62, -0.5]));
    }
    return fit(parts, dims['smith-machine']);
  };

  const buildLatPulldown = (): Geo =>
    fit(
      [
        // base
        box(0.1, 0.07, 1.4, frame, [0, 0.035, 0]),
        box(0.9, 0.07, 0.1, frame, [0, 0.035, -0.6]),
        box(0.6, 0.07, 0.1, frame, [0, 0.035, 0.6]),
        // weight stack frame, shroud back, guide rods, plates
        box(0.07, 2.06, 0.07, frame, [-0.27, 1.05, -0.52]),
        box(0.07, 2.06, 0.07, frame, [0.27, 1.05, -0.52]),
        box(0.62, 2.0, 0.02, shroud, [0, 1.04, -0.6]),
        cyl(0.011, 0.011, 1.9, chrome, [-0.1, 1.05, -0.5], undefined, 8),
        cyl(0.011, 0.011, 1.9, chrome, [0.1, 1.05, -0.5], undefined, 8),
        ...weightStack(0, -0.5, 0.16, 15),
        // boom, pulleys, cables
        box(0.09, 0.1, 1.02, frame, [0, 2.12, -0.12]),
        disc(0.07, 0.03, steel, [0, 2.05, 0.3], 'x', 18),
        disc(0.07, 0.03, steel, [0, 2.05, -0.5], 'x', 18),
        cyl(0.006, 0.006, 0.2, cable, [0, 1.94, 0.3], undefined, 6),
        cyl(0.006, 0.006, 0.98, cable, [0, 1.52, -0.5], undefined, 6),
        cyl(0.006, 0.006, 0.8, cable, [0, 2.12, -0.1], [PI2, 0, 0], 6),
        // lat bar with rubber grips
        ...tube(
          [
            [-0.62, 1.74, 0.3],
            [-0.42, 1.83, 0.3],
            [0.42, 1.83, 0.3],
            [0.62, 1.74, 0.3],
          ],
          0.016,
          chrome,
          8,
          0.06,
        ),
        ...tube(
          [
            [-0.63, 1.735, 0.3],
            [-0.47, 1.808, 0.3],
          ],
          0.021,
          rubber,
        ),
        ...tube(
          [
            [0.63, 1.735, 0.3],
            [0.47, 1.808, 0.3],
          ],
          0.021,
          rubber,
        ),
        // seat and thigh hold-down rollers
        box(0.08, 0.44, 0.08, frame, [0, 0.25, 0.3]),
        rbox(0.36, 0.075, 0.4, 0.032, vinyl, [0, 0.5, 0.3]),
        box(0.07, 0.62, 0.07, frame, [0, 0.38, 0.02]),
        cyl(0.014, 0.014, 0.5, chrome, [0, 0.72, 0.06], [0, 0, PI2], 8),
        cyl(0.07, 0.07, 0.19, vinyl, [-0.15, 0.72, 0.06], [0, 0, PI2], 16),
        cyl(0.07, 0.07, 0.19, vinyl, [0.15, 0.72, 0.06], [0, 0, PI2], 16),
      ],
      dims['lat-pulldown'],
    );

  const buildSquatRack = (): Geo => {
    const parts: Geo[] = [
      // platform: rubber wings, oak centre
      box(1.66, 0.05, 1.74, rubber, [0, 0.025, 0]),
      box(0.86, 0.054, 1.72, P.wood, [0, 0.027, 0]),
      // uprights and top frame
      ...[-0.62, 0.62].flatMap(x => [
        box(0.08, 2.2, 0.08, frame, [x, 1.15, -0.56]),
        box(0.08, 2.2, 0.08, frame, [x, 1.15, 0.26]),
        box(0.08, 0.08, 0.9, frame, [x, 2.21, -0.15]),
        box(0.07, 0.06, 0.92, steel, [x, 0.88, -0.15]),
        // J-hooks
        box(0.05, 0.12, 0.05, steel, [x, 1.36, 0.325]),
        box(0.05, 0.03, 0.09, steel, [x, 1.33, 0.36]),
      ]),
      box(1.32, 0.1, 0.08, frame, [0, 2.2, -0.56]),
      box(0.4, 0.06, 0.012, P.salmon, [0, 2.2, -0.515]),
      ...tube(
        [
          [-0.62, 2.18, 0.26],
          [0.62, 2.18, 0.26],
        ],
        0.017,
        chrome,
        10,
      ),
      ...barbell(1.4, 0.37, 1.66, 0.7),
    ];
    for (const s of [-1, 1]) {
      // numbered adjustment holes read as a dotted line up each upright
      for (let i = 0; i < 12; i++) {
        parts.push(box(0.03, 0.02, 0.006, P.charcoalDeep, [s * 0.62, 0.5 + i * 0.13, 0.303]));
      }
      // rear plate storage
      parts.push(cyl(0.024, 0.024, 0.2, chrome, [s * 0.74, 0.5, -0.56], [0, 0, PI2], 10));
      parts.push(disc(0.2, 0.05, rubber, [s * 0.72, 0.5, -0.56]));
      parts.push(disc(0.2, 0.05, rubber, [s * 0.78, 0.5, -0.56]));
    }
    return fit(parts, dims['squat-rack']);
  };

  const buildDumbbellRack = (): Geo => {
    const parts: Geo[] = [];
    // three side frames from bent tube, two angled trays
    for (const x of [-1.18, 0, 1.18]) {
      parts.push(
        ...tube(
          [
            [x, 0.03, -0.34],
            [x, 0.9, -0.2],
            [x, 0.5, 0.3],
            [x, 0.03, 0.34],
          ],
          0.032,
          frame,
          8,
          0.06,
        ),
      );
      parts.push(disc(0.045, 0.05, rubber, [x, 0.03, -0.34], 'y', 10));
      parts.push(disc(0.045, 0.05, rubber, [x, 0.03, 0.34], 'y', 10));
    }
    parts.push(box(2.5, 0.025, 0.3, frame, [0, 0.76, -0.1], [0.2, 0, 0]));
    parts.push(box(2.5, 0.025, 0.34, frame, [0, 0.4, 0.1], [0.2, 0, 0]));
    parts.push(box(2.5, 0.05, 0.02, steel, [0, 0.75, 0.055], [0.2, 0, 0]));
    parts.push(box(2.5, 0.05, 0.02, steel, [0, 0.385, 0.275], [0.2, 0, 0]));
    // hex rubber dumbbells, heavier toward the right and on the bottom tray
    const dumbbell = (x: number, y: number, z: number, r: number): Geo[] => [
      cyl(0.014, 0.014, 0.16, chrome, [x, y, z], [PI2 + 0.2, 0, 0], 8),
      cyl(r, r, 0.085, rubber, [x, y + 0.021, z - 0.105], [PI2 + 0.2, 0, 0], 6),
      cyl(r, r, 0.085, rubber, [x, y - 0.021, z + 0.105], [PI2 + 0.2, 0, 0], 6),
    ];
    for (let i = 0; i < 10; i++) {
      const x = -1.06 + i * 0.235;
      parts.push(...dumbbell(x, 0.79 + 0.045 + i * 0.002, -0.1, 0.05 + i * 0.003));
    }
    for (let i = 0; i < 8; i++) {
      const x = -1.03 + i * 0.295;
      parts.push(...dumbbell(x, 0.43 + 0.07 + i * 0.003, 0.1, 0.075 + i * 0.004));
    }
    return fit(parts, dims['dumbbell-rack']);
  };

  const buildAdjustableBench = (): Geo =>
    fit(
      [
        // feet with rubber caps and transport wheels
        cyl(0.03, 0.03, 0.64, frame, [0, 0.035, -0.56], [0, 0, PI2], 10),
        cyl(0.03, 0.03, 0.5, frame, [0, 0.035, 0.56], [0, 0, PI2], 10),
        disc(0.04, 0.05, rubber, [-0.3, 0.04, -0.56], 'x', 12),
        disc(0.04, 0.05, rubber, [0.3, 0.04, -0.56], 'x', 12),
        disc(0.045, 0.03, rubber, [-0.24, 0.045, 0.56], 'x', 14),
        disc(0.045, 0.03, rubber, [0.24, 0.045, 0.56], 'x', 14),
        // spine
        ...tube(
          [
            [0, 0.04, 0.56],
            [0, 0.3, 0.42],
            [0, 0.36, -0.12],
            [0, 0.04, -0.56],
          ],
          0.04,
          frame,
          10,
        ),
        // upholstered seat and back pad with stitched piping underneath
        rbox(0.3, 0.075, 0.36, 0.032, vinyl, [0, 0.46, 0.36], [-0.12, 0, 0]),
        rbox(0.3, 0.085, 0.84, 0.036, vinyl, [0, 0.66, -0.22], [0.46, 0, 0]),
        box(0.31, 0.012, 0.8, P.salmon, [0, 0.625, -0.245], [0.46, 0, 0]),
        // back support ladder and pop-pin
        ...tube(
          [
            [0, 0.3, -0.1],
            [0, 0.54, -0.42],
          ],
          0.022,
          steel,
        ),
        box(0.14, 0.03, 0.34, steel, [0, 0.36, -0.2], [0.1, 0, 0]),
        cyl(0.014, 0.014, 0.08, chrome, [0.09, 0.36, -0.1], [0, 0, PI2], 8),
      ],
      dims['adjustable-bench'],
    );

  const buildKinesisStation = (): Geo => {
    const parts: Geo[] = [
      box(2.34, 0.06, 1.48, frame, [0, 0.03, 0]),
      box(2.28, 2.16, 0.2, shroud, [0, 1.12, -0.58]),
      box(1.42, 2.08, 0.04, P.wood, [0, 1.12, -0.46]),
      box(1.44, 0.05, 0.05, P.salmon, [0, 2.14, -0.455]),
      rbox(0.44, 0.56, 0.04, 0.015, frame, [0, 1.42, -0.43]),
      box(0.38, 0.5, 0.012, P.screen, [0, 1.42, -0.405]),
    ];
    for (const s of [-1, 1]) {
      // weight tower with visible stack behind a slot
      parts.push(box(0.38, 2.1, 0.3, frame, [s * 0.92, 1.1, -0.52]));
      parts.push(box(0.2, 1.2, 0.012, P.charcoalDeep, [s * 0.92, 0.9, -0.365]));
      parts.push(...weightStack(s * 0.92, -0.37, 0.34, 12, 0.16, 0.03));
      // three articulated pulley arms per side, each ending in a swivel pulley and handle
      const arms: Array<[Vec3, Vec3]> = [
        [
          [s * 0.9, 1.98, -0.4],
          [s * 0.78, 1.92, 0.42],
        ],
        [
          [s * 0.98, 1.16, -0.4],
          [s * 1.02, 1.16, 0.3],
        ],
        [
          [s * 0.86, 0.32, -0.4],
          [s * 0.86, 0.32, 0.2],
        ],
      ];
      for (const [from, to] of arms) {
        parts.push(...tube([from, to], 0.028, chrome, 10));
        parts.push(disc(0.06, 0.03, steel, [to[0], to[1], to[2]], 'x', 16));
        parts.push(cyl(0.005, 0.005, 0.2, cable, [to[0], to[1] - 0.13, to[2] + 0.03], undefined, 6));
        parts.push(
          ...tube(
            [
              [to[0] - 0.06, to[1] - 0.24, to[2] + 0.03],
              [to[0] + 0.06, to[1] - 0.24, to[2] + 0.03],
            ],
            0.016,
            rubber,
          ),
        );
      }
    }
    return fit(parts, dims['kinesis-station']);
  };

  const buildHeavyBag = (): Geo => {
    const parts: Geo[] = [
      // tripod base and stanchion
      ...tube(
        [
          [-0.4, 0.035, -0.36],
          [0.4, 0.035, -0.36],
        ],
        0.035,
        frame,
        10,
      ),
      ...tube(
        [
          [0, 0.035, -0.36],
          [0, 0.035, 0.42],
        ],
        0.035,
        frame,
        10,
      ),
      ...tube(
        [
          [0, 0.04, -0.36],
          [0, 2.2, -0.36],
          [0, 2.24, 0.14],
        ],
        0.045,
        frame,
        10,
        0.14,
      ),
      ...tube(
        [
          [0, 1.7, -0.36],
          [0, 2.2, -0.05],
        ],
        0.022,
        frame,
      ),
      // swivel, bag, strap band
      disc(0.03, 0.06, chrome, [0, 2.17, 0.1], 'y', 10),
      shape(new THREE.CapsuleGeometry(0.2, 0.86, 5, 20), leather, [0, 1.26, 0.1]),
      cyl(0.203, 0.203, 0.16, P.salmon, [0, 1.42, 0.1], undefined, 20),
      disc(0.11, 0.02, steel, [0, 1.9, 0.1], 'y', 16),
    ];
    // four chains from the swivel to the bag's top ring
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const tx = Math.cos(a) * 0.1;
      const tz = Math.sin(a) * 0.1;
      parts.push(
        ...tube(
          [
            [0, 2.15, 0.1],
            [tx, 1.9, 0.1 + tz],
          ],
          0.008,
          chrome,
          5,
        ),
      );
    }
    return fit(parts, dims['heavy-bag']);
  };

  const buildSpeedBag = (): Geo => {
    // teardrop profile revolved around Y
    const profile = [
      [0.0, -0.17],
      [0.07, -0.15],
      [0.115, -0.08],
      [0.12, 0.0],
      [0.09, 0.09],
      [0.045, 0.15],
      [0.025, 0.18],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return fit(
      [
        disc(0.36, 0.06, frame, [0, 0.03, 0], 'y', 24),
        ...tube(
          [
            [0, 0.05, -0.24],
            [0, 1.9, -0.24],
            [0, 1.94, 0.02],
          ],
          0.045,
          frame,
          10,
          0.1,
        ),
        // rebound platform with steel rim
        disc(0.34, 0.045, P.wood, [0, 1.8, 0.08], 'y', 28),
        disc(0.345, 0.02, steel, [0, 1.8, 0.08], 'y', 28),
        // swivel and bag
        disc(0.03, 0.05, chrome, [0, 1.755, 0.08], 'y', 10),
        shape(new THREE.LatheGeometry(profile, 16), leather, [0, 1.55, 0.08]),
        cyl(0.03, 0.03, 0.03, P.salmon, [0, 1.71, 0.08], undefined, 10),
      ],
      dims['speed-bag'],
    );
  };

  const buildBoxingRing = (): Geo => {
    const parts: Geo[] = [
      // apron skirt, canvas, centre emblem
      box(5.5, 0.44, 5.5, frame, [0, 0.22, 0]),
      box(5.3, 0.05, 5.3, P.stone, [0, 0.465, 0]),
      box(1.8, 0.012, 1.8, P.salmon, [0, 0.492, 0]),
      box(1.4, 0.014, 1.4, P.charcoalDeep, [0, 0.493, 0]),
    ];
    const corners: Array<[number, number, string]> = [
      [-2.55, -2.55, P.salmon],
      [2.55, 2.55, P.white],
      [-2.55, 2.55, vinyl],
      [2.55, -2.55, vinyl],
    ];
    for (const [x, z, color] of corners) {
      parts.push(cyl(0.06, 0.06, 1.2, steel, [x, 1.0, z], undefined, 14));
      // padded corner cushion facing the ring centre
      const inward = 0.1;
      parts.push(
        h.roundedBox(0.3, 0.9, 0.3, 0.07, color, [x - Math.sign(x) * inward, 1.08, z - Math.sign(z) * inward], [0, Math.PI / 4, 0]),
      );
    }
    // four rope tiers: padded ropes tied into the posts with turnbuckles
    const tiers: Array<[number, string]> = [
      [0.72, P.white],
      [0.98, P.salmon],
      [1.24, P.white],
      [1.5, P.salmon],
    ];
    for (const [y, color] of tiers) {
      const e = 2.38;
      parts.push(cyl(0.02, 0.02, e * 2, color, [0, y, -e], [0, 0, PI2], 8));
      parts.push(cyl(0.02, 0.02, e * 2, color, [0, y, e], [0, 0, PI2], 8));
      parts.push(cyl(0.02, 0.02, e * 2, color, [-e, y, 0], [PI2, 0, 0], 8));
      parts.push(cyl(0.02, 0.02, e * 2, color, [e, y, 0], [PI2, 0, 0], 8));
    }
    // rope spacers
    for (const s of [-1, 1]) {
      for (const t of [-1.2, 1.2]) {
        parts.push(box(0.03, 0.8, 0.02, P.white, [t, 1.11, s * 2.38]));
        parts.push(box(0.02, 0.8, 0.03, P.white, [s * 2.38, 1.11, t]));
      }
    }
    return fit(parts, dims['boxing-ring']);
  };

  return {
    treadmill: buildTreadmill,
    'upright-bike': buildUprightBike,
    elliptical: buildElliptical,
    'smith-machine': buildSmithMachine,
    'lat-pulldown': buildLatPulldown,
    'squat-rack': buildSquatRack,
    'dumbbell-rack': buildDumbbellRack,
    'adjustable-bench': buildAdjustableBench,
    'kinesis-station': buildKinesisStation,
    'heavy-bag': buildHeavyBag,
    'speed-bag': buildSpeedBag,
    'boxing-ring': buildBoxingRing,
  };
}
