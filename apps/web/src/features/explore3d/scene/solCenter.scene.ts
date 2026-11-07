import type {
  BuildingNode,
  HotspotNode,
  ItemNode,
  LevelNode,
  SceneDoc,
  SceneNode,
  SiteNode,
  Vec2,
  Vec3,
  WallNode,
  ZoneNode,
} from './schema';

function rectPolygon(minX: number, minZ: number, maxX: number, maxZ: number): Vec2[] {
  // Counter-clockwise in XZ plane
  return [
    [minX, minZ],
    [maxX, minZ],
    [maxX, maxZ],
    [minX, maxZ],
  ];
}

const nodes: Record<string, SceneNode> = {};

function register<T extends SceneNode>(node: T): T {
  nodes[node.id] = node;
  return node;
}

const siteNode: SiteNode = register({
  id: 'site-sol',
  type: 'site',
  parentId: null,
  name: {
    vi: 'Tổ hợp SÖL Fitness & Wellness',
    en: 'SÖL Fitness & Wellness Center',
  },
  bounds: [72, 48],
  children: ['bld-main'],
  viewpoints: [
    {
      id: 'vp-site-overview',
      label: { vi: 'Toàn cảnh trung tâm', en: 'Center Overview' },
      kind: 'overview',
      position: [46, 36, 48],
      target: [4, 2, 0],
      fov: 38,
    },
    {
      id: 'vp-site-front',
      label: { vi: 'Mặt tiền & Biển hiệu SÖL', en: 'SÖL Facade & Signage' },
      kind: 'hero',
      position: [2, 17, 44],
      target: [2, 4, 8],
      fov: 38,
    },
    {
      id: 'vp-site-gate',
      label: { vi: 'Cổng chính & Đài phun nước', en: 'Main Gate & Fountain' },
      kind: 'hero',
      position: [14, 11, 38],
      target: [5.5, 2.4, 21],
      fov: 38,
    },
    {
      id: 'vp-site-parking',
      label: { vi: 'Bãi đỗ xe Ô tô & Xe máy', en: 'Car, EV & Motorbike Parking' },
      kind: 'hero',
      position: [34, 15, 38],
      target: [25, 1.5, 19.8],
      fov: 38,
    },
  ],
});

const buildingNode: BuildingNode = register({
  id: 'bld-main',
  type: 'building',
  parentId: 'site-sol',
  name: {
    vi: 'Tòa nhà chính & Khu sân ngoài trời',
    en: 'Main Sanctuary & Outdoor Courts',
  },
  footprint: [44, 32],
  position: [0, 0, 0],
  children: ['lvl-b1', 'lvl-l1', 'lvl-l2', 'lvl-rf', 'lvl-out'],
});

// ============================================================================
// LEVEL B1 — Tầng hầm Oasis (elevation = -4.5m)
// ============================================================================

const B1_Y = -4.5;

const levelB1: LevelNode = register({
  id: 'lvl-b1',
  type: 'level',
  parentId: 'bld-main',
  code: 'B1',
  order: 0,
  name: { vi: 'Tầng B1 · Oasis Sub-level', en: 'B1 · Oasis Sub-level' },
  subtitle: {
    vi: 'Hồ bơi phân làn 25m, Xông hơi Thermal & Phòng thay đồ',
    en: '25m Oasis Lap Pool, Thermal Spa & Locker Rooms',
  },
  elevation: B1_Y,
  explodedOffset: -6.0,
  height: 4.0,
  slabThickness: 0.28,
  slabPolygon: rectPolygon(-22, -16, 22, 16),
  children: [],
  viewpoints: [
    {
      id: 'vp-b1-overview',
      label: { vi: 'Toàn cảnh Tầng hầm Oasis', en: 'B1 Oasis Overview' },
      kind: 'overview',
      position: [26, B1_Y + 22, 28],
      target: [-2, B1_Y + 1, 0],
      fov: 38,
    },
  ],
});

// Zones on B1
const zoneB1Pool: ZoneNode = register({
  id: 'zone-b1-pool',
  type: 'zone',
  parentId: 'lvl-b1',
  code: 'B1-POOL',
  name: { vi: 'Oasis Lap Pool (Hồ bơi 25m)', en: 'Oasis Lap Pool (25m)' },
  description: {
    vi: 'Hồ bơi nước ấm phân 2 làn tiêu chuẩn 25m phục vụ bơi lội thể lực và phục hồi dưới nước.',
    en: 'Heated 25m two-lane lap pool for endurance swimming and aquatic recovery.',
  },
  category: 'pool',
  polygon: rectPolygon(-20, -14, 8, 4),
  floorMaterial: 'water',
  accentColor: '#3a7ca5',
  liveBinding: {
    roomName: 'Oasis Lap Pool',
    discipline: 'Bơi lội',
    courtDiscipline: 'Bơi lội',
  },
  viewpoints: [
    {
      id: 'vp-zone-b1-pool-hero',
      label: { vi: 'Góc nhìn Hồ bơi Oasis', en: 'Oasis Pool Hero View' },
      kind: 'hero',
      position: [12, B1_Y + 9.5, 12],
      target: [-6, B1_Y + 0.5, -5],
      fov: 38,
    },
    {
      id: 'vp-zone-b1-pool-eye',
      label: { vi: 'Đứng cạnh thành hồ', en: 'Poolside Eye View' },
      kind: 'eye',
      position: [6, B1_Y + 1.65, -5],
      target: [-16, B1_Y + 1.0, -5],
      fov: 50,
    },
  ],
  children: [],
});

const zoneB1Thermal: ZoneNode = register({
  id: 'zone-b1-thermal',
  type: 'zone',
  parentId: 'lvl-b1',
  code: 'B1-THERMAL',
  name: { vi: 'Khu Xông hơi & Phục hồi Thermal', en: 'Thermal Sauna & Recovery' },
  description: {
    vi: 'Phòng xông hơi đá muối, bồn sục Jacuzzi phục hồi cơ chuyên sâu dành cho hội viên Platinum.',
    en: 'Salt-stone sauna and hydro-recovery Jacuzzi reserved for Platinum members.',
  },
  category: 'pool',
  polygon: rectPolygon(8, -14, 20, 4),
  floorMaterial: 'tile-stone',
  accentColor: '#ce9180',
  liveBinding: {
    tierRequired: 'PLATINUM',
  },
  viewpoints: [
    {
      id: 'vp-zone-b1-thermal-hero',
      label: { vi: 'Góc nhìn Khu Thermal', en: 'Thermal Spa View' },
      kind: 'hero',
      position: [24, B1_Y + 8.5, 10],
      target: [14, B1_Y + 1.0, -5],
      fov: 38,
    },
    {
      id: 'vp-zone-b1-thermal-eye',
      label: { vi: 'Đứng trong khu Thermal & Jacuzzi', en: 'Thermal Spa Eye View' },
      kind: 'eye',
      position: [10.2, B1_Y + 1.65, 2.5],
      target: [14.0, B1_Y + 1.1, -6.5],
      fov: 50,
    },
  ],
  children: [],
});

const zoneB1Locker: ZoneNode = register({
  id: 'zone-b1-locker',
  type: 'zone',
  parentId: 'lvl-b1',
  code: 'B1-LOCKER',
  name: { vi: 'Phòng Thay đồ & Tủ khóa thông minh', en: 'Smart Locker & Changing Sanctuary' },
  description: {
    vi: 'Hệ thống tủ khóa từ thông minh gắn với Thẻ hội viên SÖL và khu vực tắm tráng tiện nghi.',
    en: 'Smart RFID locker banks linked to your SÖL Member Card and changing amenities.',
  },
  category: 'locker',
  polygon: rectPolygon(-20, 4, 8, 14),
  floorMaterial: 'tile-stone',
  viewpoints: [
    {
      id: 'vp-zone-b1-locker-hero',
      label: { vi: 'Khu Tủ khóa & Thay đồ', en: 'Locker Room View' },
      kind: 'hero',
      position: [4, B1_Y + 8.0, 20],
      target: [-6, B1_Y + 1.2, 9],
      fov: 38,
    },
    {
      id: 'vp-zone-b1-locker-eye',
      label: { vi: 'Góc nhìn Dãy Tủ khóa thông minh', en: 'Locker Aisle Eye View' },
      kind: 'eye',
      position: [5.5, B1_Y + 1.65, 12.2],
      target: [-9.0, B1_Y + 1.2, 9.0],
      fov: 50,
    },
  ],
  children: [],
});

const zoneB1Core: ZoneNode = register({
  id: 'zone-b1-core',
  type: 'zone',
  parentId: 'lvl-b1',
  code: 'B1-CORE',
  name: { vi: 'Sảnh Thang máy & Cầu thang Tầng B1', en: 'B1 Elevator & Stair Core' },
  description: {
    vi: 'Trục giao thông đứng kết nối Tầng hầm Oasis với Sảnh chính Tầng 1 và Khu VIP Tầng 2.',
    en: 'Vertical circulation core connecting B1 Oasis with L1 Main Lobby and L2 VIP Sanctuary.',
  },
  category: 'circulation',
  polygon: rectPolygon(8, 4, 20, 14),
  floorMaterial: 'concrete-polished',
  viewpoints: [
    {
      id: 'vp-zone-b1-core-hero',
      label: { vi: 'Sảnh thang B1', en: 'B1 Core View' },
      kind: 'hero',
      position: [22, B1_Y + 7.5, 19],
      target: [14, B1_Y + 1.2, 9],
      fov: 38,
    },
    {
      id: 'vp-zone-b1-core-eye',
      label: { vi: 'Đứng trước Thang bộ & Thang máy B1', en: 'B1 Stair & Elevator Eye View' },
      kind: 'eye',
      position: [14.5, B1_Y + 1.65, 13.2],
      target: [14.5, B1_Y + 1.5, 9.0],
      fov: 50,
    },
  ],
  children: [],
});

// ============================================================================
// LEVEL L1 — Tầng 1 · Sảnh chính & Khu tập luyện tiêu chuẩn (elevation = 0.0m)
// ============================================================================

const L1_Y = 0.0;

const levelL1: LevelNode = register({
  id: 'lvl-l1',
  type: 'level',
  parentId: 'bld-main',
  code: 'L1',
  order: 1,
  name: { vi: 'Tầng 1 · Sảnh chính & Khu tập luyện', en: 'L1 · Main Lobby & Training Arena' },
  subtitle: {
    vi: 'Quầy Lễ tân, Cổng QR, Cửa hàng Thực phẩm bổ sung, Gym Tiêu chuẩn, Boxing & 4 Sân Cầu lông',
    en: 'Reception, QR Gate, Supplement Shop, Standard Gym, Boxing Ring & 4 Badminton Courts',
  },
  elevation: L1_Y,
  explodedOffset: 0.0,
  height: 4.2,
  slabThickness: 0.28,
  slabPolygon: rectPolygon(-22, -16, 22, 16),
  children: [],
  viewpoints: [
    {
      id: 'vp-l1-overview',
      label: { vi: 'Toàn cảnh Tầng 1', en: 'Level 1 Overview' },
      kind: 'overview',
      position: [28, L1_Y + 24, 30],
      target: [0, L1_Y + 1.2, 0],
      fov: 38,
    },
  ],
});

const zoneL1Lobby: ZoneNode = register({
  id: 'zone-l1-lobby',
  type: 'zone',
  parentId: 'lvl-l1',
  code: 'L1-LOBBY',
  name: { vi: 'Quầy Lễ tân, Concierge & Bàn Hỗ trợ', en: 'Reception, Concierge & Member Support' },
  description: {
    vi: 'Trung tâm đón tiếp hội viên, tư vấn gói tập, cấp thẻ hội viên, tra cứu hóa đơn và hỗ trợ trực tiếp.',
    en: 'Member welcome desk, package consultation, member card issuance, billing and live support.',
  },
  category: 'reception',
  polygon: rectPolygon(-6, 6, 10, 15),
  floorMaterial: 'tile-stone',
  accentColor: '#ce9180',
  viewpoints: [
    {
      id: 'vp-zone-l1-lobby-hero',
      label: { vi: 'Quầy Lễ tân SÖL', en: 'SÖL Reception View' },
      kind: 'hero',
      position: [2, L1_Y + 7.5, 22],
      target: [2, L1_Y + 1.2, 10.5],
      fov: 38,
    },
    {
      id: 'vp-zone-l1-lobby-eye',
      label: { vi: 'Góc nhìn Hội viên vào Sảnh', en: 'Lobby Entrance Eye View' },
      kind: 'eye',
      position: [2, L1_Y + 1.65, 14.2],
      target: [2, L1_Y + 1.4, 8.5],
      fov: 50,
    },
  ],
  children: [],
});

