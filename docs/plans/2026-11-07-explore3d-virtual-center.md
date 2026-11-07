# Kế hoạch: Tham quan trung tâm SÖL 3D (Explore 3D)

> Dành cho coding agent thực hiện. Đọc cùng `AGENTS.md`, `DESIGN.md`, `docs/PROJECT_MASTER_GUIDE.md`.
> Ngày lập: 07/11/2026. Trạng thái: **đề xuất, chưa triển khai**. Jira: tạo Epic "Tham quan trung tâm 3D" và gán key cho từng ticket ở mục 11 trước khi mở PR (ghi key vào mô tả PR theo `AGENTS.md`).
> Nguồn cảm hứng: [pascalorg/editor](https://github.com/pascalorg/editor) (MIT): trình dựng toà nhà 3D bằng React Three Fiber + WebGPU, dữ liệu node phẳng Site → Building → Level → Wall/Zone/Item, có chế độ xem xếp tầng/tách tầng/solo và đi bộ ngang tầm mắt.

## 1. Mục tiêu

Hội viên mở một trang trong portal và xem **toàn bộ trung tâm SÖL Fitness dưới dạng mô hình 3D**: xoay, zoom, chọn tầng, chọn từng khu, zoom sát vào từng máy tập hoặc sân. Mỗi khu và vật thể quan trọng gắn với **một tính năng có thật của web** (đặt sân, lịch lớp, check-in, thẻ hội viên, cửa hàng, tiến độ, hỗ trợ…) và hiển thị **dữ liệu thật từ API** (trạng thái phòng, số lượng và tình trạng máy, sân trống).

Đây là đồ án môn học nên toà nhà là **mô phỏng minh hoạ**: được tự thiết kế để chứa đủ mọi tính năng trong một khuôn viên. UI luôn hiện nhãn "Mô phỏng minh hoạ" (đúng quy tắc ảnh minh hoạ trong `DESIGN.md`).

### Tiêu chí thành công (Definition of Done của Epic)

| # | Tiêu chí | Đo bằng |
|---|---|---|
| 1 | **≥ 60 FPS** khi camera đang chuyển động trên máy tham chiếu (mục 8.1); khi đứng yên thì không render (0 GPU) | Benchmark `?bench=1` (mục 9.3), ghi vào `docs/qa/explore3d-perf.md` |
| 2 | Zoom tới **mọi** khu và vật thể có gắn dữ liệu bằng 1 click (bay tới) hoặc double-click (sát vật thể) | Test + quay màn hình |
| 3 | Mỗi khu có **ít nhất một góc nhìn được chọn tay** ("góc đẹp") và một góc tự tính dự phòng | Test schema |
| 4 | **Mọi route MEMBER** trong `PORTAL_NAV` truy cập được từ ít nhất một hotspot trong không gian 3D | Test coverage (mục 9.1) |
| 5 | Không có số liệu bịa: số người, sĩ số, giá chỉ lấy từ API; không có dữ liệu thì ghi "Không có dữ liệu trực tiếp" | Review + test bindings |
| 6 | Có bản 2D thay thế khi không có WebGL2, máy quá yếu hoặc người dùng tự chọn | Test |
| 7 | Song ngữ vi/en, bàn phím, `prefers-reduced-motion`, theme sáng/tối | Test + checklist |
| 8 | Bundle entry của portal **không tăng quá 2 KB gzip**; toàn bộ code 3D nằm trong chunk lazy | `vite build` |

### Ngoài phạm vi

Trình chỉnh sửa layout cho Manager, multiplayer/avatar, VR/AR, ảnh scan thật, model 3D do artist làm, backend mới, bảng hoặc migration mới. Bản xem trước công khai trên landing được tách thành follow-up (mục 13).

## 2. Quyết định kiến trúc

### 2.1 Không nhúng Pascal Editor; tự dựng viewer nhẹ theo mô hình dữ liệu của Pascal

| Phương án | Ưu điểm | Lý do loại hoặc chọn |
|---|---|---|
| A. Nhúng `@pascal-app/viewer` | Đã có sẵn tường, CSG, chế độ tầng | Ưu tiên WebGPU, host là Next.js 16; scene lưu ở IndexedDB/SQLite và không có định dạng export được tài liệu hoá nên khó version trong repo; kéo theo cả hệ thống plugin/editor dù ta chỉ cần xem. Khó bảo đảm 60 FPS trên Safari hay máy chỉ có GPU tích hợp. **Loại.** |
| B. Viewer riêng bằng three.js + R3F + drei, schema node phẳng kiểu Pascal, hình học sinh bằng code | Kiểm soát được draw call; dữ liệu là file TS trong repo có test; không cần asset nặng; đúng stack React/Vite hiện tại | **Chọn.** |
| C. Dựng trong Blender rồi xuất `.glb` | Đẹp nhất | Cần người làm 3D, file nặng, khó gắn dữ liệu và i18n. Chỉ dùng như nâng cấp tuỳ chọn ở P2. |

Có thể dùng Pascal Editor trên máy cá nhân để **phác layout cho dễ hình dung**, nhưng nguồn sự thật duy nhất là file scene TS (mục 4). Nếu chép bất kỳ đoạn code nào từ Pascal, giữ header MIT và ghi vào `THIRD_PARTY_NOTICES.md`.

### 2.2 Stack (cố định version chính xác, không dùng `^`)

| Gói | Version | Vai trò |
|---|---|---|
| `three` | `0.187.0` | Renderer (**WebGL2**, không dùng WebGPU để giữ tương thích rộng) |
| `@react-three/fiber` | `9.8.2` | React renderer (peer: React `>=19 <19.4`, khớp với `react@^19.3`) |
| `@react-three/drei` | `10.7.9` | `CameraControls`, `Bvh`, `Instances`, `Text`, `PerformanceMonitor`, `AdaptiveDpr`, `Environment` + `Lightformer` |
| `zustand` | `5.1.0` | Store của viewer (R3F đã phụ thuộc gói này) |
| `@types/three` (dev) | `0.187.0` | Kiểu |
| `r3f-perf` (dev, tuỳ chọn) | `7.2.3` | Overlay khi phát triển; không vào bundle production |

Không thêm `@react-three/postprocessing` ở P0/P1. Hậu kỳ (SMAA hoặc N8AO) chỉ được bật ở tier "cao" sau khi benchmark chứng minh vẫn ≥ 60 FPS.

### 2.3 Đặt trong ứng dụng

- Route: `/member/explore`, nằm trong khối `RoleGuard allowedRoles={['MEMBER']}` của `apps/web/src/app/router.tsx`, lazy import như các route khác.
- Sidebar: thêm vào `PORTAL_NAV` (`features/portal/portalNavigation.ts`) mục `{ to: '/member/explore', label: 'Tham quan 3D', icon: 'cube', roles: ['MEMBER'] }`, đặt ngay sau "Bảng điều khiển"; nhãn EN `'Explore 3D'` trong `PORTAL_NAV_EN_LABELS`; thêm icon `cube` vào `PortalIcon.tsx` (nét SVG 20px như các icon hiện có). Giữ sidebar chỉ có icon theo `DESIGN.md`.
- Vite `manualChunks`: thêm chunk `three-vendor` cho `node_modules/three`, `@react-three/*`, `camera-controls`, `troika-*`, `three-mesh-bvh`. Kiểm tra plugin service worker (`features/pwa/serviceWorker.ts`) **không precache** chunk này (khoảng 400 KB); chỉ cache khi chạy.
- Backend: **không đổi**. Mọi dữ liệu đọc qua endpoint đã có (mục 6). `GET /api/v1/rooms` và `GET /api/v1/equipment` không có `@PreAuthorize`, nên chỉ cần đăng nhập. Ticket EXP-06 phải xác minh bằng tài khoản MEMBER; nếu bị 403 thì khu đó hiện "Không có dữ liệu trực tiếp", **không** tự mở endpoint mới khi chưa hỏi người dùng.

## 3. Thiết kế không gian: một khuôn viên chứa đủ mọi tính năng

Đơn vị là mét. Gốc toạ độ ở góc tây bắc toà nhà. Trục **x hướng đông**, **z hướng nam** (về phía người xem), **y hướng lên**. Toà nhà rộng 60 × 36 m; sân tennis ngoài trời nằm phía đông. Toàn khuôn viên khoảng 110 × 50 m (x −4…106, z −4…46).

### 3.1 Các tầng

| Tầng | id | Cao độ sàn (y) | Chiều cao | Ghi chú |
|---|---|---|---|---|
| Tầng hầm Oasis | `B1` | −4.5 | 4.5 | Hồ bơi |
| Tầng 1 | `L1` | 0 | 5.0 | Sảnh, gym tiêu chuẩn, boxing, nhà thi đấu cầu lông (cao 2 tầng) |
| Tầng 2 | `L2` | 5.0 | 4.5 | Gym VIP, khu HLV, ban công nhìn xuống sân cầu lông |
| Sân thượng | `RF` | 9.5 | 3.5 | Zen Garden Studio (Yoga) |
| Ngoài trời | `OUT` | 0 | — | 2 sân tennis, quảng trường lối vào |

### 3.2 Mặt bằng từng tầng

```
TẦNG 1 (L1)                                   x→
z  0 ┌────────────┬───────────┬───────────┬─────────────────────┐
 ↓   │ Tủ đồ &    │ Lõi thang │ Ring Arena│  NHÀ THI ĐẤU        │
     │ phòng tắm  │ bộ + máy  │ 01 Boxing │  CẦU LÔNG (2 tầng)  │
  12 ├────────────┤ (x14–26)  │ (x26–38)  │  ┌──────┐┌──────┐   │
     │ Cửa hàng   │           │           │  │ CL01 ││ CL02 │   │
  14 │ Sản phẩm   ├───────────┴───────────┤  └──────┘└──────┘   │
     │ (x0–14)    │                       │                     │
  22 ├────────────┤  PHÒNG GYM TIÊU CHUẨN │  ┌──────┐┌──────┐   │
     │ SẢNH       │  (x14–38, z14–36)     │  │ CL03 ││ CL04 │   │
     │ Lễ tân,    │                       │  └──────┘└──────┘   │
     │ cổng QR    │                       │     (x38–60)        │
  36 └──▲─────────┴───────────────────────┴─────────────────────┘
       Lối vào (mặt nam)            x=60      SÂN TENNIS 01 | 02 (x66–102, z0–36)
```

| Tầng | Zone id | Hình chữ nhật (x, z) | Gắn với dữ liệu | Vật thể chính |
|---|---|---|---|---|
| L1 | `lobby` | x0–14, z22–36 | — (khu chức năng) | Quầy lễ tân + POS, 3 cổng soát vé QR, kiosk thẻ hội viên, quầy hỗ trợ, màn hình bảng tin, bảng thông báo, ghế chờ |
| L1 | `shop` | x0–14, z12–22 | `GET /public/products` | 3 kệ sản phẩm, quầy thực phẩm bổ sung, tủ mát |
| L1 | `lockers` | x0–14, z0–12 | trang trí | Tủ đồ, ghế, vách tắm |
| L1 | `core` | x14–26, z0–14 | trang trí | Cầu thang, thang máy (hotspot đổi tầng), WC |
| L1 | `boxing` | x26–38, z0–14 | Room "Ring Arena 01" (seed đang ở trạng thái `maintenance`) | Võ đài 6×6 m, 4 bao cát, giá găng |
| L1 | `gym-standard` | x14–38, z14–36 | Room "Phòng Gym Tiêu chuẩn" + thiết bị `EQ-*-01` | Xem 3.3 |
| L1 (cao 2 tầng) | `badminton-hall` | x38–60, z0–36 | Court "Sân Cầu lông 01–04" | 4 sân 6.1 × 13.4 m, mỗi sân trong ô 11 × 18 m (x38–49 / 49–60, z0–18 / 18–36), lưới, đèn |
| L2 | `recovery` | x0–14, z0–14 | trang trí | Thảm giãn cơ, con lăn |
| L2 | `coach-hub` | x0–14, z14–36 | Public catalog (danh sách HLV) | Bàn tư vấn PT, màn hình "Giáo án & AI", tường ảnh HLV, kiosk SÖL AI |
| L2 | `core` | x14–26, z0–14 | trang trí | Thang |
| L2 | `gallery` | x26–38, z0–14 | trang trí | Ban công kính nhìn xuống nhà thi đấu (tường kính tại x=38), ghế |
| L2 | `gym-vip` | x14–38, z14–36 | Room "Phòng Gym VIP" (tier `PLATINUM`) + `EQ-VIP-*` | Xem 3.3; góc đo InBody |
| RF | `core` | x14–26, z0–14 | trang trí | Lối ra cầu thang |
| RF | `zen-garden` | x0–38, z14–36 | Room "Zen Garden Studio" | Studio kính x0–14 với 18 thảm yoga, sàn gỗ, giàn pergola, cây, hồ cảnh |
| B1 | `spa` | x0–14, z0–14 | trang trí | Phòng xông hơi, vòi sen |
| B1 | `core` | x14–26, z0–14 | trang trí | Thang |
| B1 | `pool-hall` | x0–38, z14–36 | Room "Oasis Lap Pool" + Court "Làn bơi 01–02" | Bể 25 × 6 m (x6.5–31.5, z22–28), 2 làn rộng 3 m, phao chia làn, bục xuất phát, ghế nằm |
| OUT | `tennis` | x66–102, z0–36 | Court "Sân Tennis 01–02" | 2 sân đôi 10.97 × 23.77 m, mỗi sân trong ô 18 × 36 m (x66–84 / 84–102); lưới, hàng rào, đèn |
| OUT | `plaza` | x−4–60, z36–46 | trang trí | Lối vào, biển SÖL Fitness, cây xanh |

Phòng được ghép với dữ liệu bằng **tên đầy đủ đã chuẩn hoá** (trim, NFC, lowercase), lấy đúng theo `CatalogSeeder.java` và `CourtSeeder.java`. Không ghép theo chuỗi con. Trường `location` của phòng trong seed ("Tầng 2 - Khu VIP Platinum", "Penthouse", "Sub-level Oasis"…) khớp với bố trí trên.

### 3.3 Bố trí thiết bị (ghép theo `code`, là khoá ổn định)

| Zone | Code | Loại renderer | Số slot | Bố trí gợi ý |
|---|---|---|---|---|
| gym-standard | `EQ-RUN-01` | `treadmill` | 8 | Một hàng dọc cửa kính mặt nam (z≈34), x16–36, cách nhau 2.4 m, hướng ra ngoài |
| gym-standard | `EQ-BIKE-01` | `upright-bike` | 6 | Hàng thứ hai, z≈31 |
| gym-standard | `EQ-SMI-01` | `smith-machine` | 3 | Khu sức mạnh phía bắc, z16–20 |
| gym-standard | `EQ-LAT-01` | `lat-pulldown` | 2 | Cạnh Smith |
| gym-standard | `EQ-SQUAT-01` | `squat-rack` | 2 | Trên thảm cao su |
| gym-standard | `EQ-BENCH-01` | `bench` | 6 | Trước dàn tạ |
| gym-standard | `EQ-DUMB-01` | `dumbbell-rack` | 2 | Dọc tường x≈37, có gương |
| gym-vip | `EQ-VIP-RUN-01` | `treadmill` (biến thể premium) | 4 | Cửa kính mặt nam |
| gym-vip | `EQ-VIP-SYN-01` | `elliptical` | 3 | |
| gym-vip | `EQ-VIP-KIN-01` | `kinesis-wall` | 2 | Gắn tường bắc |
| gym-vip | `EQ-VIP-DUMB-01` | `dumbbell-rack` (crôm) | 1 | |
| gym-vip | `EQ-VIP-INBODY-01` | `inbody` | 1 | Góc đánh giá thể trạng, có vách |

Quy tắc slot: số slot là số máy **vẽ ra tối đa**. Khi API trả `quantity` nhỏ hơn số slot thì ẩn các slot dư. Khi lớn hơn thì vẽ đủ slot và hiện nhãn "+N" trên panel. Nếu `status` là `maintenance` thì máy có viền cam và biểu tượng cờ lê; `broken` thì xám và có dấu ✕; `retired` thì ẩn. Thiết bị có trong API mà chưa có slot (manager thêm sau) được liệt kê trong panel của zone dưới mục "Thiết bị khác", không vẽ 3D.

## 4. Mô hình dữ liệu scene (kiểu Pascal: dictionary node phẳng)

File: `apps/web/src/features/explore3d/scene/schema.ts` (Zod) và `scene/solCenter.scene.ts` (dữ liệu, typed).

```ts
type Vec2 = [x: number, z: number];
type Vec3 = [x: number, y: number, z: number];
type I18nText = { vi: string; en: string };

interface Viewpoint {          // góc nhìn được chọn tay
  id: 'hero' | 'detail' | 'eye' | string;
  label: I18nText;
  position: Vec3;              // toạ độ thế giới
  target: Vec3;
  fov?: number;                // mặc định 40
}

interface BaseNode {
  id: string;                  // kebab-case, duy nhất
  type: NodeType;
  parentId: string | null;
  name: I18nText;
  viewpoints?: Viewpoint[];
  searchTerms?: string[];      // cho ô tìm kiếm, cả vi và en
}

type NodeType = 'site' | 'building' | 'level' | 'zone' | 'wall' | 'item' | 'hotspot';

interface LevelNode extends BaseNode { type: 'level'; code: 'B1'|'L1'|'L2'|'RF'|'OUT'; elevation: number; height: number; order: number }
interface ZoneNode extends BaseNode {
  type: 'zone';
  rect: [x0: number, z0: number, x1: number, z1: number];   // MVP chỉ dùng hình chữ nhật
  floor: FloorMaterial;           // 'rubber' | 'wood' | 'tile' | 'court-green' | 'court-blue' | 'concrete' | 'deck'
  spansLevels?: string[];         // badminton-hall: ['L1','L2']
  binding?: { roomName?: string; courtNames?: string[] };
  kind: 'functional' | 'decor';
  preferredAzimuthDeg?: number;   // hướng nhìn mặc định khi tự tính góc
}
interface WallNode extends BaseNode {
  type: 'wall'; start: Vec2; end: Vec2; thickness: number; height?: number;  // mặc định = chiều cao tầng
  exterior: boolean;
  openings?: { kind: 'door'|'window'|'glass'; offset: number; width: number; sill?: number; height: number }[];
}
interface ItemNode extends BaseNode {
  type: 'item';
  kind: ItemKind;                  // xem 5.3
  position: Vec3;                  // tương đối với gốc level (y = 0 là mặt sàn)
  rotationYDeg: number;
  variant?: string;                // 'premium' | 'chrome' …
  binding?: { equipmentCode?: string; slotIndex?: number; courtName?: string };
  interactive: boolean;
}
interface HotspotNode extends BaseNode {
  type: 'hotspot';
  position: Vec3;
  action: { kind: 'route'; to: string } | { kind: 'level'; level: string } | { kind: 'open-chat' };
  requires?: 'platinum';           // gym-vip: hiện khoá khi gói hiện tại không phải PLATINUM
}

type SceneDoc = { version: 1; nodes: Record<string, SceneNode>; rootId: string };
```

Selector cần có (`scene/selectors.ts`): `childrenOf`, `levelOf`, `zonesOfLevel`, `itemsOfZone`, `worldBox(nodeId)` (đã cache), `breadcrumb(nodeId)`, `search(query, lang)`.

Không dùng undo/redo, IndexedDB hay CSG. Viewer chỉ đọc. Cửa và cửa sổ tạo bằng cách **chia tường thành các đoạn hộp** quanh ô mở, không dùng boolean, nên chi phí gần như bằng 0.

## 5. Rendering

### 5.1 Cây component

```
ExplorePage (DOM: layout, panel, toolbar)          ← features/explore3d/ExplorePage.tsx
└─ WebGLGate (kiểm tra WebGL2; lỗi thì sang FloorPlan2D)
   └─ <Canvas frameloop="demand" dpr={[1, tier.maxDpr]} gl={{ antialias: tier.msaa, powerPreference: 'high-performance', stencil: false }}
             camera={{ fov: 40, near: 0.1, far: 400 }} shadows={tier.shadows}>
        PerformanceGovernor (PerformanceMonitor → tier; AdaptiveDpr)
        Lights (Hemisphere + Directional; shadow map tĩnh)
        Environment (Lightformer cục bộ, resolution 256, frames=1, không tải HDR qua mạng)
        LevelStack (vị trí y theo chế độ stacked/exploded/solo)
          └─ LevelArchitecture × 5 (mesh tường/sàn đã merge)
          └─ ZoneFloors, ZoneLabels (troika Text, chỉ cho tầng đang xem)
          └─ <Bvh firstHitOnly> ItemInstances (mỗi kind × variant một InstancedMesh)
          └─ Courts, Pool (mesh riêng, vạch sân vẽ bằng texture canvas sinh tại chỗ)
          └─ Hotspots (instanced sprite)
        CameraRig (drei CameraControls + điều phối chuyển cảnh)
        Cutaway (hạ tường theo chế độ)
        SelectionHighlight
```

### 5.2 Kiến trúc (tường, sàn, trần)

- `renderers/architecture/buildLevelGeometry.ts`: hàm thuần, nhận scene và level, trả về `BufferGeometry` đã merge (`BufferGeometryUtils.mergeGeometries`) theo **bucket**: `exterior-N`, `exterior-E`, `exterior-S`, `exterior-W`, `interior`, `glass`, `floor`, `slab-edge`. Mỗi level tối đa khoảng 8 mesh nên toàn cảnh khoảng 40 draw call cho phần kiến trúc.
- Kính dùng `MeshStandardMaterial` với `transparent`, `opacity 0.18`, `depthWrite false`. **Cấm** `MeshPhysicalMaterial.transmission` vì tốn một pass render thêm.
- Sàn mỗi zone là một quad; vật liệu theo `floor`, vạch sân là `CanvasTexture` sinh một lần (không tải ảnh).
- Nước hồ bơi dùng `ShaderMaterial` đơn giản (2 lớp normal procedural, không reflection hay refraction). Animation chỉ chạy khi B1 đang hiển thị và người dùng không bật reduced motion.

### 5.3 Thư viện vật thể (sinh hình học bằng code)

`renderers/items/<kind>.ts` export `build<Kind>Geometry(variant): { geometry: BufferGeometry; materialSlots }`, ghép từ box, cylinder, torus đã merge, **≤ 1.500 tam giác mỗi vật thể** (InBody, kinesis-wall ≤ 2.500). Cache theo `kind+variant`.

Danh sách kind: `treadmill`, `upright-bike`, `elliptical`, `smith-machine`, `lat-pulldown`, `squat-rack`, `bench`, `dumbbell-rack`, `kinesis-wall`, `inbody`, `boxing-ring`, `heavy-bag`, `glove-rack`, `badminton-net`, `tennis-net`, `court-light`, `pool-lane-rope`, `starting-block`, `lounger`, `yoga-mat`, `plant`, `pergola`, `reception-desk`, `turnstile`, `kiosk`, `screen`, `notice-board`, `shelf`, `fridge`, `locker`, `bench-seat`, `stairs`, `elevator`, `coach-desk`, `portrait-wall`, `sign`.

Mỗi kind × variant là **một `InstancedMesh`**, màu từng instance qua `instanceColor`. Vật liệu dùng chung một bảng màu (mục 5.5), tối đa khoảng 12 material cho cả scene. Mức chi tiết: vật thể có ≥ 6 instance dùng drei `<Detailed>` với 2 mức (gần ≤ 1.500 tris, xa ≤ 200 tris, ngưỡng 25 m).

### 5.4 Ánh sáng

- `HemisphereLight` + một `DirectionalLight`. Ở tier cao/trung, shadow map 2048/1024 được tính **một lần**: `gl.shadowMap.autoUpdate = false`, chỉ đặt `needsUpdate = true` sau khi tải xong và khi đổi chế độ tầng. Chỉ kiến trúc và vật thể lớn cast shadow.
- Tone mapping `AgXToneMapping`, output sRGB.
- Không dùng point light hay spot light động. Đèn sân/đèn trần chỉ là emissive material.

### 5.5 Bảng màu (charcoal–salmon, theo `DESIGN.md`)

| Vai trò | Tối (mặc định portal) | Sáng (`html[data-theme="light"]`) |
|---|---|---|
| Nền canvas | `#202020` → `#292929` (gradient dọc) | `#F5F5F3` → `#EEEFEC` |
| Sàn chung / tường | `#2b2b2b` / `#303030` | `#E4E2DE` / `#FFFFFF` |
| Sàn cao su gym | `#1f1f1f` | `#3a3a3a` |
| Gỗ yoga | `#a77b5b` | `#b98d6c` |
| Nhấn (logo, hotspot, chọn) | `#ce9180`, hover `#e1aa98` | như cũ |
| Chữ nhãn | `#faf9f6` | `#202020` |
| Bảo trì / hỏng | cam `#e0a050` / xám `#6b6b6b` | như cũ |

Đổi theme thì chỉ cập nhật `material.color` (lắng nghe thay đổi `data-theme`), không dựng lại geometry. Màu trạng thái chỉ dùng để truyền nghĩa, không biến thành theme riêng.

## 6. Dữ liệu trực tiếp và hotspot tính năng

### 6.1 Hook dữ liệu (`data/useLiveCenterData.ts`)

Tái sử dụng API client có sẵn, không viết `fetch` mới:

| Dữ liệu | Hàm hoặc endpoint có sẵn | Dùng cho |
|---|---|---|
| Phòng | `GET /api/v1/rooms` (dùng `catalogApi` của manager hoặc thêm hàm `listRooms` trong `explore3d/data`) | Trạng thái `available/maintenance/closed`, `capacity`, `tier`, giờ mở cửa |
| Thiết bị | `GET /api/v1/equipment` (tương tự `equipmentApi.ts`) | Số lượng và trạng thái theo `code` |
| Sân và làn | `courtsApi.courts()`, `courtsApi.availability(id, centerDate())` | Số khung còn trống hôm nay, khung kế tiếp |
| Buổi học | API lấy session trong `memberClassesApi.ts` (khoảng hôm nay đến +7 ngày) | "Buổi kế tiếp tại phòng này" kèm giờ và tên lớp, chỉ khi API trả |
| Gói hiện tại | `getCurrentMembership()` | Khoá hoặc mở khu VIP (tier PLATINUM), nhắc gói hết hạn |
| Check-in / streak | `memberCheckinApi.ts` | Trạng thái "Đã check-in hôm nay" ở cổng |
| HLV | `GET /api/v1/public/catalog` (`publicCatalog.ts`) | Tường ảnh HLV ở coach-hub (ảnh minh hoạ theo quy tắc hiện hành) |
| Sản phẩm | `GET /api/v1/public/products` (shop API) | 3–6 sản phẩm nổi bật trên panel cửa hàng |

Tải theo tầng: dữ liệu chung (rooms, equipment, membership) tải khi vào trang; dữ liệu sân/buổi học chỉ tải khi zone liên quan được chọn. Cache 60 giây trong store. Lỗi thì gọi `notify()` một lần (key `explore3d-live`); scene vẫn chạy với dữ liệu tĩnh. **Không** polling liên tục.

`data/bindings.ts` là hàm thuần `resolveBindings(scene, live) → Map<nodeId, LiveState>`, có test đầy đủ.

### 6.2 Ma trận phủ tính năng (bắt buộc, có test)

| Route MEMBER | Hotspot trong 3D | Vị trí |
|---|---|---|
| `/member/dashboard` | Màn hình bảng tin | `lobby` |
| `/member/packages` | Quầy tư vấn gói; cửa khoá khu VIP khi chưa có Platinum | `lobby`, `gym-vip` |
| `/member/classes` | Cửa phòng Gym, Boxing, Zen Garden | các zone phòng |
| `/member/classes?tab=pt` | Bàn tư vấn PT | `coach-hub` |
| `/member/courts?discipline=…` | Từng sân tennis, sân cầu lông, làn bơi | `tennis`, `badminton-hall`, `pool-hall` |
| `/member/card` | Kiosk thẻ hội viên | `lobby` |
| `/member/check-in` | Cổng soát vé QR | `lobby` |
| `/member/streak` | Màn hình nhỏ trên cổng | `lobby` |
| `/member/invoices` | POS của lễ tân | `lobby` |
| `/member/products`, `/member/orders` | Kệ sản phẩm, quầy thanh toán cửa hàng | `shop` |
| `/member/progress` | Màn hình "Giáo án & AI"; máy InBody | `coach-hub`, `gym-vip` |
| `/member/profile` | Máy InBody (CTA phụ "Hồ sơ & Sức khoẻ") | `gym-vip` |
| `/member/notifications` | Bảng thông báo | `lobby` |
| `/member/support` | Quầy hỗ trợ | `lobby` |
| Chat / SÖL AI | Kiosk SÖL AI: mở widget chat nổi đang có | `coach-hub` |

Mở chat: kiểm tra `shared/lib/floatingPanels.ts` và `ChatWidget.tsx` xem đã có sự kiện mở widget chưa. Nếu có thì dùng lại. Nếu chưa thì thêm một custom event `scms:open-chat` nhỏ vào ChatWidget (cùng PR EXP-09, có test). Không thêm lại route `/messages` vào sidebar.

CTA điều hướng bằng React Router. Trước khi rời trang, lưu trạng thái camera và node đang chọn vào `sessionStorage` (`scms_explore3d_view`, bọc try/catch) để khi bấm Back thì quay lại đúng góc nhìn.

### 6.3 Deep link

`/member/explore?level=L1&focus=gym-standard&item=EQ-RUN-01`. Khi tải trang thì bay thẳng tới đó (reduced motion thì đặt camera ngay). Thêm link "Xem trong 3D" ở: thẻ sân trong `CourtBookingFeature` (`focus=<court-node>`), thẻ phòng trong lịch lớp (khi tên phòng ghép được), panel thiết bị trong `/member/progress` nếu có. Những chỗ khác giữ nguyên.

## 7. Camera và "góc nhìn tốt nhất"

### 7.1 Điều khiển

drei `<CameraControls>` (thư viện camera-controls):

| Thiết lập | Toàn cảnh | Tầng/khu | Vật thể |
|---|---|---|---|
| `minDistance` / `maxDistance` | 25 / 160 | 6 / 70 | 1.6 / 12 |
| `minPolarAngle` / `maxPolarAngle` | 0.12π / 0.42π | 0.12π / 0.46π | 0.15π / 0.49π |
| `dollyToCursor` | bật (zoom về phía con trỏ: cách zoom tự nhiên vào vật thể) | bật | bật |
| `smoothTime` / `draggingSmoothTime` | 0.35 / 0.12 | | |
| `setBoundary` | Box3 của khuôn viên + 10 m | Box3 của tầng + 6 m | Box3 của zone |

- Chuột: kéo trái để xoay, kéo phải hoặc Shift+kéo để di chuyển ngang, cuộn để zoom. Cảm ứng: 1 ngón xoay, 2 ngón zoom và di chuyển.
- Bàn phím (chỉ khi canvas hoặc container có focus): mũi tên để xoay, Shift+mũi tên để di chuyển ngang, `+`/`-` để zoom, `1`…`5` để chọn tầng, `F` để nhìn vừa đối tượng đang chọn, `Esc` để lùi một cấp breadcrumb, `R` để về toàn cảnh, `/` để mở tìm kiếm.
- Click chọn zone hoặc vật thể thì bay tới góc `hero` của nó. Double-click vật thể thì `fitToBox(worldBox, true, padding 0.6 m)` theo góc 3/4 mặt trước.
- Mọi `onChange` của controls gọi `invalidate()`. Không gọi `setState` của React trong vòng frame.

### 7.2 Các chế độ xem

1. **Toàn cảnh**: FOV 30, góc ngẩng 45°, phương vị 225° (nhìn từ tây nam về đông bắc), thấy cả toà nhà và sân tennis, mái sân thượng trong suốt nhẹ.
2. **Tách tầng** (như Pascal "exploded"): các tầng giãn cách thêm 6 m theo y, animate 600 ms, nhãn tầng nổi bên cạnh, click vào tầng nào thì vào tầng đó.
3. **Tầng / khu** ("solo"): ẩn các tầng phía trên (trượt lên +8 m và mờ dần trong 300 ms rồi `visible=false`), tầng dưới hiển thị mờ màu (material phụ giảm saturation), tường ở chế độ cutaway.
4. **Cận cảnh vật thể**: tường hạ thấp, các vật thể khác trong zone giảm độ sáng 30% qua `instanceColor`.
5. **Đi bộ ngang tầm mắt** (P2, EXP-10): cao 1.65 m, FOV 55, WASD/joystick cảm ứng, va chạm bằng lưới 2D tạo từ tường (không dùng engine vật lý), đổi tầng qua hotspot thang máy.

### 7.3 Cutaway tường (kiểu Sims: tường lên / cắt / hạ)

- **Lên**: đủ chiều cao (dùng ở toàn cảnh).
- **Cắt**: bucket `exterior-*` có pháp tuyến hướng về camera (`dot(normal, camDirXZ) > 0.25`) và toàn bộ tường `interior` hạ xuống 1.1 m bằng `mesh.scale.y` (mỗi bucket có pivot ở chân tường), animate 250 ms.
- **Hạ**: mọi tường 1.1 m (dùng ở cận cảnh vật thể).
- Chỉ tính lại khi phương vị camera vượt ngưỡng 10° (tối đa 8 mesh mỗi tầng), không chạy mỗi frame. Nhờ vậy camera không bao giờ bị tường che, và không cần va chạm camera.

### 7.4 Thuật toán góc nhìn

1. Ưu tiên `viewpoints` chọn tay trong scene. Mỗi zone chức năng có ít nhất `hero`; zone lớn thêm `detail` và `eye` (ngang tầm mắt 1.65 m). Các góc này hiện thành dải thumbnail "Góc đẹp" trên panel (thumbnail là chip chữ, không render ảnh).
2. Góc dự phòng `computeBestViewpoint(box, opts)` (hàm thuần, có test):
   - `radius = box.getBoundingSphere().radius`, `distance = radius / sin(fov/2) × 1.15`, kẹp trong `[minDistance, maxDistance]` của chế độ.
   - Góc ngẩng: zone 38°, vật thể 22°, sân 55°.
   - Phương vị: `preferredAzimuthDeg` nếu có; với vật thể dùng `rotationYDeg + 30°` để thấy mặt trước 3/4; còn lại dùng 225°.
   - Bảo đảm camera không thấp hơn sàn tầng + 0.4 m.
3. Chuyển tầng: đổi chế độ hiển thị tầng trước, sau đó mới bay camera. Nếu quãng bay > 40 m thì đi 2 chặng (lên độ cao toàn cảnh rồi hạ xuống) để không bay xuyên sàn.
4. **Tham quan có hướng dẫn** (EXP-10): khoảng 90 giây qua sảnh → gym tiêu chuẩn → boxing → cầu lông → gym VIP → khu HLV → Zen Garden → hồ bơi → tennis. Mỗi điểm dừng 6 giây, có caption song ngữ. Nút tạm dừng và bỏ qua; dừng ngay khi người dùng chạm vào canvas. Reduced motion thì chuyển bước bằng nút, không tự chạy.

## 8. Ngân sách hiệu năng (≥ 60 FPS)

### 8.1 Máy tham chiếu và mục tiêu

| Thiết bị | Độ phân giải / DPR | Mục tiêu |
|---|---|---|
| Laptop GPU tích hợp (Apple M1 hoặc Intel Iris Xe), Chrome và Safari mới nhất | 1920×1080, DPR tối đa 1.5 | **≥ 60 FPS trung bình, p95 frame time ≤ 16.7 ms, p99 ≤ 25 ms** khi chạy benchmark |
| Desktop GPU rời | 2560×1440, DPR 2 | ≥ 60 FPS ở tier cao |
| Điện thoại tầm trung (Snapdragon 7-series hoặc iPhone 12 trở lên) | DPR tối đa 1.5 | ≥ 60 FPS ở tier trung/thấp do tự hạ cấp; nếu < 40 FPS trong 5 giây ở tier thấp nhất thì gợi ý chuyển sang 2D |

Số đo từ Chrome headless (SwiftShader) **không tính**; chỉ ghi số đo trên máy thật.

### 8.2 Ngân sách mỗi frame

| Chỉ số (`gl.info.render`) | Toàn cảnh | Tầng/khu | Vật thể |
|---|---|---|---|
| Draw call | ≤ 150 | ≤ 110 | ≤ 90 |
| Tam giác hiển thị | ≤ 350k | ≤ 250k | ≤ 200k |
| Material khác nhau | ≤ 14 | | |
| Texture GPU | ≤ 24 MB (chỉ canvas texture sinh tại chỗ và glyph atlas) | | |
| JS chunk 3D (gzip) | ≤ 400 KB tổng | | |
| Long task sau first paint | không có task > 100 ms; dựng scene chia nhỏ qua `requestIdleCallback`/`scheduler.yield` | | |

### 8.3 Kỹ thuật bắt buộc

1. `frameloop="demand"`: khi không tương tác và không có animation thì không render. Animation liên tục duy nhất được phép là nước hồ bơi khi B1 đang hiển thị.
2. Instancing cho mọi vật thể lặp lại; merge kiến trúc theo bucket.
3. Shadow map tĩnh (5.4); không có light động.
4. `PerformanceMonitor` (drei) điều khiển 3 tier, kết hợp `AdaptiveDpr`:
   - **Cao**: DPR ≤ 2, MSAA, shadow 2048, LOD gần ở 25 m.
   - **Trung**: DPR ≤ 1.5, MSAA, shadow 1024, LOD 18 m.
   - **Thấp**: DPR 1, không MSAA, không shadow, LOD 10 m, ẩn cây trang trí.
   Lựa chọn tier thủ công trong menu được lưu ở `localStorage` (try/catch).
5. Picking: `<Bvh firstHitOnly>` chỉ bọc nhóm interactive; mesh kiến trúc đặt `raycast = () => null`. Hover chỉ đổi `instanceColor` rồi `invalidate()`. Không dùng `Outline` postprocessing.
6. Nhãn: troika `<Text>` chỉ cho zone của tầng đang xem (≤ 12 nhãn), font Plus Jakarta Sans tự host tại `public/fonts/` (OFL, kèm license). Chi tiết khi hover hoặc chọn dùng **một** drei `<Html>` duy nhất. Không gắn `<Html>` cho từng vật thể.
7. Không `new Vector3()` hay `new Matrix4()` trong `useFrame`; dùng biến tạm cấp module.
8. Store zustand: component R3F đọc qua `useStore.getState()` hoặc subscribe transient. DOM panel subscribe bằng selector hẹp.
9. Xử lý `webglcontextlost`/`restored`: hiện trạng thái lỗi kèm nút "Tải lại cảnh"; mất ngữ cảnh 2 lần thì chuyển sang 2D.
10. Dispose geometry và material khi unmount route (kiểm bằng `gl.info.memory` về 0 sau khi rời trang).

## 9. Kiểm thử

### 9.1 Unit (Vitest, happy-dom): `features/explore3d/__tests__/`

- `scene.schema.test.ts`: Zod parse; id duy nhất; chuỗi `parentId` hợp lệ; zone nằm trong footprint tầng; zone cùng tầng không chồng nhau (trừ `spansLevels`); vật thể nằm trong rect của zone cha, cách tường ≥ 0.4 m; footprint các vật thể không chồng nhau, chừa ≥ 0.6 m lối đi; mọi `name` có `vi` và `en` khác rỗng; mọi zone `functional` có viewpoint `hero`; viewpoint nằm trong boundary.
- `scene.bindings.test.ts`: `equipmentCode`, `roomName`, `courtNames` khớp **danh sách hằng chép từ `CatalogSeeder.java` và `CourtSeeder.java`** (comment trong test ghi rõ nguồn, đổi seed thì sửa test); `resolveBindings` xử lý đúng quantity ít hơn hoặc nhiều hơn slot, trạng thái maintenance/broken/retired, phòng `closed`, API lỗi và dữ liệu rỗng.
- `feature.coverage.test.ts`: lấy mọi `to` trong `PORTAL_NAV` có role MEMBER (bỏ `/member/explore`) và kiểm tra mỗi route xuất hiện trong ít nhất một hotspot.
- `camera.math.test.ts`: `computeBestViewpoint` cho camera nằm ngoài box, trong boundary, đúng khoảng góc ngẩng, không thấp hơn sàn.
- `architecture.test.ts`: `buildLevelGeometry` trả đúng số bucket; ô cửa tạo ra đúng số đoạn tường; tổng tam giác mỗi tầng ≤ ngân sách.
- UI (mock `@react-three/fiber` `Canvas` thành `div`): `LevelSwitcher` điều hướng được bằng bàn phím; `DetailPanel` có trạng thái loading, empty, error; parse deep link; `WebGLGate` render `FloorPlan2D` khi `getContext('webgl2')` trả `null`; CTA điều hướng đúng route; chuỗi hiển thị đúng khi đổi ngôn ngữ.

### 9.2 Kiểm tra repo

```bash
npm --prefix apps/web run lint
```

```bash
npm --prefix apps/web test
```

```bash
npm --prefix apps/web run build
```

Từ output build, ghi lại kích thước gzip của entry chunk (trước và sau) và chunk `three-vendor` trong mô tả PR.

### 9.3 Hiệu năng

- `?perf=1`: overlay DOM cập nhật 2 lần/giây hiển thị FPS, frame time p50/p95/p99 (cửa sổ 120 frame), draw call, số tam giác, geometry, texture và tier.
- `?bench=1`: chạy tự động qua mọi viewpoint `hero` với chuyển cảnh 1.2 s cố định, ép `frameloop="always"` trong lúc chạy, cuối cùng in JSON `{ device, ua, tier, dpr, avgFps, p95, p99, maxDrawCalls, maxTris }` và có nút sao chép.
- Kết quả trên ít nhất 2 thiết bị thật (1 laptop, 1 điện thoại) ghi vào `docs/qa/explore3d-perf.md`. Không đạt mục tiêu 8.1 thì Epic chưa xong.
- Script Playwright tuỳ chọn `scripts/verify-explore3d.mjs`: chạy Chrome có GPU (`--use-angle=metal` trên macOS), mở `?bench=1`, kiểm tra không có lỗi console và có JSON kết quả. Script này là smoke test, không dùng làm bằng chứng FPS.

### 9.4 Thủ công (dùng preview trình duyệt có sẵn)

Chụp màn hình toàn cảnh, tách tầng, từng tầng, cận cảnh một máy chạy bộ, sân tennis, mobile 375×812, theme sáng và tối, `prefers-reduced-motion`, tiếng Anh, bản 2D. Ảnh lưu ở `docs/qa/explore3d/`.

## 10. UI DOM quanh canvas (charcoal–salmon)

```
┌──────────────────────────────────────────────────────────────┐
│ Toàn cảnh › Tầng 1 › Phòng Gym Tiêu chuẩn › Máy chạy bộ  [⌕] │ ← breadcrumb + tìm kiếm
│ ┌────┐                                        ┌────────────┐ │
│ │ RF │                                        │ Panel chi  │ │
│ │ L2 │            CANVAS 3D                   │ tiết: tên, │ │
│ │ L1●│                                        │ trạng thái,│ │
│ │ B1 │                                        │ dữ liệu    │ │
│ │OUT │                                        │ thật, CTA, │ │
│ └────┘                                        │ góc đẹp    │ │
│ [Toàn cảnh][Tách tầng][Tham quan ▶][2D][⚙][⛶]  └────────────┘ │
│                                      Mô phỏng minh hoạ        │
└──────────────────────────────────────────────────────────────┘
```

- Canvas chiếm toàn bộ vùng nội dung portal (`100dvh` trừ topbar); vẫn giữ shell portal và sidebar icon.
- Panel và nút dùng token `--portal-*` và `--color-*` hiện có, kiểu glass charcoal, nút pill salmon chữ charcoal, mục tiêu chạm ≥ 44 px, có focus ring.
- Mobile (< 760 px): bộ chọn tầng nằm ngang ở trên; panel chi tiết thành bottom sheet kéo lên (native, không khoá cuộn trang); toolbar thu thành icon.
- Panel có đủ trạng thái loading (skeleton `LoadingSkeleton`), empty ("Không có dữ liệu trực tiếp") và error (nút thử lại). Kết quả thao tác dùng `notify()`.
- Tìm kiếm: `/` hoặc nút ⌕ mở danh sách lọc (dùng ARIA combobox) theo `name` và `searchTerms` của ngôn ngữ hiện tại; Enter để bay tới.
- Trợ năng: canvas có `aria-hidden` kèm mô tả bằng chữ. Danh sách zone và vật thể trong panel ("Tất cả khu") là con đường tương đương cho người dùng screen reader. Focus vào mục trong danh sách thì camera bay theo.
- Chuỗi giao diện dùng `t('…', '…')` (cặp vi/en tường minh); tên trong scene dùng `I18nText`. Không có thông báo backend mới nên không cần sửa `messages_*.properties`.

## 11. Danh sách ticket cho agent

Mỗi ticket là một PR riêng. Cột "File sở hữu" giúp các agent chạy song song mà không đụng nhau.

| ID | Tên | Phụ thuộc | File sở hữu | Ưu tiên |
|---|---|---|---|---|
| EXP-01 | Setup: dependency, chunk, route, nav, icon, `WebGLGate`, khung `ExplorePage`, overlay `?perf=1` | — | `package.json`, `vite.config.ts`, `router.tsx`, `portalNavigation.ts`, `PortalIcon.tsx`, `explore3d/ExplorePage.tsx`, `explore3d/canvas/ExploreCanvas.tsx`, `explore3d/perf/*` | P0 |
| EXP-02 | Schema + scene SÖL đầy đủ (mục 3, 4) + selectors + test schema/coverage | 01 | `explore3d/scene/*`, `__tests__/scene.*`, `feature.coverage.test.ts` | P0 |
| EXP-03 | Kiến trúc: `buildLevelGeometry`, sàn, kính, `LevelStack`, chế độ stacked/exploded/solo, cutaway | 02 | `explore3d/renderers/architecture/*`, `canvas/LevelStack.tsx`, `canvas/Cutaway.tsx` | P0 |
| EXP-04 | Camera: `CameraRig`, chuyển cảnh, boundary theo chế độ, phím tắt, `computeBestViewpoint` | 02 | `explore3d/canvas/CameraRig.tsx`, `explore3d/camera/*` | P0 |
| EXP-05 | Thư viện vật thể + `ItemInstances` + LOD + sân/hồ bơi | 02 | `explore3d/renderers/items/*`, `canvas/ItemInstances.tsx`, `canvas/Courts.tsx`, `canvas/Pool.tsx` | P0 |
| EXP-06 | Dữ liệu trực tiếp: hook, `resolveBindings`, xác minh quyền MEMBER cho từng endpoint | 02 | `explore3d/data/*`, `__tests__/scene.bindings.test.ts` | P0 |
| EXP-07 | Tương tác: picking BVH, hover, chọn, double-click fit, highlight, hotspot sprite | 03, 04, 05 | `canvas/Picking.tsx`, `canvas/Hotspots.tsx`, `canvas/SelectionHighlight.tsx`, `state/exploreStore.ts` | P0 |
| EXP-08 | UI DOM: breadcrumb, bộ chọn tầng, panel chi tiết + CTA, toolbar, tìm kiếm, mobile sheet, CSS | 02, 06 (07 để ghép nối) | `explore3d/components/*`, `explore3d/explore3d.css` | P0 |
| EXP-09 | Deep link, lưu và khôi phục camera, link "Xem trong 3D" từ trang sân/lớp, sự kiện mở chat | 07, 08 | `explore3d/state/deepLink.ts`, sửa nhỏ `CourtBookingFeature.tsx`, `ChatWidget.tsx` | P1 |
| EXP-10 | Tham quan có hướng dẫn + chế độ đi bộ ngang tầm mắt | 04, 07 | `explore3d/tour/*`, `explore3d/walk/*` | P1 (đi bộ: P2) |
| EXP-11 | Hoàn thiện hình ảnh: ánh sáng, shadow tĩnh, Environment cục bộ, nước, theme sáng/tối, nhãn troika + font | 03, 05 | `canvas/Lights.tsx`, `canvas/Environment.tsx`, `renderers/materials.ts`, `public/fonts/*` | P1 |
| EXP-12 | Bản 2D `FloorPlan2D` (SVG sinh từ cùng scene) + trợ năng + reduced motion | 02, 08 | `explore3d/fallback/*` | P1 |
| EXP-13 | Tối ưu hiệu năng: tier, `?bench=1`, đo trên máy thật, sửa đến khi đạt mục 8 | tất cả | `explore3d/perf/*`, `docs/qa/explore3d-perf.md` | P0 (cổng phát hành) |
| EXP-14 | Tài liệu: thêm mục "Tham quan 3D" vào `DESIGN.md`, cập nhật `docs/plans/README.md`, ảnh QA | 13 | `DESIGN.md`, `docs/qa/explore3d/*` | P1 |

### Các đợt chạy song song

1. **Đợt 0** (một agent, tuần tự): EXP-01 rồi EXP-02. Schema phải chốt trước.
2. **Đợt 1** (4 agent song song): EXP-03, EXP-04, EXP-05, EXP-06.
3. **Đợt 2**: EXP-07 và EXP-08 song song (thống nhất interface của `exploreStore` ngay đầu đợt: `selectedId`, `hoveredId`, `levelMode`, `focusLevel`, `wallMode`, `tier`), sau đó EXP-09.
4. **Đợt 3** (song song): EXP-10, EXP-11, EXP-12.
5. **Đợt 4**: EXP-13 rồi EXP-14.

### Acceptance chung của mọi ticket

- Có trạng thái loading, empty, error cho UI mới; chuỗi song ngữ; không dùng `<select>` hay date input native (dùng `shared/ui/Select`).
- Không render React mỗi frame; không cấp phát object trong `useFrame`.
- Lint, test và build đều pass; PR ghi Jira key và ảnh hoặc số đo liên quan.
- Không sửa backend, DB hay seed trong Epic này. Phát hiện cần sửa thì dừng lại hỏi.

## 12. Rủi ro và cách giảm

| Rủi ro | Giảm thiểu |
|---|---|
| Không đạt 60 FPS trên điện thoại | `demand` loop, 3 tier tự hạ, LOD, bản 2D; EXP-13 là cổng chặn phát hành |
| Bundle nặng làm chậm portal | Lazy route + chunk riêng + không precache; kiểm tra kích thước entry trong PR |
| Dữ liệu seed đổi tên làm lệch binding | Test bindings đọc danh sách hằng có ghi nguồn; zone không ghép được thì hiện "Không có dữ liệu trực tiếp", không crash |
| Scene trông "đồ chơi" | Bảng màu charcoal–salmon, shadow tĩnh, AgX, góc chọn tay; P2 có thể thay vài vật thể bằng `.glb` CC0 đã nén meshopt (≤ 2 MB tổng, ghi license) |
| Nhầm là ảnh hoặc số liệu thật | Nhãn "Mô phỏng minh hoạ"; chỉ hiện số từ API |
| Xung đột khi chạy nhiều agent | Bảng "File sở hữu"; interface store chốt ở đầu đợt 2 |

## 13. Follow-up (không làm trong Epic này)

- Bản xem trước công khai trên landing (`/` hoặc `/tour`), chỉ dùng dữ liệu tĩnh và public catalog.
- Chế độ Manager: tô màu theo tình trạng bảo trì thiết bị trên `/manager/equipment`.
- Trường `code` cho `Room` để ghép ổn định hơn ghép theo tên (cần OpenAPI + entity, phải hỏi trước).
