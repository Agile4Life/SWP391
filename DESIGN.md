# Quy chuẩn thiết kế chính — SÖL

Cập nhật: **22/10/2026**, theo các quyết định trực tiếp của người dùng trong lần làm lại UI công khai. Đây là nguồn quy chuẩn UI hiện hành cho contributor và coding agent. Đọc cùng [AGENTS.md](AGENTS.md) trước khi thiết kế hoặc sửa frontend.

## Phạm vi

| Khu vực | Quy chuẩn hiện hành | Nguồn triển khai |
| --- | --- | --- |
| Landing `/`, đăng nhập `/login`, đăng ký `/register`, OTP và trang công khai mới | **SÖL Fitness: charcoal–salmon, full width, animation xuất hiện từng component** | `features/landing/fitness-public.css`, `components/PublicLayout.tsx`, `components/FitnessLanding.tsx` |
| Portal `/portal`, `/member/*`, `/staff/*`, `/manager/*` | **Charcoal–salmon, full viewport; giữ nguyên tổ chức component** | `features/portal/portal-shell.css`, `features/member/member-board.css`, `shared/ui/portal.css` |

Theo yêu cầu mới nhất ngày 22/10/2026, portal đồng bộ màu với landing: nền than `#202020`, bề mặt `#292929` / `#303030`, chữ `#faf9f6`, chữ phụ `#bcb8b5`, nút chính và điểm nhấn salmon `#ce9180`, hover `#e1aa98`. Portal rộng `100%`, không max-width, không padding/viền/bo góc khung ngoài và cao tối thiểu `100dvh` trên desktop/mobile.

Giữ nguyên tổ chức component: dashboard bốn cột, sidebar icon, ảnh/thẻ, thứ tự nội dung, khoảng cách bên trong, cỡ chữ và hiệu ứng. Không đổi sang dashboard hai cột hay sidebar có nhãn thường trực. “Full trang” áp dụng cho khung ngoài; giữ cuộn dọc native, không fixed toàn bộ nội dung hoặc khóa cuộn.

Nội dung portal được rút gọn theo tác vụ; không dùng khẩu hiệu, quyền lợi gói tự suy đoán, độ tin cậy AI giả hoặc phản hồi “đã lưu” khi chỉ là dữ liệu minh họa tại máy. Thay câu chữ không đồng nghĩa với thay vị trí hay loại bỏ component.

## Nhận diện và màu

Giữ thương hiệu **SÖL**; wordmark công khai là **SÖL Fitness**. Ảnh tham chiếu ban đầu dùng nhãn khác, nhưng không đổi tên sản phẩm để khớp ảnh.

| Token / vai trò | Giá trị | Cách dùng |
| --- | --- | --- |
| `--fit-ink` | `#202020` | Nền chính, nền trang và track scrollbar |
| `--fit-salmon` | `#ce9180` | Thẻ dịch vụ, gói nổi bật, CTA, mũi tên, điểm nhấn và thumb scrollbar |
| `--fit-paper` | `#faf9f6` | Chữ chính trên nền tối, nút trắng |
| `--fit-muted` | `#bcb8b5` | Mô tả và thông tin phụ trên nền tối |
| `--color-bg-card` trong `.fit-site` | `#292929` | Bề mặt tối dùng chung |
| Bề mặt form / gói thường | `#2b2b2b` / `#303030` | Phân lớp với nền chính |
| Salmon hover | `#e1aa98` | Phản hồi nhẹ trên nút |

Dùng cùng bảng màu trong `fitness-public.css` và token `--portal-*` của `portal-shell.css`. Token dùng chung như `--color-text-main` được ghi đè trong phạm vi `.fit-site` hoặc `.portal-v2`. Màu trạng thái thành công/lỗi phục vụ nghĩa của thông báo; không dùng chúng làm một theme mới.

## Bố cục