const zoneL1Gate: ZoneNode = register({
  id: 'zone-l1-gate',
  type: 'zone',
  parentId: 'lvl-l1',
  code: 'L1-GATE',
  name: { vi: 'Cổng Quét QR Check-in Tự động', en: 'Automated QR Check-in Gate' },
  description: {
    vi: 'Cổng kiểm soát ra vào tự động bằng mã QR trên Thẻ hội viên; tự động ghi nhận Streak tập luyện mỗi ngày.',
    en: 'Turnstile gate scanning your Member QR code and recording your daily workout streak.',
  },
  category: 'circulation',
  polygon: rectPolygon(-6, 2, 6, 6),
  floorMaterial: 'concrete-polished',
  accentColor: '#ce9180',
  viewpoints: [
    {
      id: 'vp-zone-l1-gate-hero',
      label: { vi: 'Cổng QR Check-in', en: 'QR Turnstile Gate View' },
      kind: 'hero',
      position: [0, L1_Y + 6.2, 12],
      target: [0, L1_Y + 1.0, 4],
      fov: 36,
    },
    {
      id: 'vp-zone-l1-gate-eye',
      label: { vi: 'Đứng trước Cổng QR Check-in', en: 'QR Turnstile Eye View' },
      kind: 'eye',
      position: [0, L1_Y + 1.65, 6.8],
      target: [0, L1_Y + 1.2, 1.5],
      fov: 50,
    },
  ],
  children: [],
});

const zoneL1Shop: ZoneNode = register({
  id: 'zone-l1-shop',
  type: 'zone',
  parentId: 'lvl-l1',
  code: 'L1-SHOP',
  name: { vi: 'Kệ Thực phẩm bổ sung SÖL Fuel & Recovery', en: 'SÖL Fuel & Recovery Supplement Shop' },
  description: {
    vi: 'Trưng bày Whey Protein, BCAA, Creatine, Pre-workout chính hãng kèm bảng Nutrition Facts minh bạch.',
    en: 'Curated Whey Protein, BCAA, Creatine and Pre-workout shelves with transparent Nutrition Facts.',
  },
  category: 'retail',
  polygon: rectPolygon(10, 6, 20, 15),
  floorMaterial: 'hardwood',
  accentColor: '#ce9180',
  viewpoints: [
    {
      id: 'vp-zone-l1-shop-hero',
      label: { vi: 'Kệ Thực phẩm bổ sung', en: 'Supplement Shop View' },
      kind: 'hero',
      position: [22, L1_Y + 7.2, 20],
      target: [15, L1_Y + 1.3, 10.5],
      fov: 38,
    },
    {
      id: 'vp-zone-l1-shop-eye',
      label: { vi: 'Đứng trước Kệ Thực phẩm bổ sung', en: 'Supplement Shelf Eye View' },
      kind: 'eye',
      position: [11.5, L1_Y + 1.65, 12.2],
      target: [15.5, L1_Y + 1.3, 9.2],
      fov: 50,
    },
  ],
  children: [],
});

const zoneL1Gym: ZoneNode = register({
  id: 'zone-l1-gym',
  type: 'zone',
  parentId: 'lvl-l1',
  code: 'L1-GYM',
  name: { vi: 'Phòng Gym Tiêu chuẩn', en: 'Standard Gym Arena' },
  description: {
    vi: 'Khu tập luyện chính rộng 384m² trang bị đầy đủ dàn Cardio, Smith Machine, Squat Rack và Free Weights.',
    en: '384m² main strength & conditioning floor with commercial cardio, Smith machines, squat racks and free weights.',
  },
  category: 'gym',
  polygon: rectPolygon(-20, -14, 4, 2),
  floorMaterial: 'rubber-dark',
  accentColor: '#ce9180',
  liveBinding: {
    roomName: 'Phòng Gym Tiêu chuẩn',
    discipline: 'Gym',
    tierRequired: 'SILVER',
  },
  viewpoints: [
    {
      id: 'vp-zone-l1-gym-hero',
      label: { vi: 'Phòng Gym Tiêu chuẩn', en: 'Standard Gym Hero View' },
      kind: 'hero',
      position: [8, L1_Y + 10.5, 10],
      target: [-8, L1_Y + 1.0, -6],
      fov: 38,
    },
    {
      id: 'vp-zone-l1-gym-eye',
      label: { vi: 'Đứng giữa sàn Gym', en: 'Gym Floor Eye View' },
      kind: 'eye',
      position: [-2, L1_Y + 1.65, 0],
      target: [-12, L1_Y + 1.3, -8],
      fov: 50,
    },
  ],
  children: [],
});

const zoneL1Boxing: ZoneNode = register({
  id: 'zone-l1-boxing',
  type: 'zone',
  parentId: 'lvl-l1',
  code: 'L1-BOXING',
  name: { vi: 'Ring Arena 01 (Võ đài Boxing & Kickfit)', en: 'Ring Arena 01 (Boxing & Kickfit)' },
  description: {
    vi: 'Đài đấu Boxing tiêu chuẩn cùng hệ thống bao cát nặng và bóng phản xạ tốc độ cao.',
    en: 'Competition-sized boxing ring surrounded by heavy bags and speed-reflex stations.',
  },
  category: 'studio',
  polygon: rectPolygon(4, -14, 20, -4),
  floorMaterial: 'rubber-dark',
  accentColor: '#d97757',
  liveBinding: {
    roomName: 'Ring Arena 01',
    discipline: 'Boxing',
    tierRequired: 'SILVER',
  },
  viewpoints: [
    {
      id: 'vp-zone-l1-boxing-hero',
      label: { vi: 'Võ đài Ring Arena 01', en: 'Ring Arena 01 Hero View' },
      kind: 'hero',
      position: [24, L1_Y + 8.5, 4],
      target: [12, L1_Y + 1.2, -9],
      fov: 38,
    },
    {
      id: 'vp-zone-l1-boxing-eye',
      label: { vi: 'Đứng cạnh Võ đài Boxing', en: 'Boxing Ring Eye View' },
      kind: 'eye',
      position: [5.8, L1_Y + 1.65, -5.2],
      target: [11.5, L1_Y + 1.3, -9.2],
      fov: 50,
    },
  ],
  children: [],
});

const zoneL1Badminton: ZoneNode = register({
  id: 'zone-l1-badminton',
  type: 'zone',
  parentId: 'lvl-l1',
  code: 'L1-BADMINTON',
  name: { vi: 'Nhà thi đấu Cầu lông (Sân 01–04)', en: 'Indoor Badminton Hall (Courts 01–04)' },
  description: {
    vi: 'Bốn sân cầu lông thảm chống trượt tiêu chuẩn thi đấu, đặt lịch theo khung 60 phút từ 06:00–22:00.',
    en: 'Four tournament-grade indoor badminton courts bookable in 60-minute slots from 06:00 to 22:00.',
  },
  category: 'court',
  polygon: rectPolygon(-20, 2, -6, 15),
  floorMaterial: 'acrylic-court',
  accentColor: '#3d7a5a',
  liveBinding: {
    discipline: 'Cầu lông',
    courtDiscipline: 'Cầu lông',
  },
  viewpoints: [
    {
      id: 'vp-zone-l1-badminton-hero',
      label: { vi: 'Cụm 4 Sân Cầu lông', en: 'Badminton Courts 01–04 View' },
      kind: 'hero',
      position: [-2, L1_Y + 10.5, 22],
      target: [-13, L1_Y + 0.8, 8.5],
      fov: 38,
    },
    {
      id: 'vp-zone-l1-badminton-eye',
      label: { vi: 'Đứng giữa Nhà thi đấu Cầu lông', en: 'Badminton Hall Eye View' },
      kind: 'eye',
      position: [-7.2, L1_Y + 1.65, 8.5],
      target: [-15.5, L1_Y + 1.1, 8.5],
      fov: 50,
    },
  ],
  children: [],
});

const zoneL1Core: ZoneNode = register({
  id: 'zone-l1-core',
  type: 'zone',
  parentId: 'lvl-l1',
  code: 'L1-CORE',
  name: { vi: 'Sảnh Thang máy & Cầu thang Tầng 1', en: 'L1 Elevator & Stair Core' },
  description: {
    vi: 'Lối lên Khu VIP Platinum Tầng 2, Zen Garden Tầng thượng và xuống Tầng hầm Oasis.',
    en: 'Vertical core connecting to L2 VIP Platinum Sanctuary, Rooftop Zen Garden and B1 Oasis.',
  },
  category: 'circulation',
  polygon: rectPolygon(6, -4, 20, 6),
  floorMaterial: 'concrete-polished',
  viewpoints: [
    {
      id: 'vp-zone-l1-core-hero',
      label: { vi: 'Sảnh thang Tầng 1', en: 'L1 Core View' },
      kind: 'hero',
      position: [24, L1_Y + 7.5, 8],
      target: [13, L1_Y + 1.2, 1],
      fov: 38,
    },
    {
      id: 'vp-zone-l1-core-eye',
      label: { vi: 'Đứng trước Thang bộ & Thang máy L1', en: 'L1 Stair & Elevator Eye View' },
      kind: 'eye',
      position: [13.2, L1_Y + 1.65, 4.8],
      target: [13.2, L1_Y + 1.5, 1.0],
      fov: 50,
    },
  ],
  children: [],
});

// ============================================================================
// LEVEL L2 — Tầng 2 · Khu VIP Platinum & Tư vấn Thể chất (elevation = 4.5m)
// ============================================================================

const L2_Y = 4.5;

const levelL2: LevelNode = register({
  id: 'lvl-l2',
  type: 'level',
  parentId: 'bld-main',
  code: 'L2',
  order: 2,
  name: { vi: 'Tầng 2 · Khu VIP Platinum & Tư vấn HLV', en: 'L2 · VIP Platinum & Performance Lab' },
  subtitle: {
    vi: 'Phòng Gym VIP Technogym, Buồng phân tích InBody 770, Studio HLV 1:1 & Platinum Lounge',
    en: 'Technogym Artis VIP Gym, InBody 770 Diagnostic Lab, 1:1 PT Studio & Platinum Lounge',
  },
  elevation: L2_Y,
  explodedOffset: 6.0,
  height: 4.0,
  slabThickness: 0.28,
  slabPolygon: rectPolygon(-22, -16, 22, 16),
  children: [],
  viewpoints: [
    {
      id: 'vp-l2-overview',
      label: { vi: 'Toàn cảnh Tầng 2 VIP', en: 'Level 2 VIP Overview' },
      kind: 'overview',
      position: [28, L2_Y + 22, 28],
      target: [0, L2_Y + 1.0, 0],
      fov: 38,
    },
  ],
});

const zoneL2VipGym: ZoneNode = register({
  id: 'zone-l2-vip-gym',
  type: 'zone',
  parentId: 'lvl-l2',
  code: 'L2-VIP-GYM',
  name: { vi: 'Phòng Gym VIP (Technogym Artis & Kinesis)', en: 'VIP Platinum Gym (Technogym Artis & Kinesis)' },
  description: {
    vi: 'Không gian tập luyện đặc quyền dành riêng cho hội viên Platinum với thiết bị Technogym Artis & Kinesis One.',
    en: 'Exclusive Platinum training sanctuary outfitted with Technogym Artis Run, Synchro Elliptical and Kinesis One.',
  },
  category: 'vip',
  polygon: rectPolygon(-20, -14, 6, 6),
  floorMaterial: 'rubber-dark',
  accentColor: '#ce9180',
  liveBinding: {
    roomName: 'Phòng Gym VIP',
    discipline: 'Gym',
    tierRequired: 'PLATINUM',
  },
  viewpoints: [
    {
      id: 'vp-zone-l2-vip-gym-hero',
      label: { vi: 'Phòng Gym VIP Platinum', en: 'VIP Gym Hero View' },
      kind: 'hero',
      position: [10, L2_Y + 9.5, 12],
      target: [-7, L2_Y + 1.2, -4],
      fov: 38,
    },
    {
      id: 'vp-zone-l2-vip-gym-eye',
      label: { vi: 'Góc nhìn trong Phòng VIP', en: 'VIP Gym Interior Eye View' },
      kind: 'eye',
      position: [2, L2_Y + 1.65, 2],
      target: [-10, L2_Y + 1.3, -6],
      fov: 50,
    },
  ],
  children: [],
});

