# Asset 3D cho trang Explore (`/member/explore`)

Mặc định mọi thiết bị trong cảnh 3D được dựng bằng code (`renderers/items/itemGeometries.ts`). Có thể thay từng loại thiết bị bằng model `.glb`; loại nào chưa có file, file lỗi hoặc quá nặng sẽ tự dùng lại model dựng bằng code.

## Thêm một model

1. Chọn model có license cho phép dùng trong dự án (ưu tiên CC0). Gợi ý nguồn: Quaternius, Poly Haven, Kenney, Sketchfab (lọc license CC).
2. Tối ưu trước khi đưa vào repo (không dùng Draco vì loader không tải decoder từ CDN):

   ```bash
   npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress false
   ```

3. Đặt file vào `apps/web/public/models/explore3d/<ten-thiet-bi>.glb`.
4. Khai báo trong `renderers/items/glbManifest.ts`:

   ```ts
   treadmill: {
     url: '/models/explore3d/treadmill.glb',
     author: 'Tên tác giả',
     source: 'https://link-goc',
     license: 'CC0',
     rotationY: Math.PI, // chỉ khi model quay ngược so với bản dựng bằng code
   },
   ```

5. Ghi một dòng vào bảng license bên dưới trong cùng PR.

## Cách model được dùng

- Tất cả mesh trong file được gộp thành một geometry, thu phóng đều (không méo) vào kích thước `DEFAULT_ITEM_DIMENSIONS[kind]`, đáy chạm y = 0, căn giữa theo X/Z. Hướng "mặt trước" là +Z.
- Màu lấy từ thuộc tính `COLOR_0` hoặc màu cơ bản của material. **Texture không được mang theo**, nên dùng model màu phẳng hoặc vertex color (phong cách low-poly).
- Vì vẫn đi qua instancing, màu trạng thái (hoạt động, bảo trì, hỏng), hover, chọn và picking hoạt động như cũ.
- `materialColors` trong manifest đổi màu theo tên material (ví dụ `carpet`, `wood`, `metal` của Kenney) để model khớp bảng màu charcoal–salmon.
- Giới hạn `GLB_ITEM_TRIANGLE_BUDGET` = 8000 tam giác mỗi model; vượt ngưỡng sẽ bị bỏ qua kèm cảnh báo trong console.
- Tier chất lượng `low` không tải GLB.

## Bảng license

| Thiết bị (`ItemKind`) | File | Tác giả | Nguồn | License |
| --- | --- | --- | --- | --- |
| `lounge-sofa` | `lounge-sofa.glb` | Kenney | [Furniture Kit](https://kenney.nl/assets/furniture-kit) (`loungeSofaLong`) | CC0 |
| `juice-bar` | `juice-bar.glb` | Kenney | [Furniture Kit](https://kenney.nl/assets/furniture-kit) (`kitchenBar`) | CC0 |
| `planter-tree` | `planter-tree.glb` | Kenney | [Furniture Kit](https://kenney.nl/assets/furniture-kit) (`pottedPlant`) | CC0 |

Bản license gốc của gói Kenney nằm ở `apps/web/public/models/explore3d/LICENSE-kenney-furniture-kit.txt`.

## Nhân vật có skeleton

40 trong khoảng 50 người trong cảnh dùng nhân vật rig từ [Kenney Mini Characters](https://kenney.nl/assets/mini-characters) (CC0); các hoạt động còn lại vẫn dùng người dựng bằng code.

| Hoạt động | Clip | Ghi chú |
| --- | --- | --- |
| `treadmill-run` | `walk` x1.7 | `sprint` của Kenney nghiêng người quá mạnh |
| `walking-patrol` | `walk` | đi theo đúng đường đi của bộ giải tư thế |
| `elliptical-stride` | `walk` x0.8 | |
| `upright-bike` | `drive` + chân đạp | nâng lên ngang yên xe (`offset`) |
| `boxing-spar`, `heavy-bag-boxer` | `attack-melee-right` hoặc `-left` | chọn theo actor |
| `yoga-flow` | `idle` + tay giơ qua đầu | |
| `inbody-scan`, `receptionist-greet`, `lounge-chat` | `idle`, `interact-right`, `emote-yes` | |
| `badminton-player`, `tennis-player` | `attack-melee-right` chậm | vợt gắn vào xương `arm-right`, vung theo clip |
| `pt-coach-tablet` | `holding-both` | tablet gắn vào xương `arm-right` |

Chưa chuyển sang rig (vẫn là người dựng bằng code): `barbell-squat`, `bench-press`, `dumbbell-curl` (cần gập gối và khuỷu, mà bộ xương Kenney chỉ có một khớp cho mỗi tay và chân) và `swim-freestyle` (tư thế nằm sấp, không có clip phù hợp).

Dụng cụ cầm tay: khai báo `handProp` trong `RIGGED_ACTIVITY_CLIPS` (vợt, tablet; dựng ở `renderers/actors/riggedHandProps.ts`, dùng chung geometry và vật liệu). Dụng cụ được gắn vào xương nên đi theo clip. Cánh tay Kenney chạy dọc trục -X của xương `arm-right`, đầu tay ở khoảng x = -0,25 (đo từ skin weight) và cánh tay rất dày nên dụng cụ lớn phải đặt ra ngoài đầu tay. Phần procedural cùng tên (`racketShaft`, `racketHead`, `coachTablet`) bị ẩn khi nhân vật rig đã nạp xong.

- Cấu hình ở `renderers/actors/riggedActors.ts` (`RIGGED_ACTIVITY_CLIPS`: clip, tốc độ, `offset`, `tweakBones`), render ở `canvas/RiggedActors.tsx`.
- Vị trí, hướng đi, lắc lư lấy từ `solveHumanPose` (`liveActorsConfig.ts`), dùng chung với người dựng bằng code. Nhân vật Kenney quay mặt về +Z khi yaw = 0, cùng quy ước.
- Thêm hoạt động mới vào rig: khai báo clip trong `RIGGED_ACTIVITY_CLIPS`, chạy `actors.rigged.test.ts` (kiểm tra clip và xương có thật trong từng GLB, và không còn bộ phận procedural nào bị bỏ sót lơ lửng).
- File: `apps/web/public/models/explore3d/characters/` gồm 4 nhân vật (`character-male-a`, `character-female-a`, `character-male-c`, `character-female-c`), texture dùng chung `Textures/colormap.png` (GLB tham chiếu theo đường dẫn tương đối nên phải giữ nguyên thư mục) và license gốc.
- Mỗi nhân vật khoảng 800–900 tam giác, 14 khớp, hai `SkinnedMesh` (thân, đầu), không instancing. Với 30 người (trước khi thêm nhóm cầm vợt/tablet): khoảng 105.000 tam giác trong cảnh, 174 draw call, chi phí CPU khoảng 1,2 ms mỗi khung cho đặt vị trí và mixer; chưa đo lại với 40 người.
- Nhân vật chỉ thay phần thân người dựng bằng code sau khi nạp xong; nạp lỗi, tier `low` hoặc `prefers-reduced-motion` thì giữ người cũ (reduced motion dùng một tư thế đứng yên).
- Quaternius Universal Base Characters (~13.000 tam giác mỗi người) đã được cân nhắc nhưng quá nặng cho ~55 người trong cảnh.

| Nhân vật | File | Tác giả | Nguồn | License |
| --- | --- | --- | --- | --- |
| `character-male-a`, `character-female-a`, `character-male-c`, `character-female-c` | `characters/*.glb` | Kenney | [Mini Characters](https://kenney.nl/assets/mini-characters) | CC0 |
