# Báo cáo Hiệu năng & Kiểm chứng — Tham quan 3D SÖL (`/member/explore`)

- **Ngày đo**: 07/11/2026
- **Công cụ**: Playwright Chromium (`--use-gl=angle --use-angle=metal`) trên bản build production (`vite preview`)
- **Chế độ**: `/member/explore?bench=1&perf=1` (7 bước bay camera tự động qua 5 tầng `ALL -> Exploded -> L1 Gym -> L2 VIP Gym -> B1 Pool -> Fit InBody 770 -> Overview`)

## 1. Chỉ số WebGL2 & Frame Time (`window.__EXPLORE3D_BENCH__`)

| Chỉ số | Kết quả đo | Ngưỡng mục tiêu | Đạt |
| :--- | :---: | :---: | :---: |
| **p50 Frame Time** | `16.7 ms` | `<= 16.7 ms` | PASS |
| **p95 Frame Time** | `17.2 ms` | `<= 25.0 ms` | PASS |
| **FPS trung bình (khi chuyển động)** | `60 FPS` | `>= 45 FPS` | PASS |
| **Draw Calls tối đa (`gl.info.render.calls`)** | `116` | `<= 120` | PASS |
| **Triangles tối đa (`gl.info.render.triangles`)** | `72,432` | `<= 120,000` | PASS |
| **Bộ nhớ Geometries (`gl.info.memory.geometries`)** | `65` | `<= 80` | PASS |
| **Bộ nhớ Textures (`gl.info.memory.textures`)** | `8` | `<= 24` | PASS |
| **GPU khi đứng yên (`frameloop="demand"`)** | `0 FPS` (chỉ render khi `invalidate()`) | `0 FPS` | PASS |

## 2. Kích thước Bundle & Code Splitting (`vite build`)

| Chunk | Kích thước Minified | Kích thước Gzip | Ghi chú |
| :--- | :---: | :---: | :--- |
| `index-*.js` (Entry) | `74.27 kB` | `22.35 kB` (`+0.13 kB` so với baseline `22.22 kB`) | Đạt ngưỡng `<= +2.0 kB` |
| `AppLayout-*.js` (Portal Shell) | `29.95 kB` | `9.35 kB` (`+0.04 kB` so với baseline `9.31 kB`) | Không kéo Three.js vào shell |
| `ExplorePage-*.js` (Lazy Route) | `200.90 kB` | `58.87 kB` | Chỉ tải khi mở `/member/explore` |
| `three-vendor-*.js` (Lazy 3D Vendor) | `1,016.10 kB` | `269.94 kB` | Tách riêng, loại khỏi Service Worker `PRECACHE` |

## 3. Bộ ảnh Kiểm chứng UI (`docs/qa/explore3d/`)

1. `01-overview-dark-1440.png` — Toàn cảnh 3D trung tâm SÖL (Dark, 1440×900)
2. `02-overview-light-1440.png` — Toàn cảnh 3D trung tâm SÖL (Light `html[data-theme="light"]`, 1440×900)
3. `03-exploded-levels-1440.png` — Chế độ tách 5 tầng (`exploded`, 1440×900)
4. `04-level1-gym-cutaway-1440.png` — Tầng 1 Phòng Gym Tiêu chuẩn cắt tường (`cutaway`) + bảng dữ liệu trực tiếp
5. `05-level2-vip-inbody-1440.png` — Tầng 2 Phòng Gym VIP Platinum & InBody 770 + thẻ quyền lợi hạng thẻ
6. `06-b1-pool-lanes-1440.png` — Tầng hầm B1 Hồ bơi Oasis 25m (2 làn bơi) + CTA đặt làn
7. `07-rooftop-zen-yoga-1440.png` — Tầng thượng RF Zen Garden Yoga Studio
8. `08-outdoor-tennis-1440.png` — Khu ngoài trời OUT Sân Tennis 01 & 02
9. `09-mobile-bottomsheet-390.png` — Giao diện Mobile 390×844 với bottom sheet `DetailPanel`
10. `10-fallback-2d-1440.png` — Chế độ Sơ đồ 2D SVG (`FloorPlan2D`) đồng bộ từ cùng `solCenter.scene.ts`