const zoneL2Inbody: ZoneNode = register({
  id: 'zone-l2-inbody',
  type: 'zone',
  parentId: 'lvl-l2',
  code: 'L2-INBODY',
  name: { vi: 'Buồng Phân tích Thể chất InBody 770 & Hồ sơ Sức khỏe', en: 'InBody 770 Body Composition & Health Lab' },
  description: {
    vi: 'Đo chuyên sâu BMI, tỷ lệ mỡ cơ thể (Body Fat), khối lượng cơ xương và theo dõi tiến độ giáo án cá nhân.',
    en: 'Precision BMI, Body Fat and skeletal muscle mass diagnostics synced with your training progress.',
  },
  category: 'vip',
  polygon: rectPolygon(6, -14, 20, -2),
  floorMaterial: 'hardwood',
  accentColor: '#ce9180',
  viewpoints: [
    {
      id: 'vp-zone-l2-inbody-hero',
      label: { vi: 'Buồng Đo InBody 770', en: 'InBody 770 Lab View' },
      kind: 'hero',
      position: [24, L2_Y + 7.5, 4],
      target: [13, L2_Y + 1.2, -8],
      fov: 36,
    },
    {
      id: 'vp-zone-l2-inbody-eye',
      label: { vi: 'Đứng trước Máy đo InBody 770', en: 'InBody 770 Eye View' },
      kind: 'eye',
      position: [8.2, L2_Y + 1.65, -5.2],
      target: [13.5, L2_Y + 1.2, -8.5],
      fov: 50,
    },
  ],
  children: [],
});

const zoneL2PtStudio: ZoneNode = register({
  id: 'zone-l2-pt-studio',
  type: 'zone',
  parentId: 'lvl-l2',
  code: 'L2-PT-STUDIO',
  name: { vi: 'Studio Huấn luyện viên Cá nhân 1:1 (PT)', en: '1:1 Personal Trainer Coaching Studio' },
  description: {
    vi: 'Không gian huấn luyện 1:1 cùng đội ngũ HLV chuyên nghiệp và thiết kế giáo án cá nhân hóa.',
    en: 'Private 1:1 coaching studio for personal trainer sessions and customized workout plans.',
  },
  category: 'studio',
  polygon: rectPolygon(6, -2, 20, 14),
  floorMaterial: 'turf',
  accentColor: '#ce9180',
  viewpoints: [
    {
      id: 'vp-zone-l2-pt-studio-hero',
      label: { vi: 'Studio HLV 1:1', en: '1:1 PT Studio View' },
      kind: 'hero',
      position: [24, L2_Y + 8.0, 18],
      target: [13, L2_Y + 1.2, 6],
      fov: 38,
    },
    {
      id: 'vp-zone-l2-pt-studio-eye',
      label: { vi: 'Đứng trong Studio HLV 1:1 & Thang L2', en: '1:1 PT Studio Eye View' },
      kind: 'eye',
      position: [8.2, L2_Y + 1.65, 2.0],
      target: [14.5, L2_Y + 1.2, 6.0],
      fov: 50,
    },
  ],
  children: [],
});

const zoneL2Lounge: ZoneNode = register({
  id: 'zone-l2-lounge',
  type: 'zone',
  parentId: 'lvl-l2',
  code: 'L2-LOUNGE',
  name: { vi: 'Platinum Recovery Lounge & Quầy Nước dinh dưỡng', en: 'Platinum Recovery Lounge & Hydration Bar' },
  description: {
    vi: 'Sảnh thư giãn sau buổi tập, phục vụ shake protein và đồ uống điện giải dành cho hội viên.',
    en: 'Post-workout recovery lounge serving protein shakes and electrolyte hydration.',
  },
  category: 'lounge',
  polygon: rectPolygon(-20, 6, 6, 14),
  floorMaterial: 'hardwood',
  viewpoints: [
    {
      id: 'vp-zone-l2-lounge-hero',
      label: { vi: 'Platinum Lounge', en: 'Platinum Lounge View' },
      kind: 'hero',
      position: [2, L2_Y + 7.5, 22],
      target: [-7, L2_Y + 1.0, 10],
      fov: 38,
    },
    {
      id: 'vp-zone-l2-lounge-eye',
      label: { vi: 'Góc nhìn Sofa & Quầy Nước Platinum', en: 'Platinum Lounge Eye View' },
      kind: 'eye',
      position: [-8.0, L2_Y + 1.65, 7.2],
      target: [-4.5, L2_Y + 1.0, 11.2],
      fov: 50,
    },
  ],
  children: [],
});

// ============================================================================
// LEVEL RF — Tầng thượng Penthouse · Zen Garden Studio (elevation = 9.0m)
// ============================================================================

const RF_Y = 9.0;

const levelRF: LevelNode = register({
  id: 'lvl-rf',
  type: 'level',
  parentId: 'bld-main',
  code: 'RF',
  order: 3,
  name: { vi: 'Tầng thượng · Zen Garden Penthouse', en: 'RF · Zen Garden Penthouse' },
  subtitle: {
    vi: 'Zen Garden Yoga Studio ngập ánh sáng tự nhiên & Vườn thiền ngoài trời',
    en: 'Skylit Zen Garden Yoga Studio & Outdoor Mindful Terrace',
  },
  elevation: RF_Y,
  explodedOffset: 12.0,
  height: 3.6,
  slabThickness: 0.28,
  slabPolygon: rectPolygon(-22, -16, 22, 16),
  children: [],
  viewpoints: [
    {
      id: 'vp-rf-overview',
      label: { vi: 'Toàn cảnh Tầng thượng Zen Garden', en: 'Rooftop Zen Garden Overview' },
      kind: 'overview',
      position: [26, RF_Y + 18, 26],
      target: [0, RF_Y + 1.0, 0],
      fov: 38,
    },
  ],
});

const zoneRfZen: ZoneNode = register({
  id: 'zone-rf-zen',
  type: 'zone',
  parentId: 'lvl-rf',
  code: 'RF-ZEN',
  name: { vi: 'Zen Garden Studio (Yoga & Thiền định)', en: 'Zen Garden Studio (Yoga & Mindfulness)' },
  description: {
    vi: 'Phòng tập Yoga & giãn cơ sàn chiếu Tatami với vách kính toàn cảnh trên tầng Penthouse (sức chứa 18 học viên).',
    en: 'Penthouse tatami yoga & mindfulness studio wrapped in panoramic glass (capacity 18).',
  },
  category: 'studio',
  polygon: rectPolygon(-16, -12, 10, 8),
  floorMaterial: 'tatami',
  accentColor: '#ce9180',
  liveBinding: {
    roomName: 'Zen Garden Studio',
    discipline: 'Yoga',
    tierRequired: 'SILVER',
  },
  viewpoints: [
    {
      id: 'vp-zone-rf-zen-hero',
      label: { vi: 'Zen Garden Yoga Studio', en: 'Zen Garden Studio Hero View' },
      kind: 'hero',
      position: [14, RF_Y + 8.0, 14],
      target: [-3, RF_Y + 1.0, -2],
      fov: 38,
    },
    {
      id: 'vp-zone-rf-zen-eye',
      label: { vi: 'Góc nhìn từ thảm Yoga', en: 'Yoga Mat Eye View' },
      kind: 'eye',
      position: [-3, RF_Y + 1.4, 5],
      target: [-3, RF_Y + 1.2, -9],
      fov: 50,
    },
  ],
  children: [],
});

const zoneRfTerrace: ZoneNode = register({
  id: 'zone-rf-terrace',
  type: 'zone',
  parentId: 'lvl-rf',
  code: 'RF-TERRACE',
  name: { vi: 'Vườn Thiền & Sân Thượng Ngắm Cảnh', en: 'Rooftop Mindful Terrace & Sky Deck' },
  description: {
    vi: 'Không gian cây xanh thoáng đãng bao quanh Penthouse để hít thở, giãn cơ và theo dõi chuỗi ngày tập (Streak).',
    en: 'Landscaped sky deck surrounding the Penthouse for breathwork, stretching and celebrating your workout streak.',
  },
  category: 'lounge',
  polygon: rectPolygon(10, -14, 20, 14),
  floorMaterial: 'hardwood',
  viewpoints: [
    {
      id: 'vp-zone-rf-terrace-hero',
      label: { vi: 'Vườn Thiền Sân Thượng', en: 'Rooftop Terrace View' },
      kind: 'hero',
      position: [26, RF_Y + 7.5, 18],
      target: [15, RF_Y + 1.0, 0],
      fov: 38,
    },
    {
      id: 'vp-zone-rf-terrace-eye',
      label: { vi: 'Đứng trên Sân Thượng Ngắm Cảnh', en: 'Rooftop Sky Deck Eye View' },
      kind: 'eye',
      position: [12.2, RF_Y + 1.65, 5.2],
      target: [15.5, RF_Y + 1.2, -3.5],
      fov: 50,
    },
  ],
  children: [],
});

// ============================================================================
// LEVEL OUT — Khu Thể thao Ngoài trời · Sân Tennis 01 & 02 (elevation = 0.0m)
// ============================================================================

const OUT_Y = 0.0;

const levelOUT: LevelNode = register({
  id: 'lvl-out',
  type: 'level',
  parentId: 'bld-main',
  code: 'OUT',
  order: 4,
  name: { vi: 'Ngoài trời · Khu Sân Tennis A & B', en: 'Outdoor · Tennis Courts A & B' },
  subtitle: {
    vi: 'Hai sân Tennis mặt cứng Acrylic tiêu chuẩn thi đấu ngoài trời (Sân Tennis 01 & 02)',
    en: 'Two outdoor hard-court acrylic tennis courts (Tennis Courts 01 & 02)',
  },
  elevation: OUT_Y,
  explodedOffset: -2.0,
  height: 3.2,
  slabThickness: 0.28,
  slabPolygon: rectPolygon(23, -16, 46, 16),
  children: [],
  viewpoints: [
    {
      id: 'vp-out-overview',
      label: { vi: 'Toàn cảnh Khu Sân Tennis Ngoài trời', en: 'Outdoor Tennis Courts Overview' },
      kind: 'overview',
      position: [54, OUT_Y + 18, 24],
      target: [34.5, OUT_Y + 0.5, 0],
      fov: 38,
    },
  ],
});

const zoneOutTennis: ZoneNode = register({
  id: 'zone-out-tennis',
  type: 'zone',
  parentId: 'lvl-out',
  code: 'OUT-TENNIS',
  name: { vi: 'Khu Sân Tennis Ngoài trời (Sân 01 & 02)', en: 'Outdoor Tennis Complex (Courts 01 & 02)' },
  description: {
    vi: 'Cụm 2 sân Tennis ngoài trời mặt Acrylic giảm chấn, đặt sân trực tuyến từ 06:00 đến 22:00.',
    en: 'Two cushioned acrylic outdoor tennis courts available for hourly booking from 06:00 to 22:00.',
  },
  category: 'court',
  polygon: rectPolygon(24, -15, 45, 15),
  floorMaterial: 'acrylic-court',
  accentColor: '#2f6b55',
  liveBinding: {
    discipline: 'Tennis',
    courtDiscipline: 'Tennis',
  },
  viewpoints: [
    {
      id: 'vp-zone-out-tennis-hero',
      label: { vi: 'Sân Tennis 01 & 02', en: 'Tennis Courts 01 & 02 Hero View' },
      kind: 'hero',
      position: [52, OUT_Y + 14, 20],
      target: [34.5, OUT_Y + 0.5, 0],
      fov: 38,
    },
    {
      id: 'vp-zone-out-tennis-eye',
      label: { vi: 'Đứng cuối sân Tennis 01', en: 'Tennis Baseline Eye View' },
      kind: 'eye',
      position: [29.5, OUT_Y + 1.65, 13.5],
      target: [29.5, OUT_Y + 1.0, -10],
      fov: 50,
    },
  ],
  children: [],
});

// ============================================================================
// WALLS (Exterior & Interior Partitions per Level)
// ============================================================================

