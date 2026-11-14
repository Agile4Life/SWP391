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

## Nhân vật (người thật, Quaternius)

Mọi người trong cảnh (53 người) là người thật từ hai gói CC0 của Quaternius: [Universal Base Characters](https://quaternius.itch.io/universal-base-characters) (thân người nam và nữ có mặt, mắt, lông mày; kèm kiểu tóc) và [Universal Animation Library](https://quaternius.itch.io/universal-animation-library) (chuyển động chụp sẵn, cùng một bộ xương). Không còn nhân vật hoạt hình: Kenney Mini Characters và nhân vật Mixamo Beta (hình nộm) đã bị gỡ. Người dựng bằng khối trong `liveActorsConfig.ts` chỉ còn là phương án dự phòng khi GLB nạp lỗi; vật thể (`heavy-bag-sway`, `badminton-shuttlecock`, `tennis-ball`, `fountain-plume`) vẫn dựng bằng code vì không có dáng người.

File ở `apps/web/public/models/explore3d/humans/` (khoảng 7,6 MB), tạo bằng `scripts/build-human-assets.py` từ hai file zip bản Standard (miễn phí) đã giải nén:

```bash
python3 scripts/build-human-assets.py "<Universal Base Characters[Standard]>" "<Universal Animation Library[Standard]>"
```

Script (cần `sips` của macOS) thu nhỏ texture (thân 1024 px, tóc 512 px), dùng normal map chuẩn OpenGL (bản Unity/Godot; bản Unreal bị ngược trục Y làm da trông như vảy), ghép `human-male.glb`, `human-female.glb`, sáu kiểu tóc `hair-*.glb`, hai texture da sáng, và `human-animations.glb` chỉ giữ 19 clip cần dùng. License CC0 nằm cạnh file (`LICENSE-quaternius-*.txt`).

Có hai cách điều khiển chuyển động, khai báo ở `renderers/actors/riggedActors.ts`:

| Cách | Hoạt động | Nguồn chuyển động |
| --- | --- | --- |
| Chụp chuyển động (`HUMAN_CLIP_ACTIVITIES`) | `treadmill-run` (`Jog_Fwd_Loop`), `walking-patrol` (`Walk_Loop`), `lounge-chat` (`Sitting_Talking_Loop` trên sofa / `Idle_Talking_Loop` ở quầy nước), `boxing-spar`, `heavy-bag-boxer` (combo `Punch_Jab` ↔ `Punch_Cross` crossfade + găng đấm bốc), `swim-freestyle` (`Swim_Fwd_Loop`) | clip trong `human-animations.glb` (qua `prepareCharacterClip` giữ nguyên chiều dài xương nam/nữ) |
| Theo góc tư thế (`HUMAN_POSE_ACTIVITIES`) | `upright-bike`, `elliptical-stride`, `inbody-scan`, `receptionist-greet`, `yoga-flow`, `barbell-squat`, `bench-press`, `dumbbell-curl`, `badminton-player`, `tennis-player`, `pt-coach-tablet` | `solveHumanPose` qua `renderers/actors/humanRetarget.ts` |

### Chuyển động theo góc tư thế & retargeting

- **Clip chụp chuyển động (`prepareCharacterClip` ở `canvas/riggedInstance.ts`)**: các clip trong `human-animations.glb` mang sẵn track `.position` và `.scale` của ma-nơ-canh gốc (khi đè lên nhân vật nữ làm vai giãn rộng thêm ~55%). `prepareCharacterClip` lược bỏ track `.scale` và mọi track `.position` của xương chi, chỉ giữ `.quaternion` cùng `pelvis.position` đã tỉ lệ theo chiều cao xương chậu thật của từng giới tính. Nhân vật đi tuần (`walking-patrol`) xoay mượt ở hai đầu đường đi và điều nhịp `timeScale` theo vận tốc mặt đất để bàn chân không trượt.
- **Tư thế theo góc (`solveHumanPose` + `applyRetargetPose`)**: toàn bộ phép xoay xương chạy trong hệ tọa độ cục bộ của `rig.root` (bất biến theo góc quay `holder.rotation.y`), kèm nhịp xương đòn (`clavicle_l`/`clavicle_r`) nâng tự nhiên khi vươn tay qua đầu. Đạp xe (`upright-bike`) giải IK 2 đoạn theo quỹ đạo tròn của bàn đạp và nắm ghi-đông; máy trượt (`elliptical-stride`) nắm thanh trượt đôi ngược pha chân; đo InBody (`inbody-scan`) đứng chân trần trên tấm điện cực và nắm tay cầm hai bên; gánh tạ (`barbell-squat`) đặt đòn tạ sau gáy trên cơ cầu vai; đẩy ngực (`bench-press` ở `renderers/actors/humanPoses.ts`) tựa lưng đúng góc ghế nghiêng 26° với hai bàn chân đặt phẳng xuống sàn; cuốn tạ đơn (`dumbbell-curl`) xoay ngửa cổ tay khi gập khuỷu; đánh cầu lông/quần vợt khớp đỉnh vung vợt đúng thời điểm cầu/bóng chạm vạch cuối sân. Đạo cụ cầm tay (`riggedHandProps.ts`: tạ đơn, vợt, máy tính bảng, găng boxing) gắn dọc trục nắm giải phẫu `+Z` của xương bàn tay.

### Vẻ ngoài & trang phục theo vai trò

`renderers/actors/humanAppearance.ts` hiệu chỉnh mốc giải phẫu riêng cho từng giới tính (`LANDMARKS.male` và `LANDMARKS.female`) để cổ áo, nách áo ba lỗ, cổ tay và băng đô ôm khít cơ thể thật, đồng thời phân trang phục theo hoạt động (`WearMode`):
- **`athletic` (hội viên tập gym/sân)**: áo thun, áo ba lỗ hoặc crop top; quần short thể thao (chống tự cắt mặt trong đùi) hoặc legging ôm; tất cổ ngắn và giày sneaker có mũi giày vòm liền khối, đế cao su tách màu; tùy chọn băng cổ tay và băng đô.
- **`swim` (bơi ở hồ B1)**: mũ bơi silicone, quần bơi jammer (nam) hoặc đồ bơi liền thân racerback (nữ), chân trần hoàn toàn (không mang giày/tất xuống nước).
- **`barefoot` (Yoga sân thượng RF & đo InBody L2)**: đồ tập gọn gàng, chân trần tiếp xúc thảm yoga và điện cực bàn chân.
- **`staff` (HLV PT, HLV hồ bơi, Lễ tân)**: áo polo có cổ/nẹp ngực và quần dài thể thao đồng bộ bảng màu `COACH_PALETTE`.
- **Chống xuyên da & độ nhám theo chất liệu**: các tam giác thân người nằm sâu bên trong lớp quần áo kín được loại khỏi index buffer (`occludedBodyGeometry`) nên khi gập gối/hông sâu không lộ da hoặc nội y gốc; vật liệu vải truyền thuộc tính `aRoughness` từng đỉnh để vải thun dệt kim, vải bơi lycra, da giày và đế cao su phản xạ ánh sáng khác nhau trong cùng một draw call; một phần nhân vật nam có thêm râu gọn (`hair-beard.glb`) gắn theo xương `Head`.

- Chi phí (đo trên Apple M4, 53 người cùng lúc): dựng xong trong khoảng 0,7 giây; vẽ cả 53 người kèm bóng đổ mất trung bình 4,4 ms mỗi khung (chậm nhất 5,7 ms, đã gồm chuyển động CPU và chờ GPU), 705 lệnh vẽ, khoảng 3 triệu tam giác tính cả lượt vẽ bóng (mỗi người khoảng 7.300 thân, 10.000–15.000 áo quần, vài nghìn tóc, mắt và lông mày; hình học áo quần dùng chung giữa người cùng kiểu đồ). Số này chỉ là nhân vật, chưa gồm cả cảnh; máy yếu chưa đo. Mọi tier đều vẽ nhân vật thật.
- Muốn thay tư thế theo góc bằng chuyển động chụp (vợt, cuốn tạ, squat…), cần clip tương ứng (thư viện bản Standard không có) rồi chuyển hoạt động sang `HUMAN_CLIP_ACTIVITIES`.

## Thành phố bao quanh (procedural, không có asset ngoài)

`renderers/architecture/buildCityMetropolis.ts` dựng toàn bộ thành phố quanh khu gym (lưới đường, tuyến metro trên cao, công viên phía nam, khoảng 100 tòa nhà đến bán kính ~460 m) thành 4 geometry gộp (opaque, metal, glass, emissive) cache theo `(theme, tier)`, khoảng 64k tam giác và 4 lệnh vẽ ở tier high. `canvas/CityMetropolis.tsx` render chúng cùng cờ SÖL có gió; `canvas/CityTraffic.tsx` là xe chạy (có đèn pha/đèn hậu) bằng `InstancedMesh`; `canvas/CityLife.tsx` thêm đèn giao thông đổi pha, băng-rôn đại lộ, đèn báo không lưu nhấp nháy và người đi bộ có chân bước; `canvas/CitySky.tsx` thêm hai đoàn tàu metro chạy trên cầu cạn , đàn chim bay ban ngày, mây trôi, vịt và ánh lấp lánh trên kênh. Camera được đẩy ra khỏi chân các tòa nhà (`getCityColliders`) để không bao giờ nằm trong tòa nhà. Không thêm file model hay license mới.
