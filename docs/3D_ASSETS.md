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
- **Model có texture (`textured: true` trong manifest)**: giữ UV và vật liệu PBR gốc của model scan (màu, normal, độ nhám), mỗi mesh thành một group của geometry; dùng cho prop chân thực (Poly Haven). Giới hạn `GLB_TEXTURED_TRIANGLE_BUDGET` = 16000 tam giác. Tối ưu bằng gltf-transform: `simplify`, texture WebP 512–1024.
- Giới hạn `GLB_ITEM_TRIANGLE_BUDGET` = 8000 tam giác mỗi model; vượt ngưỡng sẽ bị bỏ qua kèm cảnh báo trong console.
- Tier chất lượng `low` không tải GLB.

## Bảng license

| Thiết bị (`ItemKind`) | File | Tác giả | Nguồn | License |
| --- | --- | --- | --- | --- |
| `lounge-sofa` | `polyhaven/sofa_03.glb` (có texture) | Poly Haven | [Sofa 03](https://polyhaven.com/a/sofa_03) | CC0 |
| `planter-tree` | `polyhaven/potted_plant_02.glb` (có texture) | Poly Haven | [Potted Plant 02](https://polyhaven.com/a/potted_plant_02) | CC0 |

Các model nội thất Kenney đã được thay bằng model scan Poly Haven và bản dựng bằng code, nên file license của gói Kenney Furniture Kit không còn trong repo.

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

## Texture bề mặt PBR (Poly Haven, CC0)

Sàn, tường, mặt đường và mặt đất dùng bộ texture scan thật, chiếu triplanar theo toạ độ thế giới nên không cần UV (`renderers/surfaceTextures.ts`, `renderers/surfaceDetail.ts`). File ở `apps/web/public/textures/explore3d/<tên>_{diff,nor,arm}.webp` (1024 px, WebP). Màu vật liệu vẫn lấy từ bảng màu của dự án; texture chỉ thêm chi tiết, normal, AO và độ nhám. Khi chưa tải xong, hoặc ở tier `low`, vật liệu dùng chi tiết procedural.

| Bộ texture | Dùng cho | Nguồn | License |
|---|---|---|---|
| `asphalt_02` | đường, bãi xe, sân | [polyhaven.com/a/asphalt_02](https://polyhaven.com/a/asphalt_02) | CC0 |
| `smooth_concrete_floor` | sàn bê tông mài, lối đi | [polyhaven.com/a/smooth_concrete_floor](https://polyhaven.com/a/smooth_concrete_floor) | CC0 |
| `concrete_wall_008` | tường bê tông | [polyhaven.com/a/concrete_wall_008](https://polyhaven.com/a/concrete_wall_008) | CC0 |
| `grey_plaster` | sàn tầng, trần | [polyhaven.com/a/grey_plaster](https://polyhaven.com/a/grey_plaster) | CC0 |
| `laminate_floor_02` | sàn gỗ trong nhà | [polyhaven.com/a/laminate_floor_02](https://polyhaven.com/a/laminate_floor_02) | CC0 |
| `wood_floor_deck` | lam gỗ, sàn gỗ ngoài trời | [polyhaven.com/a/wood_floor_deck](https://polyhaven.com/a/wood_floor_deck) | CC0 |
| `rubber_tiles` | sàn cao su khu gym | [polyhaven.com/a/rubber_tiles](https://polyhaven.com/a/rubber_tiles) | CC0 |
| `rubberized_track` | mặt sân | [polyhaven.com/a/rubberized_track](https://polyhaven.com/a/rubberized_track) | CC0 |
| `leafy_grass` | cỏ, mặt đất xa | [polyhaven.com/a/leafy_grass](https://polyhaven.com/a/leafy_grass) | CC0 |
| `tatami_mat` | sàn tatami | [polyhaven.com/a/tatami_mat](https://polyhaven.com/a/tatami_mat) | CC0 |
| `floor_tiles_06` | gạch lát | [polyhaven.com/a/floor_tiles_06](https://polyhaven.com/a/floor_tiles_06) | CC0 |

## Nhân vật Mixamo (chân thực)

`apps/web/public/models/explore3d/characters/mixamo-beta.glb` là nhân vật Beta của Adobe Mixamo, gộp 4 động tác tải từ Mixamo (`hook`, `overhead-squat`, `push-up`, `bicycle-crunch`) vào một khung xương. Dùng theo điều khoản Mixamo (miễn phí bản quyền khi đưa vào dự án; không phân phối lại model như asset rời).

Cách tạo lại: tải mỗi động tác ở dạng FBX (With Skin, 30 fps), nạp bằng `FBXLoader`, xuất một GLB bằng `GLTFExporter` với tất cả clip (đặt tên clip theo động tác), rồi `gltf-transform`: `weld`, `resample`, bỏ UV, `simplify` meshopt tỉ lệ 0,45 (khoảng 22.000 tam giác). Gán động tác cho hoạt động ở `MIXAMO_ACTIVITY_CLIPS` (`renderers/actors/riggedActors.ts`). Hoạt động chưa có clip Mixamo vẫn dùng nhân vật Kenney.

Để thay nốt nhân vật Kenney, cần thêm các động tác Mixamo: Walking, Running (In Place), Treadmill/Jogging, Stationary Bike/Sitting, Idle, Talking, Tennis/Badminton swing, Yoga, Bench Press, Bicep Curl, Swimming. Chỉ cần tải "Without Skin" từ động tác thứ hai trở đi, vì cùng khung xương.