function addWall(
  level: LevelNode,
  idSuffix: string,
  start: Vec2,
  end: Vec2,
  options: {
    exterior?: boolean;
    material?: WallNode['material'];
    height?: number;
    thickness?: number;
    openings?: WallNode['openings'];
  } = {},
): WallNode {
  const wall: WallNode = register({
    id: `wall-${level.code.toLowerCase()}-${idSuffix}`,
    type: 'wall',
    parentId: level.id,
    start,
    end,
    thickness: options.thickness ?? (options.exterior ? 0.18 : 0.12),
    height: options.height ?? level.height,
    material: options.material ?? 'concrete',
    exterior: options.exterior ?? false,
    openings: options.openings ?? [],
  });
  level.children.push(wall.id);
  return wall;
}

// B1 Walls
addWall(levelB1, 'north', [-22, -16], [22, -16], { exterior: true });
addWall(levelB1, 'south', [-22, 16], [22, 16], { exterior: true });
addWall(levelB1, 'west', [-22, -16], [-22, 16], { exterior: true });
addWall(levelB1, 'east', [22, -16], [22, 16], { exterior: true });
addWall(levelB1, 'pool-glass', [-20, 4], [20, 4], {
  material: 'glass',
  openings: [
    { id: 'op-b1-pool-door', kind: 'glass-door', offset: 14, width: 2.4, height: 2.4, sillHeight: 0 },
    { id: 'op-b1-thermal-door', kind: 'glass-door', offset: 31, width: 2.0, height: 2.4, sillHeight: 0 },
  ],
});
addWall(levelB1, 'thermal-div', [8, -14], [8, 14], {
  material: 'wood-slat',
  openings: [{ id: 'op-b1-core-arch', kind: 'arch', offset: 20, width: 2.4, height: 2.5, sillHeight: 0 }],
});

// L1 Walls
addWall(levelL1, 'north', [-22, -16], [22, -16], {
  exterior: true,
  openings: [
    { id: 'op-l1-n-win1', kind: 'window', offset: 4, width: 14, height: 2.4, sillHeight: 1.0 },
    { id: 'op-l1-n-win2', kind: 'window', offset: 24, width: 14, height: 2.4, sillHeight: 1.0 },
  ],
});
addWall(levelL1, 'south', [-22, 16], [22, 16], {
  exterior: true,
  material: 'glass',
  openings: [
    { id: 'op-l1-main-entry', kind: 'double-door', offset: 19, width: 6, height: 3.0, sillHeight: 0 },
  ],
});
addWall(levelL1, 'west', [-22, -16], [-22, 16], {
  exterior: true,
  openings: [{ id: 'op-l1-w-win', kind: 'window', offset: 4, width: 10, height: 2.4, sillHeight: 1.0 }],
});
addWall(levelL1, 'east', [22, -16], [22, 16], {
  exterior: true,
  openings: [
    { id: 'op-l1-e-door-out', kind: 'glass-door', offset: 14, width: 3.2, height: 2.6, sillHeight: 0 },
  ],
});
addWall(levelL1, 'gym-south', [-20, 2], [4, 2], {
  material: 'glass',
  openings: [{ id: 'op-l1-gym-entry', kind: 'glass-door', offset: 16, width: 3.0, height: 2.6, sillHeight: 0 }],
});
addWall(levelL1, 'boxing-west', [4, -14], [4, -4], {
  material: 'accent-salmon',
  openings: [{ id: 'op-l1-boxing-arch', kind: 'arch', offset: 3, width: 3.2, height: 2.8, sillHeight: 0 }],
});
addWall(levelL1, 'lobby-west', [-6, 2], [-6, 15], {
  material: 'glass',
  openings: [{ id: 'op-l1-badminton-door', kind: 'glass-door', offset: 5, width: 2.8, height: 2.6, sillHeight: 0 }],
});

// L2 Walls
addWall(levelL2, 'north', [-22, -16], [22, -16], {
  exterior: true,
  openings: [{ id: 'op-l2-n-win', kind: 'window', offset: 5, width: 34, height: 2.5, sillHeight: 0.9 }],
});
addWall(levelL2, 'south', [-22, 16], [22, 16], {
  exterior: true,
  material: 'glass',
});
addWall(levelL2, 'west', [-22, -16], [-22, 16], { exterior: true });
addWall(levelL2, 'east', [22, -16], [22, 16], { exterior: true });
addWall(levelL2, 'vip-east', [6, -14], [6, 14], {
  material: 'glass',
  openings: [
    { id: 'op-l2-inbody-door', kind: 'glass-door', offset: 4, width: 2.4, height: 2.5, sillHeight: 0 },
    { id: 'op-l2-pt-door', kind: 'glass-door', offset: 16, width: 2.8, height: 2.5, sillHeight: 0 },
  ],
});
addWall(levelL2, 'vip-south', [-20, 6], [6, 6], {
  material: 'wood-slat',
  openings: [{ id: 'op-l2-lounge-arch', kind: 'arch', offset: 10, width: 4.0, height: 2.8, sillHeight: 0 }],
});

// RF Walls (Penthouse glass pavilion + low parapet around roof)
addWall(levelRF, 'parapet-n', [-22, -16], [22, -16], { exterior: true, height: 1.1 });
addWall(levelRF, 'parapet-s', [-22, 16], [22, 16], { exterior: true, height: 1.1 });
addWall(levelRF, 'parapet-w', [-22, -16], [-22, 16], { exterior: true, height: 1.1 });
addWall(levelRF, 'parapet-e', [22, -16], [22, 16], { exterior: true, height: 1.1 });
addWall(levelRF, 'zen-n', [-16, -12], [10, -12], { material: 'glass', height: 3.4 });
addWall(levelRF, 'zen-s', [-16, 8], [10, 8], {
  material: 'glass',
  height: 3.4,
  openings: [{ id: 'op-rf-zen-door', kind: 'glass-door', offset: 10, width: 4.0, height: 2.6, sillHeight: 0 }],
});
addWall(levelRF, 'zen-w', [-16, -12], [-16, 8], { material: 'wood-slat', height: 3.4 });
addWall(levelRF, 'zen-e', [10, -12], [10, 8], {
  material: 'glass',
  height: 3.4,
  openings: [{ id: 'op-rf-terrace-door', kind: 'glass-door', offset: 7, width: 3.6, height: 2.6, sillHeight: 0 }],
});

// OUT Fence Perimeter
addWall(levelOUT, 'fence-n', [23, -16], [46, -16], { exterior: true, material: 'glass', height: 2.6, thickness: 0.08 });
addWall(levelOUT, 'fence-s', [23, 16], [46, 16], { exterior: true, material: 'glass', height: 2.6, thickness: 0.08 });
addWall(levelOUT, 'fence-e', [46, -16], [46, 16], { exterior: true, material: 'glass', height: 2.6, thickness: 0.08 });

// ============================================================================
// ITEMS HELPER
// ============================================================================

function addItem(
  zone: ZoneNode,
  spec: Omit<ItemNode, 'type' | 'parentId'>,
): ItemNode {
  const item: ItemNode = register({
    ...spec,
    type: 'item',
    parentId: zone.id,
  });
  zone.children.push(item.id);
  return item;
}

// --- B1 Items ---
addItem(zoneB1Pool, {
  id: 'item-b1-lane-01',
  kind: 'swim-lane',
  name: { vi: 'Làn bơi 01 (25m)', en: 'Swim Lane 01 (25m)' },
  position: [-6, 0.05, -8.5],
  rotationY: 0,
  dimensions: [25, 0.4, 3.5],
  liveCourtBinding: { courtName: 'Làn bơi 01' },
});
addItem(zoneB1Pool, {
  id: 'item-b1-lane-02',
  kind: 'swim-lane',
  name: { vi: 'Làn bơi 02 (25m)', en: 'Swim Lane 02 (25m)' },
  position: [-6, 0.05, -2.5],
  rotationY: 0,
  dimensions: [25, 0.4, 3.5],
  liveCourtBinding: { courtName: 'Làn bơi 02' },
});
addItem(zoneB1Pool, {
  id: 'item-b1-block-01',
  kind: 'starting-block',
  name: { vi: 'Bục xuất phát Làn 01', en: 'Starting Block 01' },
  position: [6.8, 0.35, -8.5],
  rotationY: -Math.PI / 2,
  dimensions: [0.8, 0.75, 0.8],
});
addItem(zoneB1Pool, {
  id: 'item-b1-block-02',
  kind: 'starting-block',
  name: { vi: 'Bục xuất phát Làn 02', en: 'Starting Block 02' },
  position: [6.8, 0.35, -2.5],
  rotationY: -Math.PI / 2,
  dimensions: [0.8, 0.75, 0.8],
});

addItem(zoneB1Thermal, {
  id: 'item-b1-sauna-01',
  kind: 'sauna-bench',
  name: { vi: 'Ghế Xông hơi Đá muối 01', en: 'Himalayan Salt Sauna Bench 01' },
  position: [14, 0, -10.5],
  rotationY: 0,
  dimensions: [4.2, 1.1, 1.8],
});
addItem(zoneB1Thermal, {
  id: 'item-b1-sauna-02',
  kind: 'sauna-bench',
  name: { vi: 'Ghế Xông hơi Khô Phần Lan 02', en: 'Finnish Dry Sauna Bench 02' },
  position: [14, 0, -6.5],
  rotationY: 0,
  dimensions: [4.2, 1.1, 1.8],
});
addItem(zoneB1Thermal, {
  id: 'item-b1-jacuzzi-01',
  kind: 'jacuzzi-tub',
  name: { vi: 'Bồn sục Phục hồi cơ Hydro', en: 'Hydro-Recovery Jacuzzi Tub' },
  position: [14, 0, -0.5],
  rotationY: 0,
  dimensions: [3.6, 0.95, 3.2],
});

for (let i = 0; i < 4; i++) {
  addItem(zoneB1Locker, {
    id: `item-b1-locker-${i + 1}`,
    kind: 'locker-bank',
    name: { vi: `Dãy Tủ khóa thông minh 0${i + 1}`, en: `Smart Locker Bank 0${i + 1}` },
    position: [-15 + i * 6, 0, 9],
    rotationY: 0,
    dimensions: [3.2, 2.0, 0.9],
  });
}

addItem(zoneB1Core, {
  id: 'item-b1-stairs',
  kind: 'stair-core',
  name: { vi: 'Cầu thang bộ B1–L1', en: 'Stair Core B1–L1' },
  position: [12, 0, 9],
  rotationY: 0,
  dimensions: [3.6, 3.8, 4.2],
});
addItem(zoneB1Core, {
  id: 'item-b1-elevator',
  kind: 'elevator-core',
  name: { vi: 'Thang máy Kính trung tâm B1', en: 'Panoramic Elevator Core B1' },
  position: [17, 0, 9],
  rotationY: 0,
  dimensions: [2.6, 3.8, 2.6],
});

// --- L1 Lobby, Gate, Shop & Core Items ---
addItem(zoneL1Lobby, {
  id: 'item-l1-reception-desk',
  kind: 'reception-desk',
  name: { vi: 'Quầy Lễ tân & POS trung tâm', en: 'Main Reception & POS Desk' },
  position: [2, 0, 9.5],
  rotationY: 0,
  dimensions: [5.4, 1.15, 1.6],
});
addItem(zoneL1Lobby, {
  id: 'item-l1-kiosk-checkin',
  kind: 'kiosk-checkin',
  name: { vi: 'Kiosk Tra cứu Gói tập & Hóa đơn', en: 'Membership & Billing Kiosk' },
  position: [-3.5, 0, 11.2],
  rotationY: Math.PI / 6,
  dimensions: [0.9, 1.55, 0.7],
});
addItem(zoneL1Lobby, {
  id: 'item-l1-card-printer',
  kind: 'card-printer',
  name: { vi: 'Trạm Cấp & Kích hoạt Thẻ hội viên', en: 'Member Card Issuance Station' },
  position: [6.8, 0, 9.6],
  rotationY: -Math.PI / 8,
  dimensions: [1.1, 1.25, 0.8],
});
addItem(zoneL1Lobby, {
  id: 'item-l1-trophy-totem',
  kind: 'trophy-totem',
  name: { vi: 'Bảng Chuỗi Ngày tập (Workout Streak Totem)', en: 'Workout Streak Totem' },
  position: [-3.8, 0, 8.2],
  rotationY: 0,
  dimensions: [1.0, 2.1, 0.6],
});