- Trang công khai phủ kín chiều rộng viewport: `.fit-site` không có padding ngoài, `.fit-canvas` rộng `100%` và cao tối thiểu `100dvh`.
- Không thêm lại viền salmon quanh website, bóng đổ khung mockup hoặc giới hạn canvas `1500px`. Hai tấm website đặt chồng trong ảnh nguồn là cách trình bày tham chiếu, không phải layout ứng dụng.
- Vẫn giữ khoảng đệm **bên trong** từng section. `.fit-section` có chiều rộng `83%`, max-width `1160px`; cụm dịch vụ max-width `1000px`. Full width không có nghĩa là ép chữ và form sát mép màn hình.
- Header, hero, CTA cuối và footer chạy trên bề mặt toàn trang. Mobile dùng menu thu gọn, nội dung xếp dọc; các card không được gây cuộn ngang.
- Dùng cuộn dọc native của document. Thumb salmon trên track than cho `.fit-site` và `.portal-backdrop`.
- Breakpoint hiện có: `760px` và `1100px`. Kiểm chứng thêm màn hình rộng `1920px` và `2560px`, không chỉ mobile và 1440px.

## Chữ và component

- Font công khai: **Plus Jakarta Sans**, sans-serif. Tiêu đề đậm, hình học; hero dùng chữ in hoa tách hai vế trên desktop, xuống dòng trên mobile.
- Không phục hồi Cormorant/Playfair, chữ serif nghiêng hoặc nền kem như phong cách chính của phần công khai. Các font và token cũ có thể còn tồn tại để phục vụ mã lịch sử hoặc phạm vi khác.
- Nút chính có dạng pill, thường đi cùng mũi tên nằm trong vòng tròn salmon. Header dùng phiên bản nhỏ hơn; trạng thái hover/pressed và focus phải rõ.
- Bản đồ nhóm cơ tương tác tại Hero (`.fit-hero-anatomy-stage`, `svg.fit-hero-anatomy`, `.fit-muscle-pointer` và `aside.fit-muscle-callout`): đặt khớp trực tiếp trên ảnh vận động viên tách nền (`viewBox="0 0 1024 1536"`), phân biệt 6 vùng cơ chính (`Cơ ngực`, `Vai & Cầu vai`, `Bắp tay`, `Bụng & Core`, `Cẳng tay`, `Đùi & Bắp chân`). Mặc định ẩn hoàn toàn khung chọn và mũi tên để không gây rối mắt; chỉ khi người dùng di chuột hoặc focus vào từng vùng cơ, vùng cơ đó mới sáng lên qua lớp mask mờ (`#fit-active-muscle-mask`) đồng thời vẽ đường mũi tên mảnh (`.fit-muscle-pointer`) chỉ ra thẻ gợi ý luyện tập cơ bản (`.fit-muscle-callout`) và nút CTA (`Xem chi tiết & Mua gói tập`) điều hướng khách sang `/login` (hoặc `/member/packages` khi đã đăng nhập hội viên).
- Thẻ dịch vụ: ba silhouette bo góc lớn, thu ở đáy; thẻ giữa rộng/cao hơn, mép trên hai thẻ ngoài xiên, **chữ giữ ngang**. Icon SVG có màu kem/hồng và nét nâu; tiêu đề trắng, đường kẻ mảnh, mô tả căn giữa.
- Chỉ số câu lạc bộ (`.fit-metrics`): bốn thẻ tối `#292929` bo góc `26px`, kicker salmon, con số đậm `tabular-nums` và mô tả ngắn.
- Câu chuyện: ảnh tối, overlay ở chân ảnh, tên/sao và phần trích dẫn ngắn. Trainer: portrait bo lớn, kích thước lệch nhẹ, gradient salmon ở đáy.
- Lịch lớp tiêu biểu (`#schedule`): switch lọc bộ môn cùng kiểu `.fit-pricing-switch`, lưới 3 cột (`.fit-schedule-card` nền `#2b2b2b`), hiển thị khung giờ salmon, badge chỗ trống, tên lớp, phòng tập/HLV và link đặt lịch.
- Hành trình tuần đầu & Tính nhanh BMI (`#journey`): bố cục 2 cột gồm 3 bước onboarding có badge tròn salmon (`01`–`03`) bên trái và thẻ tính nhanh BMI + gợi ý lộ trình (`.fit-bmi-card`) bên phải.
- Pricing: thẻ thường tối, thẻ nổi bật salmon; nhãn thời hạn trắng, giá đậm, checklist và CTA ở cuối. Form: bề mặt tối, input tối, nút salmon, thông báo lỗi rõ.
- Câu hỏi thường gặp (`#faq`): danh sách accordion tối (`.fit-faq-item`), nút mở/đóng tròn (`+` / `−`) chuyển sang nền salmon khi mở.
- Dùng lại `PublicLayout`, `AuthLayout`, `RoundArrow` và các class `.fit-*`. Giữ page ở vai trò compose feature. Không thay stack hoặc thêm thư viện animation/UI chỉ để thực hiện các hiệu ứng đã có bằng CSS.

