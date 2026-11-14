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
| Chụp chuyển động (`HUMAN_CLIP_ACTIVITIES`) | `treadmill-run` (`Jog_Fwd_Loop`), `walking-patrol`, `elliptical-stride` (`Walk_Loop`), `inbody-scan` (`Idle_Loop`), `lounge-chat` (`Idle_Talking_Loop`), `boxing-spar`, `heavy-bag-boxer` (`Punch_Jab`/`Punch_Cross`), `swim-freestyle` (`Swim_Fwd_Loop`) | clip trong `human-animations.glb` |
| Theo góc tư thế (`HUMAN_POSE_ACTIVITIES`) | `upright-bike`, `receptionist-greet`, `yoga-flow`, `barbell-squat`, `bench-press`, `dumbbell-curl`, `badminton-player`, `tennis-player`, `pt-coach-tablet` | `solveHumanPose` qua `renderers/actors/humanRetarget.ts` |

### Chuyển động theo góc tư thế

`solveHumanPose` (`liveActorsConfig.ts`) cho góc vai, khuỷu, hông, gối của từng hoạt động theo thời gian. `applyRetargetPose` đặt mỗi đoạn chi của bộ xương theo đúng hướng đó (xoay ngắn nhất từ tư thế T-pose), nên người dựng bằng code và người thật cùng nhịp, cùng đường đi; thêm xoay hông ngược vai khi bước, gót–mũi bàn chân, thở và đổi trọng tâm theo thời gian. Bên "trái" của người dựng bằng code (x < 0) là bên `_r` của bộ xương. Với tư thế đứng (`groundLock`) hông tự hạ xuống để chân thấp hơn luôn chạm sàn; người đạp xe dùng `hipsHeight` cố định. Xương gốc (`root`) của bộ xương xoay 90° kiểu Blender, nên vị trí hông được tính trong hệ tọa độ của nhân vật rồi mới đổi sang hệ của xương cha. Tư thế nằm (đẩy ngực) không biểu diễn được bằng góc pitch/splay nên dùng `PoseOverride` ở `renderers/actors/humanPoses.ts`: xoay hông nằm ngửa, hướng từng đoạn tay chân ghi trực tiếp. Thêm hoạt động mới: khai báo trong một trong hai bảng, chạy `actors.human.test.ts` (kiểm tra chân chạm sàn, hướng chi, clip có thật, không có số NaN).

### Vẻ ngoài

`renderers/actors/humanAppearance.ts` làm mỗi người khác nhau: giới tính và kiểu tóc theo mã actor, da sáng hoặc tối theo bảng màu (`palette` trong `liveActorsConfig.ts`), chiều cao lệch ±5%, ngón tay hơi cong (`relaxHands`, nắm chặt hơn khi cầm vợt hoặc đeo găng). Tóc là mesh tĩnh gắn vào xương `Head`; thợ bơi đội mũ bơi một màu. Gói Base Characters chỉ có thân mặc nội y, nên quần áo thể thao là một lớp vải bọc theo thân, dùng chung xương với thân (tự dựng vì không tìm được bộ quần áo hiện đại CC0 tương thích; gói [Modular Character Outfits - Fantasy](https://quaternius.itch.io/modular-character-outfits-fantasy) chỉ có đồ trung cổ). Lớp vải được vẽ chi tiết hết mức: áo thun suông xòe dần về gấu hoặc áo ba lỗ hoặc crop top (nữ); quần short xòe có cạp, viền gấu và sọc hông hoặc legging ôm (nữ); viền cổ và viền tay áo, sọc ngang ngực; tất cổ ngắn có viền màu, giày thể thao có đế riêng; băng cổ tay, băng đô; vải có độ đậm nhạt nhẹ từng tam giác và phần mặt dưới tối hơn như nếp gấp, thêm hoa văn dệt kim và nếp vải vẽ trong shader theo vị trí trên thân (nên biến dạng cùng cơ thể, không cần UV). Mỗi người một kiểu theo mã actor (`outfitFor` ở `canvas/riggedInstance.ts`), màu lấy từ bảng màu (`top`, `bottom`, `shoe`, viền theo `accent`). Các tam giác của thân nằm sát ranh giới giữa các loại vải được chia nhỏ (tối đa 2 lần) để viền và gấu sắc nét; đường cắt theo độ cao và độ rộng của thân trong tư thế T-pose (`clothAt`). Thay bằng quần áo thật: thay `dressHuman`.

- Chi phí (đo trên Apple M4, 53 người cùng lúc): dựng xong trong khoảng 0,7 giây; vẽ cả 53 người kèm bóng đổ mất trung bình 4,4 ms mỗi khung (chậm nhất 5,7 ms, đã gồm chuyển động CPU và chờ GPU), 705 lệnh vẽ, khoảng 3 triệu tam giác tính cả lượt vẽ bóng (mỗi người khoảng 7.300 thân, 10.000–15.000 áo quần, vài nghìn tóc, mắt và lông mày; hình học áo quần dùng chung giữa người cùng kiểu đồ). Số này chỉ là nhân vật, chưa gồm cả cảnh; máy yếu chưa đo. Mọi tier đều vẽ nhân vật thật.
- Muốn thay tư thế theo góc bằng chuyển động chụp (vợt, cuốn tạ, squat…), cần clip tương ứng (thư viện bản Standard không có) rồi chuyển hoạt động sang `HUMAN_CLIP_ACTIVITIES`.

## Thành phố bao quanh (procedural, không có asset ngoài)

`renderers/architecture/buildCityMetropolis.ts` dựng toàn bộ thành phố quanh khu gym (lưới đường, tuyến metro trên cao, công viên phía nam, khoảng 100 tòa nhà đến bán kính ~460 m) thành 4 geometry gộp (opaque, metal, glass, emissive) cache theo `(theme, tier)`, khoảng 64k tam giác và 4 lệnh vẽ ở tier high. `canvas/CityMetropolis.tsx` render chúng cùng cờ SÖL có gió; `canvas/CityTraffic.tsx` là xe chạy bằng một `InstancedMesh`. Không thêm file model hay license mới.