for (let i = 0; i < 3; i++) {
  addItem(zoneL1Gate, {
    id: `item-l1-turnstile-${i + 1}`,
    kind: 'qr-turnstile',
    name: { vi: `Cổng Quét QR 0${i + 1}`, en: `QR Check-in Turnstile 0${i + 1}` },
    position: [-2.4 + i * 2.4, 0, 4.0],
    rotationY: 0,
    dimensions: [1.2, 1.05, 1.6],
  });
}

for (let i = 0; i < 3; i++) {
  addItem(zoneL1Shop, {
    id: `item-l1-shelf-${i + 1}`,
    kind: 'supplement-shelf',
    name: {
      vi: `Kệ Thực phẩm bổ sung SÖL 0${i + 1}`,
      en: `SÖL Supplement Display Shelf 0${i + 1}`,
    },
    position: [12.2 + i * 2.8, 0, 9.2],
    rotationY: 0,
    dimensions: [2.0, 2.1, 0.8],
  });
}
addItem(zoneL1Shop, {
  id: 'item-l1-nutrition-board',
  kind: 'nutrition-board',
  name: { vi: 'Bảng Thành phần Dinh dưỡng (Nutrition Facts)', en: 'Nutrition Facts Signature Board' },
  position: [15.0, 0, 13.0],
  rotationY: Math.PI,
  dimensions: [2.4, 1.9, 0.5],
});

// --- L1 Standard Gym Equipment (Matches CatalogSeeder exact codes & quantities) ---
// 8x EQ-RUN-01 (Máy chạy bộ điện Commercial Pro)
for (let i = 0; i < 8; i++) {
  addItem(zoneL1Gym, {
    id: `item-l1-run-${i + 1}`,
    kind: 'treadmill',
    name: {
      vi: `Máy chạy bộ điện Commercial Pro #${i + 1}`,
      en: `Commercial Pro Treadmill #${i + 1}`,
    },
    position: [-18.2 + i * 2.3, 0, -12.0],
    rotationY: 0,
    dimensions: [1.0, 1.45, 2.0],
    variant: 'standard',
    liveEquipmentBinding: { equipmentCode: 'EQ-RUN-01', instanceSlot: i },
  });
}

// 6x EQ-BIKE-01 (Xe đạp tập Upright Bike)
for (let i = 0; i < 6; i++) {
  addItem(zoneL1Gym, {
    id: `item-l1-bike-${i + 1}`,
    kind: 'upright-bike',
    name: {
      vi: `Xe đạp tập Upright Bike #${i + 1}`,
      en: `Upright Exercise Bike #${i + 1}`,
    },
    position: [-18.0 + i * 2.2, 0, -8.6],
    rotationY: 0,
    dimensions: [0.7, 1.3, 1.2],
    variant: 'standard',
    liveEquipmentBinding: { equipmentCode: 'EQ-BIKE-01', instanceSlot: i },
  });
}

// 3x EQ-SMI-01 (Giàn tạ đa năng Smith Machine)
for (let i = 0; i < 3; i++) {
  addItem(zoneL1Gym, {
    id: `item-l1-smith-${i + 1}`,
    kind: 'smith-machine',
    name: {
      vi: `Giàn tạ đa năng Smith Machine #${i + 1}`,
      en: `Commercial Smith Machine #${i + 1}`,
    },
    position: [-17.5 + i * 4.5, 0, -4.8],
    rotationY: 0,
    dimensions: [2.2, 2.25, 1.6],
    variant: 'standard',
    liveEquipmentBinding: { equipmentCode: 'EQ-SMI-01', instanceSlot: i },
  });
}

// 2x EQ-LAT-01 (Máy kéo xô đôi Dual Lat Pulldown)
for (let i = 0; i < 2; i++) {
  addItem(zoneL1Gym, {
    id: `item-l1-lat-${i + 1}`,
    kind: 'lat-pulldown',
    name: {
      vi: `Máy kéo xô đôi Dual Lat Pulldown #${i + 1}`,
      en: `Dual Lat Pulldown Station #${i + 1}`,
    },
    position: [-4.5 + i * 3.5, 0, -8.5],
    rotationY: -Math.PI / 2,
    dimensions: [1.6, 2.2, 1.5],
    variant: 'standard',
    liveEquipmentBinding: { equipmentCode: 'EQ-LAT-01', instanceSlot: i },
  });
}

// 2x EQ-SQUAT-01 (Khung gánh tạ Squat Rack)
for (let i = 0; i < 2; i++) {
  addItem(zoneL1Gym, {
    id: `item-l1-squat-${i + 1}`,
    kind: 'squat-rack',
    name: {
      vi: `Khung gánh tạ Squat Rack #${i + 1}`,
      en: `Olympic Squat Power Rack #${i + 1}`,
    },
    position: [-4.5 + i * 3.5, 0, -4.8],
    rotationY: 0,
    dimensions: [1.7, 2.3, 1.8],
    variant: 'standard',
    liveEquipmentBinding: { equipmentCode: 'EQ-SQUAT-01', instanceSlot: i },
  });
}

// 6x EQ-BENCH-01 (Ghế đẩy ngực đa năng Adjustable Bench)
for (let i = 0; i < 6; i++) {
  addItem(zoneL1Gym, {
    id: `item-l1-bench-${i + 1}`,
    kind: 'adjustable-bench',
    name: {
      vi: `Ghế đẩy ngực đa năng Adjustable Bench #${i + 1}`,
      en: `Adjustable Free-Weight Bench #${i + 1}`,
    },
    position: [-18.0 + i * 2.5, 0, -1.2],
    rotationY: 0,
    dimensions: [0.8, 0.95, 1.4],
    variant: 'standard',
    liveEquipmentBinding: { equipmentCode: 'EQ-BENCH-01', instanceSlot: i },
  });
}

// 2x EQ-DUMB-01 (Dàn tạ tay cao su Dumbbell 2.5-40kg)
for (let i = 0; i < 2; i++) {
  addItem(zoneL1Gym, {
    id: `item-l1-dumbbell-${i + 1}`,
    kind: 'dumbbell-rack',
    name: {
      vi: `Dàn tạ tay cao su Dumbbell (2.5–40kg) #${i + 1}`,
      en: `Rubber Dumbbell Rack (2.5–40kg) #${i + 1}`,
    },
    position: [-1.5 + i * 3.2, 0, -1.2],
    rotationY: Math.PI,
    dimensions: [2.6, 0.95, 0.8],
    variant: 'standard',
    liveEquipmentBinding: { equipmentCode: 'EQ-DUMB-01', instanceSlot: i },
  });
}

// --- L1 Boxing Items ---
addItem(zoneL1Boxing, {
  id: 'item-l1-boxing-ring',
  kind: 'boxing-ring',
  name: { vi: 'Võ đài Boxing Ring Arena 01', en: 'Competition Boxing Ring 01' },
  position: [10.5, 0, -9.2],
  rotationY: 0,
  dimensions: [5.6, 1.6, 5.6],
});
for (let i = 0; i < 4; i++) {
  addItem(zoneL1Boxing, {
    id: `item-l1-heavy-bag-${i + 1}`,
    kind: 'heavy-bag',
    name: { vi: `Bao cát nặng Boxing #${i + 1}`, en: `Heavy Boxing Bag #${i + 1}` },
    position: [15.5 + (i % 2) * 2.4, 0, -11.5 + Math.floor(i / 2) * 3.8],
    rotationY: 0,
    dimensions: [0.9, 2.3, 0.9],
  });
}
for (let i = 0; i < 2; i++) {
  addItem(zoneL1Boxing, {
    id: `item-l1-speed-bag-${i + 1}`,
    kind: 'speed-bag',
    name: { vi: `Bóng phản xạ tốc độ #${i + 1}`, en: `Speed Reflex Bag #${i + 1}` },
    position: [6.0, 0, -12.2 + i * 5.8],
    rotationY: Math.PI / 2,
    dimensions: [0.8, 2.1, 0.8],
  });
}

// --- L1 Badminton Courts 01..04 ---
const badmintonCoords: Array<{ code: number; x: number; z: number }> = [
  { code: 1, x: -16.5, z: 5.5 },
  { code: 2, x: -9.8, z: 5.5 },
  { code: 3, x: -16.5, z: 11.6 },
  { code: 4, x: -9.8, z: 11.6 },
];
for (const c of badmintonCoords) {
  addItem(zoneL1Badminton, {
    id: `item-l1-badminton-0${c.code}`,
    kind: 'badminton-court',
    name: { vi: `Sân Cầu lông 0${c.code}`, en: `Badminton Court 0${c.code}` },
    position: [c.x, 0.02, c.z],
    rotationY: 0,
    dimensions: [5.6, 1.55, 5.2],
    liveCourtBinding: { courtName: `Sân Cầu lông 0${c.code}` },
  });
}

// --- L1 Core ---
addItem(zoneL1Core, {
  id: 'item-l1-stairs',
  kind: 'stair-core',
  name: { vi: 'Cầu thang bộ L1–L2', en: 'Stair Core L1–L2' },
  position: [10.5, 0, 1.0],
  rotationY: 0,
  dimensions: [3.6, 3.8, 4.2],
});
addItem(zoneL1Core, {
  id: 'item-l1-elevator',
  kind: 'elevator-core',
  name: { vi: 'Thang máy Kính trung tâm L1', en: 'Panoramic Elevator Core L1' },
  position: [16.0, 0, 1.0],
  rotationY: 0,
  dimensions: [2.6, 3.8, 2.6],
});

// --- L2 VIP Gym Equipment (Matches CatalogSeeder exact codes & quantities) ---
// 4x EQ-VIP-RUN-01 (Máy chạy bộ cao cấp Technogym Artis Run)
for (let i = 0; i < 4; i++) {
  addItem(zoneL2VipGym, {
    id: `item-l2-vip-run-${i + 1}`,
    kind: 'treadmill',
    name: {
      vi: `Máy chạy bộ cao cấp Technogym Artis Run #${i + 1}`,
      en: `Technogym Artis Run VIP Treadmill #${i + 1}`,
    },
    position: [-17.5 + i * 3.2, 0, -11.5],
    rotationY: 0,
    dimensions: [1.1, 1.5, 2.1],
    variant: 'vip',
    liveEquipmentBinding: { equipmentCode: 'EQ-VIP-RUN-01', instanceSlot: i },
  });
}

// 3x EQ-VIP-SYN-01 (Máy tập toàn thân Synchro Elliptical VIP)
for (let i = 0; i < 3; i++) {
  addItem(zoneL2VipGym, {
    id: `item-l2-vip-syn-${i + 1}`,
    kind: 'elliptical',
    name: {
      vi: `Máy tập toàn thân Synchro Elliptical VIP #${i + 1}`,
      en: `Synchro Elliptical VIP Cross-Trainer #${i + 1}`,
    },
    position: [-4.5 + i * 3.2, 0, -11.5],
    rotationY: 0,
    dimensions: [1.0, 1.65, 2.1],
    variant: 'vip',
    liveEquipmentBinding: { equipmentCode: 'EQ-VIP-SYN-01', instanceSlot: i },
  });
}

// 2x EQ-VIP-KIN-01 (Dàn tạ khối thông minh Technogym Kinesis One)
for (let i = 0; i < 2; i++) {
  addItem(zoneL2VipGym, {
    id: `item-l2-vip-kin-${i + 1}`,
    kind: 'kinesis-station',
    name: {
      vi: `Dàn tạ khối thông minh Technogym Kinesis One #${i + 1}`,
      en: `Technogym Kinesis One Cable Station #${i + 1}`,
    },
    position: [-15.0 + i * 6.5, 0, -4.5],
    rotationY: 0,
    dimensions: [2.4, 2.25, 1.6],
    variant: 'vip',
    liveEquipmentBinding: { equipmentCode: 'EQ-VIP-KIN-01', instanceSlot: i },
  });
}