## Chuyển động đã chốt

**Quyết định mới nhất: tập trung vào animation xuất hiện của component, lặp lại khi cuộn xuống và cuộn ngược lên; không làm slide trang ngang–dọc.**

| Thành phần | Hiệu ứng hiện hành |
| --- | --- |
| Hero | Hai vế tiêu đề vào lệch nhịp; ảnh vận động viên & bản đồ cơ bắp fade + nâng nhẹ + scale; mô tả, CTA và thẻ gợi ý vùng cơ xuất hiện sau |
| Tiêu đề section / nội dung ngắn | Fade + nâng khoảng 20px |
| Dịch vụ / chỉ số CLB / đánh giá / HLV / lịch lớp / bước tham gia / gói / FAQ | Fade + nâng khoảng 34px; stagger từng thẻ 100ms, tối đa 300ms; danh sách dài chia nhịp theo nhóm ba thẻ |
| Ảnh không gian tập | Reveal với scale nhẹ; fade khi đổi ảnh |
| Đổi nhóm HLV / lọc gói / lọc lịch lớp | Fade ngắn cho nội dung vừa đổi; thẻ mới được đăng ký reveal tự động |
| BMI / mở FAQ | BMI reveal cùng nhóm hành trình, phản hồi nhẹ khi chọn mục tiêu; câu trả lời FAQ fade + nâng trong 320ms mỗi lần mở |
| Hover | Nâng nhẹ card/nút, ảnh HLV scale tối đa khoảng 1.04 |
| Đăng nhập / đăng ký | Phần nội dung và form xuất hiện lệch nhịp; vẫn nhập liệu được bình thường |

Triển khai bằng CSS keyframes/transitions và [useComponentReveal](apps/web/src/features/landing/hooks/useComponentReveal.ts). Đánh dấu mục cần reveal bằng `data-reveal="soft"`, `"lift"` hoặc `"image"`, kể cả component mới. Hook dùng IntersectionObserver: component được chuẩn bị lại khi đã rời hoàn toàn viewport và phát lại hiệu ứng mỗi lần quay vào, ở cả hai chiều cuộn. Cuộn xuống dùng nâng nhẹ từ dưới; cuộn ngược lên dùng hạ nhẹ từ trên. Component còn thấy một phần trên màn hình vẫn giữ trạng thái hiển thị để tránh nhấp nháy. MutationObserver đăng ký các component mới khi đổi bộ lọc hoặc carousel và dọn observer của các thẻ đã bị gỡ.

Các nguyên tắc bắt buộc:

- Không pin cả màn hình, không tạo horizontal scroll track, không chiếm sự kiện wheel/touch/keyboard để đổi trang. Không phục hồi `FullpageScrollManager` hoặc `useSlideController` chỉ vì chúng còn trong repository.
- Không khóa cuộn trong lúc chờ animation. Menu anchor, kéo scrollbar, focus bàn phím, form, gallery và carousel phải hoạt động tự nhiên.
- Không ẩn nội dung nếu không có IntersectionObserver. Focus vào một component phải làm nội dung nhìn thấy ngay.
- Tôn trọng `prefers-reduced-motion`, kể cả khi người dùng đổi cài đặt lúc trang đang mở: nội dung hiện đầy đủ, không còn keyframe/transition tạo chuyển động.
- Ưu tiên opacity, translate và scale; tránh animation làm thay đổi kích thước, reflow hoặc tăng chiều rộng document.
- Thời lượng hiện có: hover 180–220ms; fade khi đổi nội dung 450–650ms; reveal 700–900ms; hero tối đa 1100ms. Không thêm lặp vô hạn hoặc chuyển động lớn vào mọi phần tử.

## Ảnh và nội dung

Ảnh hiện hành nằm tại `apps/web/public/images/fitness/`; dùng lại ảnh studio có sẵn khi phù hợp. Ảnh hero được tách nền, ảnh HLV cùng ánh sáng. Giữ tỷ lệ và crop có chủ đích; dùng lazy loading cho ảnh dưới hero.

Ảnh/câu chuyện minh họa phải tiếp tục được nhận diện là minh họa. Không biến sao đánh giá hoặc hình stock thành nhận xét/HLV thật. Bảng giá giới thiệu hiện tại là tham khảo; dữ liệu mua gói thực tế vẫn do portal/backend quản lý.

## Nguồn hiện hành và nguồn lịch sử

Thứ tự tra cứu khi làm UI: yêu cầu mới nhất của người dùng → `AGENTS.md` và tài liệu này → component/CSS đang được route sử dụng → ảnh chụp kiểm chứng mới.

- [Báo cáo và ảnh hiện hành](docs/ui-review/fitness-reference/README.md).
- [Hero hiện hành](docs/ui-review/fitness-reference/hero-desktop.png), [mobile](docs/ui-review/fitness-reference/hero-mobile.png), [login](docs/ui-review/fitness-reference/login-desktop.png).
- `docs/qa/portal-redesign-2026-10-18.md` và `docs/qa/portal-redesign/` là hồ sơ thiết kế trước đây. Phần portal còn là tham chiếu đúng phạm vi; hình landing/login cũ không còn là chuẩn công khai.
- `landing.css`, các section Quiet Luxury, `IntroCurtain`, `CustomCursor` và các controller slide cũ là mã lịch sử khi không còn được route hiện tại dùng. Không lấy sự tồn tại của chúng làm lý do quay về phong cách cũ.
- Knowledge graph và tài liệu sinh trước lần redesign có thể mô tả luồng cũ; kiểm tra lại route và tài liệu này trước khi áp dụng.

## Kiểm chứng trước khi hoàn tất UI

1. Chạy build/lint phù hợp và test frontend khi thay logic/hook.
2. Chạy `scripts/verify-public-ui.cjs`: full width, scrollbar, responsive, điều hướng và trạng thái form/OTP. Script dùng API giả lập cho auth.
3. Chạy `scripts/verify-public-animation.cjs`: animation bật, replay khi cuộn xuống và cuộn ngược, không reset component còn thấy một phần, đăng ký component mới sau khi lọc, nhập BMI, đóng/mở FAQ, nhập liệu, mobile và reduced motion.
4. Kiểm tra portal khi thay selector/token dùng chung: full viewport tại 390/768/1440/1920/2560px, màu nút, bảng, form và dialog; giữ nguyên dashboard/sidebar và không tràn document trên mobile. Dùng `scripts/verify-ux-consistency.cjs` với API giả lập.
5. Commit thay đổi UI và quy chuẩn theo phần, ghi rõ phần có thể hoàn tác. Cập nhật tài liệu này khi người dùng đổi quyết định thiết kế.