// 1x EQ-VIP-DUMB-01 (Dàn tạ đơn Urethane bọc crôm VIP)
addItem(zoneL2VipGym, {
  id: 'item-l2-vip-dumb-1',
  kind: 'dumbbell-rack',
  name: {
    vi: 'Dàn tạ đơn Urethane bọc crôm VIP',
    en: 'Chrome Urethane VIP Dumbbell Rack',
  },
  position: [-1.5, 0, -4.5],
  rotationY: 0,
  dimensions: [3.2, 1.0, 0.9],
  variant: 'vip',
  liveEquipmentBinding: { equipmentCode: 'EQ-VIP-DUMB-01', instanceSlot: 0 },
});

// --- L2 InBody 770 Lab ---
addItem(zoneL2Inbody, {
  id: 'item-l2-vip-inbody-1',
  kind: 'inbody-analyzer',
  name: {
    vi: 'Máy đo chỉ số cơ thể chuyên sâu InBody 770',
    en: 'InBody 770 Clinical Body Composition Analyzer',
  },
  position: [11.5, 0, -9.5],
  rotationY: 0,
  dimensions: [0.9, 1.35, 1.2],
  variant: 'vip',
  liveEquipmentBinding: { equipmentCode: 'EQ-VIP-INBODY-01', instanceSlot: 0 },
});
addItem(zoneL2Inbody, {
  id: 'item-l2-consult-pod-1',
  kind: 'consultation-pod',
  name: { vi: 'Bàn Tư vấn Chỉ số Cơ thể & Dinh dưỡng 01', en: 'Body Metrics Consultation Pod 01' },
  position: [16.2, 0, -9.5],
  rotationY: 0,
  dimensions: [2.0, 0.9, 2.0],
});
addItem(zoneL2Inbody, {
  id: 'item-l2-consult-pod-2',
  kind: 'consultation-pod',
  name: { vi: 'Bàn Tư vấn Chỉ số Cơ thể & Dinh dưỡng 02', en: 'Body Metrics Consultation Pod 02' },
  position: [16.2, 0, -5.2],
  rotationY: 0,
  dimensions: [2.0, 0.9, 2.0],
});

// --- L2 PT Studio ---
addItem(zoneL2PtStudio, {
  id: 'item-l2-coach-podium',
  kind: 'coach-podium',
  name: { vi: 'Trạm Điều phối Giáo án HLV 1:1', en: '1:1 PT Coaching Podium' },
  position: [12.5, 0, 3.5],
  rotationY: -Math.PI / 2,
  dimensions: [1.4, 1.2, 1.0],
});
addItem(zoneL2PtStudio, {
  id: 'item-l2-pt-bench',
  kind: 'adjustable-bench',
  name: { vi: 'Ghế Tập PT Cá nhân hóa', en: '1:1 Personal Training Bench' },
  position: [15.5, 0, 7.5],
  rotationY: 0,
  dimensions: [0.8, 0.95, 1.4],
  variant: 'vip',
});
addItem(zoneL2PtStudio, {
  id: 'item-l2-stairs',
  kind: 'stair-core',
  name: { vi: 'Cầu thang bộ L1–L2–RF', en: 'Stair Core L1–L2–RF' },
  position: [10.5, 0, 11.5],
  rotationY: 0,
  dimensions: [3.6, 3.8, 4.2],
});
addItem(zoneL2PtStudio, {
  id: 'item-l2-elevator',
  kind: 'elevator-core',
  name: { vi: 'Thang máy Kính trung tâm L2', en: 'Panoramic Elevator Core L2' },
  position: [16.0, 0, 11.5],
  rotationY: 0,
  dimensions: [2.6, 3.8, 2.6],
});

// --- L2 Lounge ---
for (let i = 0; i < 3; i++) {
  addItem(zoneL2Lounge, {
    id: `item-l2-sofa-${i + 1}`,
    kind: 'lounge-sofa',
    name: { vi: `Sofa Thư giãn Platinum 0${i + 1}`, en: `Platinum Lounge Sofa 0${i + 1}` },
    position: [-15.5 + i * 6.5, 0, 10.2],
    rotationY: 0,
    dimensions: [2.6, 0.85, 1.4],
  });
}
addItem(zoneL2Lounge, {
  id: 'item-l2-juice-bar',
  kind: 'juice-bar',
  name: { vi: 'Quầy Shake Protein & Điện giải', en: 'Protein Shake & Hydration Bar' },
  position: [2.0, 0, 10.2],
  rotationY: Math.PI,
  dimensions: [3.8, 1.15, 1.4],
});

// --- RF Zen Garden Studio & Terrace ---
for (let row = 0; row < 3; row++) {
  for (let col = 0; col < 4; col++) {
    const idx = row * 4 + col + 1;
    addItem(zoneRfZen, {
      id: `item-rf-yoga-mat-${idx}`,
      kind: 'yoga-mat',
      name: { vi: `Thảm Yoga Định tâm #${idx}`, en: `Mindful Yoga Mat #${idx}` },
      position: [-11.5 + col * 5.2, 0.02, -7.5 + row * 4.8],
      rotationY: 0,
      dimensions: [0.8, 0.05, 1.85],
    });
  }
}
for (let i = 0; i < 4; i++) {
  addItem(zoneRfZen, {
    id: `item-rf-bolster-${i + 1}`,
    kind: 'meditation-bolster',
    name: { vi: `Đệm Thiền Chuông xoay #${i + 1}`, en: `Meditation Bolster Cushion #${i + 1}` },
    position: [-10.0 + i * 4.5, 0.1, 5.5],
    rotationY: 0,
    dimensions: [0.65, 0.28, 0.65],
  });
}

for (let i = 0; i < 6; i++) {
  addItem(zoneRfTerrace, {
    id: `item-rf-tree-${i + 1}`,
    kind: 'planter-tree',
    name: { vi: `Cây Ô-liu & Trúc cảnh Sân thượng #${i + 1}`, en: `Rooftop Olive & Bamboo Planter #${i + 1}` },
    position: [15.0 + (i % 2) * 3.0, 0, -10.5 + Math.floor(i / 2) * 9.5],
    rotationY: 0,
    dimensions: [1.4, 2.6, 1.4],
  });
}
addItem(zoneRfTerrace, {
  id: 'item-rf-terrace-sofa-1',
  kind: 'lounge-sofa',
  name: { vi: 'Ghế Thư giãn Ngoài trời Sân thượng', en: 'Sky Deck Outdoor Daybed' },
  position: [14.5, 0, 0],
  rotationY: -Math.PI / 2,
  dimensions: [2.6, 0.85, 1.4],
});
addItem(zoneRfTerrace, {
  id: 'item-rf-stairs',
  kind: 'stair-core',
  name: { vi: 'Cầu thang bộ L2–RF (Tầng thượng)', en: 'Stair Core L2–RF (Rooftop)' },
  position: [12.5, 0, 11.5],
  rotationY: 0,
  dimensions: [3.4, 3.4, 4.0],
});
addItem(zoneRfTerrace, {
  id: 'item-rf-elevator',
  kind: 'elevator-core',
  name: { vi: 'Thang máy Kính Tầng thượng RF', en: 'Rooftop Panoramic Elevator RF' },
  position: [17.2, 0, 11.5],
  rotationY: 0,
  dimensions: [2.4, 3.4, 2.4],
});

// --- OUT Tennis Courts 01 & 02 ---
addItem(zoneOutTennis, {
  id: 'item-out-tennis-01',
  kind: 'tennis-court',
  name: { vi: 'Sân Tennis 01 (Sân A Ngoài trời)', en: 'Tennis Court 01 (Outdoor Court A)' },
  position: [29.5, 0.02, 0],
  rotationY: 0,
  dimensions: [9.5, 1.1, 22.0],
  liveCourtBinding: { courtName: 'Sân Tennis 01' },
});
addItem(zoneOutTennis, {
  id: 'item-out-tennis-02',
  kind: 'tennis-court',
  name: { vi: 'Sân Tennis 02 (Sân B Ngoài trời)', en: 'Tennis Court 02 (Outdoor Court B)' },
  position: [39.8, 0.02, 0],
  rotationY: 0,
  dimensions: [9.5, 1.1, 22.0],
  liveCourtBinding: { courtName: 'Sân Tennis 02' },
});
addItem(zoneOutTennis, {
  id: 'item-out-tree-1',
  kind: 'planter-tree',
  name: { vi: 'Cây bóng mát Khu Sân Tennis A', en: 'Court A Shade Tree' },
  position: [25.2, 0, -13.2],
  rotationY: 0,
  dimensions: [1.6, 2.8, 1.6],
});
addItem(zoneOutTennis, {
  id: 'item-out-tree-2',
  kind: 'planter-tree',
  name: { vi: 'Cây bóng mát Khu Sân Tennis B', en: 'Court B Shade Tree' },
  position: [43.5, 0, 13.2],
  rotationY: 0,
  dimensions: [1.6, 2.8, 1.6],
});

// ============================================================================
// HOTSPOTS (Covers 100% of MEMBER routes in PORTAL_NAV + open-chat + level jumps)
// ============================================================================

function addHotspot(
  zone: ZoneNode,
  spec: Omit<HotspotNode, 'type' | 'parentId' | 'position'> & { localPosition: Vec3 },
): HotspotNode {
  const parentLevel = nodes[zone.parentId] as LevelNode;
  const worldPos: Vec3 = [
    spec.localPosition[0],
    parentLevel.elevation + spec.localPosition[1],
    spec.localPosition[2],
  ];
  const { localPosition: _unused, ...rest } = spec;
  void _unused;
  const hs: HotspotNode = register({
    ...rest,
    type: 'hotspot',
    parentId: zone.id,
    position: worldPos,
  });
  zone.children.push(hs.id);
  return hs;
}

// 1. /member/dashboard — Lobby Overview Kiosk
addHotspot(zoneL1Lobby, {
  id: 'hs-l1-dashboard',
  localPosition: [-3.5, 2.1, 11.2],
  title: { vi: 'Bảng điều khiển Hội viên', en: 'Member Dashboard' },
  subtitle: {
    vi: 'Tổng quan gói tập, lịch học sắp tới, thẻ hội viên và thông báo mới nhất.',
    en: 'Overview of your active membership, upcoming classes, member card and alerts.',
  },
  badge: 'L1 · KIOSK',
  icon: 'board',
  priority: 'primary',
  liveSummaryKey: 'Overview',
  action: {
    type: 'navigate',
    to: '/member/dashboard',
    ctaLabel: { vi: 'Mở Bảng điều khiển', en: 'Open Dashboard' },
  },
});

// 2. /member/packages & /member/packages/checkout — Reception Concierge
addHotspot(zoneL1Lobby, {
  id: 'hs-l1-packages',
  localPosition: [2.0, 2.3, 9.5],
  title: { vi: 'Quầy Tư vấn Gói tập (Silver · Gold · Platinum)', en: 'Membership Packages Desk' },
  subtitle: {
    vi: 'Xem quyền lợi gói 1 tháng, đồng hành 3 tháng hoặc nâng cấp hạng thẻ.',
    en: 'Compare 1-month and 3-month Silver, Gold and Platinum memberships.',
  },
  badge: 'L1 · CONCIERGE',
  icon: 'package',
  priority: 'primary',
  liveSummaryKey: 'membership',
  action: {
    type: 'navigate',
    to: '/member/packages',
    ctaLabel: { vi: 'Xem Gói tập', en: 'Browse Memberships' },
    secondaryTo: '/member/packages/checkout',
    secondaryLabel: { vi: 'Thanh toán Gói tập', en: 'Package Checkout' },
  },
});

// 3. /member/invoices — POS & Billing Counter
addHotspot(zoneL1Lobby, {
  id: 'hs-l1-invoices',
  localPosition: [4.8, 2.0, 10.2],
  title: { vi: 'Quầy Thu ngân, Hóa đơn & Ví điện tử', en: 'POS Billing, Invoices & Wallet' },
  subtitle: {
    vi: 'Tra cứu lịch sử giao dịch, phiếu thu VNPay và biến động Ví hội viên.',
    en: 'Review transaction history, VNPay receipts and member wallet balance.',
  },
  badge: 'L1 · POS',
  icon: 'receipt',
  priority: 'secondary',
  liveSummaryKey: 'invoices',
  action: {
    type: 'navigate',
    to: '/member/invoices',
    ctaLabel: { vi: 'Xem Giao dịch & Hóa đơn', en: 'View Invoices' },
  },
});

// 4. /member/card — Card Issuance Station
addHotspot(zoneL1Lobby, {
  id: 'hs-l1-card',
  localPosition: [6.8, 2.1, 9.6],
  title: { vi: 'Trạm Thẻ hội viên Kỹ thuật số', en: 'Digital Member Card Station' },
  subtitle: {
    vi: 'Hiển thị thẻ hội viên SÖL, tải ảnh thẻ và kiểm tra trạng thái kích hoạt.',
    en: 'View your digital SÖL member card, download card pass and check status.',
  },
  badge: 'L1 · CARD',
  icon: 'card',
  priority: 'primary',
  liveSummaryKey: 'card',
  action: {
    type: 'navigate',
    to: '/member/card',
    ctaLabel: { vi: 'Mở Thẻ hội viên', en: 'Open Member Card' },
  },
});

// 5. /member/notifications — Notification Board in Lobby
addHotspot(zoneL1Lobby, {
  id: 'hs-l1-notifications',
  localPosition: [-1.2, 2.2, 13.2],
  title: { vi: 'Bảng Thông báo Trung tâm', en: 'Center Notifications Board' },
  subtitle: {
    vi: 'Cập nhật lịch lớp, xác nhận đặt sân và thông báo từ ban quản lý.',
    en: 'Class reminders, court booking confirmations and center updates.',
  },
  badge: 'L1 · ALERTS',
  icon: 'bell',
  priority: 'secondary',
  liveSummaryKey: 'notifications',
  action: {
    type: 'navigate',
    to: '/member/notifications',
    ctaLabel: { vi: 'Xem Thông báo', en: 'View Notifications' },
  },
});

// 6. /member/support — Member Support Desk
addHotspot(zoneL1Lobby, {
  id: 'hs-l1-support',
  localPosition: [-0.8, 2.0, 9.5],
  title: { vi: 'Bàn Hỗ trợ & Giải quyết Khiếu nại', en: 'Member Support & Helpdesk' },
  subtitle: {
    vi: 'Gửi yêu cầu hỗ trợ, góp ý dịch vụ hoặc theo dõi tiến độ xử lý phiếu hỗ trợ.',
    en: 'Submit support tickets, service feedback or track resolution status.',
  },
  badge: 'L1 · SUPPORT',
  icon: 'support',
  priority: 'secondary',
  liveSummaryKey: 'support',
  action: {
    type: 'navigate',
    to: '/member/support',
    ctaLabel: { vi: 'Mở Hỗ trợ & Khiếu nại', en: 'Open Support' },
  },
});

// 7. open-chat (/messages fallback) — Live Concierge & SÖL AI
addHotspot(zoneL1Lobby, {
  id: 'hs-l1-chat',
  localPosition: [2.2, 2.4, 13.0],
  title: { vi: 'Trò chuyện Trực tiếp & Trợ lý SÖL AI', en: 'Live Chat & SÖL AI Concierge' },
  subtitle: {
    vi: 'Nhắn tin trực tiếp với Lễ tân, Huấn luyện viên hoặc hỏi đáp ngay cùng SÖL AI.',
    en: 'Message receptionists and coaches directly or ask SÖL AI in real time.',
  },
  badge: 'LIVE CHAT · AI',
  icon: 'star',
  priority: 'primary',
  action: {
    type: 'open-chat',
    topic: 'concierge',
    ctaLabel: { vi: 'Mở Tin nhắn & SÖL AI', en: 'Open Messages & SÖL AI' },
    fallbackTo: '/messages',
  },
});

// 8. /member/streak — Workout Streak Totem
addHotspot(zoneL1Lobby, {
  id: 'hs-l1-streak',
  localPosition: [-3.8, 2.4, 8.2],
  title: { vi: 'Cột Mốc Streak Tập luyện', en: 'Workout Streak Totem' },
  subtitle: {
    vi: 'Theo dõi chuỗi ngày tập liên tiếp 13 tuần trên biểu đồ lưới rắn SÖL.',
    en: 'Track your 13-week consecutive workout streak on the SÖL snake grid.',
  },
  badge: 'L1 · STREAK',
  icon: 'star',
  priority: 'secondary',
  liveSummaryKey: 'streak',
  action: {
    type: 'navigate',
    to: '/member/streak',
    ctaLabel: { vi: 'Xem Streak tập luyện', en: 'View Workout Streak' },
  },
});

// 9. /member/check-in — QR Turnstile Gate
addHotspot(zoneL1Gate, {
  id: 'hs-l1-checkin',
  localPosition: [0, 2.1, 4.0],
  title: { vi: 'Cổng Quét QR Check-in', en: 'Gate QR Check-in' },
  subtitle: {
    vi: 'Đưa mã QR hội viên qua cổng để check-in vào khu vực tập luyện.',
    en: 'Scan your member QR pass at the turnstile to enter the training floor.',
  },
  badge: 'L1 · GATE',
  icon: 'scan',
  priority: 'primary',
  liveSummaryKey: 'checkin',
  action: {
    type: 'navigate',
    to: '/member/check-in',
    ctaLabel: { vi: 'Quét QR Check-in ngay', en: 'Open QR Check-in' },
  },
});

// 10. /member/orders & /member/products — Supplement Shop
addHotspot(zoneL1Shop, {
  id: 'hs-l1-shop',
  localPosition: [15.0, 2.4, 9.2],
  title: { vi: 'Cửa hàng Thực phẩm bổ sung & Đơn hàng', en: 'Supplement Shop & Member Orders' },
  subtitle: {
    vi: 'Đặt mua Whey, BCAA, Creatine nhận tại quầy SÖL hoặc giao tận nơi.',
    en: 'Order Whey, BCAA and Creatine for SÖL desk pickup or home delivery.',
  },
  badge: 'L1 · SHOP',
  icon: 'bag',
  priority: 'primary',
  liveSummaryKey: 'shop',
  action: {
    type: 'navigate',
    to: '/member/orders',
    ctaLabel: { vi: 'Mở Sản phẩm & Đơn hàng', en: 'Open Shop & Orders' },
    secondaryTo: '/member/products',
    secondaryLabel: { vi: 'Xem Kệ sản phẩm', en: 'Browse Catalog' },
  },
});

// 11. /member/classes?discipline=Gym — Standard Gym Arena
addHotspot(zoneL1Gym, {
  id: 'hs-l1-gym',
  localPosition: [-8.0, 2.5, -6.0],
  title: { vi: 'Phòng Gym Tiêu chuẩn · Lịch lớp & Thiết bị', en: 'Standard Gym · Schedule & Equipment' },
  subtitle: {
    vi: 'Xem trạng thái trực tiếp 29 máy tập Cardio/Strength và đặt lịch lớp Gym.',
    en: 'Inspect live status of 29 Cardio/Strength machines and book Gym classes.',
  },
  badge: 'L1 · GYM',
  icon: 'dumbbell',
  priority: 'primary',
  liveSummaryKey: 'classes',
  action: {
    type: 'navigate',
    to: '/member/classes',
    query: { discipline: 'Gym' },
    ctaLabel: { vi: 'Xem Lịch lớp Gym', en: 'View Gym Schedule' },
    secondaryTo: '/member/progress',
    secondaryLabel: { vi: 'Mở Giáo án của tôi', en: 'My Training Plan' },
  },
});

// 12. /member/classes?discipline=Boxing — Boxing Ring Arena 01
addHotspot(zoneL1Boxing, {
  id: 'hs-l1-boxing',
  localPosition: [10.5, 2.5, -9.2],
  title: { vi: 'Ring Arena 01 · Lớp Boxing & Kickfit', en: 'Ring Arena 01 · Boxing & Kickfit' },
  subtitle: {
    vi: 'Đặt chỗ các buổi tập kỹ thuật đấm, phản xạ và thể lực theo hiệp.',
    en: 'Book round-based boxing technique, reflex and conditioning classes.',
  },
  badge: 'L1 · BOXING',
  icon: 'calendar',
  priority: 'primary',
  liveSummaryKey: 'classes',
  action: {
    type: 'navigate',
    to: '/member/classes',
    query: { discipline: 'Boxing' },
    ctaLabel: { vi: 'Đặt lớp Boxing', en: 'Book Boxing Class' },
  },
});

// 13. /member/courts?sport=Cầu lông — Badminton Courts 01..04
addHotspot(zoneL1Badminton, {
  id: 'hs-l1-badminton',
  localPosition: [-13.0, 2.4, 8.5],
  title: { vi: 'Đặt Sân Cầu lông 01–04', en: 'Book Badminton Courts 01–04' },
  subtitle: {
    vi: 'Kiểm tra khung giờ trống trực tiếp và đặt sân cầu lông theo giờ (06:00–22:00).',
    en: 'Check live hourly availability and book indoor badminton courts (06:00–22:00).',
  },
  badge: 'L1 · 4 COURTS',
  icon: 'court',
  priority: 'primary',
  liveSummaryKey: 'courts',
  action: {
    type: 'navigate',
    to: '/member/courts',
    query: { sport: 'Cầu lông' },
    ctaLabel: { vi: 'Đặt sân Cầu lông', en: 'Book Badminton Court' },
    secondaryTo: '/member/classes?discipline=Cầu lông',
    secondaryLabel: { vi: 'Lịch lớp Cầu lông', en: 'Badminton Classes' },
  },
});

// 14. L1 Core -> Focus L2
addHotspot(zoneL1Core, {
  id: 'hs-l1-core',
  localPosition: [13.5, 2.4, 1.0],
  title: { vi: 'Thang máy lên Tầng 2 VIP & Tầng thượng', en: 'Elevator to L2 VIP & Rooftop' },
  subtitle: {
    vi: 'Di chuyển nhanh lên Phòng Gym VIP Platinum (Tầng 2) hoặc Zen Garden (Tầng thượng).',
    en: 'Ascend to L2 VIP Platinum Gym or the Rooftop Zen Garden Studio.',
  },
  badge: 'L1 → L2',
  icon: 'cube',
  priority: 'secondary',
  action: {
    type: 'focus-level',
    level: 'L2',
    ctaLabel: { vi: 'Lên Tầng 2 VIP', en: 'Go to Level 2 VIP' },
  },
});

// 15. B1 Pool -> /member/courts?sport=Bơi lội
addHotspot(zoneB1Pool, {
  id: 'hs-b1-pool',
  localPosition: [-6.0, 1.8, -5.5],
  title: { vi: 'Oasis Lap Pool · Đặt Làn bơi 01 & 02', en: 'Oasis Lap Pool · Book Lanes 01 & 02' },
  subtitle: {
    vi: 'Đặt làn bơi 25m theo khung giờ hoặc đăng ký lớp Bơi lội cùng HLV.',
    en: 'Reserve 25m lap lanes by the hour or join coached swimming sessions.',
  },
  badge: 'B1 · POOL',
  icon: 'court',
  priority: 'primary',
  liveSummaryKey: 'courts',
  action: {
    type: 'navigate',
    to: '/member/courts',
    query: { sport: 'Bơi lội' },
    ctaLabel: { vi: 'Đặt Làn bơi', en: 'Book Swim Lane' },
    secondaryTo: '/member/classes?discipline=Bơi lội',
    secondaryLabel: { vi: 'Lịch lớp Bơi lội', en: 'Swimming Classes' },
  },
});

// 16. B1 Thermal -> /member/packages
addHotspot(zoneB1Thermal, {
  id: 'hs-b1-thermal',
  localPosition: [14.0, 2.0, -4.5],
  title: { vi: 'Đặc quyền Xông hơi & Jacuzzi Platinum', en: 'Platinum Thermal & Jacuzzi Access' },
  subtitle: {
    vi: 'Tiện ích xông hơi đá muối & bồn sục dành cho hội viên gói Platinum.',
    en: 'Salt sauna and hydro-recovery Jacuzzi included with Platinum membership.',
  },
  badge: 'B1 · PLATINUM',
  icon: 'package',
  priority: 'secondary',
  liveSummaryKey: 'membership',
  action: {
    type: 'navigate',
    to: '/member/packages',
    ctaLabel: { vi: 'Xem Quyền lợi Platinum', en: 'View Platinum Perks' },
  },
});

// 17. B1 Locker -> /member/card
addHotspot(zoneB1Locker, {
  id: 'hs-b1-locker',
  localPosition: [-6.0, 2.2, 9.0],
  title: { vi: 'Tủ khóa Thông minh & Thẻ hội viên', en: 'Smart Lockers & Member Card' },
  subtitle: {
    vi: 'Sử dụng Thẻ hội viên để mở tủ khóa cá nhân tại khu vực thay đồ Tầng hầm.',
    en: 'Use your Member Card pass to unlock assigned lockers in the B1 changing suite.',
  },
  badge: 'B1 · LOCKER',
  icon: 'card',
  priority: 'secondary',
  liveSummaryKey: 'card',
  action: {
    type: 'navigate',
    to: '/member/card',
    ctaLabel: { vi: 'Mở Thẻ hội viên', en: 'Open Member Card' },
  },
});

// 18. B1 Core -> Focus L1
addHotspot(zoneB1Core, {
  id: 'hs-b1-core',
  localPosition: [14.0, 2.2, 9.0],
  title: { vi: 'Lên Sảnh chính Tầng 1', en: 'Return to L1 Main Lobby' },
  subtitle: {
    vi: 'Di chuyển từ Tầng hầm Oasis lên Quầy Lễ tân và Khu Gym Tầng 1.',
    en: 'Take the elevator from B1 Oasis up to the L1 Main Lobby and Gym.',
  },
  badge: 'B1 → L1',
  icon: 'cube',
  priority: 'secondary',
  action: {
    type: 'focus-level',
    level: 'L1',
    ctaLabel: { vi: 'Lên Tầng 1', en: 'Go to Level 1' },
  },
});

// 19. L2 VIP Gym -> /member/packages
addHotspot(zoneL2VipGym, {
  id: 'hs-l2-vip-gym',
  localPosition: [-7.0, 2.4, -4.5],
  title: { vi: 'Phòng Gym VIP Platinum · Technogym Artis', en: 'VIP Platinum Gym · Technogym Artis' },
  subtitle: {
    vi: 'Kiểm tra trạng thái 10 thiết bị Technogym VIP và quyền truy cập hạng thẻ của bạn.',
    en: 'Check live status of 10 Technogym VIP stations and your tier access.',
  },
  badge: 'L2 · VIP PLATINUM',
  icon: 'dumbbell',
  priority: 'primary',
  liveSummaryKey: 'membership',
  action: {
    type: 'navigate',
    to: '/member/packages',
    ctaLabel: { vi: 'Kiểm tra / Nâng cấp Platinum', en: 'Check Platinum Access' },
    secondaryTo: '/member/classes?discipline=Gym',
    secondaryLabel: { vi: 'Lịch lớp Gym', en: 'Gym Schedule' },
  },
});

// 20. /member/progress — L2 InBody 770 Lab
addHotspot(zoneL2Inbody, {
  id: 'hs-l2-inbody',
  localPosition: [11.5, 2.2, -9.5],
  title: { vi: 'Phân tích InBody 770 · Tiến độ & Giáo án', en: 'InBody 770 · Progress & Training Plans' },
  subtitle: {
    vi: 'Theo dõi lịch sử BMI, % mỡ cơ thể, khối lượng cơ và giáo án HLV thiết kế riêng.',
    en: 'Track your BMI, body fat %, muscle mass history and personalized training plans.',
  },
  badge: 'L2 · INBODY 770',
  icon: 'chart',
  priority: 'primary',
  liveSummaryKey: 'progress',
  action: {
    type: 'navigate',
    to: '/member/progress',
    ctaLabel: { vi: 'Mở Tiến độ & Giáo án', en: 'Open Progress & Plans' },
    secondaryTo: '/member/profile',
    secondaryLabel: { vi: 'Cập nhật Hồ sơ Sức khỏe', en: 'Update Health Profile' },
  },
});

// 21. /member/profile — Health & Profile Consultation Pod
addHotspot(zoneL2Inbody, {
  id: 'hs-l2-profile',
  localPosition: [16.2, 2.0, -7.2],
  title: { vi: 'Hồ sơ Cá nhân & Chỉ số Sức khỏe', en: 'Member Profile & Health Records' },
  subtitle: {
    vi: 'Cập nhật thông tin cá nhân, mục tiêu tập luyện và hồ sơ thể trạng của bạn.',
    en: 'Manage your personal profile, fitness goals and baseline health metrics.',
  },
  badge: 'L2 · PROFILE',
  icon: 'profile',
  priority: 'primary',
  liveSummaryKey: 'profile',
  action: {
    type: 'navigate',
    to: '/member/profile',
    ctaLabel: { vi: 'Mở Hồ sơ & Sức khỏe', en: 'Open Profile & Health' },
  },
});

// 22. /member/classes?tab=pt — L2 1:1 PT Studio
addHotspot(zoneL2PtStudio, {
  id: 'hs-l2-pt-studio',
  localPosition: [13.5, 2.3, 5.5],
  title: { vi: 'Studio HLV Cá nhân 1:1 (Personal Trainer)', en: '1:1 Personal Trainer Studio' },
  subtitle: {
    vi: 'Đặt lịch tập 1:1 cùng Huấn luyện viên hoặc xem hồ sơ đội ngũ HLV SÖL.',
    en: 'Book 1:1 personal training sessions or explore SÖL coach profiles.',
  },
  badge: 'L2 · 1:1 PT',
  icon: 'calendar',
  priority: 'primary',
  liveSummaryKey: 'coaches',
  action: {
    type: 'navigate',
    to: '/member/classes',
    query: { tab: 'pt' },
    ctaLabel: { vi: 'Đặt lịch HLV 1:1 (PT)', en: 'Book 1:1 PT Session' },
    secondaryTo: '/trainers',
    secondaryLabel: { vi: 'Xem Đội ngũ HLV', en: 'Meet Our Coaches' },
  },
});

// 23. L2 Lounge -> /member/orders
addHotspot(zoneL2Lounge, {
  id: 'hs-l2-lounge',
  localPosition: [-6.0, 2.1, 10.2],
  title: { vi: 'Platinum Lounge & Quầy Dinh dưỡng', en: 'Platinum Lounge & Recovery Bar' },
  subtitle: {
    vi: 'Đặt trước thực phẩm bổ sung và thức uống phục hồi sau buổi tập.',
    en: 'Pre-order recovery supplements and post-workout nutrition.',
  },
  badge: 'L2 · LOUNGE',
  icon: 'bag',
  priority: 'secondary',
  liveSummaryKey: 'shop',
  action: {
    type: 'navigate',
    to: '/member/orders',
    ctaLabel: { vi: 'Đặt Thực phẩm bổ sung', en: 'Order Supplements' },
  },
});

// 24. RF Zen Garden -> /member/classes?discipline=Yoga
addHotspot(zoneRfZen, {
  id: 'hs-rf-zen',
  localPosition: [-3.0, 2.2, -1.5],
  title: { vi: 'Zen Garden Studio · Lịch lớp Yoga & Giãn cơ', en: 'Zen Garden Studio · Yoga & Mobility' },
  subtitle: {
    vi: 'Xem lịch lớp Yoga trên tầng Penthouse và đặt chỗ cho buổi tập tiếp theo.',
    en: 'Browse Penthouse Yoga sessions and reserve your mat.',
  },
  badge: 'RF · YOGA',
  icon: 'calendar',
  priority: 'primary',
  liveSummaryKey: 'classes',
  action: {
    type: 'navigate',
    to: '/member/classes',
    query: { discipline: 'Yoga' },
    ctaLabel: { vi: 'Đặt lớp Yoga', en: 'Book Yoga Class' },
  },
});

// 25. RF Terrace -> /member/streak
addHotspot(zoneRfTerrace, {
  id: 'hs-rf-terrace',
  localPosition: [15.0, 2.1, 0],
  title: { vi: 'Vườn Thiền Sân Thượng · Chuỗi Ngày tập', en: 'Mindful Sky Deck · Workout Streak' },
  subtitle: {
    vi: 'Duy trì thói quen rèn luyện mỗi ngày và kiểm tra kỷ lục Streak của bạn.',
    en: 'Celebrate daily consistency and view your all-time workout streak.',
  },
  badge: 'RF · SKY DECK',
  icon: 'star',
  priority: 'secondary',
  liveSummaryKey: 'streak',
  action: {
    type: 'navigate',
    to: '/member/streak',
    ctaLabel: { vi: 'Xem Streak tập luyện', en: 'View Workout Streak' },
  },
});

// 26. OUT Tennis -> /member/courts?sport=Tennis
addHotspot(zoneOutTennis, {
  id: 'hs-out-tennis',
  localPosition: [34.6, 2.4, 0],
  title: { vi: 'Đặt Sân Tennis Ngoài trời 01 & 02', en: 'Book Outdoor Tennis Courts 01 & 02' },
  subtitle: {
    vi: 'Chọn khung 60 phút cho Sân Tennis 01 (Sân A) hoặc Sân Tennis 02 (Sân B).',
    en: 'Reserve 60-minute slots on Outdoor Tennis Court 01 (A) or Court 02 (B).',
  },
  badge: 'OUT · 2 COURTS',
  icon: 'court',
  priority: 'primary',
  liveSummaryKey: 'courts',
  action: {
    type: 'navigate',
    to: '/member/courts',
    query: { sport: 'Tennis' },
    ctaLabel: { vi: 'Đặt Sân Tennis', en: 'Book Tennis Court' },
    secondaryTo: '/member/classes?discipline=Tennis',
    secondaryLabel: { vi: 'Lịch lớp Tennis', en: 'Tennis Classes' },
  },
});

// 27. Main Entrance Gate & Porte-Cochère Plaza -> /member/check-in
addHotspot(zoneL1Lobby, {
  id: 'hs-l1-main-gate',
  localPosition: [12.4, 3.6, 21.6],
  title: { vi: 'Cổng chính SÖL & Chốt An ninh 24/7', en: 'SÖL Main Gate & 24/7 Security' },
  subtitle: {
    vi: 'Cổng chào kiến trúc SÖL, làn đón trả khách Porte-Cochère, đài phun nước cảnh quan và kiểm soát barrier tự động.',
    en: 'Monumental SÖL entrance archway, porte-cochère drop-off loop, reflection fountain and automated barrier access.',
  },
  badge: 'GATE · ENTRY',
  icon: 'scan',
  priority: 'primary',
  liveSummaryKey: 'checkin',
  action: {
    type: 'navigate',
    to: '/member/check-in',
    ctaLabel: { vi: 'Mở QR Check-in Hội viên', en: 'Open Member QR Check-in' },
    secondaryTo: '/member/card',
    secondaryLabel: { vi: 'Mở Thẻ hội viên', en: 'Open Member Card' },
  },
});

// 28. Executive Car & EV Parking + Covered Motorbike Shelter -> /member/card
addHotspot(zoneL1Lobby, {
  id: 'hs-l1-parking',
  localPosition: [21.2, 2.6, 20.2],
  title: { vi: 'Bãi Đỗ Xe Ô tô (EV) & Nhà Xe Máy Có Mái Che', en: 'Solar Car & EV Parking + Motorbike Shelter' },
  subtitle: {
    vi: 'Bãi đỗ ô tô mái năng lượng mặt trời kèm 4 trạm sạc nhanh EV Supercharge và nhà để xe máy/xe đạp có mái che.',
    en: 'Solar-canopy car parking with 4 EV fast chargers and covered motorbike & bicycle pavilion.',
  },
  badge: 'P · PARKING & EV',
  icon: 'card',
  priority: 'primary',
  liveSummaryKey: 'card',
  action: {
    type: 'navigate',
    to: '/member/card',
    ctaLabel: { vi: 'Thẻ Gửi Xe Hội viên', en: 'Member Parking Pass' },
  },
});

// Register zones into their parent levels
levelB1.children.unshift(zoneB1Pool.id, zoneB1Thermal.id, zoneB1Locker.id, zoneB1Core.id);
levelL1.children.unshift(
  zoneL1Lobby.id,
  zoneL1Gate.id,
  zoneL1Shop.id,
  zoneL1Gym.id,
  zoneL1Boxing.id,
  zoneL1Badminton.id,
  zoneL1Core.id,
);
levelL2.children.unshift(zoneL2VipGym.id, zoneL2Inbody.id, zoneL2PtStudio.id, zoneL2Lounge.id);
levelRF.children.unshift(zoneRfZen.id, zoneRfTerrace.id);
levelOUT.children.unshift(zoneOutTennis.id);

export const SOL_CENTER_SCENE: SceneDoc = {
  version: 1,
  rootId: siteNode.id,
  nodes,
};

export { buildingNode };
